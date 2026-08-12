/**
 * Pi meta-operator extension. The visible premium session stays active and
 * gains three tools (retrieval_meta_run / retrieval_meta_gate / retrieval_meta_transition); each
 * background gate runs in one extension-owned in-process worker created with
 * createAgentSession({ model: <explicit background gate model>, ... }) — never
 * ctx.newSession(). The child's model run is started asynchronously: launch
 * and send return after safe kickoff/preflight, so a child blocked inside
 * ask_operator can be answered by later tool calls in the parent session.
 * Human-required decisions use the parent TUI (ctx.mode === "tui"):
 * kickoff/resume values are collected or exactly confirmed there, permission
 * approvals show the complete recorded call with its hash, and transition
 * commits confirm the full exact canonical confirmation bytes inside the
 * runtime decide callback. The shared runtime remains the only authority for
 * workflow state and human-selected transitions.
 */
import { createHash } from "node:crypto";
import path from "node:path";

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import {
  composeRoutineAnswer,
  FileMetaStateStore,
  isTerminalWorkerStatus,
  MetaHarnessError,
  MetaSupervisor,
  parseModelRolePolicy,
  requireGateModel,
  SerialQueue,
  type CorrelatedRequest,
  type MetaStateStore,
  type ModelRef,
  type ModelRolePolicy,
  type ProposalScope,
  type SupervisorOwnership,
  type TransitionLease,
  type WorkerRecord,
} from "meta-harness";

import {
  loadActiveRun,
  loadWorkflow,
  inspectCurrentResult,
  recordLaunchDelivery,
  runNextCommand,
  runStartCommand,
} from "../../retrieval_agent_harness_phase_based/plugin-runtime.mjs";
import { buildTransitionBinding } from "../../retrieval_agent_harness_phase_based/meta-review-binding.mjs";
import { createGateToolGuard, untilAborted } from "./retrieval-phase.ts";

const MODEL_CONFIG_FILE = ".pi/retrieval-operator-models.json";
const STATE_FILE = ".pi/.retrieval-meta/state.json";
const RECOVERY_FILE = ".pi/.retrieval-meta/launch-recovery.json";
const RULE_FILES = ["AGENTS.md", "retrieval_agent_harness_phase_based/_SHARED-RETRIEVAL-ENGINEERING-RULES.md"];

/** Installed Pi 0.80.6 thinking levels; anything else fails closed. */
const THINKING_LEVELS = new Set(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);

export interface RequestOutcome {
  approved: boolean;
  answer: string | null;
  reason: string | null;
}

export interface PiWorkerHandle {
  readonly sessionId: string;
  readonly sessionPath: string | null;
  reportedModel(): { provider: string; model: string } | null;
  /** Effective post-clamp thinking level, when the host exposes one. */
  effectiveThinkingLevel(): string | null;
  /**
   * Deliver text to the child WITHOUT awaiting the full model run: resolves
   * after safe kickoff/preflight (or steering while streaming). The run
   * itself is tracked separately; its terminal failure appears in runError().
   */
  send(text: string): Promise<void>;
  isIdle(): boolean;
  /** Terminal error of the child's most recent run, if it failed. */
  runError(): string | null;
  abort(): Promise<void>;
  dispose(): void;
  stats(): { inputTokens: number | null; outputTokens: number | null; cost: number | null } | null;
  transcriptTail(limit: number): Array<{ role: string; text: string }>;
}

export interface CreateWorkerInput {
  cwd: string;
  model: unknown;
  /** Host model registry (with its auth storage) reused for the child. */
  modelRegistry: unknown;
  thinkingLevel: string | null;
  systemPrompt: string;
  guard: { gateResultFile: string; editableFiles: string[]; collaborativeEditPaths: string[] };
  attempt: { runId: string; gateId: string; number: number; launchId: string };
  /** Resume this exact persisted session file instead of creating a new one. */
  resumeSessionPath: string | null;
  onRequest: (request: { kind: "question" | "permission"; payload: string }) => Promise<RequestOutcome>;
}

export interface PiHostBindings {
  resolveGateModel(ctx: ExtensionContext, ref: ModelRef): unknown;
  createWorkerSession(input: CreateWorkerInput): Promise<PiWorkerHandle>;
}

export type PiShutdownOutcome = "complete" | "revocation_failed";

/**
 * Process-death seam for the installed Pi lifecycle. Tests may inject a
 * returning function; production uses terminatePiProcess(), which cannot
 * return. The literal exit code prevents accidentally treating this as a
 * general-purpose process-control hook.
 */
export type PiShutdownTerminator = (exitCode: 1) => unknown;

export function terminatePiProcess(_exitCode: 1): never {
  process.exit(1);
}

interface UiLike {
  confirm(title: string, message: string): Promise<boolean>;
  input(title: string, placeholder?: string): Promise<string | undefined>;
  notify(message: string, type?: "info" | "warning" | "error"): void;
}

interface OperatorContextLike {
  cwd: string;
  mode: string;
  hasUI: boolean;
  ui: UiLike;
  model: { provider: string; id: string } | undefined;
  /** Current visible-session thinking level exposed by the Pi extension API. */
  thinkingLevel: string | undefined;
  sessionManager: { getSessionId(): string };
  isProjectTrusted(): boolean;
  modelRegistry?: unknown;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function sha256Text(value: string): string {
  return createHash("sha256").update(Buffer.from(value, "utf8")).digest("hex");
}

async function readModelPolicy(cwd: string): Promise<ModelRolePolicy> {
  const { readFile } = await import("node:fs/promises");
  let raw: string;
  try {
    raw = await readFile(path.join(cwd, MODEL_CONFIG_FILE), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `${MODEL_CONFIG_FILE} does not exist; create it from retrieval-operator-models.example.json before operating`
      );
    }
    throw error;
  }
  const parsed = JSON.parse(raw) as {
    version?: unknown;
    operator?: { provider?: string; modelId?: string; thinkingLevel?: string } | null;
    gate?: { provider?: string; modelId?: string; thinkingLevel?: string } | null;
  };
  if (parsed.version !== 1) {
    throw new Error(`${MODEL_CONFIG_FILE} must declare version 1`);
  }
  const map = (
    entry: { provider?: string; modelId?: string; thinkingLevel?: string } | null | undefined,
    role: string
  ): ModelRef | null => {
    if (!entry) return null;
    if (entry.thinkingLevel !== undefined && !THINKING_LEVELS.has(entry.thinkingLevel)) {
      throw new Error(
        `${MODEL_CONFIG_FILE}: ${role} thinkingLevel "${entry.thinkingLevel}" is not a Pi thinking level ` +
          `(${[...THINKING_LEVELS].join(", ")})`
      );
    }
    return {
      provider: entry.provider ?? "",
      model: entry.modelId ?? "",
      ...(entry.thinkingLevel !== undefined ? { variant: entry.thinkingLevel } : {}),
    };
  };
  return parseModelRolePolicy(
    { operator: map(parsed.operator, "operator"), gate: map(parsed.gate, "gate") },
    MODEL_CONFIG_FILE
  );
}

interface GateLaunchPacketLike {
  run_id: string;
  gate_result_file: string;
  attempt: number;
  launch_id: string;
  title: string;
  system: string;
  message: string;
  gate: { id: string; title: string };
  required_artifacts: string[];
  allowed_files: string[];
  collaborative_edit_paths: string[];
}

interface WorkflowOutcomeLike {
  kind: string;
  run?: { state: { run_id: string; active_gate_id: string | null } };
  packet?: GateLaunchPacketLike;
  review?: { error?: string };
}

/** Trusted kickoff material persisted at launch for explicit recovery. */
interface PiLaunchRecoveryRecord {
  version: 1;
  host: "pi";
  run_id: string;
  gate_id: string;
  attempt: number;
  launch_id: string;
  session_id: string;
  session_path: string | null;
  system: string;
  message: string;
  guard: { gateResultFile: string; editableFiles: string[]; collaborativeEditPaths: string[] };
  thinking_level: string | null;
  model: { provider: string; modelId: string };
}

function isPiRecoveryRecord(value: unknown): value is PiLaunchRecoveryRecord {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === 1 &&
    candidate.host === "pi" &&
    typeof candidate.run_id === "string" &&
    typeof candidate.gate_id === "string" &&
    typeof candidate.attempt === "number" &&
    typeof candidate.launch_id === "string" &&
    typeof candidate.session_id === "string" &&
    (candidate.session_path === null || typeof candidate.session_path === "string") &&
    typeof candidate.system === "string" &&
    typeof candidate.message === "string" &&
    typeof candidate.guard === "object" &&
    candidate.guard !== null &&
    typeof candidate.model === "object" &&
    candidate.model !== null
  );
}

export async function metaAttemptIsCurrent(
  cwd: string,
  expected: { runId: string; gateId: string; number: number; launchId: string },
  sessionId: string,
  sessionPath: string | null,
): Promise<boolean> {
  const run = await loadActiveRun(cwd);
  const attempt = run?.state.current_attempt;
  return Boolean(
    run &&
      run.state.status === "active" &&
      run.state.run_id === expected.runId &&
      run.state.active_gate_id === expected.gateId &&
      attempt?.gate_id === expected.gateId &&
      attempt?.number === expected.number &&
      attempt?.launch_id === expected.launchId &&
      attempt?.session?.host === "pi" &&
      attempt?.session?.mode === "meta" &&
      attempt?.session?.id === sessionId &&
      (attempt?.session?.path ?? null) === sessionPath
  );
}

function describeOutcome(outcome: WorkflowOutcomeLike): Record<string, unknown> {
  return {
    kind: outcome.kind,
    run_id: outcome.run?.state.run_id ?? null,
    active_gate_id: outcome.run?.state.active_gate_id ?? null,
    ...(outcome.packet
      ? { launched_gate: outcome.packet.gate.id, attempt: outcome.packet.attempt }
      : {}),
    ...(outcome.review?.error ? { error: outcome.review.error } : {}),
  };
}

export class PiMetaOperatorCore {
  readonly #bindings: PiHostBindings;
  readonly #actions = new SerialQueue();
  readonly #ownership: SupervisorOwnership | undefined;
  #supervisor: MetaSupervisor | null = null;
  #policy: ModelRolePolicy | null = null;
  #cwd: string | null = null;
  #recoveryStore: MetaStateStore | null = null;
  #worker: PiWorkerHandle | null = null;
  #deferred: { requestId: string; resolve: (outcome: RequestOutcome) => void } | null = null;

  constructor(bindings: PiHostBindings, options?: { ownership?: SupervisorOwnership }) {
    this.#bindings = bindings;
    this.#ownership = options?.ownership;
  }

  /** Test seam: the in-memory worker handle for the current process. */
  get workerHandle(): PiWorkerHandle | null {
    return this.#worker;
  }

  async #ready(ctx: OperatorContextLike): Promise<{
    supervisor: MetaSupervisor;
    policy: ModelRolePolicy;
    cwd: string;
    recoveryStore: MetaStateStore;
  }> {
    if (!ctx.isProjectTrusted()) {
      throw new Error("the meta-operator requires a trusted project");
    }
    const cwd = path.resolve(ctx.cwd);
    if (this.#supervisor !== null && this.#cwd !== cwd) {
      // Ownership is exclusive per state file: hand back the old project's
      // claim before adopting a new one, and never while a child is live.
      if (this.#worker !== null) {
        throw new Error(
          `a meta-operated worker is still live for ${this.#cwd}; abort or release it before operating on ${cwd}`
        );
      }
      await this.#supervisor.releaseOwnership();
      this.#supervisor = null;
      this.#policy = null;
      this.#recoveryStore = null;
    }
    if (this.#supervisor === null) {
      this.#supervisor = await MetaSupervisor.load({
        store: new FileMetaStateStore(path.join(cwd, STATE_FILE)),
        ...(this.#ownership ? { ownership: this.#ownership } : {}),
      });
      this.#policy = await readModelPolicy(cwd);
      this.#recoveryStore = new FileMetaStateStore(path.join(cwd, RECOVERY_FILE));
      this.#cwd = cwd;
    }
    this.#policy ??= await readModelPolicy(cwd);
    this.#recoveryStore ??= new FileMetaStateStore(path.join(cwd, RECOVERY_FILE));
    this.#assertOperatorModel(ctx);
    return { supervisor: this.#supervisor, policy: this.#policy, cwd, recoveryStore: this.#recoveryStore };
  }

  #assertOperatorModel(ctx: OperatorContextLike): void {
    const operator = this.#policy?.operator;
    if (!operator) return;
    if (!ctx.model) {
      throw new Error(
        `${MODEL_CONFIG_FILE} pins the operator role to ${operator.provider}/${operator.model}, but the ` +
          "visible session has no model; refusing to operate"
      );
    }
    if (ctx.model.provider !== operator.provider || ctx.model.id !== operator.model) {
      throw new Error(
        `the visible session is running ${ctx.model.provider}/${ctx.model.id}, but ` +
          `${MODEL_CONFIG_FILE} pins the operator role to ${operator.provider}/${operator.model}; refusing to operate`
      );
    }
    if (operator.variant !== undefined && ctx.thinkingLevel !== operator.variant) {
      throw new Error(
        `the visible session is running thinking level ${ctx.thinkingLevel ?? "(unexposed)"}, but ` +
          `${MODEL_CONFIG_FILE} pins the operator role to thinking level ${operator.variant}; ` +
          "refusing to operate"
      );
    }
  }

  #requireTui(ctx: OperatorContextLike, what: string): void {
    if (ctx.mode !== "tui" || !ctx.hasUI) {
      throw new Error(`${what} requires the interactive Pi TUI (human-authoritative confirmation)`);
    }
  }

  #handleWorkerRequest(supervisor: MetaSupervisor) {
    return async (request: { kind: "question" | "permission"; payload: string }): Promise<RequestOutcome> => {
      const worker = supervisor.getWorker();
      if (!worker || worker.status !== "active") {
        return { approved: false, answer: null, reason: "no active meta-operated worker" };
      }
      let opened;
      try {
        opened = await supervisor.openRequest({
          workerId: worker.workerId,
          kind: request.kind,
          payload: request.payload,
        });
      } catch (error) {
        if (error instanceof MetaHarnessError && error.code === "payload_too_large") {
          // Never truncate authorization-bearing content: reject it outright.
          return { approved: false, answer: null, reason: error.message };
        }
        throw error;
      }
      return new Promise<RequestOutcome>((resolve) => {
        // The request may have been interrupted between the open commit and
        // this continuation; registering a deferred for it would wedge the
        // child forever, so re-check the supervisor's pending state first.
        const current = supervisor.getPendingRequest();
        if (!current || current.requestId !== opened.requestId) {
          resolve({
            approved: false,
            answer: null,
            reason: "The request was interrupted before it could be relayed.",
          });
          return;
        }
        this.#deferred = { requestId: opened.requestId, resolve };
      });
    };
  }

  #resolveDeferred(requestId: string, outcome: RequestOutcome): void {
    if (this.#deferred?.requestId === requestId) {
      const { resolve } = this.#deferred;
      this.#deferred = null;
      resolve(outcome);
    }
  }

  /** Revoke the in-process child; must succeed before metadata turns terminal. */
  async #revokeChild(): Promise<void> {
    if (!this.#worker) return;
    await this.#worker.abort();
    this.#worker.dispose();
    this.#worker = null;
  }

  /**
   * Pi exposes the resolved child model and post-clamp thinking level at
   * creation time. Missing identity is therefore not an "unexposed" host
   * limitation: revoke the child and fail before recording or prompting it.
   */
  async #verifyGateIdentity(
    supervisor: MetaSupervisor,
    handle: PiWorkerHandle,
    gateModel: ModelRef,
    operation: "launch" | "recovery",
    recoveryStore: MetaStateStore,
  ): Promise<{ provider: string; model: string }> {
    const reported = handle.reportedModel();
    const effectiveThinking = handle.effectiveThinkingLevel();
    let reason: string | null = null;
    if (!reported) {
      reason = `${operation} exposed no resolved gate model`;
    } else if (reported.provider !== gateModel.provider || reported.model !== gateModel.model) {
      reason =
        `${operation} model mismatch: configured ${gateModel.provider}/${gateModel.model}, ` +
        `resolved ${reported.provider}/${reported.model}`;
    } else if (gateModel.variant !== undefined && effectiveThinking !== gateModel.variant) {
      reason =
        `${operation} thinking level mismatch: configured ${gateModel.variant}, ` +
        `effective ${effectiveThinking ?? "(unexposed)"}`;
    }
    if (reason) {
      await this.#revokeChild();
      await recoveryStore.save(null);
      await supervisor.abortWorker({ reason: "model_mismatch" });
      throw new Error(`${reason}; refusing the ${operation}`);
    }
    return reported!;
  }

  /**
   * Persist the interruption of the pending correlated request and unblock
   * the child's deferred. MUST run before AgentSession.abort(): Pi's abort
   * waits for the agent to become idle, and a child blocked inside an
   * unresolved ask_operator/permission promise never becomes idle on its own.
   */
  async #interruptPendingRequest(
    supervisor: MetaSupervisor,
    reason: string
  ): Promise<CorrelatedRequest | null> {
    const pending = supervisor.getPendingRequest();
    let interrupted: CorrelatedRequest | null = null;
    if (pending) {
      interrupted = await supervisor.resolveRequest({
        requestId: pending.requestId,
        ...(pending.hostRequestId !== null ? { hostRequestId: pending.hostRequestId } : {}),
        resolution: {
          outcome: "interrupted",
          source: "interrupted",
          citedFactIds: [],
          detail: reason,
        },
      });
      this.#resolveDeferred(pending.requestId, { approved: false, answer: null, reason });
    }
    if (this.#deferred) {
      // A dangling deferred without a persisted request must still resolve.
      this.#resolveDeferred(this.#deferred.requestId, { approved: false, answer: null, reason });
    }
    return interrupted;
  }

  #metaLaunch(
    supervisor: MetaSupervisor,
    policy: ModelRolePolicy,
    ctx: OperatorContextLike,
    cwd: string,
    recoveryStore: MetaStateStore
  ) {
    return async (
      packet: GateLaunchPacketLike,
      record: (session: { id: string; path: string; mode?: "manual" | "meta" }) => Promise<void>
    ): Promise<{ id: string; path: string }> => {
      const gateModel = requireGateModel(policy, MODEL_CONFIG_FILE);
      const worker = await supervisor.beginLaunch({
        task: { runId: packet.run_id, taskId: packet.gate.id, attempt: packet.attempt },
        model: gateModel,
      });
      let runtimeRecorded = false;
      try {
        const model = this.#bindings.resolveGateModel(ctx as unknown as ExtensionContext, gateModel);
        const handle = await this.#bindings.createWorkerSession({
          cwd,
          model,
          modelRegistry: ctx.modelRegistry ?? null,
          thinkingLevel: gateModel.variant ?? null,
          systemPrompt: [
            packet.system,
            "",
            "# Pi meta-operated gate boundary",
            "",
            "You are a background gate worker supervised by a meta-operator.",
            `The only writable workflow-control file is ${packet.gate_result_file}.`,
            "Use the ask_operator tool for one focused question when blocked; bash requires relayed human approval.",
          ].join("\n"),
          guard: {
            gateResultFile: packet.gate_result_file,
            editableFiles: [
              ...packet.required_artifacts,
              ...packet.allowed_files,
              packet.gate_result_file,
            ],
            collaborativeEditPaths: packet.collaborative_edit_paths,
          },
          attempt: {
            runId: packet.run_id,
            gateId: packet.gate.id,
            number: packet.attempt,
            launchId: packet.launch_id,
          },
          resumeSessionPath: null,
          onRequest: this.#handleWorkerRequest(supervisor),
        });
        this.#worker = handle;
        const reported = await this.#verifyGateIdentity(
          supervisor,
          handle,
          gateModel,
          "launch",
          recoveryStore,
        );
        const identity = { id: handle.sessionId, path: handle.sessionPath ?? "" };
        await record({ ...identity, mode: "meta" });
        runtimeRecorded = true;
        await supervisor.recordWorkerSession({
          workerId: worker.workerId,
          hostSessionId: handle.sessionId,
          hostSessionPath: handle.sessionPath,
          reportedModel: reported,
        });
        const recovery: PiLaunchRecoveryRecord = {
          version: 1,
          host: "pi",
          run_id: packet.run_id,
          gate_id: packet.gate.id,
          attempt: packet.attempt,
          launch_id: packet.launch_id,
          session_id: handle.sessionId,
          session_path: handle.sessionPath,
          system: packet.system,
          message: packet.message,
          guard: {
            gateResultFile: packet.gate_result_file,
            editableFiles: [
              ...packet.required_artifacts,
              ...packet.allowed_files,
              packet.gate_result_file,
            ],
            collaborativeEditPaths: packet.collaborative_edit_paths,
          },
          thinking_level: gateModel.variant ?? null,
          model: { provider: gateModel.provider, modelId: gateModel.model },
        };
        await recoveryStore.save(recovery);
        // Kickoff is asynchronous: this resolves after safe preflight, so the
        // serialized action queue is never held for the full model run.
        await handle.send(packet.message);
        return identity;
      } catch (error) {
        let cleanupError: unknown;
        try {
          await this.#revokeChild();
        } catch (revokeError) {
          cleanupError = revokeError;
        }
        if (!cleanupError) {
          const current = supervisor.getWorker();
          if (current?.workerId === worker.workerId && !isTerminalWorkerStatus(current.status)) {
            try {
              await supervisor.abortWorker({ reason: `launch failed: ${errorText(error)}` });
            } catch (candidate) {
              cleanupError = candidate;
            }
          }
        }
        if (cleanupError) {
          const unsafe = new Error(
            `launch failed (${errorText(error)}) and cleanup could not complete: ${errorText(cleanupError)}; ` +
              "the worker record stays non-terminal",
            { cause: error },
          ) as Error & { preserveRecordedAttempt?: boolean };
          unsafe.preserveRecordedAttempt = runtimeRecorded;
          throw unsafe;
        }
        if (runtimeRecorded) {
          const preserved = (error instanceof Error ? error : new Error(errorText(error))) as Error & {
            preserveRecordedAttempt?: boolean;
          };
          preserved.preserveRecordedAttempt = true;
          throw preserved;
        }
        throw error;
      }
    };
  }

  async #recordWorkerUsage(supervisor: MetaSupervisor, reason: string): Promise<void> {
    const worker = supervisor.getWorker();
    const stats = this.#worker?.stats();
    if (!worker || !stats) return;
    await supervisor.recordUsage({
      role: "gate",
      workerId: worker.workerId,
      inputTokens: stats.inputTokens,
      outputTokens: stats.outputTokens,
      cost: stats.cost,
      source: `pi session ${worker.hostSessionId ?? "unknown"} (${reason})`,
    });
  }

  async #reviewStatus(cwd: string): Promise<unknown> {
    try {
      const run = await loadActiveRun(cwd);
      if (!run?.state.current_attempt) return null;
      const workflow = await loadWorkflow(cwd);
      const review = await inspectCurrentResult(workflow, run);
      return { status: review.status, ...(review.error ? { error: review.error } : {}) };
    } catch (error) {
      return { status: "error", error: errorText(error) };
    }
  }

  /**
   * Idempotent session-scoped cleanup for Pi session_shutdown (and tests):
   * persist the interruption of any pending request and unblock the child's
   * deferred FIRST, then revoke the child. Supervisor metadata turns terminal
   * and ownership is released only when the revocation actually succeeded; a
   * failed abort leaves the worker handle, supervisor, project context, worker
   * record, and ownership intact so shutdown can retry revocation. If the
   * process cannot retry, terminating it remains the only safe fallback because
   * the child may still be running.
   */
  shutdown(reason: string): Promise<PiShutdownOutcome> {
    return this.#actions.run(async () => {
      const supervisor = this.#supervisor;
      const denial = `The parent session shut down: ${reason}`;
      if (supervisor) {
        await this.#interruptPendingRequest(supervisor, denial);
      } else if (this.#deferred) {
        this.#resolveDeferred(this.#deferred.requestId, {
          approved: false,
          answer: null,
          reason: denial,
        });
      }
      try {
        await this.#revokeChild();
      } catch {
        // Retain every piece of revocation authority. Dropping the handle,
        // supervisor, cwd, or ownership here would turn an unsafe live child
        // into an unmanageable one and make a later shutdown retry impossible.
        return "revocation_failed";
      }
      if (supervisor) {
        const worker = supervisor.getWorker();
        if (worker && !isTerminalWorkerStatus(worker.status)) {
          await supervisor.abortWorker({ reason });
        }
        await supervisor.releaseOwnership();
      }
      this.#supervisor = null;
      this.#policy = null;
      this.#cwd = null;
      this.#recoveryStore = null;
      return "complete";
    });
  }

  runAction(
    ctx: OperatorContextLike,
    args: {
      action: "status" | "start" | "resume" | "recover";
      targetRepoPath?: string;
      initialIdea?: string;
      resumeReason?: string;
    }
  ): Promise<string> {
    return this.#actions.run(async () => {
      const { supervisor, policy, cwd, recoveryStore } = await this.#ready(ctx);

      if (args.action === "status") {
        const run = await loadActiveRun(cwd).catch(() => null);
        const facts = run ? supervisor.listFacts({ runId: run.state.run_id }) : [];
        return json({
          run: run
            ? {
                run_id: run.state.run_id,
                status: run.state.status,
                active_gate_id: run.state.active_gate_id,
                current_attempt: run.state.current_attempt,
              }
            : null,
          review: await this.#reviewStatus(cwd),
          worker: supervisor.getWorker(),
          worker_in_memory: this.#worker !== null,
          worker_run_error: this.#worker?.runError() ?? null,
          pending_request: supervisor.getPendingRequest(),
          approved_facts: facts.map((fact) => ({
            id: fact.id,
            text: fact.text,
            provenance: `${fact.provenance.kind}:${fact.provenance.source}`,
          })),
          proposal: supervisor.getProposal()
            ? { scope: supervisor.getProposal()?.scope, sha256: supervisor.getProposal()?.canonicalSha256 }
            : null,
          recovered_interruptions: supervisor.recoveredInterruptions,
          gate_usage: supervisor.usageSummary(),
          gate_model: policy.gate,
          operator_model: policy.operator,
        });
      }

      if (args.action === "start") {
        this.#requireTui(ctx, "starting a run");
        requireGateModel(policy, MODEL_CONFIG_FILE);
        // Kickoff values become approved context; they are either typed by
        // the human here, or exactly confirmed by the human here. A
        // model-authored tool argument alone is never a human fact.
        let targetRepoPath = args.targetRepoPath?.trim();
        let initialIdea = args.initialIdea?.trim();
        let intake: { targetRepoPath: string; initialIdea: string } | undefined;
        if (targetRepoPath && initialIdea) {
          const confirmed = await ctx.ui.confirm(
            "Start the Retrieval run with these exact kickoff values?",
            [
              `Target repository: ${targetRepoPath}`,
              "",
              "Initial idea:",
              initialIdea,
              "",
              "These exact values are seeded as approved context for routine gate answers.",
            ].join("\n")
          );
          if (!confirmed) {
            return json({ outcome: "cancelled", note: "The human did not confirm the kickoff values; no run was created." });
          }
          intake = { targetRepoPath, initialIdea };
        } else {
          targetRepoPath = (
            await ctx.ui.input("Where is your agent repository?", "Use . for the current project")
          )?.trim();
          if (!targetRepoPath) {
            return json({ outcome: "cancelled", note: "No target repository was provided; no run was created." });
          }
          initialIdea = (
            await ctx.ui.input(
              "What should the enterprise retrieval agent being built do?",
              "Initial idea, users, constraints, and desired outcome"
            )
          )?.trim();
          if (!initialIdea) {
            return json({ outcome: "cancelled", note: "No initial idea was provided; no run was created." });
          }
          intake = { targetRepoPath, initialIdea };
        }
        const outcome = (await runStartCommand({
          repoRoot: cwd,
          host: "pi",
          sessionMode: "meta",
          intake,
          resumeReason: undefined,
          launch: this.#metaLaunch(supervisor, policy, ctx, cwd, recoveryStore),
        })) as WorkflowOutcomeLike;
        if (outcome.kind === "launched" && outcome.run) {
          await this.#seedApprovedContext(supervisor, cwd, intake, outcome.run.state.run_id);
        }
        return json(describeOutcome(outcome));
      }

      if (args.action === "recover") {
        this.#requireTui(ctx, "recovering an interrupted launch");
        return json(await this.#recoverAction(supervisor, policy, ctx, cwd, recoveryStore));
      }

      // resume
      this.#requireTui(ctx, "resuming a blocked run");
      requireGateModel(policy, MODEL_CONFIG_FILE);
      let resumeReason = args.resumeReason?.trim();
      if (resumeReason) {
        const confirmed = await ctx.ui.confirm(
          "Resume the blocked run with this exact direction?",
          resumeReason
        );
        if (!confirmed) {
          return json({ outcome: "cancelled", note: "The human did not confirm the resume direction." });
        }
      } else {
        resumeReason = (
          await ctx.ui.input("Why resume?", "Short direction for the fresh gate session")
        )?.trim();
        if (!resumeReason) {
          return json({ outcome: "cancelled", note: "No resume direction was provided; the run stays blocked." });
        }
      }
      const outcome = (await runStartCommand({
        repoRoot: cwd,
        host: "pi",
        sessionMode: "meta",
        intake: undefined,
        resumeReason,
        launch: this.#metaLaunch(supervisor, policy, ctx, cwd, recoveryStore),
      })) as WorkflowOutcomeLike;
      return json(describeOutcome(outcome));
    });
  }

  async #seedApprovedContext(
    supervisor: MetaSupervisor,
    cwd: string,
    intake: { targetRepoPath: string; initialIdea: string },
    runId: string
  ): Promise<void> {
    await supervisor.approveFact({
      runId,
      text: `Kickoff target repository: ${intake.targetRepoPath}`,
      provenance: { kind: "kickoff", source: "retrieval_meta_run(start) parent-TUI intake" },
    });
    await supervisor.approveFact({
      runId,
      text: `Kickoff initial idea: ${intake.initialIdea}`,
      provenance: { kind: "kickoff", source: "retrieval_meta_run(start) parent-TUI intake" },
    });
    const { readFile } = await import("node:fs/promises");
    for (const ruleFile of RULE_FILES) {
      try {
        const bytes = await readFile(path.join(cwd, ruleFile));
        await supervisor.approveFact({
          runId,
          text: `Repository rule file ${ruleFile} (sha256 ${createHash("sha256").update(bytes).digest("hex")}) is approved context; quote it verbatim when answering from it.`,
          provenance: { kind: "repository-rule", source: ruleFile },
        });
      } catch {
        // A missing rule file is simply not approved context.
      }
    }
  }

  /**
   * Explicit trusted recovery for a recorded failed/interrupted attempt: a
   * new in-process child resumes the exact persisted session file recorded by
   * the runtime (re-delivering the persisted kickoff when it never arrived),
   * or the runtime itself resumes the launch after a committed decision whose
   * next launch failed. The decision is not repeated and no duplicate attempt
   * is launched.
   */
  async #recoverAction(
    supervisor: MetaSupervisor,
    policy: ModelRolePolicy,
    ctx: OperatorContextLike,
    cwd: string,
    recoveryStore: MetaStateStore
  ): Promise<Record<string, unknown>> {
    const worker = supervisor.getWorker();
    if (worker && !isTerminalWorkerStatus(worker.status)) {
      throw new Error(`worker ${worker.workerId} is still ${worker.status}; recovery applies only to interrupted work`);
    }
    if (supervisor.getPendingRequest()) {
      throw new Error("a correlated request is pending; resolve or abort it before recovering");
    }
    const gateModel = requireGateModel(policy, MODEL_CONFIG_FILE);
    const run = await loadActiveRun(cwd);
    if (!run) return { outcome: "no_run", note: "Nothing to recover; use start." };

    const attempt = run.state.current_attempt as
      | {
          gate_id: string;
          number: number;
          launch_id: string;
          session?: { host?: string; mode?: string; id?: string; path?: string };
        }
      | null
      | undefined;
    if (attempt) {
      if (attempt.session?.host !== "pi" || attempt.session.mode !== "meta" || !attempt.session.id) {
        throw new Error("the recorded attempt does not belong to a Pi meta-operated session");
      }
      const raw = await recoveryStore.load();
      if (
        !isPiRecoveryRecord(raw) ||
        raw.run_id !== run.state.run_id ||
        raw.gate_id !== attempt.gate_id ||
        raw.attempt !== attempt.number ||
        raw.launch_id !== attempt.launch_id ||
        raw.session_id !== attempt.session.id ||
        (raw.session_path ?? "") !== (attempt.session.path ?? "")
      ) {
        throw new Error(
          "no trusted launch-recovery record matches the recorded attempt; the attempt cannot be recovered automatically"
        );
      }
      if (raw.model.provider !== gateModel.provider || raw.model.modelId !== gateModel.model) {
        throw new Error(
          "the configured gate model changed since the interrupted launch; refusing to recover with a different model"
        );
      }
      // Configured and persisted thinking levels must agree before recovery;
      // the configured value is then what the resumed child deliberately runs.
      if (raw.thinking_level !== (gateModel.variant ?? null)) {
        throw new Error(
          "the configured gate thinking level changed since the interrupted launch; refusing to recover with a different level"
        );
      }
      const readopted = await supervisor.beginLaunch({
        task: { runId: run.state.run_id, taskId: attempt.gate_id, attempt: attempt.number },
        model: gateModel,
      });
      let handle: PiWorkerHandle;
      try {
        const model = this.#bindings.resolveGateModel(ctx as unknown as ExtensionContext, gateModel);
        handle = await this.#bindings.createWorkerSession({
          cwd,
          model,
          modelRegistry: ctx.modelRegistry ?? null,
          thinkingLevel: gateModel.variant ?? null,
          systemPrompt: raw.system,
          guard: raw.guard,
          attempt: {
            runId: raw.run_id,
            gateId: raw.gate_id,
            number: raw.attempt,
            launchId: attempt.launch_id,
          },
          resumeSessionPath: raw.session_path,
          onRequest: this.#handleWorkerRequest(supervisor),
        });
      } catch (error) {
        await supervisor.abortWorker({ reason: `recovery failed: ${errorText(error)}` });
        throw error;
      }
      this.#worker = handle;
      if (handle.sessionId !== attempt.session.id) {
        await this.#revokeChild();
        await recoveryStore.save(null);
        await supervisor.abortWorker({
          reason: `recovery resumed session ${handle.sessionId}, not the recorded ${attempt.session.id}`,
        });
        throw new Error("the resumed child session does not match the runtime-recorded attempt session");
      }
      const reported = await this.#verifyGateIdentity(
        supervisor,
        handle,
        gateModel,
        "recovery",
        recoveryStore,
      );
      await supervisor.recordWorkerSession({
        workerId: readopted.workerId,
        hostSessionId: handle.sessionId,
        hostSessionPath: handle.sessionPath,
        reportedModel: reported,
      });
      const kickoffDelivered = handle.transcriptTail(1_000).some((entry) => entry.role === "user");
      if (!kickoffDelivered) await handle.send(raw.message);
      await recordLaunchDelivery(run, attempt);
      return {
        outcome: "recovered",
        readopted_session: handle.sessionId,
        kickoff_redelivered: !kickoffDelivered,
        worker: supervisor.getWorker(),
      };
    }

    // No current attempt: the decision state committed but the next launch
    // failed. The runtime resumes that launch directly. A ready result instead
    // means a human decision is required, so decline it here.
    const outcome = (await runNextCommand({
      repoRoot: cwd,
      host: "pi",
      sessionMode: "meta",
      display: async () => {},
      decide: async () => null,
      afterDecision: async () => {},
      launch: this.#metaLaunch(supervisor, policy, ctx, cwd, recoveryStore),
    })) as WorkflowOutcomeLike;
    if (outcome.kind === "cancelled") {
      return {
        outcome: "decision_required",
        note: "The active gate has a ready result; recovery does not decide gates. Use retrieval_meta_transition.",
      };
    }
    return { outcome: "recovered", ...describeOutcome(outcome) };
  }

  gateAction(
    ctx: OperatorContextLike,
    args: {
      action:
        | "wait"
        | "read"
        | "send"
        | "question_reply"
        | "question_reject"
        | "permission_reply"
        | "permission_reject"
        | "abort"
        | "release";
      message?: string;
      requestId?: string;
      answer?: string;
      citedFactIds?: string[];
      source?: "approved-context" | "human";
      reason?: string;
      timeoutSeconds?: number;
    }
  ): Promise<string> {
    return this.#actions.run(async () => {
      const { supervisor, cwd, recoveryStore } = await this.#ready(ctx);
      const worker = supervisor.getWorker();

      if (args.action === "wait") {
        if (!worker || worker.status !== "active") return json({ outcome: "no_active_worker", worker });
        const deadline = Date.now() + Math.min(Math.max(args.timeoutSeconds ?? 30, 1), 120) * 1000;
        for (;;) {
          const pending = supervisor.getPendingRequest();
          if (pending) {
            return json({ outcome: pending.kind, request: pending });
          }
          const runError = this.#worker?.runError() ?? null;
          if (runError) {
            return json({ outcome: "run_error", error: runError });
          }
          if (this.#worker?.isIdle() ?? true) {
            return json({ outcome: "idle", review: await this.#reviewStatus(cwd) });
          }
          if (Date.now() >= deadline) return json({ outcome: "timeout" });
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }

      if (args.action === "read") {
        return json({
          worker,
          worker_in_memory: this.#worker !== null,
          worker_run_error: this.#worker?.runError() ?? null,
          model_verification: worker?.modelVerification ?? null,
          pending_request: supervisor.getPendingRequest(),
          transcript: this.#worker?.transcriptTail(20) ?? [],
          usage_live: this.#worker?.stats() ?? null,
        });
      }

      if (args.action === "send") {
        if (!worker || worker.status !== "active" || !this.#worker) {
          throw new Error("no active in-memory gate worker to send to");
        }
        if (supervisor.getPendingRequest()) {
          throw new Error("a correlated request is pending; reply or reject before sending follow-ups");
        }
        if (!args.message?.trim()) throw new Error("send requires a non-empty message");
        await this.#worker.send(
          `Meta-operator note (advisory; not a human gate decision):\n${args.message.trim()}`
        );
        return json({ outcome: "sent" });
      }

      if (args.action === "question_reply" || args.action === "question_reject") {
        const pending = supervisor.getPendingRequest();
        if (!pending || pending.kind !== "question") throw new Error("no pending gate question");
        if (pending.requestId !== args.requestId) {
          throw new Error(`requestId does not match the pending request (${pending.requestId})`);
        }

        if (args.action === "question_reject") {
          if (!args.reason?.trim()) throw new Error("question_reject requires a reason");
          await supervisor.resolveRequest({
            requestId: pending.requestId,
            resolution: {
              outcome: "rejected",
              source: "operator-reject",
              citedFactIds: [],
              detail: args.reason.trim(),
            },
          });
          this.#resolveDeferred(pending.requestId, {
            approved: false,
            answer: null,
            reason: `Question rejected by the operator: ${args.reason.trim()}`,
          });
          return json({ outcome: "rejected" });
        }

        const source = args.source ?? "human";
        if (source === "approved-context") {
          const facts = supervisor.listFacts({ runId: pending.task.runId });
          await this.#revalidateRuleCitations(cwd, facts, args.citedFactIds ?? []);
          const routine = composeRoutineAnswer({
            facts,
            citedFactIds: args.citedFactIds ?? [],
            answer: args.answer ?? "",
            scope: { runId: pending.task.runId },
          });
          await supervisor.resolveRequest({
            requestId: pending.requestId,
            resolution: {
              outcome: "answered",
              source: "approved-context",
              citedFactIds: routine.citations.map((citation) => citation.factId),
              detail: routine.answer,
            },
          });
          this.#resolveDeferred(pending.requestId, {
            approved: true,
            answer: `${routine.answer}\n\n(Provenance: ${routine.citations
              .map((citation) => citation.provenance)
              .join("; ")})`,
            reason: null,
          });
          return json({ outcome: "answered", source, citedFactIds: routine.citations.map((c) => c.factId) });
        }

        // Material question: the human sees the exact question and authors
        // the answer in the parent TUI.
        this.#requireTui(ctx, "answering a material gate question");
        const humanAnswer = (
          await ctx.ui.input(
            `Gate ${pending.task.taskId} question (attempt ${pending.task.attempt}): ${pending.payload}`,
            "Your answer is relayed verbatim to the background gate"
          )
        )?.trim();
        if (!humanAnswer) {
          return json({ outcome: "cancelled", note: "The human provided no answer; the question stays pending." });
        }
        await supervisor.resolveRequest({
          requestId: pending.requestId,
          resolution: { outcome: "answered", source: "human", citedFactIds: [], detail: humanAnswer },
        });
        this.#resolveDeferred(pending.requestId, { approved: true, answer: humanAnswer, reason: null });
        return json({ outcome: "answered", source: "human" });
      }

      if (args.action === "permission_reply" || args.action === "permission_reject") {
        const pending = supervisor.getPendingRequest();
        if (!pending || pending.kind !== "permission") throw new Error("no pending gate permission");
        if (pending.requestId !== args.requestId) {
          throw new Error(`requestId does not match the pending request (${pending.requestId})`);
        }

        if (args.action === "permission_reject") {
          if (!args.reason?.trim()) throw new Error("permission_reject requires a reason");
          await supervisor.resolveRequest({
            requestId: pending.requestId,
            resolution: {
              outcome: "rejected",
              source: "operator-reject",
              citedFactIds: [],
              detail: args.reason.trim(),
            },
          });
          this.#resolveDeferred(pending.requestId, {
            approved: false,
            answer: null,
            reason: `The operator rejected this call: ${args.reason.trim()}`,
          });
          return json({ outcome: "rejected" });
        }

        // Approval requires the human to confirm the complete recorded
        // request: the exact intercepted payload plus its hash. The worker is
        // blocked inside this very call, so approval binds it without TOCTOU.
        this.#requireTui(ctx, "approving a gate permission");
        const approved = await ctx.ui.confirm(
          `Gate ${pending.task.taskId}: allow this exact call?`,
          [
            pending.payload,
            "",
            `payload sha256: ${sha256Text(pending.payload)}`,
            "This approval covers exactly this pending call; the worker is blocked inside it.",
          ].join("\n")
        );
        if (!approved) {
          await supervisor.resolveRequest({
            requestId: pending.requestId,
            resolution: {
              outcome: "rejected",
              source: "human",
              citedFactIds: [],
              detail: "The human declined the permission dialog.",
            },
          });
          this.#resolveDeferred(pending.requestId, {
            approved: false,
            answer: null,
            reason: "The human declined this gate's call.",
          });
          return json({ outcome: "declined_by_human" });
        }
        await supervisor.resolveRequest({
          requestId: pending.requestId,
          resolution: { outcome: "answered", source: "human", citedFactIds: [], detail: "approved once" },
        });
        this.#resolveDeferred(pending.requestId, { approved: true, answer: null, reason: null });
        return json({ outcome: "approved_once" });
      }

      if (args.action === "abort") {
        if (!args.reason?.trim()) throw new Error("abort requires a reason");
        await this.#recordWorkerUsage(supervisor, "abort");
        // Persist the interruption and unblock the child's deferred BEFORE
        // AgentSession.abort(), which waits for idle; then child revocation
        // must succeed before metadata turns terminal.
        const interrupted = await this.#interruptPendingRequest(
          supervisor,
          "The worker was aborted by the operator."
        );
        await this.#revokeChild();
        await recoveryStore.save(null);
        const result = await supervisor.abortWorker({ reason: args.reason.trim() });
        return json({
          outcome: "aborted",
          worker: result.worker,
          interrupted_request: interrupted ?? result.interruptedRequest,
        });
      }

      // release: only an idle, model-verified worker whose ready result the
      // runtime attributes to the same session may be released.
      if (!worker) throw new Error("no worker to release");
      if (worker.status !== "active") {
        throw new Error(`worker ${worker.workerId} is ${worker.status}; only an active worker can be released — use abort instead`);
      }
      if (worker.modelVerification !== "verified") {
        throw new Error("release requires a verified gate model; wait for verification or abort");
      }
      if (supervisor.getPendingRequest()) {
        throw new Error("a correlated request is pending; resolve or abort before releasing");
      }
      if (!this.#worker) {
        throw new Error("no in-memory child exists to confirm idleness; use abort (or recover) instead");
      }
      if (!this.#worker.isIdle()) {
        throw new Error("the child session is still working; wait for idle or abort");
      }
      const runError = this.#worker.runError();
      if (runError) {
        throw new Error(`the child run failed (${runError}); abort the worker instead of releasing it`);
      }
      const review = await this.#reviewStatus(cwd);
      if ((review as { status?: string } | null)?.status !== "ready") {
        throw new Error(
          `release requires a ready gate result (currently: ${(review as { status?: string } | null)?.status ?? "no attempt"}); keep waiting or abort`
        );
      }
      const run = await loadActiveRun(cwd);
      if (run?.state.current_attempt?.session?.id !== worker.hostSessionId) {
        throw new Error("the runtime-recorded attempt session does not match the supervisor worker; refusing to release");
      }
      await this.#recordWorkerUsage(supervisor, "release");
      await recoveryStore.save(null);
      const released = await supervisor.releaseWorker({
        workerId: worker.workerId,
        reason: args.reason?.trim() || "gate work complete",
        hostConfirmedIdle: true,
      });
      try {
        this.#worker.dispose();
      } catch {
        // Disposal is best-effort once the worker is finished.
      }
      this.#worker = null;
      return json({ outcome: "released", worker: released });
    });
  }

  async #revalidateRuleCitations(
    cwd: string,
    facts: readonly { id: string; text: string; provenance: { kind: string; source: string } }[],
    citedFactIds: readonly string[]
  ): Promise<void> {
    const { readFile } = await import("node:fs/promises");
    for (const factId of citedFactIds) {
      const fact = facts.find((candidate) => candidate.id === factId);
      if (!fact || fact.provenance.kind !== "repository-rule") continue;
      let digest: string;
      try {
        const bytes = await readFile(path.join(cwd, fact.provenance.source));
        digest = createHash("sha256").update(bytes).digest("hex");
      } catch (error) {
        throw new Error(
          `rule file ${fact.provenance.source} for cited fact ${factId} is unreadable: ${errorText(error)}`
        );
      }
      if (!fact.text.includes(`sha256 ${digest}`)) {
        throw new Error(
          `rule file ${fact.provenance.source} changed since fact ${factId} was approved; escalate instead of citing it`
        );
      }
    }
  }

  transitionAction(
    ctx: OperatorContextLike,
    args: {
      action: "prepare" | "commit";
      decision?: "approve" | "revise" | "block" | "not_applicable";
      reason?: string;
    }
  ): Promise<string> {
    return this.#actions.run(async () => {
      const { supervisor, policy, cwd, recoveryStore } = await this.#ready(ctx);
      const operatorSessionId = ctx.sessionManager.getSessionId();

      const requireTerminalWorker = (): WorkerRecord => {
        const gateWorker = supervisor.getWorker();
        if (!gateWorker) throw new Error("no recorded gate worker exists for this attempt");
        if (!isTerminalWorkerStatus(gateWorker.status)) {
          throw new Error(`worker ${gateWorker.workerId} is still ${gateWorker.status}; release or abort it before a transition`);
        }
        return gateWorker;
      };

      if (args.action === "prepare") {
        if (!args.decision) throw new Error("prepare requires a decision");
        supervisor.assertCommitAllowed();
        const gateWorker = requireTerminalWorker();
        const prepared = await buildTransitionBinding({
          repoRoot: cwd,
          host: "pi",
          operatorSessionId,
          operatorModel: policy.operator,
          gateWorker,
          decision: args.decision,
          reason: args.reason ?? null,
        });
        const scope: ProposalScope = {
          operatorSessionId,
          runId: prepared.binding.run.run_id,
          taskId: prepared.binding.run.gate_id,
          attempt: prepared.binding.run.attempt,
        };
        await supervisor.prepareProposal({
          scope,
          canonical: prepared.confirmation,
          summary: `${args.decision} ${prepared.binding.run.gate_id} attempt ${prepared.binding.run.attempt}`,
          preparedByMessageId: null,
        });
        return json({
          outcome: "prepared",
          display: {
            gate: `${prepared.binding.run.gate_id} — ${prepared.binding.run.gate_title}`,
            attempt: prepared.binding.run.attempt,
            decision: prepared.binding.decision,
            agent_recommendation: prepared.binding.agent_recommendation,
            worker: prepared.binding.worker,
            result: prepared.binding.current_result,
            declared_artifacts: prepared.binding.declared_artifacts,
            declared_evidence: prepared.binding.declared_evidence,
            review_manifest_sha256: prepared.binding.review_manifest_sha256,
            catalog: prepared.binding.workflow,
            consequence: prepared.binding.next,
          },
          note: "Commit shows the full exact confirmation bytes in the parent TUI; only the human's confirmation there performs the transition.",
        });
      }

      // commit
      this.#requireTui(ctx, "committing a gate transition");
      const proposal = supervisor.getProposal();
      if (!proposal) throw new Error("no prepared transition proposal exists");
      const parsed = JSON.parse(proposal.canonical.slice(proposal.canonical.indexOf("\n") + 1)) as {
        decision: { value: "approve" | "revise" | "block" | "not_applicable"; reason: string | null };
        run: { gate_id: string; attempt: number };
      };
      let rejection: string | null = null;
      let decisionCommitted = false;
      let activeLease: TransitionLease | null = null;
      const cancelLease = async () => {
        if (!activeLease) return;
        const lease = activeLease;
        activeLease = null;
        await supervisor.endTransition({ leaseId: lease.leaseId, outcome: "cancelled" });
      };

      let outcome: WorkflowOutcomeLike;
      try {
        outcome = (await runNextCommand({
          repoRoot: cwd,
          host: "pi",
          sessionMode: "meta",
          display: async () => {},
          decide: async () => {
            try {
              const gateWorker = requireTerminalWorker();
              const recomputed = await buildTransitionBinding({
                repoRoot: cwd,
                host: "pi",
                operatorSessionId,
                operatorModel: policy.operator,
                gateWorker,
                decision: parsed.decision.value,
                reason: parsed.decision.reason,
              });
              const scope: ProposalScope = {
                operatorSessionId,
                runId: recomputed.binding.run.run_id,
                taskId: recomputed.binding.run.gate_id,
                attempt: recomputed.binding.run.attempt,
              };
              // Atomic: verifies commit gating + proposal, then blocks every
              // other supervisor mutation until the lease ends.
              activeLease = await supervisor.beginTransition({
                scope,
                recomputedCanonical: recomputed.confirmation,
              });
              // The human confirms the FULL exact canonical bytes.
              const confirmed = await ctx.ui.confirm(
                `Commit ${recomputed.binding.decision.value} for ${recomputed.binding.run.gate_id} (attempt ${recomputed.binding.run.attempt})?`,
                recomputed.confirmation
              );
              if (!confirmed) {
                rejection = "the human declined the exact transition confirmation";
                await cancelLease();
                return null;
              }
              // Revalidate against current bytes immediately after the human
              // confirmation, before returning the decision to the runtime.
              const revalidated = await buildTransitionBinding({
                repoRoot: cwd,
                host: "pi",
                operatorSessionId,
                operatorModel: policy.operator,
                gateWorker: requireTerminalWorker(),
                decision: parsed.decision.value,
                reason: parsed.decision.reason,
              });
              if (revalidated.confirmation !== proposal.canonical) {
                rejection = "the reviewed state changed while the human was confirming; no decision was committed";
                await cancelLease();
                return null;
              }
              return parsed.decision.value === "approve"
                ? { decision: "approve" }
                : { decision: parsed.decision.value, reason: parsed.decision.reason ?? "" };
            } catch (error) {
              rejection = errorText(error);
              await cancelLease();
              return null;
            }
          },
          afterDecision: async () => {
            decisionCommitted = true;
            if (activeLease) {
              const lease = activeLease;
              activeLease = null;
              await supervisor.endTransition({ leaseId: lease.leaseId, outcome: "committed" });
            }
          },
          launch: this.#metaLaunch(supervisor, policy, ctx, cwd, recoveryStore),
        })) as WorkflowOutcomeLike;
      } finally {
        await cancelLease();
      }

      if (outcome.kind === "cancelled") {
        return json({ outcome: "cancelled", rejection, note: "No decision was committed and no transition occurred." });
      }
      return json({ ...describeOutcome(outcome), decision_committed: decisionCommitted });
    });
  }
}

/** Real host bindings against the installed Pi package (loader-aliased). */
export function createRealBindings(): PiHostBindings {
  return {
    resolveGateModel(ctx, ref) {
      const registry = (ctx as { modelRegistry: { find(provider: string, id: string): unknown; hasConfiguredAuth(model: unknown): boolean } }).modelRegistry;
      const model = registry.find(ref.provider, ref.model);
      if (!model) {
        throw new Error(
          `gate model ${ref.provider}/${ref.model} is not available in the Pi model registry; refusing to launch`
        );
      }
      if (!registry.hasConfiguredAuth(model)) {
        throw new Error(
          `gate model ${ref.provider}/${ref.model} has no configured authentication; refusing to launch`
        );
      }
      return model;
    },
    async createWorkerSession(input) {
      const piModule = await import("@earendil-works/pi-coding-agent");
      const { Type } = await import("typebox");
      const { homedir } = await import("node:os");
      const agentDir = process.env.PI_CODING_AGENT_DIR ?? path.join(homedir(), ".pi", "agent");

      let childSessionId: string | null = null;
      let childSessionPath: string | null = null;
      const guard = createGateToolGuard({
        projectRoot: input.cwd,
        gateResultFile: input.guard.gateResultFile,
        editableFiles: input.guard.editableFiles,
        collaborativeEditPaths: input.guard.collaborativeEditPaths,
        verifyCurrentAttempt: async () =>
          childSessionId !== null &&
          metaAttemptIsCurrent(input.cwd, input.attempt, childSessionId, childSessionPath),
        requestBashApproval: async (command) => {
          const outcome = await input.onRequest({
            kind: "permission",
            payload: JSON.stringify({ permission: "bash", command }),
          });
          return {
            approved: outcome.approved,
            ...(outcome.reason !== null ? { reason: outcome.reason } : {}),
          };
        },
      });

      const askOperator = piModule.defineTool({
        name: "ask_operator",
        label: "Ask the meta-operator",
        description:
          "Ask the supervising meta-operator one focused question when blocked. Material questions are relayed to the human.",
        parameters: Type.Object({ question: Type.String() }),
        // The pending relay observes the session's abort signal so an aborted
        // child settles this tool call instead of blocking abort() forever.
        execute: async (
          _toolCallId: string,
          params: { question: string },
          signal?: AbortSignal
        ) => {
          const relayed = await untilAborted(
            input.onRequest({
              kind: "question",
              payload: JSON.stringify({ question: params.question }),
            }),
            signal
          );
          const text = relayed.aborted
            ? "The session was aborted before this question was answered."
            : (relayed.value.answer ??
              `The question was not answered: ${relayed.value.reason ?? "rejected"}`);
          return { content: [{ type: "text" as const, text }], details: {} };
        },
      });

      const loader = new piModule.DefaultResourceLoader({
        cwd: input.cwd,
        agentDir,
        noExtensions: true,
        noSkills: true,
        noPromptTemplates: true,
        noThemes: true,
        noContextFiles: true,
        systemPrompt: input.systemPrompt,
        extensionFactories: [
          (childPi: ExtensionAPI) => {
            // The guard receives the child's abort signal so a blocked bash
            // approval settles when the session is revoked.
            childPi.on("tool_call", async (event, childCtx) => guard(event, childCtx.signal));
          },
        ],
      });
      await loader.reload();

      const sessionManager = input.resumeSessionPath
        ? piModule.SessionManager.open(input.resumeSessionPath)
        : piModule.SessionManager.create(input.cwd);
      const registry = input.modelRegistry as
        | { authStorage?: unknown }
        | null;
      const created = await piModule.createAgentSession({
        cwd: input.cwd,
        model: input.model as never,
        ...(input.thinkingLevel ? { thinkingLevel: input.thinkingLevel as never } : {}),
        resourceLoader: loader,
        sessionManager,
        // Isolated settings: no user shellCommandPrefix may silently extend an
        // approved bash command, so the intercepted command IS the effective one.
        settingsManager: piModule.SettingsManager.inMemory({}),
        // Reuse the host's model registry and auth so the explicit gate
        // model resolves against the same credentials as the parent.
        ...(registry
          ? {
              modelRegistry: registry as never,
              ...(registry.authStorage ? { authStorage: registry.authStorage as never } : {}),
            }
          : {}),
        tools: ["read", "grep", "find", "ls", "edit", "write", "bash", "ask_operator"],
        customTools: [askOperator],
      });
      const session = created.session;
      childSessionId = session.sessionId;
      childSessionPath = session.sessionFile ?? null;

      let runFailure: string | null = null;
      let running: Promise<void> | null = null;
      void running;
      const beginRun = (text: string) =>
        new Promise<void>((resolve, reject) => {
          let settled = false;
          const settle = (ok: boolean, error?: unknown) => {
            if (settled) return;
            settled = true;
            if (ok) resolve();
            else {
              reject(
                error instanceof Error
                  ? error
                  : new Error(errorText(error ?? "the child session rejected the prompt at preflight"))
              );
            }
          };
          // prompt() resolves only after the FULL run; we resolve at preflight
          // acceptance and track the run separately so callers never block on
          // the model run while holding the serialized action queue.
          running = session
            .prompt(text, { preflightResult: (success: boolean) => settle(success, undefined) })
            .then(() => settle(true))
            .catch((error: unknown) => {
              runFailure = errorText(error);
              settle(false, error);
            });
        });

      return {
        sessionId: session.sessionId,
        sessionPath: session.sessionFile ?? null,
        reportedModel: () =>
          session.model ? { provider: session.model.provider, model: session.model.id } : null,
        effectiveThinkingLevel: () => (session.thinkingLevel as string | undefined) ?? null,
        send: async (text: string) => {
          if (session.isStreaming) {
            await session.steer(text);
            return;
          }
          await beginRun(text);
        },
        isIdle: () => session.isIdle,
        runError: () => runFailure,
        abort: () => session.abort(),
        dispose: () => session.dispose(),
        stats: () => {
          try {
            const stats = session.getSessionStats();
            return {
              inputTokens: stats.tokens?.input ?? null,
              outputTokens: stats.tokens?.output ?? null,
              cost: stats.cost ?? null,
            };
          } catch {
            return null;
          }
        },
        transcriptTail: (limit: number) => {
          const messages = session.messages.slice(-limit);
          return messages.map((message) => {
            const role = (message as { role?: string }).role ?? "unknown";
            const content = (message as { content?: unknown }).content;
            let text = "";
            if (typeof content === "string") text = content;
            else if (Array.isArray(content)) {
              text = content
                .filter(
                  (part): part is { type: "text"; text: string } =>
                    typeof part === "object" &&
                    part !== null &&
                    (part as { type?: string }).type === "text"
                )
                .map((part) => part.text)
                .join("\n");
            }
            return { role, text: text.slice(0, 2_000) };
          });
        },
      };
    },
  };
}

const OPERATOR_ROLE_SNIPPET = [
  "You are the Retrieval meta-operator. The human stays in this conversation; background gates run on the configured harness/gate model and you never decide gates or select workflow transitions.",
  "Lifecycle: retrieval_meta_run start/resume/recover → retrieval_meta_gate wait/read/send → release (idle, verified, ready result) or abort → retrieval_meta_transition prepare → human confirms the exact bytes → commit.",
  "Answer a gate question yourself only from approved context: retrieval_meta_run status lists approved fact ids; cite them with source approved-context. Everything ambiguous, permission-like, scope/security/privacy-affecting, externally visible, or workflow-authority-related escalates to the human via the TUI dialogs.",
  "Challenge weak gate output with send (advisory, never an approval). Report errors and interrupted work honestly; recover interrupted launches with retrieval_meta_run recover.",
].join(" ");

export interface PiMetaOperatorRegistrationOptions {
  /** Test seam for exercising the actual registered lifecycle callback. */
  core?: PiMetaOperatorCore;
  /** Defaults to the non-returning production process terminator. */
  terminateProcess?: PiShutdownTerminator;
}

/**
 * Pi awaits session_shutdown handlers, then invalidates the extension runtime
 * and can swallow handler errors. A failed child abort or any thrown cleanup
 * error therefore cannot be left to an ordinary rejection: process death is
 * the only reliable way to stop a possibly live extension-owned child and make
 * a persisted live owner recoverable as dead by a successor.
 */
export async function handleInstalledPiShutdown(
  core: PiMetaOperatorCore,
  reason: string,
  terminateProcess: PiShutdownTerminator = terminatePiProcess
): Promise<void> {
  let outcome: PiShutdownOutcome;
  try {
    outcome = await core.shutdown(reason);
  } catch (error) {
    terminateProcess(1);
    // Pi production exits above. If a test terminator returns, preserve the
    // cleanup failure in the thrown message while still proving termination
    // was requested; allowing teardown to continue could orphan a live child
    // or leave ownership attributed to the soon-to-be-invalid process.
    throw new Error(
      `Pi shutdown terminator returned after shutdown cleanup threw (${errorText(error)}); ` +
        "continuing could orphan the child or its live ownership"
    );
  }
  if (outcome === "complete") return;

  terminateProcess(1);
  // A test terminator may intentionally return. Production's process.exit(1)
  // cannot, but continuing after a return would silently orphan the child.
  throw new Error(
    "Pi shutdown terminator returned after child revocation failed; continuing could orphan the live child"
  );
}

export default async function retrievalMetaOperatorPi(
  pi: ExtensionAPI,
  options: PiMetaOperatorRegistrationOptions = {}
): Promise<void> {
  const { Type } = await import("typebox");
  // Google-compatible string enums: Type.Union of literals does not work with
  // Google's API, per the installed Pi docs.
  const { StringEnum } = await import("@earendil-works/pi-ai");
  const core = options.core ?? new PiMetaOperatorCore(createRealBindings());
  const terminateProcess = options.terminateProcess ?? terminatePiProcess;
  const asResult = (text: string) => ({ content: [{ type: "text" as const, text }], details: {} });
  const operatorContext = (ctx: ExtensionContext): OperatorContextLike => ({
    cwd: ctx.cwd,
    mode: ctx.mode,
    hasUI: ctx.hasUI,
    ui: ctx.ui,
    model: ctx.model ? { provider: ctx.model.provider, id: ctx.model.id } : undefined,
    thinkingLevel: pi.getThinkingLevel(),
    sessionManager: ctx.sessionManager,
    isProjectTrusted: () => ctx.isProjectTrusted(),
    modelRegistry: ctx.modelRegistry,
  });

  pi.on("session_shutdown", async (event) => {
    await handleInstalledPiShutdown(
      core,
      `pi session shutdown (${event.reason})`,
      terminateProcess
    );
  });

  pi.registerTool({
    name: "retrieval_meta_run",
    label: "Retrieval meta run control",
    description:
      "Retrieval meta-operator run control: status (includes approved fact ids), start (kickoff values collected or exactly confirmed by the human in the TUI), resume (human-confirmed reason), or recover an interrupted launch. Launches background gates on the explicitly configured harness/gate model.",
    promptSnippet: OPERATOR_ROLE_SNIPPET,
    parameters: Type.Object({
      action: StringEnum(["status", "start", "resume", "recover"]),
      targetRepoPath: Type.Optional(Type.String()),
      initialIdea: Type.Optional(Type.String()),
      resumeReason: Type.Optional(Type.String()),
    }),
    execute: async (_id, params, _signal, _onUpdate, ctx) =>
      asResult(await core.runAction(operatorContext(ctx), params as never)),
  });

  pi.registerTool({
    name: "retrieval_meta_gate",
    label: "Retrieval meta gate interaction",
    description:
      "Interact with the background worker running the configured harness/gate model: wait/read/send, reply or reject correlated questions and permissions (approvals and material answers go through the parent TUI), abort, or release an idle verified worker with a ready result.",
    parameters: Type.Object({
      action: StringEnum([
        "wait",
        "read",
        "send",
        "question_reply",
        "question_reject",
        "permission_reply",
        "permission_reject",
        "abort",
        "release",
      ]),
      message: Type.Optional(Type.String()),
      requestId: Type.Optional(Type.String()),
      answer: Type.Optional(Type.String()),
      citedFactIds: Type.Optional(Type.Array(Type.String())),
      source: Type.Optional(StringEnum(["approved-context", "human"])),
      reason: Type.Optional(Type.String()),
      timeoutSeconds: Type.Optional(Type.Number()),
    }),
    execute: async (_id, params, _signal, _onUpdate, ctx) =>
      asResult(await core.gateAction(operatorContext(ctx), params as never)),
  });

  pi.registerTool({
    name: "retrieval_meta_transition",
    label: "Retrieval meta transition",
    description:
      "Prepare the exact gate-transition proposal (full review binding over the verified recorded worker) or commit it. Commit recomputes the binding inside the runtime decide callback and shows the human the full exact confirmation bytes in the parent TUI.",
    parameters: Type.Object({
      action: StringEnum(["prepare", "commit"]),
      decision: Type.Optional(StringEnum(["approve", "revise", "block", "not_applicable"])),
      reason: Type.Optional(Type.String()),
    }),
    execute: async (_id, params, _signal, _onUpdate, ctx) =>
      asResult(await core.transitionAction(operatorContext(ctx), params as never)),
  });
}
