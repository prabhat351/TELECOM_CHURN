import React, { useState, useRef, useEffect } from 'react';
import { sendChat } from '../utils/api';
import { Card, SectionHeader } from '../components/Cards';
import { Send, Bot, User, Sparkles, RefreshCw } from 'lucide-react';

const SUGGESTIONS = [
  "Why are customers in the High Churn Risk segment churning?",
  "What retention strategies work best for low activity users?",
  "Explain the key drivers of churn in this dataset",
  "Which segment has the highest recharge value and why?",
  "What personalised offers should we give critical risk customers?",
  "How can we improve engagement score for low activity users?",
];

export default function Chat() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "Hello! I'm your Telecom Churn AI assistant powered by RAG. I have deep knowledge of your customer segments, churn patterns, and retention strategies. Ask me anything about your data!",
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (q) => {
    const question = q || input.trim();
    if (!question || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: question }]);
    setLoading(true);
    try {
      const r = await sendChat(question);
      setMessages(prev => [...prev, { role: 'assistant', text: r.data.answer }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: '⚠️ Failed to connect to the AI service. Please check your LLM API configuration in the .env file (AZURE_OPENAI_API_KEY or GROQ_API_KEY).',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => setMessages([{
    role: 'assistant',
    text: "Conversation cleared. How can I help you understand your churn data?",
  }]);

  return (
    <div style={{ animation: 'fadeUp 0.4s ease both', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <SectionHeader title="AI RAG Assistant" sub="Ask questions about churn patterns, segments, and recommendations" />
        <button onClick={reset} style={resetBtn}>
          <RefreshCw size={13} /> Reset
        </button>
      </div>

      {/* Suggestions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {SUGGESTIONS.map((s, i) => (
          <button key={i} onClick={() => send(s)} style={sugBtn}>
            <Sparkles size={11} /> {s}
          </button>
        ))}
      </div>

      {/* Chat window */}
      <Card style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: msg.role === 'user' ? 'rgba(116,185,255,0.15)' : 'rgba(0,212,170,0.15)',
                border: `1px solid ${msg.role === 'user' ? 'rgba(116,185,255,0.3)' : 'rgba(0,212,170,0.3)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {msg.role === 'user'
                  ? <User size={15} color="#74B9FF" />
                  : <Bot size={15} color="#00D4AA" />}
              </div>
              <div style={{
                maxWidth: '78%',
                background: msg.role === 'user' ? 'rgba(116,185,255,0.08)' : 'rgba(0,212,170,0.06)',
                border: `1px solid ${msg.role === 'user' ? 'rgba(116,185,255,0.15)' : 'rgba(0,212,170,0.12)'}`,
                borderRadius: msg.role === 'user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                padding: '12px 16px',
              }}>
                <div style={{ fontSize: 13, color: '#CBD5E0', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {msg.text}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(0,212,170,0.15)', border: '1px solid rgba(0,212,170,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Bot size={15} color="#00D4AA" />
              </div>
              <div style={{ display: 'flex', gap: 6, padding: '14px 16px', background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.12)', borderRadius: '4px 14px 14px 14px' }}>
                {[0, 0.15, 0.3].map(delay => (
                  <div key={delay} style={{
                    width: 7, height: 7, borderRadius: '50%', background: '#00D4AA',
                    animation: 'pulse-ring 1.2s ease infinite',
                    animationDelay: `${delay}s`,
                  }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={inputBar}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Ask about churn patterns, segments, recommendations…"
            style={inputStyle}
            disabled={loading}
          />
          <button onClick={() => send()} disabled={!input.trim() || loading} style={sendBtn}>
            <Send size={15} />
          </button>
        </div>
      </Card>
    </div>
  );
}

const resetBtn = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
  borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.04)', color: '#7A93B4',
  cursor: 'pointer', fontSize: 12, fontFamily: 'DM Mono, monospace',
};
const sugBtn = {
  display: 'flex', alignItems: 'center', gap: 5,
  padding: '5px 12px', borderRadius: 20, border: '1px solid rgba(0,212,170,0.15)',
  background: 'rgba(0,212,170,0.06)', color: '#7A93B4',
  cursor: 'pointer', fontSize: 11, fontFamily: 'DM Mono, monospace',
  transition: 'all 0.15s', whiteSpace: 'nowrap',
};
const inputBar = {
  padding: '14px 16px', borderTop: '1px solid rgba(0,212,170,0.1)',
  display: 'flex', gap: 10, alignItems: 'center',
};
const inputStyle = {
  flex: 1, background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(0,212,170,0.15)', borderRadius: 10,
  padding: '10px 14px', color: '#E8F0FE', fontSize: 13,
  fontFamily: 'Space Grotesk, sans-serif', outline: 'none',
};
const sendBtn = {
  width: 40, height: 40, borderRadius: 10, border: 'none',
  background: 'rgba(0,212,170,0.15)', color: '#00D4AA',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'all 0.15s', flexShrink: 0,
};
