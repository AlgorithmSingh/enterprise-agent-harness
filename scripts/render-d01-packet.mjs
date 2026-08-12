import { cp, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runStartCommand } from "../retrieval_agent_harness_phase_based/plugin-runtime.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scratchRoot = path.join(projectRoot, ".simulate-retrieval-harness");
await mkdir(scratchRoot, { recursive: true });
const targetRoot = await mkdtemp(path.join(scratchRoot, "target-"));

await cp(
  path.join(projectRoot, "retrieval_agent_harness_phase_based"),
  path.join(targetRoot, "retrieval_agent_harness_phase_based"),
  { recursive: true },
);
// The rendered packet obliges the gate agent to read the target repo's AGENTS.md
// and the tool book, so the temp target must carry the full installation bundle.
for (const bundled of ["AGENTS.md", "CLAUDE.md", "docs"]) {
  await cp(path.join(projectRoot, bundled), path.join(targetRoot, bundled), {
    recursive: true,
  });
}

let captured;
await runStartCommand({
  repoRoot: targetRoot,
  host: "simulate",
  intake: {
    targetRepoPath: targetRoot,
    initialIdea:
      "Build an enterprise retrieval agent that answers release-audit questions by planning " +
      "a pipeline over GitHub (gh CLI), Jira and Confluence (Rovo MCP), and Datadog, retrieving " +
      "in parallel near each provider's rate-limit budget with slow-start recovery, healing its " +
      "retrieval scripts within bounded attempts, and cleaning every payload to minimal " +
      "provenance-carrying records before inference.",
  },
  launch: async (packet) => {
    captured = packet;
    return { id: "simulation-d01-session", mode: "manual" };
  },
});

if (!captured) throw new Error("the runtime did not render a D01 launch packet");

const rendered = {
  rendered_by: "scripts/render-d01-packet.mjs",
  target_root: targetRoot,
  gate: captured.gate,
  attempt: captured.attempt,
  allowed_files: captured.allowed_files,
  collaborative_edit_paths: captured.collaborative_edit_paths,
  system: captured.system,
  message: captured.message,
};

const json = `${JSON.stringify(rendered, null, 2)}\n`;
const outputFlag = process.argv.indexOf("--output");
if (outputFlag >= 0) {
  const output = process.argv[outputFlag + 1];
  if (!output) throw new Error("--output requires a path");
  await writeFile(path.resolve(output), json, { flag: "wx" });
}
process.stdout.write(json);
