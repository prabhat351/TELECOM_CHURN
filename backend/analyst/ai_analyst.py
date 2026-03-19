"""
ai_analyst.py
─────────────────────────────────────────────────────────────
AI-powered analyst: generates professional insights from EDA.
Uses existing Azure OpenAI / Groq credentials from .env
─────────────────────────────────────────────────────────────
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict

logger = logging.getLogger("ai_analyst")

SYSTEM_PROMPT = """You are a senior data scientist and business analyst with 10+ years of experience. \
You analyze datasets and deliver concise, actionable reports exactly as a professional data analyst would.

Rules:
- Be specific — always cite numbers, percentages, and column names
- Flag real data quality problems with actionable fixes
- Identify patterns, outliers, skewed distributions, and surprising correlations
- Write in clear, professional markdown
- Keep each section focused and punchy

Structure your response EXACTLY with these markdown headers:
## Executive Summary
## Key Findings
## Data Quality Issues
## Statistical Patterns
## Preprocessing Recommendations
## Business Insights & Next Steps"""


def _build_context(eda: Dict, filename: str) -> str:
    ov = eda.get("overview", {})
    q = eda.get("data_quality", {})
    missing = eda.get("missing_analysis", [])
    outliers = eda.get("outliers", [])
    corr = eda.get("correlations", {})
    num_stats = eda.get("numeric_stats", [])
    cat_stats = eda.get("categorical_stats", [])

    return f"""Dataset: **{filename}**

### Overview
- Shape: {ov.get('rows', 0):,} rows × {ov.get('columns', 0)} columns
- Columns: {', '.join(ov.get('column_names', []))}
- Missing: {ov.get('total_missing', 0):,} cells ({ov.get('missing_pct', 0)}%)
- Duplicates: {ov.get('duplicate_rows', 0):,} rows ({ov.get('duplicate_pct', 0)}%)
- Data types: {ov.get('dtypes', {})}
- Data Quality Score: {q.get('overall_score', 'N/A')}/100 (Grade: {q.get('grade', 'N/A')})
  - Completeness: {q.get('completeness', 'N/A')}%
  - Uniqueness: {q.get('uniqueness', 'N/A')}%
  - Consistency: {q.get('consistency', 'N/A')}%

### Missing Values (top issues)
{json.dumps(missing[:6], indent=2) if missing else 'None'}

### Numeric Column Statistics
{json.dumps(num_stats[:8], indent=2) if num_stats else 'None'}

### Categorical Columns
{json.dumps(cat_stats[:5], indent=2) if cat_stats else 'None'}

### Outliers (IQR method)
{json.dumps(outliers[:6], indent=2) if outliers else 'None'}

### Top Correlations
{json.dumps(corr.get('top_pairs', [])[:10], indent=2) if corr.get('top_pairs') else 'Not enough numeric columns'}"""


class AIAnalyst:
    """Generates LLM-powered insights from EDA results."""

    def __init__(self):
        self.provider = os.getenv("LLM_PROVIDER", "azure").lower()
        self._client = None

    def _get_client(self):
        if self._client is not None:
            return self._client

        if self.provider == "azure":
            try:
                from openai import AzureOpenAI
                self._client = AzureOpenAI(
                    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
                    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
                    api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview"),
                )
                return self._client
            except Exception as e:
                logger.warning(f"Azure OpenAI init failed: {e}. Falling back to Groq.")
                self.provider = "groq"

        if self.provider == "groq":
            try:
                from groq import Groq
                self._client = Groq(api_key=os.getenv("GROQ_API_KEY"))
                return self._client
            except Exception as e:
                logger.error(f"Groq init failed: {e}")

        return None

    def _call_llm(self, messages: list, max_tokens: int = 1800) -> str | None:
        client = self._get_client()
        if client is None:
            return None
        try:
            if self.provider == "azure":
                deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4.1")
                resp = client.chat.completions.create(
                    model=deployment, messages=messages,
                    max_tokens=max_tokens, temperature=0.3,
                )
            else:
                model = os.getenv("GROQ_MODEL", "llama3-8b-8192")
                resp = client.chat.completions.create(
                    model=model, messages=messages,
                    max_tokens=max_tokens, temperature=0.3,
                )
            return resp.choices[0].message.content
        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            return None

    def generate_insights(self, eda: Dict, filename: str) -> Dict:
        """Generate comprehensive analyst-level insights."""
        context = _build_context(eda, filename)
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Analyze this dataset and write a professional data analyst report:\n\n{context}"},
        ]
        result = self._call_llm(messages, max_tokens=1800)
        if result:
            return {"insights": result, "source": self.provider}
        return {"insights": self._fallback_insights(eda, filename), "source": "rule-based"}

    def answer_question(self, question: str, eda: Dict, filename: str) -> str:
        """Answer a specific question about the dataset."""
        context = _build_context(eda, filename)
        messages = [
            {"role": "system", "content": (
                "You are a data analyst assistant. Answer questions about datasets "
                "concisely and accurately, citing specific numbers from the data provided."
            )},
            {"role": "user", "content": f"Dataset context:\n{context}\n\nQuestion: {question}"},
        ]
        result = self._call_llm(messages, max_tokens=900)
        return result or "AI service unavailable. Please check your API configuration."

    def _fallback_insights(self, eda: Dict, filename: str) -> str:
        ov = eda.get("overview", {})
        q = eda.get("data_quality", {})
        missing = eda.get("missing_analysis", [])
        outliers = eda.get("outliers", [])
        corr = eda.get("correlations", {})
        num_stats = eda.get("numeric_stats", [])

        missing_lines = "\n".join(
            f"- **{m['column']}**: {m['missing_pct']}% missing — {m['severity']} priority"
            for m in missing[:5]
        ) or "- No missing values — dataset is complete."

        outlier_lines = "\n".join(
            f"- **{o['column']}**: {o['outlier_count']} outliers ({o['outlier_pct']}%) — {o['severity']} severity"
            for o in outliers[:5]
        ) or "- No significant outliers detected."

        top_corr = corr.get("top_pairs", [])[:3]
        corr_lines = "\n".join(
            f"- **{p['col1']}** ↔ **{p['col2']}**: {p['correlation']} ({p['strength']} {p['direction']})"
            for p in top_corr
        ) or "- Not enough numeric columns for correlation analysis."

        skewed = [s for s in num_stats if s.get("skewness") and abs(s["skewness"]) > 1]
        skew_lines = "\n".join(
            f"- **{s['column']}**: skewness={s['skewness']:.2f} ({s['shape']})"
            for s in skewed[:3]
        ) or "- No severely skewed distributions detected."

        return f"""## Executive Summary
Dataset **'{filename}'** contains {ov.get('rows', 0):,} records and {ov.get('columns', 0)} features. \
The overall data quality score is **{q.get('overall_score', 'N/A')}/100 (Grade: {q.get('grade', 'N/A')})** \
with {ov.get('missing_pct', 0)}% missing values and {ov.get('duplicate_rows', 0):,} duplicate rows.

## Key Findings
- **{ov.get('rows', 0):,}** records × **{ov.get('columns', 0)}** columns
- **{ov.get('dtypes', {}).get('numeric', 0)}** numeric and **{ov.get('dtypes', {}).get('categorical', 0)}** categorical features
- **{ov.get('total_missing', 0):,}** missing cells ({ov.get('missing_pct', 0)}% of all data)
- **{ov.get('duplicate_rows', 0):,}** duplicate rows ({ov.get('duplicate_pct', 0)}%)
- Data quality: Completeness {q.get('completeness', 'N/A')}% | Uniqueness {q.get('uniqueness', 'N/A')}%

## Data Quality Issues
{missing_lines}

## Statistical Patterns
**Outliers detected (IQR method):**
{outlier_lines}

**Skewed distributions:**
{skew_lines}

**Top correlations:**
{corr_lines}

## Preprocessing Recommendations
- Impute or drop columns with high missing rate (>20%)
- Treat outliers: cap using IQR bounds or log-transform skewed features
- Encode categorical columns before ML modelling
- Standardize/normalize numeric features for distance-based algorithms
- Remove or investigate duplicate rows

## Business Insights & Next Steps
- Explore relationships between highly correlated features
- Segment data by categorical columns to uncover sub-group patterns
- Build predictive models using the engineered features
- Investigate outliers — they may represent fraud, errors, or special cases"""
