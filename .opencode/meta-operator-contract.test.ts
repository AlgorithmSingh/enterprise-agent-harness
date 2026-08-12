import assert from "node:assert/strict";
import { appendFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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

import {
  loadActiveRun,
  runStartCommand,
} from "../retrieval_agent_harness_phase_based/plugin-runtime.mjs";
import {
  permissionApprovalConfirmation,
  questionAnswerConfirmation,
  startRunConfirmation,
} from "../retrieval_agent_harness_phase_based/meta-review-binding.mjs";
import {
  bridgePluginV2Client,
  createOperatorRuntime,
  gateAction,
  runAction,
  transitionAction,
} from "./retrieval-operator-tools.ts";

test("the OpenCode v2 facade reuses the plugin's connected transport", async () => {
  const requests: Record<string, unknown>[] = [];
  const transport = {
    get: async (input: Record<string, unknown>) => {
      requests.push(input);
      return { data: [], error: undefined };
    },
  };
  const client = bridgePluginV2Client({ _client: transport });
  const result = await client.session.messages({ sessionID: "ses-live", directory: "/project" });
  assert.deepEqual(result.data, []);
  assert.equal(requests[0]?.url, "/session/{sessionID}/message");
  assert.deepEqual(requests[0]?.path, { sessionID: "ses-live" });
  assert.deepEqual(requests[0]?.query, { directory: "/project" });
  assert.throws(() => bridgePluginV2Client({}), /connected SDK transport/);
});

const POLICY: ModelRolePolicy = {
  operator: null,
  gate: { provider: "prov", model: "cheap-gate" },
};
const OPERATOR_SESSION = "ses-operator";
const INITIAL_IDEA = "Build a small, safe Retrieval agent.";

interface FakeMessage {
  info: Record<string, unknown>;
  parts: unknown[];
}

class FakeClient {
  creates: Array<Record<string, unknown>> = [];
  prompts: Array<Record<string, unknown>> = [];
  updates: Array<Record<string, unknown>> = [];
  updateAttempts: Array<Record<string, unknown>> = [];
  aborts: string[] = [];
  questionReplies: Array<Record<string, unknown>> = [];
  questionRejects: Array<Record<string, unknown>> = [];
  permissionReplies: Array<Record<string, unknown>> = [];
  questions: Array<Record<string, unknown>> = [];
  permissions: Array<Record<string, unknown>> = [];
  messagesBySession = new Map<string, FakeMessage[]>();
  statusBySession: Record<string, { type: string }> = {};
  createParentIDs: Array<string | null> = [];
  beforeCreate: (() => Promise<void>) | null = null;
  failPromptsRemaining = 0;
  failAbortsRemaining = 0;
  failUpdatesRemaining = 0;
  failAborts = false;
  #sessionCounter = 0;

  session = {
    create: async (parameters: Record<string, unknown>) => {
      await this.beforeCreate?.();
      this.creates.push(parameters);
      this.#sessionCounter += 1;
      return {
        data: {
          id: `ses-gate-${this.#sessionCounter}`,
          parentID: this.createParentIDs.shift() ?? null,
        },
      };
    },
    promptAsync: async (parameters: Record<string, unknown>) => {
      if (this.failPromptsRemaining > 0) {
        this.failPromptsRemaining -= 1;
        return { data: undefined, error: { message: "simulated prompt failure" } };
      }
      this.prompts.push(parameters);
      return { data: undefined, error: undefined };
    },
    update: async (parameters: Record<string, unknown>) => {
      this.updateAttempts.push(parameters);
      if (this.failUpdatesRemaining > 0) {
        this.failUpdatesRemaining -= 1;
        return { data: undefined, error: { message: "simulated update failure" } };
      }
      this.updates.push(parameters);
      return { data: true, error: undefined };
    },
    messages: async (parameters: { sessionID: string }) => ({
      data: this.messagesBySession.get(parameters.sessionID) ?? [],
    }),
    status: async () => ({ data: this.statusBySession }),
    abort: async (parameters: { sessionID: string }) => {
      if (this.failAbortsRemaining > 0) {
        this.failAbortsRemaining -= 1;
        return { data: undefined, error: { message: "simulated transient abort failure" } };
      }
      if (this.failAborts) return { data: undefined, error: { message: "simulated abort failure" } };
      this.aborts.push(parameters.sessionID);
      return { data: true };
    },
  };

  question = {
    list: async () => ({ data: this.questions }),
    reply: async (parameters: Record<string, unknown>) => {
      this.questionReplies.push(parameters);
      this.questions = this.questions.filter((q) => q.id !== parameters.requestID);
      return { data: true };
    },
    reject: async (parameters: Record<string, unknown>) => {
      this.questionRejects.push(parameters);
      this.questions = this.questions.filter((q) => q.id !== parameters.requestID);
      return { data: true };
    },
  };

  permission = {
    list: async () => ({ data: this.permissions }),
    reply: async (parameters: Record<string, unknown>) => {
      this.permissionReplies.push(parameters);
      this.permissions = this.permissions.filter((p) => p.id !== parameters.requestID);
      return { data: true };
    },
  };
}

const WORKFLOW = {
  version: 2,
  workflow_id: "retrieval-agent-test-meta",
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

async function fixture(t: { after(fn: () => Promise<void> | void): void }) {
  const root = await mkdtemp(path.join(os.tmpdir(), "retrieval-meta-opencode-"));
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
        "Exercise the OpenCode meta-operator contract.",
        "",
      ].join("\n"),
    );
  }
  const client = new FakeClient();
  const supervisor = await MetaSupervisor.load({ store: new InMemoryMetaStateStore() });
  const runtime = createOperatorRuntime({
    client: client as unknown as OpencodeClient,
    directory: root,
    supervisor,
    policy: POLICY,
  });
  return { root, client, supervisor, runtime };
}

function operatorContext(
  overrides: Partial<{ sessionID: string; messageID: string; agent: string }> = {}
) {
  return {
    sessionID: OPERATOR_SESSION,
    messageID: "msg-current",
    agent: "retrieval-operator",
    directory: "ignored",
    ...overrides,
  };
}

function setOperatorTranscript(
  client: FakeClient,
  entries: Array<{ id: string; role: "user" | "assistant"; parentID?: string; parts: unknown[] }>
) {
  client.messagesBySession.set(
    OPERATOR_SESSION,
    entries.map((entry) => ({
      info: {
        id: entry.id,
        sessionID: OPERATOR_SESSION,
        role: entry.role,
        ...(entry.parentID !== undefined ? { parentID: entry.parentID } : {}),
      },
      parts: entry.parts,
    }))
  );
}

/** Human-authored exact block as the parent of the executing tool message. */
function humanBlockTranscript(client: FakeClient, toolId: string, block: string) {
  setOperatorTranscript(client, [
    { id: "u-human", role: "user", parts: [{ type: "text", text: block }] },
    {
      id: "msg-current",
      role: "assistant",
      parentID: "u-human",
      parts: [{ type: "tool", tool: toolId, state: { status: "running" } }],
    },
  ]);
}

async function startRun(runtime: ReturnType<typeof createOperatorRuntime>, client: FakeClient) {
  const block = startRunConfirmation({
    targetRepoPath: runtime.directory,
    initialIdea: INITIAL_IDEA,
  });
  humanBlockTranscript(client, "retrieval_meta_run", block);
  const output = JSON.parse(
    await runAction(runtime, operatorContext(), {
      action: "start",
      targetRepoPath: runtime.directory,
      initialIdea: INITIAL_IDEA,
    })
  ) as { kind: string; launched_gate?: string };
  assert.equal(output.kind, "launched");
  assert.equal(output.launched_gate, "D01");
}

/** Give the recorded gate session an assistant reply on the configured model. */
function exposeGateModel(client: FakeClient, sessionID = "ses-gate-1", variant?: string) {
  client.messagesBySession.set(sessionID, [
    {
      info: {
        id: `${sessionID}-a1`,
        sessionID,
        role: "assistant",
        providerID: "prov",
        modelID: "cheap-gate",
        ...(variant !== undefined ? { variant } : {}),
        tokens: { input: 10, output: 5 },
        cost: 0.001,
      },
      parts: [],
    },
  ]);
}

async function writeReadyResult(root: string) {
  const run = await loadActiveRun(root);
  assert.ok(run?.state.current_attempt, "an attempt must be active");
  const artifactPath = ".sequence/d01-notes.json";
  await mkdir(path.join(root, ".sequence"), { recursive: true });
  await writeFile(path.join(root, artifactPath), `{"notes":"d01"}\n`);
  const evidencePath = "docs-notes.md";
  await writeFile(path.join(root, evidencePath), "evidence body\n");
  const result = {
    gate_id: "D01",
    recommendation: "approve",
    summary: "D01 completed",
    artifacts: [{ path: artifactPath, role: "required output" }],
    evidence: [{ path: evidencePath, supports: "inventory claims" }],
    uncertainties: [],
    blockers: [],
  };
  const resultAbsolute = path.join(run.runDir, run.state.current_attempt.result_path);
  await mkdir(path.dirname(resultAbsolute), { recursive: true });
  await writeFile(resultAbsolute, `${JSON.stringify(result, null, 2)}\n`);
  return { run, artifactPath, evidencePath, resultAbsolute };
}

async function committedDecision(root: string) {
  const run = await loadActiveRun(root);
  return run?.state.last_decision ?? null;
}

async function releaseWorker(
  runtime: ReturnType<typeof createOperatorRuntime>,
  client: FakeClient,
  reason = "result ready"
) {
  exposeGateModel(client);
  return gateAction(runtime, operatorContext(), { action: "release", reason });
}

function commitTranscript(client: FakeClient, confirmationText: string) {
  setOperatorTranscript(client, [
    { id: "u-1", role: "user", parts: [{ type: "text", text: "Prepare the transition." }] },
    {
      id: "msg-prepare",
      role: "assistant",
      parentID: "u-1",
      parts: [{ type: "tool", tool: "retrieval_meta_transition", state: { status: "completed" } }],
    },
    { id: "u-confirm", role: "user", parts: [{ type: "text", text: confirmationText }] },
    {
      id: "msg-commit",
      role: "assistant",
      parentID: "u-confirm",
      parts: [{ type: "tool", tool: "retrieval_meta_transition", state: { status: "running" } }],
    },
  ]);
}

async function prepareApprove(runtime: ReturnType<typeof createOperatorRuntime>) {
  const prepared = JSON.parse(
    await transitionAction(runtime, operatorContext({ messageID: "msg-prepare" }), {
      action: "prepare",
      decision: "approve",
    })
  ) as { outcome: string; confirmation_block: string; display: Record<string, unknown> };
  assert.equal(prepared.outcome, "prepared");
  return prepared;
}

test("operator tools fail closed for non-operator agents", async (t) => {
  const { runtime } = await fixture(t);
  await assert.rejects(
    runAction(runtime, operatorContext({ agent: "gate-d01" }), { action: "status" }),
    /reserved for the retrieval-operator agent/
  );
  await assert.rejects(
    gateAction(runtime, operatorContext({ agent: "gate-d01" }), { action: "read" }),
    /reserved for the retrieval-operator agent/
  );
  await assert.rejects(
    transitionAction(runtime, operatorContext({ agent: "gate-d01" }), {
      action: "prepare",
      decision: "approve",
    }),
    /reserved for the retrieval-operator agent/
  );
});

test("start requires the human's exact kickoff block before any run exists", async (t) => {
  const { runtime, client, root } = await fixture(t);
  // A model-authored argument alone must not start the run or seed facts.
  setOperatorTranscript(client, [
    { id: "u-x", role: "user", parts: [{ type: "text", text: "please start" }] },
    {
      id: "msg-current",
      role: "assistant",
      parentID: "u-x",
      parts: [{ type: "tool", tool: "retrieval_meta_run", state: { status: "running" } }],
    },
  ]);
  const refused = JSON.parse(
    await runAction(runtime, operatorContext(), {
      action: "start",
      targetRepoPath: root,
      initialIdea: INITIAL_IDEA,
    })
  ) as { outcome: string; required_block: string };
  assert.equal(refused.outcome, "human_authorization_rejected");
  assert.equal(
    refused.required_block,
    startRunConfirmation({ targetRepoPath: root, initialIdea: INITIAL_IDEA })
  );
  assert.equal(await loadActiveRun(root), null, "no run may exist without human confirmation");
  assert.equal(client.creates.length, 0);
  assert.equal(runtime.supervisor.listFacts().length, 0, "no kickoff facts were seeded");

  // The exact block starts the run and seeds run-scoped facts.
  await startRun(runtime, client);
  const run = await loadActiveRun(root);
  assert.ok(run);
  const facts = runtime.supervisor.listFacts({ runId: run.state.run_id });
  assert.ok(facts.some((fact) => fact.text.includes("Kickoff target repository")));
  assert.equal(
    runtime.supervisor.listFacts({ runId: "some-other-run" }).length,
    0,
    "facts are scoped to the started run"
  );
});

test("start launches D01 with the exact configured cheap model and records both bindings", async (t) => {
  const { runtime, client, supervisor, root } = await fixture(t);
  await startRun(runtime, client);

  const create = client.creates[0] ?? {};
  assert.deepEqual(create.model, { id: "cheap-gate", providerID: "prov" });
  const prompt = client.prompts[0] ?? {};
  assert.deepEqual(prompt.model, { providerID: "prov", modelID: "cheap-gate" });
  assert.equal(Object.hasOwn(prompt, "tools"), false);
  const rules = create.permission as Array<{ permission: string; action: string }>;
  for (const toolID of ["retrieval_meta_run", "retrieval_meta_gate", "retrieval_meta_transition"]) {
    assert.ok(
      rules.some((rule) => rule.permission === toolID && rule.action === "deny"),
      `session permission must deny ${toolID}`
    );
  }

  const run = await loadActiveRun(root);
  assert.equal(run?.state.current_attempt?.session.id, "ses-gate-1");
  assert.equal(run?.state.current_attempt?.session.mode, "meta");
  assert.equal((create.metadata as Record<string, unknown>).session_mode, "meta");
  assert.equal(
    (create.metadata as Record<string, unknown>).launch_id,
    run?.state.current_attempt?.launch_id,
  );
  const worker = supervisor.getWorker();
  assert.equal(worker?.hostSessionId, "ses-gate-1");
  assert.equal(worker?.status, "active");
  assert.deepEqual(worker?.model, POLICY.gate);
});

test("meta follow-up prompts preserve session permissions instead of replacing them", async (t) => {
  const { runtime, client } = await fixture(t);
  await startRun(runtime, client);
  const sent = JSON.parse(
    await gateAction(runtime, operatorContext(), { action: "send", message: "Check one focused detail." })
  ) as { outcome: string };
  assert.equal(sent.outcome, "sent");
  assert.equal(client.prompts.length, 2);
  assert.equal(Object.hasOwn(client.prompts[0] ?? {}, "tools"), false);
  assert.equal(Object.hasOwn(client.prompts[1] ?? {}, "tools"), false);
});

test("a missing gate model fails closed before any session is created", async (t) => {
  const { runtime, client } = await fixture(t);
  const noGate = createOperatorRuntime({
    client: runtime.client,
    directory: runtime.directory,
    supervisor: runtime.supervisor,
    policy: { operator: null, gate: null },
  });
  await assert.rejects(
    runAction(noGate, operatorContext(), {
      action: "start",
      targetRepoPath: runtime.directory,
      initialIdea: "idea",
    }),
    /no gate model is configured/
  );
  assert.equal(client.creates.length, 0);
});

test("wait ignores other sessions' requests and adopts the worker's question", async (t) => {
  const { runtime, client, supervisor } = await fixture(t);
  await startRun(runtime, client);
  client.statusBySession["ses-gate-1"] = { type: "busy" };
  client.questions = [
    { id: "q-foreign", sessionID: "ses-unrelated", questions: [{ question: "?", header: "x" }] },
  ];
  const first = JSON.parse(
    await gateAction(runtime, operatorContext(), { action: "wait", timeoutSeconds: 1 })
  ) as { outcome: string };
  assert.equal(first.outcome, "timeout", "a foreign-session question must not be adopted");
  assert.equal(supervisor.getPendingRequest(), null);

  client.questions.push({
    id: "q-worker",
    sessionID: "ses-gate-1",
    questions: [{ question: "May I record both sources?", header: "sources" }],
  });
  const adopted = JSON.parse(
    await gateAction(runtime, operatorContext(), { action: "wait", timeoutSeconds: 1 })
  ) as { outcome: string; request: { requestId: string; hostRequestId: string } };
  assert.equal(adopted.outcome, "question");
  assert.equal(adopted.request.hostRequestId, "q-worker");
  assert.equal(supervisor.getPendingRequest()?.hostRequestId, "q-worker");
});

test("an oversized gate question is rejected host-side and never becomes authorizable", async (t) => {
  const { runtime, client, supervisor } = await fixture(t);
  await startRun(runtime, client);
  client.statusBySession["ses-gate-1"] = { type: "busy" };
  client.questions = [
    {
      id: "q-huge",
      sessionID: "ses-gate-1",
      questions: [{ question: "x".repeat(20_000), header: "huge" }],
    },
  ];
  const outcome = JSON.parse(
    await gateAction(runtime, operatorContext(), { action: "wait", timeoutSeconds: 1 })
  ) as { outcome: string; hostRequestId: string };
  assert.equal(outcome.outcome, "rejected_oversized");
  assert.equal(outcome.hostRequestId, "q-huge");
  assert.equal(client.questionRejects[0]?.requestID, "q-huge");
  assert.equal(supervisor.getPendingRequest(), null, "no correlated request was opened");
});

test("routine replies require run-scoped approved-context citations; human replies require exact bytes", async (t) => {
  const { runtime, client, supervisor, root } = await fixture(t);
  await startRun(runtime, client);
  const run = await loadActiveRun(root);
  assert.ok(run);
  client.questions = [
    { id: "q-worker", sessionID: "ses-gate-1", questions: [{ question: "Repo?", header: "repo" }] },
  ];
  await gateAction(runtime, operatorContext(), { action: "wait", timeoutSeconds: 1 });
  const pending = supervisor.getPendingRequest();
  assert.ok(pending);

  await assert.rejects(
    gateAction(runtime, operatorContext(), {
      action: "question_reply",
      requestId: pending.requestId,
      source: "approved-context",
      citedFactIds: [],
      answersJson: JSON.stringify([["the current project"]]),
    }),
    /routine answer must cite at least one approved-context fact/
  );

  // A fact approved for a different run can never back a routine answer.
  const foreign = await supervisor.approveFact({
    runId: "run-FOREIGN",
    text: "Kickoff target repository: elsewhere",
    provenance: { kind: "kickoff", source: "another intake" },
  });
  await assert.rejects(
    gateAction(runtime, operatorContext(), {
      action: "question_reply",
      requestId: pending.requestId,
      source: "approved-context",
      citedFactIds: [foreign.id],
      answersJson: JSON.stringify([["the current project"]]),
    }),
    /routine_answer_not_allowed|not in the approved context/
  );

  const fact = supervisor
    .listFacts({ runId: run.state.run_id })
    .find((candidate) => candidate.text.includes("Kickoff target repository"));
  assert.ok(fact, "start seeded a kickoff fact for this run");
  const routine = JSON.parse(
    await gateAction(runtime, operatorContext(), {
      action: "question_reply",
      requestId: pending.requestId,
      source: "approved-context",
      citedFactIds: [fact.id],
      answersJson: JSON.stringify([["the current project"]]),
    })
  ) as { outcome: string; citedFactIds: string[] };
  assert.equal(routine.outcome, "answered");
  assert.deepEqual(routine.citedFactIds, [fact.id]);
  assert.deepEqual(client.questionReplies[0]?.answers, [["the current project"]]);
  assert.equal(client.questionReplies[0]?.requestID, "q-worker");
  assert.equal(supervisor.getPendingRequest(), null);

  // Second question: a material (human) reply demands the exact relay block.
  const materialQuestion = {
    id: "q-2",
    sessionID: "ses-gate-1",
    questions: [{ question: "Invent version?", header: "v" }],
  };
  client.questions = [materialQuestion];
  await gateAction(runtime, operatorContext(), { action: "wait", timeoutSeconds: 1 });
  const material = supervisor.getPendingRequest();
  assert.ok(material);
  const answers = [["Do not invent a version; record the conflict."]];
  setOperatorTranscript(client, [
    { id: "u-x", role: "user", parts: [{ type: "text", text: "just answer it" }] },
    {
      id: "msg-current",
      role: "assistant",
      parentID: "u-x",
      parts: [{ type: "tool", tool: "retrieval_meta_gate", state: { status: "running" } }],
    },
  ]);
  const refused = JSON.parse(
    await gateAction(runtime, operatorContext(), {
      action: "question_reply",
      requestId: material.requestId,
      source: "human",
      answersJson: JSON.stringify(answers),
    })
  ) as { outcome: string; required_block: string };
  assert.equal(refused.outcome, "human_authorization_rejected");
  assert.equal(supervisor.getPendingRequest()?.requestId, material.requestId, "request stays pending");

  const block = questionAnswerConfirmation({
    requestId: material.requestId,
    hostRequestId: material.hostRequestId,
    runId: material.task.runId,
    gateId: material.task.taskId,
    attempt: material.task.attempt,
    answers,
  });
  assert.equal(refused.required_block, block);
  humanBlockTranscript(client, "retrieval_meta_gate", block);

  // Reusing the same host id/session with changed content cannot inherit the
  // authorization for the payload that was actually adopted.
  client.questions = [
    {
      ...materialQuestion,
      questions: [{ question: "Invent and publish a version?", header: "release" }],
    },
  ];
  await assert.rejects(
    gateAction(runtime, operatorContext(), {
      action: "question_reply",
      requestId: material.requestId,
      source: "human",
      answersJson: JSON.stringify(answers),
    }),
    /question payload changed after adoption/
  );
  assert.equal(client.questionReplies.length, 1, "the changed same-id question was not answered");
  assert.equal(supervisor.getPendingRequest()?.requestId, material.requestId);

  client.questions = [materialQuestion];
  const answered = JSON.parse(
    await gateAction(runtime, operatorContext(), {
      action: "question_reply",
      requestId: material.requestId,
      source: "human",
      answersJson: JSON.stringify(answers),
    })
  ) as { outcome: string };
  assert.equal(answered.outcome, "answered");
  assert.deepEqual(client.questionReplies[1]?.answers, answers);

  const rejectedQuestion = {
    id: "q-reject",
    sessionID: "ses-gate-1",
    questions: [{ question: "Delete the draft?", header: "cleanup" }],
  };
  client.questions = [rejectedQuestion];
  await gateAction(runtime, operatorContext(), { action: "wait", timeoutSeconds: 1 });
  const rejectPending = supervisor.getPendingRequest();
  assert.ok(rejectPending);
  client.questions = [
    {
      ...rejectedQuestion,
      questions: [{ question: "Delete the entire repository?", header: "cleanup" }],
    },
  ];
  await assert.rejects(
    gateAction(runtime, operatorContext(), {
      action: "question_reject",
      requestId: rejectPending.requestId,
      reason: "not approved",
    }),
    /question payload changed after adoption/
  );
  assert.equal(client.questionRejects.length, 0, "a stale rejection did not reject the replacement question");
  client.questions = [rejectedQuestion];
  const rejected = JSON.parse(
    await gateAction(runtime, operatorContext(), {
      action: "question_reject",
      requestId: rejectPending.requestId,
      reason: "not approved",
    })
  ) as { outcome: string };
  assert.equal(rejected.outcome, "rejected");
  assert.equal(client.questionRejects[0]?.requestID, "q-reject");
});

test("permission approval binds the exact persisted block returned by wait", async (t) => {
  const { runtime, client, supervisor } = await fixture(t);
  await startRun(runtime, client);
  const permissionRequest = {
    id: "perm-1",
    sessionID: "ses-gate-1",
    permission: "bash",
    patterns: ["python -m pytest"],
    metadata: { command: "python -m pytest" },
    always: [],
  };
  client.permissions = [permissionRequest];
  const adopted = JSON.parse(
    await gateAction(runtime, operatorContext(), { action: "wait", timeoutSeconds: 1 })
  ) as { outcome: string; request: { requestId: string; human_approval_block: string; payload: string } };
  assert.equal(adopted.outcome, "permission");
  const returnedBlock = adopted.request.human_approval_block;
  assert.ok(returnedBlock.startsWith("APPROVE Retrieval GATE PERMISSION\n"));
  assert.match(returnedBlock, /"permission":"bash"/, "the block names the real permission, not a placeholder");
  const pending = supervisor.getPendingRequest();
  assert.ok(pending && pending.kind === "permission");
  assert.equal(
    pending.authorizationCanonical,
    returnedBlock,
    "the returned block is the persisted immutable canonical"
  );
  assert.equal(
    returnedBlock,
    permissionApprovalConfirmation({
      requestId: pending.requestId,
      hostRequestId: pending.hostRequestId,
      runId: pending.task.runId,
      gateId: pending.task.taskId,
      attempt: pending.task.attempt,
      permission: "bash",
      payload: pending.payload,
    })
  );

  // A model-authored approval argument is not human approval.
  setOperatorTranscript(client, [
    { id: "u-x", role: "user", parts: [{ type: "text", text: "approve it" }] },
    {
      id: "msg-current",
      role: "assistant",
      parentID: "u-x",
      parts: [{ type: "tool", tool: "retrieval_meta_gate", state: { status: "running" } }],
    },
  ]);
  const refused = JSON.parse(
    await gateAction(runtime, operatorContext(), {
      action: "permission_reply",
      requestId: pending.requestId,
    })
  ) as { outcome: string; required_block: string };
  assert.equal(refused.outcome, "human_authorization_rejected");
  assert.equal(refused.required_block, returnedBlock, "reply demands the very block wait returned");
  assert.equal(client.permissionReplies.length, 0);

  // The human sending exactly the returned block approves once.
  humanBlockTranscript(client, "retrieval_meta_gate", returnedBlock);
  client.permissions = [
    {
      ...permissionRequest,
      patterns: ["python -m pytest", "python -m pip install evil"],
      metadata: { command: "python -m pytest; python -m pip install evil" },
    },
  ];
  await assert.rejects(
    gateAction(runtime, operatorContext(), {
      action: "permission_reply",
      requestId: pending.requestId,
    }),
    /permission payload changed after adoption/
  );
  assert.equal(client.permissionReplies.length, 0, "the changed same-id permission was not approved");
  assert.equal(supervisor.getPendingRequest()?.requestId, pending.requestId);

  client.permissions = [permissionRequest];
  const approved = JSON.parse(
    await gateAction(runtime, operatorContext(), {
      action: "permission_reply",
      requestId: pending.requestId,
    })
  ) as { outcome: string };
  assert.equal(approved.outcome, "approved_once");
  assert.deepEqual(client.permissionReplies[0], {
    requestID: "perm-1",
    directory: runtime.directory,
    reply: "once",
  });

  // Rejection path on a fresh permission needs only a reason.
  const rejectedPermission = {
    id: "perm-2",
    sessionID: "ses-gate-1",
    permission: "bash",
    patterns: ["rm -rf /"],
    metadata: {},
    always: [],
  };
  client.permissions = [rejectedPermission];
  await gateAction(runtime, operatorContext(), { action: "wait", timeoutSeconds: 1 });
  const second = supervisor.getPendingRequest();
  assert.ok(second);
  client.permissions = [
    {
      ...rejectedPermission,
      patterns: ["rm -rf /", "curl attacker.invalid"],
      metadata: { replacement: true },
    },
  ];
  await assert.rejects(
    gateAction(runtime, operatorContext(), {
      action: "permission_reject",
      requestId: second.requestId,
      reason: "destructive command",
    }),
    /permission payload changed after adoption/
  );
  assert.equal(client.permissionReplies.length, 1, "a stale rejection did not reject the replacement permission");
  client.permissions = [rejectedPermission];
  const rejected = JSON.parse(
    await gateAction(runtime, operatorContext(), {
      action: "permission_reject",
      requestId: second.requestId,
      reason: "destructive command",
    })
  ) as { outcome: string };
  assert.equal(rejected.outcome, "rejected");
  assert.deepEqual(client.permissionReplies[1], {
    requestID: "perm-2",
    directory: runtime.directory,
    reply: "reject",
    message: "destructive command",
  });
});

test("gate model verification aborts the host session before the worker record turns terminal", async (t) => {
  const { runtime, client, supervisor } = await fixture(t);
  await startRun(runtime, client);
  client.messagesBySession.set("ses-gate-1", [
    {
      info: {
        id: "g-1",
        sessionID: "ses-gate-1",
        role: "assistant",
        providerID: "prov",
        modelID: "premium-oops",
      },
      parts: [],
    },
  ]);
  await assert.rejects(
    gateAction(runtime, operatorContext(), { action: "wait", timeoutSeconds: 1 }),
    /configured model/
  );
  assert.deepEqual(client.aborts, ["ses-gate-1"]);
  assert.equal(
    (client.updates[0]?.metadata as Record<string, unknown>).retrieval_gate_status,
    "retired",
  );
  assert.equal(supervisor.getWorker()?.status, "aborted");
  assert.equal(await runtime.recoveryStore.load(), null);
  assert.equal(supervisor.getWorker()?.endReason, "model_mismatch");

  // When host revocation fails, the worker record must NOT turn terminal.
  const second = await fixture(t);
  await startRun(second.runtime, second.client);
  second.client.messagesBySession.set("ses-gate-1", [
    {
      info: {
        id: "g-1",
        sessionID: "ses-gate-1",
        role: "assistant",
        providerID: "prov",
        modelID: "premium-oops",
      },
      parts: [],
    },
  ]);
  second.client.failAborts = true;
  await assert.rejects(
    gateAction(second.runtime, operatorContext(), { action: "wait", timeoutSeconds: 1 }),
    /session\.abort .*failed/
  );
  assert.equal(
    second.supervisor.getWorker()?.status,
    "active",
    "a failed host revocation must leave the worker non-terminal"
  );
});

test("abort revokes the host session first; a failed host abort never terminalizes", async (t) => {
  const { runtime, client, supervisor } = await fixture(t);
  await startRun(runtime, client);
  client.questions = [
    { id: "q-1", sessionID: "ses-gate-1", questions: [{ question: "?", header: "h" }] },
  ];
  await gateAction(runtime, operatorContext(), { action: "wait", timeoutSeconds: 1 });

  // Host abort fails: supervisor metadata must stay live and the request pending.
  client.failAborts = true;
  await assert.rejects(
    gateAction(runtime, operatorContext(), { action: "abort", reason: "operator revoke" }),
    /session\.abort .*failed/
  );
  assert.equal(supervisor.getWorker()?.status, "active");
  assert.ok(supervisor.getPendingRequest(), "the pending request survives a failed revocation");

  client.failAborts = false;
  const aborted = JSON.parse(
    await gateAction(runtime, operatorContext(), { action: "abort", reason: "operator revoke" })
  ) as { outcome: string; interrupted_request: { status: string } | null };
  assert.equal(aborted.outcome, "aborted");
  assert.equal(aborted.interrupted_request?.status, "interrupted");
  assert.deepEqual(client.aborts, ["ses-gate-1"]);
  assert.equal(
    (client.updates[0]?.metadata as Record<string, unknown>).retrieval_gate_status,
    "retired",
  );
  assert.equal(supervisor.getWorker()?.status, "aborted");
  assert.equal(await runtime.recoveryStore.load(), null);
});

test("release demands a verified model, idle host session, and ready result", async (t) => {
  const { runtime, client, root } = await fixture(t);
  await startRun(runtime, client);

  // Unverified model: refuse.
  await assert.rejects(
    gateAction(runtime, operatorContext(), { action: "release", reason: "done" }),
    /release requires a verified gate model/
  );

  // Busy host session: refuse.
  exposeGateModel(client);
  client.statusBySession["ses-gate-1"] = { type: "busy" };
  await assert.rejects(
    gateAction(runtime, operatorContext(), { action: "release", reason: "done" }),
    /still busy/
  );
  delete client.statusBySession["ses-gate-1"];

  // Pending host permission: refuse.
  client.permissions = [
    { id: "perm-x", sessionID: "ses-gate-1", permission: "bash", patterns: [], metadata: {}, always: [] },
  ];
  await assert.rejects(
    gateAction(runtime, operatorContext(), { action: "release", reason: "done" }),
    /pending host question\/permission/
  );
  client.permissions = [];

  // No ready result yet: refuse.
  await assert.rejects(
    gateAction(runtime, operatorContext(), { action: "release", reason: "done" }),
    /release requires a ready gate result/
  );

  await writeReadyResult(root);
  const released = JSON.parse(
    await gateAction(runtime, operatorContext(), { action: "release", reason: "result ready" })
  ) as { outcome: string; worker: { status: string } };
  assert.equal(released.outcome, "released");
  assert.equal(released.worker.status, "finished");
  assert.equal(await runtime.recoveryStore.load(), null);
  assert.equal(
    (client.updates[0]?.metadata as Record<string, unknown>).retrieval_gate_status,
    "retired",
  );
});

test("interrupted work is persisted honestly across a restart; a live owner blocks a second instance", async (t) => {
  const { runtime, client, root } = await fixture(t);
  const store = new FileMetaStateStore(path.join(root, ".opencode", ".retrieval-meta", "state.json"));
  const first = await MetaSupervisor.load({ store });
  const persisted = createOperatorRuntime({
    client: runtime.client,
    directory: root,
    supervisor: first,
    policy: POLICY,
  });
  await startRun(persisted, client);

  // While the first instance still owns the state (same PID included), a
  // second live instance must not load and must not disturb the live worker.
  await assert.rejects(
    MetaSupervisor.load({ store }),
    (error: unknown) => (error as { code?: string }).code === "state_owned"
  );
  assert.equal(first.getWorker()?.status, "active");

  // Only after the owning process is genuinely dead may a successor recover.
  const reloaded = await MetaSupervisor.load({
    store,
    ownership: { pid: 424_242, hostname: os.hostname(), isAlive: () => false },
  });
  assert.equal(reloaded.getWorker()?.status, "interrupted");
  assert.equal(reloaded.recoveredInterruptions.length, 1);
});

test("failed kickoff retires its permissions, rolls back, and recovery launches a fresh recorded session", async (t) => {
  const { runtime, client, supervisor, root } = await fixture(t);
  // The launch records the runtime session, then the kickoff prompt fails.
  client.failPromptsRemaining = 1;
  client.failAbortsRemaining = 1;
  const block = startRunConfirmation({ targetRepoPath: root, initialIdea: INITIAL_IDEA });
  humanBlockTranscript(client, "retrieval_meta_run", block);
  await assert.rejects(
    runAction(runtime, operatorContext(), {
      action: "start",
      targetRepoPath: root,
      initialIdea: INITIAL_IDEA,
    }),
    /kickoff failed.*could not be retired/
  );
  assert.equal(supervisor.getWorker()?.status, "aborted", "the failed launch is recorded honestly");
  assert.deepEqual(client.aborts, ["ses-gate-1"], "the host session was quiesced before terminalizing");
  assert.equal(
    (client.updates[0]?.metadata as Record<string, unknown>).retrieval_gate_status,
    "retired",
    "the old session's permissions were permanently retired",
  );
  assert.ok(
    (client.updates[0]?.permission as Array<{ action?: string }>).every(
      (rule) => rule.action === "deny"
    ),
  );
  assert.equal(await runtime.recoveryStore.load(), null, "lost-kickoff material was invalidated");
  const run = await loadActiveRun(root);
  assert.equal(run?.state.current_attempt, null, "the safely retired attempt was rolled back");
  assert.equal(client.prompts.length, 0, "the kickoff never reached the gate");

  const recovered = JSON.parse(
    await runAction(runtime, operatorContext(), { action: "recover" })
  ) as { outcome: string; kind: string; launched_gate: string; attempt: number };
  assert.equal(recovered.outcome, "recovered");
  assert.equal(recovered.kind, "launched");
  assert.equal(recovered.launched_gate, "D01");
  assert.equal(recovered.attempt, 1);
  assert.equal(supervisor.getWorker()?.status, "active");
  assert.equal(supervisor.getWorker()?.hostSessionId, "ses-gate-2");
  const kickoff = client.prompts[0] ?? {};
  assert.equal(kickoff.sessionID, "ses-gate-2");
  assert.deepEqual(kickoff.model, { providerID: "prov", modelID: "cheap-gate" });
  assert.equal(Object.hasOwn(kickoff, "tools"), false);
  const after = await loadActiveRun(root);
  assert.equal(after?.state.current_attempt?.number, 1, "no duplicate attempt was launched");
  assert.equal(after?.state.current_attempt?.session.id, "ses-gate-2");
  assert.equal(after?.state.current_attempt?.delivery_status, "delivered");
  assert.equal(client.creates.length, 2, "recovery used a fresh root session");

  // Recovery refuses while a worker is live.
  await assert.rejects(
    runAction(runtime, operatorContext(), { action: "recover" }),
    /recovery applies only to interrupted work/
  );
});

test("a failed launch cleanup preserves the exact pending attempt and non-terminal worker", async (t) => {
  const { runtime, client, supervisor, root } = await fixture(t);
  client.failPromptsRemaining = 1;
  client.failAborts = true;
  const block = startRunConfirmation({ targetRepoPath: root, initialIdea: INITIAL_IDEA });
  humanBlockTranscript(client, "retrieval_meta_run", block);

  await assert.rejects(
    runAction(runtime, operatorContext(), {
      action: "start",
      targetRepoPath: root,
      initialIdea: INITIAL_IDEA,
    }),
    /cleanup could not complete.*worker record stays non-terminal/
  );

  const run = await loadActiveRun(root);
  const attempt = run?.state.current_attempt;
  assert.ok(attempt, "the runtime attempt remains available for explicit recovery");
  assert.equal(attempt.session.id, "ses-gate-1");
  assert.equal(attempt.session.mode, "meta");
  assert.equal(attempt.delivery_status, "pending");
  assert.equal(supervisor.getWorker()?.status, "active");
  const recovery = await runtime.recoveryStore.load() as { launch_id?: string } | null;
  assert.equal(recovery?.launch_id, attempt.launch_id);
});

test("an unsafe child remains the exact cleanup target until retirement, then recovery launches fresh", async (t) => {
  const { runtime, client, supervisor, root } = await fixture(t);
  client.createParentIDs.push("operator-parent", null);
  // Inner child retirement, the adapter retry, and the meta retry all fail;
  // the first explicit abort also fails before retirement eventually works.
  client.failUpdatesRemaining = 4;
  const block = startRunConfirmation({ targetRepoPath: root, initialIdea: INITIAL_IDEA });
  humanBlockTranscript(client, "retrieval_meta_run", block);

  await assert.rejects(
    runAction(runtime, operatorContext(), {
      action: "start",
      targetRepoPath: root,
      initialIdea: INITIAL_IDEA,
    }),
    /cleanup could not complete.*worker record stays non-terminal/
  );

  const wedged = await loadActiveRun(root);
  const unsafeAttempt = wedged?.state.current_attempt;
  assert.ok(unsafeAttempt);
  assert.equal(unsafeAttempt.session.id, "ses-gate-1");
  assert.equal(unsafeAttempt.session.mode, "meta");
  assert.equal(unsafeAttempt.delivery_status, "pending");
  assert.equal(supervisor.getWorker()?.status, "active");
  assert.equal(supervisor.getWorker()?.hostSessionId, "ses-gate-1");
  assert.equal(client.creates.length, 1);
  assert.equal(client.prompts.length, 0, "an unexpected child never receives the kickoff");
  assert.equal(client.updateAttempts.length, 3);
  assert.ok(client.updateAttempts.every((update) => update.sessionID === "ses-gate-1"));
  const recovery = await runtime.recoveryStore.load() as { host_session_id?: string } | null;
  assert.equal(recovery?.host_session_id, "ses-gate-1");

  await assert.rejects(
    runAction(runtime, operatorContext(), { action: "recover" }),
    /recovery applies only to interrupted work/
  );
  assert.equal(client.creates.length, 1, "recovery cannot bypass the live cleanup target");

  await assert.rejects(
    gateAction(runtime, operatorContext(), {
      action: "abort",
      reason: "retry unsafe child retirement",
    }),
    /session\.update while retiring gate authority failed/
  );
  assert.equal(supervisor.getWorker()?.status, "active");
  assert.equal(supervisor.getWorker()?.hostSessionId, "ses-gate-1");
  assert.equal((await loadActiveRun(root))?.state.current_attempt?.session.id, "ses-gate-1");
  assert.equal(client.updateAttempts.length, 4);

  await gateAction(runtime, operatorContext(), {
    action: "abort",
    reason: "unsafe child retirement now confirmed",
  });
  assert.equal(supervisor.getWorker()?.status, "aborted");
  assert.equal(await runtime.recoveryStore.load(), null);
  assert.equal(client.updates[0]?.sessionID, "ses-gate-1");
  assert.equal(
    (client.updates[0]?.metadata as Record<string, unknown>).retrieval_gate_status,
    "retired",
  );
  assert.equal(
    (await loadActiveRun(root))?.state.current_attempt?.session.id,
    "ses-gate-1",
    "terminalizing the worker does not pretend the uncertain runtime attempt was delivered",
  );

  const recovered = JSON.parse(
    await runAction(runtime, operatorContext(), { action: "recover" })
  ) as { outcome: string; kind: string; retired_session: string; launched_gate: string; attempt: number };
  assert.equal(recovered.outcome, "recovered");
  assert.equal(recovered.kind, "launched");
  assert.equal(recovered.retired_session, "ses-gate-1");
  assert.equal(recovered.launched_gate, "D01");
  assert.equal(recovered.attempt, 1);
  assert.equal(client.creates.length, 2);
  assert.equal(client.prompts.length, 1);
  assert.equal(client.prompts[0]?.sessionID, "ses-gate-2");
  assert.equal(supervisor.getWorker()?.status, "active");
  assert.equal(supervisor.getWorker()?.hostSessionId, "ses-gate-2");
  const fresh = await loadActiveRun(root);
  assert.equal(fresh?.state.current_attempt?.number, 1);
  assert.equal(fresh?.state.current_attempt?.session.id, "ses-gate-2");
  assert.equal(fresh?.state.current_attempt?.delivery_status, "delivered");
  assert.notEqual(fresh?.state.current_attempt?.launch_id, unsafeAttempt.launch_id);
  assert.equal(client.updateAttempts.length, 6);
  assert.ok(client.updateAttempts.every((update) => update.sessionID === "ses-gate-1"));
});

test("a post-record setup failure rolls back after successful permanent cleanup", async (t) => {
  const { runtime: base, client, supervisor, root } = await fixture(t);
  class FailingRecoveryStore extends InMemoryMetaStateStore {
    override async save(): Promise<void> {
      throw new Error("simulated recovery persistence failure");
    }
  }
  const runtime = createOperatorRuntime({
    client: base.client,
    directory: root,
    supervisor,
    policy: POLICY,
    recoveryStore: new FailingRecoveryStore(),
  });
  const block = startRunConfirmation({ targetRepoPath: root, initialIdea: INITIAL_IDEA });
  humanBlockTranscript(client, "retrieval_meta_run", block);

  await assert.rejects(
    runAction(runtime, operatorContext(), {
      action: "start",
      targetRepoPath: root,
      initialIdea: INITIAL_IDEA,
    }),
    /simulated recovery persistence failure/
  );

  const run = await loadActiveRun(root);
  assert.equal(run?.state.current_attempt, null);
  assert.equal(supervisor.getWorker()?.status, "aborted");
  assert.deepEqual(client.aborts, ["ses-gate-1"]);
  assert.equal(
    (client.updates[0]?.metadata as Record<string, unknown>).retrieval_gate_status,
    "retired",
  );
});

test("recovery retires a preserved pending kickoff and launches a fresh session", async (t) => {
  const { runtime, client, supervisor, root } = await fixture(t);
  client.failPromptsRemaining = 1;
  client.failAborts = true;
  const block = startRunConfirmation({ targetRepoPath: root, initialIdea: INITIAL_IDEA });
  humanBlockTranscript(client, "retrieval_meta_run", block);
  await assert.rejects(
    runAction(runtime, operatorContext(), {
      action: "start",
      targetRepoPath: root,
      initialIdea: INITIAL_IDEA,
    }),
    /cleanup could not complete.*worker record stays non-terminal/
  );
  assert.equal(supervisor.getWorker()?.status, "active");

  const run = await loadActiveRun(root);
  const attempt = run?.state.current_attempt;
  assert.ok(attempt);
  assert.equal(attempt.delivery_status, "pending");
  assert.equal(attempt.session.id, "ses-gate-1");

  // Once host retirement becomes available, explicitly aborting the wedged
  // worker terminalizes it without altering the runtime's uncertain attempt.
  client.failAborts = false;
  await gateAction(runtime, operatorContext(), {
    action: "abort",
    reason: "retire the uncertain failed kickoff",
  });
  assert.equal(supervisor.getWorker()?.status, "aborted");
  assert.equal((await loadActiveRun(root))?.state.current_attempt?.session.id, "ses-gate-1");
  assert.equal(await runtime.recoveryStore.load(), null);

  const recovered = JSON.parse(
    await runAction(runtime, operatorContext(), { action: "recover" })
  ) as { outcome: string; kind: string; retired_session: string; launched_gate: string };
  assert.equal(recovered.outcome, "recovered");
  assert.equal(recovered.kind, "launched");
  assert.equal(recovered.retired_session, "ses-gate-1");
  assert.equal(recovered.launched_gate, "D01");
  assert.equal(supervisor.getWorker()?.hostSessionId, "ses-gate-2");
  assert.equal(client.prompts.length, 1);
  assert.equal(client.prompts[0]?.sessionID, "ses-gate-2");
  assert.equal(client.creates.length, 2);
  const after = await loadActiveRun(root);
  assert.equal(after?.state.current_attempt?.number, 1);
  assert.equal(after?.state.current_attempt?.session.id, "ses-gate-2");
});

test("meta recovery rejects an OpenCode attempt owned by the manual session mode", async (t) => {
  const { runtime, root } = await fixture(t);
  await runStartCommand({
    repoRoot: root,
    host: "opencode",
    sessionMode: "manual",
    intake: { targetRepoPath: root, initialIdea: INITIAL_IDEA },
    launch: async (_packet: unknown, record: (session: { id: string; mode: "manual" }) => Promise<void>) => {
      const session = { id: "manual-gate-session", mode: "manual" as const };
      await record(session);
      return session;
    },
  });

  await assert.rejects(
    runAction(runtime, operatorContext(), { action: "recover" }),
    /does not belong to an OpenCode meta-operated session/
  );
  const run = await loadActiveRun(root);
  assert.equal(run?.state.current_attempt?.session.mode, "manual");
});

test("recover resumes the next launch from committed decision state via the runtime", async (t) => {
  const { runtime, client, root } = await fixture(t);
  await startRun(runtime, client);
  await writeReadyResult(root);
  await releaseWorker(runtime, client);
  const prepared = await prepareApprove(runtime);
  commitTranscript(client, prepared.confirmation_block);
  // The D02 launch after the decision commits fails at session creation.
  client.beforeCreate = async () => {
    client.beforeCreate = null;
    throw new Error("simulated create failure");
  };
  await assert.rejects(
    transitionAction(runtime, operatorContext({ messageID: "msg-commit" }), { action: "commit" }),
    /simulated create failure/
  );
  const committed = await committedDecision(root);
  assert.equal(committed?.gate_id, "D01", "the human decision survived the failed next launch");
  assert.equal(committed?.decision, "approve");
  const wedged = await loadActiveRun(root);
  assert.equal(wedged?.state.active_gate_id, "D02");
  assert.equal(wedged?.state.current_attempt, null);

  const recovered = JSON.parse(
    await runAction(runtime, operatorContext(), { action: "recover" })
  ) as { outcome: string; kind?: string; launched_gate?: string };
  assert.equal(recovered.outcome, "recovered");
  assert.equal(recovered.kind, "launched");
  assert.equal(recovered.launched_gate, "D02");
  assert.deepEqual(await committedDecision(root), committed, "recovery did not rewrite the decision");
  assert.equal(runtime.supervisor.getWorker()?.task.taskId, "D02");
});

test("prepare refuses while the worker is live; commit requires the exact confirmation", async (t) => {
  const { runtime, client, root, supervisor } = await fixture(t);
  await startRun(runtime, client);
  await writeReadyResult(root);

  await assert.rejects(
    transitionAction(runtime, operatorContext({ messageID: "msg-prepare" }), {
      action: "prepare",
      decision: "approve",
    }),
    /revoke it before committing/
  );

  await releaseWorker(runtime, client);
  const prepared = await prepareApprove(runtime);
  assert.ok(prepared.confirmation_block.startsWith("CONFIRM Retrieval GATE TRANSITION\n"));
  const display = prepared.display as {
    consequence: { status: string; gate_id: string };
    catalog: { catalog_sha256: string };
    worker: { model_verification: string; host_session_id: string };
  };
  assert.equal(display.consequence.status, "active");
  assert.equal(display.consequence.gate_id, "D02");
  assert.match(display.catalog.catalog_sha256, /^[0-9a-f]{64}$/);
  assert.equal(display.worker.model_verification, "verified");
  assert.equal(display.worker.host_session_id, "ses-gate-1");

  // Declined: the human's reply is not the block.
  commitTranscript(client, "no thanks");
  let outcome = JSON.parse(
    await transitionAction(runtime, operatorContext({ messageID: "msg-commit" }), {
      action: "commit",
    })
  ) as { outcome: string; rejection: string };
  assert.equal(outcome.outcome, "cancelled");
  assert.match(outcome.rejection, /exact_text_mismatch/);
  assert.equal(await committedDecision(root), null);

  // Altered: one extra byte.
  commitTranscript(client, `${prepared.confirmation_block}\n`);
  outcome = JSON.parse(
    await transitionAction(runtime, operatorContext({ messageID: "msg-commit" }), {
      action: "commit",
    })
  ) as { outcome: string; rejection: string };
  assert.equal(outcome.outcome, "cancelled");
  assert.match(outcome.rejection, /exact_text_mismatch/);
  assert.equal(await committedDecision(root), null);

  // Intervening user turn between prepare and the exact block.
  setOperatorTranscript(client, [
    { id: "u-1", role: "user", parts: [{ type: "text", text: "Prepare." }] },
    {
      id: "msg-prepare",
      role: "assistant",
      parentID: "u-1",
      parts: [{ type: "tool", tool: "retrieval_meta_transition", state: { status: "completed" } }],
    },
    { id: "u-doubt", role: "user", parts: [{ type: "text", text: "wait, show evidence" }] },
    { id: "a-reply", role: "assistant", parentID: "u-doubt", parts: [{ type: "text", text: "here" }] },
    { id: "u-confirm", role: "user", parts: [{ type: "text", text: prepared.confirmation_block }] },
    {
      id: "msg-commit",
      role: "assistant",
      parentID: "u-confirm",
      parts: [{ type: "tool", tool: "retrieval_meta_transition", state: { status: "running" } }],
    },
  ]);
  outcome = JSON.parse(
    await transitionAction(runtime, operatorContext({ messageID: "msg-commit" }), {
      action: "commit",
    })
  ) as { outcome: string; rejection: string };
  assert.equal(outcome.outcome, "cancelled");
  assert.match(outcome.rejection, /confirmation_is_not_next_user_message/);
  assert.equal(await committedDecision(root), null);

  // Operator-session replacement: the proposal is scoped to the old session.
  commitTranscript(client, prepared.confirmation_block);
  client.messagesBySession.set(
    "ses-operator-2",
    client.messagesBySession.get(OPERATOR_SESSION) ?? []
  );
  outcome = JSON.parse(
    await transitionAction(
      runtime,
      operatorContext({ sessionID: "ses-operator-2", messageID: "msg-commit" }),
      { action: "commit" }
    )
  ) as { outcome: string; rejection: string };
  assert.equal(outcome.outcome, "cancelled");
  assert.match(outcome.rejection, /different operator session/);
  assert.equal(await committedDecision(root), null);

  // Exact acceptance: decision state commits first, then D02 launches on the cheap model.
  commitTranscript(client, prepared.confirmation_block);
  let stateAtCreate: {
    active_gate_id: string | null;
    current_attempt: unknown;
    last_decision: { gate_id: string; decision: string } | null;
  } | null = null;
  client.beforeCreate = async () => {
    stateAtCreate = (await loadActiveRun(root))?.state ?? null;
  };
  const accepted = JSON.parse(
    await transitionAction(runtime, operatorContext({ messageID: "msg-commit" }), {
      action: "commit",
    })
  ) as { kind: string; launched_gate?: string; decision_committed: boolean };
  assert.equal(accepted.kind, "launched");
  assert.equal(accepted.launched_gate, "D02");
  assert.equal(accepted.decision_committed, true);
  const observedState = stateAtCreate as unknown as {
    active_gate_id: string | null;
    current_attempt: unknown;
    last_decision: { gate_id: string; decision: string } | null;
  };
  assert.equal(observedState.active_gate_id, "D02");
  assert.equal(observedState.current_attempt, null);
  assert.equal(observedState.last_decision?.gate_id, "D01");
  assert.equal(observedState.last_decision?.decision, "approve");
  const lastCreate = client.creates[client.creates.length - 1] ?? {};
  assert.deepEqual(
    lastCreate.model,
    { id: "cheap-gate", providerID: "prov" },
    "the next gate must use the configured cheap model"
  );
  assert.equal(supervisor.getWorker()?.task.taskId, "D02");
});

test("result, artifact, evidence, and catalog staleness each cancel without committing", async (t) => {
  const cases: Array<{
    label: string;
    mutate: (paths: {
      root: string;
      resultAbsolute: string;
      artifactPath: string;
      evidencePath: string;
    }) => Promise<void>;
  }> = [
    { label: "result", mutate: async ({ resultAbsolute }) => appendFile(resultAbsolute, "\n") },
    {
      label: "artifact",
      mutate: async ({ root, artifactPath }) => appendFile(path.join(root, artifactPath), "stale"),
    },
    {
      label: "evidence",
      mutate: async ({ root, evidencePath }) => appendFile(path.join(root, evidencePath), "stale"),
    },
    {
      label: "catalog",
      mutate: async ({ root }) =>
        appendFile(path.join(root, "retrieval_agent_harness_phase_based", "workflow.json"), "\n"),
    },
  ];
  for (const staleness of cases) {
    const { runtime, client, root } = await fixture(t);
    await startRun(runtime, client);
    const paths = await writeReadyResult(root);
    await releaseWorker(runtime, client, "ready");
    const prepared = await prepareApprove(runtime);
    await staleness.mutate({
      root,
      resultAbsolute: paths.resultAbsolute,
      artifactPath: paths.artifactPath,
      evidencePath: paths.evidencePath,
    });
    commitTranscript(client, prepared.confirmation_block);
    const outcome = JSON.parse(
      await transitionAction(runtime, operatorContext({ messageID: "msg-commit" }), {
        action: "commit",
      })
    ) as { outcome?: string; kind?: string };
    assert.equal(outcome.outcome ?? outcome.kind, "cancelled", `${staleness.label} staleness must cancel`);
    assert.equal(
      await committedDecision(root),
      null,
      `${staleness.label} staleness must leave the decision uncommitted`
    );
  }
});

test("commit is refused while a worker is active", async (t) => {
  const { runtime, client, root } = await fixture(t);
  await startRun(runtime, client);
  await writeReadyResult(root);
  await releaseWorker(runtime, client, "ready");
  const prepared = await prepareApprove(runtime);

  // Simulate a live worker appearing again before commit.
  const gateModel = POLICY.gate;
  assert.ok(gateModel);
  const worker = await runtime.supervisor.beginLaunch({
    task: { runId: "run-x", taskId: "D01", attempt: 2 },
    model: gateModel,
  });
  await runtime.supervisor.recordWorkerSession({
    workerId: worker.workerId,
    hostSessionId: "ses-live",
  });
  commitTranscript(client, prepared.confirmation_block);
  const outcome = JSON.parse(
    await transitionAction(runtime, operatorContext({ messageID: "msg-commit" }), {
      action: "commit",
    })
  ) as { outcome: string; rejection: string };
  assert.equal(outcome.outcome, "cancelled");
  assert.match(outcome.rejection, /release or abort it before a transition/);
  assert.equal(await committedDecision(root), null);
});

test("status exposes the active run's approved facts so routine replies can cite them", async (t) => {
  const { runtime, client, root } = await fixture(t);
  await startRun(runtime, client);
  const run = await loadActiveRun(root);
  assert.ok(run);
  // A foreign-run fact must never surface for the active run.
  await runtime.supervisor.approveFact({
    runId: "run-FOREIGN",
    text: "Kickoff target repository: elsewhere",
    provenance: { kind: "kickoff", source: "another intake" },
  });

  const status = JSON.parse(await runAction(runtime, operatorContext(), { action: "status" })) as {
    run: { run_id: string };
    approved_facts: Array<{ id: string; text: string; provenance: string }>;
  };
  assert.ok(status.approved_facts.length >= 2, "kickoff facts are listed");
  const kickoff = status.approved_facts.find((fact) =>
    fact.text.includes("Kickoff target repository")
  );
  assert.ok(kickoff, "the kickoff fact is exposed with its id");
  assert.match(kickoff.provenance, /^kickoff:/);
  assert.ok(
    status.approved_facts.every((fact) => !fact.text.includes("elsewhere")),
    "facts from other runs are filtered out of status"
  );

  // The id taken from the public status output backs a routine reply.
  client.questions = [
    { id: "q-cite", sessionID: "ses-gate-1", questions: [{ question: "Repo?", header: "r" }] },
  ];
  await gateAction(runtime, operatorContext(), { action: "wait", timeoutSeconds: 1 });
  const pendingView = JSON.parse(
    await runAction(runtime, operatorContext(), { action: "status" })
  ) as { pending_request: { requestId: string } };
  const routine = JSON.parse(
    await gateAction(runtime, operatorContext(), {
      action: "question_reply",
      requestId: pendingView.pending_request.requestId,
      source: "approved-context",
      citedFactIds: [kickoff.id],
      answersJson: JSON.stringify([["the current project"]]),
    })
  ) as { outcome: string; citedFactIds: string[] };
  assert.equal(routine.outcome, "answered");
  assert.deepEqual(routine.citedFactIds, [kickoff.id]);
});

const VARIANT_POLICY: ModelRolePolicy = {
  operator: null,
  gate: { provider: "prov", model: "cheap-gate", variant: "low" },
};

async function variantFixture(t: { after(fn: () => Promise<void> | void): void }) {
  const base = await fixture(t);
  const runtime = createOperatorRuntime({
    client: base.runtime.client,
    directory: base.root,
    supervisor: base.supervisor,
    policy: VARIANT_POLICY,
  });
  return { ...base, runtime };
}

test("a configured gate variant is included at launch and verified from the reply", async (t) => {
  const { runtime, client, supervisor } = await variantFixture(t);
  await startRun(runtime, client);
  assert.equal((client.creates[0]?.model as { variant?: string }).variant, "low");
  assert.equal(client.prompts[0]?.variant, "low");

  exposeGateModel(client, "ses-gate-1", "low");
  client.statusBySession["ses-gate-1"] = { type: "busy" };
  const waited = JSON.parse(
    await gateAction(runtime, operatorContext(), { action: "wait", timeoutSeconds: 1 })
  ) as { model_verification: string };
  assert.equal(waited.model_verification, "verified");
  assert.equal(supervisor.getWorker()?.modelVerification, "verified");
});

test("a mismatched or missing gate variant fails closed after host revocation", async (t) => {
  for (const exposedVariant of ["high", undefined] as const) {
    const { runtime, client, supervisor } = await variantFixture(t);
    await startRun(runtime, client);
    exposeGateModel(client, "ses-gate-1", exposedVariant);
    await assert.rejects(
      gateAction(runtime, operatorContext(), { action: "wait", timeoutSeconds: 1 }),
      /variant/,
      `variant ${exposedVariant ?? "(missing)"} must be refused`
    );
    assert.deepEqual(client.aborts, ["ses-gate-1"], "the host session was revoked first");
    assert.equal(
      (client.updates[0]?.metadata as Record<string, unknown>).retrieval_gate_status,
      "retired",
    );
    assert.equal(supervisor.getWorker()?.status, "aborted");
    assert.equal(supervisor.getWorker()?.endReason, "model_mismatch");
  }
});

test("every exposed gate reply is rechecked, including replies after verification", async (t) => {
  const { runtime, client, supervisor } = await variantFixture(t);
  await startRun(runtime, client);
  exposeGateModel(client, "ses-gate-1", "low");
  await gateAction(runtime, operatorContext(), { action: "wait", timeoutSeconds: 1 });
  assert.equal(supervisor.getWorker()?.modelVerification, "verified");

  client.messagesBySession.get("ses-gate-1")?.push({
    info: {
      id: "ses-gate-1-a2",
      sessionID: "ses-gate-1",
      role: "assistant",
      providerID: "prov",
      modelID: "different-gate",
      variant: "low",
    },
    parts: [],
  });
  await assert.rejects(
    gateAction(runtime, operatorContext(), { action: "read" }),
    /configured model/,
  );
  assert.equal(supervisor.getWorker()?.status, "aborted");
  assert.equal(
    (client.updates.at(-1)?.metadata as Record<string, unknown>).retrieval_gate_status,
    "retired",
  );
});

test("a pinned operator model demands exposed matching metadata, including the variant", async (t) => {
  const { runtime: base, client } = await fixture(t);
  const pinned = createOperatorRuntime({
    client: base.client,
    directory: base.directory,
    supervisor: base.supervisor,
    policy: {
      operator: { provider: "prem", model: "premium-op", variant: "high" },
      gate: { provider: "prov", model: "cheap-gate" },
    },
  });

  // No exposed metadata for the executing message: fail closed.
  await assert.rejects(
    runAction(pinned, operatorContext(), { action: "status" }),
    /exposes no resolved model; refusing to operate unverified/
  );

  const expose = (info: Record<string, unknown>) =>
    client.messagesBySession.set(OPERATOR_SESSION, [
      { info: { id: "msg-current", sessionID: OPERATOR_SESSION, role: "assistant", ...info }, parts: [] },
    ]);

  // Wrong model.
  expose({ providerID: "prem", modelID: "other-model", variant: "high" });
  await assert.rejects(
    runAction(pinned, operatorContext(), { action: "status" }),
    /pins the operator role to prem\/premium-op/
  );

  // Right model, missing variant while the pin names one.
  expose({ providerID: "prem", modelID: "premium-op" });
  await assert.rejects(
    runAction(pinned, operatorContext(), { action: "status" }),
    /running variant \(none\)/
  );

  // Right model, wrong variant.
  expose({ providerID: "prem", modelID: "premium-op", variant: "low" });
  await assert.rejects(
    runAction(pinned, operatorContext(), { action: "status" }),
    /pins the operator role to variant high/
  );

  // Exact match operates.
  expose({ providerID: "prem", modelID: "premium-op", variant: "high" });
  const status = JSON.parse(await runAction(pinned, operatorContext(), { action: "status" })) as {
    operator_model: { variant?: string };
  };
  assert.equal(status.operator_model.variant, "high");
});

test("recovery refuses a persisted launch whose variant no longer matches the configured gate model", async (t) => {
  const { runtime, client, supervisor, root } = await variantFixture(t);
  await startRun(runtime, client);
  await supervisor.abortWorker({ reason: "simulated process interruption" });
  assert.equal(supervisor.getWorker()?.status, "aborted");

  // A delivered session is bound to the exact configured launch model. If
  // the operator retunes that policy before re-adoption, recovery refuses it.
  const retuned = createOperatorRuntime({
    client: runtime.client,
    directory: root,
    supervisor,
    policy: { operator: null, gate: { provider: "prov", model: "cheap-gate", variant: "high" } },
    recoveryStore: runtime.recoveryStore,
  });
  await assert.rejects(
    runAction(retuned, operatorContext(), { action: "recover" }),
    /provider\/model\/variant.*changed since the interrupted/
  );
  assert.equal(supervisor.getWorker()?.status, "aborted", "no worker was re-adopted");
  assert.equal(
    (client.updates.at(-1)?.metadata as Record<string, unknown>).retrieval_gate_status,
    "retired",
  );

  // A separate, unmodified delivered launch is re-adopted without sending a
  // duplicate kickoff into the same session.
  const second = await variantFixture(t);
  await startRun(second.runtime, second.client);
  await second.supervisor.abortWorker({ reason: "simulated process interruption" });
  const recovered = JSON.parse(
    await runAction(second.runtime, operatorContext(), { action: "recover" })
  ) as { outcome: string; kickoff_redelivered: boolean };
  assert.equal(recovered.outcome, "recovered");
  assert.equal(recovered.kickoff_redelivered, false);
  assert.equal(second.client.prompts.length, 1, "the delivered kickoff was not repeated");
  assert.equal(second.client.prompts[0]?.variant, "low", "the original launch used the configured variant");
  assert.equal(second.supervisor.getWorker()?.hostSessionId, "ses-gate-1");
});

test("recovery verifies every already-exposed reply before adopting a session", async (t) => {
  const { runtime, client, supervisor } = await variantFixture(t);
  await startRun(runtime, client);
  await supervisor.abortWorker({ reason: "simulated process interruption" });
  assert.equal(supervisor.getWorker()?.status, "aborted");

  exposeGateModel(client, "ses-gate-1", "low");
  client.messagesBySession.get("ses-gate-1")?.push({
    info: {
      id: "ses-gate-1-a2",
      sessionID: "ses-gate-1",
      role: "assistant",
      providerID: "prov",
      modelID: "cheap-gate",
      variant: "high",
    },
    parts: [],
  });
  await assert.rejects(
    runAction(runtime, operatorContext(), { action: "recover" }),
    /variant/
  );
  assert.equal(supervisor.getWorker()?.status, "aborted", "no worker was re-adopted");
  assert.equal(
    (client.updates.at(-1)?.metadata as Record<string, unknown>).retrieval_gate_status,
    "retired",
  );

  // A separate interrupted launch with only matching replies is recoverable.
  const second = await variantFixture(t);
  await startRun(second.runtime, second.client);
  await second.supervisor.abortWorker({ reason: "simulated process interruption" });
  exposeGateModel(second.client, "ses-gate-1", "low");
  const recovered = JSON.parse(
    await runAction(second.runtime, operatorContext(), { action: "recover" })
  ) as { outcome: string };
  assert.equal(recovered.outcome, "recovered");
  assert.equal(second.supervisor.getWorker()?.status, "active");
  assert.equal(second.supervisor.getWorker()?.modelVerification, "verified");
});

test("the plugin module exposes exactly the three operator tools", async () => {
  const module = (await import("./retrieval-operator-tools.ts")) as unknown as {
    default: {
      id: string;
      server: (input: unknown) => Promise<{ tool: Record<string, unknown> }>;
    };
  };
  assert.equal(module.default.id, "retrieval-meta-operator");
  const hooks = await module.default.server({
    directory: "/nonexistent",
    serverUrl: new URL("http://127.0.0.1:1"),
    client: {},
  });
  assert.deepEqual(Object.keys(hooks.tool).sort(), [
    "retrieval_meta_gate",
    "retrieval_meta_run",
    "retrieval_meta_transition",
  ]);
});

test("the optional loader exposes the meta tools when the generic package is installed", async () => {
  const module = (await import("./retrieval-operator-loader.ts")) as unknown as {
    default: {
      id: string;
      server: (input: unknown) => Promise<{ tool: Record<string, unknown> }>;
    };
  };
  assert.equal(module.default.id, "retrieval-meta-operator-loader");
  const hooks = await module.default.server({
    directory: "/nonexistent",
    serverUrl: new URL("http://127.0.0.1:1"),
    client: {},
  });
  assert.deepEqual(Object.keys(hooks.tool).sort(), [
    "retrieval_meta_gate",
    "retrieval_meta_run",
    "retrieval_meta_transition",
  ]);
});
