## [ERR-20260317-001] frontend-typecheck

**Logged**: 2026-03-17T12:55:00-07:00
**Priority**: high
**Status**: pending
**Area**: tests

### Summary
Frontend typecheck is blocked by existing test-global and typing issues outside the runtime-tracker slice.

### Error
- `Cannot find name 'beforeEach'`
- `Cannot find name 'afterEach'`
- `Type 'unknown' is not assignable to type 'number | null'`

### Context
- Operation attempted: `cd frontend && npx tsc -p tsconfig.json --noEmit`
- Affected files: `ErrorBoundary.test.tsx`, `useDebounce.test.ts`, `useApi.test.ts`

### Suggested Fix
Add Vitest globals typing to the frontend TS config and fix the mismatched test typing in `useApi.test.ts`.

### Metadata
- Reproducible: yes
- Related Files: frontend/tsconfig.json, frontend/src/components/common/__tests__/ErrorBoundary.test.tsx, frontend/src/hooks/__tests__/useDebounce.test.ts, frontend/src/hooks/__tests__/useApi.test.ts

---
