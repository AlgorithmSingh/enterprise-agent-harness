/**
 * Project-local OpenCode server plugin exposing the three meta-operator tools
 * to the named `retrieval-operator` primary agent:
 *
 *   retrieval_meta_run        — run control (status / start / resume / recover)
 *   retrieval_meta_gate       — gate interaction (wait / read / send / replies / abort / release)
 *   retrieval_meta_transition — transition (prepare / commit)
 *
 * The action implementations below are shared by both supervised operator
 * surfaces and selected by `runtime.surface` (see OPERATOR_SURFACES): the meta
 * surface keeps the human as the decision authority, and the auto surface
 * (retrieval-autopilot-tools.ts) replaces each human checkpoint with the
 * autopilot agent's own recorded arguments plus a run-scoped decision ledger.
 *
 * The shared runtime (plugin-runtime.mjs) remains the only authority for run
 * mechanics, result validation, committed decision state, and transitions. Every handler
 * fails closed for wrong agent/session/role and treats gate content as
 * untrusted. Human authority is enforced by parent-linked exact-byte
 * transcript verification (meta-harness verifyHumanAuthorization). Host
 * revocation must succeed before supervisor metadata becomes terminal, and
 * commit verification runs inside the supervisor's atomic transition lease.
 */
import { tool, type Plugin, type PluginInput } from "@opencode-ai/plugin";
import { OpencodeClient } from "@opencode-ai/sdk/v2";

import {
  composeRoutineAnswer,
  FileMetaStateStore,
  InMemoryMetaStateStore,
  isTerminalWorkerStatus,
  MAX_REQUEST_PAYLOAD_CHARS,
  MetaHarnessError,
  MetaSupervisor,
  parseModelRolePolicy,
  requireGateModel,
  SerialQueue,
  verifyHumanAuthorization,
  verifyReportedModel,
  type ApprovedFact,
  type MetaStateStore,
  type ModelRef,
  type ModelRolePolicy,
  type ProposalScope,
  type ResolutionSource,
  type TranscriptEntry,
  type TransitionLease,
  type WorkerRecord,
} from "meta-harness";

import {
  inspectCurrentResult,
  loadActiveRun,
  loadWorkflow,
  runNextCommand,
  runStartCommand,
} from "../retrieval_agent_harness_phase_based/plugin-runtime.mjs";
import { appendAutopilotLedger } from "../retrieval_agent_harness_phase_based/autopilot-ledger.mjs";
import {
  buildTransitionBinding,
  permissionApprovalConfirmation,
  questionAnswerConfirmation,
  resumeRunConfirmation,
  startRunConfirmation,
} from "../retrieval_agent_harness_phase_based/meta-review-binding.mjs";
import {
  AUTOPILOT_AGENT,
  errorText,
  launchGateSession,
  OPERATOR_AGENT,
  quiesceGateSession,
  retireQuiescedGateSession,
  retireGateSession,
  type GateLaunchPacket,
  type GateSessionClient,
  type GateSessionMode,
  type GateSessionReference,
  type OpencodeModelRef,
} from "./retrieval-gate-session.ts";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const MODEL_CONFIG_FILE = ".opencode/retrieval-operator-models.json";
const RULE_FILES = ["AGENTS.md", "retrieval_agent_harness_phase_based/_SHARED-RETRIEVAL-ENGINEERING-RULES.md"];
const WAIT_POLL_MS = 1_000;

/**
 * Unattended bounds, derived from the runtime's own attempt counters — the auto
 * surface adds no bookkeeping of its own — and applied only to that surface.
 * Two revises are the plan for any gate, so a third agent-taken revise is the
 * human's call. Forty gate launches bound a whole run; that ceiling is checked
 * where the agent chooses to spend a launch (resume, and a commit whose route
 * opens the next gate), never on recover, which only finishes a launch the run
 * already committed to.
 */
const REVISE_ATTEMPT_CAP = 3;
const RUN_LAUNCH_CAP = 40;

export type OperatorSurfaceId = "meta" | "auto";

interface OperatorSurface {
  id: OperatorSurfaceId;
  /** The one primary agent allowed to call this surface's tools. */
  agent: string;
  sessionMode: GateSessionMode;
  stateFile: string;
  recoveryFile: string;
  runTool: string;
  gateTool: string;
  transitionTool: string;
}

/**
 * The two supervised surfaces differ only in who authorizes an action and
 * where their supervisor state lives. Everything else — runtime authority,
 * ownership, model policy, revocation ordering — is one implementation.
 */
export const OPERATOR_SURFACES: Record<OperatorSurfaceId, OperatorSurface> = {
  meta: {
    id: "meta",
    agent: OPERATOR_AGENT,
    sessionMode: "meta",
    stateFile: ".opencode/.retrieval-meta/state.json",
    recoveryFile: ".opencode/.retrieval-meta/launch-recovery.json",
    runTool: "retrieval_meta_run",
    gateTool: "retrieval_meta_gate",
    transitionTool: "retrieval_meta_transition",
  },
  auto: {
    id: "auto",
    agent: AUTOPILOT_AGENT,
    sessionMode: "auto",
    stateFile: ".opencode/.retrieval-auto/state.json",
    recoveryFile: ".opencode/.retrieval-auto/launch-recovery.json",
    runTool: "retrieval_auto_run",
    gateTool: "retrieval_auto_gate",
    transitionTool: "retrieval_auto_transition",
  },
};

/**
 * The generic package's closed resolution vocabulary predates this surface and
 * has no value for an operator-authored answer. Recording one as "human" would
 * put a false authorship in the audit trail, so operator-authored resolutions
 * take "operator-reject" — the resolution's own outcome field still separates
 * answered from rejected — and the precise source goes to the run ledger.
 */
const AUTO_RESOLUTION_SOURCE: ResolutionSource = "operator-reject";
const AUTO_LEDGER_SOURCE = "auto-operator";

interface ToolContextLike {
  sessionID: string;
  messageID: string;
  agent: string;
  directory: string;
  abort?: AbortSignal;
}

interface HostQuestion {
  id: string;
  sessionID: string;
  questions: Array<{ question: string; header: string }>;
}

interface HostPermission {
  id: string;
  sessionID: string;
  permission: string;
  patterns: string[];
  metadata: { [key: string]: unknown };
}

interface RuntimeReview {
  status: string;
  gate?: { id: string; title: string };
  attempt?: { number: number; session?: { host?: string; id?: string } };
  result?: {
    recommendation: string;
    summary: string;
    artifacts: Array<{ path: string; role: string }>;
    evidence: Array<{ path: string; supports: string }>;
    uncertainties: string[];
    blockers: string[];
  };
  error?: string;
}

/** Trusted kickoff material persisted at launch for explicit recovery. */
interface LaunchRecoveryRecord {
  version: 1;
  host: "opencode";
  run_id: string;
  gate_id: string;
  attempt: number;
  launch_id: string;
  host_session_id: string;
  agent_name: string;
  system: string;
  message: string;
  model: OpencodeModelRef;
}

function toOpencodeModel(model: ModelRef): OpencodeModelRef {
  return {
    providerID: model.provider,
    modelID: model.model,
    ...(model.variant !== undefined ? { variant: model.variant } : {}),
  };
}

/** Stable JSON bytes used to bind an adopted host request to its later reply. */
function canonicalHostPayload(value: unknown): string {
  const encoded = JSON.stringify(value, (_key, nested) => {
    if (nested === null || typeof nested !== "object" || Array.isArray(nested)) return nested;
    const object = nested as Record<string, unknown>;
    return Object.fromEntries(Object.keys(object).sort().map((key) => [key, object[key]]));
  });
  if (encoded === undefined) {
    throw new Error("the host request payload is not JSON-serializable");
  }
  return encoded;
}

async function readModelPolicy(directory: string): Promise<ModelRolePolicy> {
  const configPath = path.join(directory, MODEL_CONFIG_FILE);
  let raw: string;
  try {
    raw = await readFile(configPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new MetaHarnessError(
        "gate_model_missing",
        `${MODEL_CONFIG_FILE} does not exist; create it from retrieval-operator-models.example.json before operating`
      );
    }
    throw error;
  }
  const parsed = JSON.parse(raw) as {
    version?: unknown;
    operator?: { providerID?: string; modelID?: string; variant?: string } | null;
    gate?: { providerID?: string; modelID?: string; variant?: string } | null;
  };
  if (parsed.version !== 1) {
    throw new MetaHarnessError("model_policy_invalid", `${MODEL_CONFIG_FILE} must declare version 1`);
  }
  const map = (
    entry: { providerID?: string; modelID?: string; variant?: string } | null | undefined
  ): ModelRef | null =>
    entry
      ? {
          provider: entry.providerID ?? "",
          model: entry.modelID ?? "",
          ...(entry.variant !== undefined ? { variant: entry.variant } : {}),
        }
      : null;
  return parseModelRolePolicy(
    { operator: map(parsed.operator), gate: map(parsed.gate) },
    MODEL_CONFIG_FILE
  );
}

export interface OperatorRuntime {
  client: OpencodeClient;
  directory: string;
  supervisor: MetaSupervisor;
  policy: ModelRolePolicy;
  actions: SerialQueue;
  recoveryStore: MetaStateStore;
  surface: OperatorSurface;
}

async function mapTranscript(
  client: OpencodeClient,
  directory: string,
  sessionID: string
): Promise<TranscriptEntry[]> {
  const response = await client.session.messages({ sessionID, directory });
  if (response.error !== undefined && response.error !== null) {
    throw new Error(`OpenCode session.messages failed: ${errorText(response.error)}`);
  }
  const entries = (response.data ?? []) as Array<{
    info: { id: string; sessionID: string; role: "user" | "assistant"; parentID?: string };
    parts: unknown[];
  }>;
  return entries.map((entry) => ({
    info: {
      id: entry.info.id,
      sessionId: entry.info.sessionID,
      role: entry.info.role,
      ...(entry.info.parentID !== undefined ? { parentId: entry.info.parentID } : {}),
    },
    parts: entry.parts,
  }));
}

function assistantModels(
  entries: Array<{ info: Record<string, unknown> }>
): Array<{ provider: string; model: string; variant?: string }> {
  const models: Array<{ provider: string; model: string; variant?: string }> = [];
  for (const entry of entries) {
    const info = entry.info;
    if (
      info.role === "assistant" &&
      typeof info.providerID === "string" &&
      typeof info.modelID === "string"
    ) {
      models.push({
        provider: info.providerID,
        model: info.modelID,
        ...(typeof info.variant === "string" ? { variant: info.variant } : {}),
      });
    }
  }
  return models;
}

async function rawMessages(
  client: OpencodeClient,
  directory: string,
  sessionID: string
): Promise<Array<{ info: Record<string, unknown>; parts: unknown[] }>> {
  const response = await client.session.messages({ sessionID, directory });
  if (response.error !== undefined && response.error !== null) {
    throw new Error(`OpenCode session.messages failed: ${errorText(response.error)}`);
  }
  return (response.data ?? []) as Array<{ info: Record<string, unknown>; parts: unknown[] }>;
}

/** Fail closed unless the caller is this surface's named operator agent. */
function assertOperator(runtime: OperatorRuntime, context: ToolContextLike): void {
  if (context.agent !== runtime.surface.agent) {
    throw new Error(
      `this tool is reserved for the ${runtime.surface.agent} agent (caller: ${context.agent})`
    );
  }
}

/** The run directory the auto surface's ledger entries belong to. */
async function activeRunDir(runtime: OperatorRuntime): Promise<string> {
  const run = await loadActiveRun(runtime.directory);
  if (!run) throw new Error("the autopilot ledger requires an active run");
  return run.runDir as string;
}

/**
 * Record one auto-surface authority action. The ledger is the only account of
 * an unattended decision, so a failed append fails the action that needed it.
 * The meta surface, whose authority is the human transcript, writes nothing.
 */
async function ledgerAutoAction(
  runtime: OperatorRuntime,
  entry: Record<string, unknown>,
  runDir?: string
): Promise<void> {
  if (runtime.surface.id !== "auto") return;
  await appendAutopilotLedger(runDir ?? (await activeRunDir(runtime)), entry);
}

function attemptTotal(attempts: Record<string, number> | undefined): number {
  return Object.values(attempts ?? {}).reduce((total, count) => total + count, 0);
}

/** A bound the agent must resolve with the human; data, never a thrown error. */
async function escalate(
  runtime: OperatorRuntime,
  kind: string,
  detail: string,
  runDir?: string
): Promise<Record<string, unknown>> {
  await ledgerAutoAction(runtime, { event: "escalation", kind, detail }, runDir);
  return { outcome: "escalation_required", kind, detail };
}

/**
 * When an operator model is pinned, verify this very conversation uses it —
 * provider, model, and (when the pin names one) the variant. The executing
 * assistant message always carries its resolved model in OpenCode, so missing
 * metadata means the pin cannot be verified and fails closed.
 */
async function assertOperatorModel(runtime: OperatorRuntime, context: ToolContextLike): Promise<void> {
  const operator = runtime.policy.operator;
  if (!operator) return;
  const messages = await rawMessages(runtime.client, runtime.directory, context.sessionID);
  const current = messages.find((entry) => entry.info.id === context.messageID);
  const info = current?.info as { providerID?: string; modelID?: string; variant?: string } | undefined;
  if (!info?.providerID || !info.modelID) {
    throw new MetaHarnessError(
      "model_mismatch",
      `${MODEL_CONFIG_FILE} pins the operator role to ${operator.provider}/${operator.model}, but ` +
        "the executing operator message exposes no resolved model; refusing to operate unverified"
    );
  }
  if (info.providerID !== operator.provider || info.modelID !== operator.model) {
    throw new MetaHarnessError(
      "model_mismatch",
      `the operator session is running ${info.providerID}/${info.modelID}, but ` +
        `${MODEL_CONFIG_FILE} pins the operator role to ` +
        `${operator.provider}/${operator.model}; refusing to operate`
    );
  }
  if (operator.variant !== undefined && info.variant !== operator.variant) {
    throw new MetaHarnessError(
      "model_mismatch",
      `the operator session is running variant ${info.variant ?? "(none)"}, but ` +
        `${MODEL_CONFIG_FILE} pins the operator role to variant ${operator.variant}; refusing to operate`
    );
  }
}

async function saveRecoveryRecord(
  runtime: OperatorRuntime,
  packet: GateLaunchPacket,
  sessionID: string,
  model: OpencodeModelRef
): Promise<void> {
  const record: LaunchRecoveryRecord = {
    version: 1,
    host: "opencode",
    run_id: packet.run_id,
    gate_id: packet.gate.id,
    attempt: packet.attempt,
    launch_id: packet.launch_id,
    host_session_id: sessionID,
    agent_name: packet.agent_name,
    system: packet.system,
    message: packet.message,
    model,
  };
  await runtime.recoveryStore.save(record);
}

async function invalidateRecoveryRecord(runtime: OperatorRuntime): Promise<void> {
  await runtime.recoveryStore.save(null);
}

function supervisedLaunch(runtime: OperatorRuntime) {
  return async (
    packet: GateLaunchPacket,
    record: (session: GateSessionReference) => Promise<void>
  ): Promise<GateSessionReference> => {
    const gateModel = requireGateModel(runtime.policy, MODEL_CONFIG_FILE);
    const opencodeModel = toOpencodeModel(gateModel);
    const worker = await runtime.supervisor.beginLaunch({
      task: { runId: packet.run_id, taskId: packet.gate.id, attempt: packet.attempt },
      model: gateModel,
    });
    let createdSessionId: string | null = null;
    let runtimeRecorded = false;
    let recoveryRecorded = false;
    try {
      return await launchGateSession({
        client: runtime.client as unknown as GateSessionClient,
        directory: runtime.directory,
        packet,
        sessionMode: runtime.surface.sessionMode,
        model: opencodeModel,
        recordSession: async (session) => {
          createdSessionId = session.id;
          // Persist the exact host cleanup target before the runtime record or
          // any child/root validation can fail. A non-terminal worker can then
          // retry retirement through the ordinary abort path.
          await runtime.supervisor.recordWorkerSession({
            workerId: worker.workerId,
            hostSessionId: session.id,
          });
          await record(session);
          runtimeRecorded = true;
          await saveRecoveryRecord(runtime, packet, session.id, opencodeModel);
          recoveryRecorded = true;
        },
      });
    } catch (error) {
      // Host revocation must succeed before the worker record turns terminal.
      let cleanupError: unknown;
      const alreadyRetired = Boolean(
        (error as { gateSessionRetired?: boolean } | null)?.gateSessionRetired,
      );
      if (createdSessionId !== null && !alreadyRetired) {
        try {
          await retireGateSession(
            runtime.client as unknown as GateSessionClient,
            runtime.directory,
            createdSessionId,
          );
        } catch (candidate) {
          cleanupError = candidate;
        }
      }
      if (!cleanupError && recoveryRecorded) {
        try {
          await invalidateRecoveryRecord(runtime);
        } catch (candidate) {
          cleanupError = candidate;
        }
      }
      if (!cleanupError) {
        const current = runtime.supervisor.getWorker();
        if (current?.workerId === worker.workerId && !isTerminalWorkerStatus(current.status)) {
          try {
            await runtime.supervisor.abortWorker({ reason: `launch failed: ${errorText(error)}` });
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
      // launchGateSession marks an attempt uncertain when its first retirement
      // try fails. If our required retry above succeeded, cleanup is now
      // conclusive and the runtime must be allowed to roll that attempt back.
      const cleaned = (error instanceof Error ? error : new Error(errorText(error))) as Error & {
        preserveRecordedAttempt?: boolean;
      };
      cleaned.preserveRecordedAttempt = false;
      throw cleaned;
    }
  };
}

async function verifyGateModelIfExposed(runtime: OperatorRuntime): Promise<string> {
  const worker = runtime.supervisor.getWorker();
  if (!worker || worker.status !== "active" || !worker.hostSessionId) return "no active worker";
  const messages = await rawMessages(runtime.client, runtime.directory, worker.hostSessionId);
  const reportedModels = assistantModels(messages);
  if (reportedModels.length === 0) return "unexposed (no assistant reply yet)";
  try {
    // Recheck every exposed assistant identity on every interaction. A host
    // must not establish trust with one reply and silently route a later turn
    // to a different provider, model, or configured variant.
    for (const reported of reportedModels) {
      if (worker.model.variant !== undefined && reported.variant !== worker.model.variant) {
        throw new MetaHarnessError(
          "model_mismatch",
          `worker ${worker.workerId}: a gate reply reports variant ` +
            `${reported.variant ?? "(none)"}, but the configured gate model requires ` +
            `variant ${worker.model.variant}`
        );
      }
      verifyReportedModel(worker.model, reported, `worker ${worker.workerId}`);
    }
  } catch (mismatch) {
    // Permanently retire the host session first; session.abort alone only
    // stops processing and does not remove its edit authority.
    await retireGateSession(
      runtime.client as unknown as GateSessionClient,
      runtime.directory,
      worker.hostSessionId,
    );
    await invalidateRecoveryRecord(runtime);
    await runtime.supervisor.abortWorker({ reason: "model_mismatch" });
    throw mismatch;
  }
  if (worker.modelVerification !== "verified") {
    await runtime.supervisor.verifyWorkerModel({
      workerId: worker.workerId,
      reportedModel: reportedModels[reportedModels.length - 1],
    });
  }
  return "verified";
}

async function recordGateUsage(runtime: OperatorRuntime, reason: string): Promise<void> {
  const worker = runtime.supervisor.getWorker();
  if (!worker?.hostSessionId) return;
  try {
    const messages = await rawMessages(runtime.client, runtime.directory, worker.hostSessionId);
    let input = 0;
    let output = 0;
    let cost = 0;
    let seen = false;
    for (const entry of messages) {
      const info = entry.info as {
        role?: string;
        cost?: number;
        tokens?: { input?: number; output?: number };
      };
      if (info.role !== "assistant") continue;
      seen = true;
      input += info.tokens?.input ?? 0;
      output += info.tokens?.output ?? 0;
      cost += info.cost ?? 0;
    }
    if (seen) {
      await runtime.supervisor.recordUsage({
        role: "gate",
        workerId: worker.workerId,
        inputTokens: input,
        outputTokens: output,
        cost,
        source: `opencode session ${worker.hostSessionId} (${reason})`,
      });
    }
  } catch {
    // Usage capture is best-effort reporting; never block control flow on it.
  }
}

async function listHostQuestions(runtime: OperatorRuntime): Promise<HostQuestion[]> {
  const response = await runtime.client.question.list({ directory: runtime.directory });
  if (response.error !== undefined && response.error !== null) {
    throw new Error(`OpenCode question.list failed: ${errorText(response.error)}`);
  }
  return (response.data ?? []) as HostQuestion[];
}

async function listHostPermissions(runtime: OperatorRuntime): Promise<HostPermission[]> {
  const response = await runtime.client.permission.list({ directory: runtime.directory });
  if (response.error !== undefined && response.error !== null) {
    throw new Error(`OpenCode permission.list failed: ${errorText(response.error)}`);
  }
  return (response.data ?? []) as HostPermission[];
}

function pendingRequestView(runtime: OperatorRuntime): Record<string, unknown> | null {
  const request = runtime.supervisor.getPendingRequest();
  if (!request) return null;
  const view: Record<string, unknown> = {
    requestId: request.requestId,
    kind: request.kind,
    task: request.task,
    hostRequestId: request.hostRequestId,
    payload: request.payload,
  };
  if (request.kind === "permission") {
    view.human_approval_block = request.authorizationCanonical;
    view.note =
      "Approval requires the human to send exactly the human_approval_block text as their next message; rejection needs only a reason.";
  }
  return view;
}

/**
 * Reject an oversized host request outright: an approval must bind complete
 * bytes the human actually saw, so content above the request cap can never
 * become authorizable and the gate is told why.
 */
async function rejectOversizedHostRequest(
  runtime: OperatorRuntime,
  kind: "question" | "permission",
  requestID: string,
  size: number
): Promise<Record<string, unknown>> {
  const reason = `request payload is ${size} characters, above the ${MAX_REQUEST_PAYLOAD_CHARS}-character relay limit; ask something smaller`;
  if (kind === "question") {
    const response = await runtime.client.question.reject({ requestID, directory: runtime.directory });
    if (response.error !== undefined && response.error !== null) {
      throw new Error(`OpenCode question.reject failed: ${errorText(response.error)}`);
    }
  } else {
    const response = await runtime.client.permission.reply({
      requestID,
      directory: runtime.directory,
      reply: "reject",
      message: reason,
    });
    if (response.error !== undefined && response.error !== null) {
      throw new Error(`OpenCode permission.reply failed: ${errorText(response.error)}`);
    }
  }
  return { outcome: "rejected_oversized", kind, hostRequestId: requestID, note: reason };
}

/** Refuse a stale action if the host reused an id/session for different bytes. */
async function requireCurrentHostRequestPayload(
  runtime: OperatorRuntime,
  kind: "question" | "permission",
  hostRequestId: string,
  workerSessionId: string,
  persistedPayload: string,
): Promise<void> {
  const current = (
    kind === "question" ? await listHostQuestions(runtime) : await listHostPermissions(runtime)
  ).find((candidate) => candidate.id === hostRequestId);
  if (!current || current.sessionID !== workerSessionId) {
    throw new Error(
      `the exact recorded host ${kind} is no longer pending for the recorded worker session`
    );
  }
  if (canonicalHostPayload(current) !== persistedPayload) {
    throw new Error(
      `the pending host ${kind} payload changed after adoption; refusing the stale operator action`
    );
  }
}

async function adoptHostRequest(runtime: OperatorRuntime): Promise<Record<string, unknown> | null> {
  const worker = runtime.supervisor.getWorker();
  if (!worker || worker.status !== "active" || !worker.hostSessionId) return null;
  const existing = runtime.supervisor.getPendingRequest();
  if (existing) return pendingRequestView(runtime);
  const question = (await listHostQuestions(runtime)).find(
    (request) => request.sessionID === worker.hostSessionId
  );
  if (question) {
    const payload = canonicalHostPayload(question);
    if (payload.length > MAX_REQUEST_PAYLOAD_CHARS) {
      return rejectOversizedHostRequest(runtime, "question", question.id, payload.length);
    }
    await runtime.supervisor.openRequest({
      workerId: worker.workerId,
      kind: "question",
      hostRequestId: question.id,
      payload,
    });
    return pendingRequestView(runtime);
  }
  const permission = (await listHostPermissions(runtime)).find(
    (request) => request.sessionID === worker.hostSessionId
  );
  if (permission) {
    const payload = canonicalHostPayload(permission);
    if (payload.length > MAX_REQUEST_PAYLOAD_CHARS) {
      return rejectOversizedHostRequest(runtime, "permission", permission.id, payload.length);
    }
    await runtime.supervisor.openRequest({
      workerId: worker.workerId,
      kind: "permission",
      hostRequestId: permission.id,
      payload,
      // The canonical approval block is computed exactly once, from the
      // trusted host permission object, and persisted immutably: wait, read,
      // and reply all present these same bytes to the human.
      buildAuthorization: (request) =>
        permissionApprovalConfirmation({
          requestId: request.requestId,
          hostRequestId: permission.id,
          runId: request.task.runId,
          gateId: request.task.taskId,
          attempt: request.task.attempt,
          permission: permission.permission,
          payload,
        }),
    });
    return pendingRequestView(runtime);
  }
  return null;
}

async function runtimeReview(directory: string): Promise<RuntimeReview | null> {
  const workflow = await loadWorkflow(directory);
  const run = await loadActiveRun(directory);
  if (!run) return null;
  if (!run.state.current_attempt) return { status: "no_attempt" };
  return (await inspectCurrentResult(workflow, run)) as RuntimeReview;
}

function reviewSummary(review: RuntimeReview | null): Record<string, unknown> | null {
  if (!review) return null;
  if (review.status !== "ready") {
    return { status: review.status, ...(review.error ? { error: review.error } : {}) };
  }
  return {
    status: "ready",
    gate: review.gate,
    attempt: review.attempt?.number,
    recommendation: review.result?.recommendation,
    summary: review.result?.summary,
    artifacts: review.result?.artifacts,
    evidence: review.result?.evidence,
    uncertainties: review.result?.uncertainties,
    blockers: review.result?.blockers,
  };
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

async function seedApprovedContext(
  runtime: OperatorRuntime,
  intake: { targetRepoPath: string; initialIdea: string },
  runId: string
): Promise<void> {
  await runtime.supervisor.approveFact({
    runId,
    text: `Kickoff target repository: ${intake.targetRepoPath}`,
    provenance: { kind: "kickoff", source: "retrieval_meta_run(start) human-confirmed intake" },
  });
  await runtime.supervisor.approveFact({
    runId,
    text: `Kickoff initial idea: ${intake.initialIdea}`,
    provenance: { kind: "kickoff", source: "retrieval_meta_run(start) human-confirmed intake" },
  });
  for (const ruleFile of RULE_FILES) {
    try {
      const bytes = await readFile(path.join(runtime.directory, ruleFile));
      await runtime.supervisor.approveFact({
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
 * A cited repository-rule fact is only valid while the rule file still has
 * the exact bytes it had when it was approved.
 */
async function revalidateRuleCitations(
  runtime: OperatorRuntime,
  facts: readonly ApprovedFact[],
  citedFactIds: readonly string[]
): Promise<void> {
  for (const factId of citedFactIds) {
    const fact = facts.find((candidate) => candidate.id === factId);
    if (!fact || fact.provenance.kind !== "repository-rule") continue;
    let digest: string;
    try {
      const bytes = await readFile(path.join(runtime.directory, fact.provenance.source));
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

interface WorkflowOutcomeLike {
  kind: string;
  run?: { state: { run_id: string; active_gate_id: string | null; status?: string } };
  packet?: GateLaunchPacket;
  review?: { error?: string };
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

/** Anchorless one-shot human-authorization check inside the operator session. */
async function verifyHumanBlock(
  runtime: OperatorRuntime,
  context: ToolContextLike,
  toolId: string,
  expectedCanonical: string
): Promise<{ accepted: boolean; code: string }> {
  const transcript = await mapTranscript(runtime.client, runtime.directory, context.sessionID);
  const verdict = verifyHumanAuthorization({
    expectedAgent: runtime.surface.agent,
    actualAgent: context.agent,
    sessionId: context.sessionID,
    currentMessageId: context.messageID,
    anchor: null,
    currentToolId: toolId,
    expectedCanonical,
    messages: transcript,
  });
  return { accepted: verdict.accepted, code: verdict.code };
}

function isLaunchRecoveryRecord(value: unknown): value is LaunchRecoveryRecord {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === 1 &&
    candidate.host === "opencode" &&
    typeof candidate.run_id === "string" &&
    typeof candidate.gate_id === "string" &&
    typeof candidate.attempt === "number" &&
    typeof candidate.launch_id === "string" &&
    typeof candidate.host_session_id === "string" &&
    typeof candidate.agent_name === "string" &&
    typeof candidate.system === "string" &&
    typeof candidate.message === "string" &&
    typeof candidate.model === "object" &&
    candidate.model !== null
  );
}

export function createOperatorRuntime(input: {
  client: OpencodeClient;
  directory: string;
  supervisor: MetaSupervisor;
  policy: ModelRolePolicy;
  recoveryStore?: MetaStateStore;
  /** Defaults to the human-authorized meta surface. */
  surface?: OperatorSurfaceId;
}): OperatorRuntime {
  const { surface, ...rest } = input;
  return {
    ...rest,
    surface: OPERATOR_SURFACES[surface ?? "meta"],
    recoveryStore: input.recoveryStore ?? new InMemoryMetaStateStore(),
    actions: new SerialQueue(),
  };
}

/**
 * Reuse the plugin API's already-connected in-process transport. `opencode
 * run` advertises localhost:4096 in `serverUrl` without opening a TCP listener,
 * so constructing a second fetch client there cannot work. The v2 facade and
 * the plugin-provided legacy facade are generated over the same low-level
 * transport in the pinned SDK.
 */
export function bridgePluginV2Client(pluginClient: unknown): OpencodeClient {
  const transport = (pluginClient as { _client?: unknown } | null)?._client;
  if (!transport) {
    throw new Error("OpenCode plugin input did not expose its connected SDK transport");
  }
  return new OpencodeClient({ client: transport as never });
}

export async function loadOperatorRuntime(
  input: PluginInput,
  surfaceId: OperatorSurfaceId = "meta"
): Promise<OperatorRuntime> {
  const surface = OPERATOR_SURFACES[surfaceId];
  const directory = input.directory;
  const client = bridgePluginV2Client(input.client);
  const policy = await readModelPolicy(directory);
  // Each surface owns its own supervisor state, so one never adopts the
  // other's worker, request, or prepared proposal.
  const supervisor = await MetaSupervisor.load({
    store: new FileMetaStateStore(path.join(directory, surface.stateFile)),
  });
  return createOperatorRuntime({
    client,
    directory,
    supervisor,
    policy,
    surface: surfaceId,
    recoveryStore: new FileMetaStateStore(path.join(directory, surface.recoveryFile)),
  });
}

// ---------------------------------------------------------------------------
// Action implementations (exported for deterministic tests via a fake client)
// ---------------------------------------------------------------------------

export async function runAction(
  runtime: OperatorRuntime,
  context: ToolContextLike,
  args: {
    action: "status" | "start" | "resume" | "recover";
    targetRepoPath?: string;
    initialIdea?: string;
    resumeReason?: string;
  }
): Promise<string> {
  return runtime.actions.run(async () => {
    assertOperator(runtime, context);
    await assertOperatorModel(runtime, context);

    if (args.action === "status") {
      let review: RuntimeReview | null = null;
      let reviewError: string | null = null;
      try {
        review = await runtimeReview(runtime.directory);
      } catch (error) {
        reviewError = errorText(error);
      }
      const run = await loadActiveRun(runtime.directory).catch(() => null);
      // Approved facts are scoped to the active run so routine gate answers
      // can cite exactly these ids with source approved-context.
      const facts = run ? runtime.supervisor.listFacts({ runId: run.state.run_id }) : [];
      return json({
        run: run
          ? {
              run_id: run.state.run_id,
              status: run.state.status,
              active_gate_id: run.state.active_gate_id,
              current_attempt: run.state.current_attempt,
            }
          : null,
        review: reviewSummary(review),
        ...(reviewError ? { review_error: reviewError } : {}),
        worker: runtime.supervisor.getWorker(),
        approved_facts: facts.map((fact) => ({
          id: fact.id,
          text: fact.text,
          provenance: `${fact.provenance.kind}:${fact.provenance.source}`,
        })),
        pending_request: pendingRequestView(runtime),
        proposal: runtime.supervisor.getProposal()
          ? { scope: runtime.supervisor.getProposal()?.scope, sha256: runtime.supervisor.getProposal()?.canonicalSha256 }
          : null,
        recovered_interruptions: runtime.supervisor.recoveredInterruptions,
        gate_usage: runtime.supervisor.usageSummary(),
        gate_model: runtime.policy.gate,
        operator_model: runtime.policy.operator,
      });
    }

    if (args.action === "start") {
      requireGateModel(runtime.policy, MODEL_CONFIG_FILE);
      const targetRepoPath = args.targetRepoPath?.trim();
      const initialIdea = args.initialIdea?.trim();
      let intake: { targetRepoPath: string; initialIdea: string } | undefined;
      if (targetRepoPath && initialIdea) {
        if (runtime.surface.id === "meta") {
          // Kickoff values become approved context, so they require the human's
          // exact-byte confirmation — a model-authored argument is not a human fact.
          const canonical = startRunConfirmation({ targetRepoPath, initialIdea });
          const verdict = await verifyHumanBlock(runtime, context, runtime.surface.runTool, canonical);
          if (!verdict.accepted) {
            return json({
              outcome: "human_authorization_rejected",
              code: verdict.code,
              required_block: canonical,
              note:
                "Starting a run seeds these kickoff values as approved context. Show them to the human; the run starts only when the human's next message is exactly the required_block text.",
            });
          }
        }
        intake = { targetRepoPath, initialIdea };
      }
      const outcome = (await runStartCommand({
        repoRoot: runtime.directory,
        host: "opencode",
        sessionMode: runtime.surface.sessionMode,
        intake,
        launch: supervisedLaunch(runtime),
        resumeReason: undefined,
      })) as WorkflowOutcomeLike;
      if (outcome.kind === "launched" && intake && outcome.run) {
        await seedApprovedContext(runtime, intake, outcome.run.state.run_id);
        await ledgerAutoAction(runtime, {
          event: "run_started",
          initial_idea: intake.initialIdea,
          target_repo_path: intake.targetRepoPath,
        });
      }
      if (outcome.kind === "no_run") {
        return json({
          kind: "no_run",
          note: "Ask the human for the target repository path and the initial agent idea, then call start again with both.",
        });
      }
      return json(describeOutcome(outcome));
    }

    if (args.action === "recover") {
      return json(await recoverAction(runtime));
    }

    // resume
    const resumeReason = args.resumeReason?.trim();
    if (!resumeReason) {
      throw new Error(
        runtime.surface.id === "auto"
          ? "resume requires a resumeReason recording the human's instruction to continue"
          : "resume requires resumeReason relayed from the human"
      );
    }
    requireGateModel(runtime.policy, MODEL_CONFIG_FILE);
    const run = await loadActiveRun(runtime.directory);
    if (runtime.surface.id === "auto") {
      // A blocked run stopped for the human; resuming it is the one run-control
      // action the autopilot may not decide on its own evidence.
      if (!run || run.state.status !== "blocked") {
        throw new Error(
          "resume applies only to a blocked run; use start to continue an active run"
        );
      }
      if (attemptTotal(run.state.attempts) >= RUN_LAUNCH_CAP) {
        return json(await escalate(
          runtime,
          "launch_cap",
          `this run has already used ${attemptTotal(run.state.attempts)} gate launches, the unattended ceiling of ${RUN_LAUNCH_CAP}; resuming it needs the human's decision`,
          run.runDir as string
        ));
      }
    } else if (run && run.state.status === "blocked") {
      const canonical = resumeRunConfirmation({
        runId: run.state.run_id,
        gateId: run.state.active_gate_id ?? "unknown",
        resumeReason,
      });
      const verdict = await verifyHumanBlock(runtime, context, runtime.surface.runTool, canonical);
      if (!verdict.accepted) {
        return json({
          outcome: "human_authorization_rejected",
          code: verdict.code,
          required_block: canonical,
          note:
            "Resuming a blocked run needs the human's exact confirmation of the resume direction; show them the required_block text.",
        });
      }
    }
    const outcome = (await runStartCommand({
      repoRoot: runtime.directory,
      host: "opencode",
      sessionMode: runtime.surface.sessionMode,
      intake: undefined,
      resumeReason,
      launch: supervisedLaunch(runtime),
    })) as WorkflowOutcomeLike;
    await ledgerAutoAction(runtime, { event: "run_resumed", resume_reason: resumeReason });
    return json(describeOutcome(outcome));
  });
}

/**
 * Explicit trusted recovery for interrupted work. A pending kickoff is never
 * re-delivered into the same writable session: its permissions and recovery
 * material are retired under the runtime transition lock before a fresh
 * recorded attempt is launched. A delivered session may be re-adopted after
 * its immutable launch/model binding is verified. No human decision is
 * repeated when recovery resumes a post-commit launch.
 */
async function recoverAction(runtime: OperatorRuntime): Promise<Record<string, unknown>> {
  const worker = runtime.supervisor.getWorker();
  if (worker && !isTerminalWorkerStatus(worker.status)) {
    throw new Error(`worker ${worker.workerId} is still ${worker.status}; recovery applies only to interrupted work`);
  }
  if (runtime.supervisor.getPendingRequest()) {
    throw new Error("a correlated request is pending; resolve or abort it before recovering");
  }
  const gateModel = requireGateModel(runtime.policy, MODEL_CONFIG_FILE);
  const run = await loadActiveRun(runtime.directory);
  if (!run) return { outcome: "no_run", note: "Nothing to recover; use start." };
  // The launch cap deliberately does not apply here: recovery only finishes a
  // launch the run already decided on, and refusing it would strand a
  // committed decision that nothing else can complete.
  const surfaceMode = runtime.surface.sessionMode;

  const attempt = run.state.current_attempt as
    | {
        gate_id: string;
        number: number;
        launch_id: string;
        delivery_status?: "pending" | "delivered";
        session?: { host?: string; id?: string; mode?: GateSessionMode; path?: string };
      }
    | null
    | undefined;
  if (attempt) {
    if (
      attempt.session?.host !== "opencode" ||
      attempt.session.mode !== surfaceMode ||
      !attempt.session.id
    ) {
      throw new Error(
        `the recorded attempt does not belong to an OpenCode ${surfaceMode}-operated session`
      );
    }
    const sessionID = attempt.session.id;

    if (attempt.delivery_status === "pending") {
      const outcome = (await runStartCommand({
        repoRoot: runtime.directory,
        host: "opencode",
        sessionMode: surfaceMode,
        intake: undefined,
        resumeReason: `Recovered after permanently retiring an undelivered OpenCode ${surfaceMode} kickoff.`,
        recoverPendingLaunch: true,
        expectedPendingLaunch: attempt,
        retirePendingSession: async (session: {
          host?: string;
          id?: string;
          mode?: GateSessionMode;
        }) => {
          if (
            session.host !== "opencode" ||
            session.mode !== surfaceMode ||
            session.id !== sessionID
          ) {
            throw new Error("the pending kickoff session changed before retirement");
          }
          await retireGateSession(
            runtime.client as unknown as GateSessionClient,
            runtime.directory,
            sessionID,
          );
          await invalidateRecoveryRecord(runtime);
        },
        launch: supervisedLaunch(runtime),
      })) as WorkflowOutcomeLike;
      return {
        outcome: "recovered",
        retired_session: sessionID,
        ...describeOutcome(outcome),
      };
    }
    if (attempt.delivery_status !== "delivered") {
      throw new Error("the recorded attempt has no valid kickoff-delivery status");
    }

    const messages = await rawMessages(runtime.client, runtime.directory, sessionID);

    // The persisted launch record must agree with the CONFIGURED gate model —
    // provider, model, and variant — before the interrupted attempt may be
    // re-adopted. The record is the immutable binding for the exact model and
    // launch bytes; delivered work is never prompted a second time.
    const raw = await runtime.recoveryStore.load();
    const record =
      isLaunchRecoveryRecord(raw) &&
      raw.run_id === run.state.run_id &&
      raw.gate_id === attempt.gate_id &&
      raw.attempt === attempt.number &&
      raw.launch_id === attempt.launch_id &&
      raw.host_session_id === sessionID
        ? raw
        : null;
    if (!record) {
      await retireGateSession(
        runtime.client as unknown as GateSessionClient,
        runtime.directory,
        sessionID,
      );
      await invalidateRecoveryRecord(runtime);
      throw new Error(
        "no matching trusted launch-recovery record exists for the recorded attempt; the attempt cannot be recovered automatically"
      );
    }
    if (
      record.model.providerID !== gateModel.provider ||
      record.model.modelID !== gateModel.model ||
      record.model.variant !== gateModel.variant
    ) {
      await retireGateSession(
        runtime.client as unknown as GateSessionClient,
        runtime.directory,
        sessionID,
      );
      await invalidateRecoveryRecord(runtime);
      throw new Error(
        "the configured gate model (provider/model/variant) changed since the interrupted " +
          "launch; refusing to recover with a different model"
      );
    }

    // A session that already replied must have replied on the configured
    // model (including the configured variant) before it is re-adopted; the
    // verified reported model is recorded, so only an actually verified
    // variant ever backs the worker record.
    const reportedModels = assistantModels(messages);
    try {
      for (const reported of reportedModels) {
        if (gateModel.variant !== undefined && reported.variant !== gateModel.variant) {
          throw new MetaHarnessError(
            "model_mismatch",
            `the recorded session replied on variant ${reported.variant ?? "(none)"}, but the ` +
              `configured gate model requires variant ${gateModel.variant}; refusing to recover it`
          );
        }
        verifyReportedModel(gateModel, reported, `recovered session ${sessionID}`);
      }
    } catch (mismatch) {
      await retireGateSession(
        runtime.client as unknown as GateSessionClient,
        runtime.directory,
        sessionID,
      );
      await invalidateRecoveryRecord(runtime);
      throw mismatch;
    }
    const reported = reportedModels[reportedModels.length - 1] ?? null;

    const readopted = await runtime.supervisor.beginLaunch({
      task: { runId: run.state.run_id, taskId: attempt.gate_id, attempt: attempt.number },
      model: gateModel,
    });
    await runtime.supervisor.recordWorkerSession({
      workerId: readopted.workerId,
      hostSessionId: sessionID,
      reportedModel: reported,
    });
    return {
      outcome: "recovered",
      readopted_session: sessionID,
      kickoff_redelivered: false,
      worker: runtime.supervisor.getWorker(),
    };
  }

  // A safely rolled-back first kickoff is relaunched through start. If start
  // reports an idle post-commit boundary, next resumes only that already
  // chosen route; it does not ask for or repeat the human decision.
  let outcome = (await runStartCommand({
    repoRoot: runtime.directory,
    host: "opencode",
    sessionMode: surfaceMode,
    intake: undefined,
    resumeReason: undefined,
    launch: supervisedLaunch(runtime),
  })) as WorkflowOutcomeLike;
  if (outcome.kind !== "idle") {
    return { outcome: "recovered", ...describeOutcome(outcome) };
  }
  outcome = (await runNextCommand({
    repoRoot: runtime.directory,
    host: "opencode",
    sessionMode: surfaceMode,
    display: async () => {},
    decide: async () => null,
    afterDecision: async () => {},
    launch: supervisedLaunch(runtime),
  })) as WorkflowOutcomeLike;
  if (outcome.kind === "cancelled") {
    return {
      outcome: "decision_required",
      note: `The active gate has a ready result; recovery does not decide gates. Use ${runtime.surface.transitionTool}.`,
    };
  }
  return { outcome: "recovered", ...describeOutcome(outcome) };
}

export async function gateAction(
  runtime: OperatorRuntime,
  context: ToolContextLike,
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
    answersJson?: string;
    citedFactIds?: string[];
    source?: "approved-context" | "human";
    reason?: string;
    afterMessageId?: string;
    timeoutSeconds?: number;
    /** Auto surface: the operator's own decision on a shell request. */
    approve?: boolean;
    /** Auto surface: why the operator answered or approved as it did. */
    rationale?: string;
  }
): Promise<string> {
  return runtime.actions.run(async () => {
    assertOperator(runtime, context);
    await assertOperatorModel(runtime, context);
    const auto = runtime.surface.id === "auto";
    const worker = runtime.supervisor.getWorker();

    if (args.action === "wait") {
      if (!worker || worker.status !== "active" || !worker.hostSessionId) {
        return json({ outcome: "no_active_worker", worker });
      }
      const deadline = Date.now() + Math.min(Math.max(args.timeoutSeconds ?? 30, 1), 120) * 1000;
      for (;;) {
        if (context.abort?.aborted) {
          return json({ outcome: "aborted", note: "the operator tool call was aborted by the host" });
        }
        const verification = await verifyGateModelIfExposed(runtime);
        const request = await adoptHostRequest(runtime);
        if (request) {
          if (request.outcome === "rejected_oversized") return json(request);
          return json({
            outcome: request.kind === "permission" ? "permission" : "question",
            request,
            model_verification: verification,
          });
        }
        const status = await runtime.client.session.status({ directory: runtime.directory });
        if (status.error !== undefined && status.error !== null) {
          throw new Error(`OpenCode session.status failed: ${errorText(status.error)}`);
        }
        const sessionStatus = (status.data as Record<string, { type?: string }> | undefined)?.[
          worker.hostSessionId
        ];
        if (!sessionStatus || sessionStatus.type === "idle") {
          const review = await runtimeReview(runtime.directory);
          return json({
            outcome: "idle",
            review: reviewSummary(review),
            model_verification: verification,
          });
        }
        if (Date.now() >= deadline) return json({ outcome: "timeout", model_verification: verification });
        await new Promise((resolve) => setTimeout(resolve, WAIT_POLL_MS));
      }
    }

    if (args.action === "read") {
      if (!worker?.hostSessionId) return json({ outcome: "no_worker_session", worker });
      const verification =
        worker.status === "active" ? await verifyGateModelIfExposed(runtime) : worker.modelVerification;
      const request = worker.status === "active" ? await adoptHostRequest(runtime) : pendingRequestView(runtime);
      const messages = await rawMessages(runtime.client, runtime.directory, worker.hostSessionId);
      const startIndex = args.afterMessageId
        ? messages.findIndex((entry) => entry.info.id === args.afterMessageId) + 1
        : Math.max(messages.length - 20, 0);
      const transcript = messages.slice(startIndex).map((entry) => {
        const info = entry.info as {
          id?: string;
          role?: string;
          providerID?: string;
          modelID?: string;
        };
        const texts = entry.parts
          .filter(
            (part): part is { type: "text"; text: string } =>
              typeof part === "object" &&
              part !== null &&
              (part as { type?: string }).type === "text"
          )
          .map((part) => part.text.slice(0, 2_000));
        const tools = entry.parts
          .filter(
            (part): part is { type: "tool"; tool: string } =>
              typeof part === "object" &&
              part !== null &&
              (part as { type?: string }).type === "tool"
          )
          .map((part) => part.tool);
        return {
          id: info.id,
          role: info.role,
          ...(info.providerID ? { model: `${info.providerID}/${info.modelID}` } : {}),
          texts,
          tools,
        };
      });
      const review = await runtimeReview(runtime.directory);
      return json({
        worker,
        model_verification: verification,
        pending_request: request,
        transcript,
        review: reviewSummary(review),
      });
    }

    if (args.action === "send") {
      if (!worker || worker.status !== "active" || !worker.hostSessionId) {
        throw new Error("no active gate worker to send to");
      }
      if (runtime.supervisor.getPendingRequest()) {
        throw new Error("a correlated request is pending; reply or reject before sending follow-ups");
      }
      if (!args.message?.trim()) throw new Error("send requires a non-empty message");
      const gateModel = requireGateModel(runtime.policy, MODEL_CONFIG_FILE);
      const workflow = await loadWorkflow(runtime.directory);
      const gate = (workflow.gates as Array<{ id: string; agent_prompt: string }>).find(
        (candidate) => candidate.id === worker.task.taskId
      );
      const response = await runtime.client.session.promptAsync({
        sessionID: worker.hostSessionId,
        directory: runtime.directory,
        ...(gate ? { agent: path.basename(gate.agent_prompt, ".md") } : {}),
        model: { providerID: gateModel.provider, modelID: gateModel.model },
        ...(gateModel.variant !== undefined ? { variant: gateModel.variant } : {}),
        parts: [
          {
            type: "text",
            text: `${
              auto
                ? "Autopilot-operator note (advisory; not a gate decision)"
                : "Meta-operator note (advisory; not a human gate decision)"
            }:\n${args.message.trim()}`,
          },
        ],
      });
      if (response.error !== undefined && response.error !== null) {
        throw new Error(`OpenCode session.promptAsync failed: ${errorText(response.error)}`);
      }
      return json({ outcome: "sent" });
    }

    if (args.action === "question_reply" || args.action === "question_reject") {
      const pending = runtime.supervisor.getPendingRequest();
      if (!pending || pending.kind !== "question") throw new Error("no pending gate question");
      if (pending.requestId !== args.requestId) {
        throw new Error(`requestId does not match the pending request (${pending.requestId})`);
      }
      if (!worker?.hostSessionId) throw new Error("the worker session is unknown");
      if (!pending.hostRequestId) throw new Error("the pending question has no bound host request id");
      const hostQuestion = (await listHostQuestions(runtime)).find(
        (candidate) => candidate.id === pending.hostRequestId
      );
      if (!hostQuestion || hostQuestion.sessionID !== worker.hostSessionId) {
        throw new Error("the exact recorded host question is no longer pending for the recorded worker session");
      }

      if (args.action === "question_reject") {
        if (!args.reason?.trim()) throw new Error("question_reject requires a reason");
        await requireCurrentHostRequestPayload(
          runtime,
          "question",
          pending.hostRequestId,
          worker.hostSessionId,
          pending.payload,
        );
        const response = await runtime.client.question.reject({
          requestID: pending.hostRequestId,
          directory: runtime.directory,
        });
        if (response.error !== undefined && response.error !== null) {
          throw new Error(`OpenCode question.reject failed: ${errorText(response.error)}`);
        }
        await runtime.supervisor.resolveRequest({
          requestId: pending.requestId,
          hostRequestId: pending.hostRequestId,
          resolution: {
            outcome: "rejected",
            source: "operator-reject",
            citedFactIds: [],
            detail: args.reason.trim(),
          },
        });
        await ledgerAutoAction(runtime, {
          event: "question_answered",
          gate_id: pending.task.taskId,
          attempt: pending.task.attempt,
          request_id: pending.requestId,
          reason: args.reason.trim(),
          source: "operator-reject",
        });
        return json({ outcome: "rejected" });
      }

      if (!args.answersJson) throw new Error("question_reply requires answersJson (string[][] as JSON)");
      const answers = JSON.parse(args.answersJson) as string[][];
      if (!Array.isArray(answers) || !answers.every((a) => Array.isArray(a) && a.every((s) => typeof s === "string"))) {
        throw new Error("answersJson must be a JSON string[][]");
      }
      if (auto && args.source === "human") {
        throw new Error(
          "the auto surface answers as the operator; cite approved-context for a routine fact or escalate the question"
        );
      }
      const rationale = args.rationale?.trim() ?? "";
      if (auto && !rationale) {
        throw new Error("question_reply requires a rationale recording why this answer follows");
      }
      const source = args.source ?? (auto ? AUTO_LEDGER_SOURCE : "human");
      const resolutionSource: ResolutionSource =
        source === "approved-context" ? "approved-context" : auto ? AUTO_RESOLUTION_SOURCE : "human";
      let citedFactIds: string[] = [];
      if (source === "approved-context") {
        const facts = runtime.supervisor.listFacts({ runId: pending.task.runId });
        await revalidateRuleCitations(runtime, facts, args.citedFactIds ?? []);
        const routine = composeRoutineAnswer({
          facts,
          citedFactIds: args.citedFactIds ?? [],
          answer: answers.flat().join("\n"),
          scope: { runId: pending.task.runId },
        });
        citedFactIds = routine.citations.map((citation) => citation.factId);
      } else if (!auto) {
        const canonical = questionAnswerConfirmation({
          requestId: pending.requestId,
          hostRequestId: pending.hostRequestId,
          runId: pending.task.runId,
          gateId: pending.task.taskId,
          attempt: pending.task.attempt,
          answers,
        });
        const verdict = await verifyHumanBlock(runtime, context, runtime.surface.gateTool, canonical);
        if (!verdict.accepted) {
          return json({
            outcome: "human_authorization_rejected",
            code: verdict.code,
            required_block: canonical,
            note: "The human must send exactly the required_block text; a model-authored argument is not human approval.",
          });
        }
      }
      await requireCurrentHostRequestPayload(
        runtime,
        "question",
        pending.hostRequestId,
        worker.hostSessionId,
        pending.payload,
      );
      const response = await runtime.client.question.reply({
        requestID: pending.hostRequestId,
        directory: runtime.directory,
        answers,
      });
      if (response.error !== undefined && response.error !== null) {
        throw new Error(`OpenCode question.reply failed: ${errorText(response.error)}`);
      }
      await runtime.supervisor.resolveRequest({
        requestId: pending.requestId,
        hostRequestId: pending.hostRequestId,
        resolution: {
          outcome: "answered",
          source: resolutionSource,
          citedFactIds,
          detail: JSON.stringify(answers),
        },
      });
      await ledgerAutoAction(runtime, {
        event: "question_answered",
        gate_id: pending.task.taskId,
        attempt: pending.task.attempt,
        request_id: pending.requestId,
        answer: JSON.stringify(answers),
        source,
        rationale,
        cited_fact_ids: citedFactIds,
      });
      return json({ outcome: "answered", source, citedFactIds });
    }

    if (args.action === "permission_reply" || args.action === "permission_reject") {
      const pending = runtime.supervisor.getPendingRequest();
      if (!pending || pending.kind !== "permission") throw new Error("no pending gate permission");
      if (pending.requestId !== args.requestId) {
        throw new Error(`requestId does not match the pending request (${pending.requestId})`);
      }
      if (!worker?.hostSessionId) throw new Error("the worker session is unknown");
      if (!pending.hostRequestId) throw new Error("the pending permission has no bound host request id");
      const hostPermission = (await listHostPermissions(runtime)).find(
        (candidate) => candidate.id === pending.hostRequestId
      );
      if (!hostPermission || hostPermission.sessionID !== worker.hostSessionId) {
        throw new Error("the exact recorded host permission is no longer pending for the recorded worker session");
      }

      // In the auto surface the operator itself decides, so a denial travels as
      // its rationale: the worker is told why and how it may proceed instead.
      let denialReason: string | null = null;
      let rationale = "";
      if (auto) {
        if (args.action === "permission_reject") {
          throw new Error("the auto surface denies a shell request through permission_reply with approve:false");
        }
        if (typeof args.approve !== "boolean") {
          throw new Error("permission_reply requires approve (true or false) in the auto surface");
        }
        rationale = args.rationale?.trim() ?? "";
        if (!rationale) {
          throw new Error(
            "permission_reply requires a rationale recording the exact command bytes you inspected and why the decision is safe"
          );
        }
        if (!args.approve) denialReason = rationale;
      } else if (args.action === "permission_reject") {
        if (!args.reason?.trim()) throw new Error("permission_reject requires a reason");
        denialReason = args.reason.trim();
      }

      if (denialReason !== null) {
        await requireCurrentHostRequestPayload(
          runtime,
          "permission",
          pending.hostRequestId,
          worker.hostSessionId,
          pending.payload,
        );
        const response = await runtime.client.permission.reply({
          requestID: pending.hostRequestId,
          directory: runtime.directory,
          reply: "reject",
          message: denialReason,
        });
        if (response.error !== undefined && response.error !== null) {
          throw new Error(`OpenCode permission.reply failed: ${errorText(response.error)}`);
        }
        await runtime.supervisor.resolveRequest({
          requestId: pending.requestId,
          hostRequestId: pending.hostRequestId,
          resolution: {
            outcome: "rejected",
            source: "operator-reject",
            citedFactIds: [],
            detail: denialReason,
          },
        });
        await ledgerAutoAction(runtime, {
          event: "shell_approval",
          gate_id: pending.task.taskId,
          attempt: pending.task.attempt,
          request_id: pending.requestId,
          approved: false,
          rationale: denialReason,
          payload_sha256: createHash("sha256").update(pending.payload).digest("hex"),
        });
        return json({ outcome: "rejected" });
      }

      // Approval binds the exact immutable canonical persisted at adoption.
      const canonical = pending.authorizationCanonical;
      if (!canonical) {
        throw new Error("the pending permission has no persisted authorization block; reject it and let the gate re-ask");
      }
      if (!auto) {
        const verdict = await verifyHumanBlock(runtime, context, runtime.surface.gateTool, canonical);
        if (!verdict.accepted) {
          return json({
            outcome: "human_authorization_rejected",
            code: verdict.code,
            required_block: canonical,
            note: "Approval is granted once, only when the human sends exactly the required_block text.",
          });
        }
      }
      await requireCurrentHostRequestPayload(
        runtime,
        "permission",
        pending.hostRequestId,
        worker.hostSessionId,
        pending.payload,
      );
      const response = await runtime.client.permission.reply({
        requestID: pending.hostRequestId,
        directory: runtime.directory,
        reply: "once",
      });
      if (response.error !== undefined && response.error !== null) {
        throw new Error(`OpenCode permission.reply failed: ${errorText(response.error)}`);
      }
      await runtime.supervisor.resolveRequest({
        requestId: pending.requestId,
        hostRequestId: pending.hostRequestId,
        resolution: {
          outcome: "answered",
          source: auto ? AUTO_RESOLUTION_SOURCE : "human",
          citedFactIds: [],
          detail: "approved once",
        },
      });
      await ledgerAutoAction(runtime, {
        event: "shell_approval",
        gate_id: pending.task.taskId,
        attempt: pending.task.attempt,
        request_id: pending.requestId,
        approved: true,
        rationale,
        payload_sha256: createHash("sha256").update(pending.payload).digest("hex"),
      });
      return json({ outcome: "approved_once" });
    }

    if (args.action === "abort") {
      if (!args.reason?.trim()) throw new Error("abort requires a reason");
      await recordGateUsage(runtime, "abort");
      // Permanent host retirement must succeed before the worker record turns
      // terminal; session.abort by itself leaves the old permission set intact.
      if (worker?.hostSessionId && !isTerminalWorkerStatus(worker.status)) {
        await retireGateSession(
          runtime.client as unknown as GateSessionClient,
          runtime.directory,
          worker.hostSessionId,
        );
        await invalidateRecoveryRecord(runtime);
      }
      const result = await runtime.supervisor.abortWorker({ reason: args.reason.trim() });
      await ledgerAutoAction(runtime, {
        event: "worker_aborted",
        gate_id: result.worker?.task.taskId ?? null,
        attempt: result.worker?.task.attempt ?? null,
        reason: args.reason.trim(),
      });
      return json({
        outcome: "aborted",
        worker: result.worker,
        interrupted_request: result.interruptedRequest,
      });
    }

    // release: only a host-confirmed idle worker with a verified model, no
    // pending requests anywhere, and a ready runtime result may be released.
    if (!worker) throw new Error("no worker to release");
    if (worker.status !== "active" || !worker.hostSessionId) {
      throw new Error(`worker ${worker.workerId} is ${worker.status}; only an active worker can be released — use abort instead`);
    }
    const verification = await verifyGateModelIfExposed(runtime);
    if (verification !== "verified") {
      throw new Error(`release requires a verified gate model (currently: ${verification}); wait for the gate's reply or abort`);
    }
    if (runtime.supervisor.getPendingRequest()) {
      throw new Error("a correlated request is pending; resolve or abort before releasing");
    }
    const openQuestion = (await listHostQuestions(runtime)).find(
      (request) => request.sessionID === worker.hostSessionId
    );
    const openPermission = (await listHostPermissions(runtime)).find(
      (request) => request.sessionID === worker.hostSessionId
    );
    if (openQuestion || openPermission) {
      throw new Error("the worker session still has a pending host question/permission; handle it before releasing");
    }
    const status = await runtime.client.session.status({ directory: runtime.directory });
    if (status.error !== undefined && status.error !== null) {
      throw new Error(`OpenCode session.status failed: ${errorText(status.error)}`);
    }
    const sessionStatus = (status.data as Record<string, { type?: string }> | undefined)?.[
      worker.hostSessionId
    ];
    if (sessionStatus && sessionStatus.type !== "idle") {
      throw new Error(`the worker session is still ${sessionStatus.type}; wait for idle or abort`);
    }
    const review = await runtimeReview(runtime.directory);
    if (review?.status !== "ready") {
      throw new Error(
        `release requires a ready gate result (currently: ${review?.status ?? "no run"}); keep waiting or abort`
      );
    }
    if (review.attempt?.session?.id !== worker.hostSessionId) {
      throw new Error("the runtime-recorded attempt session does not match the supervisor worker; refusing to release");
    }
    await recordGateUsage(runtime, "release");
    await retireGateSession(
      runtime.client as unknown as GateSessionClient,
      runtime.directory,
      worker.hostSessionId,
    );
    await invalidateRecoveryRecord(runtime);
    const releaseReason = args.reason?.trim() || "gate work complete";
    const released = await runtime.supervisor.releaseWorker({
      workerId: worker.workerId,
      reason: releaseReason,
      hostConfirmedIdle: true,
    });
    await ledgerAutoAction(runtime, {
      event: "worker_released",
      gate_id: released.task.taskId,
      attempt: released.task.attempt,
      reason: releaseReason,
    });
    return json({ outcome: "released", worker: released });
  });
}

/** The transition may only ratify the recorded, terminal, verified worker. */
function requireTerminalWorker(runtime: OperatorRuntime): WorkerRecord {
  const worker = runtime.supervisor.getWorker();
  if (!worker) throw new Error("no recorded gate worker exists for this attempt");
  if (!isTerminalWorkerStatus(worker.status)) {
    throw new Error(`worker ${worker.workerId} is still ${worker.status}; release or abort it before a transition`);
  }
  return worker;
}

export async function transitionAction(
  runtime: OperatorRuntime,
  context: ToolContextLike,
  args: {
    action: "prepare" | "commit";
    decision?: "approve" | "revise" | "block" | "not_applicable";
    reason?: string;
    /** Auto surface: the recorded reasoning behind the committed decision. */
    rationale?: string;
  }
): Promise<string> {
  return runtime.actions.run(async () => {
    assertOperator(runtime, context);
    await assertOperatorModel(runtime, context);
    const auto = runtime.surface.id === "auto";

    if (args.action === "prepare") {
      if (!args.decision) throw new Error("prepare requires a decision");
      runtime.supervisor.assertCommitAllowed();
      const gateWorker = requireTerminalWorker(runtime);
      const prepared = await buildTransitionBinding({
        repoRoot: runtime.directory,
        host: "opencode",
        operatorSessionId: context.sessionID,
        operatorModel: runtime.policy.operator,
        gateWorker,
        decision: args.decision,
        reason: args.reason ?? null,
      });
      const scope: ProposalScope = {
        operatorSessionId: context.sessionID,
        runId: prepared.binding.run.run_id,
        taskId: prepared.binding.run.gate_id,
        attempt: prepared.binding.run.attempt,
      };
      await runtime.supervisor.prepareProposal({
        scope,
        canonical: prepared.confirmation,
        summary: `${args.decision} ${prepared.binding.run.gate_id} attempt ${prepared.binding.run.attempt}`,
        preparedByMessageId: context.messageID,
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
        confirmation_block: prepared.confirmation,
        note: auto
          ? "Inspect the display fields, then commit with the rationale that records how you reached this decision. The commit is refused if any reviewed byte changed since prepare."
          : "Show the display fields to the human. The commit succeeds only if the human's next message is exactly the confirmation_block text.",
      });
    }

    // commit
    const proposal = runtime.supervisor.getProposal();
    if (!proposal) throw new Error("no prepared transition proposal exists");
    if (!auto && !proposal.preparedByMessageId) {
      throw new Error("the prepared proposal has no anchor message");
    }
    const parsed = JSON.parse(proposal.canonical.slice(proposal.canonical.indexOf("\n") + 1)) as {
      decision: { value: "approve" | "revise" | "block" | "not_applicable"; reason: string | null };
      run: { run_id: string; gate_id: string; attempt: number };
      agent_recommendation: string;
      review_manifest_sha256: string;
      next: { status: string; gate_id: string | null };
    };
    const rationale = args.rationale?.trim() ?? "";
    // Empty in the meta surface, which writes no ledger; the autopilot ledger
    // refuses an empty run directory, so a missed assignment fails loudly.
    let runDir = "";
    if (auto) {
      if (!rationale) {
        throw new Error("commit requires a rationale recording how this decision was reached");
      }
      const run = await loadActiveRun(runtime.directory);
      if (!run) throw new Error("no active run exists");
      runDir = run.runDir as string;
      const gateAttempts = (run.state.attempts as Record<string, number> | undefined)?.[
        parsed.run.gate_id
      ] ?? 0;
      if (parsed.decision.value === "revise" && gateAttempts >= REVISE_ATTEMPT_CAP) {
        return json(await escalate(
          runtime,
          "revise_cap",
          `${parsed.run.gate_id} has already used ${gateAttempts} attempts; a further unattended revise is refused — block with a reason or bring it to the human`,
          runDir
        ));
      }
      // Only a route that launches another gate spends the run's launch budget.
      if (parsed.next.status === "active" && parsed.next.gate_id) {
        const used = attemptTotal(run.state.attempts);
        if (used >= RUN_LAUNCH_CAP) {
          return json(await escalate(
            runtime,
            "launch_cap",
            `this run has already used ${used} gate launches, the unattended ceiling of ${RUN_LAUNCH_CAP}; committing this decision would launch ${parsed.next.gate_id}`,
            runDir
          ));
        }
      }
    }
    let rejection: string | null = null;
    let decisionCommitted = false;
    let decisionLedgered = false;
    // A blocked run stops autonomous progress: the same marker reaches the
    // ledger and the tool's own answer so the doctrine cannot miss it.
    const blockDetail = `${parsed.run.gate_id} was blocked: ${parsed.decision.reason ?? ""}`;
    /** A decision that reached state is ledgered even if its next launch fails. */
    const recordCommittedDecision = async () => {
      if (!auto || !decisionCommitted || decisionLedgered) return;
      decisionLedgered = true;
      await appendAutopilotLedger(runDir, {
        event: "gate_decision",
        gate_id: parsed.run.gate_id,
        attempt: parsed.run.attempt,
        decision: parsed.decision.value,
        reason: parsed.decision.reason,
        rationale,
        agent_recommendation: parsed.agent_recommendation,
        review_manifest_sha256: parsed.review_manifest_sha256,
      });
      if (parsed.decision.value === "block") {
        await appendAutopilotLedger(runDir, {
          event: "escalation",
          kind: "run_blocked",
          detail: blockDetail,
        });
      }
    };
    let activeLease: TransitionLease | null = null;
    const cancelLease = async () => {
      if (!activeLease) return;
      const lease = activeLease;
      activeLease = null;
      await runtime.supervisor.endTransition({ leaseId: lease.leaseId, outcome: "cancelled" });
    };

    let outcome: WorkflowOutcomeLike;
    try {
      outcome = (await runNextCommand({
        repoRoot: runtime.directory,
        host: "opencode",
        sessionMode: runtime.surface.sessionMode,
        display: async () => {},
        decide: async () => {
          try {
            const gateWorker = requireTerminalWorker(runtime);
            const recomputed = await buildTransitionBinding({
              repoRoot: runtime.directory,
              host: "opencode",
              operatorSessionId: context.sessionID,
              operatorModel: runtime.policy.operator,
              gateWorker,
              decision: parsed.decision.value,
              reason: parsed.decision.reason,
            });
            const scope: ProposalScope = {
              operatorSessionId: context.sessionID,
              runId: recomputed.binding.run.run_id,
              taskId: recomputed.binding.run.gate_id,
              attempt: recomputed.binding.run.attempt,
            };
            // Atomic: verifies commit gating + proposal and blocks every
            // other supervisor mutation until the lease ends.
            activeLease = await runtime.supervisor.beginTransition({
              scope,
              recomputedCanonical: recomputed.confirmation,
            });
            // The lease above already required the recomputed binding to match
            // the prepared proposal byte for byte; the meta surface adds the
            // human's anchored confirmation on top of that staleness check.
            if (!auto) {
              const transcript = await mapTranscript(runtime.client, runtime.directory, context.sessionID);
              const verdict = verifyHumanAuthorization({
                expectedAgent: runtime.surface.agent,
                actualAgent: context.agent,
                sessionId: context.sessionID,
                currentMessageId: context.messageID,
                anchor: {
                  messageId: proposal.preparedByMessageId ?? "",
                  toolId: runtime.surface.transitionTool,
                },
                currentToolId: runtime.surface.transitionTool,
                expectedCanonical: proposal.canonical,
                messages: transcript,
              });
              if (!verdict.accepted) {
                rejection = `human confirmation rejected: ${verdict.code}`;
                await cancelLease();
                return null;
              }
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
        beforeDecisionCommit: async (_run: unknown, review: { attempt: { session?: { id?: string } } }) => {
          const sessionID = review.attempt.session?.id;
          if (!sessionID) throw new Error("the reviewed OpenCode worker session is missing");
          await quiesceGateSession(
            runtime.client as unknown as GateSessionClient,
            runtime.directory,
            sessionID,
          );
        },
        afterReviewSnapshot: async (_run: unknown, review: { attempt: { session?: { id?: string } } }) => {
          const sessionID = review.attempt.session?.id;
          if (!sessionID) throw new Error("the reviewed OpenCode worker session is missing after quiescence");
          await retireQuiescedGateSession(
            runtime.client as unknown as GateSessionClient,
            runtime.directory,
            sessionID,
          );
        },
        afterDecision: async () => {
          decisionCommitted = true;
          if (activeLease) {
            const lease = activeLease;
            activeLease = null;
            await runtime.supervisor.endTransition({ leaseId: lease.leaseId, outcome: "committed" });
          }
        },
        launch: supervisedLaunch(runtime),
      })) as WorkflowOutcomeLike;
    } catch (error) {
      // Catalog/result revalidation and host quiescence all happen before the
      // runtime commits the decision. Treat any such failure as a cancelled
      // proposal, while preserving a failure after an actual commit so
      // recovery can resume the already-selected route honestly.
      if (decisionCommitted) {
        try {
          await recordCommittedDecision();
        } catch (ledgerError) {
          throw new Error(
            `${errorText(error)} (the decision committed, but its autopilot ledger entry could not be written: ${errorText(ledgerError)})`,
            { cause: error }
          );
        }
        throw error;
      }
      rejection ??= errorText(error);
      outcome = { kind: "cancelled" };
    } finally {
      await cancelLease();
    }

    if (outcome.kind === "cancelled") {
      return json({
        outcome: "cancelled",
        rejection,
        note: "No decision was committed and no transition occurred.",
      });
    }
    try {
      await recordCommittedDecision();
    } catch (error) {
      // The transition is already durable; say so rather than let the failed
      // audit read as a failed decision.
      throw new Error(
        `the ${parsed.decision.value} decision for ${parsed.run.gate_id} committed, but its autopilot ledger entry could not be written: ${errorText(error)}`,
        { cause: error }
      );
    }
    return json({
      ...describeOutcome(outcome),
      decision_committed: decisionCommitted,
      ...(auto && decisionCommitted && parsed.decision.value === "block"
        ? { escalation: { kind: "run_blocked", detail: blockDetail } }
        : {}),
    });
  });
}

// ---------------------------------------------------------------------------
// Plugin wiring
// ---------------------------------------------------------------------------

const server: Plugin = async (input) => {
  let runtimePromise: Promise<OperatorRuntime> | null = null;
  const runtimeFor = (): Promise<OperatorRuntime> => {
    runtimePromise ??= loadOperatorRuntime(input, "meta");
    return runtimePromise;
  };

  return {
    tool: {
      [OPERATOR_SURFACES.meta.runTool]: tool({
        description:
          "Retrieval meta-operator run control: status of the run/worker/usage, start a run (kickoff values need the human's exact confirmation block), resume a blocked run (human-confirmed reason), or recover an interrupted launch. Reserved for the retrieval-operator agent.",
        args: {
          action: tool.schema.enum(["status", "start", "resume", "recover"]),
          targetRepoPath: tool.schema.string().optional(),
          initialIdea: tool.schema.string().optional(),
          resumeReason: tool.schema.string().optional(),
        },
        async execute(args, context) {
          return runAction(await runtimeFor(), context, args);
        },
      }),
      [OPERATOR_SURFACES.meta.gateTool]: tool({
        description:
          "Retrieval meta-operator gate interaction: wait/read the configured background harness/gate model, send labeled advisory follow-ups, reply/reject correlated questions and permissions (approvals need the human's exact confirmation text), abort, or release an idle finished worker. Reserved for the retrieval-operator agent.",
        args: {
          action: tool.schema.enum([
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
          message: tool.schema.string().optional(),
          requestId: tool.schema.string().optional(),
          answersJson: tool.schema.string().optional(),
          citedFactIds: tool.schema.array(tool.schema.string()).optional(),
          source: tool.schema.enum(["approved-context", "human"]).optional(),
          reason: tool.schema.string().optional(),
          afterMessageId: tool.schema.string().optional(),
          timeoutSeconds: tool.schema.number().optional(),
        },
        async execute(args, context) {
          return gateAction(await runtimeFor(), context, args);
        },
      }),
      [OPERATOR_SURFACES.meta.transitionTool]: tool({
        description:
          "Retrieval meta-operator transition: prepare the exact decision proposal (full review binding over the verified recorded worker) or commit it after the human sends the exact confirmation block. Commit atomically records the human-selected transition state and launches the next gate through the runtime. Reserved for the retrieval-operator agent.",
        args: {
          action: tool.schema.enum(["prepare", "commit"]),
          decision: tool.schema.enum(["approve", "revise", "block", "not_applicable"]).optional(),
          reason: tool.schema.string().optional(),
        },
        async execute(args, context) {
          return transitionAction(await runtimeFor(), context, args);
        },
      }),
    },
  };
};

export default { id: "retrieval-meta-operator", server };
