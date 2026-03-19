import React, { useState, useEffect } from 'react';
import mockApi from '../api/mocks';

const STATUS_COLOR = { applied: '#3b82f6', interview: '#f59e0b', offer: '#22c55e', rejected: '#ef4444' };
const STATUS_LABEL = { applied: 'Applied', interview: 'Interview', offer: 'Offer', rejected: 'Rejected' };

export default function ApplicationTrackerPage() {
  const [data, setData] = useState(null);

  useEffect(() => { mockApi.getApplications().then(setData); }, []);

  if (!data) return <div style={{ padding: '48px', textAlign: 'center' }}>Loading applications...</div>;

  const { applications, stats } = data;

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', marginBottom: '24px' }}>Application Tracker</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '32px' }}>
        {Object.entries(stats).map(([k, v]) => (
          <div key={k} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#0f172a' }}>{v}</div>
            <div style={{ color: '#64748b', fontSize: '13px', textTransform: 'capitalize' }}>{k}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {applications.map(app => (
          <div key={app.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>{app.job}</h3>
              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>Applied {app.appliedAt} · {app.nextStep || 'No action needed'}</p>
            </div>
            <span style={{ padding: '4px 12px', borderRadius: '20px', fontWeight: 600, fontSize: '13px', background: STATUS_COLOR[app.status] + '22', color: STATUS_COLOR[app.status] }}>
              {STATUS_LABEL[app.status]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
