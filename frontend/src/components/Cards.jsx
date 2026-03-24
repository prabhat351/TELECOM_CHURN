import React from 'react';

export function Card({ children, style, className, glow }) {
  return (
    <div style={{
      background: '#FFFFFF',
      border: `1px solid ${glow ? '#0066CC' : '#E0E6ED'}`,
      borderRadius: 14,
      padding: 20,
      boxShadow: glow
        ? '0 0 30px rgba(0, 102, 204, 0.15), 0 4px 24px rgba(0,0,0,0.08)'
        : '0 2px 8px rgba(0,0,0,0.08)',
      ...style,
    }} className={className}>
      {children}
    </div>
  );
}

export function KPICard({ label, value, sub, icon: Icon, color = '#0066CC', trend }) {
  return (
    <Card style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: '#556B82', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, fontFamily: 'DM Mono, monospace' }}>
            {label}
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color, fontFamily: 'Syne, sans-serif', lineHeight: 1 }}>
            {value}
          </div>
          {sub && <div style={{ fontSize: 11, color: '#7A93B4', marginTop: 5 }}>{sub}</div>}
          {trend !== undefined && (
            <div style={{ fontSize: 12, color: trend >= 0 ? '#00A896' : '#E63946', marginTop: 4 }}>
              {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%
            </div>
          )}
        </div>
        {Icon && (
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: `${color}12`,
            border: `1px solid ${color}25`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={18} color={color} />
          </div>
        )}
      </div>
    </Card>
  );
}

export function SectionHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 20, fontWeight: 800, color: '#1A2332', margin: 0 }}>
        {title}
      </h2>
      {sub && <p style={{ color: '#556B82', fontSize: 13, marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

export function Badge({ label, color = '#0066CC' }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 9px', borderRadius: 20,
      background: `${color}12`, color,
      fontSize: 11, fontWeight: 600, fontFamily: 'DM Mono, monospace',
      border: `1px solid ${color}25`,
    }}>
      {label}
    </span>
  );
}

export function Loader({ text = 'Processing…' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200, gap: 16 }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        border: '3px solid rgba(0, 102, 204, 0.2)',
        borderTopColor: '#0066CC',
        animation: 'spin-slow 0.8s linear infinite',
      }} />
      <div style={{ color: '#556B82', fontSize: 13, fontFamily: 'DM Mono, monospace' }}>{text}</div>
    </div>
  );
}

export function RiskBadge({ level }) {
  const colors = {
    Critical: '#E63946', High: '#FF9500', Medium: '#0096D1', Low: '#00A896',
  };
  const c = colors[level] || '#888';
  return <Badge label={level} color={c} />;
}
