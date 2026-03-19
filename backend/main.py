"""
main.py
─────────────────────────────────────────────────────────────
FastAPI Backend – Telecom Churn AI Platform
─────────────────────────────────────────────────────────────
"""
from __future__ import annotations

import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from dotenv import load_dotenv
import io
import uuid

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# ── path setup ──────────────────────────────────────────────
BASE = Path(__file__).parent
sys.path.insert(0, str(BASE))
load_dotenv(BASE / ".env")

# ── pipeline imports ─────────────────────────────────────────
from ml.data_pipeline import DataValidator, DataPreprocessor, load_data
from ml.feature_engineering import engineer_features, FEATURE_COLS
from ml.model_training import RiskScorer
from ml.customer_segmentation import CustomerSegmentor
from ml.agent_system import AgentSystem
from rag.vector_store import TelecomVectorStore, build_insight_documents
from rag.rag_pipeline import RAGPipeline

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(name)s  %(message)s")
logger = logging.getLogger("main")

# ── Global state ─────────────────────────────────────────────
STATE: Dict[str, Any] = {}


def run_full_pipeline():
    """Execute end-to-end ML pipeline and cache results."""
    data_path = os.getenv("DATA_PATH", str(BASE / "data/telecom_data.csv"))
    model_dir = os.getenv("MODEL_DIR", str(BASE / "models"))

    # 1. Load
    raw_df = load_data(data_path)

    # 2. Validate
    validator = DataValidator()
    report = validator.validate(raw_df)
    STATE["validation_report"] = report

    # 3. Preprocess
    preprocessor = DataPreprocessor()
    df = preprocessor.preprocess(raw_df)

    # 4. Feature engineering
    df = engineer_features(df)

    # 5. Risk Scoring (rule-based, no ML training)
    scorer = RiskScorer(model_dir=model_dir)
    predictions, scoring_result = scorer.score(df)
    STATE["train_result"] = scoring_result

    # 6. Merge risk scores back into main dataframe
    predictions = predictions[["Customer_id", "churn_probability", "churn_prediction", "risk_level"]]
    df = df.merge(predictions, on="Customer_id", how="left")

    # 7. Segment
    segmentor = CustomerSegmentor()
    df = segmentor.fit_predict(df)
    seg_summary = segmentor.segment_summary(df)

    STATE["df"] = df
    STATE["segment_summary"] = seg_summary

    # 8. Vector store + RAG
    chroma_dir = os.getenv("CHROMA_PERSIST_DIR", str(BASE / "chroma_db"))
    collection = os.getenv("CHROMA_COLLECTION", "telecom_insights")
    vs = TelecomVectorStore(persist_dir=chroma_dir, collection_name=collection)
    insight_docs = build_insight_documents(df, seg_summary)
    vs.store_insights(insight_docs)
    STATE["vector_store"] = vs

    rag = RAGPipeline(vs)
    STATE["rag"] = rag

    # 9. Agents
    agent = AgentSystem(rag)
    agent.evaluate(df)
    STATE["agent"] = agent

    logger.info("Pipeline complete ✓")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting pipeline …")
    try:
        run_full_pipeline()
        logger.info("Pipeline ready")
    except Exception as e:
        logger.error(f"Pipeline error: {e}", exc_info=True)
    yield


app = FastAPI(title="Telecom Churn AI", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ──────────────────────────────────────────────────
def _require(key: str):
    if key not in STATE:
        raise HTTPException(503, "Pipeline not ready. Please wait.")
    return STATE[key]


def _safe_val(v):
    if isinstance(v, float) and (np.isnan(v) or np.isinf(v)):
        return None
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return float(v)
    return v


def _df_to_records(df: pd.DataFrame, limit: int = 1000) -> List[Dict]:
    return [
        {k: _safe_val(v) for k, v in row.items()}
        for row in df.head(limit).to_dict(orient="records")
    ]


# ════════════════════════════════════════════════════════════
#  ENDPOINTS
# ════════════════════════════════════════════════════════════

@app.get("/")
def root():
    return {"status": "ok", "message": "Telecom Churn AI API"}


@app.get("/api/status")
def status():
    ready = "df" in STATE
    return {
        "ready": ready,
        "total_customers": int(len(STATE["df"])) if ready else 0,
        "model": STATE["train_result"].best_model_name if ready and "train_result" in STATE else None,
        "vector_docs": STATE["vector_store"].count() if "vector_store" in STATE else 0,
    }


# ── Dashboard KPIs ───────────────────────────────────────────
@app.get("/api/kpis")
def get_kpis():
    df = _require("df")
    churn_rate = float(df["churn"].mean())
    avg_prob = float(df["churn_probability"].mean()) if "churn_probability" in df.columns else churn_rate
    high_risk = int((df.get("churn_probability", df["churn"]) > 0.7).sum())
    avg_rev = float(df["avg_recharge_value"].mean())
    avg_active = float(df["active_days_30d"].mean())

    agent = STATE.get("agent")
    agent_summary = agent.get_summary() if agent else {}

    return {
        "total_customers": len(df),
        "churn_rate": round(churn_rate, 4),
        "avg_churn_probability": round(avg_prob, 4),
        "high_risk_customers": high_risk,
        "avg_recharge_value": round(avg_rev, 2),
        "avg_active_days": round(avg_active, 2),
        "agent_summary": agent_summary,
    }


# ── Validation Report ────────────────────────────────────────
@app.get("/api/validation")
def get_validation():
    report = _require("validation_report")
    from dataclasses import asdict
    return asdict(report)


# ── Risk Scorer Metrics ──────────────────────────────────────
@app.get("/api/model-metrics")
def get_model_metrics():
    result = _require("train_result")
    from dataclasses import asdict
    return {
        "best_model":        result.best_model_name,
        "scorer_type":       result.scorer_type,
        "scoring_weights":   result.scoring_weights,
        "factor_metrics":    [asdict(m) for m in result.factor_metrics],
        "feature_importance": result.feature_importance,
        "risk_distribution": result.risk_distribution,
        "total_customers":   result.total_customers,
        "high_risk_count":   result.high_risk_count,
        "churn_rate":        result.churn_rate,
        # Kept empty for frontend backward-compatibility
        "metrics":           [],
        "train_size":        result.train_size,
        "test_size":         result.test_size,
    }


# ── Predictions ──────────────────────────────────────────────
@app.get("/api/predictions")
def get_predictions(
    limit: int = Query(100, le=1000),
    risk: Optional[str] = Query(None),
    segment: Optional[str] = Query(None),
):
    df = _require("df")
    cols = [
        "Customer_id", "churn_probability", "churn_prediction", "risk_level",
        "segment", "days_since_last_recharge", "recharge_frequency",
        "avg_recharge_value", "engagement_score", "active_days_30d",
    ]
    cols = [c for c in cols if c in df.columns]
    out = df[cols].copy()
    if risk:
        out = out[out["risk_level"] == risk]
    if segment:
        out = out[out["segment"] == segment]
    out = out.sort_values("churn_probability", ascending=False)
    return {"total": len(out), "data": _df_to_records(out, limit)}


# ── Segments ─────────────────────────────────────────────────
@app.get("/api/segments")
def get_segments():
    return {"segments": _require("segment_summary")}


# ── Monthly Trends ───────────────────────────────────────────
@app.get("/api/trends")
def get_trends():
    df = _require("df")
    if "recharge_month" not in df.columns:
        raise HTTPException(400, "Month feature not available")

    monthly = (
        df.groupby("recharge_month")
        .agg(
            total_customers=("Customer_id", "count"),
            avg_recharge=("avg_recharge_value", "mean"),
            avg_churn_prob=("churn_probability", "mean") if "churn_probability" in df.columns else ("churn", "mean"),
            total_recharge=("total_recharge_amount_30d", "sum"),
        )
        .reset_index()
        .rename(columns={"recharge_month": "month"})
    )
    return {"trends": _df_to_records(monthly)}


# ── Scatter data ─────────────────────────────────────────────
@app.get("/api/scatter")
def get_scatter(n: int = Query(300, le=1000)):
    df = _require("df")
    cols = ["Customer_id", "engagement_score", "avg_recharge_value",
            "churn_probability", "segment", "risk_level", "active_days_30d"]
    cols = [c for c in cols if c in df.columns]
    sample = df[cols].sample(min(n, len(df)), random_state=42)
    return {"data": _df_to_records(sample)}


# ── Correlation ──────────────────────────────────────────────
@app.get("/api/correlation")
def get_correlation():
    df = _require("df")
    num_cols = [c for c in FEATURE_COLS if c in df.columns] + ["churn_score", "churn"]
    num_cols = [c for c in num_cols if c in df.columns]
    corr = df[num_cols].corr().round(3)
    return {
        "columns": corr.columns.tolist(),
        "matrix": corr.values.tolist(),
    }


# ── Agent Actions ────────────────────────────────────────────
@app.get("/api/agent-actions")
def get_agent_actions(limit: int = Query(50, le=500)):
    agent = _require("agent")
    return {"actions": agent.to_records(limit), "summary": agent.get_summary()}


# ── RAG Chat ─────────────────────────────────────────────────
class ChatRequest(BaseModel):
    question: str


@app.post("/api/chat")
def chat(req: ChatRequest):
    rag = _require("rag")
    answer = rag.answer_question(req.question)
    return {"answer": answer, "question": req.question}


@app.get("/api/segment-insight/{segment_name}")
def segment_insight(segment_name: str):
    rag = _require("rag")
    seg_summary = _require("segment_summary")
    seg_data = next((s for s in seg_summary if s["segment"] == segment_name), {})
    if not seg_data:
        raise HTTPException(404, f"Segment '{segment_name}' not found")
    insight = rag.generate_segment_recommendations(segment_name, seg_data)
    return {"segment": segment_name, "insight": insight}


@app.get("/api/customer-insight/{customer_id}")
def customer_insight(customer_id: str):
    df = _require("df")
    rag = _require("rag")
    row = df[df["Customer_id"] == customer_id]
    if row.empty:
        raise HTTPException(404, "Customer not found")
    row_dict = {k: _safe_val(v) for k, v in row.iloc[0].to_dict().items()}
    insight = rag.generate_churn_explanation(customer_id, row_dict)
    return {"customer_id": customer_id, "insight": insight, "data": row_dict}


# ── Retrain ──────────────────────────────────────────────────
@app.post("/api/retrain")
def retrain():
    try:
        run_full_pipeline()
        return {"status": "success", "message": "Pipeline retrained successfully"}
    except Exception as e:
        raise HTTPException(500, str(e))


# ════════════════════════════════════════════════════════════
#  DATA ANALYST MODULE  (independent of churn pipeline)
# ════════════════════════════════════════════════════════════

ANALYST_SESSIONS: Dict[str, Any] = {}


@app.post("/api/analyst/upload")
async def analyst_upload(file: UploadFile = File(...)):
    """Upload any CSV and receive a full EDA + AI insights report."""
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(400, "Only CSV files are supported.")

    try:
        content = await file.read()
        df = pd.read_csv(io.StringIO(content.decode("utf-8", errors="replace")))
    except Exception as e:
        raise HTTPException(400, f"Failed to parse CSV: {e}")

    if df.empty:
        raise HTTPException(400, "The uploaded CSV is empty.")

    sampled = False
    if len(df) > 100_000:
        df = df.sample(100_000, random_state=42)
        sampled = True

    from analyst.eda_engine import EDAEngine
    from analyst.ai_analyst import AIAnalyst

    eda_report = EDAEngine().analyze(df)
    ai_insights = AIAnalyst().generate_insights(eda_report, file.filename)

    file_id = str(uuid.uuid4())
    ANALYST_SESSIONS[file_id] = {
        "filename": file.filename,
        "df": df,
        "eda_report": eda_report,
        "ai_insights": ai_insights,
        "sampled": sampled,
    }

    return {
        "file_id": file_id,
        "filename": file.filename,
        "sampled": sampled,
        "eda_report": eda_report,
        "ai_insights": ai_insights,
    }


class AnalystQuestion(BaseModel):
    file_id: str
    question: str


@app.post("/api/analyst/ask")
def analyst_ask(req: AnalystQuestion):
    """Ask a natural-language question about the uploaded dataset."""
    session = ANALYST_SESSIONS.get(req.file_id)
    if not session:
        raise HTTPException(404, "Session not found. Please re-upload your file.")

    from analyst.ai_analyst import AIAnalyst

    answer = AIAnalyst().answer_question(
        req.question, session["eda_report"], session["filename"]
    )
    return {"question": req.question, "answer": answer}


@app.get("/api/analyst/download/clean")
def analyst_download_clean(file_id: str = Query(...)):
    """Preprocess the uploaded dataset and return as a cleaned CSV."""
    session = ANALYST_SESSIONS.get(file_id)
    if not session:
        raise HTTPException(404, "Session not found. Please re-upload your file.")

    from analyst.preprocessor import preprocess_dataframe

    cleaned_df, _ = preprocess_dataframe(session["df"])

    buf = io.BytesIO()
    cleaned_df.to_csv(buf, index=False)
    buf.seek(0)

    out_name = (session["filename"] or "data.csv").replace(".csv", "_cleaned.csv")
    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{out_name}"'},
    )


@app.get("/api/analyst/download/report")
def analyst_download_report(file_id: str = Query(...)):
    """Build a multi-sheet Excel summary report from the EDA results."""
    session = ANALYST_SESSIONS.get(file_id)
    if not session:
        raise HTTPException(404, "Session not found. Please re-upload your file.")

    from analyst.preprocessor import preprocess_dataframe

    eda = session["eda_report"]
    ai = session["ai_insights"]
    fname = session["filename"] or "data.csv"

    # Build preprocessing log for the report
    _, prep_log = preprocess_dataframe(session["df"])

    def _flatten(records: list) -> pd.DataFrame:
        """Convert list/dict values in records to strings so Excel can write them."""
        df_out = pd.DataFrame(records)
        for col in df_out.columns:
            if df_out[col].apply(lambda x: isinstance(x, (list, dict))).any():
                df_out[col] = df_out[col].apply(
                    lambda x: ", ".join(str(v) for v in x) if isinstance(x, list)
                    else str(x) if isinstance(x, dict) else x
                )
        return df_out

    try:
        buf = io.BytesIO()
        with pd.ExcelWriter(buf, engine="openpyxl") as writer:

            # Sheet 1: Summary
            pd.DataFrame({
                "Metric": [
                    "Filename", "Rows", "Columns", "Total Cells",
                    "Missing Values", "Missing %", "Duplicate Rows",
                    "Quality Score", "Grade",
                    "Completeness", "Uniqueness", "Consistency",
                ],
                "Value": [
                    fname,
                    eda["overview"]["rows"],
                    eda["overview"]["columns"],
                    eda["overview"]["total_cells"],
                    eda["overview"]["total_missing"],
                    f"{eda['overview']['missing_pct']}%",
                    eda["overview"]["duplicate_rows"],
                    f"{eda['data_quality']['overall_score']}/100",
                    eda["data_quality"]["grade"],
                    f"{eda['data_quality']['completeness']}%",
                    f"{eda['data_quality']['uniqueness']}%",
                    f"{eda['data_quality']['consistency']}%",
                ],
            }).to_excel(writer, sheet_name="Summary", index=False)

            # Sheet 2: AI Insights
            insights_text = ai.get("insights", "No AI insights available.") if ai else "No AI insights available."
            pd.DataFrame({"AI Analyst Report": insights_text.split("\n")}).to_excel(
                writer, sheet_name="AI Insights", index=False
            )

            # Sheet 3: Column Info (flatten sample_values list → string)
            if eda.get("column_info"):
                _flatten(eda["column_info"]).to_excel(
                    writer, sheet_name="Column Info", index=False
                )

            # Sheet 4: Numeric Statistics
            if eda.get("numeric_stats"):
                pd.DataFrame(eda["numeric_stats"]).to_excel(
                    writer, sheet_name="Numeric Statistics", index=False
                )

            # Sheet 5: Missing Values
            if eda.get("missing_analysis"):
                pd.DataFrame(eda["missing_analysis"]).to_excel(
                    writer, sheet_name="Missing Values", index=False
                )
            else:
                pd.DataFrame({"Status": ["No missing values — dataset is complete"]}).to_excel(
                    writer, sheet_name="Missing Values", index=False
                )

            # Sheet 6: Outliers
            if eda.get("outliers"):
                pd.DataFrame(eda["outliers"]).to_excel(
                    writer, sheet_name="Outliers", index=False
                )
            else:
                pd.DataFrame({"Status": ["No outliers detected"]}).to_excel(
                    writer, sheet_name="Outliers", index=False
                )

            # Sheet 7: Correlations (flatten top_pairs)
            if eda.get("correlations", {}).get("top_pairs"):
                pd.DataFrame(eda["correlations"]["top_pairs"]).to_excel(
                    writer, sheet_name="Correlations", index=False
                )

            # Sheet 8: Preprocessing Log
            if prep_log:
                pd.DataFrame(prep_log).to_excel(
                    writer, sheet_name="Preprocessing Log", index=False
                )
            else:
                pd.DataFrame({"Status": ["No preprocessing actions required — data is clean"]}).to_excel(
                    writer, sheet_name="Preprocessing Log", index=False
                )

        buf.seek(0)
        out_name = fname.replace(".csv", "_report.xlsx")
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{out_name}"'},
        )
    except Exception as e:
        logger.error(f"Report generation failed: {e}", exc_info=True)
        raise HTTPException(500, f"Failed to generate report: {str(e)}")
