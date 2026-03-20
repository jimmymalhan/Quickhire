import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';

const NAV = [
  { path: '/', label: 'Jobs' },
  { path: '/tracker', label: 'Tracker' },
  { path: '/salary', label: 'Salary' },
  { path: '/ml', label: 'AI Match' },
  { path: '/profile', label: 'Profile' },
  { path: '/admin', label: 'Admin' },
];

function Nav() {
  const loc = useLocation();
  return (
    <nav style={{position:'sticky',top:0,zIndex:100,background:'rgba(255,255,255,0.92)',backdropFilter:'blur(20px)',borderBottom:'1px solid #e2e8f0',padding:'0 48px',display:'flex',alignItems:'center',justifyContent:'space-between',height:'52px'}}>
      <span style={{fontWeight:700,fontSize:'20px',color:'#0f172a',letterSpacing:'-0.5px'}}>⚡ Quickhire</span>
      <div style={{display:'flex',gap:'32px'}}>
        {NAV.map(n=><Link key={n.path} to={n.path} style={{textDecoration:'none',fontSize:'14px',fontWeight:500,color:loc.pathname===n.path?'#2563eb':'#374151'}}>{n.label}</Link>)}
      </div>
      <Link to="/profile" style={{background:'#0f172a',color:'#fff',padding:'8px 20px',borderRadius:'20px',textDecoration:'none',fontSize:'14px',fontWeight:600}}>Get Started</Link>
    </nav>
  );
}

function Hero() {
  return (
    <section style={{textAlign:'center',padding:'120px 48px 80px',background:'linear-gradient(180deg,#f8faff 0%,#fff 100%)'}}>
      <div style={{fontSize:'13px',fontWeight:600,color:'#2563eb',marginBottom:'16px',letterSpacing:'1px'}}>AI-POWERED JOB SEARCH</div>
      <h1 style={{fontSize:'64px',fontWeight:700,color:'#0f172a',lineHeight:1.1,marginBottom:'24px',letterSpacing:'-2px'}}>Land your dream job<br/><span style={{color:'#2563eb'}}>automatically.</span></h1>
      <p style={{fontSize:'20px',color:'#64748b',marginBottom:'40px',maxWidth:'560px',margin:'0 auto 40px'}}>Quickhire applies to hundreds of jobs while you sleep. AI matches, auto-fills, and tracks every application.</p>
      <div style={{display:'flex',gap:'16px',justifyContent:'center'}}>
        <Link to="/jobs" style={{background:'#0f172a',color:'#fff',padding:'16px 32px',borderRadius:'12px',textDecoration:'none',fontSize:'17px',fontWeight:600}}>Start Applying Free</Link>
        <Link to="/ml" style={{background:'#fff',color:'#0f172a',padding:'16px 32px',borderRadius:'12px',textDecoration:'none',fontSize:'17px',fontWeight:600,border:'2px solid #e2e8f0'}}>See AI Demo</Link>
      </div>
      <div style={{display:'flex',gap:'48px',justifyContent:'center',marginTop:'64px'}}>
        {[['10,000+','Jobs Applied'],['94%','Match Rate'],['3x','Faster'],['500+','Offers Landed']].map(([n,l])=>(
          <div key={l}><div style={{fontSize:'32px',fontWeight:700,color:'#0f172a'}}>{n}</div><div style={{fontSize:'14px',color:'#94a3b8'}}>{l}</div></div>
        ))}
      </div>
    </section>
  );
}

function JobFeedPage() {
  const jobs = Array.from({length:12},(_,i)=>({id:i+1,title:['Senior Engineer','Product Manager','Data Scientist','Frontend Dev','Backend Dev','DevOps Engineer'][i%6],company:['Google','Apple','Meta','Netflix','Stripe','Airbnb'][i%6],salary:`$${140+i*5}k-$${180+i*5}k`,match:95-i*2,remote:i%2===0,skills:['React','TypeScript','Node.js']}));
  const [applied,setApplied]=useState<number[]>([]);
  return (
    <div style={{padding:'48px',maxWidth:'1200px',margin:'0 auto'}}>
      <h1 style={{fontSize:'36px',fontWeight:700,color:'#0f172a',marginBottom:'8px'}}>Jobs For You</h1>
      <p style={{color:'#64748b',marginBottom:'32px'}}>AI-matched to your profile • Updated every hour</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:'20px'}}>
        {jobs.map(j=>(
          <div key={j.id} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'16px',padding:'24px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'12px'}}>
              <div><div style={{fontWeight:700,fontSize:'16px',color:'#0f172a'}}>{j.title}</div><div style={{color:'#64748b',fontSize:'14px'}}>{j.company}</div></div>
              <div style={{background:'#eff6ff',color:'#2563eb',borderRadius:'20px',padding:'4px 12px',fontWeight:700,fontSize:'14px',height:'fit-content'}}>{j.match}%</div>
            </div>
            <div style={{fontSize:'14px',color:'#374151',marginBottom:'4px'}}>💰 {j.salary}</div>
            <div style={{fontSize:'14px',color:'#374151',marginBottom:'16px'}}>{j.remote?'🌍 Remote':'🏢 On-site'}</div>
            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={()=>setApplied(a=>[...a,j.id])} style={{flex:1,background:applied.includes(j.id)?'#22c55e':'#2563eb',color:'#fff',border:'none',borderRadius:'8px',padding:'10px',fontWeight:600,cursor:'pointer',fontSize:'14px'}}>{applied.includes(j.id)?'✓ Applied':'⚡ Apply'}</button>
              <button style={{padding:'10px 16px',background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:'8px',cursor:'pointer',fontSize:'14px'}}>Save</button>
              <button style={{padding:'10px 16px',background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:'8px',cursor:'pointer',fontSize:'14px'}}>Skip</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrackerPage() {
  const cols=['Applied','Interview','Offer','Rejected'];
  const apps=[{id:1,title:'Senior Engineer',company:'Google',col:'Interview'},{id:2,title:'PM',company:'Apple',col:'Applied'},{id:3,title:'Data Scientist',company:'Meta',col:'Offer'},{id:4,title:'Frontend Dev',company:'Netflix',col:'Applied'},{id:5,title:'Backend Dev',company:'Stripe',col:'Rejected'}];
  return (
    <div style={{padding:'48px',maxWidth:'1400px',margin:'0 auto'}}>
      <h1 style={{fontSize:'36px',fontWeight:700,color:'#0f172a',marginBottom:'32px'}}>Application Tracker</h1>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'16px'}}>
        {cols.map(col=>(
          <div key={col} style={{background:'#f8fafc',borderRadius:'12px',padding:'16px'}}>
            <div style={{fontWeight:700,fontSize:'14px',color:'#374151',marginBottom:'12px',textTransform:'uppercase',letterSpacing:'0.5px'}}>{col} ({apps.filter(a=>a.col===col).length})</div>
            {apps.filter(a=>a.col===col).map(a=>(
              <div key={a.id} style={{background:'#fff',borderRadius:'10px',padding:'16px',marginBottom:'8px',border:'1px solid #e2e8f0'}}>
                <div style={{fontWeight:600,fontSize:'14px',color:'#0f172a'}}>{a.title}</div>
                <div style={{fontSize:'13px',color:'#64748b',marginBottom:'12px'}}>{a.company}</div>
                <div style={{display:'flex',gap:'6px'}}>
                  <button style={{flex:1,fontSize:'12px',padding:'6px',background:'#eff6ff',color:'#2563eb',border:'none',borderRadius:'6px',cursor:'pointer',fontWeight:600}}>Schedule</button>
                  <button style={{flex:1,fontSize:'12px',padding:'6px',background:'#f0fdf4',color:'#16a34a',border:'none',borderRadius:'6px',cursor:'pointer',fontWeight:600}}>Accept</button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function SalaryPage() {
  const roles=[['Senior Engineer','$185k','$160k-$220k',82],['Product Manager','$165k','$140k-$195k',67],['Data Scientist','$175k','$150k-$210k',74]];
  return (
    <div style={{padding:'48px',maxWidth:'900px',margin:'0 auto'}}>
      <h1 style={{fontSize:'36px',fontWeight:700,color:'#0f172a',marginBottom:'8px'}}>Salary Insights</h1>
      <p style={{color:'#64748b',marginBottom:'40px'}}>Real-time market data • AI negotiation coach</p>
      {roles.map(([role,med,range,pct])=>(
        <div key={role} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'16px',padding:'28px',marginBottom:'16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
            <div><div style={{fontWeight:700,fontSize:'18px',color:'#0f172a'}}>{role}</div><div style={{color:'#64748b',fontSize:'14px'}}>Range: {range}</div></div>
            <div style={{textAlign:'right'}}><div style={{fontSize:'28px',fontWeight:700,color:'#0f172a'}}>{med}</div><div style={{fontSize:'13px',color:'#64748b'}}>median</div></div>
          </div>
          <div style={{background:'#f1f5f9',borderRadius:'8px',height:'8px',marginBottom:'16px'}}><div style={{background:'#2563eb',height:'8px',borderRadius:'8px',width:`${pct}%`}}/></div>
          <div style={{display:'flex',gap:'10px'}}>
            <button style={{flex:1,background:'#0f172a',color:'#fff',border:'none',borderRadius:'8px',padding:'12px',fontWeight:600,cursor:'pointer'}}>💬 Get Negotiation Script</button>
            <button style={{padding:'12px 20px',background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:'8px',cursor:'pointer',fontWeight:600}}>Compare</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function MLPage() {
  return (
    <div style={{padding:'48px',maxWidth:'1000px',margin:'0 auto'}}>
      <h1 style={{fontSize:'36px',fontWeight:700,color:'#0f172a',marginBottom:'32px'}}>AI Match Dashboard</h1>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'20px',marginBottom:'24px'}}>
        {[['Match Score','94%','#2563eb'],['Accept Chance','71%','#16a34a'],['Profile Score','88%','#f59e0b']].map(([l,v,c])=>(
          <div key={l} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'16px',padding:'32px',textAlign:'center'}}>
            <div style={{fontSize:'48px',fontWeight:700,color:c}}>{v}</div>
            <div style={{fontSize:'14px',color:'#64748b',marginBottom:'16px'}}>{l}</div>
            <button style={{width:'100%',padding:'10px',background:c,color:'#fff',border:'none',borderRadius:'8px',fontWeight:600,cursor:'pointer'}}>Improve</button>
          </div>
        ))}
      </div>
      <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'16px',padding:'28px'}}>
        <h3 style={{fontWeight:700,marginBottom:'16px'}}>Skills Gap Analysis</h3>
        {[['React','Expert',95],['TypeScript','Advanced',82],['System Design','Intermediate',60],['Kubernetes','Beginner',30]].map(([s,l,p])=>(
          <div key={s} style={{marginBottom:'12px'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}><span style={{fontSize:'14px',fontWeight:500}}>{s}</span><span style={{fontSize:'13px',color:'#64748b'}}>{l}</span></div>
            <div style={{background:'#f1f5f9',borderRadius:'4px',height:'6px'}}><div style={{background:p>70?'#22c55e':p>50?'#f59e0b':'#ef4444',height:'6px',borderRadius:'4px',width:`${p}%`}}/></div>
          </div>
        ))}
        <button style={{marginTop:'16px',width:'100%',padding:'12px',background:'#0f172a',color:'#fff',border:'none',borderRadius:'8px',fontWeight:600,cursor:'pointer'}}>📚 Get Learning Plan</button>
      </div>
    </div>
  );
}

function ProfilePage() {
  const [saved,setSaved]=useState(false);
  return (
    <div style={{padding:'48px',maxWidth:'700px',margin:'0 auto'}}>
      <h1 style={{fontSize:'36px',fontWeight:700,color:'#0f172a',marginBottom:'32px'}}>Your Profile</h1>
      <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'16px',padding:'28px',marginBottom:'20px'}}>
        <h3 style={{fontWeight:700,marginBottom:'16px'}}>Resume</h3>
        <div style={{border:'2px dashed #e2e8f0',borderRadius:'12px',padding:'32px',textAlign:'center',cursor:'pointer'}}>
          <div style={{fontSize:'32px',marginBottom:'8px'}}>📄</div>
          <div style={{fontWeight:600,marginBottom:'4px'}}>Drop resume here or click to upload</div>
          <div style={{fontSize:'13px',color:'#94a3b8'}}>PDF, DOCX up to 5MB</div>
        </div>
      </div>
      <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'16px',padding:'28px',marginBottom:'20px'}}>
        <h3 style={{fontWeight:700,marginBottom:'16px'}}>Skills</h3>
        <div style={{display:'flex',flexWrap:'wrap',gap:'8px',marginBottom:'16px'}}>
          {['React','TypeScript','Node.js','Python','AWS','Docker'].map(s=>(
            <span key={s} style={{background:'#eff6ff',color:'#2563eb',padding:'6px 14px',borderRadius:'20px',fontSize:'14px',fontWeight:500}}>{s} ✕</span>
          ))}
          <button style={{background:'#f8fafc',border:'1px dashed #e2e8f0',color:'#64748b',padding:'6px 14px',borderRadius:'20px',fontSize:'14px',cursor:'pointer'}}>+ Add</button>
        </div>
      </div>
      <button onClick={()=>setSaved(true)} style={{width:'100%',padding:'16px',background:saved?'#22c55e':'#0f172a',color:'#fff',border:'none',borderRadius:'12px',fontWeight:700,fontSize:'16px',cursor:'pointer'}}>{saved?'✓ Saved!':'Save Profile'}</button>
    </div>
  );
}

function AdminPage() {
  return (
    <div style={{padding:'48px',maxWidth:'1200px',margin:'0 auto'}}>
      <h1 style={{fontSize:'36px',fontWeight:700,color:'#0f172a',marginBottom:'32px'}}>Admin Dashboard</h1>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'16px',marginBottom:'24px'}}>
        {[['28','Agents Live','#22c55e'],['164','Tasks Queued','#2563eb'],['94%','CI Pass','#f59e0b'],['0','Blockers','#22c55e']].map(([v,l,c])=>(
          <div key={l} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'12px',padding:'24px',textAlign:'center'}}>
            <div style={{fontSize:'36px',fontWeight:700,color:c}}>{v}</div>
            <div style={{fontSize:'13px',color:'#64748b'}}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'16px',padding:'24px'}}>
        <h3 style={{fontWeight:700,marginBottom:'16px'}}>Agent Fleet</h3>
        {['ui-builder-agent','engine','browser-test-agent','blocker-fix-agent','admin-agent','loop-detector','watchdog','researcher-agent'].map(a=>(
          <div key={a} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'1px solid #f1f5f9'}}>
            <span style={{fontSize:'14px',fontWeight:500}}>{a}</span>
            <span style={{background:'#f0fdf4',color:'#16a34a',padding:'3px 10px',borderRadius:'20px',fontSize:'12px',fontWeight:600}}>LIVE</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Nav/>
      <Routes>
        <Route path="/" element={<><Hero/><JobFeedPage/></>}/>
        <Route path="/jobs" element={<JobFeedPage/>}/>
        <Route path="/tracker" element={<TrackerPage/>}/>
        <Route path="/salary" element={<SalaryPage/>}/>
        <Route path="/ml" element={<MLPage/>}/>
        <Route path="/profile" element={<ProfilePage/>}/>
        <Route path="/admin" element={<AdminPage/>}/>
      </Routes>
    </BrowserRouter>
  );
}
