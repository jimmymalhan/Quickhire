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
