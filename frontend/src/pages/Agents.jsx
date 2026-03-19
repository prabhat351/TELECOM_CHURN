import React, { useEffect, useState } from 'react';
import { getAgentActions } from '../utils/api';
import { Card, SectionHeader, Loader, RiskBadge } from '../components/Cards';
import { Bot, Zap, AlertTriangle, CheckCircle } from 'lucide-react';

export default function Agents() {
  const [actions, setActions] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    getAgentActions(200)
      .then(r => { setActions(r.data.actions || []); setSummary(r.data.summary || {}); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'All' ? actions : actions.filter(a => a.priority === filter);

  const priorityColor = { Critical: '#FF6B6B', High: '#FFB347', Medium: '#74B9FF', Low: '#00D4AA' };

  return (
    <div style={{ animation: 'fadeUp 0.4s ease both' }}>
      <SectionHeader title="AI Agent Actions" sub="Automated retention campaigns and personalised interventions" />

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Actions', val: summary.total_actions, color: '#E8F0FE', icon: Bot },
          { label: 'Critical', val: summary.critical, color: '#FF6B6B', icon: AlertTriangle },
          { label: 'High', val: summary.high, color: '#FFB347', icon: Zap },
          { label: 'Medium', val: summary.medium, color: '#74B9FF', icon: Zap },
          { label: 'Campaigns', val: summary.retention_campaigns_triggered, color: '#00D4AA', icon: CheckCircle },
        ].map(({ label, val, color, icon: Icon }) => (
          <Card key={label} style={{ textAlign: 'center', padding: '16px 12px' }}>
            <Icon size={20} color={color} style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 24, fontWeight: 800, color, fontFamily: 'Syne, sans-serif' }}>{val || 0}</div>
            <div style={{ fontSize: 11, color: '#7A93B4', marginTop: 3, fontFamily: 'DM Mono, monospace' }}>{label}</div>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['All', 'Critical', 'High', 'Medium', 'Low'].map(p => (
          <button key={p} onClick={() => setFilter(p)} style={{
            padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12,
            background: filter === p ? (priorityColor[p] || 'rgba(0,212,170,0.2)') + '25' : 'rgba(255,255,255,0.04)',
            color: filter === p ? (priorityColor[p] || '#00D4AA') : '#7A93B4',
            border: `1px solid ${filter === p ? (priorityColor[p] || '#00D4AA') + '40' : 'transparent'}`,
            transition: 'all 0.15s', fontFamily: 'DM Mono, monospace',
          }}>
            {p}
          </button>
        ))}
      </div>

      {loading ? <Loader text="Loading agent actions…" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.slice(0, 100).map((action, i) => (
            <Card key={i} style={{ padding: '14px 18px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr 1fr', gap: 16, alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 10, color: '#7A93B4', fontFamily: 'DM Mono, monospace', marginBottom: 2 }}>CUSTOMER</div>
                  <div style={{ fontSize: 12, color: '#E8F0FE', fontFamily: 'DM Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {action.customer_id}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <RiskBadge level={action.priority} />
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, color: '#7A93B4', fontFamily: 'DM Mono, monospace', marginBottom: 3 }}>ACTION</div>
                  <div style={{ fontSize: 12, color: '#E8F0FE', fontWeight: 600 }}>{action.action_type}</div>
                  <div style={{ fontSize: 11, color: '#7A93B4', marginTop: 3 }}>{action.trigger_reason}</div>
                </div>

                <div>
                  <div style={{ fontSize: 10, color: '#7A93B4', fontFamily: 'DM Mono, monospace', marginBottom: 3 }}>OFFER</div>
                  <div style={{ fontSize: 12, color: '#4ECDC4' }}>{action.recommended_offer}</div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: '#7A93B4', fontFamily: 'DM Mono, monospace', marginBottom: 3 }}>CHURN PROB</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: priorityColor[action.priority] || '#E8F0FE', fontFamily: 'Syne, sans-serif' }}>
                    {((action.churn_probability || 0) * 100).toFixed(1)}%
                  </div>
                  <div style={{ fontSize: 10, color: '#00D4AA', marginTop: 2 }}>{action.estimated_impact}</div>
                </div>
              </div>
            </Card>
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#7A93B4' }}>No actions for this priority level.</div>
          )}
        </div>
      )}
    </div>
  );
}
