import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  inspectCurrentResult,
  loadActiveRun,
  loadWorkflowSnapshot,
  routeDecision,
  snapshotReview,
} from "./plugin-runtime.mjs";

// Retrieval-side single source of the ephemeral transition confirmation binding. Both host
// adapters call this module at prepare time and again inside the
// runNextCommand().decide callback, then compare the canonical bytes exactly.
// The generic meta-harness package treats these bytes as opaque.

const CONFIRMATION_TITLE = "CONFIRM Retrieval GATE TRANSITION";
const DECISIONS = new Set(["approve", "revise", "block", "not_applicable"]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function fileRecord(absolute, relative) {
  const bytes = await readFile(absolute);
  return { path: relative, size: bytes.byteLength, sha256: sha256(bytes) };
}

export function validateDecisionInput(decision, reason) {
  if (!DECISIONS.has(decision)) {
    throw new Error(`invalid human decision: ${decision}`);
  }
  if (decision === "approve") {
    if (reason !== null) throw new Error("an approve proposal must carry reason: null");
    return { decision, reason: null };
  }
  if (typeof reason !== "string" || !reason.trim()) {
    throw new Error(`${decision} requires a short non-empty reason`);
  }
  return { decision, reason: reason.trim() };
}

/**
 * The supervisor's terminal worker record must exactly match the runtime's
 * recorded attempt session and carry a verified cheap model before any
 * transition binding is built; a transition may only proceed from work performed by
 * the worker the runtime actually recorded.
 */
function assertWorkerBinding(gateWorker, run, review) {
  if (!gateWorker) {
    throw new Error("a transition binding requires the supervisor's recorded gate worker");
  }
  if (
    gateWorker.task?.runId !== run.state.run_id ||
    gateWorker.task?.taskId !== review.gate.id ||
    gateWorker.task?.attempt !== review.attempt.number
  ) {
    throw new Error(
      "the recorded gate worker belongs to a different run, gate, or attempt than the reviewed result"
    );
  }
  if (!["finished", "aborted", "interrupted"].includes(gateWorker.status)) {
    throw new Error("a transition binding requires a terminal gate worker");
  }
  if (
    !gateWorker.hostSessionId ||
    gateWorker.hostSessionId !== review.attempt.session.id
  ) {
    throw new Error(
      "the recorded gate worker session does not match the runtime-recorded attempt session"
    );
  }
  if (!["meta", "auto"].includes(review.attempt.session.mode)) {
    throw new Error("the reviewed attempt is not owned by a supervised operator surface");
  }
  if (gateWorker.modelVerification !== "verified") {
    throw new Error(
      "the gate worker's model was never verified against the configured cheap model; refusing to bind a transition to it"
    );
  }
}

/**
 * Build the full, ephemeral transition binding from current bytes, the runtime's
 * review snapshot, and its catalog route. Nothing is persisted here. Throws
 * unless the active run has a ready, valid gate result produced by the verified
 * recorded worker and the proposed decision is allowed for this gate.
 */
export async function buildTransitionBinding(input) {
  const { decision, reason } = validateDecisionInput(input.decision, input.reason ?? null);
  const { workflow, catalogRecord } = await loadWorkflowSnapshot(input.repoRoot);
  const run = await loadActiveRun(input.repoRoot);
  if (!run) throw new Error("no active run exists");
  const review = await inspectCurrentResult(workflow, run);
  if (review.status !== "ready") {
    throw new Error(`the gate result is not ready for a transition proposal: ${review.status}`);
  }
  assertWorkerBinding(input.gateWorker, run, review);

  const snapshot = await snapshotReview(run, review, catalogRecord);
  const currentResult = snapshot.find(
    (record) => record.scope === "run" && record.kind === "gate_result"
  );
  if (!currentResult) throw new Error("the review snapshot is missing the gate result record");

  const declaredArtifacts = [];
  for (const entry of review.result.artifacts) {
    declaredArtifacts.push(
      await fileRecord(path.join(input.repoRoot, entry.path), entry.path)
    );
  }
  const declaredEvidence = [];
  for (const entry of review.result.evidence) {
    declaredEvidence.push(
      await fileRecord(path.join(input.repoRoot, entry.path), entry.path)
    );
  }
  const reviewManifest = {
    current_result: { path: currentResult.path, size: currentResult.size, sha256: currentResult.sha256 },
    artifacts: declaredArtifacts,
    evidence: declaredEvidence,
  };

  const route = await routeDecision(workflow, run, review, decision);
  const binding = {
    version: 1,
    host: input.host,
    workflow: {
      workflow_id: workflow.workflow_id,
      catalog_path: catalogRecord.path,
      catalog_size: catalogRecord.size,
      catalog_sha256: catalogRecord.sha256,
    },
    operator: {
      session_id: input.operatorSessionId,
      model: input.operatorModel ?? null,
    },
    worker: {
      session: review.attempt.session,
      worker_id: input.gateWorker.workerId,
      host_session_id: input.gateWorker.hostSessionId,
      model: input.gateWorker.model,
      model_verification: input.gateWorker.modelVerification,
    },
    run: {
      run_id: run.state.run_id,
      gate_id: review.gate.id,
      gate_title: review.gate.title,
      attempt: review.attempt.number,
      launch_id: review.attempt.launch_id,
    },
    decision: { value: decision, reason },
    agent_recommendation: review.result.recommendation,
    summary: review.result.summary,
    current_result: reviewManifest.current_result,
    declared_artifacts: declaredArtifacts,
    declared_evidence: declaredEvidence,
    snapshot_files: snapshot,
    review_manifest_sha256: sha256(Buffer.from(JSON.stringify(reviewManifest), "utf8")),
    next: {
      status: route.status,
      gate_id: route.target,
      skipped_gates: route.skips,
      stop_reason: route.status === "blocked" ? reason : null,
    },
  };
  const canonical = JSON.stringify(binding);
  return {
    binding,
    canonical,
    confirmation: `${CONFIRMATION_TITLE}\n${canonical}`,
    workflow,
    run,
    review,
  };
}

export const TRANSITION_CONFIRMATION_TITLE = CONFIRMATION_TITLE;

/** Canonical block a human must author to start a run with these exact intake values. */
export function startRunConfirmation(input) {
  return [
    "START Retrieval RUN",
    JSON.stringify({
      target_repo_path: input.targetRepoPath,
      initial_idea_sha256: sha256(Buffer.from(input.initialIdea, "utf8")),
      initial_idea: input.initialIdea,
    }),
  ].join("\n");
}

/** Canonical block a human must author to resume a blocked run with this reason. */
export function resumeRunConfirmation(input) {
  return [
    "RESUME Retrieval RUN",
    JSON.stringify({
      run_id: input.runId,
      gate_id: input.gateId,
      resume_reason: input.resumeReason,
    }),
  ].join("\n");
}

/** Canonical block a human must author to approve a gate permission request. */
export function permissionApprovalConfirmation(input) {
  return [
    "APPROVE Retrieval GATE PERMISSION",
    JSON.stringify({
      request_id: input.requestId,
      host_request_id: input.hostRequestId ?? null,
      run_id: input.runId,
      gate_id: input.gateId,
      attempt: input.attempt,
      permission: input.permission,
      payload_sha256: sha256(Buffer.from(input.payload, "utf8")),
    }),
  ].join("\n");
}

/** Canonical block a human must author to relay an answer to a gate question. */
export function questionAnswerConfirmation(input) {
  return [
    "RELAY Retrieval GATE ANSWER",
    JSON.stringify({
      request_id: input.requestId,
      host_request_id: input.hostRequestId ?? null,
      run_id: input.runId,
      gate_id: input.gateId,
      attempt: input.attempt,
      answers: input.answers,
    }),
  ].join("\n");
}
