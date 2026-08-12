import type { TuiPlugin, TuiPluginApi } from "@opencode-ai/plugin/tui";
import { runNextCommand, runStartCommand } from "../retrieval_agent_harness_phase_based/plugin-runtime.mjs";
import {
  errorText,
  launchGateSession,
  quiesceGateSession,
  retireQuiescedGateSession,
  retireGateSession,
  type GateLaunchPacket as LaunchPacket,
  type GateSessionClient,
  type GateSessionReference,
} from "./retrieval-gate-session.ts";

type Decision = "approve" | "revise" | "block" | "not_applicable";

interface DialogOption<Value> {
  title: string;
  value: Value;
  description?: string;
}

interface GateReview {
  gate: { id: string; title: string };
  attempt: {
    result_path: string;
    session?: { host?: string; id?: string; mode?: "manual" | "meta" };
  };
  allowed_human_decisions: Decision[];
  result: {
    recommendation: Decision;
    summary: string;
    artifacts: Array<{ path: string; role: string }>;
    evidence: Array<{ path: string; supports: string }>;
    uncertainties: string[];
    blockers: string[];
  };
}

interface RuntimeAttempt {
  gate_id: string;
  number: number;
  launch_id: string;
  result_path: string;
  delivery_status: "pending" | "delivered";
  session?: { host?: string; id?: string; mode?: "manual" | "meta" };
}

interface RunReference {
  state: {
    run_id: string;
    active_gate_id: string | null;
    current_attempt?: RuntimeAttempt | null;
  };
}

type WorkflowOutcome =
  | { kind: "launched"; packet: LaunchPacket; run: RunReference }
  | { kind: "invalid"; review: { error: string }; run: RunReference }
  | { kind: "no_run"; run?: undefined }
  | {
      kind:
        | "blocked"
        | "cancelled"
        | "complete"
        | "delivery_pending"
        | "idle"
        | "missing"
        | "needs_start"
        | "not_started"
        | "ready"
        | "stopped";
      run: RunReference;
    };

const TITLE = "Retrieval agent workflow";

let commandBusy = false;

function notify(
  api: TuiPluginApi,
  message: string,
  variant: "info" | "success" | "warning" | "error" = "info",
  duration = 10_000,
): void {
  api.ui.toast({ title: TITLE, message, variant, duration });
}

function finishDialog<Value>(
  api: TuiPluginApi,
  resolve: (value: Value | undefined) => void,
): (value: Value | undefined) => void {
  let settled = false;
  return (value) => {
    if (settled) return;
    settled = true;
    resolve(value);
    api.ui.dialog.clear();
  };
}

function confirm(api: TuiPluginApi, title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const finish = finishDialog<boolean>(api, (value) => resolve(value ?? false));
    api.ui.dialog.replace(
      () => api.ui.DialogConfirm({
        title,
        message,
        onConfirm: () => finish(true),
        onCancel: () => finish(false),
      }),
      () => finish(undefined),
    );
  });
}

function promptText(
  api: TuiPluginApi,
  title: string,
  placeholder: string,
  value = "",
): Promise<string | undefined> {
  return new Promise((resolve) => {
    const finish = finishDialog<string>(api, resolve);
    api.ui.dialog.replace(
      () => api.ui.DialogPrompt({
        title,
        placeholder,
        value,
        onConfirm: finish,
        onCancel: () => finish(undefined),
      }),
      () => finish(undefined),
    );
  });
}

function selectDecision(api: TuiPluginApi, review: GateReview): Promise<Decision | undefined> {
  const allOptions: DialogOption<Decision>[] = [
    { title: "Approve", value: "approve", description: "Accept this gate and continue." },
    { title: "Revise", value: "revise", description: "Reopen this gate in a fresh session." },
    { title: "Block", value: "block", description: "Pause the run at this gate." },
    {
      title: "Not applicable",
      value: "not_applicable",
      description: "Skip this gate with a recorded reason.",
    },
  ];
  const options = allOptions.filter((option) =>
    review.allowed_human_decisions.includes(option.value)
  );
  return new Promise((resolve) => {
    const finish = finishDialog<Decision>(api, resolve);
    api.ui.dialog.replace(
      () => api.ui.DialogSelect<Decision>({
        title: `${review.gate.id}: choose the human decision`,
        placeholder: "Choose one of this gate's catalog decisions",
        options,
        skipFilter: true,
        onSelect: (option) => finish(option.value),
      }),
      () => finish(undefined),
    );
  });
}

function beginCommand(api: TuiPluginApi): boolean {
  if (commandBusy) {
    notify(api, "Another retrieval workflow command is still open.", "warning");
    return false;
  }
  commandBusy = true;
  return true;
}

function launcher(api: TuiPluginApi, projectRoot: string) {
  let sessionID: string | undefined;

  return {
    get sessionID(): string | undefined {
      return sessionID;
    },
    async launch(
      packet: LaunchPacket,
      recordSession: (session: GateSessionReference) => Promise<void>,
    ): Promise<GateSessionReference> {
      const launched = await launchGateSession({
        client: api.client as unknown as GateSessionClient,
        directory: projectRoot,
        packet,
        sessionMode: "manual",
        recordSession: async (session) => {
          sessionID = session.id;
          await recordSession(session);
        },
      });
      return launched;
    },
  };
}

function openLaunchedSession(
  api: TuiPluginApi,
  launched: ReturnType<typeof launcher>,
  gateID?: string,
): void {
  if (!launched.sessionID) return;
  api.route.navigate("session", { sessionID: launched.sessionID });
  notify(
    api,
    `${gateID ?? "Gate"} opened in a fresh root session using the configured OpenCode default model. ` +
      "Finish it, then run /retrieval-phase-next.",
    "success",
    12_000,
  );
}

function compactText(value: string, limit: number): string {
  const singleLine = value.replace(/\s+/g, " ").trim();
  return singleLine.length <= limit
    ? singleLine
    : `${singleLine.slice(0, limit - 1)}…`;
}

function compactSection(
  label: string,
  values: string[],
  itemLimit: number,
  characterLimit: number,
): string {
  if (!values.length) return `${label}: none`;
  const shown = values
    .slice(0, itemLimit)
    .map((value) => compactText(value, characterLimit));
  const omitted = values.length - shown.length;
  return [
    `${label}: ${shown.join("; ")}`,
    omitted ? `(+${omitted} more in gate-result.json)` : "",
  ].filter(Boolean).join("; ");
}

export function reviewText(review: GateReview): string {
  return [
    `${compactText(review.gate.id, 40)} — ${compactText(review.gate.title, 140)}`,
    `Recommendation: ${review.result.recommendation.replace("_", " ")}`,
    compactSection("Blockers", review.result.blockers, 3, 160),
    `Summary: ${compactText(review.result.summary, 420)}`,
    compactSection(
      "Evidence",
      review.result.evidence.map((item) => `${item.path} — ${item.supports}`),
      3,
      220,
    ),
    compactSection(
      "Artifacts",
      review.result.artifacts.map((item) => item.path),
      6,
      140,
    ),
    compactSection("Uncertainties", review.result.uncertainties, 3, 160),
    `Full result: ${compactText(review.attempt.result_path, 180)}`,
  ].join("\n");
}

function displayReview(api: TuiPluginApi, review: GateReview): void {
  notify(
    api,
    reviewText(review),
    review.result.blockers.length ? "warning" : "info",
    20_000,
  );
}

async function startWorkflow(input: {
  repoRoot: string;
  launch: ReturnType<typeof launcher>["launch"];
  intake?: { targetRepoPath: string; initialIdea: string };
  resumeReason?: string;
  recoverPendingLaunch?: boolean;
  confirmPendingDelivery?: boolean;
  expectedPendingLaunch?: RuntimeAttempt | null;
  retirePendingSession?: (session: NonNullable<RuntimeAttempt["session"]>) => Promise<void>;
}): Promise<WorkflowOutcome> {
  return await runStartCommand({
    repoRoot: input.repoRoot,
    host: "opencode",
    intake: input.intake,
    launch: input.launch,
    resumeReason: input.resumeReason,
    recoverPendingLaunch: input.recoverPendingLaunch,
    confirmPendingDelivery: input.confirmPendingDelivery,
    expectedPendingLaunch: input.expectedPendingLaunch,
    sessionMode: "manual",
    retirePendingSession: input.retirePendingSession,
  }) as WorkflowOutcome;
}

async function handleStart(api: TuiPluginApi): Promise<void> {
  if (!beginCommand(api)) return;
  try {
    const projectRoot = api.state.path.directory;
    let launched = launcher(api, projectRoot);
    let outcome = await startWorkflow({
      repoRoot: projectRoot,
      launch: launched.launch,
    });

    if (outcome.kind === "no_run") {
      const targetRepoPath = await promptText(
        api,
        "Where is your agent repository?",
        "Use . for the current OpenCode project.",
        ".",
      );
      if (!targetRepoPath?.trim()) {
        notify(api, "Cancelled. No run state changed.");
        return;
      }
      const initialIdea = await promptText(
        api,
        "What should the enterprise retrieval agent being built do?",
        "Describe the users, outcome, inputs, constraints, and important behavior.",
      );
      if (!initialIdea?.trim()) {
        notify(api, "Cancelled. No run state changed.");
        return;
      }
      launched = launcher(api, projectRoot);
      outcome = await startWorkflow({
        repoRoot: projectRoot,
        intake: { targetRepoPath, initialIdea },
        launch: launched.launch,
      });
    } else if (outcome.kind === "delivery_pending") {
      const pending = outcome.run.state.current_attempt?.session;
      const delivered = await confirm(
        api,
        `Was kickoff delivered for ${outcome.run.state.active_gate_id}?`,
        `Inspect recorded session ${pending?.id ?? "(unknown)"}. Confirm only if the gate prompt is present; the runtime will mark delivery without launching anything else.`,
      );
      if (delivered) {
        outcome = await startWorkflow({
          repoRoot: projectRoot,
          launch: launched.launch,
          confirmPendingDelivery: true,
          expectedPendingLaunch: outcome.run.state.current_attempt,
        });
      } else {
        const retry = await confirm(
          api,
          `Retry undelivered kickoff for ${outcome.run.state.active_gate_id}?`,
          "Confirm only when inspection shows no gate turn is running and kickoff was not delivered; the old session's write authority will be retired before a fresh session is created.",
        );
        if (!retry) {
          notify(api, "The uncertain kickoff remains fail-closed.", "warning");
          return;
        }
        outcome = await startWorkflow({
          repoRoot: projectRoot,
          launch: launched.launch,
          resumeReason: "The human inspected the recorded session and confirmed that kickoff was not delivered.",
          recoverPendingLaunch: true,
          expectedPendingLaunch: outcome.run.state.current_attempt,
          retirePendingSession: async (session) => {
            if (session.host !== "opencode" || !session.id) {
              throw new Error("The pending attempt is not bound to a revocable OpenCode session.");
            }
            await retireGateSession(
              api.client as unknown as GateSessionClient,
              projectRoot,
              session.id,
            );
          },
        });
      }
    } else if (outcome.kind === "blocked") {
      const resume = await confirm(
        api,
        `Resume blocked gate ${outcome.run.state.active_gate_id}?`,
        "A fresh root session will reopen the gate with your direction.",
      );
      if (resume) {
        const resumeReason = (
          await promptText(
            api,
            "What should the gate address before continuing?",
            "Give the reopened gate one concise direction.",
          )
        )?.trim();
        if (!resumeReason) {
          notify(api, "Cancelled. The run remains blocked.");
          return;
        }
        launched = launcher(api, projectRoot);
        outcome = await startWorkflow({
          repoRoot: projectRoot,
          resumeReason,
          launch: launched.launch,
        });
      }
    }

    if (outcome.kind === "launched") {
      openLaunchedSession(api, launched, outcome.packet.gate.id);
      return;
    }
    switch (outcome.kind) {
      case "complete":
        notify(api, `Run ${outcome.run.state.run_id} is complete.`, "success");
        return;
      case "blocked":
        notify(api, "The run remains blocked. No state changed.", "warning");
        return;
      case "stopped":
        notify(api, "The run is stopped.", "warning");
        return;
      case "idle":
        notify(api, "The run is between gates. Run /retrieval-phase-next to continue.");
        return;
      case "delivery_pending":
        notify(api, "Gate kickoff delivery is uncertain. Run /retrieval-phase to inspect and recover it.", "warning");
        return;
      case "ready":
        notify(api, "The active gate has a result ready. Run /retrieval-phase-next to review it.");
        return;
      case "missing":
      case "not_started":
        notify(
          api,
          `${outcome.run.state.active_gate_id} is still active. Finish its session, then run /retrieval-phase-next.`,
        );
        return;
      case "invalid":
        notify(api, `The gate result is invalid: ${outcome.review.error}`, "error", 20_000);
        return;
      case "needs_start":
        notify(api, "Run /retrieval-phase to launch the first gate.");
        return;
    }
  } finally {
    commandBusy = false;
  }
}

async function handleNext(api: TuiPluginApi): Promise<void> {
  if (!beginCommand(api)) return;
  try {
    const projectRoot = api.state.path.directory;
    const launched = launcher(api, projectRoot);
    const outcome = await runNextCommand({
      repoRoot: projectRoot,
      host: "opencode",
      sessionMode: "manual",
      launch: launched.launch,
      display: async (review: GateReview) => displayReview(api, review),
      decide: async (review: GateReview) => {
        const decision = await selectDecision(api, review);
        if (!decision) return null;
        if (decision === "approve") return { decision };
        const reason = (
          await promptText(api, `Reason for ${decision.replace("_", " ")}`, "A short reason is required.")
        )?.trim();
        return reason ? { decision, reason } : null;
      },
      beforeDecisionCommit: async (_run: unknown, review: GateReview) => {
        const session = review.attempt.session;
        if (
          session?.host !== "opencode" ||
          typeof session.id !== "string" ||
          (session.mode ?? "manual") !== "manual"
        ) {
          throw new Error("The reviewed attempt is not bound to a revocable OpenCode session.");
        }
        await quiesceGateSession(
          api.client as unknown as GateSessionClient,
          projectRoot,
          session.id,
        );
      },
      afterReviewSnapshot: async (_run: unknown, review: GateReview) => {
        const sessionID = review.attempt.session?.id;
        if (!sessionID) {
          throw new Error("The reviewed OpenCode session is missing after quiescence.");
        }
        await retireQuiescedGateSession(
          api.client as unknown as GateSessionClient,
          projectRoot,
          sessionID,
        );
      },
      afterDecision: async () => {
        notify(api, "Decision recorded. Applying the selected transition.", "success");
      },
    }) as WorkflowOutcome;

    if (outcome.kind === "launched") {
      openLaunchedSession(api, launched, outcome.packet.gate.id);
      return;
    }
    switch (outcome.kind) {
      case "no_run":
        notify(api, "No run exists. Run /retrieval-phase to start one.");
        return;
      case "complete":
        notify(api, `Run ${outcome.run.state.run_id} is complete.`, "success");
        return;
      case "blocked":
        notify(api, "The run is blocked. Run /retrieval-phase to review and resume it.", "warning");
        return;
      case "stopped":
        notify(api, "The run is stopped.", "warning");
        return;
      case "cancelled":
        notify(api, "Cancelled. No decision or state changed.");
        return;
      case "missing":
      case "not_started":
        notify(api, "The active gate has not written gate-result.json yet.");
        return;
      case "invalid":
        notify(api, `The gate result is invalid: ${outcome.review.error}`, "error", 20_000);
        return;
      case "needs_start":
        notify(api, "The first gate has not launched. Run /retrieval-phase.");
        return;
      case "idle":
      case "ready":
        notify(api, "Run /retrieval-phase-next again to continue.");
        return;
      case "delivery_pending":
        notify(api, "Gate kickoff delivery is uncertain. Run /retrieval-phase to inspect and recover it.", "warning");
        return;
    }
  } finally {
    commandBusy = false;
  }
}

export const tui: TuiPlugin = async (api) => {
  api.keymap.registerLayer({
    priority: 1_000,
    commands: [
      {
        name: "retrieval.phase",
        title: "Retrieval agent workflow: start, status, or resume",
        desc: "Start once, inspect status, or resume a blocked gate",
        category: "Retrieval agent workflow",
        namespace: "palette",
        slashName: "retrieval-phase",
        run: async () => {
          try {
            await handleStart(api);
          } catch (error) {
            notify(api, errorText(error), "error", 20_000);
          }
        },
      },
      {
        name: "retrieval.phase.next",
        title: "Retrieval agent workflow: review, decide, and transition",
        desc: "Validate and display the gate result, record your decision, and perform its transition",
        category: "Retrieval agent workflow",
        namespace: "palette",
        slashName: "retrieval-phase-next",
        run: async () => {
          try {
            await handleNext(api);
          } catch (error) {
            notify(api, errorText(error), "error", 20_000);
          }
        },
      },
    ],
  });
};

export default { id: "retrieval-agent-workflow", tui };
