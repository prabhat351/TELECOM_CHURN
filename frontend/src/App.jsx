import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Overview from './pages/Overview';
import Trends from './pages/Trends';
import Predictions from './pages/Predictions';
import Segments from './pages/Segments';
import ModelAnalytics from './pages/ModelAnalytics';
import Agents from './pages/Agents';
import Chat from './pages/Chat';
import DataAnalyst from './pages/DataAnalyst';
import { getStatus } from './utils/api';

export default function App() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const r = await getStatus();
        setStatus(r.data);
        if (!r.data.ready) setTimeout(poll, 3000);
      } catch { setTimeout(poll, 5000); }
    };
    poll();
  }, []);

  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#080C14' }}>
        <Sidebar status={status} />
        <main style={{
          flex: 1, padding: '28px 28px 28px 24px',
          overflowY: 'auto', maxHeight: '100vh',
        }}>
          {/* Top bar */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 24, paddingBottom: 16,
            borderBottom: '1px solid rgba(0,212,170,0.08)',
          }}>
            <div style={{ fontSize: 11, color: '#3D5266', fontFamily: 'DM Mono, monospace' }}>
              TELECOM CHURN AI PLATFORM  ·  v1.0
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {status?.ready && (
                <>
                  <span style={{ fontSize: 11, color: '#3D5266', fontFamily: 'DM Mono, monospace' }}>
                    Model: {status.model}
                  </span>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#3D5266' }} />
                  <span style={{ fontSize: 11, color: '#3D5266', fontFamily: 'DM Mono, monospace' }}>
                    {status.vector_docs} vector docs
                  </span>
                </>
              )}
              {!status?.ready && (
                <span style={{ fontSize: 11, color: '#FFB347', fontFamily: 'DM Mono, monospace' }}>
                  ⟳ Pipeline initializing…
                </span>
              )}
            </div>
          </div>

          <Routes>
            {/* <Route path="/"            element={<Overview />} /> */}
            <Route path="/trends"      element={<Trends />} />
            <Route path="/predictions" element={<Predictions />} />
            <Route path="/segments"    element={<Segments />} />
            <Route path="/model"       element={<ModelAnalytics />} />
            <Route path="/agents"      element={<Agents />} />
            <Route path="/chat"        element={<Chat />} />
            <Route path="/analyst"     element={<DataAnalyst />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
