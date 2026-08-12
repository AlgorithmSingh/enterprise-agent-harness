"""Reproduce mcp-remote 0.1.38's default OAuth callback port, offline.

Both book chapters state that mcp-remote listens for the OAuth redirect on
localhost:3334 by default. The shipped 0.1.38 code does not: it derives a
per-server-URL port. From dist/chunk-65X3S4HB.js:

    function getServerUrlHash(serverUrl, authorizeResource, headers) {
      const parts = [serverUrl];
      ...
      return crypto.createHash("md5").update(parts.join("|")).digest("hex");
    }
    function calculateDefaultPort(serverUrlHash) {
      const offset = parseInt(serverUrlHash.substring(0, 4), 16);
      return 3335 + offset % 45816;
    }

This module reimplements both so the real port can be predicted without
running the bridge and without any network call. The port matters because the
operator must allowlist it in the browser/firewall for the OAuth redirect.

Run:  python3 mcp_remote_port.py
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

PORT_BASE = 3335
PORT_SPAN = 45816

DOCUMENTED_ENDPOINTS: tuple[str, ...] = (
    "https://mcp.atlassian.com/v1/mcp/authv2",
    "https://mcp.atlassian.com/v1/mcp",
    "https://mcp.atlassian.com/v1/sse",
)


def server_url_hash(
    server_url: str,
    authorize_resource: str | None = None,
    headers: dict[str, str] | None = None,
) -> str:
    """Reproduce mcp-remote's getServerUrlHash: md5 of '|'-joined parts."""
    parts = [server_url]
    if authorize_resource:
        parts.append(authorize_resource)
    if headers:
        parts.append(json.dumps(headers, sort_keys=True, separators=(",", ":")))
    joined = "|".join(parts)
    return hashlib.md5(joined.encode("utf-8"), usedforsecurity=False).hexdigest()


def default_callback_port(server_url_hash_hex: str) -> int:
    """Reproduce mcp-remote's calculateDefaultPort."""
    offset = int(server_url_hash_hex[:4], 16)
    return PORT_BASE + offset % PORT_SPAN


def describe(server_url: str) -> dict[str, Any]:
    """Compute the hash, preferred port, and on-disk state paths for a URL."""
    digest = server_url_hash(server_url)
    return {
        "server_url": server_url,
        "server_url_hash_md5": digest,
        "preferred_default_port": default_callback_port(digest),
        "config_dir": "~/.mcp-auth/mcp-remote-0.1.38",
        "debug_log": f"~/.mcp-auth/mcp-remote-0.1.38/{digest}_debug.log",
    }


def main() -> int:
    """CLI entrypoint: print the derived ports for the documented endpoints."""
    report = {
        "note": (
            "Port is the PREFERRED port; if busy, findAvailablePort picks another. "
            "A cached client registration (existingClientPort) or an explicit "
            "positional port argument overrides it."
        ),
        "possible_port_range": f"{PORT_BASE}-{PORT_BASE + PORT_SPAN - 1}",
        "book_claimed_default": 3334,
        "book_claim_in_range": PORT_BASE <= 3334 <= PORT_BASE + PORT_SPAN - 1,
        "endpoints": [describe(url) for url in DOCUMENTED_ENDPOINTS],
    }
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
