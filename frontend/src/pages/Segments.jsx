import React, { useEffect, useState } from 'react';
import { getSegments, getScatter, getSegmentInsight } from '../utils/api';
import { Card, SectionHeader, Loader } from '../components/Cards';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, Legend
} from 'recharts';
import { Brain } from 'lucide-react';

const SEG_COLORS = {
  'Champions':           '#00D4AA',
  'Engaged Regulars':    '#4ECDC4',
  'At-Risk Subscribers': '#FFB347',
  'Dormant Churners':    '#FF6B6B',
};

export default function Segments() {
  const [segments, setSegments] = useState([]);
  const [scatter, setScatter] = useState([]);
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState({ seg: null, text: '', loading: false });

  useEffect(() => {
    Promise.all([getSegments(), getScatter(400)])
      .then(([s, sc]) => {
        setSegments(s.data.segments || []);
        setScatter(sc.data.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const fetchInsight = async (segName) => {
    setInsight({ seg: segName, text: '', loading: true });
    try {
      const r = await getSegmentInsight(segName);
      setInsight({ seg: segName, text: r.data.insight, loading: false });
    } catch {
      setInsight({ seg: segName, text: 'Failed to load AI insight. Please check LLM API configuration.', loading: false });
    }
  };

  if (loading) return <Loader text="Loading segments…" />;

  // Group scatter by segment
  const segGroups = {};
  scatter.forEach(d => {
    const s = d.segment || 'Unknown';
    if (!segGroups[s]) segGroups[s] = [];
    segGroups[s].push({ x: d.engagement_score, y: d.avg_recharge_value, prob: d.churn_probability });
  });

  return (
    <div style={{ animation: 'fadeUp 0.4s ease both' }}>
      <SectionHeader title="Customer Segments" sub="K-Means behavioural clustering with churn risk analysis" />

      {/* Segment Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {segments.map(seg => (
          <Card key={seg.segment} style={{ cursor: 'pointer', transition: 'all 0.2s' }}
            onClick={() => fetchInsight(seg.segment)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%', marginTop: 4, flexShrink: 0,
                background: SEG_COLORS[seg.segment] || '#888',
                boxShadow: `0 0 8px ${SEG_COLORS[seg.segment] || '#888'}`,
              }} />
              <span style={{ fontSize: 11, color: '#7A93B4', fontFamily: 'DM Mono, monospace' }}>
                {seg.pct}%
              </span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#E8F0FE', marginBottom: 10, lineHeight: 1.3 }}>
              {seg.segment}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Metric label="Customers" value={seg.count.toLocaleString()} />
              <Metric label="Churn Risk"
                value={`${(seg.avg_churn_prob * 100).toFixed(1)}%`}
                color={seg.avg_churn_prob > 0.6 ? '#FF6B6B' : '#00D4AA'} />
              <Metric label="Avg $" value={`$${seg.avg_recharge_value.toFixed(0)}`} />
              <Metric label="Active Days" value={seg.avg_active_days.toFixed(0)} />
              <Metric label="Days Inactive" value={seg.avg_days_since.toFixed(0)} />
            </div>
            <button style={{
              marginTop: 12, width: '100%', padding: '6px', borderRadius: 6,
              background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)',
              color: '#00D4AA', fontSize: 11, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: 5,
            }}>
              <Brain size={12} /> AI Insight
            </button>
          </Card>
        ))}
      </div>

      {/* AI Insight Panel */}
      {insight.seg && (
        <Card style={{ marginBottom: 24, borderColor: 'rgba(0,212,170,0.25)' }} glow>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Brain size={16} color="#00D4AA" />
            <span style={{ fontWeight: 600, color: '#00D4AA' }}>AI Insight: {insight.seg}</span>
          </div>
          {insight.loading
            ? <Loader text="Generating AI insight…" />
            : <div style={{ color: '#CBD5E0', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {insight.text}
              </div>
          }
        </Card>
      )}

      {/* Scatter Plot */}
      <Card>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#E8F0FE', marginBottom: 14 }}>
          🎯 Customer Behaviour Scatter — Engagement Score vs Recharge Value
        </div>
        <ResponsiveContainer width="100%" height={340}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="x" name="Engagement Score" tick={tick} axisLine={false} tickLine={false} type="number" domain={[0,1]} />
            <YAxis dataKey="y" name="Avg $" tick={tick} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ stroke: 'rgba(0,212,170,0.3)' }}
              content={({ payload }) => {
                if (!payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div style={{ background: '#0D1520', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ fontSize: 12, color: '#00D4AA', marginBottom: 4 }}>Customer</div>
                    <div style={{ fontSize: 11, color: '#7A93B4' }}>Engagement: {d.x?.toFixed(3)}</div>
                    <div style={{ fontSize: 11, color: '#7A93B4' }}>Avg $: {d.y?.toFixed(0)}</div>
                    <div style={{ fontSize: 11, color: '#FF6B6B' }}>Churn: {((d.prob||0)*100).toFixed(1)}%</div>
                  </div>
                );
              }}
            />
            <Legend formatter={(v) => <span style={{ color: '#7A93B4', fontSize: 11 }}>{v}</span>} />
            {Object.entries(segGroups).map(([seg, pts]) => (
              <Scatter key={seg} name={seg} data={pts} fill={SEG_COLORS[seg] || '#888'} opacity={0.7} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

function Metric({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <span style={{ color: '#7A93B4' }}>{label}</span>
      <span style={{ color: color || '#E8F0FE', fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

const tick = { fill: '#7A93B4', fontSize: 11, fontFamily: 'DM Mono, monospace' };
