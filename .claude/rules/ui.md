# UI Production-Grade Standards

## Principles
- **Desktop-first**: Design for 1440px+ width, optimize for laptops/monitors
- **Business-focused**: Use outcome-driven language (create, review, track, approve, resolve)
- **State-complete**: Every component must handle loading, empty, success, error, stale states
- **Hierarchy clear**: Visual weight proportional to importance
- **End-to-end workflows**: Show complete user journeys, not isolated components

## UI States Required

Every page/component must implement:
1. **Loading**: Spinner with progress indication
2. **Empty**: With actionable next steps, not just "No data"
3. **Success**: Clear confirmation of action results
4. **Error**: Non-technical, recovery-focused messaging
5. **Stale Data**: Last updated timestamp, refresh option
6. **Permission Denied**: Clear explanation, no technical jargon

## Spacing & Layout
- Desktop: Min-width 1440px, max-width 1920px for readability
- Padding: 24px+ on sides, 16px+ vertical
- Card margins: 16px minimum
- Line-height: 1.6 for readability

## Typography
- Headlines: Clear outcome-driven language
- Labels: Business language, not technical
- Error messages: "We had trouble saving your preferences" not "500 error"
- Help text: Action-oriented, 1-2 sentences max

## Color & Visual
- Status indicators: Green (success), Red (error), Blue (info), Yellow (warning)
- Loading spinners: Smooth, 0.8-1.2 second animations
- Icons: 24px minimum size for clickability
- Contrast: WCAG AA minimum (4.5:1 for text)

## Components Standard
- Buttons: Minimum 44px height for touch
- Forms: Single-column on desktop (unless justified)
- Tables: Sortable headers, clear alternating rows
- Modals: Centered, max-width 600px, dark overlay

## Workflow Examples
1. **Create Request** → Loading → Success ✓ → Show confirmation + next action
2. **View Status** → Load data → Show timeline → Can retry if failed
3. **Edit Settings** → Form → Save loading → Success → Show what changed
4. **Apply Job** → Confirm → Submitting → Success/Error handling

---

**Rule**: If a state isn't implemented, confidence score drops below 80
**Test**: All UI states visible and testable in localhost:3000
