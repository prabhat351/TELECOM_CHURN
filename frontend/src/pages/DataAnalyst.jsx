import React, { useCallback, useRef, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Upload, FileText, AlertTriangle, CheckCircle, TrendingUp,
  Database, Search, Loader, ChevronDown, ChevronUp, Send, Download,
} from 'lucide-react';
import { uploadAnalystFile, askAnalystQuestion, downloadCleanData, downloadReport } from '../utils/api';

// ── helpers ──────────────────────────────────────────────────
const C = {
  bg: '#FFFFFF', panel: '#F8F9FB', border: '#E0E6ED',
  accent: '#0066CC', warn: '#FF9500', danger: '#E63946',
  text: '#1A2332', muted: '#556B82', faint: '#B0C0D6',
  green: '#00A896', purple: '#6B5BED',
};

const card = {
  background: C.panel, border: `1px solid ${C.border}`,
  borderRadius: 12, padding: '20px 24px', marginBottom: 20,
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
};

const severityColor = (s) =>
  s === 'Critical' || s === 'High' ? C.danger
    : s === 'Medium' ? C.warn : C.accent;

const strengthColor = (s) =>
  s === 'Strong' ? C.danger : s === 'Moderate' ? C.warn : C.muted;

// ── Markdown-like renderer ─────────────────────────────────
function InsightText({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div style={{ lineHeight: 1.75, fontSize: 13.5, color: C.text }}>
      {lines.map((line, i) => {
        if (line.startsWith('## ')) {
          return (
            <div key={i} style={{
              fontSize: 15, fontWeight: 700, color: C.accent,
              marginTop: 20, marginBottom: 8, borderBottom: `1px solid ${C.border}`,
              paddingBottom: 6,
            }}>
              {line.replace('## ', '')}
            </div>
          );
        }
        if (line.startsWith('### ')) {
          return (
            <div key={i} style={{ fontSize: 13, fontWeight: 700, color: C.text, marginTop: 14, marginBottom: 4 }}>
              {line.replace('### ', '')}
            </div>
          );
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          const content = line.replace(/^[-*] /, '');
          return (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, color: C.muted }}>
              <span style={{ color: C.accent, flexShrink: 0 }}>•</span>
              <span dangerouslySetInnerHTML={{ __html: content.replace(/\*\*(.+?)\*\*/g, `<strong style="color:${C.text}">$1</strong>`) }} />
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} style={{ height: 6 }} />;
        return (
          <div key={i} style={{ color: C.muted, marginBottom: 4 }}
            dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, `<strong style="color:${C.text}">$1</strong>`) }} />
        );
      })}
    </div>
  );
}

// ── Collapsible Section ────────────────────────────────────
function Section({ title, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={card}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 10, background: 'none',
        border: 'none', cursor: 'pointer', padding: 0, width: '100%', marginBottom: open ? 16 : 0,
      }}>
        {Icon && <Icon size={16} color={C.accent} />}
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text, flex: 1, textAlign: 'left' }}>{title}</span>
        {open ? <ChevronUp size={14} color={C.faint} /> : <ChevronDown size={14} color={C.faint} />}
      </button>
      {open && children}
    </div>
  );
}

// ── Score Badge ────────────────────────────────────────────
function ScoreBadge({ score, grade }) {
  const color = grade === 'A' ? C.accent : grade === 'B' ? C.green : grade === 'C' ? C.warn : C.danger;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        border: `3px solid ${color}`, display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 18, fontWeight: 800, color }}>{grade}</span>
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color }}>{score}/100</div>
        <div style={{ fontSize: 11, color: C.faint }}>Data Quality Score</div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────
export default function DataAnalyst() {
  const [state, setState] = useState('idle'); // idle | uploading | done | error
  const [data, setData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [dragging, setDragging] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);
  const [activeTab, setActiveTab] = useState('insights');
  const [downloading, setDownloading] = useState(null); // null | 'clean' | 'report'
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const fileRef = useRef();

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setErrorMsg('Please upload a CSV file.');
      setState('error');
      return;
    }
    setState('uploading');
    setData(null);
    setAnswer('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await uploadAnalystFile(fd);
      setData(res.data);
      setState('done');
      setActiveTab('insights');
    } catch (e) {
      setErrorMsg(e.response?.data?.detail || 'Upload failed. Please try again.');
      setState('error');
    }
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const handleAsk = async () => {
    if (!question.trim() || !data?.file_id) return;
    setAsking(true);
    setAnswer('');
    try {
      const res = await askAnalystQuestion(data.file_id, question);
      setAnswer(res.data.answer);
    } catch (e) {
      setAnswer('Error: ' + (e.response?.data?.detail || 'Could not get answer.'));
    }
    setAsking(false);
  };

  const handleDownload = async (type) => {
    if (!data?.file_id) return;
    setDownloading(type);
    setDownloadError('');
    setShowDownloadMenu(false);
    try {
      const res = type === 'clean'
        ? await downloadCleanData(data.file_id)
        : await downloadReport(data.file_id);
      const mime = type === 'clean' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const url = window.URL.createObjectURL(new Blob([res.data], { type: mime }));
      const a = document.createElement('a');
      a.href = url;
      a.download = (data.filename || 'data').replace('.csv', '') + (type === 'clean' ? '_cleaned.csv' : '_report.xlsx');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setDownloadError(e.response?.data?.detail || 'Download failed. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  const eda = data?.eda_report;
  const aiInsights = data?.ai_insights;

  const TABS = [
    { id: 'insights', label: 'AI Insights' },
    { id: 'overview', label: 'Overview' },
    { id: 'stats', label: 'Statistics' },
    { id: 'quality', label: 'Quality' },
    { id: 'correlations', label: 'Correlations' },
    { id: 'distributions', label: 'Distributions' },
    { id: 'ask', label: 'Ask Data' },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: 0 }}>
          Data Analyst
        </h1>
        <p style={{ color: C.muted, fontSize: 13, margin: '6px 0 0' }}>
          Upload any CSV — get instant EDA, statistics, outlier detection, and AI-powered insights.
        </p>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => state !== 'uploading' && fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? C.accent : state === 'done' ? 'rgba(0,212,170,0.35)' : C.border}`,
          borderRadius: 14, padding: '36px 24px', textAlign: 'center',
          background: dragging ? 'rgba(0,212,170,0.04)' : C.panel,
          cursor: state === 'uploading' ? 'wait' : 'pointer',
          transition: 'all 0.2s', marginBottom: 24,
        }}
      >
        <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files[0])} />

        {state === 'idle' && (
          <>
            <Upload size={32} color={C.accent} style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 6 }}>
              Drop your CSV here or click to browse
            </div>
            <div style={{ fontSize: 12, color: C.faint }}>
              Supports any CSV dataset · up to 100,000 rows analysed
            </div>
          </>
        )}

        {state === 'uploading' && (
          <>
            <Loader size={32} color={C.accent} style={{ marginBottom: 12, animation: 'spin 1s linear infinite' }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>
              Analysing your dataset…
            </div>
            <div style={{ fontSize: 12, color: C.faint }}>Running EDA · Computing statistics · Generating AI insights</div>
          </>
        )}

        {state === 'done' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <CheckCircle size={24} color={C.accent} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.accent }}>{data.filename}</div>
              <div style={{ fontSize: 12, color: C.faint }}>
                {eda?.overview?.rows?.toLocaleString()} rows · {eda?.overview?.columns} columns
                {data.sampled && ' · (sampled to 100k)'}
                &nbsp;· Click to upload a new file
              </div>
            </div>
          </div>
        )}

        {state === 'error' && (
          <>
            <AlertTriangle size={32} color={C.danger} style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: C.danger, marginBottom: 4 }}>{errorMsg}</div>
            <div style={{ fontSize: 12, color: C.faint }}>Click to try again</div>
          </>
        )}
      </div>

      {/* Spin keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Results */}
      {state === 'done' && eda && (
        <>
          {/* Quick KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Rows', value: eda.overview.rows?.toLocaleString(), icon: Database },
              { label: 'Columns', value: eda.overview.columns, icon: FileText },
              { label: 'Missing %', value: `${eda.overview.missing_pct}%`, icon: AlertTriangle, warn: eda.overview.missing_pct > 5 },
              { label: 'Duplicates', value: eda.overview.duplicate_rows?.toLocaleString(), icon: TrendingUp, warn: eda.overview.duplicate_rows > 0 },
              { label: 'Quality', value: `${eda.data_quality.overall_score}/100`, icon: CheckCircle },
            ].map(({ label, value, icon: Icon, warn }) => (
              <div key={label} style={{
                ...card, marginBottom: 0, padding: '14px 16px',
                borderColor: warn ? 'rgba(255,179,71,0.25)' : C.border,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Icon size={14} color={warn ? C.warn : C.accent} />
                  <span style={{ fontSize: 10, color: C.faint, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: warn ? C.warn : C.text }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Download Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: downloadError ? 8 : 16, position: 'relative' }}>
            <button
              onClick={() => setShowDownloadMenu(o => !o)}
              disabled={!!downloading}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 18px', borderRadius: 8, border: `1px solid rgba(0,212,170,0.35)`,
                background: 'rgba(0,212,170,0.1)', color: C.accent,
                cursor: downloading ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600,
                opacity: downloading ? 0.7 : 1, transition: 'all 0.15s',
              }}
            >
              {downloading
                ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
                : <Download size={14} />}
              {downloading === 'clean' ? 'Preparing CSV…' : downloading === 'report' ? 'Building Report…' : 'Download'}
              {!downloading && <ChevronDown size={13} />}
            </button>

            {showDownloadMenu && (
              <div style={{
                position: 'absolute', top: '110%', right: 0, zIndex: 99,
                background: C.panel, border: `1px solid rgba(0,212,170,0.2)`,
                borderRadius: 10, overflow: 'hidden', minWidth: 230,
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}>
                <button
                  onClick={() => handleDownload('clean')}
                  style={dlMenuItem}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,212,170,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Download size={14} color={C.accent} />
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Clean Preprocessed Data</div>
                      <div style={{ fontSize: 11, color: C.faint }}>Nulls filled · Outliers clipped · .csv</div>
                    </div>
                  </div>
                </button>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />
                <button
                  onClick={() => handleDownload('report')}
                  style={dlMenuItem}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,212,170,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <FileText size={14} color={C.accent} />
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Summary Report</div>
                      <div style={{ fontSize: 11, color: C.faint }}>Stats · Insights · Outliers · .xlsx</div>
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>
          {downloadError && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end',
              marginBottom: 16, fontSize: 12, color: C.danger,
            }}>
              <AlertTriangle size={13} /> {downloadError}
            </div>
          )}

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
                background: activeTab === t.id ? 'rgba(0,212,170,0.15)' : 'rgba(255,255,255,0.04)',
                color: activeTab === t.id ? C.accent : C.muted,
                outline: activeTab === t.id ? `1px solid rgba(0,212,170,0.3)` : 'none',
              }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── AI Insights tab ─────────────────────────────── */}
          {activeTab === 'insights' && (
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'rgba(0,212,170,0.1)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <TrendingUp size={16} color={C.accent} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>AI Data Analyst Report</div>
                  <div style={{ fontSize: 11, color: C.faint }}>
                    Source: {aiInsights?.source === 'rule-based' ? 'Rule-based fallback' : `LLM (${aiInsights?.source})`}
                  </div>
                </div>
              </div>
              <InsightText text={aiInsights?.insights} />
            </div>
          )}

          {/* ── Overview tab ────────────────────────────────── */}
          {activeTab === 'overview' && (
            <>
              <Section title="Dataset Overview" icon={Database}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div>
                    <ScoreBadge score={eda.data_quality.overall_score} grade={eda.data_quality.grade} />
                    <div style={{ marginTop: 20 }}>
                      {[
                        ['Completeness', eda.data_quality.completeness + '%'],
                        ['Uniqueness', eda.data_quality.uniqueness + '%'],
                        ['Consistency', eda.data_quality.consistency + '%'],
                      ].map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                          <span style={{ fontSize: 12, color: C.muted }}>{k}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 80, height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }}>
                              <div style={{ width: v, height: 4, borderRadius: 4, background: C.accent }} />
                            </div>
                            <span style={{ fontSize: 12, color: C.text, width: 36, textAlign: 'right' }}>{v}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: C.faint, marginBottom: 12 }}>DATA TYPE BREAKDOWN</div>
                    {Object.entries(eda.overview.dtypes).map(([k, v]) => v > 0 && (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: C.muted, textTransform: 'capitalize' }}>{k}</span>
                        <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{v} col{v !== 1 ? 's' : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Section>

              <Section title="Column Explorer" icon={FileText}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr>
                        {['Column', 'Type', 'Null %', 'Unique %', 'Sample Values'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: C.faint, fontWeight: 600, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {eda.column_info.map(col => (
                        <tr key={col.name} style={{ borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                          <td style={{ padding: '8px 12px', color: C.text, fontWeight: 600 }}>{col.name}</td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{
                              fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 700,
                              background: col.is_numeric ? 'rgba(0,212,170,0.12)' : 'rgba(167,139,250,0.12)',
                              color: col.is_numeric ? C.accent : C.purple,
                            }}>
                              {col.dtype}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', color: col.null_pct > 20 ? C.danger : col.null_pct > 5 ? C.warn : C.muted }}>
                            {col.null_pct}%
                          </td>
                          <td style={{ padding: '8px 12px', color: C.muted }}>{col.unique_pct}%</td>
                          <td style={{ padding: '8px 12px', color: C.faint }}>{col.sample_values.join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            </>
          )}

          {/* ── Statistics tab ──────────────────────────────── */}
          {activeTab === 'stats' && (
            <>
              {eda.numeric_stats.length > 0 && (
                <Section title={`Numeric Statistics (${eda.numeric_stats.length} columns)`} icon={TrendingUp}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                      <thead>
                        <tr>
                          {['Column', 'Mean', 'Median', 'Std', 'Min', 'Max', 'Skewness', 'Shape'].map(h => (
                            <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: C.faint, fontWeight: 600, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {eda.numeric_stats.map(s => (
                          <tr key={s.column} style={{ borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                            <td style={{ padding: '8px 10px', color: C.text, fontWeight: 600 }}>{s.column}</td>
                            <td style={{ padding: '8px 10px', color: C.muted }}>{s.mean?.toFixed(3) ?? '—'}</td>
                            <td style={{ padding: '8px 10px', color: C.muted }}>{s.median?.toFixed(3) ?? '—'}</td>
                            <td style={{ padding: '8px 10px', color: C.muted }}>{s.std?.toFixed(3) ?? '—'}</td>
                            <td style={{ padding: '8px 10px', color: C.muted }}>{s.min?.toFixed(3) ?? '—'}</td>
                            <td style={{ padding: '8px 10px', color: C.muted }}>{s.max?.toFixed(3) ?? '—'}</td>
                            <td style={{ padding: '8px 10px', color: s.skewness && Math.abs(s.skewness) > 1 ? C.warn : C.muted }}>
                              {s.skewness?.toFixed(2) ?? '—'}
                            </td>
                            <td style={{ padding: '8px 10px', color: C.faint, fontSize: 11 }}>{s.shape}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
              )}

              {eda.categorical_stats.length > 0 && (
                <Section title={`Categorical Columns (${eda.categorical_stats.length})`} icon={Database}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                    {eda.categorical_stats.map(col => (
                      <div key={col.column} style={{
                        background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}`,
                        borderRadius: 10, padding: 14,
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>{col.column}</div>
                        <div style={{ fontSize: 11, color: C.faint, marginBottom: 10 }}>
                          {col.unique_count} unique values
                        </div>
                        {col.top_values.slice(0, 5).map(v => (
                          <div key={v.value} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{v.value}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 50, height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }}>
                                <div style={{ width: `${v.pct}%`, height: 4, borderRadius: 4, background: C.accent }} />
                              </div>
                              <span style={{ fontSize: 10, color: C.faint, width: 32, textAlign: 'right' }}>{v.pct}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}

          {/* ── Quality tab ──────────────────────────────────── */}
          {activeTab === 'quality' && (
            <>
              <Section title="Missing Values" icon={AlertTriangle} defaultOpen={true}>
                {eda.missing_analysis.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.accent }}>
                    <CheckCircle size={16} /> No missing values — dataset is complete!
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr>
                          {['Column', 'Missing Count', 'Missing %', 'Severity', 'Visual'].map(h => (
                            <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: C.faint, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {eda.missing_analysis.map(m => (
                          <tr key={m.column} style={{ borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                            <td style={{ padding: '10px 12px', color: C.text, fontWeight: 600 }}>{m.column}</td>
                            <td style={{ padding: '10px 12px', color: C.muted }}>{m.missing_count.toLocaleString()}</td>
                            <td style={{ padding: '10px 12px', color: severityColor(m.severity), fontWeight: 700 }}>{m.missing_pct}%</td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{
                                fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700,
                                background: `${severityColor(m.severity)}20`, color: severityColor(m.severity),
                              }}>{m.severity}</span>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ width: 120, height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }}>
                                <div style={{ width: `${Math.min(m.missing_pct, 100)}%`, height: 6, borderRadius: 4, background: severityColor(m.severity) }} />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              <Section title="Outlier Detection (IQR Method)" icon={AlertTriangle}>
                {eda.outliers.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.accent }}>
                    <CheckCircle size={16} /> No significant outliers detected.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr>
                          {['Column', 'Outliers', 'Outlier %', 'IQR Bounds', 'Extreme Values', 'Severity'].map(h => (
                            <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: C.faint, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {eda.outliers.map(o => (
                          <tr key={o.column} style={{ borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                            <td style={{ padding: '10px 12px', color: C.text, fontWeight: 600 }}>{o.column}</td>
                            <td style={{ padding: '10px 12px', color: C.muted }}>{o.outlier_count.toLocaleString()}</td>
                            <td style={{ padding: '10px 12px', color: severityColor(o.severity), fontWeight: 700 }}>{o.outlier_pct}%</td>
                            <td style={{ padding: '10px 12px', color: C.faint, fontSize: 11 }}>
                              [{o.lower_bound?.toFixed(2)}, {o.upper_bound?.toFixed(2)}]
                            </td>
                            <td style={{ padding: '10px 12px', color: C.faint, fontSize: 11 }}>
                              {o.min_outlier?.toFixed(2)} → {o.max_outlier?.toFixed(2)}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{
                                fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700,
                                background: `${severityColor(o.severity)}20`, color: severityColor(o.severity),
                              }}>{o.severity}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>
            </>
          )}

          {/* ── Correlations tab ─────────────────────────────── */}
          {activeTab === 'correlations' && (
            <Section title="Feature Correlations" icon={TrendingUp}>
              {eda.correlations.top_pairs?.length === 0 ? (
                <div style={{ color: C.muted, fontSize: 13 }}>Not enough numeric columns for correlation analysis.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 12, color: C.faint, marginBottom: 12 }}>TOP CORRELATION PAIRS</div>
                    {eda.correlations.top_pairs?.slice(0, 12).map((p, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
                        padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)',
                      }}>
                        <span style={{
                          fontSize: 14, fontWeight: 800, color: strengthColor(p.strength),
                          width: 44, textAlign: 'right', flexShrink: 0,
                        }}>
                          {p.correlation > 0 ? '+' : ''}{p.correlation}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: C.text }}>{p.col1} ↔ {p.col2}</div>
                          <div style={{ fontSize: 10, color: C.faint }}>{p.strength} {p.direction}</div>
                        </div>
                        <div style={{ width: 4, height: 24, borderRadius: 4, background: strengthColor(p.strength) }} />
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: C.faint, marginBottom: 12 }}>CORRELATION LEGEND</div>
                    {[
                      { label: 'Strong (|r| > 0.7)', color: C.danger },
                      { label: 'Moderate (0.4–0.7)', color: C.warn },
                      { label: 'Weak (|r| < 0.4)', color: C.muted },
                    ].map(({ label, color }) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <div style={{ width: 12, height: 12, borderRadius: 3, background: color }} />
                        <span style={{ fontSize: 12, color: C.muted }}>{label}</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 20, padding: 14, borderRadius: 10, background: 'rgba(0,212,170,0.05)', border: `1px solid rgba(0,212,170,0.1)` }}>
                      <div style={{ fontSize: 11, color: C.accent, fontWeight: 600, marginBottom: 6 }}>What to look for</div>
                      <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
                        Strong correlations (&gt;0.7) may indicate multicollinearity — consider dropping one of the features before modelling. Negative correlations can reveal inverse relationships that drive predictions.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* ── Distributions tab ────────────────────────────── */}
          {activeTab === 'distributions' && (
            <Section title="Feature Distributions" icon={BarChart}>
              {eda.distributions.length === 0 ? (
                <div style={{ color: C.muted }}>No numeric columns to display.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                  {eda.distributions.map(d => (
                    <div key={d.column} style={{
                      background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}`,
                      borderRadius: 10, padding: '14px 16px',
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 12 }}>{d.column}</div>
                      <ResponsiveContainer width="100%" height={140}>
                        <BarChart data={d.bins.map((b, i) => ({ bin: b, count: d.counts[i] }))} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                          <XAxis dataKey="bin" tick={false} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 9, fill: C.faint }} axisLine={false} tickLine={false} />
                          <Tooltip
                            contentStyle={{ background: '#0A1220', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11 }}
                            labelStyle={{ color: C.muted }}
                            itemStyle={{ color: C.accent }}
                          />
                          <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                            {d.counts.map((_, i) => (
                              <Cell key={i} fill={`rgba(0,212,170,${0.3 + (d.counts[i] / Math.max(...d.counts)) * 0.6})`} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      {(() => {
                        const ns = eda.numeric_stats.find(s => s.column === d.column);
                        return ns ? (
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                            {[['Mean', ns.mean?.toFixed(2)], ['Median', ns.median?.toFixed(2)], ['Std', ns.std?.toFixed(2)]].map(([k, v]) => (
                              <div key={k} style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 10, color: C.faint }}>{k}</div>
                                <div style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{v ?? '—'}</div>
                              </div>
                            ))}
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 10, color: C.faint }}>Shape</div>
                              <div style={{ fontSize: 10, color: ns.skewness && Math.abs(ns.skewness) > 1 ? C.warn : C.accent }}>{ns.shape?.split(' ')[0]}</div>
                            </div>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* ── Ask Data tab ─────────────────────────────────── */}
          {activeTab === 'ask' && (
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <Search size={16} color={C.accent} />
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Ask a Question About Your Data</div>
              </div>
              <div style={{ fontSize: 12, color: C.faint, marginBottom: 16 }}>
                Example: "Which columns have the most missing data?", "What are the main outliers?", "What does the skewness tell us?"
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <input
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAsk()}
                  placeholder="Ask anything about this dataset…"
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
                    borderRadius: 8, padding: '10px 14px', color: C.text, fontSize: 13,
                    outline: 'none',
                  }}
                />
                <button onClick={handleAsk} disabled={asking || !question.trim()} style={{
                  padding: '10px 18px', borderRadius: 8, border: 'none', cursor: asking ? 'wait' : 'pointer',
                  background: 'rgba(0,212,170,0.15)', color: C.accent, fontWeight: 700, fontSize: 13,
                  display: 'flex', alignItems: 'center', gap: 6,
                  opacity: asking || !question.trim() ? 0.5 : 1,
                }}>
                  {asking ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
                  Ask
                </button>
              </div>

              {/* Suggested questions */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {[
                  'What are the biggest data quality issues?',
                  'Which features are most correlated?',
                  'What preprocessing should I do?',
                  'Are there any anomalies in the data?',
                  'What business insights can I extract?',
                ].map(q => (
                  <button key={q} onClick={() => { setQuestion(q); }} style={{
                    padding: '5px 12px', borderRadius: 20, border: `1px solid ${C.border}`,
                    background: 'transparent', color: C.faint, fontSize: 11, cursor: 'pointer',
                  }}>
                    {q}
                  </button>
                ))}
              </div>

              {answer && (
                <div style={{
                  padding: 16, borderRadius: 10, background: 'rgba(0,212,170,0.04)',
                  border: `1px solid rgba(0,212,170,0.15)`,
                }}>
                  <div style={{ fontSize: 11, color: C.accent, fontWeight: 600, marginBottom: 10 }}>Answer</div>
                  <InsightText text={answer} />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const dlMenuItem = {
  display: 'block', width: '100%', padding: '12px 16px',
  background: 'transparent', border: 'none', cursor: 'pointer',
  transition: 'background 0.15s',
};
