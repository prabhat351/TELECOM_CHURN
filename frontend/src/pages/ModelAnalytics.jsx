import React, { useEffect, useState } from 'react';
import { getModelMetrics, getCorrelation } from '../utils/api';
import { Card, SectionHeader, Loader, Badge } from '../components/Cards';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Legend
} from 'recharts';

export default function ModelAnalytics() {
  const [metrics, setMetrics] = useState(null);
  const [corr, setCorr] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getModelMetrics(), getCorrelation()])
      .then(([m, c]) => { setMetrics(m.data); setCorr(c.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader text="Loading model analytics…" />;

  const fiData = Object.entries(metrics?.feature_importance || {})
    .slice(0, 12)
    .map(([name, val]) => ({ name: name.replace(/_/g, ' '), value: +(val * 100).toFixed(2) }));

  const radarData = metrics?.metrics?.map(m => ({
    subject: m.model_name,
    Accuracy: +(m.accuracy * 100).toFixed(1),
    Precision: +(m.precision * 100).toFixed(1),
    Recall: +(m.recall * 100).toFixed(1),
    F1: +(m.f1 * 100).toFixed(1),
    'ROC-AUC': +(m.roc_auc * 100).toFixed(1),
  })) || [];

  return (
    <div style={{ animation: 'fadeUp 0.4s ease both' }}>
      <SectionHeader title="Model Analytics" sub="XGBoost vs LightGBM vs RandomForest evaluation" />

      {/* Best model banner */}
      <Card style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }} glow>
        <div>
          <div style={{ fontSize: 11, color: '#7A93B4', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'DM Mono, monospace' }}>Best Model</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#00D4AA', fontFamily: 'Syne, sans-serif' }}>
            {metrics?.best_model}
          </div>
        </div>
        <div style={divider} />
        <StatBox label="Train Size" value={metrics?.train_size?.toLocaleString()} />
        <StatBox label="Test Size" value={metrics?.test_size?.toLocaleString()} />
        <StatBox label="Churn Rate" value={`${((metrics?.churn_rate || 0)*100).toFixed(1)}%`} color="#FF6B6B" />
      </Card>

      {/* Model metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        {metrics?.metrics?.map(m => (
          <Card key={m.model_name}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: '#E8F0FE' }}>{m.model_name}</span>
              {m.model_name === metrics.best_model && <Badge label="BEST" color="#00D4AA" />}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { k: 'Accuracy', v: m.accuracy }, { k: 'Precision', v: m.precision },
                { k: 'Recall', v: m.recall }, { k: 'F1 Score', v: m.f1 },
                { k: 'ROC-AUC', v: m.roc_auc }, { k: 'CV Score', v: m.cv_score_mean },
              ].map(({ k, v }) => (
                <div key={k} style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: '#7A93B4', marginBottom: 3, fontFamily: 'DM Mono, monospace' }}>{k}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: scoreColor(v), fontFamily: 'Syne, sans-serif' }}>
                    {(v * 100).toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: '#7A93B4', fontFamily: 'DM Mono, monospace' }}>
              CV: {(m.cv_score_mean*100).toFixed(1)}% ± {(m.cv_score_std*100).toFixed(1)}%
            </div>
          </Card>
        ))}
      </div>

      {/* Feature importance + Correlation */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        <Card>
          <div style={chartTitle}>🏆 Feature Importance (Top 12)</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={fiData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis type="number" tick={tick} axisLine={false} tickLine={false} unit="%" />
              <YAxis dataKey="name" type="category" tick={{ ...tick, fontSize: 10 }} axisLine={false} tickLine={false} width={130} />
              <Tooltip content={({ active, payload }) => active && payload?.length ? (
                <div style={{ background: '#0D1520', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ color: '#00D4AA', fontSize: 12 }}>{payload[0]?.payload?.name}</div>
                  <div style={{ color: '#E8F0FE', fontFamily: 'DM Mono, monospace' }}>{payload[0]?.value?.toFixed(2)}%</div>
                </div>
              ) : null} />
              <Bar dataKey="value" fill="#00D4AA" radius={[0,3,3,0]}
                background={{ fill: 'rgba(255,255,255,0.02)', radius: 3 }} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Radar */}
        <Card>
          <div style={chartTitle}>📊 Model Comparison Radar</div>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={[
              { metric: 'Accuracy', ...Object.fromEntries(metrics?.metrics?.map(m => [m.model_name, +(m.accuracy*100).toFixed(1)]) || []) },
              { metric: 'Precision', ...Object.fromEntries(metrics?.metrics?.map(m => [m.model_name, +(m.precision*100).toFixed(1)]) || []) },
              { metric: 'Recall', ...Object.fromEntries(metrics?.metrics?.map(m => [m.model_name, +(m.recall*100).toFixed(1)]) || []) },
              { metric: 'F1 Score', ...Object.fromEntries(metrics?.metrics?.map(m => [m.model_name, +(m.f1*100).toFixed(1)]) || []) },
              { metric: 'ROC-AUC', ...Object.fromEntries(metrics?.metrics?.map(m => [m.model_name, +(m.roc_auc*100).toFixed(1)]) || []) },
            ]}>
              <PolarGrid stroke="rgba(255,255,255,0.08)" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: '#7A93B4', fontSize: 11 }} />
              <PolarRadiusAxis domain={[50, 100]} tick={{ fill: '#7A93B4', fontSize: 9 }} />
              {metrics?.metrics?.map((m, i) => (
                <Radar key={m.model_name} dataKey={m.model_name}
                  stroke={['#00D4AA', '#4ECDC4', '#FFB347'][i]}
                  fill={['#00D4AA', '#4ECDC4', '#FFB347'][i]}
                  fillOpacity={0.15} strokeWidth={2} />
              ))}
              <Legend formatter={v => <span style={{ color: '#7A93B4', fontSize: 11 }}>{v}</span>} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Correlation Heatmap */}
      {corr && <CorrelationHeatmap corr={corr} />}
    </div>
  );
}

function CorrelationHeatmap({ corr }) {
  const { columns, matrix } = corr;
  const getColor = (v) => {
    if (v > 0.7) return '#00D4AA';
    if (v > 0.4) return '#4ECDC4';
    if (v > 0.1) return '#74B9FF';
    if (v > -0.1) return '#3D5266';
    if (v > -0.4) return '#FFB347';
    return '#FF6B6B';
  };
  return (
    <Card style={{ marginTop: 16, overflowX: 'auto' }}>
      <div style={chartTitle}>🌡️ Feature Correlation Matrix</div>
      <div style={{ display: 'grid', gridTemplateColumns: `80px repeat(${columns.length}, 1fr)`, gap: 2, minWidth: 600 }}>
        <div />
        {columns.map(c => (
          <div key={c} style={{ fontSize: 9, color: '#7A93B4', padding: '2px 0', textAlign: 'center', fontFamily: 'DM Mono, monospace', transform: 'rotate(-30deg)', transformOrigin: 'bottom left', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: 60 }}>
            {c.replace(/_/g, ' ')}
          </div>
        ))}
        {matrix.map((row, i) => (
          <React.Fragment key={i}>
            <div style={{ fontSize: 9, color: '#7A93B4', padding: '4px 4px', textAlign: 'right', fontFamily: 'DM Mono, monospace', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              {columns[i]?.replace(/_/g, ' ')}
            </div>
            {row.map((v, j) => (
              <div key={j} style={{
                background: `${getColor(v)}${Math.abs(v) > 0.5 ? '60' : '25'}`,
                borderRadius: 3, padding: '6px 0', textAlign: 'center',
                fontSize: 9, color: Math.abs(v) > 0.3 ? '#E8F0FE' : '#7A93B4',
                fontFamily: 'DM Mono, monospace',
              }}>
                {v.toFixed(2)}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </Card>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: '#7A93B4', fontFamily: 'DM Mono, monospace' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || '#E8F0FE', fontFamily: 'Syne, sans-serif' }}>{value}</div>
    </div>
  );
}

const divider = { width: 1, height: 40, background: 'rgba(255,255,255,0.08)' };
const scoreColor = (v) => v >= 0.8 ? '#00D4AA' : v >= 0.6 ? '#74B9FF' : '#FFB347';
const tick = { fill: '#7A93B4', fontSize: 11, fontFamily: 'DM Mono, monospace' };
const chartTitle = { fontSize: 13, fontWeight: 600, color: '#E8F0FE', marginBottom: 14 };
