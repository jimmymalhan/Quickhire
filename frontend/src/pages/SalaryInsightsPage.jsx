import React, { useState, useEffect } from 'react';
import mockApi from '../api/mocks';

export default function SalaryInsightsPage() {
  const [title, setTitle] = useState('Senior Software Engineer');
  const [data, setData] = useState(null);
  const [advice, setAdvice] = useState(null);

  useEffect(() => {
    mockApi.getSalaryInsights(title).then(setData);
    mockApi.getSalaryAdvice(1).then(setAdvice);
  }, [title]);

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '24px' }}>Salary Insights</h1>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Job title..."
        style={{ padding: '10px 16px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '16px', width: '300px', marginBottom: '24px' }} />
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {[['P25', data.p25], ['Median', data.p50], ['P75', data.p75], ['P90', data.p90]].map(([label, val]) => (
            <div key={label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#22c55e' }}>{val}</div>
              <div style={{ color: '#64748b', fontSize: '13px' }}>{label} · {data.trend}</div>
            </div>
          ))}
        </div>
      )}
      {advice && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ marginTop: 0 }}>Negotiation Script</h3>
          <p style={{ fontStyle: 'italic', color: '#374151' }}>"{advice.script}"</p>
          <p><strong>Target:</strong> {advice.targetAsk} · <strong>Floor:</strong> {advice.negotiationFloor}</p>
        </div>
      )}
    </div>
  );
}
