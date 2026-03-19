import axios from 'axios';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const api = axios.create({ baseURL: BASE, timeout: 60000 });

export const getStatus    = () => api.get('/api/status');
export const getKPIs      = () => api.get('/api/kpis');
export const getValidation = () => api.get('/api/validation');
export const getModelMetrics = () => api.get('/api/model-metrics');
export const getPredictions = (params) => api.get('/api/predictions', { params });
export const getSegments  = () => api.get('/api/segments');
export const getTrends    = () => api.get('/api/trends');
export const getScatter   = (n) => api.get('/api/scatter', { params: { n } });
export const getCorrelation = () => api.get('/api/correlation');
export const getAgentActions = (limit) => api.get('/api/agent-actions', { params: { limit } });
export const sendChat     = (question) => api.post('/api/chat', { question });
export const getSegmentInsight = (name) => api.get(`/api/segment-insight/${encodeURIComponent(name)}`);
export const getCustomerInsight = (id) => api.get(`/api/customer-insight/${id}`);
export const retrain      = () => api.post('/api/retrain');

// ── Data Analyst (independent EDA module) ────────────────────
export const uploadAnalystFile = (formData) =>
  api.post('/api/analyst/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  });
export const askAnalystQuestion = (file_id, question) =>
  api.post('/api/analyst/ask', { file_id, question });
export const downloadCleanData = (file_id) =>
  api.get('/api/analyst/download/clean', { params: { file_id }, responseType: 'blob', timeout: 120000 });
export const downloadReport = (file_id) =>
  api.get('/api/analyst/download/report', { params: { file_id }, responseType: 'blob', timeout: 120000 });
