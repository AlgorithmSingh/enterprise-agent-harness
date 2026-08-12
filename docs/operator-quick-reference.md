---
type: Guide
title: Retrieval Harness Operator Quick Reference
description: Summarizes the manual commands, human decisions, run states, result envelope, and recovery behavior for the Retrieval agent harness.
timestamp: 2026-08-12T08:40:00-04:00
---

# Retrieval Harness Operator Quick Reference

## Commands

| Command | Use |
| --- | --- |
| `/retrieval-phase` | Start one run, inspect active status, reconcile an interrupted launch, inspect uncertain delivery, or resume a blocked run after explicit confirmation. |
| `/retrieval-phase-next` | Validate the active result, display it, collect one human decision, commit that decision, and launch the selected next gate. |

Start requires the exact current repository path and an initial idea. A fresh run creates `.retrieval-agent-runs/<run-id>/` and launches D01 in a new host session. Starting again never creates an unnoticed competing run.

## Gate completion contract

Each gate writes `gate-result.json` with exactly:

```json
{
  "gate_id": "D01",
  "recommendation": "approve",
  "summary": "...",
  "artifacts": [],
  "evidence": [],
  "uncertainties": [],
  "blockers": []
}
```

Referenced artifacts and evidence must be regular, authorized files whose reviewed bytes still match at commit time.

## Human decisions

| Decision | Effect |
| --- | --- |
| Approve | Advance through the catalog, skipping manifest-inactive optional gates. |
| Revise | Retry the current gate with the human reason; at B27, enter bounded BR repair. |
| Block | Pause the run with a reason. |
| Not Applicable | Advance only when that gate permits it and a reason is supplied. |

The agent recommendation is advisory. Cancellation commits nothing. The current gate's authority is retired before transition; the next gate receives only catalog-authorized context and paths.

## Recovery states

- A committed transition with a missing next launch is resumed once without asking for a second decision.
- A kickoff known not to have been delivered can be rolled back safely; uncertain delivery is preserved for explicit inspection.
- A blocked run can resume only from a fresh session and an exact human-authored confirmation.
- A stale session, mismatched launch ID, wrong host mode, changed catalog, changed reviewed file, or legacy receipt-bearing v1 run fails closed.
- A crashed command can leave `.retrieval-agent-runs/<run-id>/.transition-lock` (or `.retrieval-agent-runs/.start-lock` for a crashed start) stale; after verifying no command is running, remove only that lock directory and rerun the command.
- BR returns to B25; a third repair attempt is refused with "Targeted repair reached its 2-attempt repair limit", leaving the B27 result undecided so the human must then Approve or Block.

