import type {
  BeforeAgentStartEvent,
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
  SessionEntry,
  ToolCallEvent,
  ToolCallEventResult,
} from "@earendil-works/pi-coding-agent";
import { lstat, readdir, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadActiveRun,
  runNextCommand,
  runStartCommand,
} from "../../retrieval_agent_harness_phase_based/plugin-runtime.mjs";

const TITLE = "Retrieval phase workflow";
const SYSTEM_ENTRY = "retrieval-phase-system";
const FILE_TOOLS = new Set(["read", "write", "edit", "grep", "find", "ls"]);
const MUTATING_FILE_TOOLS = new Set(["write", "edit"]);
const DECISIONS = new Map([
  ["Approve", "approve"],
  ["Revise", "revise"],
  ["Block", "block"],
  ["Not Applicable", "not_applicable"],
]);
const PROTECTED_PROJECT_PATHS = [
  "retrieval_agent_harness_phase_based",
  "reference",
  ".opencode",
  ".pi",
  ".git",
];
const SHARED_ENGINEERING_RULES =
  "retrieval_agent_harness_phase_based/_SHARED-RETRIEVAL-ENGINEERING-RULES.md";
const UNICODE_SPACES = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;
let commandBusy = false;

interface LaunchDetails {
  run_id: string;
  gate_id: string;
  attempt: number;
  launch_id: string;
  session_id: string;
  session_path: string;
  session_mode: "manual";
  gate_result_file: string;
  editable_files: string[];
  collaborative_edit_paths: string[];
}

interface LaunchRecord extends LaunchDetails {
  system: string;
}

type LaunchIdentity = Pick<
  LaunchDetails,
  | "run_id"
  | "gate_id"
  | "attempt"
  | "launch_id"
  | "session_id"
  | "session_path"
  | "session_mode"
>;

interface LaunchPacket {
  run_id: string;
  launch_id: string;
  gate_result_file: string;
  attempt: number;
  title: string;
  system: string;
  message: string;
  gate: { id: string; title: string };
  required_artifacts: string[];
  allowed_files: string[];
  collaborative_edit_paths: string[];
  allowed_human_decisions: Array<"approve" | "revise" | "block" | "not_applicable">;
}

type RecordSession = (session: { id: string; path: string }) => Promise<void>;

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function foldedProjectPath(value: string): string {
  return value.normalize("NFKC").toLowerCase();
}

function notify(
  ctx: Pick<ExtensionContext, "ui">,
  message: string,
  type: "info" | "warning" | "error" = "info",
): void {
  ctx.ui.notify(`${TITLE}: ${message}`, type);
}

function launchRecord(entries: SessionEntry[]): LaunchRecord | undefined {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry.type !== "custom" || entry.customType !== SYSTEM_ENTRY) continue;
    const details = entry.data as Partial<LaunchRecord> | undefined;
    if (
      typeof details?.run_id === "string" &&
      typeof details.gate_id === "string" &&
      typeof details.attempt === "number" &&
      typeof details.launch_id === "string" &&
      typeof details.session_id === "string" &&
      typeof details.session_path === "string" &&
      details.session_mode === "manual" &&
      typeof details.gate_result_file === "string" &&
      typeof details.system === "string" &&
      Array.isArray(details.editable_files) &&
      details.editable_files.every((item) => typeof item === "string") &&
      Array.isArray(details.collaborative_edit_paths) &&
      details.collaborative_edit_paths.every((item) => typeof item === "string")
    ) {
      return details as LaunchRecord;
    }
  }
  return undefined;
}

async function currentPiAttempt(ctx: ExtensionContext) {
  const run = await loadActiveRun(ctx.cwd);
  const attempt = run?.state?.current_attempt;
  const session = attempt?.session;
  if (
    !run ||
    run.state.status !== "active" ||
    run.state.active_gate_id !== attempt?.gate_id ||
    session?.host !== "pi" ||
    (session.mode ?? "manual") !== "manual" ||
    session?.id !== ctx.sessionManager.getSessionId() ||
    (session.path ?? "") !== (ctx.sessionManager.getSessionFile() ?? "")
  ) {
    return undefined;
  }

  return {
    run_id: run.state.run_id,
    gate_id: attempt.gate_id,
    attempt: attempt.number,
    launch_id: attempt.launch_id,
    session_id: session.id,
    session_path: session.path ?? "",
    session_mode: "manual" as const,
  };
}

function launchMatches(
  current: LaunchIdentity,
  launch: LaunchRecord,
): boolean {
  return (
    current.run_id === launch.run_id &&
    current.gate_id === launch.gate_id &&
    current.attempt === launch.attempt &&
    current.launch_id === launch.launch_id &&
    current.session_id === launch.session_id &&
    current.session_path === launch.session_path &&
    current.session_mode === launch.session_mode
  );
}

function safetyStopPrompt(event: BeforeAgentStartEvent, detail: string): { systemPrompt: string } {
  return {
    systemPrompt: [
      event.systemPrompt,
      "",
      "# Retrieval phase safety stop",
      "",
      detail,
      "Do not call tools. Return to the current gate session or ask the human to inspect the workflow state and run /retrieval-phase.",
    ].join("\n"),
  };
}

export async function injectPiGateRole(
  event: BeforeAgentStartEvent,
  ctx: ExtensionContext,
): Promise<{ systemPrompt: string } | undefined> {
  const persistedLaunch = launchRecord(ctx.sessionManager.getBranch());

  try {
    const current = await currentPiAttempt(ctx);
    if (!persistedLaunch && !current) return undefined;
    if (!persistedLaunch) {
      return safetyStopPrompt(event, "The active Pi gate session is missing its persisted launch role.");
    }
    if (!current) {
      return safetyStopPrompt(event, "This is a stale Retrieval gate session and is no longer allowed to act.");
    }
    if (!launchMatches(current, persistedLaunch)) {
      return safetyStopPrompt(event, "The persisted Pi gate role does not match the active workflow attempt.");
    }
    return {
      systemPrompt: [
        event.systemPrompt,
        "",
        persistedLaunch.system,
        "",
        "# Pi host boundary",
        "",
        "Work only on this focused gate and stay inside the current project.",
        `The only writable workflow-control file is ${persistedLaunch.gate_result_file}.`,
        "The extension asks the human before every bash call and protects workflow code, the catalog, host adapters, and the reference snapshot. Only packet-listed semantic documents and prompts are collaborative edit paths.",
      ].join("\n"),
    };
  } catch (error) {
    return safetyStopPrompt(
      event,
      `The active gate role could not be verified: ${errorText(error)}`,
    );
  }
}

function inputPath(event: ToolCallEvent): string | undefined {
  if (!event.input || typeof event.input !== "object") return undefined;
  const candidate = (event.input as Record<string, unknown>).path;
  return typeof candidate === "string" ? candidate.replace(/^@/, "") : undefined;
}

function containedBy(base: string, candidate: string): boolean {
  const relative = path.relative(base, candidate);
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

function normalizeToolPath(projectRoot: string, candidate: string): string | undefined {
  let normalized = candidate.replace(UNICODE_SPACES, " ");
  if (normalized === "~") normalized = homedir();
  else if (normalized.startsWith("~/") || normalized.startsWith(`~${path.sep}`)) {
    normalized = path.join(homedir(), normalized.slice(2));
  }
  if (/^file:\/\//i.test(normalized)) {
    try {
      normalized = fileURLToPath(normalized);
    } catch {
      return undefined;
    }
  }
  return path.resolve(projectRoot, normalized);
}

/** Reject a symlink in any existing component of one exact writable path. */
async function unsafeExactWritablePath(
  projectRoot: string,
  candidate: string,
  label: string,
): Promise<string | undefined> {
  const absoluteRoot = path.resolve(projectRoot);
  const absoluteCandidate = normalizeToolPath(projectRoot, candidate);
  if (!absoluteCandidate || !containedBy(absoluteRoot, absoluteCandidate)) return undefined;

  const relative = path.relative(absoluteRoot, absoluteCandidate);
  const segments = relative ? relative.split(path.sep) : [];
  let cursor = absoluteRoot;
  for (let index = -1; index < segments.length; index += 1) {
    if (index >= 0) cursor = path.join(cursor, segments[index]);
    const display = index < 0 ? "." : segments.slice(0, index + 1).join("/");
    let info;
    try {
      info = await lstat(cursor);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      return `${label} topology could not be verified at ${display}: ${errorText(error)}`;
    }
    if (info.isSymbolicLink()) {
      return `${label} may not pass through symbolic link ${display}`;
    }
    if (index >= 0 && index < segments.length - 1 && !info.isDirectory()) {
      return `${label} requires directory ancestor ${display}`;
    }
  }
  return undefined;
}

/** Reject every pre-existing symlink inside one wildcard writable tree. */
async function unsafeWritableTree(
  projectRoot: string,
  candidate: string,
  label: string,
): Promise<string | undefined> {
  const traversal = await unsafeExactWritablePath(projectRoot, candidate, label);
  if (traversal) return traversal;
  const root = normalizeToolPath(projectRoot, candidate);
  if (!root || !containedBy(path.resolve(projectRoot), root)) return undefined;

  const visit = async (directory: string, display: string): Promise<string | undefined> => {
    let info;
    try {
      info = await lstat(directory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      return `${label} topology could not be verified at ${display}: ${errorText(error)}`;
    }
    if (info.isSymbolicLink()) return `${label} may not contain symbolic link ${display}`;
    if (!info.isDirectory()) {
      return `${label} must be a directory when it exists: ${display}`;
    }

    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      return `${label} topology could not be verified at ${display}: ${errorText(error)}`;
    }
    for (const entry of entries) {
      const child = path.join(directory, entry.name);
      const childDisplay = `${display}/${entry.name}`;
      if (entry.isSymbolicLink()) return `${label} may not contain symbolic link ${childDisplay}`;
      if (entry.isDirectory()) {
        const nested = await visit(child, childDisplay);
        if (nested) return nested;
      }
    }
    return undefined;
  };

  return visit(root, candidate);
}

async function canonicalProjectPath(
  projectRoot: string,
  candidate: string,
): Promise<string | undefined> {
  const absoluteRoot = path.resolve(projectRoot);
  const absoluteCandidate = normalizeToolPath(projectRoot, candidate);
  if (!absoluteCandidate || !containedBy(absoluteRoot, absoluteCandidate)) return undefined;

  let existing = absoluteCandidate;
  const missing: string[] = [];
  for (;;) {
    try {
      const [realRoot, realExisting] = await Promise.all([
        realpath(absoluteRoot),
        realpath(existing),
      ]);
      if (!containedBy(realRoot, realExisting)) return undefined;
      const canonical = path.join(realExisting, ...missing.reverse());
      return containedBy(realRoot, canonical) ? canonical : undefined;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") return undefined;
      const parent = path.dirname(existing);
      if (parent === existing) return undefined;
      missing.push(path.basename(existing));
      existing = parent;
    }
  }
}

async function protectedMutation(
  projectRoot: string,
  candidate: string,
  gateResultFile: string,
  editableFiles: string[],
  collaborativeEditPaths: string[],
): Promise<string | undefined> {
  const candidateTopology = await unsafeExactWritablePath(
    projectRoot,
    candidate,
    "Mutating path",
  );
  if (candidateTopology) return candidateTopology;

  for (const allowed of [
    gateResultFile,
    ...editableFiles,
    ...collaborativeEditPaths.filter((entry) => entry !== "docs/**"),
  ]) {
    const authorityTopology = await unsafeExactWritablePath(
      projectRoot,
      allowed,
      `Packet-declared writable path ${allowed}`,
    );
    if (authorityTopology) return authorityTopology;
  }
  if (collaborativeEditPaths.includes("docs/**")) {
    const docsTopology = await unsafeWritableTree(
      projectRoot,
      "docs",
      "Packet-declared writable tree docs/**",
    );
    if (docsTopology) return docsTopology;
  }

  const lexical = normalizeToolPath(projectRoot, candidate);
  if (lexical && containedBy(path.resolve(projectRoot), lexical)) {
    const relative = path.relative(path.resolve(projectRoot), lexical).split(path.sep).join("/");
    for (const protectedPath of ["reference", ".opencode", ".pi", ".git"]) {
      if (relative === protectedPath || relative.startsWith(`${protectedPath}/`)) {
        return `Gate agents may not modify protected workflow material: ${protectedPath}`;
      }
    }
  }
  const canonical = await canonicalProjectPath(projectRoot, candidate);
  if (!canonical) return `Path is outside the project: ${candidate}`;
  try {
    const info = await stat(canonical);
    if (info.isFile() && info.nlink > 1) {
      return `Writable existing file has ${info.nlink} hard links; refusing unsafe multiple-link topology: ${candidate}`;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      return `Writable path topology could not be verified: ${candidate}`;
    }
  }

  const runsRoot = await canonicalProjectPath(projectRoot, ".retrieval-agent-runs");
  if (runsRoot && containedBy(runsRoot, canonical)) {
    const result = await canonicalProjectPath(projectRoot, gateResultFile);
    if (!result || canonical !== result) {
      return `Gate agents may only modify their exact result inside .retrieval-agent-runs: ${gateResultFile}`;
    }
    return undefined;
  }

  const collaborativeExact = await Promise.all(
    collaborativeEditPaths
      .filter((allowed) => allowed !== "docs/**")
      .map(async (allowed) => ({
        allowed,
        canonical: await canonicalProjectPath(projectRoot, allowed),
      })),
  );
  const matchingCollaborative = collaborativeExact.filter(
    (entry) => entry.canonical === canonical,
  );
  let collaborative = matchingCollaborative.length > 0;
  if (collaborativeEditPaths.includes("docs/**")) {
    const docsRoot = await canonicalProjectPath(projectRoot, "docs");
    collaborative ||= Boolean(docsRoot && containedBy(docsRoot, canonical));
  }

  for (const protectedPath of PROTECTED_PROJECT_PATHS) {
    const root = await canonicalProjectPath(projectRoot, protectedPath);
    if (root && containedBy(root, canonical)) {
      if (
        protectedPath === "retrieval_agent_harness_phase_based" &&
        collaborative &&
        matchingCollaborative.some(
          ({ allowed }) => {
            const folded = foldedProjectPath(allowed);
            return (
              /^retrieval_agent_harness_phase_based\/agents\/[^/]+\.md$/.test(folded) ||
              folded === foldedProjectPath(SHARED_ENGINEERING_RULES)
            );
          },
        )
      ) {
        return undefined;
      }
      return `Gate agents may not modify protected workflow material: ${protectedPath}`;
    }
  }
  if (collaborative) return undefined;
  const editable = await Promise.all(
    editableFiles.map((allowed) => canonicalProjectPath(projectRoot, allowed)),
  );
  if (!editable.includes(canonical)) {
    return `This gate may only modify its packet-declared files: ${candidate}`;
  }
  return undefined;
}

export interface GateToolGuardInput {
  projectRoot: string;
  gateResultFile: string;
  editableFiles: string[];
  collaborativeEditPaths?: string[];
  /** Meta workers re-check their exact runtime launch before every tool call. */
  verifyCurrentAttempt?: () => Promise<boolean>;
  /** Every bash call requires real human approval, relayed by the caller. */
  requestBashApproval: (command: string) => Promise<{ approved: boolean; reason?: string }>;
}

/**
 * Resolve `promise`, or settle as aborted the moment `signal` fires. The
 * still-pending promise is left to settle in the background with its
 * rejection swallowed, so an aborted relay can never crash the session.
 */
export function untilAborted<T>(
  promise: Promise<T>,
  signal: AbortSignal | undefined,
): Promise<{ aborted: false; value: T } | { aborted: true }> {
  if (!signal) return promise.then((value) => ({ aborted: false, value }));
  if (signal.aborted) {
    promise.catch(() => {});
    return Promise.resolve({ aborted: true });
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      promise.catch(() => {});
      resolve({ aborted: true });
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve({ aborted: false, value });
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

/**
 * Path/tool guard for a meta-operated background gate session. Reuses the
 * same canonical-path and protected-mutation policy as the visible-session
 * guard below; bash approval is delegated to the meta-operator relay instead
 * of a local UI dialog. The pending approval observes the session's abort
 * signal so a revoked child never stays wedged inside this hook.
 */
export function createGateToolGuard(
  input: GateToolGuardInput,
): (event: ToolCallEvent, signal?: AbortSignal) => Promise<ToolCallEventResult | undefined> {
  return async (event, signal) => {
    if (input.verifyCurrentAttempt) {
      try {
        if (!(await input.verifyCurrentAttempt())) {
          return {
            block: true,
            reason: "This stale Retrieval meta gate session may no longer call tools.",
          };
        }
      } catch (error) {
        return {
          block: true,
          reason: `The Retrieval meta gate launch could not be verified: ${errorText(error)}`,
        };
      }
    }
    if (event.toolName === "bash") {
      const command =
        typeof (event.input as { command?: unknown }).command === "string"
          ? (event.input as { command: string }).command
          : "(command unavailable)";
      const outcome = await untilAborted(input.requestBashApproval(command), signal);
      if (outcome.aborted) {
        return {
          block: true,
          reason: "The gate session was aborted while awaiting approval for this call.",
        };
      }
      const verdict = outcome.value;
      if (verdict.approved) {
        if (input.verifyCurrentAttempt) {
          try {
            if (!(await input.verifyCurrentAttempt())) {
              return {
                block: true,
                reason: "This stale Retrieval meta gate session may no longer call tools after approval.",
              };
            }
          } catch (error) {
            return {
              block: true,
              reason: `The Retrieval meta gate launch could not be reverified after approval: ${errorText(error)}`,
            };
          }
        }
        return undefined;
      }
      return {
        block: true,
        reason: verdict.reason ?? "The human declined this gate's bash call.",
      };
    }
    if (!FILE_TOOLS.has(event.toolName)) return undefined;
    const candidate = inputPath(event);
    if (!candidate) return undefined;
    const canonical = await canonicalProjectPath(input.projectRoot, candidate);
    if (!canonical) {
      return {
        block: true,
        reason: `${event.toolName} path is outside the project: ${candidate}`,
      };
    }
    if (!MUTATING_FILE_TOOLS.has(event.toolName)) return undefined;
    const reason = await protectedMutation(
      input.projectRoot,
      candidate,
      input.gateResultFile,
      input.editableFiles,
      input.collaborativeEditPaths ?? [],
    );
    return reason ? { block: true, reason } : undefined;
  };
}

export async function guardPiGateTool(
  event: ToolCallEvent,
  ctx: ExtensionContext,
): Promise<ToolCallEventResult | undefined> {
  const persistedLaunch = launchRecord(ctx.sessionManager.getBranch());

  let current;
  try {
    current = await currentPiAttempt(ctx);
  } catch (error) {
    return {
      block: true,
      reason: `Retrieval phase workflow state is invalid: ${errorText(error)}`,
    };
  }
  if (!persistedLaunch && !current) return undefined;
  if (!persistedLaunch) {
    return {
      block: true,
      reason: "The active Pi gate session is missing its persisted launch role.",
    };
  }
  if (!current) {
    return {
      block: true,
      reason: "This stale Retrieval gate session may no longer call tools.",
    };
  }
  if (!launchMatches(current, persistedLaunch)) {
    return {
      block: true,
      reason: "The persisted Pi gate role does not match the active workflow attempt.",
    };
  }
  const active = persistedLaunch;
  if (event.toolName === "bash") {
    if (!ctx.hasUI) {
      return {
        block: true,
        reason: "Active-gate bash calls require interactive human confirmation.",
      };
    }
    const command =
      typeof (event.input as { command?: unknown }).command === "string"
        ? (event.input as { command: string }).command
        : "(command unavailable)";
    const allowed = await ctx.ui.confirm(
      `${active.gate_id}: allow bash?`,
      `${command}\n\nBash can bypass file guards. Approve only if it stays inside ${ctx.cwd}.`,
    );
    if (!allowed) {
      return { block: true, reason: "The human declined this gate's bash call." };
    }
    let rechecked;
    try {
      rechecked = await currentPiAttempt(ctx);
    } catch (error) {
      return {
        block: true,
        reason: `The Retrieval phase launch could not be reverified after approval: ${errorText(error)}`,
      };
    }
    if (!rechecked || !launchMatches(rechecked, active)) {
      return {
        block: true,
        reason: "This Retrieval gate session is no longer current after bash approval.",
      };
    }
    return undefined;
  }

  if (!FILE_TOOLS.has(event.toolName)) return undefined;
  const candidate = inputPath(event);
  if (!candidate) return undefined;
  const canonical = await canonicalProjectPath(ctx.cwd, candidate);
  if (!canonical) {
    return {
      block: true,
      reason: `${event.toolName} path is outside the project: ${candidate}`,
    };
  }
  if (!MUTATING_FILE_TOOLS.has(event.toolName)) return undefined;

  const reason = await protectedMutation(
    ctx.cwd,
    candidate,
    active.gate_result_file,
    active.editable_files,
    active.collaborative_edit_paths,
  );
  return reason ? { block: true, reason } : undefined;
}

async function launchPiGate(
  ctx: ExtensionCommandContext,
  packet: LaunchPacket,
  recordSession: RecordSession,
): Promise<{ id: string; path: string }> {
  const parentSession = ctx.sessionManager.getSessionFile();
  let identity: { id: string; path: string } | undefined;

  const replacement = await ctx.newSession({
    ...(parentSession ? { parentSession } : {}),
    setup: async (sessionManager) => {
      const sessionPath = sessionManager.getSessionFile();
      if (!sessionPath) {
        throw new Error("Pi did not create a persistent session for this gate");
      }
      identity = { id: sessionManager.getSessionId(), path: sessionPath };
      sessionManager.appendSessionInfo(packet.title);
      sessionManager.appendCustomEntry(SYSTEM_ENTRY, {
        run_id: packet.run_id,
        gate_id: packet.gate.id,
        attempt: packet.attempt,
        launch_id: packet.launch_id,
        session_id: identity.id,
        session_path: identity.path,
        session_mode: "manual",
        gate_result_file: packet.gate_result_file,
        editable_files: [
          ...packet.required_artifacts,
          ...packet.allowed_files,
          packet.gate_result_file,
        ],
        collaborative_edit_paths: packet.collaborative_edit_paths,
        system: packet.system,
      } satisfies LaunchRecord);
      await recordSession(identity);
    },
    withSession: async (replacementCtx) => {
      try {
        await replacementCtx.sendUserMessage(packet.message);
        notify(
          replacementCtx,
          `Opened ${packet.gate.id} in a fresh persistent session.`,
          "info",
        );
      } catch (error) {
        notify(replacementCtx, errorText(error), "error");
        throw error;
      }
    },
  });

  if (replacement.cancelled) {
    throw new Error("Fresh gate session was cancelled; no gate was launched");
  }
  if (!identity) throw new Error("Pi did not provide a durable gate-session identity");
  return identity;
}

function launchCallback(ctx: ExtensionCommandContext) {
  return (packet: LaunchPacket, recordSession: RecordSession) =>
    launchPiGate(ctx, packet, recordSession);
}

function reviewText(review: any): string {
  const lines = [
    `${review.gate.id} — ${review.gate.title}`,
    `Recommendation: ${review.result.recommendation}`,
    ...(review.result.blockers.length
      ? ["Blockers:", ...review.result.blockers.map((item: string) => `- ${item}`)]
      : []),
    `Summary: ${review.result.summary}`,
  ];
  if (review.result.artifacts.length) {
    lines.push(
      "Artifacts:",
      ...review.result.artifacts.map((artifact: any) => `- ${artifact.path} — ${artifact.role}`),
    );
  }
  if (review.result.evidence.length) {
    lines.push(
      "Evidence:",
      ...review.result.evidence.map((evidence: any) => `- ${evidence.path} — ${evidence.supports}`),
    );
  }
  if (review.result.uncertainties.length) {
    lines.push("Uncertainties:", ...review.result.uncertainties.map((item: string) => `- ${item}`));
  }
  return lines.join("\n");
}

async function chooseDecision(ctx: ExtensionCommandContext, review: any) {
  if (!Array.isArray(review.allowed_human_decisions)) {
    throw new Error("The runtime review omitted its catalog decision choices.");
  }
  const allowed = new Set(review.allowed_human_decisions);
  const labels = [...DECISIONS.entries()]
    .filter(([, decision]) => allowed.has(decision))
    .map(([label]) => label);
  const label = await ctx.ui.select("Gate decision", labels);
  if (!label) return undefined;
  const decision = DECISIONS.get(label);
  if (!decision) return undefined;
  if (decision === "approve") return { decision };

  const reason = (await ctx.ui.input(`Reason for ${label}`, "Required short reason"))?.trim();
  return reason ? { decision, reason } : undefined;
}

function reportStatus(
  ctx: ExtensionCommandContext,
  outcome: any,
  commandName: "retrieval-phase" | "retrieval-phase-next",
): void {
  const gate = outcome.run?.state?.active_gate_id ?? outcome.review?.attempt?.gate_id;
  if (outcome.kind === "launched") return;
  const nextCommand = commandName === "retrieval-phase-next";
  switch (outcome.kind) {
    case "ready":
      notify(ctx, `${gate} is ready for review. Run /retrieval-phase-next.`, "info");
      return;
    case "missing":
      notify(
        ctx,
        nextCommand
          ? `${gate} has no gate-result.json yet. No decision was recorded.`
          : `${gate} is still active. Finish gate-result.json, then run /retrieval-phase-next.`,
        "info",
      );
      return;
    case "invalid":
      notify(ctx, `The ${gate ?? "active gate"} result is invalid: ${outcome.review?.error}`, "error");
      return;
    case "idle":
      notify(ctx, "Run is between gates. Run /retrieval-phase-next to continue.", "info");
      return;
    case "delivery_pending":
      notify(
        ctx,
        "Gate kickoff delivery is uncertain. Run /retrieval-phase, inspect the recorded session, and recover only if no gate turn is running.",
        "warning",
      );
      return;
    case "no_run":
      notify(ctx, "No run exists. Run /retrieval-phase to start one.", "info");
      return;
    case "needs_start":
    case "complete":
      notify(
        ctx,
        outcome.kind === "complete"
          ? "The Retrieval phase workflow is complete."
          : "The first gate has not launched. Run /retrieval-phase.",
        outcome.kind === "complete" ? "info" : "warning",
      );
      return;
    case "stopped":
      notify(ctx, outcome.run?.state?.stop_reason ?? "The workflow is stopped.", "error");
      return;
    case "cancelled":
      notify(ctx, "Cancelled. No decision or state changed.", "info");
      return;
    case "blocked":
      notify(ctx, `The workflow is blocked at ${gate}. Run /retrieval-phase to resume.`, "warning");
      return;
    default:
      notify(ctx, `Workflow status: ${outcome.kind}.`, "info");
  }
}

async function runRetrievalPhase(ctx: ExtensionCommandContext): Promise<void> {
  const repoRoot = path.resolve(ctx.cwd);
  const launch = launchCallback(ctx);
  let outcome = await runStartCommand({
    repoRoot,
    host: "pi",
    sessionMode: "manual",
    intake: undefined,
    resumeReason: undefined,
    launch,
  });

  if (outcome.kind === "no_run") {
    const targetRepoPath = (await ctx.ui.input(
      "Where is your agent repository?",
      ".",
    ))?.trim();
    if (!targetRepoPath) {
      notify(ctx, "Cancelled. No run was created.", "info");
      return;
    }
    const initialIdea = (await ctx.ui.input(
      "What should the enterprise retrieval agent being built do?",
      "Initial idea, users, constraints, and desired outcome",
    ))?.trim();
    if (!initialIdea) {
      notify(ctx, "Cancelled. No run was created.", "info");
      return;
    }
    outcome = await runStartCommand({
      repoRoot,
      host: "pi",
      sessionMode: "manual",
      intake: { targetRepoPath, initialIdea },
      resumeReason: undefined,
      launch,
    });
  } else if (outcome.kind === "delivery_pending") {
    const attempt = outcome.run.state.current_attempt;
    const delivered = await ctx.ui.confirm(
      `Was kickoff delivered for ${outcome.run.state.active_gate_id}?`,
      `Inspect recorded session ${attempt?.session?.id ?? "(unknown)"}. Confirm only if the gate prompt is present; the runtime will mark delivery without launching anything else.`,
    );
    if (delivered) {
      outcome = await runStartCommand({
        repoRoot,
        host: "pi",
        intake: undefined,
        resumeReason: undefined,
        confirmPendingDelivery: true,
        expectedPendingLaunch: attempt,
        sessionMode: "manual",
        launch,
      });
    } else {
      const retry = await ctx.ui.confirm(
        `Retry undelivered kickoff for ${outcome.run.state.active_gate_id}?`,
        "Confirm only when inspection shows no gate turn is running and kickoff was not delivered; the old Pi session becomes stale before a fresh one is created.",
      );
      if (!retry) {
        notify(ctx, "The uncertain kickoff remains fail-closed.", "warning");
        return;
      }
      outcome = await runStartCommand({
        repoRoot,
        host: "pi",
        intake: undefined,
        resumeReason: "The human inspected the recorded session and confirmed that kickoff was not delivered.",
        recoverPendingLaunch: true,
        expectedPendingLaunch: attempt,
        sessionMode: "manual",
        retirePendingSession: async (session: { host?: string; id?: string }) => {
          if (session.host !== "pi" || !session.id) {
            throw new Error("The pending attempt is not bound to a valid Pi session.");
          }
        },
        launch,
      });
    }
  } else if (outcome.kind === "blocked") {
    const resume = await ctx.ui.confirm(
      `Resume blocked gate ${outcome.run.state.active_gate_id}?`,
      outcome.run.state.stop_reason ?? "Open the blocked gate in a fresh session?",
    );
    if (!resume) {
      notify(ctx, "The run remains blocked.", "warning");
      return;
    }
    const resumeReason = (await ctx.ui.input(
      "Why resume?",
      "Short direction for the fresh gate session",
    ))?.trim();
    if (!resumeReason) {
      notify(ctx, "The run remains blocked.", "warning");
      return;
    }
    outcome = await runStartCommand({
      repoRoot,
      host: "pi",
      sessionMode: "manual",
      intake: undefined,
      resumeReason,
      launch,
    });
  }

  reportStatus(ctx, outcome, "retrieval-phase");
}

async function runRetrievalPhaseNext(ctx: ExtensionCommandContext): Promise<void> {
  const outcome = await runNextCommand({
    repoRoot: path.resolve(ctx.cwd),
    host: "pi",
    sessionMode: "manual",
    display: async (review: any) => {
      notify(
        ctx,
        reviewText(review),
        review.result.blockers.length ? "warning" : "info",
      );
    },
    decide: async (review: any) => chooseDecision(ctx, review),
    afterDecision: async () => {
      notify(ctx, "Decision recorded. Applying the selected transition.", "info");
    },
    launch: launchCallback(ctx),
  });
  reportStatus(ctx, outcome, "retrieval-phase-next");
}

function beginCommand(ctx: ExtensionCommandContext, command: string): boolean {
  if (!ctx.hasUI) {
    notify(ctx, `${command} requires interactive Pi.`, "error");
    return false;
  }
  if (!ctx.isProjectTrusted()) {
    notify(ctx, `${command} requires a trusted project.`, "error");
    return false;
  }
  if (!ctx.model) {
    notify(ctx, "Select a model before launching a gate.", "error");
    return false;
  }
  if (!ctx.modelRegistry.hasConfiguredAuth(ctx.model)) {
    notify(ctx, "Configure authentication for the selected model first.", "error");
    return false;
  }
  if (!ctx.sessionManager.getSessionFile()) {
    notify(ctx, "Start Pi with session persistence before launching gates.", "error");
    return false;
  }
  if (commandBusy) {
    notify(ctx, "Another retrieval phase command is still open.", "warning");
    return false;
  }
  commandBusy = true;
  return true;
}

function command(
  name: string,
  run: (ctx: ExtensionCommandContext) => Promise<void>,
) {
  return async (_args: string, ctx: ExtensionCommandContext) => {
    if (!beginCommand(ctx, `/${name}`)) return;
    try {
      await ctx.waitForIdle();
      await run(ctx);
    } catch (error) {
      notify(ctx, errorText(error), "error");
    } finally {
      commandBusy = false;
    }
  };
}

export default function retrievalPhasePi(pi: ExtensionAPI): void {
  pi.on("before_agent_start", injectPiGateRole);
  pi.on("tool_call", guardPiGateTool);
  pi.registerCommand("retrieval-phase", {
    description: "Start once, inspect status, or resume the Retrieval phase workflow",
    handler: command("retrieval-phase", runRetrievalPhase),
  });
  pi.registerCommand("retrieval-phase-next", {
    description: "Review, decide, and perform the selected gate transition",
    handler: command("retrieval-phase-next", runRetrievalPhaseNext),
  });
}
