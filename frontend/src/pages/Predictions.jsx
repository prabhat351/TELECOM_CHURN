import React, { useEffect, useState } from 'react';
import { getPredictions } from '../utils/api';
import { Card, SectionHeader, Loader, RiskBadge } from '../components/Cards';
import { Search, Filter } from 'lucide-react';

const RISK_LEVELS = ['All', 'Critical', 'High', 'Medium', 'Low'];
const SEGMENTS = ['All', 'Champions', 'Engaged Regulars', 'At-Risk Subscribers', 'Dormant Churners'];

export default function Predictions() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [risk, setRisk] = useState('All');
  const [segment, setSegment] = useState('All');
  const [search, setSearch] = useState('');

  const fetchData = () => {
    setLoading(true);
    getPredictions({
      limit: 500,
      risk: risk === 'All' ? undefined : risk,
      segment: segment === 'All' ? undefined : segment,
    })
      .then(r => { setData(r.data.data || []); setTotal(r.data.total || 0); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [risk, segment]);

  const filtered = data.filter(r =>
    !search || r.Customer_id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ animation: 'fadeUp 0.4s ease both' }}>
      <SectionHeader title="Customer Risk Analysis" sub="Rule-based behavioural risk scoring across all customers" />

      {/* Filters */}
      <div style={filterBar}>
        <div style={searchWrap}>
          <Search size={14} color="#7A93B4" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search customer ID…"
            style={searchInput}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <FilterGroup label="Risk" options={RISK_LEVELS} value={risk} onChange={setRisk} />
          <FilterGroup label="Segment" options={SEGMENTS} value={segment} onChange={setSegment} />
        </div>
      </div>

      <Card style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#7A93B4' }}>
            Showing <strong style={{ color: '#00D4AA' }}>{filtered.length}</strong> of {total.toLocaleString()} customers
          </span>
        </div>

        {loading ? <Loader text="Loading risk scores…" /> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  {['Customer ID', 'Risk Score', 'Risk Level', 'Segment', 'Days Inactive', 'Frequency', 'Avg $', 'Active Days', 'Engagement'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,212,170,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ ...tdStyle, fontFamily: 'DM Mono, monospace', fontSize: 11, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.Customer_id}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, minWidth: 50 }}>
                          <div style={{
                            height: '100%', borderRadius: 2,
                            width: `${((row.churn_probability || 0) * 100).toFixed(0)}%`,
                            background: probColor(row.churn_probability),
                            transition: 'width 0.3s',
                          }} />
                        </div>
                        <span style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: probColor(row.churn_probability) }}>
                          {((row.churn_probability || 0) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td style={tdStyle}><RiskBadge level={row.risk_level} /></td>
                    <td style={{ ...tdStyle, fontSize: 12, color: '#7A93B4', maxWidth: 140, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.segment}</td>
                    <td style={{ ...tdStyle, fontFamily: 'DM Mono, monospace', textAlign: 'center' }}>{row.days_since_last_recharge}</td>
                    <td style={{ ...tdStyle, fontFamily: 'DM Mono, monospace', textAlign: 'center' }}>{row.recharge_frequency}</td>
                    <td style={{ ...tdStyle, fontFamily: 'DM Mono, monospace' }}>${row.avg_recharge_value?.toFixed(0)}</td>
                    <td style={{ ...tdStyle, fontFamily: 'DM Mono, monospace', textAlign: 'center' }}>{row.active_days_30d}</td>
                    <td style={tdStyle}>
                      <span style={{ color: engColor(row.engagement_score), fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                        {(row.engagement_score || 0).toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function FilterGroup({ label, options, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 11, color: '#7A93B4', fontFamily: 'DM Mono, monospace' }}>{label}:</span>
      {options.map(o => (
        <button key={o} onClick={() => onChange(o)} style={{
          padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
          fontSize: 11, fontFamily: 'DM Mono, monospace',
          background: value === o ? 'rgba(0,212,170,0.15)' : 'rgba(255,255,255,0.05)',
          color: value === o ? '#00D4AA' : '#7A93B4',
          transition: 'all 0.15s',
        }}>{o}</button>
      ))}
    </div>
  );
}

const probColor = (p) => {
  if (!p) return '#888';
  if (p >= 0.8) return '#FF6B6B';
  if (p >= 0.6) return '#FFB347';
  if (p >= 0.4) return '#74B9FF';
  return '#00D4AA';
};
const engColor = (e) => {
  if (!e) return '#888';
  if (e >= 0.7) return '#00D4AA';
  if (e >= 0.4) return '#74B9FF';
  return '#FFB347';
};

const filterBar = { display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' };
const searchWrap = {
  display: 'flex', alignItems: 'center', gap: 8,
  background: '#0D1520', border: '1px solid rgba(0,212,170,0.15)',
  borderRadius: 8, padding: '7px 12px', minWidth: 220,
};
const searchInput = {
  background: 'none', border: 'none', outline: 'none',
  color: '#E8F0FE', fontSize: 13, fontFamily: 'DM Mono, monospace', flex: 1,
};
const tableStyle = { width: '100%', borderCollapse: 'collapse' };
const thStyle = {
  padding: '8px 10px', textAlign: 'left', fontSize: 11,
  color: '#7A93B4', fontFamily: 'DM Mono, monospace', letterSpacing: 0.5,
  borderBottom: '1px solid rgba(255,255,255,0.06)', fontWeight: 500,
  textTransform: 'uppercase',
};
const tdStyle = { padding: '10px 10px', fontSize: 13, color: '#E8F0FE', verticalAlign: 'middle' };
