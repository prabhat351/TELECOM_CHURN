import React, { useEffect, useState } from 'react';
import { getTrends } from '../utils/api';
import { Card, SectionHeader, Loader } from '../components/Cards';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts';

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Sort months so Dec 2024 appears first, then Jan–May 2025
// Dec = month 12 → assign sort order 0; Jan=1 → 1; Feb=2 → 2 … May=5 → 5
function sortMonths(trends) {
  return [...trends].sort((a, b) => {
    const orderA = a.month === 12 ? 0 : a.month;
    const orderB = b.month === 12 ? 0 : b.month;
    return orderA - orderB;
  });
}

// Full month label with year context
function monthLabel(month) {
  if (month === 12) return 'Dec\'24';
  return `${MONTH_NAMES[month] || `M${month}`}'25`;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#0D1520', border: '1px solid rgba(0,212,170,0.2)',
      borderRadius: 8, padding: '10px 14px',
    }}>
      <div style={{ color: '#00D4AA', fontFamily: 'DM Mono, monospace', fontSize: 12, marginBottom: 6 }}>
        {label}
      </div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize: 12, color: p.color, marginBottom: 2 }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</strong>
        </div>
      ))}
    </div>
  );
};

// Small insight box shown below each chart
function Insight({ text, color = '#7A93B4' }) {
  return (
    <div style={{
      marginTop: 10, padding: '8px 12px',
      background: 'rgba(255,255,255,0.03)',
      borderLeft: `3px solid ${color}`,
      borderRadius: '0 6px 6px 0',
      fontSize: 11.5, color: '#7A93B4', lineHeight: 1.6,
    }}>
      {text}
    </div>
  );
}

export default function Trends() {
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTrends()
      .then(r => setTrends(r.data.trends || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader text="Loading trends…" />;

  // Sort months correctly: Dec 2024 first, then Jan–May 2025
  const data = sortMonths(trends).map(t => ({
    ...t,
    month_label: monthLabel(t.month),
    churn_pct: +((t.avg_churn_prob || 0) * 100).toFixed(1),
  }));

  // Compute dynamic insights from data
  const maxChurnMonth  = data.reduce((a, b) => (b.churn_pct > a.churn_pct ? b : a), data[0] || {});
  const minChurnMonth  = data.reduce((a, b) => (b.churn_pct < a.churn_pct ? b : a), data[0] || {});
  const maxRechargeMonth = data.reduce((a, b) => (b.avg_recharge > a.avg_recharge ? b : a), data[0] || {});
  const totalRevenue   = data.reduce((s, t) => s + (t.total_recharge || 0), 0);

  return (
    <div style={{ animation: 'fadeUp 0.4s ease both' }}>
      <SectionHeader title="Monthly Trends" sub="Customer recharge behaviour and churn risk evolution — Dec 2024 to May 2025" />

      {/* Context banner */}
      <div style={{
        background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.15)',
        borderRadius: 8, padding: '10px 16px', marginBottom: 18,
        fontSize: 12, color: '#7A93B4', lineHeight: 1.7,
      }}>
        <span style={{ color: '#00D4AA', fontWeight: 600 }}>How to read these charts: </span>
        Each month shows customers whose <strong style={{ color: '#E8F0FE' }}>last recharge fell in that month</strong>.
        Customers in <strong style={{ color: '#FF6B6B' }}>December 2024</strong> are now 5–6 months inactive
        → highest churn risk. Customers in <strong style={{ color: '#00D4AA' }}>May 2025</strong> recharged recently
        → lowest churn risk. This is not a time-series of events — it is a snapshot grouped by last activity month.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Avg Recharge Value */}
        <Card>
          <div style={chartTitle}>📈 Avg Recharge Value by Month</div>
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="avgGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00D4AA" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00D4AA" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month_label" tick={tick} axisLine={false} tickLine={false} />
              <YAxis tick={tick} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="avg_recharge" name="Avg $"
                stroke="#00D4AA" fill="url(#avgGrad)" strokeWidth={2} dot={{ fill: '#00D4AA', r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
          <Insight
            color="#00D4AA"
            text={`Highest avg recharge in ${maxRechargeMonth.month_label || '—'} ($${(maxRechargeMonth.avg_recharge || 0).toFixed(2)}). Champions and Engaged Regulars — who recharged in earlier months — typically have higher per-transaction values.`}
          />
        </Card>

        {/* Churn Risk by Month */}
        <Card>
          <div style={chartTitle}>⚠️ Churn Risk Score by Month (%)</div>
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="churnGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF6B6B" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#FF6B6B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month_label" tick={tick} axisLine={false} tickLine={false} />
              <YAxis tick={tick} axisLine={false} tickLine={false} unit="%" />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="churn_pct" name="Risk %"
                stroke="#FF6B6B" fill="url(#churnGrad)" strokeWidth={2} dot={{ fill: '#FF6B6B', r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
          <Insight
            color="#FF6B6B"
            text={`${maxChurnMonth.month_label || '—'} has the highest churn risk (${maxChurnMonth.churn_pct || 0}%) — these customers haven't recharged in 5–6 months. ${minChurnMonth.month_label || '—'} has the lowest (${minChurnMonth.churn_pct || 0}%) as they recharged most recently. This declining pattern from Dec→May reflects the inactivity signal in the risk score.`}
          />
        </Card>

        {/* Customers Active */}
        <Card>
          <div style={chartTitle}>👥 Customers by Last Recharge Month</div>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month_label" tick={tick} axisLine={false} tickLine={false} />
              <YAxis tick={tick} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="total_customers" name="Customers" fill="#4ECDC4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <Insight
            color="#4ECDC4"
            text="Each bar shows how many customers last recharged in that month. Larger bars in recent months (Apr–May) mean more customers are currently active. A large Dec bar would indicate many long-inactive customers needing immediate win-back action."
          />
        </Card>

        {/* Total Recharge Volume */}
        <Card>
          <div style={chartTitle}>💰 Total Recharge Volume ($) by Month</div>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month_label" tick={tick} axisLine={false} tickLine={false} />
              <YAxis tick={tick} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="total_recharge" name="Total $" fill="#A29BFE" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <Insight
            color="#A29BFE"
            text={`Total recharge revenue across all 6 months: $${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}. Months with both high customer count and high avg recharge value generate the most revenue. Low Dec revenue despite high churn risk signals a declining cohort.`}
          />
        </Card>

      </div>
    </div>
  );
}

const tick      = { fill: '#7A93B4', fontSize: 11, fontFamily: 'DM Mono, monospace' };
const chartTitle = { fontSize: 13, fontWeight: 600, color: '#E8F0FE', marginBottom: 14 };
