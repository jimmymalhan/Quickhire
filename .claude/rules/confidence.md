# Confidence Scoring System

## Rubric (0-100)

**0-39: Guess/Assumption**
- No evidence or proof
- Untested code
- Unknown behavior
- Incomplete implementation

**40-59: Partial Evidence**
- Some tests passing
- Code written but not all paths tested
- Manual testing incomplete
- Documentation sparse

**60-79: Implemented, Incomplete Proof**
- Implementation complete
- Unit tests written but not all integration tested
- Manual verification partial
- Edge cases not tested
- Performance not verified

**80-94: Strong Proof, Minor Unknowns**
- Implementation complete and tested
- All critical paths tested (unit + integration)
- Manual verification done
- Edge cases documented
- Minor unknowns listed
- 1-2 edge cases not verified

**95-100: Production-Ready (Complete Proof)**
- Implementation complete
- 100% test coverage on new code
- All critical paths tested (unit + integration + e2e)
- Manual verification done (localhost)
- All edge cases handled
- Error handling verified
- Performance verified
- Documentation complete
- Zero unknowns

## Evidence Checklist

For 95-100 confidence, prove:
- [ ] Code compiles/runs without errors
- [ ] Unit tests passing (>80% coverage)
- [ ] Integration tests passing
- [ ] E2E tests passing (if applicable)
- [ ] Manual localhost testing done
- [ ] All UI states visible (loading, empty, error, success)
- [ ] All API endpoints responding correctly
- [ ] Error messages are clear and actionable
- [ ] No console errors or warnings
- [ ] No linting errors
- [ ] Documentation updated
- [ ] Critical workflows tested end-to-end
- [ ] Performance acceptable (no timeouts)
- [ ] Security checked (no secrets in code)

## Scoring Rules

- **Cannot exceed 79** if critical workflows untested
- **Cannot exceed 59** if code doesn't compile
- **Cannot exceed 39** if no tests written
- **Must be ≥80** to merge to develop
- **Must be ≥95** to merge to main

## Documentation

Record in `docs/CONFIDENCE_SCORE.md`:
- Task name and description
- Files modified
- Evidence (tests run, commands executed)
- Critical flows verified
- Known unknowns or assumptions
- Residual risks
- Rollback plan
- Final confidence score + justification

---

**Example Entry**:
```
## Task: Production-Grade UI

**Files**: frontend/src/pages/DashboardPage.tsx, components/common/LoadingSpinner.tsx

**Evidence**:
- npm test (1359/1512 passing)
- npm run lint (0 errors in src/)
- Localhost:3000 (manual verification, all states visible)
- Loading spinner: tested with 500ms+ delays
- Empty state: tested with 0 results
- Success confirmation: tested after job apply

**Critical Flows Verified**:
✓ Job search → Load → Display results
✓ Job apply → Loading → Success confirmation
✓ No jobs → Empty state with next action
✓ API error → Error message with retry

**Unknowns**:
- Performance at 10,000+ jobs untested
- Mobile responsiveness not verified

**Risks**:
- Performance regression at scale (>5000 jobs)

**Rollback**:
git revert <commit-hash>

**Confidence**: 85% (strong proof, minor performance unknown)
```
