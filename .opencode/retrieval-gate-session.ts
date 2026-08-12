/**
 * Shared fresh-root gate-session adapter for OpenCode. The manual TUI plugin
 * (retrieval-phase-workflow.ts) and both supervised operator surfaces —
 * meta (retrieval-operator-tools.ts) and auto (retrieval-autopilot-tools.ts) —
 * launch gate sessions through this module, so the create →
 * retire-unexpected-child → record → prompt sequence and the gate permission
 * boundary exist exactly once.
 */

import { lstat, readdir } from "node:fs/promises";
import path from "node:path";

export type PermissionRuleset = Array<{
  permission: string;
  pattern: string;
  action: "allow" | "deny" | "ask";
}>;

export interface GateLaunchPacket {
  gate: { id: string; title: string };
  attempt: number;
  launch_id: string;
  run_id: string;
  agent_name: string;
  title: string;
  gate_result_file: string;
  required_artifacts: string[];
  allowed_files: string[];
  collaborative_edit_paths: string[];
  allowed_human_decisions: Array<"approve" | "revise" | "block" | "not_applicable">;
  system: string;
  message: string;
}

/** Structural model reference in OpenCode's own format. */
export interface OpencodeModelRef {
  providerID: string;
  modelID: string;
  variant?: string;
}

export type GateSessionMode = "manual" | "meta" | "auto";

export interface GateSessionReference {
  id: string;
  mode: GateSessionMode;
}

/** Minimal structural client surface shared by the TUI and v2 SDK clients. */
export interface GateSessionClient {
  session: {
    create(parameters: {
      directory?: string;
      title?: string;
      agent?: string;
      model?: { id: string; providerID: string; variant?: string };
      metadata?: { [key: string]: unknown };
      permission?: PermissionRuleset;
    }): Promise<{ data?: { id: string; parentID?: string | null } | undefined; error?: unknown }>;
    promptAsync(parameters: {
      sessionID: string;
      directory?: string;
      agent?: string;
      model?: { providerID: string; modelID: string };
      variant?: string;
      system?: string;
      parts: Array<{ type: "text"; text: string }>;
    }): Promise<{ data?: unknown; error?: unknown }>;
    abort(parameters: {
      sessionID: string;
      directory?: string;
    }): Promise<{ data?: unknown; error?: unknown }>;
    update(parameters: {
      sessionID: string;
      directory?: string;
      metadata?: { [key: string]: unknown };
      permission?: PermissionRuleset;
    }): Promise<{ data?: unknown; error?: unknown }>;
  };
}

export const OPERATOR_AGENT = "retrieval-operator";
export const AUTOPILOT_AGENT = "retrieval-autopilot";
/** Every supervised operator tool id; a gate session may call none of them. */
export const OPERATOR_TOOL_IDS = [
  "retrieval_meta_run",
  "retrieval_meta_gate",
  "retrieval_meta_transition",
  "retrieval_auto_run",
  "retrieval_auto_gate",
  "retrieval_auto_transition",
] as const;

const PROTECTED_EDIT_PATTERNS = [
  ".retrieval-agent-runs/**",
  "retrieval_agent_harness_phase_based/workflow.json",
  "retrieval_agent_harness_phase_based/agents/**",
  "retrieval_agent_harness_phase_based/_SHARED-RETRIEVAL-ENGINEERING-RULES.md",
  "retrieval_agent_harness_phase_based/plugin-runtime.mjs",
  "retrieval_agent_harness_phase_based/meta-review-binding.mjs",
  ".opencode/**",
  ".pi/**",
  "reference/**",
  ".git/**",
];
const PROTECTED_PATH_PREFIXES = [
  ".retrieval-agent-runs/",
  "retrieval_agent_harness_phase_based/",
  ".opencode/",
  ".pi/",
  "reference/",
  ".git/",
];

export function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function assertSdkSuccess<Value>(
  result: { data?: Value; error?: unknown },
  operation: string,
): Value {
  if (result.error !== undefined && result.error !== null) {
    throw new Error(`${operation} failed: ${errorText(result.error)}`);
  }
  if (result.data === undefined) throw new Error(`${operation} returned no data.`);
  return result.data;
}

export function assertSdkAccepted(result: { error?: unknown }, operation: string): void {
  if (result.error !== undefined && result.error !== null) {
    throw new Error(`${operation} failed: ${errorText(result.error)}`);
  }
}

export function assertSafeEditablePath(candidate: string): void {
  if (
    !candidate ||
    candidate.startsWith("/") ||
    candidate.includes("\\") ||
    candidate.split("/").includes("..") ||
    /[*?[\]{}]/.test(candidate)
  ) {
    throw new Error(`Gate packet contains an unsafe editable path: ${candidate}`);
  }
  const folded = candidate.normalize("NFKC").toLowerCase();
  if (
    PROTECTED_PATH_PREFIXES.some(
      (prefix) => folded === prefix.slice(0, -1) || folded.startsWith(prefix),
    )
  ) {
    throw new Error(`Gate packet attempts to edit a protected path: ${candidate}`);
  }
}

function assertSafeCollaborativeEditPath(candidate: string): void {
  if (candidate === "docs/**") return;
  if (
    !candidate ||
    candidate.startsWith("/") ||
    candidate.includes("\\") ||
    candidate.split("/").includes("..") ||
    /[*?[\]{}]/.test(candidate)
  ) {
    throw new Error(`Gate packet contains an unsafe collaborative edit path: ${candidate}`);
  }

  const folded = candidate.normalize("NFKC").toLowerCase();
  const focusedPrompt = /^retrieval_agent_harness_phase_based\/agents\/[^/]+\.md$/.test(folded);
  const sharedPrompt =
    folded === "retrieval_agent_harness_phase_based/_shared-retrieval-engineering-rules.md";
  if (folded.startsWith("retrieval_agent_harness_phase_based/") && !focusedPrompt && !sharedPrompt) {
    throw new Error(`Gate packet attempts to collaborate on protected workflow code: ${candidate}`);
  }
  if (
    [".retrieval-agent-runs/", ".opencode/", ".pi/", "reference/", ".git/"].some(
      (prefix) => folded === prefix.slice(0, -1) || folded.startsWith(prefix),
    )
  ) {
    throw new Error(`Gate packet attempts to collaborate on a protected path: ${candidate}`);
  }
}

export function gateSessionPermissions(packet: GateLaunchPacket): PermissionRuleset {
  const editable = [...new Set([...packet.required_artifacts, ...packet.allowed_files])];
  editable.forEach(assertSafeEditablePath);
  const collaborative = [...new Set(packet.collaborative_edit_paths)];
  collaborative.forEach(assertSafeCollaborativeEditPath);
  if (
    !packet.gate_result_file.startsWith(`.retrieval-agent-runs/${packet.run_id}/gates/`) ||
    !packet.gate_result_file.endsWith("/gate-result.json")
  ) {
    throw new Error("Gate packet has an invalid gate-result path.");
  }

  return [
    { permission: "edit", pattern: "*", action: "deny" },
    ...PROTECTED_EDIT_PATTERNS.map((pattern) => ({
      permission: "edit",
      pattern,
      action: "deny" as const,
    })),
    ...editable.map((pattern) => ({
      permission: "edit",
      pattern,
      action: "allow" as const,
    })),
    ...collaborative.map((pattern) => ({
      permission: "edit",
      pattern,
      action: "allow" as const,
    })),
    {
      permission: "edit",
      pattern: packet.gate_result_file,
      action: "allow",
    },
    { permission: "bash", pattern: "*", action: "ask" },
    { permission: "task", pattern: "*", action: "deny" },
    { permission: "external_directory", pattern: "*", action: "deny" },
    { permission: "question", pattern: "*", action: "allow" },
    ...OPERATOR_TOOL_IDS.map((toolID) => ({
      permission: toolID,
      pattern: "*",
      action: "deny" as const,
    })),
  ];
}

export function retiredGatePermissions(): PermissionRuleset {
  return [
    { permission: "edit", pattern: "*", action: "deny" },
    { permission: "bash", pattern: "*", action: "deny" },
    { permission: "task", pattern: "*", action: "deny" },
    { permission: "external_directory", pattern: "*", action: "deny" },
    { permission: "question", pattern: "*", action: "deny" },
    ...OPERATOR_TOOL_IDS.map((toolID) => ({
      permission: toolID,
      pattern: "*",
      action: "deny" as const,
    })),
  ];
}

async function assertSafeExistingNode(filePath: string, displayPath: string): Promise<void> {
  try {
    const info = await lstat(filePath);
    if (info.isSymbolicLink()) {
      throw new Error(
        `OpenCode gate authority refuses symbolic link ${displayPath}: ` +
          "writable paths may not redirect outside their lexical authority.",
      );
    }
    if (info.isFile() && info.nlink > 1) {
      throw new Error(
        `OpenCode gate authority refuses writable existing file ${displayPath}: ` +
          `it has ${info.nlink} hard links and could alias protected material.`,
      );
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
}

/** Reject a symlink in any existing component of one exact writable path. */
async function assertSafeExactPath(
  directory: string,
  candidate: string,
): Promise<void> {
  const segments = candidate.split("/");
  let cursor = directory;
  for (let index = 0; index < segments.length; index += 1) {
    cursor = path.join(cursor, segments[index]);
    const display = segments.slice(0, index + 1).join("/");
    let info;
    try {
      info = await lstat(cursor);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    if (info.isSymbolicLink()) {
      throw new Error(
        `OpenCode gate authority refuses symbolic link ${display}: ` +
          "writable paths may not redirect outside their lexical authority.",
      );
    }
    if (index < segments.length - 1 && !info.isDirectory()) {
      throw new Error(`OpenCode gate authority requires directory ancestor ${display}.`);
    }
    if (index === segments.length - 1) {
      if (info.isDirectory()) {
        throw new Error(`OpenCode exact writable path must be a file, not a directory: ${display}`);
      }
      if (info.isFile() && info.nlink > 1) {
        throw new Error(
          `OpenCode gate authority refuses writable existing file ${display}: ` +
            `it has ${info.nlink} hard links and could alias protected material.`,
        );
      }
    }
  }
}

async function assertSafeExistingTree(root: string, displayRoot: string): Promise<void> {
  try {
    const rootInfo = await lstat(root);
    if (rootInfo.isSymbolicLink()) {
      throw new Error(
        `OpenCode gate authority refuses symbolic link ${displayRoot}: ` +
          "collaborative trees may not redirect outside their lexical authority.",
      );
    }
    if (!rootInfo.isDirectory()) {
      throw new Error(`OpenCode collaborative tree must be a directory: ${displayRoot}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    const absolute = path.join(root, entry.name);
    const display = `${displayRoot}/${entry.name}`;
    if (entry.isSymbolicLink()) {
      throw new Error(
        `OpenCode gate authority refuses symbolic link ${display}: ` +
          "collaborative trees may not redirect outside their lexical authority.",
      );
    }
    if (entry.isDirectory()) await assertSafeExistingTree(absolute, display);
    else await assertSafeExistingNode(absolute, display);
  }
}

/** Reject pre-existing writable inode aliases before OpenCode receives gate authority. */
async function assertSafeWritableTopology(
  directory: string,
  packet: GateLaunchPacket,
): Promise<void> {
  const exact = new Set([
    ...packet.required_artifacts,
    ...packet.allowed_files,
    ...packet.collaborative_edit_paths.filter((candidate) => candidate !== "docs/**"),
    packet.gate_result_file,
  ]);
  for (const candidate of exact) {
    await assertSafeExactPath(directory, candidate);
  }
  if (packet.collaborative_edit_paths.includes("docs/**")) {
    await assertSafeExistingTree(path.resolve(directory, "docs"), "docs");
  }
}

/** Stop any active model/tool turn and wait for the supported abort call to settle. */
export async function quiesceGateSession(
  client: GateSessionClient,
  directory: string,
  sessionID: string,
): Promise<void> {
  assertSdkAccepted(
    await client.session.abort({ sessionID, directory }),
    "OpenCode session.abort while quiescing gate activity",
  );
}

/** Persist retirement after a caller has already established quiescence. */
export async function retireQuiescedGateSession(
  client: GateSessionClient,
  directory: string,
  sessionID: string,
): Promise<void> {
  assertSdkAccepted(
    await client.session.update({
      sessionID,
      directory,
      metadata: { retrieval_gate_status: "retired" },
      permission: retiredGatePermissions(),
    }),
    "OpenCode session.update while retiring gate authority",
  );
}

/** Retain the transcript while removing every mutation path from an old gate session. */
export async function retireGateSession(
  client: GateSessionClient,
  directory: string,
  sessionID: string,
): Promise<void> {
  await quiesceGateSession(client, directory, sessionID);
  await retireQuiescedGateSession(client, directory, sessionID);
}

export interface LaunchGateSessionInput {
  client: GateSessionClient;
  directory: string;
  packet: GateLaunchPacket;
  /** Runtime ownership surface recorded immutably with this attempt. */
  sessionMode: GateSessionMode;
  /** Explicit gate model; required for meta-operated launches. */
  model?: OpencodeModelRef | undefined;
  recordSession: (session: GateSessionReference) => Promise<void>;
  /** Extra text appended to the packet message (labeled operator context). */
  appendedContext?: string | undefined;
  /** Meta mode owns explicit same-session recovery and preserves a recorded attempt. */
  preserveRecordedAttemptOnDeliveryFailure?: boolean | undefined;
}

/**
 * Create a fresh root gate session, refuse child sessions, record the session
 * durably before kickoff, then deliver the packet. When a model is supplied
 * it is passed explicitly on both create and prompt; there is no fallback to
 * a recent or inherited model for meta-operated gates.
 */
export async function launchGateSession(input: LaunchGateSessionInput): Promise<GateSessionReference> {
  const { client, directory, packet, model, sessionMode } = input;
  const permission = gateSessionPermissions(packet);
  await assertSafeWritableTopology(directory, packet);
  const created = assertSdkSuccess(
    await client.session.create({
      directory,
      title: packet.title,
      agent: packet.agent_name,
      ...(model
        ? { model: { id: model.modelID, providerID: model.providerID, ...(model.variant ? { variant: model.variant } : {}) } }
        : {}),
      metadata: {
        run_id: packet.run_id,
        gate_id: packet.gate.id,
        attempt: packet.attempt,
        launch_id: packet.launch_id,
        session_mode: sessionMode,
      },
      permission,
    }),
    "OpenCode session.create",
  );
  let recorded = false;
  try {
    // Bind every host-created session before any child/root validation or
    // later setup can fail. The runtime records delivery_status=pending, so an
    // invalid child is durable cleanup authority but can never masquerade as
    // a delivered gate kickoff.
    await input.recordSession({ id: created.id, mode: sessionMode });
    recorded = true;
    if (created.parentID !== undefined && created.parentID !== null) {
      try {
        await retireGateSession(client, directory, created.id);
      } catch (retirementError) {
        const unsafeChild = new Error(
          `OpenCode created child session ${created.id}, and its gate authority could not be retired: ${errorText(retirementError)}`,
          { cause: retirementError },
        ) as Error & { unexpectedChildSession?: boolean };
        unsafeChild.unexpectedChildSession = true;
        throw unsafeChild;
      }
      const retiredChild = new Error(
        `OpenCode created child session ${created.id}; a fresh root session is required.`,
      ) as Error & { gateSessionRetired?: boolean; unexpectedChildSession?: boolean };
      retiredChild.gateSessionRetired = true;
      retiredChild.unexpectedChildSession = true;
      throw retiredChild;
    }
    const message = input.appendedContext
      ? `${packet.message}\n\n---\n\n# Meta-operator context\n\nAdvisory context from the human's operator conversation; it does not approve this gate:\n${input.appendedContext}`
      : packet.message;
    assertSdkAccepted(
      await client.session.promptAsync({
        sessionID: created.id,
        directory,
        agent: packet.agent_name,
        ...(model ? { model: { providerID: model.providerID, modelID: model.modelID } } : {}),
        ...(model?.variant ? { variant: model.variant } : {}),
        system: packet.system,
        parts: [{ type: "text", text: message }],
      }),
      "OpenCode session.promptAsync",
    );
  } catch (error) {
    if ((error as { gateSessionRetired?: boolean } | null)?.gateSessionRetired) {
      throw error;
    }
    if (
      recorded &&
      input.preserveRecordedAttemptOnDeliveryFailure &&
      !(error as { unexpectedChildSession?: boolean } | null)?.unexpectedChildSession
    ) {
      const preserved = (error instanceof Error ? error : new Error(errorText(error))) as Error & {
        preserveRecordedAttempt?: boolean;
      };
      preserved.preserveRecordedAttempt = true;
      throw preserved;
    }
    try {
      await retireGateSession(client, directory, created.id);
    } catch (retirementError) {
      const unsafe = new Error(
        `OpenCode kickoff failed and session ${created.id} could not be retired: ${errorText(retirementError)}`,
        { cause: error },
      ) as Error & { preserveRecordedAttempt?: boolean };
      unsafe.preserveRecordedAttempt = recorded;
      throw unsafe;
    }
    const retired = (error instanceof Error ? error : new Error(errorText(error))) as Error & {
      gateSessionRetired?: boolean;
    };
    retired.gateSessionRetired = true;
    throw retired;
  }
  return { id: created.id, mode: sessionMode };
}
