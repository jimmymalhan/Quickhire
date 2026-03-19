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
