## [LRN-20260317-001] best_practice

**Logged**: 2026-03-17T12:55:00-07:00
**Priority**: high
**Status**: in_progress
**Area**: infra

### Summary
Use a local-agent-runtime compatible state model as the single progress contract between backend and UI.

### Details
The repo needed a visible task/session/blocker tracker in the existing UI. Instead of inventing a new format, the runtime adapter now consumes a local-agent-runtime style state directory and maps it into `/api/runtime/progress` and `/api/runtime/stream`.

### Suggested Action
Keep future agent/session tracking changes compatible with the runtime state shape before expanding transport options.

### Metadata
- Source: conversation
- Related Files: src/api/controllers/runtimeController.js, frontend/src/services/runtimeService.ts, frontend/src/components/dashboard/RuntimeProgressPanel.tsx
- Tags: local-agents, runtime, ui, progress

---
