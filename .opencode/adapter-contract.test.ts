import assert from "node:assert/strict";
import { appendFile, cp, link, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  loadActiveRun,
  runStartCommand,
} from "../retrieval_agent_harness_phase_based/plugin-runtime.mjs";
import {
  gateSessionPermissions,
  launchGateSession,
  retireGateSession,
  type GateLaunchPacket,
  type GateSessionReference,
} from "./retrieval-gate-session.ts";
import { reviewText, tui } from "./retrieval-phase-workflow.ts";

function permissionPacket(overrides: Partial<GateLaunchPacket> = {}): GateLaunchPacket {
  return {
    gate: { id: "D05", title: "Tools, integrations, trust, and effects" },
    attempt: 1,
    launch_id: "launch-permission-run-d05-1",
    run_id: "permission-run",
    agent_name: "gate-d05-tools-trust-effects",
    title: "permission-run · D05",
    gate_result_file: ".retrieval-agent-runs/permission-run/gates/D05/attempt-1/gate-result.json",
    required_artifacts: [".sequence/design/05-tools-trust-effects.json"],
    allowed_files: ["src/agent.py"],
    collaborative_edit_paths: [
      ".sequence/design/02-outcome-acceptance.json",
      "retrieval_agent_harness_phase_based/agents/gate-b24-integration-tests.md",
      "retrieval_agent_harness_phase_based/_SHARED-RETRIEVAL-ENGINEERING-RULES.md",
      ".sequence/phase-2-manifest.json",
      "docs/**",
    ],
    allowed_human_decisions: ["approve", "revise", "block"],
    system: "system",
    message: "message",
    ...overrides,
  };
}

test("OpenCode grants declared living-workspace paths and keeps control paths denied", () => {
  const rules = gateSessionPermissions(permissionPacket());
  const has = (pattern: string, action: "allow" | "deny") =>
    rules.some((rule) => rule.permission === "edit" && rule.pattern === pattern && rule.action === action);

  for (const allowed of [
    ".sequence/design/05-tools-trust-effects.json",
    "src/agent.py",
    ".sequence/design/02-outcome-acceptance.json",
    "retrieval_agent_harness_phase_based/agents/gate-b24-integration-tests.md",
    "retrieval_agent_harness_phase_based/_SHARED-RETRIEVAL-ENGINEERING-RULES.md",
    ".sequence/phase-2-manifest.json",
    "docs/**",
    ".retrieval-agent-runs/permission-run/gates/D05/attempt-1/gate-result.json",
  ]) {
    assert.equal(has(allowed, "allow"), true, `missing allow rule for ${allowed}`);
  }
  for (const denied of [
    ".retrieval-agent-runs/**",
    "retrieval_agent_harness_phase_based/workflow.json",
    "retrieval_agent_harness_phase_based/plugin-runtime.mjs",
    "retrieval_agent_harness_phase_based/meta-review-binding.mjs",
    ".opencode/**",
    ".pi/**",
    "reference/**",
    ".git/**",
  ]) {
    assert.equal(has(denied, "deny"), true, `missing deny rule for ${denied}`);
  }

  for (const protectedPath of [
    "retrieval_agent_harness_phase_based/plugin-runtime.mjs",
    "retrieval_agent_harness_phase_based/workflow.json",
    ".opencode/retrieval-phase-workflow.ts",
    ".pi/extensions/retrieval-phase.ts",
    "reference/python-typescript-swift-sequence/python/SEQUENCE.md",
    ".git/config",
  ]) {
    assert.throws(
      () => gateSessionPermissions(permissionPacket({ collaborative_edit_paths: [protectedPath] })),
      /protected/,
    );
  }
});

test("OpenCode keeps B24 manifest proposals separate from current production authority", () => {
  const rules = gateSessionPermissions(permissionPacket({
    gate: { id: "B24", title: "Behavioral integration tests" },
    agent_name: "gate-b24-integration-tests",
    gate_result_file: ".retrieval-agent-runs/permission-run/gates/B24/attempt-1/gate-result.json",
    required_artifacts: [],
    allowed_files: ["tests/test_behavior.py", "tests/fixtures/case.json"],
    collaborative_edit_paths: [".sequence/phase-2-manifest.json"],
  }));
  const allowed = rules
    .filter((rule) => rule.permission === "edit" && rule.action === "allow")
    .map((rule) => rule.pattern);

  assert.ok(allowed.includes("tests/test_behavior.py"));
  assert.ok(allowed.includes("tests/fixtures/case.json"));
  assert.ok(allowed.includes(".sequence/phase-2-manifest.json"));
  assert.equal(allowed.includes("src/agent.py"), false);
  assert.equal(allowed.includes("docs/**"), false);
  assert.equal(
    allowed.some((value) => value.startsWith("retrieval_agent_harness_phase_based/agents/")),
    false,
  );
});

test("OpenCode aborts an in-flight turn before retiring its gate authority", async () => {
  const events: string[] = [];
  let finishAbort: (() => void) | undefined;
  const abortFinished = new Promise<void>((resolve) => {
    finishAbort = resolve;
  });
  const client = {
    session: {
      async abort() {
        events.push("abort:start");
        await abortFinished;
        events.push("abort:end");
        return { data: true, error: undefined };
      },
      async update() {
        events.push("update");
        return { data: true, error: undefined };
      },
    },
  };

  const retiring = retireGateSession(
    client as unknown as import("./retrieval-gate-session.ts").GateSessionClient,
    "/tmp/retrieval-opencode-retire",
    "in-flight",
  );
  await Promise.resolve();
  assert.deepEqual(events, ["abort:start"]);
  finishAbort?.();
  await retiring;
  assert.deepEqual(events, ["abort:start", "abort:end", "update"]);
});

test("OpenCode rejects an allowed existing file hard-linked to protected workflow material", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "retrieval-opencode-hardlink-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, ".opencode"), { recursive: true });
  await mkdir(path.join(root, "src"), { recursive: true });
  const protectedPath = path.join(root, ".opencode", "protected-config.json");
  const allowedAlias = path.join(root, "src", "agent.py");
  await writeFile(protectedPath, "protected\n");
  await link(protectedPath, allowedAlias);
  let created = false;
  const client = {
    session: {
      async create() {
        created = true;
        return { data: { id: "hardlink-session", parentID: null }, error: undefined };
      },
      async promptAsync() {
        await writeFile(allowedAlias, "bypassed\n");
        return { data: undefined, error: undefined };
      },
      async abort() {
        return { data: true, error: undefined };
      },
      async update() {
        return { data: true, error: undefined };
      },
    },
  };

  await assert.rejects(
    launchGateSession({
      client,
      directory: root,
      packet: permissionPacket({ allowed_files: ["src/agent.py"] }),
      sessionMode: "manual",
      recordSession: async () => {},
    }),
    /hard link|multiple links/,
  );
  assert.equal(created, false);
  assert.equal(await readFile(protectedPath, "utf8"), "protected\n");
});

test("OpenCode rejects symlink traversal in exact and docs-tree writable authority", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "retrieval-opencode-symlink-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, ".opencode"), { recursive: true });
  await mkdir(path.join(root, "docs"), { recursive: true });
  await mkdir(path.join(root, "src"), { recursive: true });
  const protectedPath = path.join(root, ".opencode", "protected-config.json");
  await writeFile(protectedPath, "protected\n");
  await symlink("../.opencode", path.join(root, "docs", "alias"));
  await symlink("../.opencode/protected-config.json", path.join(root, "src", "agent.py"));
  let createCalls = 0;
  const client = {
    session: {
      async create() {
        createCalls += 1;
        return { data: { id: "symlink-session", parentID: null }, error: undefined };
      },
      async promptAsync() {
        assert.fail("a symlinked authority must fail before session creation");
      },
      async abort() {
        return { data: true, error: undefined };
      },
      async update() {
        return { data: true, error: undefined };
      },
    },
  };

  await assert.rejects(
    launchGateSession({
      client,
      directory: root,
      packet: permissionPacket({ allowed_files: [], collaborative_edit_paths: ["docs/**"] }),
      sessionMode: "manual",
      recordSession: async () => {},
    }),
    /symbolic link docs\/alias/,
  );
  await assert.rejects(
    launchGateSession({
      client,
      directory: root,
      packet: permissionPacket({ allowed_files: ["src/agent.py"], collaborative_edit_paths: [] }),
      sessionMode: "manual",
      recordSession: async () => {},
    }),
    /symbolic link src\/agent\.py/,
  );
  assert.equal(createCalls, 0);
  assert.equal(await readFile(protectedPath, "utf8"), "protected\n");
});

test("OpenCode retires a recorded gate session when kickoff delivery fails", async () => {
  const updates: Array<Record<string, any>> = [];
  let recorded = false;
  const client = {
    session: {
      async create() {
        return { data: { id: "failed-kickoff", parentID: null }, error: undefined };
      },
      async promptAsync() {
        return { data: undefined, error: { message: "simulated delivery failure" } };
      },
      async abort() {
        return { data: true, error: undefined };
      },
      async update(parameters: Record<string, any>) {
        updates.push(parameters);
        return { data: true, error: undefined };
      },
    },
  };

  await assert.rejects(
    launchGateSession({
      client,
      directory: "/tmp/retrieval-opencode-kickoff",
      packet: permissionPacket(),
      sessionMode: "manual",
      recordSession: async (session) => {
        assert.equal(session.mode, "manual");
        recorded = true;
      },
    }),
    /session\.promptAsync failed/,
  );
  assert.equal(recorded, true);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].sessionID, "failed-kickoff");
  assert.equal(updates[0].metadata.retrieval_gate_status, "retired");
  assert.ok(
    updates[0].permission
      .filter((rule: any) => ["edit", "bash"].includes(rule.permission))
      .every((rule: any) => rule.action === "deny"),
  );
});

test("OpenCode retires an unexpected child session before rejecting the launch", async () => {
  const events: string[] = [];
  let recorded = false;
  const client = {
    session: {
      async create() {
        return { data: { id: "unexpected-child", parentID: "operator-parent" }, error: undefined };
      },
      async promptAsync() {
        assert.fail("an unexpected child must never receive the gate kickoff");
      },
      async abort() {
        events.push("abort:unexpected-child");
        return { data: true, error: undefined };
      },
      async update(parameters: Record<string, any>) {
        events.push(`retire:${parameters.sessionID}`);
        assert.equal(parameters.metadata.retrieval_gate_status, "retired");
        return { data: true, error: undefined };
      },
    },
  };

  await assert.rejects(
    launchGateSession({
      client,
      directory: "/tmp/retrieval-opencode-child",
      packet: permissionPacket(),
      sessionMode: "manual",
      recordSession: async () => {
        recorded = true;
      },
    }),
    /created child session unexpected-child; a fresh root session is required/,
  );
  assert.deepEqual(events, ["abort:unexpected-child", "retire:unexpected-child"]);
  assert.equal(recorded, true, "the child id is recorded as pending cleanup authority before validation");
});

test("OpenCode reports when an unexpected child's authority cannot be retired", async () => {
  const events: string[] = [];
  let recorded = false;
  const client = {
    session: {
      async create() {
        return { data: { id: "unsafe-child", parentID: "operator-parent" }, error: undefined };
      },
      async promptAsync() {
        assert.fail("an unexpected child must never receive the gate kickoff");
      },
      async abort() {
        events.push("abort:unsafe-child");
        return { data: true, error: undefined };
      },
      async update() {
        events.push("retire:unsafe-child");
        return { data: undefined, error: { message: "simulated retirement failure" } };
      },
    },
  };

  await assert.rejects(
    launchGateSession({
      client,
      directory: "/tmp/retrieval-opencode-unsafe-child",
      packet: permissionPacket(),
      sessionMode: "manual",
      recordSession: async (session) => {
        assert.equal(session.id, "unsafe-child");
        recorded = true;
      },
    }),
    /kickoff failed.*unsafe-child.*could not be retired.*simulated retirement failure/,
  );
  assert.equal(recorded, true);
  assert.deepEqual(events, [
    "abort:unsafe-child",
    "retire:unsafe-child",
    "abort:unsafe-child",
    "retire:unsafe-child",
  ]);
});

test("OpenCode keeps gate review concise without hiding omitted decision evidence", () => {
  const repeated = (prefix: string) =>
    Array.from({ length: 12 }, (_, index) => `${prefix} ${index} ${"x".repeat(600)}`);
  const text = reviewText({
    gate: { id: "B27", title: "Independent validation" },
    attempt: { result_path: "gates/B27/attempt-1/gate-result.json" },
    allowed_human_decisions: ["approve", "revise", "block"],
    result: {
      recommendation: "revise",
      summary: "s".repeat(2_000),
      blockers: repeated("blocker"),
      evidence: repeated("evidence").map((supports, index) => ({
        path: `reports/evidence-${index}.json`,
        supports,
      })),
      artifacts: repeated("artifact").map((_, index) => ({
        path: `reports/artifact-${index}.json`,
        role: "test artifact",
      })),
      uncertainties: repeated("uncertainty"),
    },
  });

  assert.ok(text.length < 4_000, `review text is too long: ${text.length}`);
  assert.ok(text.indexOf("Blockers:") < text.indexOf("Summary:"));
  assert.match(text, /\(\+9 more in gate-result\.json\)/);
  assert.match(text, /Full result: gates\/B27\/attempt-1\/gate-result\.json/);
});

test("OpenCode accepts its 204 kickoff response after durably recording the root session", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "retrieval-opencode-adapter-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(
    path.resolve("..", "retrieval_agent_harness_phase_based"),
    path.join(root, "retrieval_agent_harness_phase_based"),
    { recursive: true },
  );
  await cp(
    path.resolve("..", "reference"),
    path.join(root, "reference"),
    { recursive: true },
  );

  const commands: Array<{ slashName?: string; run: () => Promise<void> }> = [];
  const prompts = [".", "Build a small documentation-grounded Retrieval support agent."];
  const toasts: Array<{ variant?: string; message?: string }> = [];
  const navigation: Array<{ name: string; params: unknown }> = [];
  let createRequest: any;
  let promptRequest: any;

  const api: any = {
    state: { path: { directory: root } },
    keymap: {
      registerLayer(layer: { commands: typeof commands }) {
        commands.push(...layer.commands);
      },
    },
    ui: {
      toast(value: { variant?: string; message?: string }) {
        toasts.push(value);
      },
      dialog: {
        replace(render: () => unknown) {
          render();
        },
        clear() {},
      },
      DialogPrompt(options: { onConfirm: (value: string) => void }) {
        const value = prompts.shift();
        assert.notEqual(value, undefined);
        options.onConfirm(value as string);
        return null;
      },
      DialogConfirm() {
        throw new Error("confirmation is not expected during a new-run kickoff");
      },
      DialogSelect() {
        throw new Error("selection is not expected during a new-run kickoff");
      },
    },
    route: {
      navigate(name: string, params: unknown) {
        navigation.push({ name, params });
      },
    },
    client: {
      session: {
        async create(request: unknown) {
          createRequest = request;
          return { data: { id: "opencode-d01-root" }, error: undefined };
        },
        async promptAsync(request: unknown) {
          promptRequest = request;
          const run = await loadActiveRun(root);
          assert.equal(run?.state.current_attempt?.session?.id, "opencode-d01-root");
          return { data: undefined, error: undefined };
        },
      },
    },
  };

  await (tui as any)(api);
  const start = commands.find((command) => command.slashName === "retrieval-phase");
  assert.ok(start, "the TUI must register /retrieval-phase");
  await start.run();

  assert.equal(prompts.length, 0);
  assert.equal(createRequest.agent, "gate-d01-repository-intake");
  assert.equal(createRequest.directory, root);
  assert.equal(createRequest.parentID, undefined);
  assert.ok(
    createRequest.permission.some(
      (rule: any) =>
        rule.permission === "edit" &&
        rule.pattern === ".sequence/design/01-repository-intake.json" &&
        rule.action === "allow",
    ),
  );
  assert.ok(
    createRequest.permission.some(
      (rule: any) => rule.permission === "edit" && rule.pattern === "docs/**" && rule.action === "allow",
    ),
    "kickoff must retain the declared collaborative docs authority",
  );
  assert.ok(
    createRequest.permission.some(
      (rule: any) => rule.permission === "edit" && rule.pattern === "*" && rule.action === "deny",
    ),
  );
  assert.ok(
    createRequest.permission.some(
      (rule: any) =>
        rule.permission === "edit" && rule.pattern === ".opencode/**" && rule.action === "deny",
    ),
    "kickoff must retain the protected adapter denial",
  );
  for (const toolID of ["retrieval_meta_run", "retrieval_meta_gate", "retrieval_meta_transition"]) {
    assert.ok(
      createRequest.permission.some(
        (rule: any) => rule.permission === toolID && rule.pattern === "*" && rule.action === "deny",
      ),
      `missing session-level denial for ${toolID}`,
    );
  }
  assert.equal(promptRequest.sessionID, "opencode-d01-root");
  assert.equal(Object.hasOwn(promptRequest, "tools"), false);
  assert.match(promptRequest.system, /active gate ID from the kickoff packet/);
  assert.match(promptRequest.parts[0].text, /# Active gate: D01/);
  assert.deepEqual(navigation, [
    { name: "session", params: { sessionID: "opencode-d01-root" } },
  ]);
  const startedRun = await loadActiveRun(root);
  assert.equal(startedRun?.state.current_attempt?.session?.mode, "manual");
  assert.equal(createRequest.metadata.session_mode, "manual");
  assert.equal(createRequest.metadata.launch_id, startedRun?.state.current_attempt?.launch_id);
  assert.equal(
    toasts.some((toast) => toast.variant === "error"),
    false,
    `unexpected adapter error: ${toasts.map((toast) => toast.message).join("; ")}`,
  );
  assert.equal(
    toasts.some((toast) => toast.message?.includes("configured OpenCode default model")),
    true,
  );
});

test("OpenCode lets the human confirm an uncertain delivered kickoff without a duplicate launch", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "retrieval-opencode-delivery-confirm-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(
    path.resolve("..", "retrieval_agent_harness_phase_based"),
    path.join(root, "retrieval_agent_harness_phase_based"),
    { recursive: true },
  );

  const uncertain = Object.assign(new Error("simulated loss after OpenCode delivery"), {
    preserveRecordedAttempt: true,
  });
  await assert.rejects(
    runStartCommand({
      repoRoot: root,
      host: "opencode",
      sessionMode: "manual",
      intake: {
        targetRepoPath: root,
        initialIdea: "Verify human-confirmed delivery does not duplicate a gate turn.",
      },
      launch: async (_packet: GateLaunchPacket, record: (session: GateSessionReference) => Promise<void>) => {
        await record({ id: "delivered-unmarked-d01", mode: "manual" });
        throw uncertain;
      },
    }),
    /simulated loss after OpenCode delivery/,
  );

  const commands: Array<{ slashName?: string; run: () => Promise<void> }> = [];
  const confirmationTitles: string[] = [];
  const api: any = {
    state: { path: { directory: root } },
    keymap: {
      registerLayer(layer: { commands: typeof commands }) {
        commands.push(...layer.commands);
      },
    },
    ui: {
      toast() {},
      dialog: {
        replace(render: () => unknown) {
          render();
        },
        clear() {},
      },
      DialogConfirm(options: { title: string; onConfirm: () => void }) {
        confirmationTitles.push(options.title);
        options.onConfirm();
        return null;
      },
      DialogPrompt() {
        throw new Error("delivery confirmation must not request new intake");
      },
      DialogSelect() {
        throw new Error("delivery confirmation must not request a decision");
      },
    },
    route: { navigate() {} },
    client: {
      session: {
        async create() {
          throw new Error("confirmed delivery must not create another session");
        },
        async promptAsync() {
          throw new Error("confirmed delivery must not send another prompt");
        },
      },
    },
  };

  await (tui as any)(api);
  const start = commands.find((command) => command.slashName === "retrieval-phase");
  assert.ok(start);
  await start.run();

  assert.deepEqual(confirmationTitles, ["Was kickoff delivered for D01?"]);
  const run = await loadActiveRun(root);
  assert.equal(run?.state.current_attempt?.session?.id, "delivered-unmarked-d01");
  assert.equal(run?.state.current_attempt?.delivery_status, "delivered");
  assert.equal(run?.state.attempts.D01, 1);
});

test("OpenCode retires the reviewed session before committing and launching the next gate", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "retrieval-opencode-transition-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(
    path.resolve("..", "retrieval_agent_harness_phase_based"),
    path.join(root, "retrieval_agent_harness_phase_based"),
    { recursive: true },
  );

  let d01Packet: GateLaunchPacket | undefined;
  await runStartCommand({
    repoRoot: root,
    host: "opencode",
    sessionMode: "manual",
    intake: {
      targetRepoPath: root,
      initialIdea: "Verify stale OpenCode gate authority is retired.",
    },
    launch: async (packet: GateLaunchPacket) => {
      d01Packet = packet;
      return { id: "reviewed-d01", mode: "manual" };
    },
  });
  assert.ok(d01Packet);
  await mkdir(path.join(root, ".sequence", "design"), { recursive: true });
  await writeFile(
    path.join(root, ".sequence", "design", "01-repository-intake.json"),
    '{"reviewed":true}\n',
  );
  const readyRun = await loadActiveRun(root);
  assert.ok(readyRun?.state.current_attempt);
  await mkdir(path.dirname(path.join(readyRun.runDir, readyRun.state.current_attempt.result_path)), {
    recursive: true,
  });
  await writeFile(
    path.join(readyRun.runDir, readyRun.state.current_attempt.result_path),
    `${JSON.stringify({
      gate_id: "D01",
      recommendation: "approve",
      summary: "D01 is ready.",
      artifacts: [{
        path: ".sequence/design/01-repository-intake.json",
        role: "Consolidated intake",
      }],
      evidence: [],
      uncertainties: [],
      blockers: [],
    }, null, 2)}\n`,
  );

  const commands: Array<{ slashName?: string; run: () => Promise<void> }> = [];
  const updates: Array<Record<string, any>> = [];
  let stateAtRetirement: any;
  let stateAtCreate: any;
  const api: any = {
    state: { path: { directory: root } },
    keymap: {
      registerLayer(layer: { commands: typeof commands }) {
        commands.push(...layer.commands);
      },
    },
    ui: {
      toast() {},
      dialog: {
        replace(render: () => unknown) {
          render();
        },
        clear() {},
      },
      DialogSelect(options: { onSelect: (value: { value: string }) => void }) {
        options.onSelect({ value: "approve" });
        return null;
      },
      DialogPrompt() {
        throw new Error("approve must not ask for a reason");
      },
      DialogConfirm() {
        throw new Error("transition must not ask for an extra confirmation");
      },
    },
    route: { navigate() {} },
    client: {
      session: {
        async abort() {
          return { data: true, error: undefined };
        },
        async update(parameters: Record<string, any>) {
          stateAtRetirement = (await loadActiveRun(root))?.state;
          updates.push(parameters);
          return { data: true, error: undefined };
        },
        async create() {
          stateAtCreate = (await loadActiveRun(root))?.state;
          return { data: { id: "fresh-d02", parentID: null }, error: undefined };
        },
        async promptAsync() {
          return { data: undefined, error: undefined };
        },
      },
    },
  };

  await (tui as any)(api);
  const next = commands.find((command) => command.slashName === "retrieval-phase-next");
  assert.ok(next);
  await next.run();

  assert.equal(updates.length, 1);
  assert.equal(updates[0].sessionID, "reviewed-d01");
  assert.ok(
    updates[0].permission
      .filter((rule: any) => ["edit", "bash"].includes(rule.permission))
      .every((rule: any) => rule.action === "deny"),
  );
  assert.equal(stateAtRetirement.active_gate_id, "D01");
  assert.equal(stateAtRetirement.current_attempt.session.id, "reviewed-d01");
  assert.equal(stateAtCreate.active_gate_id, "D02");
  assert.equal(stateAtCreate.current_attempt, null);
  const finalRun = await loadActiveRun(root);
  assert.equal(finalRun?.state.current_attempt?.session?.id, "fresh-d02");
  assert.equal(finalRun?.state.current_attempt?.delivery_status, "delivered");
});

test("OpenCode leaves the current attempt usable when the final review snapshot fails after quiescence", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "retrieval-opencode-snapshot-fault-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(
    path.resolve("..", "retrieval_agent_harness_phase_based"),
    path.join(root, "retrieval_agent_harness_phase_based"),
    { recursive: true },
  );
  await runStartCommand({
    repoRoot: root,
    host: "opencode",
    sessionMode: "manual",
    intake: { targetRepoPath: root, initialIdea: "Inject a post-quiescence snapshot failure." },
    launch: async () => ({ id: "snapshot-d01", mode: "manual" }),
  });
  const artifactPath = path.join(root, ".sequence", "design", "01-repository-intake.json");
  await mkdir(path.dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, '{"reviewed":true}\n');
  const readyRun = await loadActiveRun(root);
  assert.ok(readyRun?.state.current_attempt);
  const resultPath = path.join(readyRun.runDir, readyRun.state.current_attempt.result_path);
  await mkdir(path.dirname(resultPath), { recursive: true });
  await writeFile(resultPath, `${JSON.stringify({
    gate_id: "D01",
    recommendation: "approve",
    summary: "D01 is ready.",
    artifacts: [{ path: ".sequence/design/01-repository-intake.json", role: "Consolidated intake" }],
    evidence: [],
    uncertainties: [],
    blockers: [],
  }, null, 2)}\n`);

  const commands: Array<{ slashName?: string; run: () => Promise<void> }> = [];
  const updates: Array<Record<string, any>> = [];
  const aborts: string[] = [];
  let faultInjected = false;
  const mutateSnapshot = async () => {
    if (faultInjected) return;
    faultInjected = true;
    await appendFile(artifactPath, "fault\n");
  };
  const api: any = {
    state: { path: { directory: root } },
    keymap: { registerLayer(layer: { commands: typeof commands }) { commands.push(...layer.commands); } },
    ui: {
      toast() {},
      dialog: { replace(render: () => unknown) { render(); }, clear() {} },
      DialogSelect(options: { onSelect: (value: { value: string }) => void }) {
        options.onSelect({ value: "approve" });
        return null;
      },
      DialogPrompt() { throw new Error("approve must not ask for a reason"); },
      DialogConfirm() { throw new Error("transition must not ask for confirmation"); },
    },
    route: { navigate() {} },
    client: {
      session: {
        async abort(parameters: { sessionID: string }) {
          aborts.push(parameters.sessionID);
          await mutateSnapshot();
          return { data: true, error: undefined };
        },
        async update(parameters: Record<string, any>) {
          updates.push(parameters);
          await mutateSnapshot();
          return { data: true, error: undefined };
        },
        async create() { throw new Error("a stale review must not launch the next gate"); },
        async promptAsync() { throw new Error("a stale review must not prompt a next gate"); },
      },
    },
  };

  await (tui as any)(api);
  const next = commands.find((command) => command.slashName === "retrieval-phase-next");
  assert.ok(next);
  await next.run();

  assert.deepEqual(aborts, ["snapshot-d01"]);
  assert.equal(updates.length, 0, "snapshot failure must occur before mutation authority is retired");
  const after = await loadActiveRun(root);
  assert.equal(after?.state.active_gate_id, "D01");
  assert.equal(after?.state.current_attempt?.session?.id, "snapshot-d01");
});
