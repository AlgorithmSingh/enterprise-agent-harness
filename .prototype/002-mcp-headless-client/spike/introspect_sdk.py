"""Introspect the installed `mcp` Python SDK surface without any network call.

Prototype instrument: probes every import path, signature, and type field that
docs/book/mcp-client-mechanics.md claims, and emits one JSON object describing
what is actually present in the interpreter running this script.

Run with the venv interpreter, e.g.
    .venv-v1/bin/python introspect_sdk.py
"""

from __future__ import annotations

import importlib
import importlib.metadata
import inspect
import json
import sys
from typing import Any

# (module_path, attribute_or_None) pairs claimed by the book chapter.
CLAIMED_TARGETS: tuple[tuple[str, str | None], ...] = (
    ("mcp", "ClientSession"),
    ("mcp", "StdioServerParameters"),
    ("mcp", "types"),
    ("mcp", "Client"),  # v2-only per the book's "v2 (for reference)" row
    ("mcp", "McpError"),
    ("mcp.client.stdio", "stdio_client"),
    ("mcp.client.stdio", "StdioServerParameters"),
    ("mcp.client.streamable_http", "streamable_http_client"),
    ("mcp.client.streamable_http", "streamablehttp_client"),
    ("mcp.client.sse", "sse_client"),
    ("mcp.client.session", "ClientSession"),
    ("mcp.shared.exceptions", "McpError"),
    ("mcp.types", "CallToolResult"),
    ("mcp.types", "TextContent"),
    ("mcp.types", "Tool"),
    ("mcp.types", "LATEST_PROTOCOL_VERSION"),
    ("mcp.types", "SUPPORTED_PROTOCOL_VERSIONS"),
)

# Callables whose exact signature the book pins.
CLAIMED_SIGNATURES: tuple[tuple[str, str], ...] = (
    ("mcp.client.stdio", "stdio_client"),
    ("mcp.client.streamable_http", "streamable_http_client"),
    ("mcp.client.streamable_http", "streamablehttp_client"),
    ("mcp.client.sse", "sse_client"),
)

# (module, class, method) whose signature the book pins.
CLAIMED_METHODS: tuple[tuple[str, str, str], ...] = (
    ("mcp", "ClientSession", "__init__"),
    ("mcp", "ClientSession", "initialize"),
    ("mcp", "ClientSession", "list_tools"),
    ("mcp", "ClientSession", "call_tool"),
    ("mcp", "Client", "__init__"),
    ("mcp", "Client", "list_tools"),
    ("mcp", "Client", "call_tool"),
)

# Module-level constants the book gives exact values for.
CLAIMED_CONSTANTS: tuple[tuple[str, str], ...] = (
    ("mcp.client.streamable_http", "MCP_DEFAULT_TIMEOUT"),
    ("mcp.client.streamable_http", "MCP_DEFAULT_SSE_READ_TIMEOUT"),
    ("mcp.types", "LATEST_PROTOCOL_VERSION"),
    ("mcp.types", "SUPPORTED_PROTOCOL_VERSIONS"),
    ("mcp.types", "DEFAULT_NEGOTIATED_VERSION"),
)

# Result/error types whose fields the book relies on.
CLAIMED_MODELS: tuple[tuple[str, str], ...] = (
    ("mcp.types", "CallToolResult"),
    ("mcp.types", "Tool"),
    ("mcp.types", "ListToolsResult"),
)


def _import(module_path: str) -> tuple[Any | None, str | None]:
    """Import a module, returning (module, error_string)."""
    try:
        return importlib.import_module(module_path), None
    except ImportError as exc:
        return None, f"{type(exc).__name__}: {exc}"


def _signature_of(obj: Any) -> str | None:
    try:
        return str(inspect.signature(obj))
    except (TypeError, ValueError) as exc:
        return f"<unavailable: {type(exc).__name__}: {exc}>"


def probe_targets() -> list[dict[str, Any]]:
    """Resolve every claimed import path; report presence and provenance."""
    results: list[dict[str, Any]] = []
    for module_path, attr in CLAIMED_TARGETS:
        module, error = _import(module_path)
        target = module_path if attr is None else f"{module_path}:{attr}"
        if module is None:
            results.append({"target": target, "status": "missing", "error": error})
            continue
        if attr is None:
            results.append({"target": target, "status": "ok", "kind": "module"})
            continue
        if not hasattr(module, attr):
            results.append(
                {
                    "target": target,
                    "status": "missing",
                    "error": f"AttributeError: module {module_path!r} has no attribute {attr!r}",
                }
            )
            continue
        obj = getattr(module, attr)
        results.append(
            {
                "target": target,
                "status": "ok",
                "kind": type(obj).__name__,
                "defined_in": getattr(obj, "__module__", None),
                "qualname": getattr(obj, "__qualname__", None),
            }
        )
    return results


def probe_signatures() -> dict[str, Any]:
    """Report exact signatures of the claimed transport factories."""
    out: dict[str, Any] = {}
    for module_path, attr in CLAIMED_SIGNATURES:
        module, error = _import(module_path)
        key = f"{module_path}:{attr}"
        if module is None or not hasattr(module, attr):
            out[key] = {"status": "missing", "error": error or "AttributeError"}
            continue
        obj = getattr(module, attr)
        out[key] = {
            "status": "ok",
            "signature": _signature_of(obj),
            "doc_head": (inspect.getdoc(obj) or "").split("\n\n")[0][:400] or None,
        }
    return out


def probe_methods() -> dict[str, Any]:
    """Report exact signatures of the claimed session/client methods."""
    out: dict[str, Any] = {}
    for module_path, cls_name, method_name in CLAIMED_METHODS:
        module, error = _import(module_path)
        key = f"{module_path}:{cls_name}.{method_name}"
        if module is None or not hasattr(module, cls_name):
            out[key] = {"status": "missing", "error": error or "AttributeError"}
            continue
        cls = getattr(module, cls_name)
        if not hasattr(cls, method_name):
            out[key] = {"status": "missing", "error": f"no method {method_name!r}"}
            continue
        method = getattr(cls, method_name)
        out[key] = {
            "status": "ok",
            "signature": _signature_of(method),
            "is_async": inspect.iscoroutinefunction(method),
            "defined_in": getattr(method, "__module__", None),
        }
    return out


def probe_constants() -> dict[str, Any]:
    """Report actual values of constants the book pins."""
    out: dict[str, Any] = {}
    for module_path, name in CLAIMED_CONSTANTS:
        module, error = _import(module_path)
        key = f"{module_path}:{name}"
        if module is None or not hasattr(module, name):
            out[key] = {"status": "missing", "error": error or "AttributeError"}
            continue
        out[key] = {"status": "ok", "value": repr(getattr(module, name))}
    return out


def probe_models() -> dict[str, Any]:
    """Report the field names/aliases of the claimed result models."""
    out: dict[str, Any] = {}
    for module_path, cls_name in CLAIMED_MODELS:
        module, error = _import(module_path)
        key = f"{module_path}:{cls_name}"
        if module is None or not hasattr(module, cls_name):
            out[key] = {"status": "missing", "error": error or "AttributeError"}
            continue
        cls = getattr(module, cls_name)
        model_fields = getattr(cls, "model_fields", None)
        if model_fields is None:
            out[key] = {"status": "ok", "fields": None, "note": "not a pydantic model"}
            continue
        fields = {
            field_name: {
                "alias": getattr(field, "alias", None),
                "annotation": str(getattr(field, "annotation", None)),
                "required": bool(getattr(field, "is_required", lambda: False)()),
            }
            for field_name, field in model_fields.items()
        }
        out[key] = {
            "status": "ok",
            "attribute_names": sorted(fields),
            "fields": fields,
            "populate_by_name": bool(
                getattr(cls, "model_config", {}).get("populate_by_name", False)
            ),
        }
    return out


def build_report() -> dict[str, Any]:
    """Assemble the full offline introspection report."""
    try:
        version = importlib.metadata.version("mcp")
    except importlib.metadata.PackageNotFoundError:
        version = "not-installed"
    mcp_module, mcp_error = _import("mcp")
    return {
        "python": sys.version.split()[0],
        "executable": sys.executable,
        "mcp_version": version,
        "mcp_module_file": getattr(mcp_module, "__file__", None),
        "mcp_import_error": mcp_error,
        "mcp_public_names": sorted(getattr(mcp_module, "__all__", []) or []),
        "imports": probe_targets(),
        "signatures": probe_signatures(),
        "methods": probe_methods(),
        "constants": probe_constants(),
        "models": probe_models(),
    }


def main() -> int:
    """CLI entrypoint: print the report as a single JSON object."""
    print(json.dumps(build_report(), indent=2, sort_keys=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
