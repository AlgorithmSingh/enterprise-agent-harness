import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, link, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowBytes = await readFile(
  path.join(repositoryRoot, "retrieval_agent_harness_phase_based", "workflow.json")
);
const canonicalWorkflow = JSON.parse(workflowBytes.toString("utf8"));
const canonicalSharedPrompt = canonicalWorkflow.shared_prompt;
const workflowCatalogBinding = {
  path: "retrieval_agent_harness_phase_based/workflow.json",
  size: workflowBytes.length,
  sha256: createHash("sha256").update(workflowBytes).digest("hex")
};

const {
  createGateToolGuard,
  default: registerPiAdapter,
  guardPiGateTool,
  injectPiGateRole
} = await import("../.pi/extensions/retrieval-phase.ts");
const {
  loadActiveRun,
  runStartCommand
} = await import("../retrieval_agent_harness_phase_based/plugin-runtime.mjs");
const { DefaultResourceLoader } = await import(
  "../.pi/node_modules/@earendil-works/pi-coding-agent/dist/index.js"
);

async function activePiFixture(t, gateId = "D01") {
  const root = await mkdtemp(path.join(os.tmpdir(), "retrieval-pi-adapter-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const runId = "pi-contract-run";
  const runDir = path.join(root, ".retrieval-agent-runs", runId);
  await mkdir(runDir, { recursive: true });
  await writeFile(
    path.join(root, ".retrieval-agent-runs", "active.json"),
    `${JSON.stringify({
      version: 2,
      workflow_id: "retrieval-agent-build-v2",
      run_id: runId
    }, null, 2)}\n`
  );
  await writeFile(
    path.join(runDir, "workflow-state.json"),
    `${JSON.stringify({
      version: 2,
      workflow_id: "retrieval-agent-build-v2",
      run_id: runId,
      status: "active",
      active_gate_id: gateId,
      current_attempt: {
        gate_id: gateId,
        number: 1,
        launch_id: "111111111111111111111111",
        result_path: `gates/${gateId}/attempt-1/gate-result.json`,
        workflow_catalog: workflowCatalogBinding,
        session: {
          host: "pi",
          mode: "manual",
          id: "current-pi-session",
          path: "session.jsonl"
        },
        delivery_status: "delivered"
      }
    }, null, 2)}\n`
  );
  return { root, runId };
}

function context(root, sessionId, branch, overrides = {}) {
  return {
    cwd: root,
    sessionManager: {
      getSessionId: () => sessionId,
      getSessionFile: () => "session.jsonl",
      getBranch: () => branch
    },
    ...overrides
  };
}

function launchEntry(runId, {
  gateId = "D01",
  editableFiles = [".sequence/design/01-repository-intake.json"],
  collaborativeEditPaths = []
} = {}) {
  return {
    type: "custom",
    customType: "retrieval-phase-system",
    data: {
      run_id: runId,
      gate_id: gateId,
      attempt: 1,
      launch_id: "111111111111111111111111",
      session_id: "current-pi-session",
      session_path: "session.jsonl",
      session_mode: "manual",
      gate_result_file:
        `.retrieval-agent-runs/${runId}/gates/${gateId}/attempt-1/gate-result.json`,
      editable_files: editableFiles,
      collaborative_edit_paths: collaborativeEditPaths,
      system: `Exact persisted ${gateId} system role.`
    }
  };
}

test("Pi fails closed when an active gate loses its persisted launch role", async (t) => {
  const { root } = await activePiFixture(t);
  const ctx = context(root, "current-pi-session", []);

  const role = await injectPiGateRole({ systemPrompt: "Base role" }, ctx);
  assert.match(role.systemPrompt, /Retrieval phase safety stop/);
  assert.match(role.systemPrompt, /missing its persisted launch role/);

  const guarded = await guardPiGateTool(
    { toolName: "write", input: { path: "src/unplanned.py" } },
    ctx
  );
  assert.equal(guarded.block, true);
  assert.match(guarded.reason, /missing its persisted launch role/);
});

test("Pi project discovery loads the manual adapter and excludes the optional meta and autopilot adapters", async (t) => {
  const agentDir = await mkdtemp(path.join(os.tmpdir(), "retrieval-pi-agent-dir-"));
  t.after(() => rm(agentDir, { recursive: true, force: true }));
  const loader = new DefaultResourceLoader({
    cwd: repositoryRoot,
    agentDir,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true
  });

  await loader.reload();
  const loaded = loader.getExtensions();
  assert.deepEqual(loaded.errors, []);
  assert.deepEqual(
    loaded.extensions.map((extension) => path.basename(extension.path)),
    ["retrieval-phase.ts"]
  );
});

test("Pi fails closed when workflow state is corrupt and launch metadata is missing", async (t) => {
  const { root, runId } = await activePiFixture(t);
  await writeFile(
    path.join(root, ".retrieval-agent-runs", runId, "workflow-state.json"),
    "{not valid json\n"
  );
  const ctx = context(root, "current-pi-session", []);

  const role = await injectPiGateRole({ systemPrompt: "Base role" }, ctx);
  assert.match(role.systemPrompt, /Retrieval phase safety stop/);
  assert.match(role.systemPrompt, /could not be verified/);

  const guarded = await guardPiGateTool(
    { toolName: "write", input: { path: "src/unplanned.py" } },
    ctx
  );
  assert.equal(guarded.block, true);
  assert.match(guarded.reason, /workflow state is invalid/);
});

test("Pi blocks stale gate sessions and enforces the current gate's exact files", async (t) => {
  const { root, runId } = await activePiFixture(t);
  const entry = launchEntry(runId);

  const stale = context(root, "older-pi-session", [entry]);
  const staleRole = await injectPiGateRole({ systemPrompt: "Base role" }, stale);
  assert.match(staleRole.systemPrompt, /stale Retrieval gate session/);
  const staleTool = await guardPiGateTool(
    { toolName: "bash", input: { command: "true" } },
    stale
  );
  assert.equal(staleTool.block, true);
  assert.match(staleTool.reason, /stale Retrieval gate session/);

  const current = context(root, "current-pi-session", [entry]);
  const activeRole = await injectPiGateRole({ systemPrompt: "Base role" }, current);
  assert.match(activeRole.systemPrompt, /Exact persisted D01 system role/);
  const denied = await guardPiGateTool(
    { toolName: "write", input: { path: "src/unplanned.py" } },
    current
  );
  assert.equal(denied.block, true);
  const allowed = await guardPiGateTool(
    {
      toolName: "write",
      input: { path: ".sequence/design/01-repository-intake.json" }
    },
    current
  );
  assert.equal(allowed, undefined);
});

test("Pi rechecks the full immutable launch after awaited bash approval", async (t) => {
  const { root, runId } = await activePiFixture(t);
  const entry = launchEntry(runId);
  let releaseApproval;
  let approvalOpened;
  const opened = new Promise((resolve) => {
    approvalOpened = resolve;
  });
  const approved = new Promise((resolve) => {
    releaseApproval = resolve;
  });
  const current = context(root, "current-pi-session", [entry], {
    hasUI: true,
    ui: {
      async confirm() {
        approvalOpened();
        return await approved;
      }
    }
  });

  const guarded = guardPiGateTool(
    { toolName: "bash", input: { command: "printf safe" } },
    current
  );
  await opened;
  const statePath = path.join(root, ".retrieval-agent-runs", runId, "workflow-state.json");
  const state = JSON.parse(await readFile(statePath, "utf8"));
  state.current_attempt.launch_id = "222222222222222222222222";
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);
  releaseApproval(true);

  const result = await guarded;
  assert.equal(result?.block, true);
  assert.match(result?.reason, /stale Retrieval gate session|no longer current/);
});

test("Pi rejects an allowed existing file hard-linked to protected workflow material", async (t) => {
  const { root, runId } = await activePiFixture(t, "D05");
  await mkdir(path.join(root, ".pi"), { recursive: true });
  await mkdir(path.join(root, "src"), { recursive: true });
  const protectedPath = path.join(root, ".pi", "protected-config.json");
  const allowedAlias = path.join(root, "src", "agent.py");
  await writeFile(protectedPath, "protected\n");
  await link(protectedPath, allowedAlias);
  const entry = launchEntry(runId, {
    gateId: "D05",
    editableFiles: ["src/agent.py"]
  });
  const current = context(root, "current-pi-session", [entry]);

  const result = await guardPiGateTool(
    { toolName: "write", input: { path: "src/agent.py" } },
    current
  );
  if (result === undefined) {
    await writeFile(allowedAlias, "bypassed\n");
    assert.equal(
      await readFile(protectedPath, "utf8"),
      "bypassed\n",
      "the pre-repair fixture demonstrates that the allowed alias mutates the protected inode"
    );
  }
  assert.equal(result?.block, true);
  assert.match(result?.reason, /hard link|multiple links/);
  assert.equal(await readFile(protectedPath, "utf8"), "protected\n");
});

test("Pi rejects a symlinked docs tree before wildcard authority can broaden into source", async (t) => {
  const { root, runId } = await activePiFixture(t, "D05");
  await mkdir(path.join(root, "src"), { recursive: true });
  await symlink("src", path.join(root, "docs"));
  const entry = launchEntry(runId, {
    gateId: "D05",
    editableFiles: [],
    collaborativeEditPaths: ["docs/**"]
  });
  const current = context(root, "current-pi-session", [entry]);

  const result = await guardPiGateTool(
    { toolName: "write", input: { path: "docs/agent.py" } },
    current
  );
  assert.equal(result?.block, true);
  assert.match(result?.reason, /symbolic link.*docs/i);
});

test("Pi rejects a symlinked exact authority even when the gate names its direct target", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "retrieval-pi-exact-symlink-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(path.join(root, "src", "actual.py"), "protected by lexical authority\n");
  await symlink("actual.py", path.join(root, "src", "allowed.py"));
  const guard = createGateToolGuard({
    projectRoot: root,
    gateResultFile: ".retrieval-agent-runs/run/gates/D05/attempt-1/gate-result.json",
    editableFiles: ["src/allowed.py"],
    requestBashApproval: async () => ({ approved: false })
  });

  for (const candidate of ["src/allowed.py", "src/actual.py"]) {
    const result = await guard({ toolName: "write", input: { path: candidate } });
    assert.equal(result?.block, true, `expected Pi to reject ${candidate}`);
    assert.match(result?.reason, /symbolic link.*src\/allowed\.py/i);
  }
});

test("Pi grants declared living-workspace paths and denies protected or unrouted paths", async (t) => {
  const { root, runId } = await activePiFixture(t, "D05");
  const entry = launchEntry(runId, {
    gateId: "D05",
    editableFiles: [".sequence/design/05-tools-trust-effects.json", "src/agent.py"],
    collaborativeEditPaths: [
      ".sequence/design/02-outcome-acceptance.json",
      "retrieval_agent_harness_phase_based/agents/gate-b24-integration-tests.md",
      canonicalSharedPrompt,
      ".sequence/phase-2-manifest.json",
      "docs/**"
    ]
  });
  const current = context(root, "current-pi-session", [entry]);

  for (const candidate of [
    ".sequence/design/05-tools-trust-effects.json",
    "src/agent.py",
    ".sequence/design/02-outcome-acceptance.json",
    "retrieval_agent_harness_phase_based/agents/gate-b24-integration-tests.md",
    canonicalSharedPrompt,
    ".sequence/phase-2-manifest.json",
    "docs/design/note.md"
  ]) {
    assert.equal(
      await guardPiGateTool({ toolName: "write", input: { path: candidate } }, current),
      undefined,
      `expected Pi to allow ${candidate}`
    );
  }

  for (const candidate of [
    "src/unrouted.py",
    "retrieval_agent_harness_phase_based/plugin-runtime.mjs",
    "retrieval_agent_harness_phase_based/workflow.json",
    ".opencode/retrieval-phase-workflow.ts",
    ".pi/extensions/retrieval-phase.ts",
    "reference/python-typescript-swift-sequence/python/SEQUENCE.md",
    ".git/config"
  ]) {
    const denied = await guardPiGateTool(
      { toolName: "write", input: { path: candidate } },
      current
    );
    assert.equal(denied?.block, true, `expected Pi to deny ${candidate}`);
  }
});

test("Pi keeps B24 manifest proposals separate from current production authority", async (t) => {
  const { root, runId } = await activePiFixture(t, "B24");
  const entry = launchEntry(runId, {
    gateId: "B24",
    editableFiles: ["tests/test_behavior.py", "tests/fixtures/case.json"],
    collaborativeEditPaths: [".sequence/phase-2-manifest.json"]
  });
  const current = context(root, "current-pi-session", [entry]);

  for (const candidate of [
    "tests/test_behavior.py",
    "tests/fixtures/case.json",
    ".sequence/phase-2-manifest.json"
  ]) {
    assert.equal(
      await guardPiGateTool({ toolName: "write", input: { path: candidate } }, current),
      undefined,
      `expected B24 to allow ${candidate}`
    );
  }
  for (const candidate of [
    "src/agent.py",
    "docs/design/note.md",
    "retrieval_agent_harness_phase_based/agents/gate-b24-integration-tests.md"
  ]) {
    const denied = await guardPiGateTool(
      { toolName: "write", input: { path: candidate } },
      current
    );
    assert.equal(denied?.block, true, `expected B24 to deny ${candidate}`);
  }
});

test("Pi lets the human confirm an uncertain delivered kickoff without a duplicate launch", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "retrieval-pi-delivery-confirm-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(
    path.join(repositoryRoot, "retrieval_agent_harness_phase_based"),
    path.join(root, "retrieval_agent_harness_phase_based"),
    { recursive: true }
  );

  const uncertain = Object.assign(new Error("simulated loss after Pi delivery"), {
    preserveRecordedAttempt: true
  });
  await assert.rejects(
    runStartCommand({
      repoRoot: root,
      host: "pi",
      intake: {
        targetRepoPath: root,
        initialIdea: "Verify human-confirmed Pi delivery does not duplicate a gate turn."
      },
      launch: async (_packet, record) => {
        await record({ id: "delivered-unmarked-pi-d01", path: "gate-session.jsonl" });
        throw uncertain;
      }
    }),
    /simulated loss after Pi delivery/
  );

  const commands = new Map();
  registerPiAdapter({
    on() {},
    registerCommand(name, command) {
      commands.set(name, command);
    }
  });
  const confirmationTitles = [];
  const notifications = [];
  const ctx = {
    cwd: root,
    hasUI: true,
    isProjectTrusted: () => true,
    model: { id: "test-model" },
    modelRegistry: { hasConfiguredAuth: () => true },
    sessionManager: {
      getSessionFile: () => "parent-session.jsonl"
    },
    waitForIdle: async () => {},
    newSession: async () => {
      throw new Error("confirmed delivery must not create another Pi session");
    },
    ui: {
      async confirm(title) {
        confirmationTitles.push(title);
        return true;
      },
      async input() {
        throw new Error("delivery confirmation must not request new intake");
      },
      notify(message, type) {
        notifications.push({ message, type });
      }
    }
  };

  await commands.get("retrieval-phase").handler("", ctx);

  assert.deepEqual(confirmationTitles, ["Was kickoff delivered for D01?"]);
  assert.equal(
    notifications.some(({ type }) => type === "error"),
    false,
    notifications.map(({ message }) => message).join("; ")
  );
  const run = await loadActiveRun(root);
  assert.equal(run.state.current_attempt.session.id, "delivered-unmarked-pi-d01");
  assert.equal(run.state.current_attempt.delivery_status, "delivered");
  assert.equal(run.state.attempts.D01, 1);
});
