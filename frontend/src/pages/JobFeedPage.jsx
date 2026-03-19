import React, { useState, useEffect } from 'react';
import mockApi from '../api/mocks';

export default function JobFeedPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(null);
  const [filters, setFilters] = useState({ minMatch: 70, remote: false });
  const [results, setResults] = useState({});

  useEffect(() => {
    mockApi.getJobs(filters).then(r => { setJobs(r.jobs); setLoading(false); });
  }, [filters]);

  const handleAutoApply = async (job) => {
    setApplying(job.id);
    const r = await mockApi.autoApply(job.id);
    setResults(prev => ({ ...prev, [job.id]: r }));
    setApplying(null);
  };

  if (loading) return <div style={styles.loading}>Scanning LinkedIn, Indeed, Glassdoor...</div>;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Job Feed <span style={styles.badge}>{jobs.length} matches</span></h1>
        <div style={styles.filters}>
          <label><input type="checkbox" checked={filters.remote} onChange={e => setFilters(f=>({...f,remote:e.target.checked}))} /> Remote only</label>
          <label>Min match: <input type="range" min={50} max={95} value={filters.minMatch} onChange={e => setFilters(f=>({...f,minMatch:+e.target.value}))} /> {filters.minMatch}%</label>
        </div>
      </div>
      <div style={styles.grid}>
        {jobs.map(job => (
          <div key={job.id} style={styles.card}>
            <div style={styles.matchBar}>
              <div style={{...styles.matchFill, width: `${job.match}%`, background: job.match > 85 ? '#22c55e' : '#3b82f6'}} />
              <span style={styles.matchPct}>{job.match}% match</span>
            </div>
            <h2 style={styles.jobTitle}>{job.title}</h2>
            <p style={styles.company}>{job.company} · {job.location}</p>
            <p style={styles.salary}>{job.salary}</p>
            <p style={styles.meta}>{job.source} · {job.posted}</p>
            {results[job.id] ? (
              <div style={styles.success}>Applied! Cover letter optimized. Tracking started.</div>
            ) : (
              <button style={styles.applyBtn} onClick={() => handleAutoApply(job)} disabled={applying === job.id}>
                {applying === job.id ? 'Applying...' : 'Auto-Apply Now'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  page: { padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'system-ui' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  title: { fontSize: '28px', fontWeight: 700, color: '#0f172a' },
  badge: { background: '#3b82f6', color: '#fff', borderRadius: '12px', padding: '2px 10px', fontSize: '14px', marginLeft: '8px' },
  filters: { display: 'flex', gap: '16px', alignItems: 'center' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' },
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  matchBar: { height: '6px', background: '#f1f5f9', borderRadius: '3px', marginBottom: '12px', position: 'relative' },
  matchFill: { height: '100%', borderRadius: '3px', transition: 'width 0.3s' },
  matchPct: { position: 'absolute', right: 0, top: '-18px', fontSize: '12px', fontWeight: 600, color: '#64748b' },
  jobTitle: { fontSize: '18px', fontWeight: 600, color: '#0f172a', margin: '0 0 4px' },
  company: { color: '#64748b', margin: '0 0 4px', fontSize: '14px' },
  salary: { color: '#22c55e', fontWeight: 600, margin: '0 0 4px', fontSize: '14px' },
  meta: { color: '#94a3b8', fontSize: '12px', margin: '0 0 12px' },
  applyBtn: { width: '100%', padding: '10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '15px' },
  success: { color: '#22c55e', fontWeight: 600, padding: '10px', background: '#f0fdf4', borderRadius: '8px', textAlign: 'center' },
  loading: { padding: '48px', textAlign: 'center', color: '#64748b', fontSize: '18px' },
};
