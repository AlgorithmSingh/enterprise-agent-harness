---
type: reference
title: "Reference Snapshots"
description: "Provenance and content identity for external source material vendored under reference."
timestamp: "2026-08-12T08:30:00-04:00"
---

# Reference Snapshots

## Python implementation sequence

| Field | Value |
| --- | --- |
| Snapshot path | `reference/python-typescript-swift-sequence/python/` |
| Upstream repository | `https://github.com/AlgorithmSingh/SKILLS.git` |
| Branch | `main` |
| Repository revision at snapshot | `265f4b3e21d8d070ab918d435c1ff2cb1699f2c5` |
| Python subtree object | `4f727dc27e3f4dbdaf36476901acca7615dd39a2` |
| Last upstream commit changing the Python subtree | `11154b493964665be7ece06d985f26706f37caaf` |
| Snapshot content SHA-256 | `2b13ab18082522a4f8b12b0585ded9cab4e16a4e626f453099554357315469ad` |
| Snapshot date | `2026-08-12` |
| Nested Git metadata | Removed / not present |
| License found in copied source tree | None |

The content SHA-256 is computed over the lexicographically sorted files as repeated `relative-path NUL file-sha256 NUL` records. It identifies this snapshot independently of file timestamps. The subtree object and content hash are byte-identical to the snapshot previously vendored by the ADK agent harness, so the two harnesses build on the same published sequence.

The vendored directory is an unmodified, byte-for-byte copy of the upstream Python subtree at the recorded revision. The active gate prompts adapt its stage responsibilities and dossier artifact names (`.sequence/<NN>-<agent>.json`) while leaving these source files read-only. No license was present in the copied source tree; this manifest records that fact and does not assign or imply a license.
