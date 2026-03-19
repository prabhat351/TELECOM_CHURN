#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  TeleChurn AI – Quick Start Script
# ─────────────────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║        TeleChurn AI Platform - Starting          ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# Backend setup
echo "[ 1/4 ] Setting up Python backend..."
cd backend

if [ ! -f ".env" ]; then
  echo "⚠️  No .env file found. Please configure backend/.env with your API keys."
  exit 1
fi

pip install -r requirements.txt -q
mkdir -p models chroma_db

echo "[ 2/4 ] Starting FastAPI backend on port 8000..."
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

cd ..

# Frontend setup
echo "[ 3/4 ] Setting up React frontend..."
cd frontend
npm install -q

echo "[ 4/4 ] Starting React frontend on port 3000..."
npm start &
FRONTEND_PID=$!

cd ..

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  Backend : http://localhost:8000                 ║"
echo "║  Frontend: http://localhost:3000                 ║"
echo "║  API Docs: http://localhost:8000/docs            ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "Press Ctrl+C to stop all services"

wait $BACKEND_PID $FRONTEND_PID
