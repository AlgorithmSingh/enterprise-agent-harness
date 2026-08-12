import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  FileMetaStateStore,
  InMemoryMetaStateStore,
  MetaSupervisor,
  type ModelRolePolicy,
} from "meta-harness";
import type { OpencodeClient } from "@opencode-ai/sdk/v2";

import { loadActiveRun } from "../retrieval_agent_harness_phase_based/plugin-runtime.mjs";
import { readAutopilotLedger } from "../retrieval_agent_harness_phase_based/autopilot-ledger.mjs";
import { OPERATOR_TOOL_IDS } from "./retrieval-gate-session.ts";
import {
  createOperatorRuntime,
  gateAction,
  OPERATOR_SURFACES,
  runAction,
  transitionAction,
} from "./retrieval-operator-tools.ts";

// This suite covers only what the auto surface does differently from the meta
// surface: agent-taken authorization, the run ledger, the unattended caps, and
// its own session mode and state location. Everything the two share is already
// covered by meta-operator-contract.test.ts.

const POLICY: ModelRolePolicy = {
  operator: null,
  gate: { provider: "prov", model: "cheap-gate" },
};
const AUTOPILOT_SESSION = "ses-autopilot";
const INITIAL_IDEA = "Build a small, safe Retrieval agent.";

interface FakeMessage {
  info: Record<string, unknown>;
  parts: unknown[];
}

class FakeClient {
  creates: Array<Record<string, unknown>> = [];
  prompts: Array<Record<string, unknown>> = [];
  updates: Array<Record<string, unknown>> = [];
  aborts: string[] = [];
  questionReplies: Array<Record<string, unknown>> = [];
  questionRejects: Array<Record<string, unknown>> = [];
  permissionReplies: Array<Record<string, unknown>> = [];
  questions: Array<Record<string, unknown>> = [];
  permissions: Array<Record<string, unknown>> = [];
  messagesBySession = new Map<string, FakeMessage[]>();
  statusBySession: Record<string, { type: string }> = {};
  beforeCreate: (() => Promise<void>) | null = null;
  #sessionCounter = 0;

  session = {
    create: async (parameters: Record<string, unknown>) => {
      await this.beforeCreate?.();
      this.creates.push(parameters);
      this.#sessionCounter += 1;
      return { data: { id: `ses-gate-${this.#sessionCounter}`, parentID: null } };
    },
    promptAsync: async (parameters: Record<string, unknown>) => {
      this.prompts.push(parameters);
      return { data: undefined, error: undefined };
    },
    update: async (parameters: Record<string, unknown>) => {
      this.updates.push(parameters);
      return { data: true, error: undefined };
    },
    messages: async (parameters: { sessionID: string }) => ({
      data: this.messagesBySession.get(parameters.sessionID) ?? [],
    }),
    status: async () => ({ data: this.statusBySession }),
    abort: async (parameters: { sessionID: string }) => {
      this.aborts.push(parameters.sessionID);
      return { data: true };
    },
  };

  question = {
    list: async () => ({ data: this.questions }),
    reply: async (parameters: Record<string, unknown>) => {
      this.questionReplies.push(parameters);
      this.questions = this.questions.filter((entry) => entry.id !== parameters.requestID);
      return { data: true };
    },
    reject: async (parameters: Record<string, unknown>) => {
      this.questionRejects.push(parameters);
      this.questions = this.questions.filter((entry) => entry.id !== parameters.requestID);
      return { data: true };
    },
  };

  permission = {
    list: async () => ({ data: this.permissions }),
    reply: async (parameters: Record<string, unknown>) => {
      this.permissionReplies.push(parameters);
      this.permissions = this.permissions.filter((entry) => entry.id !== parameters.requestID);
      return { data: true };
    },
  };
}

const WORKFLOW = {
  version: 2,
  workflow_id: "retrieval-agent-test-auto",
  commands: { start: "retrieval-phase", next: "retrieval-phase-next" },
  shared_prompt: "retrieval_agent_harness_phase_based/shared.md",
  phase_2_manifest: ".sequence/phase-2-manifest.json",
  repair: { gate_id: "BR", max_attempts: 2, return_to: "D02" },
  gates: [
    {
      id: "D01",
      title: "Repository intake and inventory",
      phase: "technical-design",
      agent_prompt: "retrieval_agent_harness_phase_based/agents/D01.md",
      required: true,
      required_artifacts: [".sequence/d01-notes.json"],
    },
    {
      id: "D02",
      title: "Outcome and acceptance contract",
      phase: "technical-design",
      agent_prompt: "retrieval_agent_harness_phase_based/agents/D02.md",
      required: true,
      required_artifacts: [],
    },
    {
      id: "BR",
      title: "Bounded repair",
      phase: "repair",
      agent_prompt: "retrieval_agent_harness_phase_based/agents/BR.md",
      required: false,
      required_artifacts: [],
      decision_routes: { approve: "D02" },
      max_attempts: 2,
    },
  ],
};

async function fixture(
  t: { after(fn: () => Promise<void> | void): void },
  options: { fileState?: boolean } = {}
) {
  const root = await mkdtemp(path.join(os.tmpdir(), "retrieval-auto-opencode-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const harness = path.join(root, "retrieval_agent_harness_phase_based");
  await mkdir(path.join(harness, "agents"), { recursive: true });
  await writeFile(path.join(harness, "shared.md"), "Shared test rules.\n");
  await writeFile(path.join(harness, "workflow.json"), `${JSON.stringify(WORKFLOW, null, 2)}\n`);
  for (const gate of WORKFLOW.gates) {
    await writeFile(
      path.join(root, gate.agent_prompt),
      [
        "---",
        `description: Test prompt for ${gate.id}`,
        "mode: primary",
        "permission:",
        "  edit: allow",
        "---",
        "",
        `# ${gate.id}: ${gate.title}`,
        "",
        "Exercise the OpenCode autopilot contract.",
        "",
      ].join("\n"),
    );
  }
  const client = new FakeClient();
  const supervisor = await MetaSupervisor.load({
    store: options.fileState
      ? new FileMetaStateStore(path.join(root, OPERATOR_SURFACES.auto.stateFile))
      : new InMemoryMetaStateStore(),
  });
  const runtime = createOperatorRuntime({
    client: client as unknown as OpencodeClient,
    directory: root,
    supervisor,
    policy: POLICY,
    surface: "auto",
    ...(options.fileState
      ? { recoveryStore: new FileMetaStateStore(path.join(root, OPERATOR_SURFACES.auto.recoveryFile)) }
      : {}),
  });
  return { root, client, supervisor, runtime };
}

function autoContext(
  overrides: Partial<{ sessionID: string; messageID: string; agent: string }> = {}
) {
  return {
    sessionID: AUTOPILOT_SESSION,
    messageID: "msg-current",
    agent: "retrieval-autopilot",
    directory: "ignored",
    ...overrides,
  };
}

/** Give a recorded gate session an assistant reply on the configured model. */
function exposeGateModel(client: FakeClient, sessionID: string) {
  client.messagesBySession.set(sessionID, [
    {
      info: {
        id: `${sessionID}-a1`,
        sessionID,
        role: "assistant",
        providerID: "prov",
        modelID: "cheap-gate",
        tokens: { input: 10, output: 5 },
        cost: 0.001,
      },
      parts: [],
    },
  ]);
}

async function startRun(
  runtime: ReturnType<typeof createOperatorRuntime>,
  expectedGate = "D01"
) {
  const output = JSON.parse(
    await runAction(runtime, autoContext(), {
      action: "start",
      targetRepoPath: runtime.directory,
      initialIdea: INITIAL_IDEA,
    })
  ) as { kind: string; launched_gate?: string };
  assert.equal(output.kind, "launched");
  assert.equal(output.launched_gate, expectedGate);
}

async function writeReadyResult(root: string, gateId: string) {
  const run = await loadActiveRun(root);
  assert.ok(run?.state.current_attempt, "an attempt must be active");
  const artifacts: Array<{ path: string; role: string }> = [];
  if (gateId === "D01") {
    await mkdir(path.join(root, ".sequence"), { recursive: true });
    await writeFile(path.join(root, ".sequence/d01-notes.json"), `{"notes":"d01"}\n`);
    artifacts.push({ path: ".sequence/d01-notes.json", role: "required output" });
  }
  await writeFile(path.join(root, "docs-notes.md"), "evidence body\n");
  const result = {
    gate_id: gateId,
    recommendation: "approve",
    summary: `${gateId} completed`,
    artifacts,
    evidence: [{ path: "docs-notes.md", supports: "inventory claims" }],
    uncertainties: [],
    blockers: [],
  };
  const resultAbsolute = path.join(run.runDir, run.state.current_attempt.result_path);
  await mkdir(path.dirname(resultAbsolute), { recursive: true });
  await writeFile(resultAbsolute, `${JSON.stringify(result, null, 2)}\n`);
}

/** Take one gate attempt from launched to released with a ready result. */
async function finishAttempt(
  runtime: ReturnType<typeof createOperatorRuntime>,
  client: FakeClient,
  root: string,
  sessionID: string,
  gateId: string
) {
  exposeGateModel(client, sessionID);
  await writeReadyResult(root, gateId);
  const released = JSON.parse(
    await gateAction(runtime, autoContext(), { action: "release", reason: "result ready" })
  ) as { outcome: string };
  assert.equal(released.outcome, "released");
}

async function commitDecision(
  runtime: ReturnType<typeof createOperatorRuntime>,
  decision: "approve" | "revise" | "block" | "not_applicable",
  reason: string | null,
  rationale: string
) {
  const prepared = JSON.parse(
    await transitionAction(runtime, autoContext({ messageID: "msg-prepare" }), {
      action: "prepare",
      decision,
      ...(reason ? { reason } : {}),
    })
  ) as { outcome: string };
  assert.equal(prepared.outcome, "prepared");
  return JSON.parse(
    await transitionAction(runtime, autoContext({ messageID: "msg-commit" }), {
      action: "commit",
      rationale,
    })
  ) as Record<string, unknown>;
}

async function ledgerEntries(root: string): Promise<Array<Record<string, unknown>>> {
  const run = await loadActiveRun(root);
  assert.ok(run, "a run must exist before its ledger is read");
  return (await readAutopilotLedger(run.runDir)) as Array<Record<string, unknown>>;
}

function entriesOf(entries: Array<Record<string, unknown>>, event: string) {
  return entries.filter((entry) => entry.event === event);
}

async function adoptRequest(
  runtime: ReturnType<typeof createOperatorRuntime>,
  expected: "question" | "permission"
) {
  const adopted = JSON.parse(
    await gateAction(runtime, autoContext(), { action: "wait", timeoutSeconds: 1 })
  ) as { outcome: string; request: { requestId: string; payload: string } };
  assert.equal(adopted.outcome, expected);
  return adopted.request;
}

test("the auto tools are reserved for the autopilot agent alone", async (t) => {
  const { runtime } = await fixture(t);
  for (const agent of ["retrieval-operator", "gate-d01"]) {
    await assert.rejects(
      runAction(runtime, autoContext({ agent }), { action: "status" }),
      /reserved for the retrieval-autopilot agent/
    );
    await assert.rejects(
      gateAction(runtime, autoContext({ agent }), { action: "read" }),
      /reserved for the retrieval-autopilot agent/
    );
    await assert.rejects(
      transitionAction(runtime, autoContext({ agent }), { action: "prepare", decision: "approve" }),
      /reserved for the retrieval-autopilot agent/
    );
  }
});

test("the meta surface still refuses the autopilot agent", async (t) => {
  const { root, client, supervisor } = await fixture(t);
  const metaRuntime = createOperatorRuntime({
    client: client as unknown as OpencodeClient,
    directory: root,
    supervisor,
    policy: POLICY,
  });
  assert.equal(metaRuntime.surface.id, "meta", "the default surface stays meta");
  await assert.rejects(
    runAction(metaRuntime, autoContext(), { action: "status" }),
    /reserved for the retrieval-operator agent/
  );
});

test("gate sessions deny every supervised operator tool id", async (t) => {
  const { runtime, client } = await fixture(t);
  await startRun(runtime);
  const rules = (client.creates[0] ?? {}).permission as Array<{
    permission: string;
    action: string;
  }>;
  assert.deepEqual(
    [...OPERATOR_TOOL_IDS].sort(),
    [
      "retrieval_auto_gate",
      "retrieval_auto_run",
      "retrieval_auto_transition",
      "retrieval_meta_gate",
      "retrieval_meta_run",
      "retrieval_meta_transition",
    ]
  );
  for (const toolID of OPERATOR_TOOL_IDS) {
    assert.ok(
      rules.some((rule) => rule.permission === toolID && rule.action === "deny"),
      `a gate session must deny ${toolID}`
    );
  }

  // Retirement keeps the same denial set after the gate loses its authority.
  await gateAction(runtime, autoContext(), { action: "abort", reason: "test retirement" });
  const retired = (client.updates[0] ?? {}).permission as Array<{
    permission: string;
    action: string;
  }>;
  for (const toolID of OPERATOR_TOOL_IDS) {
    assert.ok(
      retired.some((rule) => rule.permission === toolID && rule.action === "deny"),
      `a retired gate session must deny ${toolID}`
    );
  }
});

test("an auto run drives every gate to completion and ledgers each decision", async (t) => {
  const { runtime, client, root } = await fixture(t);
  await startRun(runtime);

  const create = client.creates[0] ?? {};
  assert.equal((create.metadata as Record<string, unknown>).session_mode, "auto");
  assert.deepEqual(create.model, { id: "cheap-gate", providerID: "prov" });
  const started = await loadActiveRun(root);
  assert.equal(started?.state.current_attempt?.session.mode, "auto");

  const waited = JSON.parse(
    await gateAction(runtime, autoContext(), { action: "wait", timeoutSeconds: 1 })
  ) as { outcome: string; review: { status: string } | null };
  assert.equal(waited.outcome, "idle");
  assert.equal(waited.review?.status, "missing", "no gate result exists yet");

  await finishAttempt(runtime, client, root, "ses-gate-1", "D01");
  const approved = await commitDecision(
    runtime,
    "approve",
    null,
    "Read .sequence/d01-notes.json and docs-notes.md directly; the inventory claims match the files."
  );
  assert.equal(approved.kind, "launched");
  assert.equal(approved.launched_gate, "D02");
  assert.equal(approved.decision_committed, true);

  const afterD01 = await loadActiveRun(root);
  assert.equal(afterD01?.state.last_decision?.decided_by_mode, "auto");
  assert.equal(afterD01?.state.last_decision?.gate_id, "D01");

  await finishAttempt(runtime, client, root, "ses-gate-2", "D02");
  const completed = await commitDecision(
    runtime,
    "approve",
    null,
    "The acceptance contract names its oracle and the evidence file records the run."
  );
  assert.equal(completed.kind, "complete");
  const finished = await loadActiveRun(root);
  assert.equal(finished?.state.status, "complete");
  assert.equal(finished?.state.last_decision?.decided_by_mode, "auto");

  const entries = await ledgerEntries(root);
  const started_ = entriesOf(entries, "run_started");
  assert.equal(started_.length, 1);
  assert.equal(started_[0].initial_idea, INITIAL_IDEA);
  assert.equal(started_[0].target_repo_path, root);
  assert.match(String(started_[0].recorded_at), /^\d{4}-\d{2}-\d{2}T/);

  const decisions = entriesOf(entries, "gate_decision");
  assert.deepEqual(
    decisions.map((entry) => [entry.gate_id, entry.decision, entry.attempt]),
    [
      ["D01", "approve", 1],
      ["D02", "approve", 1],
    ]
  );
  assert.equal(decisions[0].agent_recommendation, "approve");
  assert.match(String(decisions[0].review_manifest_sha256), /^[0-9a-f]{64}$/);
  assert.match(String(decisions[0].rationale), /inventory claims match the files/);
  assert.deepEqual(entriesOf(entries, "worker_released").map((entry) => entry.gate_id), [
    "D01",
    "D02",
  ]);
});

test("commit without a rationale is refused and leaves no decision behind", async (t) => {
  const { runtime, client, root } = await fixture(t);
  await startRun(runtime);
  await finishAttempt(runtime, client, root, "ses-gate-1", "D01");
  const prepared = JSON.parse(
    await transitionAction(runtime, autoContext({ messageID: "msg-prepare" }), {
      action: "prepare",
      decision: "approve",
    })
  ) as { outcome: string; note: string };
  assert.equal(prepared.outcome, "prepared");
  assert.match(prepared.note, /rationale/);
  await assert.rejects(
    transitionAction(runtime, autoContext({ messageID: "msg-commit" }), { action: "commit" }),
    /commit requires a rationale/
  );
  assert.equal((await loadActiveRun(root))?.state.last_decision ?? null, null);
});

test("the operator answers a worker question itself and ledgers the answer", async (t) => {
  const { runtime, client, root } = await fixture(t);
  await startRun(runtime);
  client.questions = [
    {
      id: "q-worker",
      sessionID: "ses-gate-1",
      questions: [{ question: "Which repository do I inventory?", header: "repo" }],
    },
  ];
  const request = await adoptRequest(runtime, "question");
  const answers = [["Inventory the target repository recorded in the kickoff facts."]];

  await assert.rejects(
    gateAction(runtime, autoContext(), {
      action: "question_reply",
      requestId: request.requestId,
      answersJson: JSON.stringify(answers),
      rationale: "It follows from the kickoff.",
      source: "human",
    }),
    /the auto surface answers as the operator/
  );
  await assert.rejects(
    gateAction(runtime, autoContext(), {
      action: "question_reply",
      requestId: request.requestId,
      answersJson: JSON.stringify(answers),
    }),
    /requires a rationale/
  );
  assert.equal(client.questionReplies.length, 0);

  const answered = JSON.parse(
    await gateAction(runtime, autoContext(), {
      action: "question_reply",
      requestId: request.requestId,
      answersJson: JSON.stringify(answers),
      rationale: "The kickoff intake names the target repository; no scope change is implied.",
    })
  ) as { outcome: string; source: string };
  assert.equal(answered.outcome, "answered");
  assert.equal(answered.source, "auto-operator");
  assert.deepEqual(client.questionReplies[0], {
    requestID: "q-worker",
    directory: root,
    answers,
  });

  const logged = entriesOf(await ledgerEntries(root), "question_answered");
  assert.equal(logged.length, 1);
  assert.equal(logged[0].gate_id, "D01");
  assert.equal(logged[0].attempt, 1);
  assert.equal(logged[0].request_id, request.requestId);
  assert.equal(logged[0].source, "auto-operator");
  assert.equal(logged[0].answer, JSON.stringify(answers));
});

test("a routine answer may still cite approved context", async (t) => {
  const { runtime, client, root } = await fixture(t);
  await startRun(runtime);
  const run = await loadActiveRun(root);
  assert.ok(run);
  const facts = runtime.supervisor.listFacts({ runId: run.state.run_id });
  const kickoff = facts.find((fact) => fact.text.includes("Kickoff target repository"));
  assert.ok(kickoff, "start seeds kickoff facts in the auto surface too");
  client.questions = [
    { id: "q-fact", sessionID: "ses-gate-1", questions: [{ question: "Target repo?", header: "repo" }] },
  ];
  const request = await adoptRequest(runtime, "question");
  const answered = JSON.parse(
    await gateAction(runtime, autoContext(), {
      action: "question_reply",
      requestId: request.requestId,
      answersJson: JSON.stringify([[kickoff.text]]),
      citedFactIds: [kickoff.id],
      source: "approved-context",
      rationale: "Routine fact already approved for this run.",
    })
  ) as { outcome: string; source: string; citedFactIds: string[] };
  assert.equal(answered.outcome, "answered");
  assert.equal(answered.source, "approved-context");
  assert.deepEqual(answered.citedFactIds, [kickoff.id]);
  const logged = entriesOf(await ledgerEntries(root), "question_answered");
  assert.equal(logged[0].source, "approved-context");
  assert.deepEqual(logged[0].cited_fact_ids, [kickoff.id]);
});

test("shell approval and denial each relay to the host and ledger the payload digest", async (t) => {
  const { runtime, client, root } = await fixture(t);
  await startRun(runtime);
  const approvedRequest = {
    id: "perm-1",
    sessionID: "ses-gate-1",
    permission: "bash",
    patterns: ["python -m pytest"],
    metadata: { command: "python -m pytest" },
    always: [],
  };
  client.permissions = [approvedRequest];
  const pending = await adoptRequest(runtime, "permission");

  await assert.rejects(
    gateAction(runtime, autoContext(), {
      action: "permission_reply",
      requestId: pending.requestId,
      rationale: "Looks fine.",
    }),
    /requires approve \(true or false\)/
  );
  await assert.rejects(
    gateAction(runtime, autoContext(), {
      action: "permission_reply",
      requestId: pending.requestId,
      approve: true,
    }),
    /requires a rationale/
  );
  await assert.rejects(
    gateAction(runtime, autoContext(), {
      action: "permission_reject",
      requestId: pending.requestId,
      reason: "no",
    }),
    /denies a shell request through permission_reply/
  );
  assert.equal(client.permissionReplies.length, 0);

  const approved = JSON.parse(
    await gateAction(runtime, autoContext(), {
      action: "permission_reply",
      requestId: pending.requestId,
      approve: true,
      rationale: "Runs the declared test suite in the repository root and writes nothing outside it.",
    })
  ) as { outcome: string };
  assert.equal(approved.outcome, "approved_once");
  assert.deepEqual(client.permissionReplies[0], {
    requestID: "perm-1",
    directory: root,
    reply: "once",
  });

  const deniedRequest = {
    id: "perm-2",
    sessionID: "ses-gate-1",
    permission: "bash",
    patterns: ["git push --force origin main"],
    metadata: { command: "git push --force origin main" },
    always: [],
  };
  client.permissions = [deniedRequest];
  const second = await adoptRequest(runtime, "permission");
  const denial = "Publishing and force-rewriting history is outside this gate's authority; record the finding instead.";
  const denied = JSON.parse(
    await gateAction(runtime, autoContext(), {
      action: "permission_reply",
      requestId: second.requestId,
      approve: false,
      rationale: denial,
    })
  ) as { outcome: string };
  assert.equal(denied.outcome, "rejected");
  assert.deepEqual(client.permissionReplies[1], {
    requestID: "perm-2",
    directory: root,
    reply: "reject",
    message: denial,
  });

  const entries = await ledgerEntries(root);
  const logged = entriesOf(entries, "shell_approval");
  assert.equal(logged.length, 2);
  assert.equal(logged[0].approved, true);
  assert.equal(
    logged[0].payload_sha256,
    createHash("sha256").update(pending.payload).digest("hex")
  );
  assert.equal(logged[1].approved, false);
  assert.equal(logged[1].rationale, denial);
  assert.equal(
    logged[1].payload_sha256,
    createHash("sha256").update(second.payload).digest("hex")
  );

  // The ledger binds a command by digest; the bytes themselves stay in the
  // host request, so an audit trail can never become a replayable script.
  const ledgerText = JSON.stringify(entries);
  assert.equal(ledgerText.includes("python -m pytest"), false);
  assert.equal(ledgerText.includes("git push --force origin main"), false);
});

test("no auto-surface resolution is ever recorded as the human's", async (t) => {
  const { runtime, client, root, supervisor } = await fixture(t);
  await startRun(runtime);
  const run = await loadActiveRun(root);
  assert.ok(run);
  const kickoff = runtime.supervisor
    .listFacts({ runId: run.state.run_id })
    .find((fact) => fact.text.includes("Kickoff target repository"));
  assert.ok(kickoff);

  client.questions = [
    { id: "q-1", sessionID: "ses-gate-1", questions: [{ question: "Scope?", header: "scope" }] },
  ];
  let request = await adoptRequest(runtime, "question");
  await gateAction(runtime, autoContext(), {
    action: "question_reply",
    requestId: request.requestId,
    answersJson: JSON.stringify([["Stay inside the approved design."]]),
    rationale: "The approved design already answers this.",
  });

  client.questions = [
    { id: "q-2", sessionID: "ses-gate-1", questions: [{ question: "Repo?", header: "repo" }] },
  ];
  request = await adoptRequest(runtime, "question");
  await gateAction(runtime, autoContext(), {
    action: "question_reply",
    requestId: request.requestId,
    answersJson: JSON.stringify([[kickoff.text]]),
    citedFactIds: [kickoff.id],
    source: "approved-context",
    rationale: "Routine fact already approved for this run.",
  });

  client.questions = [
    { id: "q-3", sessionID: "ses-gate-1", questions: [{ question: "Widen scope?", header: "scope" }] },
  ];
  request = await adoptRequest(runtime, "question");
  await gateAction(runtime, autoContext(), {
    action: "question_reject",
    requestId: request.requestId,
    reason: "Changing the completion boundary is the human's decision.",
  });

  client.permissions = [
    {
      id: "perm-1",
      sessionID: "ses-gate-1",
      permission: "bash",
      patterns: ["ls .sequence"],
      metadata: { command: "ls .sequence" },
      always: [],
    },
  ];
  request = await adoptRequest(runtime, "permission");
  await gateAction(runtime, autoContext(), {
    action: "permission_reply",
    requestId: request.requestId,
    approve: true,
    rationale: "Lists one directory inside the repository and writes nothing.",
  });

  const persisted = supervisor
    .snapshot()
    .requestLog.map((entry) => entry.resolution?.source ?? null);
  assert.deepEqual(persisted, [
    "operator-reject",
    "approved-context",
    "operator-reject",
    "operator-reject",
  ]);
  assert.equal(
    persisted.includes("human"),
    false,
    "an operator-authored resolution must never claim the human's authority"
  );

  // The precise authorship lives in the ledger, which has no closed vocabulary.
  const answered = entriesOf(await ledgerEntries(root), "question_answered");
  assert.deepEqual(answered.map((entry) => entry.source), [
    "auto-operator",
    "approved-context",
    "operator-reject",
  ]);
});

test("a third revise is refused as a revise-cap escalation", async (t) => {
  const { runtime, client, root } = await fixture(t);
  await startRun(runtime);
  for (const [index, session] of ["ses-gate-1", "ses-gate-2"].entries()) {
    await finishAttempt(runtime, client, root, session, "D01");
    const revised = await commitDecision(
      runtime,
      "revise",
      `tighten the inventory evidence (round ${index + 1})`,
      `Checked the declared evidence against the files; round ${index + 1} still overstates coverage.`
    );
    assert.equal(revised.kind, "launched");
    assert.equal(revised.launched_gate, "D01");
  }
  const run = await loadActiveRun(root);
  assert.equal(run?.state.attempts.D01, 3, "two revises consumed two extra attempts");

  await finishAttempt(runtime, client, root, "ses-gate-3", "D01");
  const capped = await commitDecision(
    runtime,
    "revise",
    "one more pass",
    "A third unattended revise would exceed the plan."
  );
  assert.equal(capped.outcome, "escalation_required");
  assert.equal(capped.kind, "revise_cap");
  assert.match(String(capped.detail), /D01 has already used 3 attempts/);
  assert.equal(client.creates.length, 3, "no fourth D01 session was launched");
  assert.equal((await loadActiveRun(root))?.state.last_decision?.attempt, 2);

  const entries = await ledgerEntries(root);
  const escalations = entriesOf(entries, "escalation");
  assert.equal(escalations.length, 1);
  assert.equal(escalations[0].kind, "revise_cap");
  assert.equal(entriesOf(entries, "gate_decision").length, 2, "the capped revise was not ledgered as a decision");

  // The agent's remaining move is to block, and that still commits.
  const blocked = await commitDecision(
    runtime,
    "block",
    "three attempts did not produce verifiable inventory evidence",
    "Escalating: the gate cannot satisfy its contract with the evidence available."
  );
  assert.equal(blocked.kind, "blocked");
});

test("a decision that commits before a failed next launch is still ledgered", async (t) => {
  const { runtime, client, root } = await fixture(t);
  await startRun(runtime);
  await finishAttempt(runtime, client, root, "ses-gate-1", "D01");
  client.beforeCreate = async () => {
    client.beforeCreate = null;
    throw new Error("simulated create failure");
  };
  await assert.rejects(
    commitDecision(runtime, "approve", null, "Read both declared files; the inventory checks out."),
    /simulated create failure/
  );
  const run = await loadActiveRun(root);
  assert.equal(run?.state.last_decision?.gate_id, "D01");
  assert.equal(run?.state.last_decision?.decided_by_mode, "auto");
  const decisions = entriesOf(await ledgerEntries(root), "gate_decision");
  assert.deepEqual(
    decisions.map((entry) => [entry.gate_id, entry.decision]),
    [["D01", "approve"]],
    "the committed decision is recorded even though its next gate never launched"
  );
});

test("a block decision blocks the run and ledgers an escalation", async (t) => {
  const { runtime, client, root } = await fixture(t);
  await startRun(runtime);
  await finishAttempt(runtime, client, root, "ses-gate-1", "D01");
  const outcome = await commitDecision(
    runtime,
    "block",
    "the repository has no readable manifest to inventory",
    "Read the tree myself; the claim that a manifest exists does not check out."
  );
  assert.equal(outcome.kind, "blocked");

  const run = await loadActiveRun(root);
  assert.equal(run?.state.status, "blocked");
  assert.equal(run?.state.last_decision?.decision, "block");
  assert.equal(run?.state.last_decision?.decided_by_mode, "auto");

  assert.deepEqual(outcome.escalation, {
    kind: "run_blocked",
    detail: "D01 was blocked: the repository has no readable manifest to inventory",
  });

  const entries = await ledgerEntries(root);
  assert.equal(entriesOf(entries, "gate_decision")[0].decision, "block");
  const escalation = entriesOf(entries, "escalation")[0];
  assert.equal(escalation.kind, "run_blocked");
  assert.equal(escalation.detail, (outcome.escalation as { detail: string }).detail);
});

test("resume needs a blocked run and a reason, and stops at the launch ceiling", async (t) => {
  const { runtime, client, root } = await fixture(t);
  await startRun(runtime);
  await assert.rejects(
    runAction(runtime, autoContext(), { action: "resume" }),
    /resume requires a resumeReason/
  );
  await assert.rejects(
    runAction(runtime, autoContext(), { action: "resume", resumeReason: "keep going" }),
    /resume applies only to a blocked run/
  );

  await finishAttempt(runtime, client, root, "ses-gate-1", "D01");
  await commitDecision(
    runtime,
    "block",
    "no readable manifest",
    "Verified the tree myself before blocking."
  );

  const blockedRun = await loadActiveRun(root);
  assert.ok(blockedRun);
  const statePath = path.join(blockedRun.runDir, "workflow-state.json");
  const state = JSON.parse(await readFile(statePath, "utf8")) as {
    attempts: Record<string, number>;
  };
  state.attempts = { D01: 40 };
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);

  const capped = JSON.parse(
    await runAction(runtime, autoContext(), {
      action: "resume",
      resumeReason: "The human inspected the manifest gap and asked for one more pass.",
    })
  ) as Record<string, unknown>;
  assert.equal(capped.outcome, "escalation_required");
  assert.equal(capped.kind, "launch_cap");
  assert.equal(client.creates.length, 1, "the ceiling refused before any session was created");
  const escalations = entriesOf(await ledgerEntries(root), "escalation");
  assert.deepEqual(escalations.map((entry) => entry.kind), ["run_blocked", "launch_cap"]);
});

test("recovery is exempt from the launch ceiling so a committed decision can finish", async (t) => {
  const { runtime, client, root } = await fixture(t);
  await startRun(runtime);
  await finishAttempt(runtime, client, root, "ses-gate-1", "D01");
  client.beforeCreate = async () => {
    client.beforeCreate = null;
    throw new Error("simulated create failure");
  };
  await assert.rejects(
    commitDecision(runtime, "approve", null, "Read both declared files; the inventory checks out."),
    /simulated create failure/
  );

  const wedged = await loadActiveRun(root);
  assert.ok(wedged);
  assert.equal(wedged.state.active_gate_id, "D02");
  const statePath = path.join(wedged.runDir, "workflow-state.json");
  const state = JSON.parse(await readFile(statePath, "utf8")) as { attempts: Record<string, number> };
  state.attempts = { D01: 40 };
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);

  const recovered = JSON.parse(
    await runAction(runtime, autoContext(), { action: "recover" })
  ) as Record<string, unknown>;
  assert.equal(recovered.outcome, "recovered");
  assert.equal(recovered.launched_gate, "D02");
});

test("auto state lives under .retrieval-auto and never touches .retrieval-meta", async (t) => {
  const { runtime, client, root } = await fixture(t, { fileState: true });
  await startRun(runtime);
  await finishAttempt(runtime, client, root, "ses-gate-1", "D01");

  await stat(path.join(root, OPERATOR_SURFACES.auto.stateFile));
  await stat(path.join(root, ".opencode/.retrieval-auto"));
  await assert.rejects(
    stat(path.join(root, ".opencode/.retrieval-meta")),
    (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT"
  );
  assert.equal(OPERATOR_SURFACES.meta.stateFile, ".opencode/.retrieval-meta/state.json");
  assert.equal(OPERATOR_SURFACES.auto.sessionMode, "auto");
  assert.equal(OPERATOR_SURFACES.auto.agent, "retrieval-autopilot");
});

test("the autopilot plugin exposes exactly the three auto tools", async () => {
  const module = (await import("./retrieval-autopilot-tools.ts")) as unknown as {
    default: {
      id: string;
      server: (input: unknown) => Promise<{ tool: Record<string, unknown> }>;
    };
  };
  assert.equal(module.default.id, "retrieval-autopilot");
  const hooks = await module.default.server({
    directory: "/nonexistent",
    serverUrl: new URL("http://127.0.0.1:1"),
    client: {},
  });
  assert.deepEqual(Object.keys(hooks.tool).sort(), [
    "retrieval_auto_gate",
    "retrieval_auto_run",
    "retrieval_auto_transition",
  ]);
});

test("the optional autopilot loader degrades only for the missing generic package", async () => {
  const module = (await import("./retrieval-autopilot-loader.ts")) as {
    default: {
      id: string;
      server: (input: unknown) => Promise<{ tool?: Record<string, unknown> }>;
    };
    isMissingGenericPackage: (error: unknown) => boolean;
  };
  assert.equal(module.default.id, "retrieval-autopilot-loader");
  const hooks = await module.default.server({
    directory: "/nonexistent",
    serverUrl: new URL("http://127.0.0.1:1"),
    client: {},
  });
  assert.deepEqual(Object.keys(hooks.tool ?? {}).sort(), [
    "retrieval_auto_gate",
    "retrieval_auto_run",
    "retrieval_auto_transition",
  ]);

  // Only the absent optional package yields the empty hook set; every other
  // load failure must stay fatal rather than silently disable the surface.
  assert.equal(
    module.isMissingGenericPackage(
      Object.assign(new Error("Cannot find package 'meta-harness' imported from ..."), {
        code: "ERR_MODULE_NOT_FOUND",
      })
    ),
    true
  );
  assert.equal(
    module.isMissingGenericPackage(
      Object.assign(new Error("Cannot find package '@opencode-ai/plugin'"), {
        code: "ERR_MODULE_NOT_FOUND",
      })
    ),
    false
  );
  assert.equal(module.isMissingGenericPackage(new Error("meta-harness exploded")), false);
});
