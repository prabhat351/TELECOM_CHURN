# 🧠 TeleChurn AI — Intelligent Telecom Churn Analytics Platform

A complete end-to-end AI analytics system for telecom customer churn prediction, built with FastAPI, React, XGBoost, LightGBM, ChromaDB, and RAG.

---

## 🏗️ Architecture

```
RAW DATA (CSV)
     ↓
DATA VALIDATION          (pandera / pandas)
     ↓
DATA PREPROCESSING       (missing values, scaling, date features)
     ↓
FEATURE ENGINEERING      (RFM, engagement score, churn label)
     ↓
MODEL TRAINING           (XGBoost + LightGBM + RandomForest)
     ↓
PREDICTION               (churn probability, risk level)
     ↓
CUSTOMER SEGMENTATION    (K-Means clustering)
     ↓
INSIGHT GENERATION       (segment + customer summaries)
     ↓
VECTOR DATABASE          (ChromaDB — embeddings + semantic search)
     ↓
LLM RAG REASONING        (Azure OpenAI or Groq)
     ↓
AI RECOMMENDATIONS       (retention strategies per segment)
     ↓
ANALYTICS DASHBOARD      (React + Recharts)
     ↓
AGENTIC AI ACTIONS       (rule-based retention campaigns)
```

---

## 📁 Project Structure

```
telecom-churn-ai/
├── backend/
│   ├── main.py                  ← FastAPI server (all endpoints)
│   ├── requirements.txt
│   ├── .env                     ← API keys & config
│   ├── Dockerfile
│   ├── data/
│   │   └── telecom_data.csv     ← Your dataset
│   ├── ml/
│   │   ├── data_pipeline.py     ← Validation + preprocessing
│   │   ├── feature_engineering.py
│   │   ├── model_training.py    ← XGBoost, LightGBM, RF
│   │   ├── customer_segmentation.py
│   │   └── agent_system.py
│   └── rag/
│       ├── vector_store.py      ← ChromaDB integration
│       └── rag_pipeline.py      ← Azure OpenAI / Groq RAG
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── Overview.jsx     ← KPIs + validation summary
│   │   │   ├── Trends.jsx       ← Monthly trend charts
│   │   │   ├── Predictions.jsx  ← Churn table with filters
│   │   │   ├── Segments.jsx     ← K-Means + scatter
│   │   │   ├── ModelAnalytics.jsx ← Metrics + feature importance
│   │   │   ├── Agents.jsx       ← AI agent actions
│   │   │   └── Chat.jsx         ← RAG chat assistant
│   │   ├── components/
│   │   │   ├── Sidebar.jsx
│   │   │   └── Cards.jsx
│   │   └── utils/
│   │       └── api.js
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── start.sh
```

---

## ⚙️ Configuration

Edit `backend/.env`:

```env
# Choose your LLM provider
LLM_PROVIDER=azure           # or "groq"

# Azure OpenAI
AZURE_OPENAI_API_KEY=your_key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_VERSION=2024-02-01
AZURE_OPENAI_DEPLOYMENT=gpt-4o

# Groq (fallback)
GROQ_API_KEY=your_groq_key
GROQ_MODEL=llama3-8b-8192
```

---

## 🚀 Quick Start

### Option 1: Script

```bash
chmod +x start.sh
./start.sh
```

### Option 2: Manual

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm start
```

### Option 3: Docker

```bash
docker-compose up --build
```

### Access

| Service  | URL                              |
|----------|----------------------------------|
| Frontend | http://localhost:3000            |
| Backend  | http://localhost:8000            |
| API Docs | http://localhost:8000/docs       |

---

## 🔌 API Endpoints

| Method | Path                              | Description               |
|--------|-----------------------------------|---------------------------|
| GET    | `/api/status`                     | Pipeline readiness        |
| GET    | `/api/kpis`                       | Dashboard KPIs            |
| GET    | `/api/validation`                 | Data validation report    |
| GET    | `/api/model-metrics`              | ML model performance      |
| GET    | `/api/predictions`                | Churn predictions table   |
| GET    | `/api/segments`                   | Customer segment summary  |
| GET    | `/api/trends`                     | Monthly trends            |
| GET    | `/api/scatter`                    | Scatter plot data         |
| GET    | `/api/correlation`                | Feature correlation matrix|
| GET    | `/api/agent-actions`              | AI agent action list      |
| POST   | `/api/chat`                       | RAG chat                  |
| GET    | `/api/segment-insight/{name}`     | AI insight for segment    |
| GET    | `/api/customer-insight/{id}`      | AI insight for customer   |
| POST   | `/api/retrain`                    | Trigger retraining        |

---

## 🧪 ML Pipeline

### Models Trained
- **XGBoost** — gradient boosted trees with log loss
- **LightGBM** — fast gradient boosting
- **RandomForest** — baseline comparison

### Churn Label
```python
churn = 1 if days_since_last_recharge > 45 else 0
```

### Key Features
- `recency` — days since last recharge
- `frequency` — recharge count
- `monetary_value` — avg recharge amount
- `engagement_score` — blend of active days + frequency
- `recharge_ratio` — 30d vs 90d momentum
- `monthly_activity_score` — recharge per active day

### Segments (K-Means, k=4)
- 🟢 **High-Value Active** — frequent, high spend
- 🔵 **Frequent Small Recharge** — regular but low value
- 🟡 **Low Activity** — low engagement
- 🔴 **High Churn Risk** — at-risk customers

---

## 🤖 Agentic Rules

| Condition | Action |
|-----------|--------|
| Churn prob > 0.8 | Immediate Retention Campaign |
| Churn prob > 0.6 | Targeted Offer Dispatch |
| Churn prob > 0.4 | Personalised Engagement |
| Days inactive > 45 | Push notification + cashback |
| Low frequency | Recharge plan suggestion |

---

## 📊 Dashboard Pages

1. **Overview** — KPIs, validation report, agent summary
2. **Monthly Trends** — Recharge, churn, volume by month
3. **Churn Predictions** — Filterable table with risk bars
4. **Segments** — Cluster cards + scatter plot + AI insights
5. **Model Analytics** — Metrics, feature importance, radar, heatmap
6. **AI Agents** — Action list with offers and estimated impact
7. **AI Assistant** — RAG chat for open-ended questions

---

## 📦 Tech Stack

| Layer | Technology |
|-------|------------|
| Backend API | FastAPI + Uvicorn |
| ML | XGBoost, LightGBM, Scikit-learn |
| Vector DB | ChromaDB |
| RAG / LLM | Azure OpenAI / Groq |
| Frontend | React 18 + Recharts |
| Styling | Custom CSS design system |
| Containerisation | Docker + Docker Compose |
