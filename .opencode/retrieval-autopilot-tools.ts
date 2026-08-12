/**
 * Project-local OpenCode server plugin exposing the three autopilot tools to
 * the named `retrieval-autopilot` primary agent:
 *
 *   retrieval_auto_run        — run control (status / start / resume / recover)
 *   retrieval_auto_gate       — gate interaction (wait / read / send / replies / abort / release)
 *   retrieval_auto_transition — transition (prepare / commit)
 *
 * This is an authority variant of the meta-operator surface, not a second
 * implementation: every action body lives in retrieval-operator-tools.ts and is
 * selected by the "auto" surface, which swaps the human's exact-byte
 * confirmations for the operator agent's own recorded arguments, records each
 * authority action in the run's autopilot ledger, and keeps its supervisor
 * state under .opencode/.retrieval-auto/. The runtime, the model policy, the
 * gate-session boundary, and the revocation ordering are unchanged.
 */
import { tool, type Plugin } from "@opencode-ai/plugin";

import {
  gateAction,
  loadOperatorRuntime,
  OPERATOR_SURFACES,
  runAction,
  transitionAction,
  type OperatorRuntime,
} from "./retrieval-operator-tools.ts";

const SURFACE = OPERATOR_SURFACES.auto;

const server: Plugin = async (input) => {
  let runtimePromise: Promise<OperatorRuntime> | null = null;
  const runtimeFor = (): Promise<OperatorRuntime> => {
    runtimePromise ??= loadOperatorRuntime(input, "auto");
    return runtimePromise;
  };

  return {
    tool: {
      [SURFACE.runTool]: tool({
        description:
          "Retrieval autopilot run control: status of the run/worker/usage, start a run from the request the human stated, resume a blocked run once the human has said how to proceed, or recover an interrupted launch. Reserved for the retrieval-autopilot agent.",
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
      [SURFACE.gateTool]: tool({
        description:
          "Retrieval autopilot gate interaction: wait/read the configured background harness/gate model, send labeled advisory follow-ups, answer or reject the worker's questions yourself (cite approved-context for routine facts), approve or deny a shell request after reading its exact bytes, abort, or release an idle finished worker. Every answer and shell decision needs a rationale and is written to the run's autopilot ledger. Reserved for the retrieval-autopilot agent.",
        args: {
          action: tool.schema.enum([
            "wait",
            "read",
            "send",
            "question_reply",
            "question_reject",
            "permission_reply",
            "abort",
            "release",
          ]),
          message: tool.schema.string().optional(),
          requestId: tool.schema.string().optional(),
          answersJson: tool.schema.string().optional(),
          citedFactIds: tool.schema.array(tool.schema.string()).optional(),
          source: tool.schema.enum(["approved-context"]).optional(),
          approve: tool.schema.boolean().optional(),
          rationale: tool.schema.string().optional(),
          reason: tool.schema.string().optional(),
          afterMessageId: tool.schema.string().optional(),
          timeoutSeconds: tool.schema.number().optional(),
        },
        async execute(args, context) {
          return gateAction(await runtimeFor(), context, args);
        },
      }),
      [SURFACE.transitionTool]: tool({
        description:
          "Retrieval autopilot transition: prepare the exact decision proposal (full review binding over the verified recorded worker) or commit it with the rationale that records how you reached the decision. Commit recomputes the binding and refuses any byte that changed since prepare, atomically records the transition state, ledgers the decision, and launches the next gate through the runtime. Returns an escalation_required outcome instead of committing when a bounded-loop cap is reached. Reserved for the retrieval-autopilot agent.",
        args: {
          action: tool.schema.enum(["prepare", "commit"]),
          decision: tool.schema.enum(["approve", "revise", "block", "not_applicable"]).optional(),
          reason: tool.schema.string().optional(),
          rationale: tool.schema.string().optional(),
        },
        async execute(args, context) {
          return transitionAction(await runtimeFor(), context, args);
        },
      }),
    },
  };
};

export default { id: "retrieval-autopilot", server };
