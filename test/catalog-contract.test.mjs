import assert from "node:assert/strict";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadWorkflow } from "../retrieval_agent_harness_phase_based/plugin-runtime.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the catalog has one ordered design-build-repair sequence", async () => {
  const workflow = await loadWorkflow(root);
  const expected = [
    "D01", "D02", "D03", "D05", "D06", "D07", "D09", "D10", "D12",
    "B14", "B15", "B16", "B17", "B18", "B19", "B20", "B21", "B22",
    "B24", "B25", "B26", "B27",
    "BR"
  ];
  assert.equal(workflow.version, 2);
  assert.equal(workflow.workflow_id, "retrieval-agent-build-v2");
  assert.deepEqual(workflow.gates.map((gate) => gate.id), expected);
  assert.equal(workflow.gates.filter((gate) => gate.phase === "technical-design").length, 9);
  assert.deepEqual(
    workflow.gates
      .filter((gate) => gate.phase === "implementation" && !gate.required)
      .map((gate) => gate.id),
    ["B14", "B15", "B16", "B17", "B18", "B19", "B20", "B21", "B22"]
  );
  assert.deepEqual(
    workflow.gates
      .filter((gate) => gate.phase === "implementation" && gate.required)
      .map((gate) => gate.id),
    ["B24", "B25", "B26", "B27"]
  );
  assert.deepEqual(workflow.repair, {
    gate_id: "BR",
    max_attempts: 2,
    return_to: "B25"
  });
});

test("the catalog carries the approved artifact, manifest, and decision contracts", async () => {
  const workflow = await loadWorkflow(root);
  const byID = Object.fromEntries(workflow.gates.map((gate) => [gate.id, gate]));
  assert.deepEqual(byID.D01.required_artifacts, [".sequence/design/01-repository-intake.json"]);
  assert.deepEqual(byID.D02.required_artifacts, [".sequence/design/02-outcome-acceptance.json"]);
  assert.deepEqual(byID.D03.required_artifacts, [".sequence/design/03-runtime-application-contract.json"]);
  assert.deepEqual(byID.D09.required_artifacts, [".sequence/design/09-python-architecture-rules.json"]);
  assert.deepEqual(byID.D10.required_artifacts, [".sequence/design/10-code-blueprint.json"]);
  assert.deepEqual(byID.D12.required_artifacts, [
    "docs/retrieval-agent-technical-design.md",
    ".sequence/phase-2-manifest.json"
  ]);
  for (const id of ["B18", "B19", "B20", "B21", "B22", "B24"]) {
    assert.deepEqual(byID[id].required_artifacts, [], `${id} must not require a source mirror`);
  }
  assert.equal(byID.B24.required, true);
  assert.equal(byID.B24.manifest_key, "B24");
  assert.equal(byID.B24.manifest_proposals, true);
  assert.deepEqual(
    workflow.gates.filter((gate) => gate.manifest_key).map((gate) => gate.manifest_key),
    ["B14", "B15", "B16", "B17", "B18", "B19", "B20", "B21", "B22", "B24"]
  );
  for (const id of ["D01", "D02", "D03", "D05", "D06", "D07", "D09", "D10", "D12", "B24", "B25", "B26", "B27"]) {
    assert.deepEqual(byID[id].allowed_human_decisions, ["approve", "revise", "block"]);
  }
  assert.equal(workflow.gates.some((gate) => "source_prompt" in gate), false);
});

test("each catalog gate has one focused self-contained canonical agent", async () => {
  const workflow = await loadWorkflow(root);
  for (const gate of workflow.gates) {
    const prompt = await readFile(path.join(root, gate.agent_prompt), "utf8");
    assert.match(prompt, /task: deny/, `${gate.id} must remain one focused agent`);
    assert.doesNotMatch(prompt, /proposed_children/, `${gate.id} may not invent child gates`);
    assert.doesNotMatch(prompt, /Binding vendored|PY-[A-Z0-9-]+/);
    const hostAgent = path.join(root, ".opencode", "agents", path.basename(gate.agent_prompt));
    assert.equal((await lstat(hostAgent)).isSymbolicLink(), true);
    assert.equal(await realpath(hostAgent), await realpath(path.join(root, gate.agent_prompt)));
  }
});
