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
