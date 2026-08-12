import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { loadActiveRun } from "../retrieval_agent_harness_phase_based/plugin-runtime.mjs";

const extensionModulePath = "../.pi/extensions/retrieval-meta-operator.ts";
const { PiMetaOperatorCore, createRealBindings, metaAttemptIsCurrent } = await import(extensionModulePath);
const { createGateToolGuard } = await import("../.pi/extensions/retrieval-phase.ts");

const WORKFLOW = {
  version: 2,
  workflow_id: "retrieval-agent-test-meta-pi",
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
      required_artifacts: [".sequence/d01-notes.json"]
    },
    {
      id: "D02",
      title: "Outcome and acceptance contract",
      phase: "technical-design",
      agent_prompt: "retrieval_agent_harness_phase_based/agents/D02.md",
      required: true,
      required_artifacts: []
    },
    {
      id: "BR",
      title: "Bounded repair",
      phase: "repair",
      agent_prompt: "retrieval_agent_harness_phase_based/agents/BR.md",
      required: false,
      required_artifacts: [],
      decision_routes: { approve: "D02" },
      max_attempts: 2
    }
  ]
};

class FakeWorkerHandle {
  aborted = false;
  disposed = false;
  sent = [];
  idle = true;
  asks = [];
  runFailure = null;

  constructor(sessionId, reported, options = {}) {
    this.sessionId = sessionId;
    this.sessionPath = `/tmp/fake-sessions/${sessionId}.jsonl`;
    this.reported = reported;
    this.thinking =
      options.effectiveThinking !== undefined
        ? options.effectiveThinking
        : (options.thinkingLevel ?? null);
    this.askOnKickoff = options.askOnKickoff ?? false;
    this.failKickoff = options.failKickoff ?? false;
    this.failAbort = options.failAbort ?? false;
    this.onRequest = options.onRequest ?? null;
  }

  reportedModel() {
    return this.reported;
  }

  effectiveThinkingLevel() {
    return this.thinking;
  }

  /** Resolves after "preflight"; a kickoff ask blocks the RUN, not send(). */
  async send(text) {
    if (this.failKickoff) {
      this.failKickoff = false;
      throw new Error("simulated kickoff delivery failure");
    }
    this.sent.push(text);
    if (this.askOnKickoff && this.onRequest && this.sent.length === 1) {
      this.idle = false;
      const ask = this.onRequest({
        kind: "question",
        payload: JSON.stringify({ question: "May I proceed with both sources?" })
      }).then((outcome) => {
        this.idle = true;
        return outcome;
      });
      this.asks.push(ask);
      ask.catch(() => {});
    }
  }

  isIdle() {
    return this.idle;
  }

  runError() {
    return this.runFailure;
  }

  /**
   * Matches Pi's AgentSession.abort(): it waits for the agent to become
   * idle, and a child blocked inside an unresolved ask_operator/permission
   * deferred never becomes idle on its own. An adapter that revokes before
   * resolving the deferred therefore deadlocks against this fake.
   */
  async abort() {
    this.aborted = true;
    if (this.failAbort) throw new Error("simulated child revocation failure");
    while (!this.idle) {
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
  }

  dispose() {
    this.disposed = true;
  }

  stats() {
    return { inputTokens: 120, outputTokens: 30, cost: 0.005 };
  }

  transcriptTail() {
    return this.sent.map((text) => ({ role: "user", text }));
  }
}

function fakeBindings(options = {}) {
  const record = {
    resolved: [],
    created: [],
    handles: [],
    onRequest: null,
    beforeCreate: options.beforeCreate ?? null
  };
  const bindings = {
    resolveGateModel(_ctx, ref) {
      record.resolved.push(ref);
      return { fakeModel: `${ref.provider}/${ref.model}` };
    },
    async createWorkerSession(input) {
      if (record.beforeCreate) await record.beforeCreate(input);
      record.created.push(input);
      const reported =
        options.reportedModel === undefined
          ? { provider: "prov", model: "cheap-gate" }
          : options.reportedModel;
      const sessionId = input.resumeSessionPath
        ? path.basename(input.resumeSessionPath, ".jsonl")
        : `pi-child-${record.created.length}`;
      const handle = new FakeWorkerHandle(sessionId, reported, {
        thinkingLevel: input.thinkingLevel,
        effectiveThinking:
          input.resumeSessionPath && options.clampRecoveryTo !== undefined
            ? options.clampRecoveryTo
            : Object.hasOwn(options, "effectiveThinking")
              ? options.effectiveThinking
              : undefined,
        askOnKickoff: options.askOnKickoff ?? false,
        failKickoff: options.failKickoff === true && record.created.length === 1,
        failAbort: options.failAbort === true && record.created.length === 1,
        onRequest: input.onRequest
      });
      record.handles.push(handle);
      // A real child asking through ask_operator is blocked inside the tool
      // call — it is not idle until the request resolves.
      record.onRequest = async (request) => {
        handle.idle = false;
        try {
          return await input.onRequest(request);
        } finally {
          handle.idle = true;
        }
      };
      return handle;
    }
  };
  return { bindings, record };
}

function fakeContext(root, overrides = {}) {
  const ui = {
    confirms: [],
    inputs: [],
    confirmAnswer: true,
    inputAnswer: "human answer",
    async confirm(title, message) {
      ui.confirms.push({ title, message });
      return ui.confirmAnswer;
    },
    async input(title, placeholder) {
      ui.inputs.push({ title, placeholder });
      return ui.inputAnswer;
    },
    notify() {}
  };
  return {
    cwd: root,
    mode: "tui",
    hasUI: true,
    ui,
    model: { provider: "prem", id: "premium-operator" },
    thinkingLevel: "high",
    sessionManager: { getSessionId: () => overrides.sessionId ?? "pi-parent-1" },
    isProjectTrusted: () => true,
    modelRegistry: undefined,
    ...overrides
  };
}

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "retrieval-meta-pi-"));
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
        `description: Focused ${gate.id} test gate.`,
        "mode: primary",
        "permission:",
        "  edit: allow",
        "---",
        `# ${gate.id}: ${gate.title}`,
        "",
      ].join("\n")
    );
  }
  await mkdir(path.join(root, ".pi"), { recursive: true });
  await writeFile(
    path.join(root, ".pi", "retrieval-operator-models.json"),
    `${JSON.stringify(
      {
        version: 1,
        operator: null,
        gate: { provider: "prov", modelId: "cheap-gate", thinkingLevel: "off" }
      },
      null,
      2
    )}\n`
  );
  return { root };
}

async function startRun(core, ctx) {
  const output = JSON.parse(
    await core.runAction(ctx, {
      action: "start",
      targetRepoPath: ctx.cwd,
      initialIdea: "Build a small, safe Retrieval agent."
    })
  );
  assert.equal(output.kind, "launched");
  assert.equal(output.launched_gate, "D01");
}

async function writeReadyResult(root) {
  const run = await loadActiveRun(root);
  assert.ok(run?.state.current_attempt, "an attempt must be active");
  await mkdir(path.join(root, ".sequence"), { recursive: true });
  await writeFile(path.join(root, ".sequence", "d01-notes.json"), `{"notes":"d01"}\n`);
  const result = {
    gate_id: "D01",
    recommendation: "approve",
    summary: "D01 completed",
    artifacts: [{ path: ".sequence/d01-notes.json", role: "required output" }],
    evidence: [],
    uncertainties: [],
    blockers: []
  };
  const absolute = path.join(run.runDir, run.state.current_attempt.result_path);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, `${JSON.stringify(result, null, 2)}\n`);
}

async function committedDecision(root) {
  const run = await loadActiveRun(root);
  return run?.state.last_decision ?? null;
}

test("start collects human-confirmed intake and launches one worker on the exact cheap model", async (t) => {
  const { root } = await fixture(t);
  const { bindings, record } = fakeBindings();
  const core = new PiMetaOperatorCore(bindings);
  const ctx = fakeContext(root);

  // Model-supplied intake args must be exactly confirmed by the human first.
  ctx.ui.confirmAnswer = false;
  const declined = JSON.parse(
    await core.runAction(ctx, {
      action: "start",
      targetRepoPath: root,
      initialIdea: "Build a small, safe Retrieval agent."
    })
  );
  assert.equal(declined.outcome, "cancelled");
  assert.equal(record.created.length, 0, "no worker may exist without human confirmation");
  assert.equal(await loadActiveRun(root), null, "no run may exist without human confirmation");
  assert.match(ctx.ui.confirms[0].message, /Build a small, safe Retrieval agent\./);

  ctx.ui.confirmAnswer = true;
  await startRun(core, ctx);

  assert.deepEqual(record.resolved, [{ provider: "prov", model: "cheap-gate", variant: "off" }]);
  assert.equal(record.created.length, 1);
  assert.deepEqual(record.created[0].model, { fakeModel: "prov/cheap-gate" });
  assert.equal(record.created[0].thinkingLevel, "off");
  assert.match(record.created[0].systemPrompt, /Pi meta-operated gate boundary/);
  assert.ok(
    record.created[0].guard.editableFiles.includes(record.created[0].guard.gateResultFile),
    "the gate result file must be editable"
  );

  const run = await loadActiveRun(root);
  assert.equal(run?.state.current_attempt?.session.id, "pi-child-1");
  assert.equal(run?.state.current_attempt?.session.host, "pi");
  assert.equal(run?.state.current_attempt?.session.mode, "meta");
  assert.match(run?.state.current_attempt?.launch_id, /^[0-9a-f]{24}$/);
  assert.equal(record.created[0].attempt.launchId, run?.state.current_attempt?.launch_id);

  const status = JSON.parse(await core.runAction(ctx, { action: "status" }));
  assert.equal(status.worker.status, "active");
  assert.equal(status.worker.modelVerification, "verified");
  assert.equal(record.handles[0].sent.length, 1, "the packet message reached the worker");
  assert.ok(
    status.approved_facts.some((fact) => fact.text.includes("Kickoff target repository")),
    "status lists approved fact ids for routine citations"
  );
});

test("a meta child tool guard rejects a replaced immutable launch before any tool runs", async (t) => {
  const { root } = await fixture(t);
  const { bindings, record } = fakeBindings();
  const core = new PiMetaOperatorCore(bindings);
  const ctx = fakeContext(root);
  await startRun(core, ctx);

  const run = await loadActiveRun(root);
  const expected = record.created[0].attempt;
  const sessionId = run.state.current_attempt.session.id;
  let approvalRequests = 0;
  const guard = createGateToolGuard({
    projectRoot: root,
    gateResultFile: record.created[0].guard.gateResultFile,
    editableFiles: record.created[0].guard.editableFiles,
    collaborativeEditPaths: record.created[0].guard.collaborativeEditPaths,
    verifyCurrentAttempt: () =>
      metaAttemptIsCurrent(root, expected, sessionId, run.state.current_attempt.session.path ?? null),
    requestBashApproval: async () => {
      approvalRequests += 1;
      return { approved: true };
    }
  });

  assert.equal(
    await guard({ toolName: "write", input: { path: ".sequence/d01-notes.json" } }),
    undefined,
    "the exact current launch retains its packet authority"
  );

  const replaced = structuredClone(run.state);
  replaced.current_attempt.launch_id = "ffffffffffffffffffffffff";
  await writeFile(
    path.join(run.runDir, "workflow-state.json"),
    `${JSON.stringify(replaced, null, 2)}\n`
  );
  const stale = await guard({ toolName: "bash", input: { command: "true" } });
  assert.equal(stale?.block, true);
  assert.match(stale?.reason, /stale Retrieval meta gate session/);
  assert.equal(approvalRequests, 0, "a stale child is blocked before permission relay");
});

test("a meta child rechecks its full immutable launch after awaited bash approval", async (t) => {
  const { root } = await fixture(t);
  const { bindings, record } = fakeBindings();
  const core = new PiMetaOperatorCore(bindings);
  const ctx = fakeContext(root);
  await startRun(core, ctx);

  const run = await loadActiveRun(root);
  const expected = record.created[0].attempt;
  const session = run.state.current_attempt.session;
  let releaseApproval;
  let approvalOpened;
  const opened = new Promise((resolve) => {
    approvalOpened = resolve;
  });
  const approved = new Promise((resolve) => {
    releaseApproval = resolve;
  });
  const guard = createGateToolGuard({
    projectRoot: root,
    gateResultFile: record.created[0].guard.gateResultFile,
    editableFiles: record.created[0].guard.editableFiles,
    collaborativeEditPaths: record.created[0].guard.collaborativeEditPaths,
    verifyCurrentAttempt: () =>
      metaAttemptIsCurrent(root, expected, session.id, session.path ?? null),
    requestBashApproval: async () => {
      approvalOpened();
      return await approved;
    }
  });

  const guarded = guard({ toolName: "bash", input: { command: "printf safe" } });
  await opened;
  const replaced = structuredClone(run.state);
  replaced.current_attempt.launch_id = "ffffffffffffffffffffffff";
  await writeFile(
    path.join(run.runDir, "workflow-state.json"),
    `${JSON.stringify(replaced, null, 2)}\n`
  );
  releaseApproval({ approved: true });

  const result = await guarded;
  assert.equal(result?.block, true);
  assert.match(result?.reason, /stale Retrieval meta gate session.*after approval/);
});

test("kickoff values typed by the human in the TUI become the intake when no args are given", async (t) => {
  const { root } = await fixture(t);
  const { bindings, record } = fakeBindings();
  const core = new PiMetaOperatorCore(bindings);
  const ctx = fakeContext(root);
  const answers = [root, "An idea typed by the human."];
  ctx.ui.input = async (title, placeholder) => {
    ctx.ui.inputs.push({ title, placeholder });
    return answers.shift();
  };
  const output = JSON.parse(await core.runAction(ctx, { action: "start" }));
  assert.equal(output.kind, "launched");
  assert.equal(record.created.length, 1);
  const status = JSON.parse(await core.runAction(ctx, { action: "status" }));
  assert.ok(
    status.approved_facts.some((fact) => fact.text.includes("An idea typed by the human.")),
    "the human-typed idea is the approved kickoff fact"
  );
});

test("launch returns during the child's initial prompt; the parent answers later and the same child resumes", async (t) => {
  const { root } = await fixture(t);
  const { bindings, record } = fakeBindings({ askOnKickoff: true });
  const core = new PiMetaOperatorCore(bindings);
  const ctx = fakeContext(root);

  // With a child that asks during its initial prompt, start must still return:
  // the kickoff is delivered asynchronously and never holds the action queue
  // for the full model run.
  await startRun(core, ctx);
  const child = record.handles[0];
  assert.equal(child.sent.length, 1);
  assert.equal(child.isIdle(), false, "the child is blocked inside ask_operator");

  const waited = JSON.parse(await core.gateAction(ctx, { action: "wait", timeoutSeconds: 2 }));
  assert.equal(waited.outcome, "question");

  ctx.ui.inputAnswer = "Yes — proceed with both sources.";
  const replied = JSON.parse(
    await core.gateAction(ctx, {
      action: "question_reply",
      requestId: waited.request.requestId,
      source: "human"
    })
  );
  assert.equal(replied.outcome, "answered");

  const outcome = await child.asks[0];
  assert.equal(outcome.approved, true);
  assert.equal(outcome.answer, "Yes — proceed with both sources.");
  assert.equal(child.isIdle(), true, "the same child resumed after the answer");
  assert.equal(core.workerHandle, child, "the same in-memory child is still bound");

  // The same child keeps receiving follow-ups afterwards.
  await core.gateAction(ctx, { action: "send", message: "carry on" });
  assert.equal(child.sent.length, 2);
});

test("a mismatched resolved worker model revokes the child before the record turns terminal", async (t) => {
  const { root } = await fixture(t);
  const { bindings, record } = fakeBindings({
    reportedModel: { provider: "prov", model: "premium-oops" }
  });
  const core = new PiMetaOperatorCore(bindings);
  const ctx = fakeContext(root);
  await assert.rejects(
    core.runAction(ctx, {
      action: "start",
      targetRepoPath: root,
      initialIdea: "idea"
    }),
    /model mismatch: configured/
  );
  assert.equal(record.handles[0].aborted, true);
  assert.equal(record.handles[0].disposed, true);
  const status = JSON.parse(await core.runAction(ctx, { action: "status" }));
  assert.equal(status.worker.status, "aborted");
  assert.equal(status.worker.endReason, "model_mismatch");
});

test("a missing resolved gate identity or effective thinking level fails closed", async (t) => {
  for (const options of [
    { reportedModel: null },
    { effectiveThinking: null },
  ]) {
    const { root } = await fixture(t);
    const { bindings, record } = fakeBindings(options);
    const core = new PiMetaOperatorCore(bindings);
    await assert.rejects(
      core.runAction(fakeContext(root), {
        action: "start",
        targetRepoPath: root,
        initialIdea: "idea",
      }),
      /exposed no resolved gate model|effective \(unexposed\)/,
    );
    assert.equal(record.handles[0].aborted, true);
    assert.equal(record.handles[0].disposed, true);
    const status = JSON.parse(await core.runAction(fakeContext(root), { action: "status" }));
    assert.equal(status.worker.status, "aborted");
  }
});

test("a missing gate model fails closed before any worker is created", async (t) => {
  const { root } = await fixture(t);
  await writeFile(
    path.join(root, ".pi", "retrieval-operator-models.json"),
    `${JSON.stringify({ version: 1, operator: null, gate: null }, null, 2)}\n`
  );
  const { bindings, record } = fakeBindings();
  const core = new PiMetaOperatorCore(bindings);
  await assert.rejects(
    core.runAction(fakeContext(root), { action: "start", targetRepoPath: root, initialIdea: "x" }),
    /no gate model is configured/
  );
  assert.equal(record.created.length, 0);
});

test("an invalid thinking level and an absent operator model both fail closed", async (t) => {
  const { root } = await fixture(t);
  await writeFile(
    path.join(root, ".pi", "retrieval-operator-models.json"),
    `${JSON.stringify(
      { version: 1, operator: null, gate: { provider: "prov", modelId: "cheap-gate", thinkingLevel: "turbo" } },
      null,
      2
    )}\n`
  );
  const core = new PiMetaOperatorCore(fakeBindings().bindings);
  await assert.rejects(
    core.runAction(fakeContext(root), { action: "status" }),
    /not a Pi thinking level/
  );

  const pinned = await fixture(t);
  await writeFile(
    path.join(pinned.root, ".pi", "retrieval-operator-models.json"),
    `${JSON.stringify(
      {
        version: 1,
        operator: { provider: "prem", modelId: "premium-operator" },
        gate: { provider: "prov", modelId: "cheap-gate" }
      },
      null,
      2
    )}\n`
  );
  const pinnedCore = new PiMetaOperatorCore(fakeBindings().bindings);
  await assert.rejects(
    pinnedCore.runAction(fakeContext(pinned.root, { model: undefined }), { action: "status" }),
    /has no model; refusing to operate/
  );
});

test("a pinned Pi operator thinking level must be exposed and match exactly", async (t) => {
  const { root } = await fixture(t);
  await writeFile(
    path.join(root, ".pi", "retrieval-operator-models.json"),
    `${JSON.stringify(
      {
        version: 1,
        operator: { provider: "prem", modelId: "premium-operator", thinkingLevel: "high" },
        gate: { provider: "prov", modelId: "cheap-gate", thinkingLevel: "off" },
      },
      null,
      2,
    )}\n`,
  );
  for (const thinkingLevel of [undefined, "low"]) {
    const core = new PiMetaOperatorCore(fakeBindings().bindings);
    await assert.rejects(
      core.runAction(fakeContext(root, { thinkingLevel }), { action: "status" }),
      /pins the operator role to thinking level high/,
    );
    await core.shutdown("test cleanup");
  }
  const core = new PiMetaOperatorCore(fakeBindings().bindings);
  const status = JSON.parse(
    await core.runAction(fakeContext(root, { thinkingLevel: "high" }), { action: "status" }),
  );
  assert.equal(status.operator_model.variant, "high");
});

test("child questions relay through the correlated request; routine answers need run-scoped citations", async (t) => {
  const { root } = await fixture(t);
  const { bindings, record } = fakeBindings();
  const core = new PiMetaOperatorCore(bindings);
  const ctx = fakeContext(root);
  await startRun(core, ctx);

  const answerPromise = record.onRequest({
    kind: "question",
    payload: JSON.stringify({ question: "May I record both sources?" })
  });
  const waited = JSON.parse(await core.gateAction(ctx, { action: "wait", timeoutSeconds: 1 }));
  assert.equal(waited.outcome, "question");
  const requestId = waited.request.requestId;

  await assert.rejects(
    core.gateAction(ctx, {
      action: "question_reply",
      requestId,
      source: "approved-context",
      citedFactIds: [],
      answer: "yes"
    }),
    /routine answer must cite at least one approved-context fact/
  );

  // A fact belonging to another run can never back a routine answer.
  const status = JSON.parse(await core.runAction(ctx, { action: "status" }));
  const factId = status.approved_facts[0].id;
  const { readFile } = await import("node:fs/promises");
  const persisted = JSON.parse(
    await readFile(path.join(root, ".pi", ".retrieval-meta", "state.json"), "utf8")
  );
  assert.ok(persisted.facts.every((fact) => fact.runId === status.run.run_id));

  const factsReply = JSON.parse(
    await core.gateAction(ctx, {
      action: "question_reply",
      requestId,
      source: "approved-context",
      citedFactIds: [factId],
      answer: "Yes — record both sources; the kickoff repository is the current project."
    })
  );
  assert.equal(factsReply.outcome, "answered");
  const outcome = await answerPromise;
  assert.equal(outcome.approved, true);
  assert.match(outcome.answer, /Provenance: kickoff/);
});

test("material questions show the exact question and are answered by the human via the parent TUI", async (t) => {
  const { root } = await fixture(t);
  const { bindings, record } = fakeBindings();
  const core = new PiMetaOperatorCore(bindings);
  const ctx = fakeContext(root);
  await startRun(core, ctx);

  const answerPromise = record.onRequest({
    kind: "question",
    payload: JSON.stringify({ question: "Should I invent the latest Retrieval version?" })
  });
  const waited = JSON.parse(await core.gateAction(ctx, { action: "wait", timeoutSeconds: 1 }));
  ctx.ui.inputAnswer = "Do not invent a version; record the conflict.";
  const replied = JSON.parse(
    await core.gateAction(ctx, {
      action: "question_reply",
      requestId: waited.request.requestId,
      source: "human"
    })
  );
  assert.equal(replied.outcome, "answered");
  assert.match(
    ctx.ui.inputs[ctx.ui.inputs.length - 1].title,
    /Should I invent the latest Retrieval version\?/,
    "the input dialog must show the exact material question"
  );
  const outcome = await answerPromise;
  assert.equal(outcome.answer, "Do not invent a version; record the conflict.");

  // Non-TUI contexts must fail closed for human-required actions.
  const headless = fakeContext(root, { mode: "print", hasUI: false });
  const second = record.onRequest({
    kind: "question",
    payload: JSON.stringify({ question: "Another material question?" })
  });
  await core.gateAction(ctx, { action: "wait", timeoutSeconds: 1 });
  const pending = JSON.parse(await core.gateAction(ctx, { action: "read" })).pending_request;
  await assert.rejects(
    core.gateAction(headless, {
      action: "question_reply",
      requestId: pending.requestId,
      source: "human"
    }),
    /requires the interactive Pi TUI/
  );
  // Clean up: reject so the deferred resolves.
  await core.gateAction(ctx, {
    action: "question_reject",
    requestId: pending.requestId,
    reason: "test cleanup"
  });
  const secondOutcome = await second;
  assert.equal(secondOutcome.approved, false);
});

test("an oversized child payload is rejected outright and never truncated into an approval", async (t) => {
  const { root } = await fixture(t);
  const { bindings, record } = fakeBindings();
  const core = new PiMetaOperatorCore(bindings);
  const ctx = fakeContext(root);
  await startRun(core, ctx);

  const outcome = await record.onRequest({
    kind: "permission",
    payload: JSON.stringify({ permission: "bash", command: "x".repeat(20_000) })
  });
  assert.equal(outcome.approved, false);
  assert.match(outcome.reason, /rejected because approvals must bind the complete payload/);
  const status = JSON.parse(await core.runAction(ctx, { action: "status" }));
  assert.equal(status.pending_request, null, "no correlated request was opened");
});

test("permission approval shows the complete recorded command and its hash in the parent TUI", async (t) => {
  const { root } = await fixture(t);
  const { bindings, record } = fakeBindings();
  const core = new PiMetaOperatorCore(bindings);
  const ctx = fakeContext(root);
  await startRun(core, ctx);

  const payload = JSON.stringify({ permission: "bash", command: "python -m pytest -q" });
  const verdictPromise = record.onRequest({ kind: "permission", payload });
  const waited = JSON.parse(await core.gateAction(ctx, { action: "wait", timeoutSeconds: 1 }));
  assert.equal(waited.outcome, "permission");

  ctx.ui.confirmAnswer = true;
  const approved = JSON.parse(
    await core.gateAction(ctx, { action: "permission_reply", requestId: waited.request.requestId })
  );
  assert.equal(approved.outcome, "approved_once");
  const dialog = ctx.ui.confirms[ctx.ui.confirms.length - 1];
  assert.ok(dialog.message.includes(payload), "the dialog shows the complete recorded payload");
  const { createHash } = await import("node:crypto");
  const digest = createHash("sha256").update(Buffer.from(payload, "utf8")).digest("hex");
  assert.ok(dialog.message.includes(digest), "the dialog shows the payload hash");
  const verdict = await verdictPromise;
  assert.equal(verdict.approved, true);

  // Human decline path.
  const denied = record.onRequest({
    kind: "permission",
    payload: JSON.stringify({ permission: "bash", command: "rm -rf /" })
  });
  await core.gateAction(ctx, { action: "wait", timeoutSeconds: 1 });
  const pending = JSON.parse(await core.gateAction(ctx, { action: "read" })).pending_request;
  ctx.ui.confirmAnswer = false;
  const declined = JSON.parse(
    await core.gateAction(ctx, { action: "permission_reply", requestId: pending.requestId })
  );
  assert.equal(declined.outcome, "declined_by_human");
  const deniedVerdict = await denied;
  assert.equal(deniedVerdict.approved, false);
});

test("the serial invariant rejects a second concurrent child request", async (t) => {
  const { root } = await fixture(t);
  const { bindings, record } = fakeBindings();
  const core = new PiMetaOperatorCore(bindings);
  const ctx = fakeContext(root);
  await startRun(core, ctx);

  const first = record.onRequest({ kind: "question", payload: "{}" });
  await core.gateAction(ctx, { action: "wait", timeoutSeconds: 1 });
  await assert.rejects(record.onRequest({ kind: "question", payload: "{}" }), /already pending/);
  const pending = JSON.parse(await core.gateAction(ctx, { action: "read" })).pending_request;
  await core.gateAction(ctx, { action: "question_reject", requestId: pending.requestId, reason: "cleanup" });
  await first;
});

test("abort revokes the child first, denies the pending deferred, and records usage", async (t) => {
  const { root } = await fixture(t);
  const { bindings, record } = fakeBindings();
  const core = new PiMetaOperatorCore(bindings);
  const ctx = fakeContext(root);
  await startRun(core, ctx);

  const verdictPromise = record.onRequest({
    kind: "permission",
    payload: JSON.stringify({ permission: "bash", command: "sleep 999" })
  });
  await core.gateAction(ctx, { action: "wait", timeoutSeconds: 1 });
  const aborted = JSON.parse(await core.gateAction(ctx, { action: "abort", reason: "operator revoke" }));
  assert.equal(aborted.outcome, "aborted");
  assert.equal(aborted.interrupted_request.status, "interrupted");
  const verdict = await verdictPromise;
  assert.equal(verdict.approved, false);
  assert.equal(record.handles[0].aborted, true);
  assert.equal(record.handles[0].disposed, true);

  const status = JSON.parse(await core.runAction(ctx, { action: "status" }));
  assert.equal(status.worker.status, "aborted");
  assert.equal(status.gate_usage.gate.entries, 1, "final usage is recorded at abort");
  assert.equal(
    JSON.parse(await readFile(path.join(root, ".pi", ".retrieval-meta", "launch-recovery.json"), "utf8")),
    null,
    "an explicit abort invalidates session recovery material",
  );
});

test("release requires an idle verified child and a ready result for the same session", async (t) => {
  const { root } = await fixture(t);
  const { bindings, record } = fakeBindings();
  const core = new PiMetaOperatorCore(bindings);
  const ctx = fakeContext(root);
  await startRun(core, ctx);

  // Busy child: refuse.
  record.handles[0].idle = false;
  await assert.rejects(
    core.gateAction(ctx, { action: "release", reason: "done" }),
    /still working/
  );
  record.handles[0].idle = true;

  // No ready result: refuse.
  await assert.rejects(
    core.gateAction(ctx, { action: "release", reason: "done" }),
    /release requires a ready gate result/
  );

  await writeReadyResult(root);
  const released = JSON.parse(await core.gateAction(ctx, { action: "release", reason: "result ready" }));
  assert.equal(released.outcome, "released");
  assert.equal(released.worker.status, "finished");
  assert.equal(record.handles[0].disposed, true);
});

test("session_shutdown cleanup is idempotent: child revoked, deferred denied, interruption persisted", async (t) => {
  const { root } = await fixture(t);
  const { bindings, record } = fakeBindings();
  const core = new PiMetaOperatorCore(bindings);
  const ctx = fakeContext(root);
  await startRun(core, ctx);

  const askPromise = record.onRequest({
    kind: "question",
    payload: JSON.stringify({ question: "still there?" })
  });
  await core.gateAction(ctx, { action: "wait", timeoutSeconds: 1 });

  assert.equal(await core.shutdown("pi session shutdown (quit)"), "complete");
  const askOutcome = await askPromise;
  assert.equal(askOutcome.approved, false);
  assert.match(askOutcome.reason, /shut down/);
  assert.equal(record.handles[0].aborted, true);
  assert.equal(record.handles[0].disposed, true);

  // A second shutdown is a no-op.
  assert.equal(await core.shutdown("pi session shutdown (quit)"), "complete");

  // The interruption is persisted terminally; a fresh core sees no live work.
  const fresh = new PiMetaOperatorCore(fakeBindings().bindings);
  const status = JSON.parse(await fresh.runAction(fakeContext(root), { action: "status" }));
  assert.equal(status.worker.status, "aborted");
  assert.match(status.worker.endReason, /shutdown/);
  assert.equal(status.pending_request, null);
  assert.equal(status.recovered_interruptions.length, 0);
});

/** Ownership identity of a successor whose previous owner is genuinely dead. */
function deadOwnerSuccessor() {
  return { pid: 424_242, hostname: os.hostname(), isAlive: () => false };
}

test("a live same-process owner blocks a second core; a dead owner's work recovers honestly", async (t) => {
  const { root } = await fixture(t);
  const { bindings } = fakeBindings();
  const core = new PiMetaOperatorCore(bindings);
  const ctx = fakeContext(root);
  await startRun(core, ctx);

  // Two live supervisor instances — even in the same PID — never both own.
  await assert.rejects(
    new PiMetaOperatorCore(fakeBindings().bindings).runAction(fakeContext(root), {
      action: "status"
    }),
    /owned by live process/
  );
  const live = JSON.parse(await core.runAction(ctx, { action: "status" }));
  assert.equal(live.worker.status, "active", "the live owner's worker was untouched");

  // A successor of a genuinely dead owner recovers with honest interruption.
  const successor = new PiMetaOperatorCore(fakeBindings().bindings, {
    ownership: deadOwnerSuccessor()
  });
  const status = JSON.parse(await successor.runAction(fakeContext(root), { action: "status" }));
  assert.equal(status.worker.status, "interrupted");
  assert.equal(status.recovered_interruptions.length, 1);
  assert.equal(status.worker_in_memory, false);
});

test("a failed child revocation retains its handle and ownership for a safe shutdown retry", async (t) => {
  const { root } = await fixture(t);
  const { bindings, record } = fakeBindings();
  const core = new PiMetaOperatorCore(bindings);
  const ctx = fakeContext(root);
  await startRun(core, ctx);

  const askPromise = record.onRequest({
    kind: "question",
    payload: JSON.stringify({ question: "still there?" })
  });
  await core.gateAction(ctx, { action: "wait", timeoutSeconds: 1 });
  const handle = record.handles[0];
  let abortAttempts = 0;
  handle.abort = async () => {
    abortAttempts += 1;
    handle.aborted = true;
    if (abortAttempts === 1) throw new Error("simulated abort failure");
  };

  assert.equal(
    await core.shutdown("pi session shutdown (crash)"),
    "revocation_failed"
  );
  const askOutcome = await askPromise;
  assert.equal(askOutcome.approved, false, "the child deferred was still denied");

  const { readFile } = await import("node:fs/promises");
  const persisted = JSON.parse(
    await readFile(path.join(root, ".pi", ".retrieval-meta", "state.json"), "utf8")
  );
  assert.equal(persisted.request, null);
  assert.equal(
    persisted.requestLog.at(-1)?.status,
    "interrupted",
    "the request interruption is persisted even though revocation failed"
  );
  assert.equal(
    persisted.worker.status,
    "active",
    "the worker record must stay non-terminal while the child may still run"
  );
  assert.equal(abortAttempts, 1);
  assert.equal(core.workerHandle, handle, "the exact child handle remains available for revocation retry");
  assert.equal(handle.disposed, false, "failed revocation must not dispose or discard the child handle");

  const retained = JSON.parse(await core.runAction(ctx, { action: "status" }));
  assert.equal(retained.worker.status, "active", "the original supervisor remains usable");
  assert.equal(retained.worker_in_memory, true, "status still reports the retained child handle");

  // Ownership was not released: a second live core fails closed.
  await assert.rejects(
    new PiMetaOperatorCore(fakeBindings().bindings).runAction(fakeContext(root), {
      action: "status"
    }),
    /owned by live process/
  );

  // Retrying shutdown reuses the retained handle, revokes it, terminalizes the
  // same supervisor worker, and only then releases ownership.
  assert.equal(await core.shutdown("pi session shutdown retry"), "complete");
  assert.equal(abortAttempts, 2);
  assert.equal(handle.disposed, true);
  assert.equal(core.workerHandle, null);

  const successor = new PiMetaOperatorCore(fakeBindings().bindings);
  const status = JSON.parse(await successor.runAction(fakeContext(root), { action: "status" }));
  assert.equal(status.worker.status, "aborted");
  assert.match(status.worker.endReason, /shutdown retry/);
  assert.equal(status.worker_in_memory, false);
});

test("recover resumes the exact recorded session file and re-delivers a lost kickoff", async (t) => {
  const { root } = await fixture(t);
  const { bindings, record } = fakeBindings({ failKickoff: true });
  const core = new PiMetaOperatorCore(bindings);
  const ctx = fakeContext(root);

  await assert.rejects(startRun(core, ctx), /simulated kickoff delivery failure/);
  assert.equal(record.handles[0].aborted, true, "the child was revoked before terminalizing");
  const wedged = await loadActiveRun(root);
  assert.equal(wedged?.state.current_attempt?.session.id, "pi-child-1", "the runtime recorded the attempt");
  assert.equal(record.handles[0].sent.length, 0, "the kickoff never reached the child");

  const recovered = JSON.parse(await core.runAction(ctx, { action: "recover" }));
  assert.equal(recovered.outcome, "recovered");
  assert.equal(recovered.readopted_session, "pi-child-1");
  assert.equal(recovered.kickoff_redelivered, true);
  const resumed = record.handles[1];
  assert.equal(resumed.sessionId, "pi-child-1", "the same persisted session file was resumed");
  assert.equal(record.created[1].resumeSessionPath, record.handles[0].sessionPath);
  assert.equal(resumed.sent.length, 1, "the persisted kickoff was re-delivered exactly once");
  const status = JSON.parse(await core.runAction(ctx, { action: "status" }));
  assert.equal(status.worker.status, "active");
  const after = await loadActiveRun(root);
  assert.equal(after?.state.current_attempt?.number, 1, "no duplicate attempt was launched");

  // Recovery refuses while a worker is live.
  await assert.rejects(
    core.runAction(ctx, { action: "recover" }),
    /recovery applies only to interrupted work/
  );
});

test("a failed kickoff whose child cannot be revoked preserves the exact pending launch", async (t) => {
  const { root } = await fixture(t);
  const { bindings, record } = fakeBindings({ failKickoff: true, failAbort: true });
  const core = new PiMetaOperatorCore(bindings);
  const ctx = fakeContext(root);

  await assert.rejects(
    startRun(core, ctx),
    /launch failed \(simulated kickoff delivery failure\) and cleanup could not complete: simulated child revocation failure/
  );

  const run = await loadActiveRun(root);
  assert.equal(run?.state.current_attempt?.delivery_status, "pending");
  assert.equal(run?.state.current_attempt?.session.id, "pi-child-1");
  assert.equal(run?.state.current_attempt?.session.mode, "meta");
  assert.equal(run?.state.current_attempt?.launch_id, record.created[0].attempt.launchId);
  assert.equal(record.handles[0].disposed, false, "the adapter does not claim failed revocation succeeded");
  const status = JSON.parse(await core.runAction(ctx, { action: "status" }));
  assert.equal(status.worker.status, "active", "the possibly live worker remains non-terminal");
});

test("recovery rejects a trusted record bound to another launch id", async (t) => {
  const { root } = await fixture(t);
  const { bindings, record } = fakeBindings({ failKickoff: true });
  const core = new PiMetaOperatorCore(bindings);
  const ctx = fakeContext(root);
  await assert.rejects(startRun(core, ctx), /simulated kickoff delivery failure/);

  const recoveryPath = path.join(root, ".pi", ".retrieval-meta", "launch-recovery.json");
  const recovery = JSON.parse(await readFile(recoveryPath, "utf8"));
  recovery.launch_id = "another-launch-id";
  await writeFile(recoveryPath, `${JSON.stringify(recovery, null, 2)}\n`);

  await assert.rejects(
    core.runAction(ctx, { action: "recover" }),
    /no trusted launch-recovery record matches the recorded attempt/
  );
  assert.equal(record.created.length, 1, "a mismatched recovery record creates no replacement child");
});

test("recovery verifies the post-clamp effective thinking level and fails closed on mismatch", async (t) => {
  const { root } = await fixture(t);
  // The resumed child clamps the configured "off" level to "high".
  const { bindings, record } = fakeBindings({ failKickoff: true, clampRecoveryTo: "high" });
  const core = new PiMetaOperatorCore(bindings);
  const ctx = fakeContext(root);
  await assert.rejects(startRun(core, ctx), /simulated kickoff delivery failure/);

  await assert.rejects(
    core.runAction(ctx, { action: "recover" }),
    /recovery thinking level mismatch: configured off, effective high/
  );
  assert.equal(record.handles[1].aborted, true, "the clamped child was revoked");
  assert.equal(record.handles[1].disposed, true);
  const status = JSON.parse(await core.runAction(ctx, { action: "status" }));
  assert.equal(status.worker.status, "aborted");
  assert.equal(status.worker.endReason, "model_mismatch");
  assert.equal(status.worker_in_memory, false, "no clamped child stays bound");
});

test("recovery refuses a persisted launch whose thinking level no longer matches the configured gate", async (t) => {
  const { root } = await fixture(t);
  const { bindings } = fakeBindings({ failKickoff: true });
  const core = new PiMetaOperatorCore(bindings);
  const ctx = fakeContext(root);
  await assert.rejects(startRun(core, ctx), /simulated kickoff delivery failure/);
  await core.shutdown("test restart");

  await writeFile(
    path.join(root, ".pi", "retrieval-operator-models.json"),
    `${JSON.stringify(
      {
        version: 1,
        operator: null,
        gate: { provider: "prov", modelId: "cheap-gate", thinkingLevel: "low" }
      },
      null,
      2
    )}\n`
  );
  const retuned = new PiMetaOperatorCore(fakeBindings().bindings);
  await assert.rejects(
    retuned.runAction(fakeContext(root), { action: "recover" }),
    /thinking level changed since the interrupted launch/
  );
  const status = JSON.parse(await retuned.runAction(fakeContext(root), { action: "status" }));
  assert.equal(status.worker.status, "aborted", "no worker was re-adopted");
});

test("commit shows the full exact canonical bytes, revalidates, commits state, then launches D02 cheap", async (t) => {
  const { root } = await fixture(t);
  let stateAtCreate = null;
  const { bindings, record } = fakeBindings({
    beforeCreate: async (input) => {
      if (record.created.length === 1) {
        stateAtCreate = (await loadActiveRun(root))?.state ?? null;
        assert.match(input.systemPrompt, /D02/);
      }
    }
  });
  const core = new PiMetaOperatorCore(bindings);
  const ctx = fakeContext(root);
  await startRun(core, ctx);
  await writeReadyResult(root);

  // Prepare refuses while the worker is live.
  await assert.rejects(
    core.transitionAction(ctx, { action: "prepare", decision: "approve" }),
    /revoke it before committing/
  );
  await core.gateAction(ctx, { action: "release", reason: "result ready" });

  const prepared = JSON.parse(await core.transitionAction(ctx, { action: "prepare", decision: "approve" }));
  assert.equal(prepared.outcome, "prepared");
  assert.equal(prepared.display.consequence.gate_id, "D02");
  assert.equal(prepared.display.worker.model_verification, "verified");
  assert.equal(prepared.display.worker.host_session_id, "pi-child-1");

  // Human decline: no committed decision and no transition.
  ctx.ui.confirmAnswer = false;
  const declined = JSON.parse(await core.transitionAction(ctx, { action: "commit" }));
  assert.equal(declined.outcome, "cancelled");
  assert.match(declined.rejection, /human declined/);
  assert.equal(await committedDecision(root), null);
  const declinedDialog = ctx.ui.confirms[ctx.ui.confirms.length - 1];
  assert.ok(
    declinedDialog.message.startsWith("CONFIRM Retrieval GATE TRANSITION\n"),
    "the dialog shows the full exact canonical confirmation bytes"
  );
  const bindingJson = JSON.parse(declinedDialog.message.slice(declinedDialog.message.indexOf("\n") + 1));
  assert.equal(bindingJson.decision.value, "approve");
  assert.equal(bindingJson.run.gate_id, "D01");
  assert.match(bindingJson.workflow.catalog_sha256, /^[0-9a-f]{64}$/);

  // Result staleness after prepare: cancelled even if the human would confirm.
  const run = await loadActiveRun(root);
  const resultPath = path.join(run.runDir, run.state.current_attempt.result_path);
  const { appendFile } = await import("node:fs/promises");
  await appendFile(resultPath, "\n");
  ctx.ui.confirmAnswer = true;
  const stale = JSON.parse(await core.transitionAction(ctx, { action: "commit" }));
  assert.equal(stale.outcome, "cancelled");
  assert.match(stale.rejection, /no longer matches the prepared proposal/);
  assert.equal(await committedDecision(root), null);

  // Re-prepare against current bytes, then exact acceptance.
  const reprepared = JSON.parse(await core.transitionAction(ctx, { action: "prepare", decision: "approve" }));
  assert.equal(reprepared.outcome, "prepared");
  const accepted = JSON.parse(await core.transitionAction(ctx, { action: "commit" }));
  assert.equal(accepted.kind, "launched");
  assert.equal(accepted.launched_gate, "D02");
  assert.equal(accepted.decision_committed, true);
  assert.equal(stateAtCreate?.active_gate_id, "D02");
  assert.equal(stateAtCreate?.current_attempt, null);
  assert.equal(stateAtCreate?.last_decision?.gate_id, "D01");
  assert.equal(stateAtCreate?.last_decision?.decision, "approve");
  assert.deepEqual(
    record.resolved[record.resolved.length - 1],
    { provider: "prov", model: "cheap-gate", variant: "off" },
    "the next gate resolves the configured cheap model again"
  );

  // A parent-session replacement invalidates any prepared proposal.
  await writeReadyResultD02(root);
  await core.gateAction(ctx, { action: "release", reason: "D02 ready" });
  await core.transitionAction(ctx, { action: "prepare", decision: "approve" });
  const replaced = fakeContext(root, { sessionId: "pi-parent-2" });
  replaced.ui.confirmAnswer = true;
  const scoped = JSON.parse(await core.transitionAction(replaced, { action: "commit" }));
  assert.equal(scoped.outcome, "cancelled");
  assert.match(scoped.rejection, /different operator session/);
  assert.equal((await committedDecision(root))?.gate_id, "D01");
});

test("recover resumes the next launch from committed decision state via the runtime", async (t) => {
  const { root } = await fixture(t);
  const { bindings, record } = fakeBindings({
    beforeCreate: async () => {
      if (record.created.length === 1 && !record.allowSecond) {
        record.allowSecond = true;
        throw new Error("simulated worker creation failure");
      }
    }
  });
  const core = new PiMetaOperatorCore(bindings);
  const ctx = fakeContext(root);
  await startRun(core, ctx);
  await writeReadyResult(root);
  await core.gateAction(ctx, { action: "release", reason: "ready" });
  await core.transitionAction(ctx, { action: "prepare", decision: "approve" });
  ctx.ui.confirmAnswer = true;
  await assert.rejects(
    core.transitionAction(ctx, { action: "commit" }),
    /simulated worker creation failure/
  );
  const committed = await committedDecision(root);
  assert.equal(committed?.gate_id, "D01", "the human decision survived the failed next launch");
  assert.equal(committed?.decision, "approve");
  const wedged = await loadActiveRun(root);
  assert.equal(wedged?.state.active_gate_id, "D02");
  assert.equal(wedged?.state.current_attempt, null);

  const recovered = JSON.parse(await core.runAction(ctx, { action: "recover" }));
  assert.equal(recovered.outcome, "recovered");
  assert.equal(recovered.kind, "launched");
  assert.equal(recovered.launched_gate, "D02");
  assert.deepEqual(await committedDecision(root), committed, "recovery did not rewrite the decision");
});

async function writeReadyResultD02(root) {
  const run = await loadActiveRun(root);
  assert.ok(run?.state.current_attempt);
  const result = {
    gate_id: "D02",
    recommendation: "approve",
    summary: "D02 completed",
    artifacts: [],
    evidence: [],
    uncertainties: [],
    blockers: []
  };
  const absolute = path.join(run.runDir, run.state.current_attempt.result_path);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, `${JSON.stringify(result, null, 2)}\n`);
}

test("real bindings fail closed when the gate model is unknown or unauthenticated", () => {
  const bindings = createRealBindings();
  const missingRegistry = {
    modelRegistry: { find: () => undefined, hasConfiguredAuth: () => true }
  };
  assert.throws(
    () => bindings.resolveGateModel(missingRegistry, { provider: "prov", model: "ghost" }),
    /not available in the Pi model registry/
  );
  const unauthenticated = {
    modelRegistry: { find: () => ({ id: "cheap" }), hasConfiguredAuth: () => false }
  };
  assert.throws(
    () => bindings.resolveGateModel(unauthenticated, { provider: "prov", model: "cheap" }),
    /no configured authentication/
  );
});

test("the extension registers Google-compatible StringEnum schemas and a shutdown handler", async () => {
  const module = await import(extensionModulePath);
  const tools = [];
  const handlers = [];
  const fakePi = {
    registerTool: (definition) => tools.push(definition),
    on: (event, handler) => handlers.push({ event, handler })
  };
  await module.default(fakePi);
  assert.deepEqual(
    tools.map((tool) => tool.name).sort(),
    ["retrieval_meta_gate", "retrieval_meta_run", "retrieval_meta_transition"]
  );
  assert.ok(
    handlers.some((entry) => entry.event === "session_shutdown"),
    "a session_shutdown cleanup handler is registered"
  );
  for (const tool of tools) {
    const schema = JSON.stringify(tool.parameters);
    assert.ok(!schema.includes("anyOf"), `${tool.name} must not use Type.Union/Type.Literal unions`);
    assert.ok(!schema.includes('"const"'), `${tool.name} must not use literal const schemas`);
  }
  const runTool = tools.find((tool) => tool.name === "retrieval_meta_run");
  assert.deepEqual(runTool.parameters.properties.action.enum, ["status", "start", "resume", "recover"]);
  assert.equal(runTool.parameters.properties.action.type, "string");
  assert.match(runTool.promptSnippet, /meta-operator/i, "the operator role snippet is attached");
  const gateTool = tools.find((tool) => tool.name === "retrieval_meta_gate");
  assert.ok(gateTool.parameters.properties.action.enum.includes("release"));
});

test("the registered Pi shutdown handler does not terminate after successful child revocation", async (t) => {
  const { root } = await fixture(t);
  const { bindings, record } = fakeBindings();
  const core = new PiMetaOperatorCore(bindings);
  await startRun(core, fakeContext(root));

  const module = await import(extensionModulePath);
  const handlers = [];
  const terminations = [];
  await module.default(
    {
      registerTool: () => {},
      on: (event, handler) => handlers.push({ event, handler })
    },
    {
      core,
      terminateProcess: (exitCode) => terminations.push(exitCode)
    }
  );

  const shutdown = handlers.find((entry) => entry.event === "session_shutdown");
  assert.ok(shutdown, "the installed lifecycle callback is registered");
  await shutdown.handler({ reason: "quit" });

  assert.deepEqual(terminations, [], "successful revocation must not terminate Pi");
  assert.equal(record.handles[0].aborted, true);
  assert.equal(record.handles[0].disposed, true);
  assert.equal(core.workerHandle, null);
});

test("the registered Pi shutdown handler terminates after any thrown cleanup failure", async () => {
  const module = await import(extensionModulePath);
  const handlers = [];
  const terminations = [];
  const core = {
    async shutdown() {
      throw new Error("simulated shutdown persistence failure before a safe outcome");
    }
  };

  await module.default(
    {
      registerTool: () => {},
      on: (event, handler) => handlers.push({ event, handler })
    },
    {
      core,
      terminateProcess: (exitCode) => terminations.push(exitCode)
    }
  );

  const shutdown = handlers.find((entry) => entry.event === "session_shutdown");
  assert.ok(shutdown, "the installed lifecycle callback is registered");
  await assert.rejects(
    shutdown.handler({ reason: "persistence-failure" }),
    /terminator returned after shutdown cleanup threw \(simulated shutdown persistence failure/
  );
  assert.deepEqual(
    terminations,
    [1],
    "Pi teardown must not continue after an exception leaves child or ownership state uncertain"
  );
});

test("the registered Pi shutdown handler terminates after retaining failed revocation authority", async (t) => {
  const { root } = await fixture(t);
  const { bindings, record } = fakeBindings();
  const core = new PiMetaOperatorCore(bindings);
  const ctx = fakeContext(root);
  await startRun(core, ctx);

  const handle = record.handles[0];
  let abortAttempts = 0;
  handle.abort = async () => {
    abortAttempts += 1;
    handle.aborted = true;
    if (abortAttempts === 1) throw new Error("simulated abort failure");
  };

  const module = await import(extensionModulePath);
  const handlers = [];
  const terminations = [];
  await module.default(
    {
      registerTool: () => {},
      on: (event, handler) => handlers.push({ event, handler })
    },
    {
      core,
      terminateProcess: (exitCode) => {
        // The terminator runs only after core shutdown has deliberately kept
        // the exact revocation authority instead of disposing the runtime.
        assert.equal(core.workerHandle, handle);
        assert.equal(handle.disposed, false);
        terminations.push(exitCode);
      }
    }
  );

  const shutdown = handlers.find((entry) => entry.event === "session_shutdown");
  assert.ok(shutdown, "the installed lifecycle callback is registered");
  await assert.rejects(
    shutdown.handler({ reason: "crash" }),
    /terminator returned after child revocation failed/
  );

  assert.deepEqual(terminations, [1]);
  assert.equal(abortAttempts, 1);
  assert.equal(core.workerHandle, handle);
  assert.equal(handle.disposed, false);

  const persisted = JSON.parse(
    await readFile(path.join(root, ".pi", ".retrieval-meta", "state.json"), "utf8")
  );
  assert.equal(
    persisted.worker.status,
    "active",
    "the persisted worker remains non-terminal until child revocation succeeds"
  );
  await assert.rejects(
    new PiMetaOperatorCore(fakeBindings().bindings).runAction(fakeContext(root), {
      action: "status"
    }),
    /owned by live process/,
    "the failed handler must not release ownership before process death"
  );

  // A returning terminator is test-only; clean up through the retained handle.
  assert.equal(await core.shutdown("test cleanup after injected terminator"), "complete");
  assert.equal(abortAttempts, 2);
});
