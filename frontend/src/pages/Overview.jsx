import React, { useEffect, useState } from 'react';
import { getKPIs, getValidation } from '../utils/api';
import { KPICard, Card, SectionHeader, Loader, Badge } from '../components/Cards';
import {
  Users, TrendingDown, AlertTriangle, DollarSign,
  Activity, Shield, Zap, CheckCircle, XCircle, Info
} from 'lucide-react';

export default function Overview() {
  const [kpis, setKpis] = useState(null);
  const [validation, setValidation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getKPIs(), getValidation()])
      .then(([k, v]) => {
        setKpis(k.data);
        setValidation(v.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader text="Loading dashboard…" />;

  const ag = kpis?.agent_summary || {};

  return (
    <div style={{ animation: 'fadeUp 0.4s ease both' }}>
      <SectionHeader
        title="Intelligence Overview"
        sub="Real-time churn analytics powered by XGBoost, LightGBM & RAG"
      />

      {/* KPI Grid */}
      <div style={grid4}>
        <KPICard
          label="Total Customers"
          value={kpis?.total_customers?.toLocaleString()}
          icon={Users}
          color="#4ECDC4"
          sub="Analysed in pipeline"
        />
        <KPICard
          label="Churn Rate"
          value={`${((kpis?.churn_rate || 0) * 100).toFixed(1)}%`}
          icon={TrendingDown}
          color="#FF6B6B"
          sub="Predicted churn"
        />
        <KPICard
          label="High Risk"
          value={kpis?.high_risk_customers?.toLocaleString()}
          icon={AlertTriangle}
          color="#FFB347"
          sub="Prob > 70%"
        />
        <KPICard
          label="Avg Recharge"
          value={`$${kpis?.avg_recharge_value?.toFixed(0)}`}
          icon={DollarSign}
          color="#00D4AA"
          sub="Per customer"
        />
      </div>

      {/* Second row */}
      <div style={{ ...grid4, marginTop: 16 }}>
        <KPICard
          label="Avg Active Days"
          value={kpis?.avg_active_days?.toFixed(1)}
          icon={Activity}
          color="#74B9FF"
          sub="Last 30 days"
        />
        <KPICard
          label="Avg Churn Prob"
          value={`${((kpis?.avg_churn_probability || 0) * 100).toFixed(1)}%`}
          icon={Shield}
          color="#FF6B6B"
          sub="ML prediction"
        />
        <KPICard
          label="Agent Actions"
          value={ag.total_actions?.toLocaleString() || 0}
          icon={Zap}
          color="#A29BFE"
          sub="Triggered by AI"
        />
        <KPICard
          label="Critical Alerts"
          value={ag.critical || 0}
          icon={AlertTriangle}
          color="#FF6B6B"
          sub="Immediate action"
        />
      </div>

      {/* Validation + Agent Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }}>
        {/* Data Validation */}
        <Card>
          <div style={cardTitle}>
            <CheckCircle size={16} color="#00D4AA" />
            Data Validation Report
          </div>
          {validation ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
              <ValidationRow
                label="Total Rows" value={validation.total_rows}
                ok={validation.total_rows > 0} />
              <ValidationRow
                label="Valid Rows" value={validation.valid_rows}
                ok={true} />
              <ValidationRow
                label="Duplicates"
                value={validation.duplicate_count}
                ok={validation.duplicate_count === 0}
                invertOk />
              <ValidationRow
                label="Outliers Detected"
                value={validation.outlier_count}
                ok={true} warn={validation.outlier_count > 0} />
              <div style={{ marginTop: 8 }}>
                {validation.messages?.map((m, i) => (
                  <div key={i} style={validMsg}><Info size={12} />{m}</div>
                ))}
              </div>
            </div>
          ) : <div style={{ color: '#7A93B4', fontSize: 13 }}>No validation data</div>}
        </Card>

        {/* Agent Summary */}
        <Card>
          <div style={cardTitle}>
            <Zap size={16} color="#A29BFE" />
            AI Agent Action Summary
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
            {[
              { label: 'Critical', val: ag.critical || 0, color: '#FF6B6B' },
              { label: 'High', val: ag.high || 0, color: '#FFB347' },
              { label: 'Medium', val: ag.medium || 0, color: '#74B9FF' },
              { label: 'Low', val: ag.low || 0, color: '#00D4AA' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ ...agentBox, borderColor: `${color}25`, background: `${color}08` }}>
                <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: 'Syne, sans-serif' }}>{val}</div>
                <div style={{ fontSize: 11, color: '#7A93B4', marginTop: 2 }}>{label} Priority</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(0,212,170,0.06)', borderRadius: 8, border: '1px solid rgba(0,212,170,0.12)' }}>
            <div style={{ fontSize: 11, color: '#7A93B4' }}>Retention Campaigns Triggered</div>
            <div style={{ fontSize: 20, color: '#00D4AA', fontWeight: 700, fontFamily: 'Syne, sans-serif' }}>
              {ag.retention_campaigns_triggered || 0}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ValidationRow({ label, value, ok, invertOk, warn }) {
  const isGood = invertOk ? value === 0 : ok;
  const color = warn ? '#FFB347' : isGood ? '#00D4AA' : '#FF6B6B';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ fontSize: 12, color: '#7A93B4' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color, fontFamily: 'DM Mono, monospace' }}>{value?.toLocaleString()}</span>
        {isGood ? <CheckCircle size={12} color="#00D4AA" /> : <XCircle size={12} color="#FF6B6B" />}
      </div>
    </div>
  );
}

const grid4 = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 14,
};
const cardTitle = {
  display: 'flex', alignItems: 'center', gap: 8,
  fontWeight: 600, fontSize: 14, color: '#E8F0FE',
};
const agentBox = {
  padding: '14px', borderRadius: 10,
  border: '1px solid', textAlign: 'center',
};
const validMsg = {
  display: 'flex', alignItems: 'center', gap: 6,
  fontSize: 11, color: '#7A93B4', padding: '4px 0',
};
