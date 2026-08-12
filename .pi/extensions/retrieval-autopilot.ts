/**
 * Pi autopilot extension: the same supervised-operator core as the meta
 * extension, constructed on its own "auto" surface. One visible agent — the
 * autopilot operator, whose doctrine is loaded here as the run tool's prompt
 * snippet — drives the whole gate sequence itself: it launches each background
 * gate worker on the configured gate model, answers worker questions, approves
 * or denies shell requests against the exact recorded payload, and commits gate
 * transitions with a recorded rationale instead of a human confirmation dialog.
 * Every authority action lands in the run's autopilot ledger, and the caps and
 * fail-closed refusals in the core turn genuinely critical blockers back into
 * escalations the human decides.
 *
 * This extension is opt-in (.pi/settings.json force-excludes it from normal
 * discovery): load either the manual adapter, the meta extension, or this one
 * for a run, never two ownership modes at once.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import {
  createRealBindings,
  handleInstalledPiShutdown,
  PiMetaOperatorCore,
  terminatePiProcess,
  type OperatorContextLike,
  type PiShutdownTerminator,
} from "./retrieval-meta-operator.ts";

/** Canonical single owner of the autopilot judgment doctrine. */
const OPERATOR_PROMPT_FILE =
  "retrieval_agent_harness_phase_based/agents/retrieval-autopilot-operator.md";
const OPERATOR_PROMPT_SNIPPET =
  "Drive the Retrieval gate sequence autonomously under the installed operator doctrine; use only these audited control tools and read-only inspection tools.";
const OPERATOR_ACTIVE_TOOLS = [
  "read",
  "grep",
  "find",
  "ls",
  "retrieval_auto_run",
  "retrieval_auto_gate",
  "retrieval_auto_transition",
];

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The doctrine body without its OpenCode-style frontmatter. The prompt is
 * shared verbatim with the OpenCode agent, so only the frontmatter is dropped.
 */
async function readOperatorDoctrine(): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  const file = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
    OPERATOR_PROMPT_FILE
  );
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch (error) {
    throw new Error(
      `the Retrieval autopilot operator prompt ${file} could not be read (${errorText(error)}); ` +
        "refusing to register the autopilot tools without their doctrine"
    );
  }
  if (!raw.startsWith("---\n")) {
    throw new Error(`${OPERATOR_PROMPT_FILE} must start with YAML frontmatter`);
  }
  const end = raw.indexOf("\n---\n", 4);
  if (end < 0) throw new Error(`${OPERATOR_PROMPT_FILE} frontmatter is not terminated`);
  const body = raw.slice(end + 5).trim();
  if (!body) throw new Error(`${OPERATOR_PROMPT_FILE} body must be non-empty`);
  return body;
}

export interface PiAutopilotRegistrationOptions {
  /** Test seam for exercising the actual registered lifecycle callback. */
  core?: PiMetaOperatorCore;
  /** Defaults to the non-returning production process terminator. */
  terminateProcess?: PiShutdownTerminator;
}

export default async function retrievalAutopilotPi(
  pi: ExtensionAPI,
  options: PiAutopilotRegistrationOptions = {}
): Promise<void> {
  const { Type } = await import("typebox");
  // Google-compatible string enums: Type.Union of literals does not work with
  // Google's API, per the installed Pi docs.
  const { StringEnum } = await import("@earendil-works/pi-ai");
  const doctrine = await readOperatorDoctrine();
  const core = options.core ?? new PiMetaOperatorCore(createRealBindings(), { surface: "auto" });
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

  // The canonical doctrine is a real system instruction, not a one-line tool
  // description. Pi deliberately normalizes promptSnippet whitespace, so
  // preserve the exact Markdown body through the installed system-prompt hook.
  pi.on("before_agent_start", (event) => ({
    systemPrompt: `${event.systemPrompt}\n\n# Retrieval autopilot operator doctrine\n\n${doctrine}`,
  }));

  // OpenCode enforces these restrictions from the canonical frontmatter. Pi
  // does not interpret that frontmatter, so make the same trust boundary
  // mechanical: the visible operator can inspect bytes but cannot write or run
  // an unaudited shell outside the worker-request path.
  pi.on("session_start", () => {
    pi.setActiveTools(OPERATOR_ACTIVE_TOOLS);
  });

  pi.registerTool({
    name: "retrieval_auto_run",
    label: "Retrieval autopilot run control",
    description:
      "Retrieval autopilot run control: status (includes approved fact ids and the live worker), start with the exact kickoff values you restated to the human, resume a blocked run the human asked you to resume, or recover an interrupted launch. Launches background gates on the explicitly configured harness/gate model.",
    promptSnippet: OPERATOR_PROMPT_SNIPPET,
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
    name: "retrieval_auto_gate",
    label: "Retrieval autopilot gate interaction",
    description:
      "Interact with the background worker running the configured harness/gate model: wait/read/send, answer or reject its questions (source approved-context cites approved facts; auto-operator answers are yours and need a rationale), approve or deny its exact recorded shell payload with a rationale, abort, or release an idle verified worker with a ready result. Every answer, approval, and denial is ledgered.",
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
      source: Type.Optional(StringEnum(["approved-context", "auto-operator"])),
      approve: Type.Optional(Type.Boolean()),
      rationale: Type.Optional(Type.String()),
      reason: Type.Optional(Type.String()),
      transcriptOffset: Type.Optional(Type.Number()),
      timeoutSeconds: Type.Optional(Type.Number()),
    }),
    execute: async (_id, params, _signal, _onUpdate, ctx) =>
      asResult(await core.gateAction(operatorContext(ctx), params as never)),
  });

  pi.registerTool({
    name: "retrieval_auto_transition",
    label: "Retrieval autopilot transition",
    description:
      "Prepare the exact gate-transition proposal (full review binding over the verified recorded worker) or commit it with your rationale. Commit recomputes the binding and refuses any byte difference, enforces the per-gate revise and per-run launch caps, and records the decision in the run ledger.",
    parameters: Type.Object({
      action: StringEnum(["prepare", "commit"]),
      decision: Type.Optional(StringEnum(["approve", "revise", "block", "not_applicable"])),
      reason: Type.Optional(Type.String()),
      rationale: Type.Optional(Type.String()),
    }),
    execute: async (_id, params, _signal, _onUpdate, ctx) =>
      asResult(await core.transitionAction(operatorContext(ctx), params as never)),
  });
}
