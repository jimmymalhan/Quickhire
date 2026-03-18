## [FEAT-20260317-001] self-improving-local-agent-workflow

**Logged**: 2026-03-17T12:55:00-07:00
**Priority**: high
**Status**: in_progress
**Area**: infra

### Requested Capability
Use local agents first, keep the runtime self-improving, and surface progress in the existing localhost UI and terminal.

### User Context
The user wants local-agent execution prioritized, realtime task visibility, and a workflow that teaches the runtime to handle similar sessions better over time without depending on paid APIs.

### Complexity Estimate
complex

### Suggested Implementation
Adopt a local-agent-runtime compatible tracker, add `.learnings/` logs for runtime lessons and blockers, then expand into streaming updates, review automation, and runtime-state writeback from active task execution.

### Metadata
- Frequency: recurring
- Related Features: runtime-progress-panel, runtime-controller, local-browser-fixture

---
