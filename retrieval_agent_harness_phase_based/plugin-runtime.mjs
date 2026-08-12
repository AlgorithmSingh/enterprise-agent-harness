import { createHash, randomBytes } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  realpath,
  rename,
  rmdir,
  unlink,
  writeFile
} from "node:fs/promises";
import path from "node:path";

const RUNS_DIRECTORY = ".retrieval-agent-runs";
const WORKFLOW_PATH = "retrieval_agent_harness_phase_based/workflow.json";
const COMMAND_LOCK = ".transition-lock";
const START_LOCK = ".start-lock";
const STATE_VERSION = 2;
const WORKFLOW_VERSION = 2;
const DECISIONS = new Set(["approve", "revise", "block", "not_applicable"]);
const RESULT_FIELDS = new Set([
  "gate_id",
  "recommendation",
  "summary",
  "artifacts",
  "evidence",
  "uncertainties",
  "blockers"
]);
const PROTECTED_WRITE_ROOTS = [
  RUNS_DIRECTORY,
  "retrieval_agent_harness_phase_based",
  ".opencode",
  ".pi",
  "reference",
  ".git"
];

function fail(message) {
  throw new Error(message);
}

function canonicalRelative(value, label = "path") {
  if (typeof value !== "string" || !value || path.isAbsolute(value) || value.includes("\\")) {
    fail(`${label} must be a non-empty relative POSIX path`);
  }
  const normalized = path.posix.normalize(value);
  if (normalized !== value || normalized === "." || normalized.startsWith("../")) {
    fail(`${label} is not canonical or escapes the project: ${value}`);
  }
  return normalized;
}

function foldedPath(value) {
  return value.normalize("NFKC").toLowerCase();
}

function atOrBelow(value, root) {
  const candidate = foldedPath(value);
  const boundary = foldedPath(root);
  return candidate === boundary || candidate.startsWith(`${boundary}/`);
}

async function rejectSymlinkTraversal(root, relative, label) {
  const safe = canonicalRelative(relative, label);
  let cursor = root;
  for (const segment of safe.split("/")) {
    cursor = path.join(cursor, segment);
    let stat;
    try {
      stat = await lstat(cursor);
    } catch (error) {
      if (error.code === "ENOENT") return safe;
      throw error;
    }
    if (stat.isSymbolicLink()) {
      fail(`${label} may not pass through a symlink: ${relative}`);
    }
  }
  return safe;
}

function renderArtifactPath(value, attempt) {
  const rendered = value.replaceAll("{attempt}", String(attempt));
  if (rendered.includes("{") || rendered.includes("}")) {
    fail(`unsupported artifact path template: ${value}`);
  }
  return canonicalRelative(rendered, "required artifact");
}

function inside(root, relative, label = "path") {
  const safe = canonicalRelative(relative, label);
  const absolute = path.resolve(root, safe);
  const back = path.relative(root, absolute);
  if (!back || back === ".." || back.startsWith(`..${path.sep}`) || path.isAbsolute(back)) {
    fail(`${label} escapes its boundary: ${relative}`);
  }
  return absolute;
}

async function regularFile(root, relative, label = "path") {
  const safe = canonicalRelative(relative, label);
  const rootStat = await lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    fail(`${label} has an unsafe root directory`);
  }
  let cursor = root;
  for (const segment of safe.split("/")) {
    cursor = path.join(cursor, segment);
    const stat = await lstat(cursor);
    if (stat.isSymbolicLink()) fail(`${label} may not pass through a symlink: ${relative}`);
  }
  const stat = await lstat(cursor);
  if (!stat.isFile()) fail(`${label} must be a regular file: ${relative}`);
  return { absolute: cursor, size: stat.size };
}

async function readJson(root, relative, label) {
  const { absolute } = await regularFile(root, relative, label);
  try {
    return JSON.parse(await readFile(absolute, "utf8"));
  } catch (error) {
    fail(`${label} is not valid JSON: ${error.message}`);
  }
}

async function atomicJson(target, value) {
  const temporary = path.join(
    path.dirname(target),
    `.${path.basename(target)}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`
  );
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
  await rename(temporary, target);
}

async function fileRecord(root, relative, scope, kind) {
  const { absolute, size } = await regularFile(root, relative, kind);
  const bytes = await readFile(absolute);
  return {
    scope,
    path: relative,
    kind,
    size,
    sha256: createHash("sha256").update(bytes).digest("hex")
  };
}

function gateById(workflow, gateId) {
  const gate = workflow.gates.find((candidate) => candidate.id === gateId);
  if (!gate) fail(`workflow references unknown gate: ${gateId}`);
  return gate;
}

function gateIndex(workflow, gateId) {
  const index = workflow.gates.findIndex((candidate) => candidate.id === gateId);
  if (index < 0) fail(`workflow references unknown gate: ${gateId}`);
  return index;
}

function stripFrontmatter(markdown, label = "gate-agent prompt") {
  if (!markdown.startsWith("---\n")) fail(`${label} must start with YAML frontmatter`);
  const end = markdown.indexOf("\n---\n", 4);
  if (end < 0) fail(`${label} frontmatter is not terminated`);
  const frontmatter = markdown.slice(4, end);
  if (
    frontmatter.includes("\t") ||
    !/^description:\s+\S.*$/m.test(frontmatter) ||
    !/^mode:\s+primary\s*$/m.test(frontmatter) ||
    !/^permission:\s*$/m.test(frontmatter)
  ) {
    fail(`${label} frontmatter must define a description, primary mode, and permission mapping`);
  }
  const body = markdown.slice(end + 5).trim();
  if (!body) fail(`${label} body must be non-empty`);
  return body;
}

export function allowedHumanDecisions(gate) {
  return gate.allowed_human_decisions
    ? [...gate.allowed_human_decisions]
    : [...DECISIONS];
}

function validateWorkflow(workflow) {
  if (
    workflow?.version !== WORKFLOW_VERSION ||
    typeof workflow.workflow_id !== "string" ||
    !workflow.workflow_id.trim()
  ) {
    fail(`workflow.json must define version ${WORKFLOW_VERSION} and a workflow_id`);
  }
  if (
    workflow.commands?.start !== "retrieval-phase" ||
    workflow.commands?.next !== "retrieval-phase-next"
  ) {
    fail("workflow commands must be retrieval-phase and retrieval-phase-next");
  }
  canonicalRelative(workflow.shared_prompt, "shared_prompt");
  canonicalRelative(workflow.phase_2_manifest, "phase_2_manifest");
  if (!Array.isArray(workflow.gates) || workflow.gates.length === 0) {
    fail("workflow.json must contain an ordered gates array");
  }

  const ids = new Set();
  const manifestKeys = new Set();
  for (const gate of workflow.gates) {
    if (!/^[A-Z][A-Z0-9]*$/.test(gate?.id ?? "") || ids.has(gate.id)) {
      fail(`invalid or duplicate gate id: ${gate?.id}`);
    }
    ids.add(gate.id);
    if (typeof gate.title !== "string" || !gate.title.trim()) fail(`${gate.id}.title is required`);
    if (!["technical-design", "implementation", "repair"].includes(gate.phase)) {
      fail(`${gate.id}.phase is invalid`);
    }
    if (typeof gate.required !== "boolean") fail(`${gate.id}.required must be boolean`);
    canonicalRelative(gate.agent_prompt, `${gate.id}.agent_prompt`);
    if (gate.source_prompt !== undefined) {
      fail(`${gate.id}.source_prompt is not supported in the self-contained v2 catalog`);
    }
    if (!Array.isArray(gate.required_artifacts)) {
      fail(`${gate.id}.required_artifacts must be an array`);
    }
    for (const artifact of gate.required_artifacts) {
      if (typeof artifact !== "string") fail(`${gate.id}.required_artifacts must contain strings`);
      renderArtifactPath(artifact, 1);
    }
    if (gate.manifest_key !== undefined) {
      if (
        typeof gate.manifest_key !== "string" ||
        !gate.manifest_key.trim() ||
        manifestKeys.has(gate.manifest_key)
      ) {
        fail(`${gate.id}.manifest_key must be a unique non-empty string`);
      }
      manifestKeys.add(gate.manifest_key);
    }
    if (!gate.required && gate.id !== workflow.repair?.gate_id && !gate.manifest_key) {
      fail(`${gate.id} needs a manifest_key because it is optional`);
    }
    for (const field of ["collaborative_edits", "manifest_proposals"]) {
      if (gate[field] !== undefined && typeof gate[field] !== "boolean") {
        fail(`${gate.id}.${field} must be boolean when present`);
      }
    }
    if (gate.allowed_human_decisions !== undefined) {
      if (
        !Array.isArray(gate.allowed_human_decisions) ||
        gate.allowed_human_decisions.length === 0 ||
        new Set(gate.allowed_human_decisions).size !== gate.allowed_human_decisions.length ||
        gate.allowed_human_decisions.some((decision) => !DECISIONS.has(decision))
      ) {
        fail(`${gate.id}.allowed_human_decisions is invalid`);
      }
    }
    if (
      gate.max_attempts !== undefined &&
      (!Number.isInteger(gate.max_attempts) || gate.max_attempts < 1)
    ) {
      fail(`${gate.id}.max_attempts must be a positive integer`);
    }
  }

  if (!workflow.repair || !ids.has(workflow.repair.gate_id)) {
    fail("workflow.repair must name the repair gate");
  }
  if (
    !Number.isInteger(workflow.repair.max_attempts) ||
    workflow.repair.max_attempts < 1 ||
    workflow.repair.max_attempts !== gateById(workflow, workflow.repair.gate_id).max_attempts
  ) {
    fail("workflow repair limits must agree");
  }
  if (!ids.has(workflow.repair.return_to)) fail("workflow.repair.return_to is unknown");

  for (const gate of workflow.gates) {
    for (const [decision, target] of Object.entries(gate.decision_routes ?? {})) {
      if (!DECISIONS.has(decision) || !ids.has(target)) {
        fail(`${gate.id} has an invalid decision route ${decision} -> ${target}`);
      }
    }
  }
}

export async function loadWorkflowSnapshot(repoRoot) {
  const { absolute } = await regularFile(repoRoot, WORKFLOW_PATH, "workflow catalog");
  const bytes = await readFile(absolute);
  let workflow;
  try {
    workflow = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    fail(`workflow catalog is not valid JSON: ${error.message}`);
  }
  validateWorkflow(workflow);
  await regularFile(repoRoot, workflow.shared_prompt, "shared prompt");
  for (const gate of workflow.gates) {
    const prompt = await regularFile(repoRoot, gate.agent_prompt, `${gate.id} prompt`);
    stripFrontmatter(await readFile(prompt.absolute, "utf8"), `${gate.id} prompt`);
  }
  return {
    workflow,
    catalogRecord: {
      scope: "project",
      path: WORKFLOW_PATH,
      kind: "workflow_catalog",
      size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex")
    }
  };
}

export async function loadWorkflow(repoRoot) {
  return (await loadWorkflowSnapshot(repoRoot)).workflow;
}

function validateWorkflowCatalogBinding(binding, label = "workflow catalog binding") {
  const keys = binding && typeof binding === "object" && !Array.isArray(binding)
    ? Object.keys(binding).sort()
    : [];
  if (
    keys.length !== 3 ||
    keys[0] !== "path" ||
    keys[1] !== "sha256" ||
    keys[2] !== "size" ||
    binding.path !== WORKFLOW_PATH ||
    !Number.isInteger(binding.size) ||
    binding.size < 1 ||
    !/^[a-f0-9]{64}$/.test(binding.sha256 ?? "")
  ) {
    fail(`${label} must contain the exact workflow path, byte size, and SHA-256 digest`);
  }
  return binding;
}

function workflowCatalogBinding(record) {
  const binding = {
    path: record?.path,
    size: record?.size,
    sha256: record?.sha256
  };
  validateWorkflowCatalogBinding(binding);
  return binding;
}

function sameWorkflowCatalog(left, right) {
  return Boolean(
    left &&
    right &&
    left.path === right.path &&
    left.size === right.size &&
    left.sha256 === right.sha256
  );
}

async function validateTargetRepository(repoRoot, value) {
  if (typeof value !== "string" || !value.trim()) {
    fail("the target agent repository path is required");
  }
  const requested = path.resolve(repoRoot, value.trim());
  let rootReal;
  let requestedReal;
  try {
    [rootReal, requestedReal] = await Promise.all([realpath(repoRoot), realpath(requested)]);
  } catch (error) {
    fail(`the target agent repository is not readable: ${error.message}`);
  }
  const stat = await lstat(requestedReal);
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail("the target agent repository must be a directory");
  if (requestedReal !== rootReal) {
    fail(
      "this project-local plugin builds the repository where it is installed; open OpenCode or Pi in the target repository and use that repository path"
    );
  }
  return rootReal;
}

function runId() {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return `${stamp}-retrieval-${randomBytes(2).toString("hex")}`;
}

export async function createRun(repoRoot, workflow, intake) {
  const target = await validateTargetRepository(repoRoot, intake?.targetRepoPath);
  const initialIdea = typeof intake?.initialIdea === "string" ? intake.initialIdea.trim() : "";
  if (!initialIdea) fail("the initial agent idea is required");
  if (initialIdea.length > 12_000) fail("the initial agent idea must be at most 12,000 characters");

  const runsRoot = path.join(repoRoot, RUNS_DIRECTORY);
  await mkdir(runsRoot, { recursive: true });
  const id = runId();
  const runDir = path.join(runsRoot, id);
  await mkdir(runDir);
  await writeFile(
    path.join(runDir, "request.md"),
    `# Agent repository\n\n${target}\n\n# Initial idea\n\n${initialIdea}\n`,
    { flag: "wx" }
  );
  const now = new Date().toISOString();
  const state = {
    version: STATE_VERSION,
    workflow_id: workflow.workflow_id,
    run_id: id,
    target_repo: ".",
    initial_idea: initialIdea,
    status: "active",
    active_gate_id: workflow.gates[0].id,
    current_attempt: null,
    attempts: {},
    skipped_gates: {},
    implementation_manifest: null,
    last_decision: null,
    pending_direction: null,
    stop_reason: null,
    created_at: now,
    updated_at: now
  };
  await atomicJson(path.join(runDir, "workflow-state.json"), state);
  await atomicJson(path.join(runsRoot, "active.json"), {
    version: STATE_VERSION,
    workflow_id: workflow.workflow_id,
    run_id: id
  });
  return { repoRoot, runDir, state };
}

function rejectLegacyState(state, pointer) {
  const receiptFields = ["latest_receipts", "approved_receipts", "frozen_files"];
  if (
    state?.version === 1 ||
    pointer?.version === 1 ||
    receiptFields.some((field) => Object.hasOwn(state ?? {}, field))
  ) {
    fail(
      "This active run uses the retired receipt-and-freeze state format. " +
      "Do not reinterpret its decisions. Preserve the run directory for review, move " +
      ".retrieval-agent-runs/active.json aside after confirming no command is running, and start a new v2 run."
    );
  }
}

function validateRunState(state, pointer) {
  rejectLegacyState(state, pointer);
  if (
    state?.version !== STATE_VERSION ||
    pointer?.version !== STATE_VERSION ||
    state.run_id !== pointer.run_id ||
    state.workflow_id !== pointer.workflow_id
  ) {
    fail("active run pointer and workflow state do not agree with the v2 state contract");
  }
  const attempt = state.current_attempt;
  if (
    attempt !== null &&
    (
      typeof attempt !== "object" ||
      typeof attempt.gate_id !== "string" ||
      !Number.isInteger(attempt.number) ||
      attempt.number < 1 ||
      !/^[a-f0-9]{24}$/.test(attempt.launch_id ?? "") ||
      typeof attempt.result_path !== "string" ||
      !attempt.workflow_catalog ||
      !attempt.session ||
      typeof attempt.session.host !== "string" ||
      typeof attempt.session.id !== "string" ||
      !attempt.session.id.trim() ||
      !["manual", "meta", "auto"].includes(attempt.session.mode) ||
      (attempt.session.path !== undefined && typeof attempt.session.path !== "string") ||
      !["pending", "delivered"].includes(attempt.delivery_status)
    )
  ) {
    fail(
      "the active attempt lacks its immutable launch, host-session, mode, or delivery binding, " +
      "including its workflow-catalog binding"
    );
  }
  if (attempt !== null) {
    validateWorkflowCatalogBinding(attempt.workflow_catalog, "active attempt workflow-catalog binding");
  }
}

export async function loadActiveRun(repoRoot) {
  let pointer;
  try {
    pointer = await readJson(repoRoot, `${RUNS_DIRECTORY}/active.json`, "active run pointer");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  if (!/^[A-Za-z0-9._-]+$/.test(pointer?.run_id ?? "")) {
    fail("active run pointer has an invalid run_id");
  }
  const runDir = inside(path.join(repoRoot, RUNS_DIRECTORY), pointer.run_id, "run_id");
  const state = await readJson(runDir, "workflow-state.json", "workflow state");
  validateRunState(state, pointer);
  return { repoRoot, runDir, state };
}

async function writeState(run, state) {
  state.updated_at = new Date().toISOString();
  await atomicJson(path.join(run.runDir, "workflow-state.json"), state);
  run.state = state;
  return run;
}

function requiredArtifacts(gate, attempt) {
  return gate.required_artifacts.map((artifact) => renderArtifactPath(artifact, attempt));
}

function manifestGates(workflow) {
  return workflow.gates.filter((gate) => gate.manifest_key);
}

async function validateManifest(repoRoot, workflow, manifest, label = "phase-2 manifest") {
  if (
    manifest?.version !== 1 ||
    !manifest.gates ||
    typeof manifest.gates !== "object" ||
    Array.isArray(manifest.gates)
  ) {
    fail(`${label} must define version 1 and a gates object`);
  }
  const routed = manifestGates(workflow);
  const expectedKeys = new Set(routed.map((gate) => gate.manifest_key));
  for (const key of Object.keys(manifest.gates)) {
    if (!expectedKeys.has(key)) fail(`${label} contains an unknown gate entry: ${key}`);
  }
  for (const gate of routed) {
    const entry = manifest.gates[gate.manifest_key];
    if (
      !entry ||
      typeof entry.active !== "boolean" ||
      typeof entry.reason !== "string" ||
      !entry.reason.trim() ||
      !Array.isArray(entry.allowed_files)
    ) {
      fail(`${label} is missing a complete ${gate.manifest_key} entry`);
    }
    if (gate.required && !entry.active) {
      fail(`${gate.manifest_key} is catalog-required and must be active in ${label}`);
    }
    if (!entry.active && entry.allowed_files.length) {
      fail(`${gate.manifest_key}.allowed_files must be empty when the gate is inactive`);
    }
    const seen = new Set();
    for (const candidate of entry.allowed_files) {
      const safe = canonicalRelative(candidate, `${gate.manifest_key}.allowed_files`);
      if (/[*?[\]{}]/.test(safe)) {
        fail(`${gate.manifest_key}.allowed_files must contain exact literal paths: ${safe}`);
      }
      const folded = foldedPath(safe);
      if (seen.has(folded)) fail(`${gate.manifest_key}.allowed_files contains a duplicate path`);
      seen.add(folded);
      if (
        PROTECTED_WRITE_ROOTS.some((root) => atOrBelow(safe, root)) ||
        folded === foldedPath(workflow.phase_2_manifest)
      ) {
        fail(`${gate.manifest_key}.allowed_files contains a protected path: ${safe}`);
      }
      await rejectSymlinkTraversal(repoRoot, safe, `${gate.manifest_key}.allowed_files`);
    }
  }
  return structuredClone(manifest);
}

function sameManifestEntry(left, right) {
  return Boolean(
    left &&
    right &&
    left.active === right.active &&
    left.reason === right.reason &&
    left.allowed_files.length === right.allowed_files.length &&
    left.allowed_files.every((candidate, index) => candidate === right.allowed_files[index])
  );
}

async function validateManifestRefresh(workflow, run, review, route, candidateManifest) {
  if (!candidateManifest || !run.state.implementation_manifest) return;
  const current = await pinnedManifest(run, workflow);
  const currentIndex = gateIndex(workflow, review.gate.id);
  for (const gate of manifestGates(workflow)) {
    if (gateIndex(workflow, gate.id) > currentIndex) continue;
    const currentGateRetry = gate.id === review.gate.id && route.target === review.gate.id;
    if (
      !currentGateRetry &&
      !sameManifestEntry(current.gates[gate.manifest_key], candidateManifest.gates[gate.manifest_key])
    ) {
      fail(
        `the reviewed manifest may not change already-passed authority for ${gate.id}; ` +
        "only a gate being retried or a future gate may receive refreshed authority"
      );
    }
  }
}

async function loadWorkingManifest(repoRoot, workflow) {
  const manifest = await readJson(repoRoot, workflow.phase_2_manifest, "phase-2 manifest");
  return validateManifest(repoRoot, workflow, manifest);
}

async function pinnedManifest(run, workflow) {
  if (!run.state.implementation_manifest) {
    fail("implementation file authority has not been pinned by the final design decision");
  }
  return validateManifest(
    run.repoRoot,
    workflow,
    run.state.implementation_manifest,
    "run-scoped phase-2 manifest"
  );
}

async function manifestEntry(run, workflow, gate) {
  if (!gate.manifest_key) return null;
  const manifest = await pinnedManifest(run, workflow);
  return manifest.gates[gate.manifest_key];
}

async function repairAllowedFiles(run, workflow) {
  const routed = manifestGates(workflow);
  if (!routed.length) return [];
  const manifest = await pinnedManifest(run, workflow);
  const allowed = [];
  const seen = new Set();
  for (const gate of routed) {
    const entry = manifest.gates[gate.manifest_key];
    if (!entry.active) continue;
    for (const candidate of entry.allowed_files) {
      const folded = foldedPath(candidate);
      if (seen.has(folded)) continue;
      seen.add(folded);
      allowed.push(candidate);
    }
  }
  return allowed;
}

async function gateAllowedFiles(run, workflow, gate) {
  if (gate.manifest_key) {
    const entry = await manifestEntry(run, workflow, gate);
    if (!entry.active) fail(`${gate.id} is inactive in the run-scoped phase-2 manifest`);
    return [...entry.allowed_files];
  }
  if (gate.id === workflow.repair.gate_id) {
    return repairAllowedFiles(run, workflow);
  }
  return [];
}

function collaborativeEditPaths(workflow, gate) {
  if (!gate.collaborative_edits && !gate.manifest_proposals) return [];
  if (!gate.collaborative_edits) return [workflow.phase_2_manifest];
  const values = [
    ...workflow.gates
      .filter((candidate) => candidate.phase === "technical-design")
      .flatMap((candidate) => candidate.required_artifacts),
    ...workflow.gates.map((candidate) => candidate.agent_prompt),
    workflow.shared_prompt,
    workflow.phase_2_manifest,
    "docs/**"
  ];
  return [...new Set(values)];
}

function collaborativePathAllowed(workflow, gate, candidate) {
  return collaborativeEditPaths(workflow, gate).some((allowed) => {
    if (allowed === "docs/**") return candidate.startsWith("docs/");
    return allowed === candidate;
  });
}

function resultListsManifest(workflow, review) {
  return review.result.artifacts.some(
    (entry) => entry.path === workflow.phase_2_manifest
  );
}

async function manifestCandidateForDecision(workflow, run, review, decision) {
  if (
    !["approve", "revise"].includes(decision) ||
    !resultListsManifest(workflow, review) ||
    (!review.gate.collaborative_edits && !review.gate.manifest_proposals)
  ) {
    return null;
  }
  return loadWorkingManifest(run.repoRoot, workflow);
}

async function nextOrderedGate(workflow, run, currentGate) {
  const skips = [];
  for (let index = gateIndex(workflow, currentGate.id) + 1; index < workflow.gates.length; index += 1) {
    const candidate = workflow.gates[index];
    if (candidate.id === workflow.repair.gate_id) continue;
    if (candidate.required) return { gate: candidate, skips };
    const entry = await manifestEntry(run, workflow, candidate);
    if (entry.active) return { gate: candidate, skips };
    skips.push({ gate_id: candidate.id, reason: entry.reason });
  }
  return { gate: null, skips };
}

function assertHumanDecision(gate, decision) {
  if (!DECISIONS.has(decision)) fail(`invalid human decision: ${decision}`);
  if (!allowedHumanDecisions(gate).includes(decision)) {
    fail(`${gate.id} does not allow the human decision ${decision}`);
  }
}

export async function routeDecision(
  workflow,
  run,
  review,
  decision,
  candidateManifestOverride = undefined
) {
  const gate = review.gate;
  assertHumanDecision(gate, decision);
  if (decision === "block") {
    return { status: "blocked", target: gate.id, skips: [] };
  }

  const candidateManifest = candidateManifestOverride === undefined
    ? await manifestCandidateForDecision(workflow, run, review, decision)
    : candidateManifestOverride;
  const routingRun = candidateManifest
    ? {
        ...run,
        state: { ...run.state, implementation_manifest: candidateManifest }
      }
    : run;

  let target;
  let skips = [];
  if (gate.decision_routes?.[decision]) {
    target = gate.decision_routes[decision];
  } else if (decision === "revise") {
    target = gate.id;
  } else {
    const ordered = await nextOrderedGate(workflow, routingRun, gate);
    target = ordered.gate?.id ?? null;
    skips = ordered.skips;
  }

  if (target) {
    const targetGate = gateById(workflow, target);
    if (targetGate.manifest_key) {
      const targetEntry = await manifestEntry(routingRun, workflow, targetGate);
      if (!targetEntry.active) {
        fail(`the selected route targets ${targetGate.id}, which is inactive in the reviewed manifest`);
      }
    }
    const nextAttempt = (run.state.attempts[target] ?? 0) + 1;
    const maximum = targetGate.max_attempts;
    if (maximum && nextAttempt > maximum) {
      fail(`${targetGate.title} reached its ${maximum}-attempt repair limit`);
    }
  }
  const route = { status: target ? "active" : "complete", target, skips };
  await validateManifestRefresh(workflow, run, review, route, candidateManifest);
  return route;
}

async function launchPacket(repoRoot, workflow, run, host, sessionMode = undefined) {
  if (run.state.status !== "active" || !run.state.active_gate_id) {
    fail("there is no active gate to launch");
  }
  if (run.state.current_attempt) fail("the active gate already has an attempt");

  const gate = gateById(workflow, run.state.active_gate_id);
  const attempt = (run.state.attempts[gate.id] ?? 0) + 1;
  const maximum = gate.max_attempts;
  if (maximum && attempt > maximum) fail(`${gate.title} reached its ${maximum}-attempt limit`);

  const allowedFiles = await gateAllowedFiles(run, workflow, gate);
  for (const candidate of allowedFiles) {
    await rejectSymlinkTraversal(repoRoot, candidate, `${gate.id} editable file`);
  }

  const outputs = requiredArtifacts(gate, attempt);
  for (const output of outputs) {
    await rejectSymlinkTraversal(repoRoot, output, `${gate.id} required artifact`);
  }
  const collaborativePaths = collaborativeEditPaths(workflow, gate);
  for (const candidate of collaborativePaths.filter((value) => value !== "docs/**")) {
    await rejectSymlinkTraversal(repoRoot, candidate, `${gate.id} collaborative path`);
  }

  const resultPath = `gates/${gate.id}/attempt-${attempt}/gate-result.json`;
  const shared = await readFile(inside(repoRoot, workflow.shared_prompt, "shared prompt"), "utf8");
  const focused = await readFile(inside(repoRoot, gate.agent_prompt, `${gate.id} prompt`), "utf8");
  const system = [
    shared.trim(),
    "",
    "---",
    "",
    "# Active Retrieval gate contract",
    "",
    stripFrontmatter(focused, `${gate.id} prompt`)
  ].join("\n");
  const envelope = {
    gate_id: gate.id,
    recommendation: "approve",
    summary: "Short factual summary.",
    artifacts: outputs.map((artifact) => ({
      path: artifact,
      role: "Required gate artifact"
    })),
    evidence: [],
    uncertainties: [],
    blockers: []
  };
  const message = [
    `# Active gate: ${gate.id} — ${gate.title}`,
    "",
    `Target agent repository: ${repoRoot}`,
    `Initial idea: ${run.state.initial_idea}`,
    `Attempt: ${attempt}`,
    ...(run.state.pending_direction
      ? [`Human revision or resume direction: ${run.state.pending_direction}`]
      : []),
    "",
    "Required artifacts:",
    ...(outputs.length ? outputs.map((artifact) => `- ${artifact}`) : ["- None beyond the result envelope."]),
    "",
    "Run-scoped implementation files:",
    ...(allowedFiles.length ? allowedFiles.map((file) => `- ${file}`) : ["- None."]),
    "",
    "Additional collaborative edit paths:",
    ...(collaborativePaths.length ? collaborativePaths.map((file) => `- ${file}`) : ["- None."]),
    "",
    ...(gate.manifest_proposals
      ? [
          "A working-tree manifest edit is only a proposal for a later human-authorized attempt; it cannot widen this session's file authority.",
          ""
        ]
      : []),
    `Write the gate result to: ${path.join(run.runDir, resultPath)}`,
    "",
    "Use exactly this seven-field envelope and list every created or modified project file:",
    "```json",
    JSON.stringify(envelope, null, 2),
    "```",
    "",
    "Do not edit run control state, runtime or host adapters, the catalog, or the vendored reference. " +
      (sessionMode === "auto"
        ? "Keep the handoff short. The supervising autopilot operator reviews this result and advances the run."
        : "Keep the handoff short. The human reviews and advances with /retrieval-phase-next.")
  ].join("\n");

  return {
    gate,
    attempt,
    launch_id: randomBytes(12).toString("hex"),
    host,
    run_id: run.state.run_id,
    agent_name: path.basename(gate.agent_prompt, ".md"),
    title: `${run.state.run_id} · ${gate.id}`,
    result_path: resultPath,
    gate_result_file: `${RUNS_DIRECTORY}/${run.state.run_id}/${resultPath}`,
    required_artifacts: outputs,
    allowed_files: allowedFiles,
    collaborative_edit_paths: collaborativePaths,
    allowed_human_decisions: allowedHumanDecisions(gate),
    system,
    message
  };
}

export async function recordLaunch(run, packet, session, catalogRecord, sessionMode = undefined) {
  const state = structuredClone(run.state);
  if (
    state.status !== "active" ||
    state.active_gate_id !== packet.gate.id ||
    state.current_attempt ||
    packet.attempt !== (state.attempts[packet.gate.id] ?? 0) + 1
  ) {
    fail("the launch packet is stale");
  }
  state.attempts[packet.gate.id] = packet.attempt;
  const mode = session?.mode ?? "manual";
  if (!session || typeof session.id !== "string" || !session.id.trim()) {
    fail("a launched gate session requires a non-empty host session id");
  }
  if (!["manual", "meta", "auto"].includes(mode)) {
    fail("a launched gate session mode must be manual, meta, or auto");
  }
  // The kickoff packet is written for the commanding surface, so an attempt may
  // never be recorded under a different owner than the one that shaped it.
  if (sessionMode && mode !== sessionMode) {
    fail(
      `a launch commanded by ${sessionMode} session mode may not record a ${mode}-owned gate session`
    );
  }
  state.current_attempt = {
    gate_id: packet.gate.id,
    number: packet.attempt,
    launch_id: packet.launch_id,
    result_path: packet.result_path,
    workflow_catalog: workflowCatalogBinding(catalogRecord),
    session: { ...session, host: packet.host, mode },
    delivery_status: "pending",
    started_at: new Date().toISOString()
  };
  state.pending_direction = null;
  await writeState(run, state);
  return run;
}

async function markLaunchDelivery(run, attempt = run.state.current_attempt) {
  if (!sameAttempt(run.state.current_attempt, attempt)) {
    fail("the launch delivery marker belongs to a stale attempt");
  }
  if (run.state.current_attempt.delivery_status === "delivered") return run;
  const state = structuredClone(run.state);
  state.current_attempt.delivery_status = "delivered";
  state.current_attempt.delivered_at = new Date().toISOString();
  await writeState(run, state);
  return run;
}

/** Mark one exact host/session launch delivered under the run transition lock. */
export async function recordLaunchDelivery(run, attempt = run.state.current_attempt) {
  const expected = structuredClone(attempt);
  const release = await acquireTransitionLock(run);
  return withLockRelease(release, "transition lock", async () => {
    const current = await currentLockedRun(run);
    return await markLaunchDelivery(current, expected);
  });
}

function stringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    fail(`${label} must be an array of strings`);
  }
}

export async function inspectCurrentResult(workflow, run) {
  const attempt = run.state.current_attempt;
  if (!attempt) return { status: "not_started" };
  await verifyActiveAttemptCatalog(run);
  if (
    attempt.gate_id !== run.state.active_gate_id ||
    attempt.number !== run.state.attempts[attempt.gate_id] ||
    attempt.result_path !== `gates/${attempt.gate_id}/attempt-${attempt.number}/gate-result.json`
  ) {
    return { status: "invalid", error: "workflow state contains an inconsistent current attempt" };
  }

  let result;
  try {
    result = await readJson(run.runDir, attempt.result_path, "gate result");
  } catch (error) {
    if (error.code === "ENOENT") return { status: "missing", attempt };
    return { status: "invalid", attempt, error: error.message };
  }

  try {
    const gate = gateById(workflow, attempt.gate_id);
    const fields = Object.keys(result);
    if (
      fields.length !== RESULT_FIELDS.size ||
      fields.some((field) => !RESULT_FIELDS.has(field))
    ) {
      fail("gate result must use exactly the seven-field generic envelope");
    }
    if (result.gate_id !== gate.id) fail(`gate_id must be ${gate.id}`);
    if (!DECISIONS.has(result.recommendation)) fail("recommendation is invalid");
    if (typeof result.summary !== "string" || !result.summary.trim()) fail("summary must be non-empty");
    if (!Array.isArray(result.artifacts) || !Array.isArray(result.evidence)) {
      fail("artifacts and evidence must be arrays");
    }
    stringArray(result.uncertainties, "uncertainties");
    stringArray(result.blockers, "blockers");
    if (result.recommendation === "approve" && result.blockers.length) {
      fail("an approve recommendation may not contain blockers");
    }

    const artifactPaths = new Set();
    for (const entry of result.artifacts) {
      if (!entry || typeof entry.role !== "string" || !entry.role.trim()) {
        fail("artifact entries require path and role");
      }
      const safe = canonicalRelative(entry.path, "artifact path");
      if (atOrBelow(safe, RUNS_DIRECTORY)) fail(`artifact references a control path: ${safe}`);
      const folded = foldedPath(safe);
      if ([...artifactPaths].some((candidate) => foldedPath(candidate) === folded)) {
        fail(`duplicate or portability-colliding artifact path: ${safe}`);
      }
      artifactPaths.add(safe);
      await regularFile(run.repoRoot, safe, "artifact");
    }
    for (const entry of result.evidence) {
      if (!entry || typeof entry.supports !== "string" || !entry.supports.trim()) {
        fail("evidence entries require path and supports");
      }
      const safe = canonicalRelative(entry.path, "evidence path");
      if (atOrBelow(safe, RUNS_DIRECTORY)) fail(`evidence references a control path: ${safe}`);
      await regularFile(run.repoRoot, safe, "evidence");
    }
    for (const required of requiredArtifacts(gate, attempt.number)) {
      if (!artifactPaths.has(required)) fail(`required artifact is not listed: ${required}`);
    }

    const allowedFiles = await gateAllowedFiles(run, workflow, gate);
    const permitted = new Set([...requiredArtifacts(gate, attempt.number), ...allowedFiles]);
    for (const artifact of artifactPaths) {
      if (
        !permitted.has(artifact) &&
        !collaborativePathAllowed(workflow, gate, artifact)
      ) {
        fail(`${gate.id} produced an artifact outside its approved files: ${artifact}`);
      }
    }
    if (artifactPaths.has(workflow.phase_2_manifest)) {
      await loadWorkingManifest(run.repoRoot, workflow);
    }
    return {
      status: "ready",
      gate,
      attempt,
      result,
      allowed_human_decisions: allowedHumanDecisions(gate)
    };
  } catch (error) {
    return { status: "invalid", attempt, result, error: error.message };
  }
}

export async function snapshotReview(run, review, catalogRecord = undefined) {
  const records = [
    await fileRecord(run.runDir, review.attempt.result_path, "run", "gate_result"),
    catalogRecord ?? await fileRecord(run.repoRoot, WORKFLOW_PATH, "project", "workflow_catalog")
  ];
  const seen = new Set();
  for (const [kind, entries] of [
    ["artifact", review.result.artifacts],
    ["evidence", review.result.evidence]
  ]) {
    for (const entry of entries) {
      if (seen.has(entry.path)) continue;
      seen.add(entry.path);
      records.push(await fileRecord(run.repoRoot, entry.path, "project", kind));
    }
  }
  return records;
}

async function verifyReviewSnapshot(run, records) {
  for (const expected of records) {
    const root = expected.scope === "run" ? run.runDir : run.repoRoot;
    const current = await fileRecord(root, expected.path, expected.scope, expected.kind);
    if (current.sha256 !== expected.sha256 || current.size !== expected.size) {
      fail(`reviewed ${expected.kind} changed during review: ${expected.path}`);
    }
  }
}

async function verifyCatalogSnapshot(run, expected) {
  const current = await fileRecord(run.repoRoot, WORKFLOW_PATH, "project", "workflow_catalog");
  if (current.sha256 !== expected.sha256 || current.size !== expected.size) {
    fail("workflow catalog changed while the command was open");
  }
}

async function verifyActiveAttemptCatalog(run, expected = undefined) {
  const attempt = run.state.current_attempt;
  if (!attempt) return;
  const current = expected ?? await fileRecord(
    run.repoRoot,
    WORKFLOW_PATH,
    "project",
    "workflow_catalog"
  );
  if (!sameWorkflowCatalog(attempt.workflow_catalog, current)) {
    fail(
      "the workflow catalog differs from the bytes bound to the active attempt; " +
      "preserve this run and start a new compatible run or resume from an explicit boundary"
    );
  }
  if (expected) await verifyCatalogSnapshot(run, expected);
}

function sameAttempt(left, right) {
  return Boolean(
    left &&
    right &&
    left.gate_id === right.gate_id &&
    left.number === right.number &&
    left.launch_id === right.launch_id &&
    left.result_path === right.result_path &&
    sameWorkflowCatalog(left.workflow_catalog, right.workflow_catalog) &&
    left.session?.host === right.session?.host &&
    left.session?.mode === right.session?.mode &&
    left.session?.id === right.session?.id &&
    left.session?.path === right.session?.path
  );
}

async function acquireTransitionLock(run) {
  const directory = path.join(run.runDir, COMMAND_LOCK);
  try {
    await mkdir(directory);
  } catch (error) {
    if (error.code === "EEXIST") {
      fail(
        `another transition command holds ${path.relative(run.repoRoot, directory)}; ` +
        "retry after it finishes, or if its process crashed verify that no command is running and remove only that stale lock directory"
      );
    }
    throw error;
  }
  const owner = path.join(directory, "owner.json");
  try {
    await writeFile(
      owner,
      `${JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() }, null, 2)}\n`,
      { flag: "wx" }
    );
  } catch (error) {
    await rmdir(directory).catch(() => {});
    throw error;
  }
  let released = false;
  return async () => {
    if (released) return;
    await unlink(owner).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
    await rmdir(directory).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
    released = true;
  };
}

async function acquireStartLock(repoRoot) {
  const runsRoot = path.join(repoRoot, RUNS_DIRECTORY);
  await mkdir(runsRoot, { recursive: true });
  const directory = path.join(runsRoot, START_LOCK);
  try {
    await mkdir(directory);
  } catch (error) {
    if (error.code === "EEXIST") {
      fail(
        `another start command holds ${path.relative(repoRoot, directory)}; ` +
        "retry after it finishes, or if its process crashed verify that no start command is running and remove only that stale lock directory"
      );
    }
    throw error;
  }
  const owner = path.join(directory, "owner.json");
  try {
    await writeFile(
      owner,
      `${JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() }, null, 2)}\n`,
      { flag: "wx" }
    );
  } catch (error) {
    await rmdir(directory).catch(() => {});
    throw error;
  }
  let released = false;
  return async () => {
    if (released) return;
    await unlink(owner).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
    await rmdir(directory).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
    released = true;
  };
}

function asError(value) {
  return value instanceof Error ? value : new Error(String(value));
}

function operationAndCleanupError(operationError, cleanupError, label) {
  const operation = asError(operationError);
  const cleanup = asError(cleanupError);
  const combined = new Error(
    `${operation.message}; ${label} cleanup also failed: ${cleanup.message}`,
    { cause: operation }
  );
  if (operationError?.preserveRecordedAttempt) combined.preserveRecordedAttempt = true;
  return combined;
}

async function releaseLock(release, label) {
  try {
    await release();
  } catch (firstError) {
    try {
      // Lock cleanup is idempotent. A retry completes the common case where
      // owner removal succeeded but directory removal failed transiently.
      await release();
    } catch (secondError) {
      throw new Error(
        `${label} cleanup failed after retry: ${asError(secondError).message}`,
        { cause: asError(firstError) }
      );
    }
  }
}

async function withLockRelease(release, label, action) {
  let value;
  try {
    value = await action();
  } catch (operationError) {
    try {
      await releaseLock(release, label);
    } catch (cleanupError) {
      throw operationAndCleanupError(operationError, cleanupError, label);
    }
    throw operationError;
  }
  await releaseLock(release, label);
  return value;
}

async function assertNoTransitionLock(run) {
  const directory = path.join(run.runDir, COMMAND_LOCK);
  try {
    await lstat(directory);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  fail(
    `a transition command is in progress or left ${path.relative(run.repoRoot, directory)} stale; ` +
    "retry after it finishes, or verify no command is running before removing only that lock directory"
  );
}

async function currentLockedRun(run) {
  const current = await loadActiveRun(run.repoRoot);
  if (!current || current.state.run_id !== run.state.run_id) {
    fail("the active run changed while the command was open");
  }
  return current;
}

function stateAfterDecision(workflow, run, review, decision, reason, route, candidateManifest) {
  const state = structuredClone(run.state);
  for (const skipped of route.skips) {
    state.skipped_gates[skipped.gate_id] = skipped.reason;
  }
  state.status = route.status;
  state.active_gate_id = route.target ?? (route.status === "blocked" ? review.gate.id : null);
  state.current_attempt = null;
  state.stop_reason = route.status === "blocked" ? reason?.trim() || null : null;
  state.pending_direction = reason?.trim() || null;
  state.last_decision = {
    gate_id: review.gate.id,
    attempt: review.attempt.number,
    decision,
    reason: reason?.trim() || null,
    decided_by_mode: review.attempt.session?.mode ?? "manual",
    selected_at: new Date().toISOString()
  };

  const target = route.target ? gateById(workflow, route.target) : null;
  if (
    candidateManifest &&
    (state.implementation_manifest || target?.phase === "implementation" || review.gate.phase !== "technical-design")
  ) {
    state.implementation_manifest = candidateManifest;
  }
  return state;
}

async function launchAndRecord(repoRoot, workflow, catalogRecord, run, host, launch, sessionMode = undefined) {
  const beforeLaunch = structuredClone(run.state);
  await verifyCatalogSnapshot(run, catalogRecord);
  const packet = await launchPacket(repoRoot, workflow, run, host, sessionMode);
  await verifyCatalogSnapshot(run, catalogRecord);
  let recorded = false;
  const record = async (session) => {
    if (recorded) fail("the launch session was already recorded");
    await recordLaunch(run, packet, session, catalogRecord, sessionMode);
    recorded = true;
  };
  try {
    const session = await launch(packet, record);
    if (!recorded) await record(session);
    try {
      await markLaunchDelivery(run);
    } catch (error) {
      const preserved = (error instanceof Error ? error : new Error(String(error)));
      preserved.preserveRecordedAttempt = true;
      throw preserved;
    }
    return { kind: "launched", packet, run };
  } catch (error) {
    if (recorded && !error?.preserveRecordedAttempt) {
      try {
        await writeState(run, beforeLaunch);
      } catch (rollbackError) {
        const combined = new Error(
          `gate kickoff failed and its pending attempt could not be rolled back: ${rollbackError.message}`,
          { cause: error }
        );
        combined.preserveRecordedAttempt = true;
        throw combined;
      }
    }
    throw error;
  }
}

function neverLaunched(run) {
  return (
    (run.state.attempts[run.state.active_gate_id] ?? 0) === 0 &&
    run.state.last_decision === null
  );
}

function launchDeliveryPending(run) {
  return run.state.current_attempt?.delivery_status === "pending";
}

function assertAttemptMode(run, expectedMode) {
  if (!run.state.current_attempt) return;
  const actual = run.state.current_attempt.session?.mode ?? "manual";
  if (!expectedMode) {
    if (actual !== "manual") {
      fail(
        `the active attempt is owned by ${actual} session mode; a commanding surface must identify itself`
      );
    }
    return;
  }
  if (actual !== expectedMode) {
    fail(
      `the active attempt is owned by ${actual} session mode; continue through that operator surface`
    );
  }
}

async function recoverPendingLaunch(
  run,
  workflow,
  catalogRecord,
  expectedAttempt,
  host,
  launch,
  retirePendingSession,
  reason,
  sessionMode = undefined
) {
  if (typeof retirePendingSession !== "function") {
    fail("pending kickoff recovery requires a host session-retirement callback");
  }
  const attempt = run.state.current_attempt;
  if (
    !attempt ||
    attempt.delivery_status !== "pending" ||
    !sameAttempt(attempt, expectedAttempt)
  ) {
    fail("the pending kickoff changed before recovery");
  }
  await verifyActiveAttemptCatalog(run, catalogRecord);
  await retirePendingSession(attempt.session);
  const state = structuredClone(run.state);
  const priorAttempts = state.attempts[attempt.gate_id] ?? 0;
  if (priorAttempts !== attempt.number || priorAttempts < 1) {
    fail("the pending kickoff attempt counter is inconsistent");
  }
  if (priorAttempts === 1) delete state.attempts[attempt.gate_id];
  else state.attempts[attempt.gate_id] = priorAttempts - 1;
  state.current_attempt = null;
  state.pending_direction = reason?.trim() || "The human confirmed that the prior kickoff was not delivered.";
  await writeState(run, state);
  return launchAndRecord(run.repoRoot, workflow, catalogRecord, run, host, launch, sessionMode);
}

/**
 * @param {{
 *   repoRoot: string,
 *   host: string,
 *   intake?: {targetRepoPath: string, initialIdea: string},
 *   launch: (packet: any, record: (session: any) => Promise<void>) => Promise<any>,
 *   resumeReason?: string,
 *   recoverPendingLaunch?: boolean,
 *   confirmPendingDelivery?: boolean,
 *   expectedPendingLaunch?: any,
 *   sessionMode?: "manual" | "meta" | "auto",
 *   retirePendingSession?: (session: any) => Promise<void>
 * }} input
 */
export async function runStartCommand({
  repoRoot,
  host,
  intake,
  launch,
  resumeReason,
  recoverPendingLaunch: recoverPending = false,
  confirmPendingDelivery = false,
  expectedPendingLaunch = undefined,
  sessionMode = undefined,
  retirePendingSession = undefined
}) {
  if (typeof launch !== "function") fail("runStartCommand requires a launch callback");
  let { workflow, catalogRecord } = await loadWorkflowSnapshot(repoRoot);
  let run = await loadActiveRun(repoRoot);
  if (run && run.state.workflow_id !== workflow.workflow_id) {
    fail("active run belongs to another workflow; preserve it and start a compatible v2 run explicitly");
  }

  if (!run || run.state.status === "complete") {
    if (!intake) return { kind: run ? "complete" : "no_run", run };
    const releaseStart = await acquireStartLock(repoRoot);
    let releaseTransition;
    let created = false;
    try {
      await withLockRelease(releaseStart, "start lock", async () => {
        ({ workflow, catalogRecord } = await loadWorkflowSnapshot(repoRoot));
        run = await loadActiveRun(repoRoot);
        if (run && run.state.workflow_id !== workflow.workflow_id) {
          fail("active run belongs to another workflow; preserve it and start a compatible v2 run explicitly");
        }
        if (!run || run.state.status === "complete") {
          run = await createRun(repoRoot, workflow, intake);
          releaseTransition = await acquireTransitionLock(run);
          created = true;
        }
      });
    } catch (startError) {
      if (releaseTransition) {
        try {
          await releaseLock(releaseTransition, "transition lock");
        } catch (cleanupError) {
          throw operationAndCleanupError(startError, cleanupError, "transition lock");
        }
      }
      throw startError;
    }
    if (created) {
      return withLockRelease(releaseTransition, "transition lock", async () => {
        run = await currentLockedRun(run);
        return await launchAndRecord(repoRoot, workflow, catalogRecord, run, host, launch, sessionMode);
      });
    }
  }
  await assertNoTransitionLock(run);
  await verifyActiveAttemptCatalog(run, catalogRecord);
  if (run.state.status === "stopped") return { kind: "stopped", run };
  if (launchDeliveryPending(run)) {
    if (confirmPendingDelivery) {
      if (!expectedPendingLaunch) fail("delivery confirmation requires the inspected pending launch binding");
      assertAttemptMode(run, sessionMode);
      const release = await acquireTransitionLock(run);
      return withLockRelease(release, "transition lock", async () => {
        run = await currentLockedRun(run);
        if (
          !launchDeliveryPending(run) ||
          !sameAttempt(run.state.current_attempt, expectedPendingLaunch)
        ) {
          fail("the pending kickoff changed before confirmation");
        }
        assertAttemptMode(run, sessionMode);
        await verifyActiveAttemptCatalog(run, catalogRecord);
        await markLaunchDelivery(run, expectedPendingLaunch);
        const review = await inspectCurrentResult(workflow, run);
        return { kind: review.status, run, review };
      });
    }
    if (!recoverPending) return { kind: "delivery_pending", run };
    if (!expectedPendingLaunch) fail("pending kickoff retry requires the inspected launch binding");
    assertAttemptMode(run, sessionMode);
    const release = await acquireTransitionLock(run);
    return withLockRelease(release, "transition lock", async () => {
      run = await currentLockedRun(run);
      assertAttemptMode(run, sessionMode);
      return await recoverPendingLaunch(
        run,
        workflow,
        catalogRecord,
        expectedPendingLaunch,
        host,
        launch,
        retirePendingSession,
        resumeReason,
        sessionMode
      );
    });
  }
  if (run.state.status === "blocked") {
    if (!resumeReason?.trim()) return { kind: "blocked", run };
    const release = await acquireTransitionLock(run);
    return withLockRelease(release, "transition lock", async () => {
      run = await currentLockedRun(run);
      if (run.state.status !== "blocked") fail("the blocked run changed before resume");
      await verifyCatalogSnapshot(run, catalogRecord);
      const gate = gateById(workflow, run.state.active_gate_id);
      const nextAttempt = (run.state.attempts[gate.id] ?? 0) + 1;
      if (gate.max_attempts && nextAttempt > gate.max_attempts) {
        fail(`${gate.title} reached its ${gate.max_attempts}-attempt limit`);
      }
      const state = structuredClone(run.state);
      state.status = "active";
      state.stop_reason = null;
      state.pending_direction = resumeReason.trim();
      await writeState(run, state);
      return await launchAndRecord(repoRoot, workflow, catalogRecord, run, host, launch, sessionMode);
    });
  }
  if (!run.state.current_attempt) {
    if (!neverLaunched(run)) return { kind: "idle", run };
    const release = await acquireTransitionLock(run);
    return withLockRelease(release, "transition lock", async () => {
      run = await currentLockedRun(run);
      if (run.state.current_attempt) return { kind: "ready", run };
      return await launchAndRecord(repoRoot, workflow, catalogRecord, run, host, launch, sessionMode);
    });
  }
  const review = await inspectCurrentResult(workflow, run);
  return { kind: review.status, run, review };
}

/**
 * @param {{
 *   repoRoot: string,
 *   host: string,
 *   display?: (review: any) => Promise<void>,
 *   decide?: (review: any) => Promise<any>,
 *   launch: (packet: any, record: (session: any) => Promise<void>) => Promise<any>,
 *   sessionMode?: "manual" | "meta" | "auto",
 *   afterDecision?: (run: any) => Promise<void>,
 *   beforeDecisionCommit?: (run: any, review: any) => Promise<void>,
 *   afterReviewSnapshot?: (run: any, review: any) => Promise<void>
 * }} input
 */
export async function runNextCommand({
  repoRoot,
  host,
  display,
  decide,
  launch,
  sessionMode = undefined,
  afterDecision,
  beforeDecisionCommit = undefined,
  afterReviewSnapshot = undefined
}) {
  if (typeof launch !== "function") fail("runNextCommand requires a launch callback");
  const { workflow, catalogRecord } = await loadWorkflowSnapshot(repoRoot);
  let run = await loadActiveRun(repoRoot);
  if (!run) return { kind: "no_run" };
  if (run.state.workflow_id !== workflow.workflow_id) fail("active run belongs to another workflow");
  await assertNoTransitionLock(run);
  await verifyActiveAttemptCatalog(run, catalogRecord);

  if (run.state.status === "complete") return { kind: "complete", run };
  if (run.state.status === "blocked") return { kind: "blocked", run };
  if (run.state.status === "stopped") return { kind: "stopped", run };
  if (launchDeliveryPending(run)) return { kind: "delivery_pending", run };
  if (!run.state.current_attempt) {
    if (neverLaunched(run)) return { kind: "needs_start", run };
    const release = await acquireTransitionLock(run);
    return withLockRelease(release, "transition lock", async () => {
      run = await currentLockedRun(run);
      if (run.state.current_attempt) {
        await verifyActiveAttemptCatalog(run, catalogRecord);
        const review = await inspectCurrentResult(workflow, run);
        return { kind: review.status, run, review };
      }
      return await launchAndRecord(repoRoot, workflow, catalogRecord, run, host, launch, sessionMode);
    });
  }

  assertAttemptMode(run, sessionMode);
  const review = await inspectCurrentResult(workflow, run);
  if (review.status !== "ready") return { kind: review.status, run, review };
  const snapshot = await snapshotReview(run, review, catalogRecord);
  if (typeof display === "function") await display(review);
  if (typeof decide !== "function") fail("a ready gate result requires a decision callback");
  const selection = await decide(review);
  if (!selection) return { kind: "cancelled", run, review };
  const { decision, reason } = selection;
  assertHumanDecision(review.gate, decision);
  if (decision !== "approve" && (typeof reason !== "string" || !reason.trim())) {
    fail(`${decision} requires a short reason`);
  }

  const release = await acquireTransitionLock(run);
  return withLockRelease(release, "transition lock", async () => {
    run = await currentLockedRun(run);
    if (!sameAttempt(run.state.current_attempt, review.attempt)) {
      fail("this gate attempt already received a human decision or was replaced");
    }
    assertAttemptMode(run, sessionMode);
    await verifyActiveAttemptCatalog(run, catalogRecord);
    const currentReview = await inspectCurrentResult(workflow, run);
    if (currentReview.status !== "ready") {
      fail(`the reviewed gate result is no longer ready: ${currentReview.status}`);
    }
    assertHumanDecision(currentReview.gate, decision);

    const candidateManifest = await manifestCandidateForDecision(
      workflow,
      run,
      currentReview,
      decision
    );
    const route = await routeDecision(
      workflow,
      run,
      currentReview,
      decision,
      candidateManifest
    );
    const state = stateAfterDecision(
      workflow,
      run,
      currentReview,
      decision,
      reason,
      route,
      candidateManifest
    );
    if (typeof beforeDecisionCommit === "function") {
      await beforeDecisionCommit(run, currentReview);
    }
    // The candidate manifest was parsed before this final byte check. A later
    // working-tree edit can therefore neither change the reviewed transition
    // nor become pinned as unreviewed file authority.
    await verifyReviewSnapshot(run, snapshot);
    if (typeof afterReviewSnapshot === "function") {
      await afterReviewSnapshot(run, currentReview);
    }
    await writeState(run, state);
    if (typeof afterDecision === "function") await afterDecision(run);

    if (run.state.status !== "active") {
      return { kind: run.state.status, run, review: currentReview };
    }
    return await launchAndRecord(repoRoot, workflow, catalogRecord, run, host, launch, sessionMode);
  });
}
