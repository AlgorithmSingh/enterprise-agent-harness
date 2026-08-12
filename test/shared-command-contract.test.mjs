import assert from "node:assert/strict";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  loadActiveRun,
  recordLaunchDelivery,
  runNextCommand,
  runStartCommand
} from "../retrieval_agent_harness_phase_based/plugin-runtime.mjs";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..");
const fixturesDirectory = path.join(testDirectory, "fixtures");

async function fixture(t, workflowName = "workflow-linear.json") {
  const root = await mkdtemp(path.join(os.tmpdir(), "retrieval-agent-command-contract-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const workflow = JSON.parse(
    await readFile(path.join(fixturesDirectory, workflowName), "utf8")
  );
  const harnessDirectory = path.join(root, "retrieval_agent_harness_phase_based");
  await mkdir(path.join(harnessDirectory, "agents"), { recursive: true });
  await writeFile(path.join(harnessDirectory, "shared.md"), "Shared test rules.\n");
  await writeFile(
    path.join(harnessDirectory, "workflow.json"),
    `${JSON.stringify(workflow, null, 2)}\n`
  );
  for (const gate of workflow.gates) {
    const prompt = path.join(root, gate.agent_prompt);
    await mkdir(path.dirname(prompt), { recursive: true });
    await writeFile(
      prompt,
      `---\ndescription: Test prompt for ${gate.id}\nmode: primary\npermission:\n  task: deny\n---\n\n${gate.id}: ${gate.title}\n`
    );
  }
  return { root, workflow };
}

function gateId(packet) {
  assert.ok(packet?.gate?.id, "launch callback must receive the catalog gate");
  return packet.gate.id;
}

function recordingLauncher(trace, options = {}) {
  let sequence = 0;
  return async (packet) => {
    const id = gateId(packet);
    trace.push(`launch:${id}`);
    if (options.failFor === id) throw new Error(options.message ?? "simulated launch interruption");
    sequence += 1;
    return { id: `${options.host ?? "test"}-${id}-${sequence}` };
  };
}

async function start(root, trace, options = {}) {
  const initialIdea = options.initialIdea ?? "Build a small, safe Retrieval agent.";
  await runStartCommand({
    repoRoot: root,
    host: options.host ?? "test",
    intake: {
      targetRepoPath: root,
      initialIdea
    },
    launch: options.launch ?? recordingLauncher(trace, { host: options.host })
  });
}

async function writeReadyResult(root, options = {}) {
  const run = await loadActiveRun(root);
  assert.ok(run, "the fixture must have an active run");
  const attempt = run.state.current_attempt;
  assert.ok(attempt, "the fixture must have a launched attempt");

  const catalog = JSON.parse(
    await readFile(path.join(root, "retrieval_agent_harness_phase_based/workflow.json"), "utf8")
  );
  const gate = catalog.gates.find((candidate) => candidate.id === attempt.gate_id);
  assert.ok(gate, `missing gate ${attempt.gate_id}`);

  const artifacts = [];
  for (const artifactPath of gate.required_artifacts ?? []) {
    const absolute = path.join(root, artifactPath);
    await mkdir(path.dirname(absolute), { recursive: true });
    if (artifactPath === catalog.phase_2_manifest && options.phase2Manifest) {
      await cp(options.phase2Manifest, absolute);
    } else {
      await writeFile(absolute, `${gate.id} required artifact\n`);
    }
    artifacts.push({ path: artifactPath, role: `${gate.id} required output` });
  }
  for (const extra of options.artifacts ?? []) {
    const absolute = path.join(root, extra.path);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, extra.contents ?? `${extra.path}\n`);
    artifacts.push({ path: extra.path, role: extra.role ?? "test output" });
  }

  const result = {
    gate_id: gate.id,
    recommendation: options.recommendation ?? "approve",
    summary: options.summary ?? `${gate.id} completed`,
    artifacts,
    evidence: [],
    uncertainties: [],
    blockers: options.blockers ?? []
  };
  const resultPath = path.join(run.runDir, attempt.result_path);
  await mkdir(path.dirname(resultPath), { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  return { run, attempt, gate, resultPath, artifacts };
}

async function assertNoReceiptDirectory(runDirectory) {
  await assert.rejects(
    readdir(path.join(runDirectory, "receipts")),
    { code: "ENOENT" }
  );
}

function reviewer(trace, decision, reason = undefined, onDisplay = undefined) {
  return {
    display: async (review) => {
      trace.push(`display:${review.gate.id}`);
      if (onDisplay) await onDisplay(review);
    },
    decide: async (review) => {
      trace.push(`decide:${review.gate.id}`);
      return { decision, reason };
    }
  };
}

async function next(root, trace, decision, options = {}) {
  const review = reviewer(trace, decision, options.reason, options.onDisplay);
  return runNextCommand({
    repoRoot: root,
    host: options.host ?? "test",
    display: review.display,
    decide: review.decide,
    launch: options.launch ?? recordingLauncher(trace, { host: options.host }),
    afterDecision: options.afterDecision
  });
}

test("/retrieval-phase starts once and becomes status-only for the active run", async (t) => {
  const { root } = await fixture(t);
  const trace = [];
  const firstIdea = "Create an Retrieval support agent with explicit human approval.";
  await start(root, trace, { initialIdea: firstIdea });

  const firstRun = await loadActiveRun(root);
  assert.ok(firstRun);
  assert.equal(firstRun.state.current_attempt.gate_id, "D01");
  assert.deepEqual(trace, ["launch:D01"]);
  const originalRequest = await readFile(path.join(firstRun.runDir, "request.md"), "utf8");
  assert.match(originalRequest, new RegExp(firstIdea.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(originalRequest, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  await runStartCommand({
    repoRoot: root,
    host: "test",
    intake: {
      targetRepoPath: root,
      initialIdea: "This must not replace the active run."
    },
    launch: recordingLauncher(trace)
  });
  assert.deepEqual(trace, ["launch:D01"], "a second /retrieval-phase must not launch another attempt");
  assert.equal(await readFile(path.join(firstRun.runDir, "request.md"), "utf8"), originalRequest);

  await writeReadyResult(root);
  await runStartCommand({
    repoRoot: root,
    host: "test",
    launch: recordingLauncher(trace)
  });
  assert.deepEqual(trace, ["launch:D01"], "a ready result belongs to /retrieval-phase-next");
  await assertNoReceiptDirectory(firstRun.runDir);
});

test("concurrent first starts create one active run and launch at most one first gate", async (t) => {
  const { root } = await fixture(t);
  let launches = 0;
  const command = (idea) => runStartCommand({
    repoRoot: root,
    host: "test",
    intake: { targetRepoPath: root, initialIdea: idea },
    launch: async (packet) => {
      launches += 1;
      return { id: `concurrent-${packet.gate.id}-${launches}` };
    }
  });

  const settled = await Promise.allSettled([
    command("First concurrent start."),
    command("Second concurrent start.")
  ]);
  assert.ok(settled.some((entry) => entry.status === "fulfilled"));
  assert.equal(launches, 1);

  const run = await loadActiveRun(root);
  assert.ok(run);
  assert.equal(run.state.current_attempt.gate_id, "D01");
  assert.equal(run.state.attempts.D01, 1);
  const runEntries = await readdir(path.join(root, ".retrieval-agent-runs"), {
    withFileTypes: true
  });
  assert.equal(
    runEntries.filter((entry) => entry.isDirectory() && !entry.name.startsWith(".")).length,
    1
  );
});

test("catalog loading rejects a gate prompt without canonical host frontmatter", async (t) => {
  const { root, workflow } = await fixture(t);
  await writeFile(path.join(root, workflow.gates[0].agent_prompt), "Prompt body only.\n");

  await assert.rejects(
    runStartCommand({
      repoRoot: root,
      host: "test",
      intake: { targetRepoPath: root, initialIdea: "Reject an unloadable gate prompt." },
      launch: async () => assert.fail("an unloadable prompt must not launch")
    }),
    /must start with YAML frontmatter/
  );
  assert.equal(await loadActiveRun(root), null);
});

test("catalog loading rejects gate frontmatter that omits primary mode", async (t) => {
  const { root, workflow } = await fixture(t);
  await writeFile(
    path.join(root, workflow.gates[0].agent_prompt),
    "---\ndescription: Missing mode\npermission:\n  task: deny\n---\n\nPrompt body.\n"
  );

  await assert.rejects(
    runStartCommand({
      repoRoot: root,
      host: "test",
      intake: { targetRepoPath: root, initialIdea: "Reject incomplete gate metadata." },
      launch: async () => assert.fail("incomplete frontmatter must not launch")
    }),
    /description, primary mode, and permission mapping/
  );
});

for (const expectation of [
  {
    decision: "approve",
    reason: undefined,
    launched: "D02",
    state: "active"
  },
  {
    decision: "revise",
    reason: "Make the repository inventory concrete.",
    launched: "D01",
    state: "active"
  },
  {
    decision: "block",
    reason: "The target repository is unavailable.",
    launched: undefined,
    state: "blocked"
  },
  {
    decision: "not_applicable",
    reason: "The approved existing inventory covers this gate.",
    launched: "D02",
    state: "active"
  }
]) {
  test(`/retrieval-phase-next ${expectation.decision} commits direct state and performs its transition`, async (t) => {
    const { root } = await fixture(t);
    const trace = [];
    await start(root, trace);
    await writeReadyResult(root);
    await next(root, trace, expectation.decision, { reason: expectation.reason });

    const run = await loadActiveRun(root);
    assert.equal(run.state.last_decision.decision, expectation.decision);
    assert.equal(run.state.last_decision.reason, expectation.reason ?? null);
    assert.equal(run.state.status, expectation.state);
    assert.equal(run.state.active_gate_id, expectation.launched ?? "D01");
    assert.deepEqual(
      trace,
      [
        "launch:D01",
        "display:D01",
        "decide:D01",
        ...(expectation.launched ? [`launch:${expectation.launched}`] : [])
      ]
    );
    if (expectation.launched) {
      assert.equal(run.state.current_attempt.gate_id, expectation.launched);
    } else {
      assert.equal(run.state.current_attempt, null);
    }
    await assertNoReceiptDirectory(run.runDir);
  });
}

test("/retrieval-phase-next validates, displays, decides, commits state, then launches", async (t) => {
  const { root } = await fixture(t);
  const trace = [];
  await start(root, trace);
  await writeReadyResult(root);

  const review = reviewer(trace, "approve");
  await runNextCommand({
    repoRoot: root,
    host: "test",
    display: review.display,
    decide: review.decide,
    launch: async (packet) => {
      const run = await loadActiveRun(root);
      assert.equal(run.state.last_decision.gate_id, "D01");
      assert.equal(run.state.last_decision.decision, "approve");
      assert.equal(run.state.active_gate_id, "D02");
      assert.equal(run.state.current_attempt, null);
      await assertNoReceiptDirectory(run.runDir);
      trace.push(`launch:${gateId(packet)}`);
      return { id: "ordered-launch" };
    }
  });
  assert.deepEqual(trace, [
    "launch:D01",
    "display:D01",
    "decide:D01",
    "launch:D02"
  ]);
});

test("/retrieval-phase-next refuses an invalid result before display or decision", async (t) => {
  const { root } = await fixture(t);
  const trace = [];
  await start(root, trace);
  const ready = await writeReadyResult(root);
  const invalid = JSON.parse(await readFile(ready.resultPath, "utf8"));
  invalid.summary = "";
  await writeFile(ready.resultPath, `${JSON.stringify(invalid, null, 2)}\n`);
  const run = await loadActiveRun(root);

  let validationError;
  try {
    await runNextCommand({
      repoRoot: root,
      host: "test",
      display: async () => assert.fail("an invalid result must not be displayed as reviewable"),
      decide: async () => assert.fail("an invalid result must not receive a decision"),
      launch: async () => assert.fail("an invalid result must not launch a transition")
    });
  } catch (error) {
    validationError = error;
  }
  if (validationError) assert.match(validationError.message, /summary|invalid|not ready/i);
  assert.deepEqual(trace, ["launch:D01"]);
  await assertNoReceiptDirectory(run.runDir);
  const unchanged = await loadActiveRun(root);
  assert.equal(unchanged.state.current_attempt.gate_id, "D01");
});

for (const resultField of ["artifacts", "evidence"]) {
  test(`/retrieval-phase-next rejects a case-variant control path in ${resultField}`, async (t) => {
    const { root } = await fixture(t);
    await start(root, []);
    const ready = await writeReadyResult(root);
    const resultKind = resultField === "artifacts" ? "artifact" : "evidence";
    const controlPath = `.RETRIEVAL-agent-runs/portable-${resultField}.txt`;
    await mkdir(path.dirname(path.join(root, controlPath)), { recursive: true });
    await writeFile(path.join(root, controlPath), "must remain control-only\n");
    const result = JSON.parse(await readFile(ready.resultPath, "utf8"));
    result[resultField].push(
      resultField === "artifacts"
        ? { path: controlPath, role: "Case-variant control-path probe" }
        : { path: controlPath, supports: "Case-variant control-path probe" }
    );
    await writeFile(ready.resultPath, `${JSON.stringify(result, null, 2)}\n`);

    const outcome = await runNextCommand({
      repoRoot: root,
      host: "test",
      display: async () => assert.fail("a control-path result must not reach review"),
      decide: async () => assert.fail("a control-path result must not receive a decision"),
      launch: async () => assert.fail("a control-path result must not launch")
    });

    assert.equal(outcome.kind, "invalid");
    assert.match(outcome.review.error, new RegExp(`${resultKind} references a control path`, "i"));
  });
}

test("revision and blocked-resume directions reach the fresh gate packet", async (t) => {
  const { root } = await fixture(t);
  const trace = [];
  await start(root, trace);
  await writeReadyResult(root);

  const revision = "Inventory the existing loader before proposing a replacement.";
  let revisionPacket;
  await next(root, trace, "revise", {
    reason: revision,
    launch: async (packet) => {
      revisionPacket = packet;
      return { id: "revised-D01" };
    }
  });
  assert.match(
    revisionPacket.message,
    new RegExp(revision.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  );

  await writeReadyResult(root, {
    recommendation: "block",
    blockers: ["Need a repository owner decision."]
  });
  await next(root, trace, "block", { reason: "Wait for the repository owner." });

  const resumeDirection = "Preserve the loader and extend it.";
  let resumePacket;
  await runStartCommand({
    repoRoot: root,
    host: "test",
    resumeReason: resumeDirection,
    launch: async (packet) => {
      resumePacket = packet;
      return { id: "resumed-D01" };
    }
  });
  assert.match(resumePacket.message, new RegExp(resumeDirection));
});

test("/retrieval-phase-next recovers a committed transition after an interrupted launch exactly once", async (t) => {
  const { root } = await fixture(t);
  const trace = [];
  await start(root, trace);
  await writeReadyResult(root);

  await assert.rejects(
    next(root, trace, "approve", {
      launch: recordingLauncher(trace, {
        failFor: "D02",
        message: "simulated interruption after decision commit"
      })
    }),
    /simulated interruption after decision commit/
  );

  let run = await loadActiveRun(root);
  assert.equal(run.state.active_gate_id, "D02");
  assert.equal(run.state.current_attempt, null);
  assert.equal(run.state.last_decision.gate_id, "D01");
  assert.equal(run.state.last_decision.decision, "approve");
  await assertNoReceiptDirectory(run.runDir);

  let recoveredLaunches = 0;
  await runNextCommand({
    repoRoot: root,
    host: "test",
    display: async () => assert.fail("recovery must not review the committed result again"),
    decide: async () => assert.fail("recovery must not ask for a second decision"),
    launch: async (packet) => {
      recoveredLaunches += 1;
      assert.equal(gateId(packet), "D02");
      return { id: "recovered-D02" };
    }
  });
  assert.equal(recoveredLaunches, 1);
  run = await loadActiveRun(root);
  assert.equal(run.state.current_attempt.gate_id, "D02");
  await assertNoReceiptDirectory(run.runDir);

  await runNextCommand({
    repoRoot: root,
    host: "test",
    display: async () => assert.fail("unfinished work is not reviewable"),
    decide: async () => assert.fail("unfinished work has no decision"),
    launch: async () => {
      recoveredLaunches += 1;
      return { id: "duplicate" };
    }
  });
  assert.equal(recoveredLaunches, 1, "an already active attempt must not be launched twice");
});

test("a failed kickoff after durable session recording rolls back for a clean retry", async (t) => {
  const { root } = await fixture(t);
  let retired = false;
  await assert.rejects(
    runStartCommand({
      repoRoot: root,
      host: "test",
      intake: {
        targetRepoPath: root,
        initialIdea: "Exercise post-record kickoff recovery."
      },
      launch: async (_packet, record) => {
        await record({ id: "undelivered-D01" });
        retired = true;
        throw new Error("simulated kickoff delivery failure after record");
      }
    }),
    /simulated kickoff delivery failure/
  );
  assert.equal(retired, true);
  let run = await loadActiveRun(root);
  assert.equal(run.state.current_attempt, null);
  assert.equal(run.state.attempts.D01, undefined);

  let retriedPacket;
  await runStartCommand({
    repoRoot: root,
    host: "test",
    launch: async (packet) => {
      retriedPacket = packet;
      return { id: "delivered-D01" };
    }
  });
  assert.equal(retriedPacket.attempt, 1);
  run = await loadActiveRun(root);
  assert.equal(run.state.current_attempt.session.id, "delivered-D01");
  assert.equal(run.state.current_attempt.delivery_status, "delivered");
});

test("an uncertain recorded kickoff fails closed until the human retires and retries it", async (t) => {
  const { root } = await fixture(t);
  const uncertain = new Error("simulated process loss after durable record");
  uncertain.preserveRecordedAttempt = true;
  await assert.rejects(
    runStartCommand({
      repoRoot: root,
      host: "test",
      intake: {
        targetRepoPath: root,
        initialIdea: "Exercise explicit uncertain-kickoff recovery."
      },
      launch: async (_packet, record) => {
        await record({ id: "uncertain-D01" });
        throw uncertain;
      }
    }),
    /simulated process loss/
  );

  let outcome = await runStartCommand({
    repoRoot: root,
    host: "test",
    launch: async () => assert.fail("an uncertain kickoff must not relaunch automatically")
  });
  assert.equal(outcome.kind, "delivery_pending");
  assert.equal(outcome.run.state.current_attempt.session.id, "uncertain-D01");
  const expectedPendingLaunch = structuredClone(outcome.run.state.current_attempt);

  const retired = [];
  outcome = await runStartCommand({
    repoRoot: root,
    host: "test",
    resumeReason: "The human inspected the session and confirmed no kickoff was delivered.",
    recoverPendingLaunch: true,
    expectedPendingLaunch,
    retirePendingSession: async (session) => retired.push(session.id),
    launch: async (packet) => {
      assert.equal(packet.attempt, 1);
      return { id: "recovered-D01" };
    }
  });
  assert.equal(outcome.kind, "launched");
  assert.deepEqual(retired, ["uncertain-D01"]);
  const run = await loadActiveRun(root);
  assert.equal(run.state.current_attempt.session.id, "recovered-D01");
  assert.equal(run.state.current_attempt.delivery_status, "delivered");
});

test("a human can confirm that an uncertain kickoff was delivered without relaunching it", async (t) => {
  const { root } = await fixture(t);
  const uncertain = new Error("simulated process loss after prompt delivery");
  uncertain.preserveRecordedAttempt = true;
  await assert.rejects(
    runStartCommand({
      repoRoot: root,
      host: "test",
      intake: {
        targetRepoPath: root,
        initialIdea: "Exercise explicit delivered-kickoff confirmation."
      },
      launch: async (_packet, record) => {
        await record({ id: "delivered-but-unmarked-D01" });
        throw uncertain;
      }
    }),
    /simulated process loss/
  );

  let relaunches = 0;
  const pending = await loadActiveRun(root);
  const outcome = await runStartCommand({
    repoRoot: root,
    host: "test",
    confirmPendingDelivery: true,
    expectedPendingLaunch: pending.state.current_attempt,
    launch: async () => {
      relaunches += 1;
      return { id: "duplicate-D01" };
    }
  });
  assert.equal(outcome.kind, "missing");
  assert.equal(relaunches, 0);
  const run = await loadActiveRun(root);
  assert.equal(run.state.current_attempt.session.id, "delivered-but-unmarked-D01");
  assert.equal(run.state.current_attempt.delivery_status, "delivered");
  assert.equal(run.state.attempts.D01, 1);
});

test("a stale delivery marker cannot overwrite a human-selected pending-launch retry", async (t) => {
  const { root } = await fixture(t);
  const uncertain = new Error("simulated process loss after the first durable record");
  uncertain.preserveRecordedAttempt = true;
  await assert.rejects(
    runStartCommand({
      repoRoot: root,
      host: "test",
      sessionMode: "manual",
      intake: {
        targetRepoPath: root,
        initialIdea: "Exercise immutable pending-launch recovery binding."
      },
      launch: async (_packet, record) => {
        await record({ id: "stale-D01", mode: "manual" });
        throw uncertain;
      }
    }),
    /simulated process loss/
  );

  const staleRun = await loadActiveRun(root);
  const staleAttempt = structuredClone(staleRun.state.current_attempt);
  let replacementRecorded;
  const replacementIsRecorded = new Promise((resolve) => {
    replacementRecorded = resolve;
  });
  let releaseReplacement;
  const holdReplacement = new Promise((resolve) => {
    releaseReplacement = resolve;
  });

  const retry = runStartCommand({
    repoRoot: root,
    host: "test",
    sessionMode: "manual",
    resumeReason: "The human confirmed that the stale session never received its kickoff.",
    recoverPendingLaunch: true,
    expectedPendingLaunch: staleAttempt,
    retirePendingSession: async (session) => assert.equal(session.id, "stale-D01"),
    launch: async (_packet, record) => {
      await record({ id: "replacement-D01", mode: "manual" });
      replacementRecorded();
      await holdReplacement;
      return { id: "replacement-D01", mode: "manual" };
    }
  });

  await replacementIsRecorded;
  await assert.rejects(
    recordLaunchDelivery(staleRun, staleAttempt),
    /transition command|in progress/i
  );
  releaseReplacement();
  await retry;

  await assert.rejects(
    recordLaunchDelivery(staleRun, staleAttempt),
    /stale attempt/
  );
  const current = await loadActiveRun(root);
  assert.equal(current.state.current_attempt.session.id, "replacement-D01");
  assert.equal(current.state.current_attempt.delivery_status, "delivered");
  assert.notEqual(current.state.current_attempt.launch_id, staleAttempt.launch_id);
});

test("a delivery-marker write failure preserves the recorded pending attempt", async (t) => {
  const { root } = await fixture(t);
  let statePath;
  let savedStatePath;
  try {
    await assert.rejects(
      runStartCommand({
        repoRoot: root,
        host: "test",
        intake: {
          targetRepoPath: root,
          initialIdea: "Preserve a live session when delivery persistence fails."
        },
        launch: async (_packet, record) => {
          await record({ id: "recorded-before-marker-failure" });
          const run = await loadActiveRun(root);
          statePath = path.join(run.runDir, "workflow-state.json");
          savedStatePath = `${statePath}.saved`;
          await rename(statePath, savedStatePath);
          await mkdir(statePath);
          return { id: "recorded-before-marker-failure" };
        }
      }),
      (error) => {
        assert.equal(error.preserveRecordedAttempt, true);
        assert.doesNotMatch(error.message, /could not be rolled back/i);
        return true;
      }
    );
  } finally {
    if (statePath && savedStatePath) {
      await rm(statePath, { recursive: true, force: true });
      await rename(savedStatePath, statePath);
    }
  }

  const run = await loadActiveRun(root);
  assert.equal(run.state.current_attempt.session.id, "recorded-before-marker-failure");
  assert.equal(run.state.current_attempt.delivery_status, "pending");
});

test("lock cleanup failure retains the primary launch error and pending-attempt signal", async (t) => {
  const { root } = await fixture(t);
  let lockDirectory;
  const primary = new Error("simulated primary launch interruption");
  primary.preserveRecordedAttempt = true;

  try {
    await assert.rejects(
      runStartCommand({
        repoRoot: root,
        host: "test",
        intake: {
          targetRepoPath: root,
          initialIdea: "Retain primary failure context while unwinding a lock."
        },
        launch: async (_packet, record) => {
          await record({ id: "pending-during-lock-cleanup" });
          const run = await loadActiveRun(root);
          lockDirectory = path.join(run.runDir, ".transition-lock");
          const owner = path.join(lockDirectory, "owner.json");
          await rename(owner, `${owner}.saved`);
          await mkdir(owner);
          throw primary;
        }
      }),
      (error) => {
        assert.equal(error.preserveRecordedAttempt, true);
        assert.match(error.message, /simulated primary launch interruption/);
        assert.match(error.message, /transition lock cleanup also failed/);
        assert.match(error.message, /cleanup failed after retry/);
        return true;
      }
    );
  } finally {
    if (lockDirectory) await rm(lockDirectory, { recursive: true, force: true });
  }

  const run = await loadActiveRun(root);
  assert.equal(run.state.current_attempt.session.id, "pending-during-lock-cleanup");
  assert.equal(run.state.current_attempt.delivery_status, "pending");
});

test("manual commands cannot decide an attempt owned by the meta operator", async (t) => {
  const { root } = await fixture(t);
  await runStartCommand({
    repoRoot: root,
    host: "opencode",
    sessionMode: "meta",
    intake: {
      targetRepoPath: root,
      initialIdea: "Keep meta and manual authority separate."
    },
    launch: async () => ({ id: "meta-D01", mode: "meta" })
  });
  await writeReadyResult(root);

  await assert.rejects(
    runNextCommand({
      repoRoot: root,
      host: "opencode",
      sessionMode: "manual",
      display: async () => assert.fail("a foreign-mode attempt must not be displayed for decision"),
      decide: async () => assert.fail("a foreign-mode attempt must not be decided"),
      launch: async () => assert.fail("a foreign-mode attempt must not transition")
    }),
    /owned by meta session mode/
  );
  const run = await loadActiveRun(root);
  assert.equal(run.state.current_attempt.gate_id, "D01");
  assert.equal(run.state.current_attempt.session.mode, "meta");
  assert.equal(run.state.last_decision, null);
});

test("two concurrent commands can commit at most one decision for an attempt", async (t) => {
  const { root } = await fixture(t);
  const trace = [];
  await start(root, trace);
  await writeReadyResult(root);
  let decisionsReady = 0;
  let releaseDecisions;
  const bothDeciding = new Promise((resolve) => {
    releaseDecisions = resolve;
  });
  let launchStarted;
  const launching = new Promise((resolve) => {
    launchStarted = resolve;
  });
  let releaseLaunch;
  const holdLaunch = new Promise((resolve) => {
    releaseLaunch = resolve;
  });
  let launchCount = 0;

  const command = () => runNextCommand({
    repoRoot: root,
    host: "test",
    display: async () => {},
    decide: async () => {
      decisionsReady += 1;
      if (decisionsReady === 2) releaseDecisions();
      await bothDeciding;
      return { decision: "approve" };
    },
    launch: async (packet) => {
      launchCount += 1;
      assert.equal(packet.gate.id, "D02");
      launchStarted();
      await holdLaunch;
      return { id: "single-D02" };
    }
  });

  const first = command();
  const second = command();
  const settledCommands = Promise.allSettled([first, second]);
  await launching;
  releaseLaunch();
  const settled = await settledCommands;
  assert.equal(settled.filter((entry) => entry.status === "fulfilled").length, 1);
  assert.equal(settled.filter((entry) => entry.status === "rejected").length, 1);
  const rejected = settled.find((entry) => entry.status === "rejected");
  assert.match(String(rejected.reason), /transition.*lock|already received.*decision|in progress/i);
  assert.equal(launchCount, 1);

  const run = await loadActiveRun(root);
  assert.equal(run.state.last_decision.gate_id, "D01");
  assert.equal(run.state.last_decision.decision, "approve");
  assert.equal(run.state.current_attempt.gate_id, "D02");
  assert.equal(run.state.attempts.D02, 1);
  await assertNoReceiptDirectory(run.runDir);
});

test("legacy receipt-bearing v1 runs fail closed with restart guidance", async (t) => {
  const { root } = await fixture(t);
  const trace = [];
  await start(root, trace);
  const run = await loadActiveRun(root);
  const pointerPath = path.join(root, ".retrieval-agent-runs", "active.json");
  const pointer = JSON.parse(await readFile(pointerPath, "utf8"));
  pointer.version = 1;
  const legacyState = {
    ...run.state,
    version: 1,
    latest_receipts: {},
    approved_receipts: {},
    frozen_files: []
  };
  await writeFile(pointerPath, `${JSON.stringify(pointer, null, 2)}\n`);
  await writeFile(path.join(run.runDir, "workflow-state.json"), `${JSON.stringify(legacyState, null, 2)}\n`);

  await assert.rejects(
    runStartCommand({
      repoRoot: root,
      host: "test",
      intake: undefined,
      resumeReason: undefined,
      launch: async () => assert.fail("a legacy run must not launch")
    }),
    /retired receipt-and-freeze state format.*start a new v2 run/i
  );
});

test("v2 state fails closed when immutable launch identity is missing", async (t) => {
  const { root } = await fixture(t);
  await start(root, []);
  const run = await loadActiveRun(root);
  const statePath = path.join(run.runDir, "workflow-state.json");
  const state = JSON.parse(await readFile(statePath, "utf8"));
  delete state.current_attempt.launch_id;
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);

  await assert.rejects(
    loadActiveRun(root),
    /immutable launch, host-session, mode, or delivery binding/
  );
});

test("v2 state fails closed when the immutable workflow-catalog binding is missing", async (t) => {
  const { root } = await fixture(t);
  await start(root, []);
  const run = await loadActiveRun(root);
  const statePath = path.join(run.runDir, "workflow-state.json");
  const state = JSON.parse(await readFile(statePath, "utf8"));
  delete state.current_attempt.workflow_catalog;
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);

  await assert.rejects(loadActiveRun(root), /workflow-catalog binding/);
});

test("catalog-owned allowed human decisions reject a disallowed transition but keep recommendations advisory", async (t) => {
  const { root } = await fixture(t);
  const trace = [];
  await start(root, trace);
  await writeReadyResult(root);
  await next(root, trace, "approve");
  assert.equal((await loadActiveRun(root)).state.current_attempt.gate_id, "D02");
  await writeReadyResult(root, { recommendation: "not_applicable" });

  let shown;
  await assert.rejects(
    runNextCommand({
      repoRoot: root,
      host: "test",
      display: async (review) => {
        shown = review;
      },
      decide: async () => ({
        decision: "not_applicable",
        reason: "Try to skip an indispensable gate."
      }),
      launch: async () => assert.fail("a disallowed decision must not launch")
    }),
    /D02 does not allow.*not_applicable/
  );
  assert.equal(shown.result.recommendation, "not_applicable");
  assert.deepEqual(shown.allowed_human_decisions, ["approve", "revise", "block"]);
  const unchanged = await loadActiveRun(root);
  assert.equal(unchanged.state.current_attempt.gate_id, "D02");
  assert.equal(unchanged.state.last_decision.gate_id, "D01");
});

for (const tamperTarget of ["artifact", "gate result"]) {
  test(`/retrieval-phase-next refuses ${tamperTarget} changes made during human review`, async (t) => {
    const { root } = await fixture(t, "workflow-manifest.json");
    const trace = [];
    await start(root, trace);
    const ready = await writeReadyResult(root, {
      phase2Manifest: path.join(fixturesDirectory, "phase-2-manifest.json")
    });
    const reviewedArtifact = ready.artifacts[0].path;
    const run = await loadActiveRun(root);

    await assert.rejects(
      next(root, trace, "approve", {
        onDisplay: async () => {
          if (tamperTarget === "artifact") {
            await writeFile(
              path.join(root, reviewedArtifact),
              "changed during review\n"
            );
          } else {
            const result = JSON.parse(await readFile(ready.resultPath, "utf8"));
            result.summary = "changed during review";
            await writeFile(ready.resultPath, `${JSON.stringify(result, null, 2)}\n`);
          }
        }
      }),
      /changed during review|tamper/i
    );
    await assertNoReceiptDirectory(run.runDir);
    assert.deepEqual(trace, ["launch:D12", "display:D12", "decide:D12"]);
    const unchanged = await loadActiveRun(root);
    assert.equal(unchanged.state.current_attempt.gate_id, "D12");
  });
}

test("/retrieval-phase-next refuses catalog changes made during human review", async (t) => {
  const { root } = await fixture(t);
  const trace = [];
  await start(root, trace);
  await writeReadyResult(root);
  const workflowPath = path.join(root, "retrieval_agent_harness_phase_based/workflow.json");

  await assert.rejects(
    next(root, trace, "approve", {
      onDisplay: async () => {
        const changed = JSON.parse(await readFile(workflowPath, "utf8"));
        changed.gates[0].title = "Changed while the human was reviewing";
        await writeFile(workflowPath, `${JSON.stringify(changed, null, 2)}\n`);
      },
      launch: async () => assert.fail("a changed reviewed catalog must not launch")
    }),
    /reviewed workflow_catalog changed|workflow catalog changed/i
  );
  const run = await loadActiveRun(root);
  assert.equal(run.state.current_attempt.gate_id, "D01");
  assert.equal(run.state.last_decision, null);
});

test("/retrieval-phase-next refuses catalog drift that predates result review", async (t) => {
  const { root } = await fixture(t);
  const trace = [];
  await start(root, trace);
  await writeReadyResult(root);
  const workflowPath = path.join(root, "retrieval_agent_harness_phase_based/workflow.json");
  const changed = JSON.parse(await readFile(workflowPath, "utf8"));
  changed.gates[0].title = "Changed after D01 launched but before review";
  await writeFile(workflowPath, `${JSON.stringify(changed, null, 2)}\n`);

  await assert.rejects(
    runNextCommand({
      repoRoot: root,
      host: "test",
      display: async () => assert.fail("a drifted attempt must not reach review"),
      decide: async () => assert.fail("a drifted attempt must not receive a decision"),
      launch: async () => assert.fail("a drifted attempt must not launch")
    }),
    /workflow catalog differs from the bytes bound to the active attempt/i
  );
  const run = await loadActiveRun(root);
  assert.equal(run.state.current_attempt.gate_id, "D01");
  assert.equal(run.state.last_decision, null);
  assert.deepEqual(trace, ["launch:D01"]);
});

test("the approved phase-2 manifest skips inactive gates and constrains the active gate", async (t) => {
  const { root } = await fixture(t, "workflow-manifest.json");
  const trace = [];
  await start(root, trace);
  await writeReadyResult(root, {
    phase2Manifest: path.join(fixturesDirectory, "phase-2-manifest.json")
  });

  let b15Packet;
  const review = reviewer(trace, "approve");
  await runNextCommand({
    repoRoot: root,
    host: "test",
    display: review.display,
    decide: review.decide,
    launch: async (packet) => {
      b15Packet = packet;
      trace.push(`launch:${gateId(packet)}`);
      return { id: "manifest-B15" };
    }
  });

  assert.deepEqual(trace, [
    "launch:D12",
    "display:D12",
    "decide:D12",
    "launch:B15"
  ]);
  assert.equal(gateId(b15Packet), "B15");
  assert.deepEqual(b15Packet.allowed_files, [
    "src/models.py",
    "tests/test_models.py"
  ]);
  assert.equal(trace.includes("launch:B14"), false);

  trace.length = 0;
  await writeReadyResult(root);
  await next(root, trace, "approve");
  assert.deepEqual(trace, [
    "display:B15",
    "decide:B15",
    "launch:B25"
  ], "required gates remain active even without a manifest entry");
});

test("a reviewed manifest proposal changes only the later retry's file authority", async (t) => {
  const { root } = await fixture(t, "workflow-manifest.json");
  const trace = [];
  await start(root, trace);
  await writeReadyResult(root, {
    phase2Manifest: path.join(fixturesDirectory, "phase-2-manifest.json")
  });

  let firstB15;
  await runNextCommand({
    repoRoot: root,
    host: "test",
    display: async () => {},
    decide: async () => ({ decision: "approve" }),
    launch: async (packet) => {
      firstB15 = packet;
      return { id: "B15-attempt-1" };
    }
  });
  assert.deepEqual(firstB15.allowed_files, ["src/models.py", "tests/test_models.py"]);

  const revised = JSON.parse(
    await readFile(path.join(fixturesDirectory, "phase-2-manifest.json"), "utf8")
  );
  revised.gates.B15.allowed_files.push("src/refined_models.py");
  await writeReadyResult(root, {
    artifacts: [{
      path: ".sequence/phase-2-manifest.json",
      role: "Exact file-authority proposal for the later retry",
      contents: `${JSON.stringify(revised, null, 2)}\n`
    }]
  });

  let retriedB15;
  await next(root, trace, "revise", {
    reason: "Review the exact added model path in a fresh attempt.",
    launch: async (packet) => {
      retriedB15 = packet;
      return { id: "B15-attempt-2" };
    }
  });
  assert.equal(retriedB15.attempt, 2);
  assert.deepEqual(retriedB15.allowed_files, [
    "src/models.py",
    "tests/test_models.py",
    "src/refined_models.py"
  ]);
  const run = await loadActiveRun(root);
  assert.deepEqual(run.state.implementation_manifest, revised);
});

test("B24 manifest-only proposals cannot self-widen the current attempt", async (t) => {
  const { root } = await fixture(t, "workflow-b24-proposal.json");
  const trace = [];
  await start(root, trace);
  await writeReadyResult(root, {
    phase2Manifest: path.join(fixturesDirectory, "phase-2-b24-manifest.json")
  });

  let firstB24;
  await next(root, trace, "approve", {
    launch: async (packet) => {
      firstB24 = packet;
      return { id: "B24-attempt-1" };
    }
  });
  assert.deepEqual(firstB24.allowed_files, ["tests/test_behavior.py"]);
  assert.deepEqual(firstB24.collaborative_edit_paths, [".sequence/phase-2-manifest.json"]);

  const reviewed = JSON.parse(
    await readFile(path.join(fixturesDirectory, "phase-2-b24-manifest.json"), "utf8")
  );
  reviewed.gates.B24.allowed_files.push("tests/fixtures/reviewed.json");
  await writeReadyResult(root, {
    artifacts: [{
      path: ".sequence/phase-2-manifest.json",
      role: "Reviewed exact-path proposal for a later B24 attempt",
      contents: `${JSON.stringify(reviewed, null, 2)}\n`
    }]
  });

  const unreviewed = structuredClone(reviewed);
  unreviewed.gates.B24.allowed_files.push("tests/fixtures/unreviewed.json");
  let retriedB24;
  await next(root, trace, "revise", {
    reason: "Authorize the reviewed fixture path in a fresh attempt.",
    afterDecision: async () => {
      await writeFile(
        path.join(root, ".sequence/phase-2-manifest.json"),
        `${JSON.stringify(unreviewed, null, 2)}\n`
      );
    },
    launch: async (packet) => {
      retriedB24 = packet;
      return { id: "B24-attempt-2" };
    }
  });
  assert.equal(retriedB24.attempt, 2);
  assert.deepEqual(retriedB24.allowed_files, [
    "tests/test_behavior.py",
    "tests/fixtures/reviewed.json"
  ]);
  const run = await loadActiveRun(root);
  assert.deepEqual(run.state.implementation_manifest, reviewed);
});

test("a manifest proposal cannot deactivate the optional gate it retries", async (t) => {
  const { root } = await fixture(t, "workflow-manifest.json");
  const trace = [];
  await start(root, trace);
  await writeReadyResult(root, {
    phase2Manifest: path.join(fixturesDirectory, "phase-2-manifest.json")
  });
  await next(root, trace, "approve");

  const invalid = JSON.parse(
    await readFile(path.join(fixturesDirectory, "phase-2-manifest.json"), "utf8")
  );
  invalid.gates.B15 = {
    active: false,
    reason: "The current gate tries to deactivate its own retry.",
    allowed_files: []
  };
  await writeReadyResult(root, {
    artifacts: [{
      path: ".sequence/phase-2-manifest.json",
      role: "Invalid self-deactivation proposal",
      contents: `${JSON.stringify(invalid, null, 2)}\n`
    }]
  });

  await assert.rejects(
    next(root, trace, "revise", {
      reason: "Retry after changing manifest authority.",
      launch: async () => assert.fail("an inactive target must not launch")
    }),
    /targets B15.*inactive in the reviewed manifest/
  );
  const run = await loadActiveRun(root);
  assert.equal(run.state.active_gate_id, "B15");
  assert.equal(run.state.current_attempt.gate_id, "B15");
  assert.equal(run.state.implementation_manifest.gates.B15.active, true);
});

test("a refreshed manifest cannot reactivate an already-skipped gate", async (t) => {
  const { root } = await fixture(t, "workflow-manifest.json");
  const trace = [];
  await start(root, trace);
  await writeReadyResult(root, {
    phase2Manifest: path.join(fixturesDirectory, "phase-2-manifest.json")
  });
  await next(root, trace, "approve");

  const invalid = JSON.parse(
    await readFile(path.join(fixturesDirectory, "phase-2-manifest.json"), "utf8")
  );
  invalid.gates.B14 = {
    active: true,
    reason: "A later gate tries to reactivate an already-skipped writer.",
    allowed_files: ["pyproject.toml"]
  };
  await writeReadyResult(root, {
    artifacts: [{
      path: ".sequence/phase-2-manifest.json",
      role: "Invalid retroactive activation proposal",
      contents: `${JSON.stringify(invalid, null, 2)}\n`
    }]
  });

  await assert.rejects(
    next(root, trace, "revise", {
      reason: "Attempt a retroactive routing change.",
      launch: async () => assert.fail("retroactive authority must not launch")
    }),
    /may not change already-passed authority for B14/
  );
  const run = await loadActiveRun(root);
  assert.equal(run.state.current_attempt.gate_id, "B15");
  assert.equal(run.state.implementation_manifest.gates.B14.active, false);
});

test("exact manifest authority rejects a case-variant artifact path", async (t) => {
  const { root } = await fixture(t, "workflow-manifest.json");
  const trace = [];
  await start(root, trace);
  await writeReadyResult(root, {
    phase2Manifest: path.join(fixturesDirectory, "phase-2-manifest.json")
  });
  await next(root, trace, "approve");

  await writeReadyResult(root, {
    artifacts: [{
      path: "Src/models.py",
      role: "Case-variant path outside exact authority",
      contents: "class WrongCase:\n    pass\n"
    }]
  });
  const outcome = await next(root, trace, "approve");
  assert.equal(outcome.kind, "invalid");
  assert.match(outcome.review.error, /outside its approved files: Src\/models\.py/);
  const run = await loadActiveRun(root);
  assert.equal(run.state.current_attempt.gate_id, "B15");
});

test("a collaborative gate can report a future design and prompt correction that a fresh gate consumes", async (t) => {
  const { root } = await fixture(t);
  const trace = [];
  let packet;
  await start(root, trace, {
    launch: async (candidate) => {
      packet = candidate;
      return { id: "D01-collaborative" };
    }
  });
  assert.ok(packet.collaborative_edit_paths.includes(".sequence/design/02-outcome.json"));
  assert.ok(packet.collaborative_edit_paths.includes("retrieval_agent_harness_phase_based/agents/D02.md"));
  assert.ok(packet.collaborative_edit_paths.includes("docs/**"));

  const d02Prompt = "retrieval_agent_harness_phase_based/agents/D02.md";
  const currentD02Prompt = await readFile(path.join(root, d02Prompt), "utf8");

  await writeReadyResult(root, {
    artifacts: [
      {
        path: ".sequence/design/02-outcome.json",
        role: "Draft future design correction",
        contents: "future design draft\n"
      },
      {
        path: d02Prompt,
        role: "Focused future prompt correction",
        contents: `${currentD02Prompt.trimEnd()}\n\nfresh D02 prompt marker\n`
      },
      {
        path: "docs/collaboration-note.md",
        role: "Durable collaboration note",
        contents: "---\ntype: concept\ntitle: Collaboration note\ndescription: Test note.\ntimestamp: 2026-08-05T00:00:00Z\n---\n"
      },
      {
        path: "docs/index.md",
        role: "Documentation navigation for the durable note",
        contents: "# Test documentation\n\n* [Collaboration note](collaboration-note.md) — Durable collaborative-edit fixture.\n"
      },
      {
        path: "docs/log.md",
        role: "Documentation changelog for the durable note",
        contents: "# Documentation Log\n\n* Added the collaborative-edit fixture note.\n"
      }
    ]
  });
  await next(root, trace, "approve", {
    launch: async (candidate) => {
      packet = candidate;
      return { id: "D02-fresh" };
    }
  });
  assert.equal(packet.gate.id, "D02");
  assert.match(packet.system, /fresh D02 prompt marker/);
});

for (const unauthorized of [
  "retrieval_agent_harness_phase_based/plugin-runtime.mjs",
  "src/unrouted.py"
]) {
  test(`collaborative result validation rejects unauthorized path ${unauthorized}`, async (t) => {
    const { root } = await fixture(t);
    const trace = [];
    await start(root, trace);
    await writeReadyResult(root, {
      artifacts: [{
        path: unauthorized,
        role: "Unauthorized edit",
        contents: "not allowed\n"
      }]
    });
    const outcome = await next(root, trace, "approve");
    assert.equal(outcome.kind, "invalid");
    assert.match(outcome.review.error, /outside its approved files/);
    const run = await loadActiveRun(root);
    assert.equal(run.state.current_attempt.gate_id, "D01");
  });
}

for (const unsafe of ["case-folded protected path", "symlink ancestor", "glob-like path"]) {
  test(`the phase-2 manifest rejects an unsafe ${unsafe}`, async (t) => {
    const { root } = await fixture(t, "workflow-manifest.json");
    const trace = [];
    await start(root, trace);

    const allowedPath = unsafe === "case-folded protected path"
      ? "Reference/python/agents/repair-agent.md"
      : unsafe === "glob-like path"
        ? "src/*.py"
        : "src/models.py";
    if (unsafe === "symlink ancestor") {
      const outside = await mkdtemp(path.join(os.tmpdir(), "retrieval-agent-outside-"));
      t.after(() => rm(outside, { recursive: true, force: true }));
      await symlink(outside, path.join(root, "src"));
    }
    const manifestPath = path.join(root, "unsafe-manifest.json");
    await writeFile(
      manifestPath,
      `${JSON.stringify({
        version: 1,
        gates: {
          B14: {
            active: false,
            reason: "The existing configuration is sufficient.",
            allowed_files: []
          },
          B15: {
            active: true,
            reason: "The design requests a data-model file.",
            allowed_files: [allowedPath]
          }
        }
      }, null, 2)}\n`
    );
    await writeReadyResult(root, { phase2Manifest: manifestPath });
    const run = await loadActiveRun(root);

    const rejected = await next(root, trace, "approve");
    assert.equal(rejected.kind, "invalid");
    assert.match(rejected.review.error, /protected path|symlink|exact literal paths/i);
    const unchanged = await loadActiveRun(root);
    assert.equal(unchanged.state.current_attempt.gate_id, "D12");
    await assertNoReceiptDirectory(run.runDir);
  });
}

test("the bounded repair gate can launch at most twice", async (t) => {
  const { root } = await fixture(t, "workflow-repair.json");
  const trace = [];
  await start(root, trace);

  async function decideCurrent(decision, reason = undefined) {
    await writeReadyResult(root);
    await next(root, trace, decision, { reason });
  }

  for (let repairAttempt = 1; repairAttempt <= 2; repairAttempt += 1) {
    await decideCurrent("approve"); // B25 -> B26
    await decideCurrent("approve"); // B26 -> B27
    await decideCurrent("revise", `Repair validation cycle ${repairAttempt}.`); // B27 -> BR
    let run = await loadActiveRun(root);
    assert.equal(run.state.current_attempt.gate_id, "BR");
    assert.equal(run.state.current_attempt.number, repairAttempt);
    await decideCurrent("approve"); // BR -> B25
    run = await loadActiveRun(root);
    assert.equal(run.state.current_attempt.gate_id, "B25");
  }

  await decideCurrent("approve"); // B25 -> B26, third validation cycle
  await decideCurrent("approve"); // B26 -> B27
  await writeReadyResult(root);
  const before = await loadActiveRun(root);
  const lastDecision = structuredClone(before.state.last_decision);
  await assert.rejects(
    next(root, trace, "revise", { reason: "A third repair must not launch." }),
    /repair.*2|2.*repair|attempt limit/i
  );

  const after = await loadActiveRun(root);
  assert.equal(after.state.current_attempt.gate_id, "B27");
  assert.equal(after.state.attempts.BR, 2);
  assert.deepEqual(after.state.last_decision, lastDecision);
  await assertNoReceiptDirectory(after.runDir);
  assert.equal(
    trace.filter((entry) => entry === "launch:BR").length,
    2
  );
});

test("a blocked final repair stays blocked when its resume would exceed the limit", async (t) => {
  const { root } = await fixture(t, "workflow-repair.json");
  const trace = [];
  await start(root, trace);

  async function decideCurrent(decision, reason = undefined) {
    await writeReadyResult(root);
    await next(root, trace, decision, { reason });
  }

  await decideCurrent("approve"); // B25 -> B26
  await decideCurrent("approve"); // B26 -> B27
  await decideCurrent("revise", "First repair cycle."); // B27 -> BR1
  await decideCurrent("approve"); // BR1 -> B25
  await decideCurrent("approve"); // B25 -> B26
  await decideCurrent("approve"); // B26 -> B27
  await decideCurrent("revise", "Second repair cycle."); // B27 -> BR2
  await decideCurrent("block", "The second repair needs a human decision.");

  const before = await loadActiveRun(root);
  assert.equal(before.state.status, "blocked");
  assert.equal(before.state.active_gate_id, "BR");
  assert.equal(before.state.attempts.BR, 2);

  await assert.rejects(
    runStartCommand({
      repoRoot: root,
      host: "test",
      intake: undefined,
      resumeReason: "Try an impermissible third repair launch.",
      launch: async () => assert.fail("the third repair must not launch")
    }),
    /repair.*2|2.*repair|attempt limit/i
  );

  const after = await loadActiveRun(root);
  assert.equal(after.state.status, "blocked");
  assert.equal(after.state.stop_reason, "The second repair needs a human decision.");
  assert.equal(after.state.current_attempt, null);
  assert.equal(after.state.attempts.BR, 2);
});

test("OpenCode and Pi execute the same shared command plan", async (t) => {
  const traces = {};
  for (const host of ["opencode", "pi"]) {
    const { root } = await fixture(t);
    const trace = [];
    await start(root, trace, { host });
    await writeReadyResult(root);
    await next(root, trace, "approve", { host });
    traces[host] = trace;
  }
  assert.deepEqual(traces.opencode, [
    "launch:D01",
    "display:D01",
    "decide:D01",
    "launch:D02"
  ]);
  assert.deepEqual(traces.pi, traces.opencode);
});

test("both host adapters delegate command ownership to the shared runtime", async () => {
  for (const relative of [
    ".opencode/retrieval-phase-workflow.ts",
    ".pi/extensions/retrieval-phase.ts"
  ]) {
    const source = await readFile(path.join(repositoryRoot, relative), "utf8");
    assert.match(source, /\brunStartCommand\b/, `${relative} must delegate /retrieval-phase`);
    assert.match(source, /\brunNextCommand\b/, `${relative} must delegate /retrieval-phase-next`);
    assert.doesNotMatch(
      source,
      /(?:function|const)\s+run(?:Start|Next)Command\b/,
      `${relative} must not redefine shared command semantics`
    );
  }
});
