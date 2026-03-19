"""
rag_pipeline.py
─────────────────────────────────────────────────────────────
Stage 11-12: RAG Pipeline – Retrieval + LLM Generation
Supports Azure OpenAI (primary) and Groq (fallback)
─────────────────────────────────────────────────────────────
"""
from __future__ import annotations

import logging
import os
from typing import Dict, List, Optional

from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "azure").lower()


# ─── LLM Client Factory ────────────────────────────────────
def _get_llm_client():
    if LLM_PROVIDER == "groq":
        from openai import OpenAI
        return OpenAI(
            api_key=os.getenv("GROQ_API_KEY"),
            base_url="https://api.groq.com/openai/v1",
        ), os.getenv("GROQ_MODEL", "llama3-8b-8192")

    # Default: Azure OpenAI
    from openai import AzureOpenAI
    client = AzureOpenAI(
        api_key=os.getenv("AZURE_OPENAI_API_KEY"),
        azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT", ""),
        api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-01"),
    )
    return client, os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o")


SYSTEM_PROMPT = """You are an expert telecom business analyst and AI recommendation engine.
You analyse customer churn data, segment insights, and recharge behaviour to provide:
1. Clear explanations of why customers are churning
2. Actionable retention strategies
3. Personalised recommendations per customer segment
4. Business impact estimates

Always be specific, data-driven, and actionable. Structure your responses clearly.
Keep language professional but concise."""


class RAGPipeline:
    def __init__(self, vector_store):
        self.vector_store = vector_store
        self._client = None
        self._model = None

    def _ensure_client(self):
        if self._client is None:
            self._client, self._model = _get_llm_client()

    def generate_insight(self, query: str, extra_context: Optional[str] = None) -> str:
        """Retrieve relevant docs + generate LLM response."""
        self._ensure_client()

        # Retrieve
        retrieved = self.vector_store.retrieve(query, n_results=5)
        context_parts = [r["text"] for r in retrieved]
        if extra_context:
            context_parts.insert(0, extra_context)
        context = "\n\n".join(context_parts)

        user_prompt = f"""Based on the following telecom customer data insights:

{context}

Question / Task: {query}

Provide a detailed, actionable response."""

        try:
            resp = self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=800,
                temperature=0.4,
            )
            return resp.choices[0].message.content
        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            return _fallback_insight(query, retrieved)

    def generate_segment_recommendations(self, segment_name: str, segment_data: Dict) -> str:
        query = f"Generate retention recommendations for the '{segment_name}' customer segment."
        extra = (
            f"Segment: {segment_name}\n"
            f"Count: {segment_data.get('count', 'N/A')} customers\n"
            f"Avg churn probability: {segment_data.get('avg_churn_prob', 0):.1%}\n"
            f"Avg recharge value: ₹{segment_data.get('avg_recharge_value', 0):.0f}\n"
            f"Avg active days: {segment_data.get('avg_active_days', 0):.0f}\n"
            f"Avg days since last recharge: {segment_data.get('avg_days_since', 0):.0f}"
        )
        return self.generate_insight(query, extra)

    def generate_churn_explanation(self, customer_id: str, row: Dict) -> str:
        query = f"Explain why customer {customer_id} is at risk of churning and what actions to take."
        extra = (
            f"Customer ID: {customer_id}\n"
            f"Churn Probability: {row.get('churn_probability', 0):.1%}\n"
            f"Days Since Last Recharge: {row.get('days_since_last_recharge', 'N/A')}\n"
            f"Recharge Frequency: {row.get('recharge_frequency', 'N/A')}\n"
            f"Avg Recharge Value: ₹{row.get('avg_recharge_value', 0):.0f}\n"
            f"Engagement Score: {row.get('engagement_score', 0):.2f}\n"
            f"Segment: {row.get('segment', 'Unknown')}"
        )
        return self.generate_insight(query, extra)

    def answer_question(self, question: str) -> str:
        return self.generate_insight(question)


def _fallback_insight(query: str, retrieved: List[Dict]) -> str:
    """Rule-based fallback when LLM is unavailable."""
    context = "\n".join(r["text"] for r in retrieved[:3]) if retrieved else "No data available."
    return (
        f"[Fallback – LLM unavailable]\n\n"
        f"Query: {query}\n\n"
        f"Relevant Context:\n{context}\n\n"
        f"Recommendation: Review high-churn segments and apply targeted retention offers "
        f"such as cashback rewards, loyalty bonuses, and personalised recharge plans."
    )
