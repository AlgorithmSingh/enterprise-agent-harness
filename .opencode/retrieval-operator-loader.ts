/**
 * Optional OpenCode meta-mode loader.
 *
 * Manual `/retrieval-phase` operation is part of this repository and must remain
 * usable from a release archive that does not contain the separately released
 * generic `meta-harness` package. When that one dependency is absent, expose
 * no meta tools. Every other import/configuration failure remains fatal.
 */
import type { Plugin } from "@opencode-ai/plugin";

function isMissingGenericPackage(error: unknown): boolean {
  const candidate = error as { code?: unknown; message?: unknown } | null;
  return (
    candidate?.code === "ERR_MODULE_NOT_FOUND" &&
    typeof candidate.message === "string" &&
    candidate.message.includes("meta-harness")
  );
}

const server: Plugin = async (input) => {
  try {
    const loaded = await import("./retrieval-operator-tools.ts");
    return loaded.default.server(input);
  } catch (error) {
    if (isMissingGenericPackage(error)) return {};
    throw error;
  }
};

export default { id: "retrieval-meta-operator-loader", server };
