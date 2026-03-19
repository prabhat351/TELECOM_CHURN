import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, TrendingUp, Users, Brain,
  Bot, BarChart3, MessageSquare, Activity, ChevronRight, FlaskConical
} from 'lucide-react';

const NAV = [
  // { to: '/',           icon: LayoutDashboard, label: 'Overview',        badge: null },
  { to: '/trends',     icon: TrendingUp,      label: 'Monthly Trends',  badge: null },
  { to: '/predictions',icon: Activity,        label: 'Churn Predictions', badge: 'ML' },
  { to: '/segments',   icon: Users,           label: 'Segments',        badge: null },
  { to: '/model',      icon: BarChart3,       label: 'Model Analytics', badge: null },
  { to: '/agents',     icon: Bot,             label: 'AI Agents',       badge: 'AI' },
  { to: '/chat',       icon: MessageSquare,   label: 'AI Assistant',    badge: 'RAG' },
  { to: '/analyst',    icon: FlaskConical,    label: 'Data Analyst',    badge: 'EDA' },
];

export default function Sidebar({ status }) {
  return (
    <aside style={styles.sidebar}>
      {/* Logo */}
      <div style={styles.logo}>
        <div style={styles.logoIcon}>
          <Brain size={22} color="#00D4AA" />
        </div>
        <div>
          <div style={styles.logoTitle}>TeleChurn</div>
          <div style={styles.logoSub}>AI Analytics</div>
        </div>
      </div>

      {/* Status pill */}
      <div style={styles.statusPill}>
        <span style={{
          ...styles.dot,
          background: status?.ready ? '#00D4AA' : '#FFB347',
          boxShadow: status?.ready ? '0 0 8px #00D4AA' : '0 0 8px #FFB347',
        }} />
        <span style={styles.statusText}>
          {status?.ready ? `${status.total_customers?.toLocaleString()} Customers` : 'Loading…'}
        </span>
      </div>

      {/* Nav */}
      <nav style={styles.nav}>
        {NAV.map(({ to, icon: Icon, label, badge }) => (
          <NavLink key={to} to={to} end={to === '/'} style={({ isActive }) => ({
            ...styles.link,
            ...(isActive ? styles.linkActive : {}),
          })}>
            {({ isActive }) => (
              <>
                <Icon size={17} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.7 }} />
                <span style={{ flex: 1 }}>{label}</span>
                {badge && <span style={styles.badge}>{badge}</span>}
                {isActive && <ChevronRight size={13} style={{ opacity: 0.5 }} />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div style={styles.footer}>
        <div style={styles.footerLine}>Powered by</div>
        <div style={styles.footerBadges}>
          <span style={styles.techBadge}>XGBoost</span>
          <span style={styles.techBadge}>LightGBM</span>
          <span style={styles.techBadge}>ChromaDB</span>
          <span style={styles.techBadge}>RAG</span>
        </div>
      </div>
    </aside>
  );
}

const styles = {
  sidebar: {
    width: 230,
    minHeight: '100vh',
    background: '#0A1220',
    borderRight: '1px solid rgba(0,212,170,0.1)',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 14px',
    flexShrink: 0,
  },
  logo: {
    display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28,
    paddingLeft: 4,
  },
  logoIcon: {
    width: 40, height: 40, borderRadius: 10,
    background: 'rgba(0,212,170,0.12)',
    border: '1px solid rgba(0,212,170,0.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, color: '#E8F0FE', lineHeight: 1 },
  logoSub:   { fontSize: 11, color: '#00D4AA', fontFamily: 'DM Mono, monospace', marginTop: 2 },
  statusPill: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.12)',
    borderRadius: 20, padding: '6px 12px', marginBottom: 24,
  },
  dot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  statusText: { fontSize: 12, color: '#7A93B4', fontFamily: 'DM Mono, monospace' },
  nav: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1 },
  link: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 12px', borderRadius: 8,
    color: '#7A93B4', textDecoration: 'none', fontSize: 13, fontWeight: 500,
    transition: 'all 0.15s',
  },
  linkActive: {
    background: 'rgba(0,212,170,0.1)', color: '#00D4AA',
    border: '1px solid rgba(0,212,170,0.2)',
  },
  badge: {
    fontSize: 9, fontWeight: 700, padding: '2px 6px',
    borderRadius: 10, background: 'rgba(0,212,170,0.15)',
    color: '#00D4AA', fontFamily: 'DM Mono, monospace', letterSpacing: 0.5,
  },
  footer: { borderTop: '1px solid rgba(0,212,170,0.08)', paddingTop: 16, marginTop: 8 },
  footerLine: { fontSize: 10, color: '#3D5266', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  footerBadges: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  techBadge: {
    fontSize: 9, padding: '2px 6px', borderRadius: 4,
    background: 'rgba(255,255,255,0.04)', color: '#3D5266', border: '1px solid rgba(255,255,255,0.06)',
  },
};
