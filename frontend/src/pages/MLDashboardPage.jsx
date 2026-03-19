import React, { useState, useEffect } from 'react';
import mockApi from '../api/mocks';

export default function MLDashboardPage() {
  const [data, setData] = useState({});

  useEffect(() => {
    Promise.all([
      mockApi.getMatchScore(1),
      mockApi.predictRejection(1),
      mockApi.optimizeResume(1),
      mockApi.getProfileScore(),
      mockApi.getSkillsGap(1),
    ]).then(([match, rejection, resume, profile, skills]) => {
      setData({ match, rejection, resume, profile, skills });
    });
  }, []);

  const score = (val, max = 100, color = '#3b82f6') => (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span>{val}%</span>
      </div>
      <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px' }}>
        <div style={{ height: '100%', width: `${val}%`, background: color, borderRadius: '4px', transition: 'width 0.5s' }} />
      </div>
    </div>
  );

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '24px' }}>ML Intelligence Dashboard</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
        {data.match && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ marginTop: 0, color: '#0f172a' }}>Job Match Score</h3>
            {score(data.match.score, 100, '#22c55e')}
            <p style={{ color: '#64748b', fontSize: '13px' }}>Recommendation: <strong>{data.match.recommendation}</strong></p>
            {Object.entries(data.match.breakdown || {}).map(([k, v]) => (
              <div key={k}><small style={{ color: '#94a3b8' }}>{k}</small>{score(v, 100, '#93c5fd')}</div>
            ))}
          </div>
        )}
        {data.rejection && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ marginTop: 0, color: '#0f172a' }}>Rejection Predictor</h3>
            {score(Math.round(data.rejection.probability * 100), 100, '#ef4444')}
            <p style={{ color: '#64748b', fontSize: '13px' }}>Risk: {Math.round(data.rejection.probability * 100)}% · Confidence: {Math.round(data.rejection.confidence * 100)}%</p>
            <ul style={{ paddingLeft: '16px', color: '#64748b', fontSize: '13px' }}>
              {data.rejection.riskFactors?.map(r => <li key={r}>{r}</li>)}
            </ul>
          </div>
        )}
        {data.profile && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ marginTop: 0, color: '#0f172a' }}>Profile Strength</h3>
            {score(data.profile.score, 100, '#f59e0b')}
            {Object.entries(data.profile.sections || {}).map(([k, v]) => (
              <div key={k}><small style={{ color: '#94a3b8' }}>{k}</small>{score(v, 100, '#fcd34d')}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
