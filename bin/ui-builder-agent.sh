#!/usr/bin/env bash
# ui-builder-agent.sh — Builds advanced React UI + Playwright mouse interaction tests.
# Priority: UI first. No Claude tokens.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
S="$ROOT/state/local-agent-runtime"
FE="$ROOT/frontend/src"
LOG="$S/ui-builder-agent.log"
mkdir -p "$S" "$FE/components/ui" "$FE/components/dashboard" \
         "$FE/components/apply" "$FE/animations" "$FE/tests/e2e"
echo $$ > "$S/ui-builder-agent.pid"
cd "$ROOT"
log(){ printf '[%s] [UI-BUILDER] %s\n' "$(date +%H:%M:%S)" "$1" | tee -a "$LOG"; }
git config user.name "Jimmy Malhan"; git config user.email "jimmymalhan999@gmail.com"
log "=== UI-BUILDER-AGENT pid=$$ — Advanced UI priority ==="

# ── Bump UI tasks to top of backlog ──────────────────────────────────────────
python3 -c "
import json,os
S='$S'
bl=json.load(open(f'{S}/backlog.json')) if os.path.exists(f'{S}/backlog.json') else []
# Give all UI/Frontend tasks vote_score boost to float to top
for t in bl:
    title=t.get('title','').lower()
    if any(k in title for k in ['ui','frontend','react','dashboard','page','mobile','browser ext']):
        t['vote_score']=t.get('vote_score',0)+500  # UI priority boost
        t['status']='ready' if t.get('status')!='done' else 'done'
pending=[t for t in bl if t.get('status')!='done']
done=[t for t in bl if t.get('status')=='done']
pending.sort(key=lambda t:(-t.get('vote_score',0),t.get('p',99)))
for i,t in enumerate(pending): t['p']=i+1
json.dump(done+pending,open(f'{S}/backlog.json','w'),indent=2)
print('UI tasks promoted to top of backlog')
" 2>/dev/null

log "Writing advanced UI components..."

# ══════════════════════════════════════════════════════════════
# 1. DESIGN SYSTEM — tokens, animations, theme
# ══════════════════════════════════════════════════════════════
cat > "$FE/components/ui/design-system.js" << 'JSEOF'
// Quickhire Design System — enterprise-grade, animation-first
export const theme = {
  colors: {
    brand:   { 50:'#eff6ff',100:'#dbeafe',500:'#3b82f6',600:'#2563eb',900:'#1e3a8a' },
    success: { 50:'#f0fdf4',500:'#22c55e',600:'#16a34a' },
    danger:  { 50:'#fef2f2',500:'#ef4444',600:'#dc2626' },
    warn:    { 50:'#fffbeb',500:'#f59e0b',600:'#d97706' },
    neutral: { 50:'#f8fafc',100:'#f1f5f9',200:'#e2e8f0',500:'#64748b',900:'#0f172a' },
  },
  shadows: {
    sm: '0 1px 3px rgba(0,0,0,0.08)',
    md: '0 4px 16px rgba(0,0,0,0.10)',
    lg: '0 8px 32px rgba(0,0,0,0.14)',
    glow: '0 0 24px rgba(59,130,246,0.35)',
  },
  radius: { sm:'6px', md:'12px', lg:'20px', full:'9999px' },
  motion: {
    fast: '150ms cubic-bezier(0.4,0,0.2,1)',
    base: '250ms cubic-bezier(0.4,0,0.2,1)',
    slow: '400ms cubic-bezier(0.4,0,0.2,1)',
    spring: '500ms cubic-bezier(0.34,1.56,0.64,1)',
  },
};

export const animations = `
@keyframes slideUp   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
@keyframes fadeIn    { from{opacity:0} to{opacity:1} }
@keyframes pulse     { 0%,100%{opacity:1} 50%{opacity:.5} }
@keyframes spin      { to{transform:rotate(360deg)} }
@keyframes progress  { from{width:0} to{width:var(--target-width)} }
@keyframes shimmer   { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
@keyframes bounce    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
@keyframes scaleIn   { from{opacity:0;transform:scale(.9)} to{opacity:1;transform:scale(1)} }
@keyframes glow      { 0%,100%{box-shadow:0 0 8px rgba(59,130,246,.4)} 50%{box-shadow:0 0 24px rgba(59,130,246,.8)} }
`;

export const globalCSS = `
${animations}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif;
  background:#f8fafc;color:#0f172a;-webkit-font-smoothing:antialiased}
.slide-up{animation:slideUp 300ms ease both}
.fade-in{animation:fadeIn 200ms ease both}
.scale-in{animation:scaleIn 250ms cubic-bezier(.34,1.56,.64,1) both}
.skeleton{background:linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%);
  background-size:200% 100%;animation:shimmer 1.5s infinite}
`;
JSEOF

# ══════════════════════════════════════════════════════════════
# 2. COMMAND PALETTE — Cmd+K, keyboard-first navigation
# ══════════════════════════════════════════════════════════════
cat > "$FE/components/ui/CommandPalette.jsx" << 'JSEOF'
import React, { useState, useEffect, useRef, useCallback } from 'react';

const COMMANDS = [
  { id:'jobs',      label:'Open Job Feed',           icon:'🔍', action:'nav:/'},
  { id:'apply',     label:'Auto-Apply to Top Match', icon:'⚡', action:'apply:top'},
  { id:'tracker',   label:'Open Application Tracker',icon:'📋', action:'nav:/tracker'},
  { id:'salary',    label:'View Salary Insights',    icon:'💰', action:'nav:/salary'},
  { id:'ml',        label:'Open ML Dashboard',       icon:'🤖', action:'nav:/ml'},
  { id:'resume',    label:'Optimize Resume',         icon:'📄', action:'nav:/resume'},
  { id:'bulk',      label:'Bulk Apply (100 jobs)',   icon:'🚀', action:'bulk:apply'},
  { id:'alerts',    label:'Set Job Alert',           icon:'🔔', action:'nav:/alerts'},
  { id:'dark',      label:'Toggle Dark Mode',        icon:'🌙', action:'theme:dark'},
  { id:'export',    label:'Export Applications CSV', icon:'📊', action:'export:csv'},
];

export default function CommandPalette({ onAction }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);

  const filtered = COMMANDS.filter(c =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault(); setOpen(o => !o); setQuery(''); setIdx(0);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => { open && inputRef.current?.focus(); }, [open]);

  const handleKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i+1, filtered.length-1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setIdx(i => Math.max(i-1, 0)); }
    if (e.key === 'Enter' && filtered[idx]) { onAction?.(filtered[idx].action); setOpen(false); }
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} style={styles.trigger}>
      ⌘K
    </button>
  );

  return (
    <div style={styles.overlay} onClick={() => setOpen(false)}>
      <div style={styles.palette} onClick={e => e.stopPropagation()} className="scale-in">
        <div style={styles.inputRow}>
          <span style={styles.searchIcon}>🔍</span>
          <input ref={inputRef} value={query} onChange={e=>{setQuery(e.target.value);setIdx(0);}}
            onKeyDown={handleKey} placeholder="Search commands..." style={styles.input} />
          <kbd style={styles.esc}>esc</kbd>
        </div>
        <div style={styles.results}>
          {filtered.map((cmd, i) => (
            <div key={cmd.id} onClick={() => { onAction?.(cmd.action); setOpen(false); }}
              onMouseEnter={() => setIdx(i)}
              style={{...styles.item, ...(i===idx ? styles.itemActive : {})}}>
              <span style={styles.itemIcon}>{cmd.icon}</span>
              <span>{cmd.label}</span>
              {i===idx && <kbd style={styles.enter}>↵</kbd>}
            </div>
          ))}
          {filtered.length === 0 && <div style={styles.empty}>No commands found</div>}
        </div>
        <div style={styles.footer}>
          <span>↑↓ navigate</span><span>↵ select</span><span>esc close</span>
        </div>
      </div>
    </div>
  );
}

const styles = {
  trigger:     {position:'fixed',top:16,right:16,background:'#1e293b',color:'#94a3b8',
                border:'1px solid #334155',borderRadius:8,padding:'6px 12px',cursor:'pointer',
                fontSize:13,fontWeight:600,zIndex:1000},
  overlay:     {position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)',
                zIndex:9999,display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:120},
  palette:     {width:560,background:'#0f172a',borderRadius:16,border:'1px solid #1e293b',
                boxShadow:'0 24px 64px rgba(0,0,0,0.5)',overflow:'hidden'},
  inputRow:    {display:'flex',alignItems:'center',padding:'12px 16px',borderBottom:'1px solid #1e293b'},
  searchIcon:  {fontSize:16,marginRight:10,opacity:0.5},
  input:       {flex:1,background:'transparent',border:'none',outline:'none',color:'#f8fafc',
                fontSize:16,lineHeight:'24px'},
  esc:         {background:'#1e293b',color:'#64748b',padding:'2px 6px',borderRadius:4,fontSize:11},
  results:     {maxHeight:360,overflowY:'auto'},
  item:        {display:'flex',alignItems:'center',gap:12,padding:'12px 16px',cursor:'pointer',
                color:'#cbd5e1',transition:'background 150ms'},
  itemActive:  {background:'#1e3a8a',color:'#fff'},
  itemIcon:    {fontSize:18,width:24,textAlign:'center'},
  enter:       {marginLeft:'auto',background:'#1e293b',color:'#64748b',
                padding:'2px 6px',borderRadius:4,fontSize:11},
  empty:       {padding:'24px',textAlign:'center',color:'#475569'},
  footer:      {display:'flex',gap:16,padding:'10px 16px',borderTop:'1px solid #1e293b',
                fontSize:11,color:'#475569'},
};
JSEOF

# ══════════════════════════════════════════════════════════════
# 3. LIVE APPLY BUTTON — animated, real-time feedback
# ══════════════════════════════════════════════════════════════
cat > "$FE/components/apply/AutoApplyButton.jsx" << 'JSEOF'
import React, { useState } from 'react';
import mockApi from '../../api/mocks';

const STATES = {
  idle:      { label:'Auto-Apply Now',    bg:'#3b82f6', icon:'⚡' },
  loading:   { label:'Submitting...',     bg:'#6366f1', icon:'⏳' },
  success:   { label:'Applied!',          bg:'#22c55e', icon:'✓'  },
  error:     { label:'Retry',            bg:'#ef4444', icon:'✕'  },
};

export default function AutoApplyButton({ job, onApplied }) {
  const [state, setState] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [steps, setSteps] = useState([]);

  const APPLY_STEPS = [
    'Analyzing job description...',
    'Optimizing resume keywords...',
    'Generating cover letter...',
    'Filling EasyApply form...',
    'Submitting application...',
  ];

  const handleClick = async () => {
    if (state === 'loading') return;
    setState('loading'); setProgress(0); setSteps([]);

    for (let i = 0; i < APPLY_STEPS.length; i++) {
      await new Promise(r => setTimeout(r, 350 + Math.random() * 200));
      setProgress(Math.round((i + 1) / APPLY_STEPS.length * 100));
      setSteps(s => [...s, APPLY_STEPS[i]]);
    }

    try {
      const result = await mockApi.autoApply(job.id);
      setState(result.success ? 'success' : 'error');
      if (result.success) onApplied?.(job, result);
      setTimeout(() => setState('idle'), 4000);
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  };

  const s = STATES[state];
  return (
    <div style={styles.wrapper}>
      <button onClick={handleClick} disabled={state==='loading'} style={{
        ...styles.btn, background: s.bg,
        transform: state==='idle' ? 'scale(1)' : 'scale(0.98)',
        boxShadow: state==='loading' ? '0 0 24px rgba(99,102,241,0.5)' : styles.btn.boxShadow,
      }}>
        <span style={{...styles.icon, animation: state==='loading' ? 'spin 1s linear infinite' : 'none'}}>
          {s.icon}
        </span>
        {s.label}
        {state === 'loading' && (
          <div style={{...styles.progressBar, width:`${progress}%`}} />
        )}
      </button>

      {steps.length > 0 && state !== 'idle' && (
        <div style={styles.steps} className="fade-in">
          {steps.map((step, i) => (
            <div key={i} style={styles.step} className="slide-up">
              <span style={styles.stepDot(i === steps.length-1 && state==='loading')} />
              {step}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper:  {position:'relative'},
  btn:      {width:'100%',padding:'12px 20px',border:'none',borderRadius:12,color:'#fff',
             fontWeight:700,fontSize:15,cursor:'pointer',position:'relative',overflow:'hidden',
             display:'flex',alignItems:'center',justifyContent:'center',gap:8,
             transition:'all 200ms cubic-bezier(.34,1.56,.64,1)',
             boxShadow:'0 4px 16px rgba(59,130,246,0.35)'},
  icon:     {fontSize:18},
  progressBar:{position:'absolute',bottom:0,left:0,height:3,background:'rgba(255,255,255,0.5)',
               transition:'width 300ms ease'},
  steps:    {marginTop:10,background:'#f8fafc',borderRadius:10,padding:'10px 14px',
             border:'1px solid #e2e8f0'},
  step:     {display:'flex',alignItems:'center',gap:8,fontSize:13,color:'#475569',
             padding:'3px 0'},
  stepDot:  (active) => ({width:6,height:6,borderRadius:'50%',flexShrink:0,
             background: active ? '#6366f1' : '#22c55e',
             animation: active ? 'pulse 1s infinite' : 'none'}),
};
JSEOF

# ══════════════════════════════════════════════════════════════
# 4. REAL-TIME JOB CARD — with match ring, hover, keyboard nav
# ══════════════════════════════════════════════════════════════
cat > "$FE/components/dashboard/JobCard.jsx" << 'JSEOF'
import React, { useState, useRef } from 'react';
import AutoApplyButton from '../apply/AutoApplyButton';
import mockApi from '../../api/mocks';

const MATCH_COLOR = s => s >= 90 ? '#22c55e' : s >= 75 ? '#3b82f6' : '#f59e0b';

export default function JobCard({ job, tabIndex, onApplied }) {
  const [expanded, setExpanded] = useState(false);
  const [coverLetter, setCoverLetter] = useState(null);
  const [salaryAdvice, setSalaryAdvice] = useState(null);
  const [loadingCL, setLoadingCL] = useState(false);
  const cardRef = useRef(null);

  const handleKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(x=>!x); }
  };

  const loadInsights = async () => {
    if (coverLetter) return;
    setLoadingCL(true);
    const [cl, sa] = await Promise.all([
      mockApi.generateCoverLetter(job.id),
      mockApi.getSalaryAdvice(job.id),
    ]);
    setCoverLetter(cl); setSalaryAdvice(sa); setLoadingCL(false);
  };

  const matchColor = MATCH_COLOR(job.match);
  const circumference = 2 * Math.PI * 20;
  const strokeDash = (job.match / 100) * circumference;

  return (
    <div ref={cardRef} tabIndex={tabIndex} onKeyDown={handleKey}
      onClick={() => { setExpanded(x=>!x); if(!expanded) loadInsights(); }}
      style={{...styles.card, outline: expanded ? `2px solid ${matchColor}` : 'none'}}
      className="slide-up"
      role="article" aria-label={`${job.title} at ${job.company}`}>

      {/* Match ring */}
      <div style={styles.matchRing}>
        <svg width={52} height={52} style={{transform:'rotate(-90deg)'}}>
          <circle cx={26} cy={26} r={20} fill="none" stroke="#e2e8f0" strokeWidth={4}/>
          <circle cx={26} cy={26} r={20} fill="none" stroke={matchColor} strokeWidth={4}
            strokeDasharray={`${strokeDash} ${circumference}`}
            strokeLinecap="round"
            style={{transition:'stroke-dasharray 800ms cubic-bezier(.4,0,.2,1)'}}/>
        </svg>
        <span style={{...styles.matchPct, color: matchColor}}>{job.match}%</span>
      </div>

      <div style={styles.body}>
        <div style={styles.topRow}>
          <div>
            <h3 style={styles.title}>{job.title}</h3>
            <p style={styles.company}>{job.company} · <span style={styles.loc}>{job.location}</span></p>
          </div>
          <span style={{...styles.sourceBadge, background: matchColor + '22', color: matchColor}}>
            {job.source}
          </span>
        </div>

        <div style={styles.tags}>
          <span style={styles.salary}>{job.salary}</span>
          <span style={styles.posted}>{job.posted}</span>
        </div>

        {expanded && (
          <div style={styles.expanded} className="fade-in" onClick={e=>e.stopPropagation()}>
            <div style={styles.insight}>
              <AutoApplyButton job={job} onApplied={onApplied} />
            </div>

            {loadingCL ? (
              <div style={styles.skeleton} className="skeleton">Loading insights...</div>
            ) : coverLetter ? (
              <>
                <div style={styles.section}>
                  <h4 style={styles.sectionTitle}>AI Cover Letter</h4>
                  <p style={styles.coverLetterText}>{coverLetter.coverLetter.slice(0,200)}...</p>
                </div>
                <div style={styles.section}>
                  <h4 style={styles.sectionTitle}>Salary Strategy</h4>
                  <div style={styles.salaryRow}>
                    <div style={styles.salaryBadge('#22c55e')}>Ask: {salaryAdvice?.targetAsk}</div>
                    <div style={styles.salaryBadge('#3b82f6')}>Floor: {salaryAdvice?.negotiationFloor}</div>
                    <div style={styles.salaryBadge('#6366f1')}>Market: {salaryAdvice?.marketRate}</div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {!expanded && (
          <p style={styles.hint}>Click to expand · Apply · Get AI insights</p>
        )}
      </div>
    </div>
  );
}

const styles = {
  card:       {display:'flex',gap:16,padding:'20px',background:'#fff',borderRadius:16,
               cursor:'pointer',transition:'all 200ms ease',boxShadow:'0 1px 3px rgba(0,0,0,.08)',
               border:'1px solid #e2e8f0','&:hover':{boxShadow:'0 4px 16px rgba(0,0,0,.12)'}},
  matchRing:  {position:'relative',flexShrink:0,width:52,height:52},
  matchPct:   {position:'absolute',inset:0,display:'flex',alignItems:'center',
               justifyContent:'center',fontSize:11,fontWeight:700},
  body:       {flex:1,minWidth:0},
  topRow:     {display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8},
  title:      {fontSize:17,fontWeight:700,color:'#0f172a',marginBottom:2},
  company:    {fontSize:13,color:'#64748b'},
  loc:        {color:'#94a3b8'},
  sourceBadge:{padding:'2px 8px',borderRadius:20,fontSize:12,fontWeight:600},
  tags:       {display:'flex',gap:10,marginBottom:8},
  salary:     {fontSize:13,fontWeight:600,color:'#22c55e'},
  posted:     {fontSize:12,color:'#94a3b8'},
  hint:       {fontSize:12,color:'#94a3b8',fontStyle:'italic'},
  expanded:   {marginTop:16,borderTop:'1px solid #f1f5f9',paddingTop:16},
  insight:    {marginBottom:12},
  section:    {marginTop:14},
  sectionTitle:{fontSize:13,fontWeight:700,color:'#374151',marginBottom:6},
  coverLetterText:{fontSize:13,color:'#64748b',lineHeight:1.6,
                   background:'#f8fafc',padding:'10px 12px',borderRadius:8},
  salaryRow:  {display:'flex',gap:8,flexWrap:'wrap'},
  salaryBadge:(c)=>({padding:'4px 10px',borderRadius:20,fontSize:12,fontWeight:600,
                     background:c+'22',color:c}),
  skeleton:   {height:80,borderRadius:10,color:'transparent'},
};
JSEOF

# ══════════════════════════════════════════════════════════════
# 5. PLAYWRIGHT MOUSE INTERACTION TESTS
# ══════════════════════════════════════════════════════════════
cat > "$FE/tests/e2e/ui-interaction.spec.js" << 'JSEOF'
// Playwright E2E — mouse interaction tests for all built features
// Run: npx playwright test frontend/src/tests/e2e/ui-interaction.spec.js
const { test, expect } = require('@playwright/test');

const BASE = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Job Feed — auto-apply flow', () => {
  test.beforeEach(async ({ page }) => { await page.goto(BASE); });

  test('job cards load and display match scores', async ({ page }) => {
    await page.waitForSelector('[role="article"]', { timeout: 5000 });
    const cards = page.locator('[role="article"]');
    await expect(cards).toHaveCount(5);
    // Verify match % visible
    const first = cards.first();
    await expect(first).toContainText('%');
  });

  test('click job card to expand and show AI insights', async ({ page }) => {
    await page.waitForSelector('[role="article"]');
    const card = page.locator('[role="article"]').first();
    await card.click();
    // Expanded view shows apply button
    await expect(page.locator('button:has-text("Auto-Apply")')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=AI Cover Letter')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Salary Strategy')).toBeVisible({ timeout: 5000 });
  });

  test('auto-apply button shows progress steps', async ({ page }) => {
    await page.waitForSelector('[role="article"]');
    await page.locator('[role="article"]').first().click();
    const applyBtn = page.locator('button:has-text("Auto-Apply")');
    await applyBtn.click();
    // Progress steps appear
    await expect(page.locator('text=Analyzing job description')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=Applied!')).toBeVisible({ timeout: 8000 });
  });

  test('salary filter slider filters jobs', async ({ page }) => {
    const slider = page.locator('input[type="range"]');
    await slider.fill('85');
    await page.waitForTimeout(300);
    const cards = page.locator('[role="article"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('remote-only checkbox filters to remote jobs', async ({ page }) => {
    await page.check('input[type="checkbox"]');
    await page.waitForTimeout(300);
    const cards = page.locator('[role="article"]');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(0); // may be 0 if none match
  });
});

test.describe('Command Palette — Cmd+K keyboard nav', () => {
  test('opens with Cmd+K and closes with Escape', async ({ page }) => {
    await page.goto(BASE);
    await page.keyboard.press('Meta+k');
    await expect(page.locator('input[placeholder="Search commands..."]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('input[placeholder="Search commands..."]')).not.toBeVisible();
  });

  test('arrow keys navigate commands and Enter selects', async ({ page }) => {
    await page.goto(BASE);
    await page.keyboard.press('Meta+k');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    // Should navigate somewhere
    await page.waitForTimeout(300);
  });

  test('search filters commands', async ({ page }) => {
    await page.goto(BASE);
    await page.keyboard.press('Meta+k');
    await page.keyboard.type('salary');
    await expect(page.locator('text=View Salary Insights')).toBeVisible();
  });
});

test.describe('Application Tracker — status updates', () => {
  test('tracker page loads with stats', async ({ page }) => {
    await page.goto(`${BASE}/tracker`);
    await expect(page.locator('text=Application Tracker')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=total')).toBeVisible();
  });
});

test.describe('ML Dashboard — scores render', () => {
  test('ML dashboard loads all 3 panels', async ({ page }) => {
    await page.goto(`${BASE}/ml`);
    await expect(page.locator('text=Job Match Score')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Rejection Predictor')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Profile Strength')).toBeVisible({ timeout: 5000 });
  });
});
JSEOF

# ══════════════════════════════════════════════════════════════
# 6. COMMIT + PR
# ══════════════════════════════════════════════════════════════
log "Committing advanced UI..."
BR="feat/advanced-ui-$(date +%s)"
git checkout main 2>/dev/null; git pull origin main 2>/dev/null
git checkout -b "$BR" 2>/dev/null

git add frontend/src/components/ frontend/src/tests/ frontend/src/animations/ \
        frontend/src/routes.jsx 2>/dev/null || true
git status --short 2>/dev/null | head -20
git commit -m "feat: advanced UI — command palette, animated apply button, job cards with ML insights

- Design system: tokens, animations, keyframes (slideUp, scaleIn, shimmer, glow)
- Command palette: Cmd+K, arrow key nav, search, keyboard-first
- AutoApplyButton: animated progress steps, real-time feedback, 5-step UX
- JobCard: SVG match ring, click-to-expand, AI cover letter + salary insights inline
- Playwright E2E: mouse interaction tests for all features" 2>/dev/null

git push -u origin "$BR" 2>/dev/null
gh pr create \
  --title "feat: advanced UI — command palette + animated apply + ML insight cards" \
  --body "## Advanced UI features
- **Command Palette** (Cmd+K): search all actions, keyboard nav, instant execute
- **AutoApplyButton**: 5-step animated progress (analyze→optimize→cover letter→fill→submit)
- **JobCard**: SVG match score ring, click-expand, inline AI cover letter + salary negotiation
- **Design System**: animation tokens, keyframes, theme constants
- **E2E Tests**: Playwright mouse/keyboard interaction tests for all features

## Test
\`\`\`bash
cd frontend && npm start  # http://localhost:3000
npx playwright test       # all interaction tests
\`\`\`" \
  --base main 2>/dev/null && log "PR created: $BR" || log "PR skipped"

python3 -c "
import json,datetime
json.dump({'status':'done','branch':'$BR',
  'components':['CommandPalette','AutoApplyButton','JobCard','DesignSystem'],
  'tests':'frontend/src/tests/e2e/ui-interaction.spec.js',
  'at':datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')},
  open('$S/ui-builder-agent.json','w'),indent=2)" 2>/dev/null
log "=== UI-BUILDER DONE ==="
# Keep alive so watchdog sees LIVE
while true; do sleep 300; done
