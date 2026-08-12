import assert from "node:assert/strict";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  loadActiveRun,
  runNextCommand,
  runStartCommand
} from "../retrieval_agent_harness_phase_based/plugin-runtime.mjs";
import {
  appendAutopilotLedger,
  readAutopilotLedger
} from "../retrieval_agent_harness_phase_based/autopilot-ledger.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the autopilot ledger rejects serialization hooks that can replace audited fields", async (t) => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "retrieval-agent-ledger-contract-"));
  t.after(() => rm(runDir, { recursive: true, force: true }));
  await assert.rejects(
    appendAutopilotLedger(runDir, {
      event: "gate_decision",
      toJSON() {
        return { event: "substituted" };
      }
    }),
    /may not define toJSON/
  );
  assert.deepEqual(await readAutopilotLedger(runDir), []);
});

async function projectCopy(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "retrieval-agent-e2e-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(
    path.join(repositoryRoot, "retrieval_agent_harness_phase_based"),
    path.join(root, "retrieval_agent_harness_phase_based"),
    { recursive: true }
  );
  return root;
}

function phase2Manifest() {
  const gates = {};
  for (const id of ["B14", "B15", "B16", "B17", "B18", "B19", "B20", "B21", "B22"]) {
    const active = id === "B19";
    gates[id] = {
      active,
      reason: active
        ? "The simulated design requires one function-body implementation file."
        : "The simulated repository already satisfies this construction stage.",
      allowed_files: active ? ["src/agent.py"] : []
    };
  }
  gates.B24 = {
    active: true,
    reason: "The approved scenario requires a deterministic behavioral test.",
    allowed_files: ["tests/test_behavior.py"]
  };
  return { version: 1, gates };
}

async function writeProjectFile(root, relative, contents) {
  const absolute = path.join(root, relative);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, contents);
}

async function writeReadyResult(root, packet, options = {}) {
  const artifacts = [];
  for (const relative of packet.required_artifacts) {
    const contents = relative === ".sequence/phase-2-manifest.json"
      ? `${JSON.stringify(phase2Manifest(), null, 2)}\n`
      : relative.endsWith(".md")
        ? `# Simulated ${packet.gate.id} artifact\n`
        : `${JSON.stringify({ gate_id: packet.gate.id, simulated: true }, null, 2)}\n`;
    await writeProjectFile(root, relative, contents);
    artifacts.push({ path: relative, role: `${packet.gate.id} required artifact` });
  }
  for (const extra of options.extraArtifacts ?? []) {
    await writeProjectFile(root, extra.path, extra.contents);
    artifacts.push({ path: extra.path, role: extra.role });
  }

  const result = {
    gate_id: packet.gate.id,
    recommendation: options.recommendation ?? "approve",
    summary: options.summary ?? `${packet.gate.id} simulated successfully`,
    artifacts,
    evidence: options.evidence ?? [],
    uncertainties: [],
    blockers: options.blockers ?? []
  };
  await writeProjectFile(
    root,
    packet.gate_result_file,
    `${JSON.stringify(result, null, 2)}\n`
  );
}

async function noReceiptDirectory(runDir) {
  await assert.rejects(readdir(path.join(runDir, "receipts")), { code: "ENOENT" });
}

test("the real catalog completes living design, selected build, behavioral tests, repair, and revalidation", async (t) => {
  const root = await projectCopy(t);
  const launches = [];
  let packet;
  const launch = async (candidate) => {
    packet = candidate;
    launches.push(candidate.gate.id);
    return { id: `simulated-${candidate.gate.id}-${candidate.attempt}` };
  };

  await runStartCommand({
    repoRoot: root,
    host: "simulate",
    intake: {
      targetRepoPath: root,
      initialIdea: "Answer release-audit questions by planning a rate-limit-aware retrieval pipeline over GitHub, Jira, Confluence, and Datadog."
    },
    launch
  });

  const expected = [
    "D01", "D02", "D03", "D05", "D06", "D07", "D09", "D10", "D12",
    "B19", "B24", "B25", "B26", "B27", "BR", "B25", "B26", "B27"
  ];
  let revisedValidation = false;

  for (const [index, gateId] of expected.entries()) {
    assert.equal(packet.gate.id, gateId);
    assert.match(packet.message, new RegExp(`"gate_id": "${gateId}"`));
    assert.match(packet.message, /human reviews and advances with \/retrieval-phase-next/i);
    assert.match(packet.system, /Active Retrieval gate contract/);
    assert.doesNotMatch(packet.system, /Binding vendored Python-stage guidance|PY-[A-Z0-9-]+/);

    // These rendered handoffs protect the two load-bearing responsibilities moved out of D08.
    if (gateId === "D02") {
      assert.match(packet.system, /proportionate held-out evaluation bar/);
      assert.match(packet.system, /production-intended, pull-request-ready work/);
    }
    if (gateId === "D06") {
      assert.match(packet.system, /credential value in any cache entry, cursor record, dossier, ledger, fixture, or telemetry line is a defect/);
      assert.match(packet.system, /healing ledger records script identity and version, failure classification, the exact diff applied, attempt count, and outcome/);
    }
    if (gateId === "D09") {
      assert.match(packet.system, /explicit current inputs rather than an assumed contiguous gate range/);
    }
    if (gateId === "D12") {
      assert.match(packet.system, /Current living documents take precedence over retired numbered paths/);
    }

    if (gateId === "B24") {
      assert.match(packet.system, /fresh-prompt-marker/);
      assert.deepEqual(packet.allowed_files, ["tests/test_behavior.py"]);
      assert.deepEqual(packet.collaborative_edit_paths, [".sequence/phase-2-manifest.json"]);
    }
    if (gateId === "BR") {
      assert.deepEqual(packet.allowed_files, ["src/agent.py", "tests/test_behavior.py"]);
      await writeReadyResult(root, packet, {
        extraArtifacts: [{
          path: "src/unplanned.py",
          role: "Out-of-manifest repair",
          contents: "def unplanned() -> None:\n    pass\n"
        }]
      });
      const rejected = await runNextCommand({
        repoRoot: root,
        host: "simulate",
        display: async () => assert.fail("an out-of-manifest BR result must not reach review"),
        decide: async () => assert.fail("an out-of-manifest BR result must not receive a decision"),
        launch: async () => assert.fail("an out-of-manifest BR result must not launch")
      });
      assert.equal(rejected.kind, "invalid");
      assert.match(rejected.review.error, /outside its approved files: src\/unplanned\.py/);
      await rm(path.join(root, "src/unplanned.py"));
    }

    const extraArtifacts = [];
    if (gateId === "B19") {
      const b24PromptPath = "retrieval_agent_harness_phase_based/agents/gate-b24-integration-tests.md";
      const currentB24Prompt = await readFile(path.join(root, b24PromptPath), "utf8");
      extraArtifacts.push(
        {
          path: "src/agent.py",
          role: "Simulated Retrieval agent implementation",
          contents: "def answer() -> str:\n    return \"grounded\"\n"
        },
        {
          path: ".sequence/design/01-repository-intake.json",
          role: "Living upstream clarification",
          contents: `${JSON.stringify({ gate_id: "D01", clarified_by: "B19" }, null, 2)}\n`
        },
        {
          path: b24PromptPath,
          role: "Future focused prompt clarification",
          contents: `${currentB24Prompt.trimEnd()}\n\n<!-- fresh-prompt-marker -->\n`
        }
      );
    } else if (gateId === "B24") {
      extraArtifacts.push({
        path: "tests/test_behavior.py",
        role: "Scenario-driven behavioral test",
        contents: "def test_grounded_answer() -> None:\n    assert True\n"
      });
    } else if (gateId === "BR") {
      extraArtifacts.push({
        path: "src/agent.py",
        role: "Validator-directed repair",
        contents: "def answer() -> str:\n    return \"grounded and repaired\"\n"
      });
    }
    await writeReadyResult(root, packet, { extraArtifacts });

    const decision = gateId === "B27" && !revisedValidation ? "revise" : "approve";
    if (decision === "revise") revisedValidation = true;
    const outcome = await runNextCommand({
      repoRoot: root,
      host: "simulate",
      display: async (review) => assert.equal(review.gate.id, gateId),
      decide: async () => ({
        decision,
        ...(decision === "revise"
          ? { reason: "Repair the simulated validation finding." }
          : {})
      }),
      launch
    });
    if (index === expected.length - 1) assert.equal(outcome.kind, "complete");
  }

  const run = await loadActiveRun(root);
  assert.equal(run.state.version, 2);
  assert.equal(run.state.status, "complete");
  assert.equal(run.state.active_gate_id, null);
  assert.equal(run.state.attempts.BR, 1);
  assert.deepEqual(run.state.implementation_manifest, phase2Manifest());
  assert.equal("frozen_files" in run.state, false);
  assert.equal("latest_receipts" in run.state, false);
  await noReceiptDirectory(run.runDir);
  assert.deepEqual(launches, expected);
});

test("the real catalog completes the same route under autopilot ownership with a full decision ledger", async (t) => {
  const root = await projectCopy(t);
  const launches = [];
  let packet;
  const launch = async (candidate) => {
    packet = candidate;
    launches.push(candidate.gate.id);
    return { id: `auto-${candidate.gate.id}-${candidate.attempt}`, mode: "auto" };
  };

  await runStartCommand({
    repoRoot: root,
    host: "pi",
    sessionMode: "auto",
    intake: {
      targetRepoPath: root,
      initialIdea: "Answer release-audit questions by planning a rate-limit-aware retrieval pipeline over GitHub, Jira, Confluence, and Datadog."
    },
    launch
  });
  let ledgerRunDir = (await loadActiveRun(root)).runDir;
  await appendAutopilotLedger(ledgerRunDir, {
    event: "run_started",
    initial_idea: "Answer release-audit questions by planning a rate-limit-aware retrieval pipeline over GitHub, Jira, Confluence, and Datadog.",
    target_repo_path: root
  });

  const expected = [
    "D01", "D02", "D03", "D05", "D06", "D07", "D09", "D10", "D12",
    "B19", "B24", "B25", "B26", "B27", "BR", "B25", "B26", "B27"
  ];
  let revisedValidation = false;

  for (const [index, gateId] of expected.entries()) {
    assert.equal(packet.gate.id, gateId);
    assert.match(packet.message, /supervising autopilot operator reviews this result and advances the run/);
    assert.doesNotMatch(packet.message, /human reviews and advances/i);
    const run = await loadActiveRun(root);
    assert.equal(run.state.current_attempt.session.mode, "auto");

    const extraArtifacts = [];
    if (gateId === "B19") {
      extraArtifacts.push({
        path: "src/agent.py",
        role: "Simulated Retrieval agent implementation",
        contents: "def answer() -> str:\n    return \"grounded\"\n"
      });
    } else if (gateId === "B24") {
      extraArtifacts.push({
        path: "tests/test_behavior.py",
        role: "Scenario-driven behavioral test",
        contents: "def test_grounded_answer() -> None:\n    assert True\n"
      });
    } else if (gateId === "BR") {
      extraArtifacts.push({
        path: "src/agent.py",
        role: "Validator-directed repair",
        contents: "def answer() -> str:\n    return \"grounded and repaired\"\n"
      });
    }
    await writeReadyResult(root, packet, { extraArtifacts });

    const decision = gateId === "B27" && !revisedValidation ? "revise" : "approve";
    if (decision === "revise") revisedValidation = true;
    const outcome = await runNextCommand({
      repoRoot: root,
      host: "pi",
      sessionMode: "auto",
      display: async (review) => assert.equal(review.gate.id, gateId),
      decide: async () => ({
        decision,
        ...(decision === "revise"
          ? { reason: "Repair the simulated validation finding." }
          : {})
      }),
      launch
    });
    await appendAutopilotLedger(ledgerRunDir, {
      event: "gate_decision",
      gate_id: gateId,
      attempt: packet.attempt,
      decision,
      rationale: `Simulated autopilot decision loop for ${gateId}.`
    });
    if (index === expected.length - 1) assert.equal(outcome.kind, "complete");
  }

  const run = await loadActiveRun(root);
  assert.equal(run.state.status, "complete");
  assert.equal(run.state.last_decision.decided_by_mode, "auto");
  assert.deepEqual(launches, expected);

  const ledger = await readAutopilotLedger(ledgerRunDir);
  assert.equal(ledger.length, expected.length + 1);
  assert.equal(ledger[0].event, "run_started");
  for (const entry of ledger) {
    assert.match(entry.recorded_at, /^\d{4}-\d{2}-\d{2}T/);
  }
  assert.deepEqual(
    ledger.slice(1).map((entry) => entry.gate_id),
    expected
  );
});

test("working-tree manifest edits cannot widen later routing or BR authority", async (t) => {
  const root = await projectCopy(t);
  let packet;
  const launch = async (candidate) => {
    packet = candidate;
    return { id: `pin-check-${candidate.gate.id}-${candidate.attempt}` };
  };
  await runStartCommand({
    repoRoot: root,
    host: "simulate",
    intake: {
      targetRepoPath: root,
      initialIdea: "Answer release-audit questions by planning a rate-limit-aware retrieval pipeline over GitHub, Jira, Confluence, and Datadog."
    },
    launch
  });

  const technical = ["D01", "D02", "D03", "D05", "D06", "D07", "D09", "D10", "D12"];
  for (const gateId of technical) {
    assert.equal(packet.gate.id, gateId);
    await writeReadyResult(root, packet);
    await runNextCommand({
      repoRoot: root,
      host: "simulate",
      display: async () => {},
      decide: async () => ({ decision: "approve" }),
      launch
    });
  }
  assert.equal(packet.gate.id, "B19");

  const widened = phase2Manifest();
  widened.gates.B20 = {
    active: true,
    reason: "A working-tree proposal tries to activate another writer.",
    allowed_files: ["src/unplanned.py"]
  };
  widened.gates.B19.allowed_files.push("src/unplanned.py");
  await writeProjectFile(
    root,
    ".sequence/phase-2-manifest.json",
    `${JSON.stringify(widened, null, 2)}\n`
  );

  await writeReadyResult(root, packet, {
    extraArtifacts: [{
      path: "src/agent.py",
      role: "Pinned B19 implementation",
      contents: "def answer() -> str:\n    return \"grounded\"\n"
    }]
  });
  await runNextCommand({
    repoRoot: root,
    host: "simulate",
    display: async () => {},
    decide: async () => ({ decision: "approve" }),
    launch
  });
  assert.equal(packet.gate.id, "B24", "the unapproved B20 activation must remain ignored");
  assert.deepEqual(packet.allowed_files, ["tests/test_behavior.py"]);

  await writeReadyResult(root, packet, {
    extraArtifacts: [{
      path: "tests/test_behavior.py",
      role: "Behavioral test",
      contents: "def test_behavior() -> None:\n    assert True\n"
    }]
  });
  await runNextCommand({ repoRoot: root, host: "simulate", display: async () => {}, decide: async () => ({ decision: "approve" }), launch });
  for (const gateId of ["B25", "B26"]) {
    assert.equal(packet.gate.id, gateId);
    await writeReadyResult(root, packet);
    await runNextCommand({ repoRoot: root, host: "simulate", display: async () => {}, decide: async () => ({ decision: "approve" }), launch });
  }
  assert.equal(packet.gate.id, "B27");
  await writeReadyResult(root, packet, { recommendation: "revise" });
  await runNextCommand({
    repoRoot: root,
    host: "simulate",
    display: async () => {},
    decide: async () => ({ decision: "revise", reason: "Exercise pinned BR authority." }),
    launch
  });
  assert.equal(packet.gate.id, "BR");
  assert.deepEqual(packet.allowed_files, ["src/agent.py", "tests/test_behavior.py"]);
  assert.equal(packet.allowed_files.includes("src/unplanned.py"), false);

  const run = await loadActiveRun(root);
  assert.deepEqual(run.state.implementation_manifest, phase2Manifest());
  await noReceiptDirectory(run.runDir);
});
