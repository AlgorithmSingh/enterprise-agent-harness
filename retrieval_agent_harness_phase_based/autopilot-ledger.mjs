import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Run-scoped autopilot decision ledger. Every agent-taken authority action —
 * run start/resume, gate decisions, worker question answers, shell approvals,
 * escalations, aborts, releases — is appended as one JSON line so a human can
 * audit after the fact what the autopilot decided and why. The ledger is
 * evidence, not authority: the runtime's state file remains the only
 * transition record, and a ledger write failure must fail the action that
 * required it rather than proceeding unrecorded.
 */

const LEDGER_DIRECTORY = "autopilot";
const LEDGER_FILE = "decisions.jsonl";

/**
 * Append one ledger entry under `<runDir>/autopilot/decisions.jsonl`, creating
 * the directory on first use. The entry must be a plain JSON-serializable
 * object with a non-empty string `event`; a `recorded_at` ISO timestamp is
 * stamped here. Returns the written entry.
 */
export async function appendAutopilotLedger(runDir, entry) {
  if (typeof runDir !== "string" || !runDir.trim()) {
    throw new Error("the autopilot ledger requires the active run directory");
  }
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error("an autopilot ledger entry must be a plain object");
  }
  const prototype = Object.getPrototypeOf(entry);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error("an autopilot ledger entry must be a plain object");
  }
  if (typeof entry.toJSON === "function") {
    throw new Error("an autopilot ledger entry may not define toJSON");
  }
  if (typeof entry.event !== "string" || !entry.event.trim()) {
    throw new Error("an autopilot ledger entry requires a non-empty event name");
  }
  const recordedAt = new Date().toISOString();
  const record = { ...entry, recorded_at: recordedAt };
  const line = JSON.stringify(record);
  if (line.includes("\n")) {
    throw new Error("an autopilot ledger entry must serialize to a single line");
  }
  const persisted = JSON.parse(line);
  if (persisted.event !== entry.event || persisted.recorded_at !== recordedAt) {
    throw new Error("the autopilot ledger entry changed during serialization");
  }
  const directory = path.join(runDir, LEDGER_DIRECTORY);
  await mkdir(directory, { recursive: true });
  await appendFile(path.join(directory, LEDGER_FILE), `${line}\n`, "utf8");
  // Return exactly what the audit trail now holds; serialization drops
  // undefined and function-valued fields, and callers must not believe
  // they recorded something the ledger does not contain.
  return persisted;
}

/**
 * Read the full ledger for a run directory. Returns [] when no ledger exists;
 * throws on unreadable or corrupt lines so audit gaps are visible, never
 * silently skipped.
 */
export async function readAutopilotLedger(runDir) {
  let raw;
  try {
    raw = await readFile(path.join(runDir, LEDGER_DIRECTORY, LEDGER_FILE), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  return raw
    .split("\n")
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new Error(`autopilot ledger line ${index + 1} is not valid JSON`);
      }
    });
}
