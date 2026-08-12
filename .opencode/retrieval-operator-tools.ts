/**
 * Project-local OpenCode server plugin exposing the three meta-operator tools
 * to the named `retrieval-operator` primary agent:
 *
 *   retrieval_meta_run        — run control (status / start / resume / recover)
 *   retrieval_meta_gate       — gate interaction (wait / read / send / replies / abort / release)
 *   retrieval_meta_transition — transition (prepare / commit)
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
import {
  buildTransitionBinding,
  permissionApprovalConfirmation,
  questionAnswerConfirmation,
  resumeRunConfirmation,
  startRunConfirmation,
} from "../retrieval_agent_harness_phase_based/meta-review-binding.mjs";
import {
  errorText,
  launchGateSession,
  OPERATOR_AGENT,
  quiesceGateSession,
  retireQuiescedGateSession,
  retireGateSession,
  type GateLaunchPacket,
  type GateSessionClient,
  type GateSessionReference,
  type OpencodeModelRef,
} from "./retrieval-gate-session.ts";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const MODEL_CONFIG_FILE = ".opencode/retrieval-operator-models.json";
const STATE_FILE = ".opencode/.retrieval-meta/state.json";
const RECOVERY_FILE = ".opencode/.retrieval-meta/launch-recovery.json";
const RULE_FILES = ["AGENTS.md", "retrieval_agent_harness_phase_based/_SHARED-RETRIEVAL-ENGINEERING-RULES.md"];
const RUN_TOOL = "retrieval_meta_run";
const GATE_TOOL = "retrieval_meta_gate";
const TRANSITION_TOOL = "retrieval_meta_transition";
const WAIT_POLL_MS = 1_000;

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

interface OperatorRuntime {
  client: OpencodeClient;
  directory: string;
  supervisor: MetaSupervisor;
  policy: ModelRolePolicy;
  actions: SerialQueue;
  recoveryStore: MetaStateStore;
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

/** Fail closed unless the caller is the named operator agent. */
function assertOperator(context: ToolContextLike): void {
  if (context.agent !== OPERATOR_AGENT) {
    throw new Error(`this tool is reserved for the ${OPERATOR_AGENT} agent (caller: ${context.agent})`);
  }
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

function metaLaunch(runtime: OperatorRuntime) {
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
        sessionMode: "meta",
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
    expectedAgent: OPERATOR_AGENT,
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
}): OperatorRuntime {
  return {
    ...input,
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

async function loadOperatorRuntime(input: PluginInput): Promise<OperatorRuntime> {
  const directory = input.directory;
  const client = bridgePluginV2Client(input.client);
  const policy = await readModelPolicy(directory);
  const supervisor = await MetaSupervisor.load({
    store: new FileMetaStateStore(path.join(directory, STATE_FILE)),
  });
  return createOperatorRuntime({
    client,
    directory,
    supervisor,
    policy,
    recoveryStore: new FileMetaStateStore(path.join(directory, RECOVERY_FILE)),
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
    assertOperator(context);
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
        // Kickoff values become approved context, so they require the human's
        // exact-byte confirmation — a model-authored argument is not a human fact.
        const canonical = startRunConfirmation({ targetRepoPath, initialIdea });
        const verdict = await verifyHumanBlock(runtime, context, RUN_TOOL, canonical);
        if (!verdict.accepted) {
          return json({
            outcome: "human_authorization_rejected",
            code: verdict.code,
            required_block: canonical,
            note:
              "Starting a run seeds these kickoff values as approved context. Show them to the human; the run starts only when the human's next message is exactly the required_block text.",
          });
        }
        intake = { targetRepoPath, initialIdea };
      }
      const outcome = (await runStartCommand({
        repoRoot: runtime.directory,
        host: "opencode",
        sessionMode: "meta",
        intake,
        launch: metaLaunch(runtime),
        resumeReason: undefined,
      })) as WorkflowOutcomeLike;
      if (outcome.kind === "launched" && intake && outcome.run) {
        await seedApprovedContext(runtime, intake, outcome.run.state.run_id);
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
      throw new Error("resume requires resumeReason relayed from the human");
    }
    requireGateModel(runtime.policy, MODEL_CONFIG_FILE);
    const run = await loadActiveRun(runtime.directory);
    if (run && run.state.status === "blocked") {
      const canonical = resumeRunConfirmation({
        runId: run.state.run_id,
        gateId: run.state.active_gate_id ?? "unknown",
        resumeReason,
      });
      const verdict = await verifyHumanBlock(runtime, context, RUN_TOOL, canonical);
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
      sessionMode: "meta",
      intake: undefined,
      resumeReason,
      launch: metaLaunch(runtime),
    })) as WorkflowOutcomeLike;
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

  const attempt = run.state.current_attempt as
    | {
        gate_id: string;
        number: number;
        launch_id: string;
        delivery_status?: "pending" | "delivered";
        session?: { host?: string; id?: string; mode?: "manual" | "meta"; path?: string };
      }
    | null
    | undefined;
  if (attempt) {
    if (
      attempt.session?.host !== "opencode" ||
      attempt.session.mode !== "meta" ||
      !attempt.session.id
    ) {
      throw new Error("the recorded attempt does not belong to an OpenCode meta-operated session");
    }
    const sessionID = attempt.session.id;

    if (attempt.delivery_status === "pending") {
      const outcome = (await runStartCommand({
        repoRoot: runtime.directory,
        host: "opencode",
        sessionMode: "meta",
        intake: undefined,
        resumeReason: "Recovered after permanently retiring an undelivered OpenCode meta kickoff.",
        recoverPendingLaunch: true,
        expectedPendingLaunch: attempt,
        retirePendingSession: async (session: {
          host?: string;
          id?: string;
          mode?: "manual" | "meta";
        }) => {
          if (
            session.host !== "opencode" ||
            session.mode !== "meta" ||
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
        launch: metaLaunch(runtime),
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
    sessionMode: "meta",
    intake: undefined,
    resumeReason: undefined,
    launch: metaLaunch(runtime),
  })) as WorkflowOutcomeLike;
  if (outcome.kind !== "idle") {
    return { outcome: "recovered", ...describeOutcome(outcome) };
  }
  outcome = (await runNextCommand({
    repoRoot: runtime.directory,
    host: "opencode",
    sessionMode: "meta",
    display: async () => {},
    decide: async () => null,
    afterDecision: async () => {},
    launch: metaLaunch(runtime),
  })) as WorkflowOutcomeLike;
  if (outcome.kind === "cancelled") {
    return {
      outcome: "decision_required",
      note: "The active gate has a ready result; recovery does not decide gates. Use retrieval_meta_transition.",
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
  }
): Promise<string> {
  return runtime.actions.run(async () => {
    assertOperator(context);
    await assertOperatorModel(runtime, context);
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
            text: `Meta-operator note (advisory; not a human gate decision):\n${args.message.trim()}`,
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
        return json({ outcome: "rejected" });
      }

      if (!args.answersJson) throw new Error("question_reply requires answersJson (string[][] as JSON)");
      const answers = JSON.parse(args.answersJson) as string[][];
      if (!Array.isArray(answers) || !answers.every((a) => Array.isArray(a) && a.every((s) => typeof s === "string"))) {
        throw new Error("answersJson must be a JSON string[][]");
      }
      const source = args.source ?? "human";
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
      } else {
        const canonical = questionAnswerConfirmation({
          requestId: pending.requestId,
          hostRequestId: pending.hostRequestId,
          runId: pending.task.runId,
          gateId: pending.task.taskId,
          attempt: pending.task.attempt,
          answers,
        });
        const verdict = await verifyHumanBlock(runtime, context, GATE_TOOL, canonical);
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
          source,
          citedFactIds,
          detail: JSON.stringify(answers),
        },
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

      if (args.action === "permission_reject") {
        if (!args.reason?.trim()) throw new Error("permission_reject requires a reason");
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
          message: args.reason.trim(),
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
            detail: args.reason.trim(),
          },
        });
        return json({ outcome: "rejected" });
      }

      // Approval binds the exact immutable canonical persisted at adoption.
      const canonical = pending.authorizationCanonical;
      if (!canonical) {
        throw new Error("the pending permission has no persisted authorization block; reject it and let the gate re-ask");
      }
      const verdict = await verifyHumanBlock(runtime, context, GATE_TOOL, canonical);
      if (!verdict.accepted) {
        return json({
          outcome: "human_authorization_rejected",
          code: verdict.code,
          required_block: canonical,
          note: "Approval is granted once, only when the human sends exactly the required_block text.",
        });
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
        resolution: { outcome: "answered", source: "human", citedFactIds: [], detail: "approved once" },
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
    const released = await runtime.supervisor.releaseWorker({
      workerId: worker.workerId,
      reason: args.reason?.trim() || "gate work complete",
      hostConfirmedIdle: true,
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
  }
): Promise<string> {
  return runtime.actions.run(async () => {
    assertOperator(context);
    await assertOperatorModel(runtime, context);

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
        note: "Show the display fields to the human. The commit succeeds only if the human's next message is exactly the confirmation_block text.",
      });
    }

    // commit
    const proposal = runtime.supervisor.getProposal();
    if (!proposal) throw new Error("no prepared transition proposal exists");
    if (!proposal.preparedByMessageId) throw new Error("the prepared proposal has no anchor message");
    const parsed = JSON.parse(proposal.canonical.slice(proposal.canonical.indexOf("\n") + 1)) as {
      decision: { value: "approve" | "revise" | "block" | "not_applicable"; reason: string | null };
    };
    let rejection: string | null = null;
    let decisionCommitted = false;
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
        sessionMode: "meta",
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
            const transcript = await mapTranscript(runtime.client, runtime.directory, context.sessionID);
            const verdict = verifyHumanAuthorization({
              expectedAgent: OPERATOR_AGENT,
              actualAgent: context.agent,
              sessionId: context.sessionID,
              currentMessageId: context.messageID,
              anchor: { messageId: proposal.preparedByMessageId ?? "", toolId: TRANSITION_TOOL },
              currentToolId: TRANSITION_TOOL,
              expectedCanonical: proposal.canonical,
              messages: transcript,
            });
            if (!verdict.accepted) {
              rejection = `human confirmation rejected: ${verdict.code}`;
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
        launch: metaLaunch(runtime),
      })) as WorkflowOutcomeLike;
    } catch (error) {
      // Catalog/result revalidation and host quiescence all happen before the
      // runtime commits the decision. Treat any such failure as a cancelled
      // proposal, while preserving a failure after an actual commit so
      // recovery can resume the already-selected route honestly.
      if (decisionCommitted) throw error;
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
    return json({
      ...describeOutcome(outcome),
      decision_committed: decisionCommitted,
    });
  });
}

// ---------------------------------------------------------------------------
// Plugin wiring
// ---------------------------------------------------------------------------

const server: Plugin = async (input) => {
  let runtimePromise: Promise<OperatorRuntime> | null = null;
  const runtimeFor = (): Promise<OperatorRuntime> => {
    runtimePromise ??= loadOperatorRuntime(input);
    return runtimePromise;
  };

  return {
    tool: {
      [RUN_TOOL]: tool({
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
      [GATE_TOOL]: tool({
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
      [TRANSITION_TOOL]: tool({
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
