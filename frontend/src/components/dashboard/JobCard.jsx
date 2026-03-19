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
