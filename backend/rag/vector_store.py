"""
vector_store.py
─────────────────────────────────────────────────────────────
Stage 10: ChromaDB Vector Store for insights + embeddings
─────────────────────────────────────────────────────────────
"""
from __future__ import annotations

import logging
import os
import json
from typing import Dict, List, Optional

import chromadb
from chromadb.config import Settings

logger = logging.getLogger(__name__)


class TelecomVectorStore:
    def __init__(
        self,
        persist_dir: str = "./chroma_db",
        collection_name: str = "telecom_insights",
    ):
        self.persist_dir = persist_dir
        self.collection_name = collection_name
        os.makedirs(persist_dir, exist_ok=True)
        self.client = chromadb.PersistentClient(path=persist_dir)
        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )
        logger.info(f"ChromaDB collection '{collection_name}' ready")

    def store_insights(self, insights: List[Dict]) -> int:
        """Store segment/customer insights as documents."""
        docs, metas, ids = [], [], []
        for i, insight in enumerate(insights):
            doc = insight.get("text", json.dumps(insight))
            docs.append(doc)
            metas.append(
                {k: str(v) for k, v in insight.items() if k != "text"}
            )
            ids.append(insight.get("id", f"insight_{i}"))

        # Upsert
        self.collection.upsert(documents=docs, metadatas=metas, ids=ids)
        logger.info(f"Stored {len(docs)} insights in ChromaDB")
        return len(docs)

    def retrieve(self, query: str, n_results: int = 5) -> List[Dict]:
        """Retrieve relevant insights for a query."""
        try:
            results = self.collection.query(
                query_texts=[query],
                n_results=min(n_results, self.collection.count() or 1),
            )
            docs = results.get("documents", [[]])[0]
            metas = results.get("metadatas", [[]])[0]
            distances = results.get("distances", [[]])[0]
            return [
                {"text": d, "metadata": m, "score": round(1 - dist, 4)}
                for d, m, dist in zip(docs, metas, distances)
            ]
        except Exception as e:
            logger.warning(f"Vector retrieval error: {e}")
            return []

    def count(self) -> int:
        return self.collection.count()

    def reset(self):
        self.client.delete_collection(self.collection_name)
        self.collection = self.client.get_or_create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": "cosine"},
        )


def build_insight_documents(df, segment_summaries: List[Dict]) -> List[Dict]:
    """Convert dataframe rows + segment summaries into text documents."""
    docs = []

    # Segment-level insights
    for seg in segment_summaries:
        text = (
            f"Customer Segment: {seg['segment']}. "
            f"This segment contains {seg['count']} customers ({seg['pct']}% of total). "
            f"Average churn probability: {seg['avg_churn_prob']:.1%}. "
            f"Average recharge value: ₹{seg['avg_recharge_value']:.0f}. "
            f"Average active days in last 30 days: {seg['avg_active_days']:.0f}. "
            f"Average recharge frequency: {seg['avg_frequency']:.0f} times. "
            f"Average days since last recharge: {seg['avg_days_since']:.0f} days."
        )
        docs.append({"id": f"seg_{seg['segment'].replace(' ', '_')}", "text": text, **seg})

    # Global stats
    churn_rate = df["churn"].mean() if "churn" in df.columns else 0
    docs.append({
        "id": "global_churn_stats",
        "text": (
            f"Overall churn rate is {churn_rate:.1%}. "
            f"Total customers: {len(df)}. "
            f"Average recharge value across all customers: ₹{df['avg_recharge_value'].mean():.0f}. "
            f"Average days since last recharge: {df['days_since_last_recharge'].mean():.0f}."
        ),
    })

    # High-risk individual summaries (top 20)
    if "churn_probability" in df.columns:
        high_risk = df[df["churn_probability"] > 0.7].head(20)
        for _, row in high_risk.iterrows():
            docs.append({
                "id": f"cust_{row['Customer_id']}",
                "text": (
                    f"High-risk customer {row['Customer_id']} "
                    f"has churn probability {row['churn_probability']:.1%}. "
                    f"Days since last recharge: {row['days_since_last_recharge']}. "
                    f"Recharge frequency: {row['recharge_frequency']}. "
                    f"Average recharge value: ₹{row['avg_recharge_value']:.0f}. "
                    f"Engagement score: {row.get('engagement_score', 0):.2f}."
                ),
            })

    return docs
