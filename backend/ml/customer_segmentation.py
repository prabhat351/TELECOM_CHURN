"""
customer_segmentation.py
─────────────────────────────────────────────────────────────
Stage 4: Customer Segmentation via K-Means Clustering

WHY K-MEANS ON A SNAPSHOT DATASET?
  Unlike supervised churn prediction (which requires a time split),
  clustering groups customers by CURRENT behavioural similarity.
  This is a genuinely useful unsupervised task — it reveals who
  your customers are, not just whether they'll churn.

FOUR INDUSTRY-STANDARD TELECOM SEGMENTS:
  ┌─────────────────────┬───────────────────────────────────────┐
  │ Segment             │ Characteristics                       │
  ├─────────────────────┼───────────────────────────────────────┤
  │ Champions           │ Long tenure, high ARPU, active,       │
  │                     │ auto-pay, annual/biannual contract,   │
  │                     │ minimal complaints                    │
  ├─────────────────────┼───────────────────────────────────────┤
  │ Engaged Regulars    │ Medium tenure, consistent recharges,  │
  │                     │ moderate call activity, low churn risk │
  ├─────────────────────┼───────────────────────────────────────┤
  │ At-Risk Subscribers │ Short tenure, declining recharge,     │
  │                     │ rising complaints, month-to-month,    │
  │                     │ no auto-pay                           │
  ├─────────────────────┼───────────────────────────────────────┤
  │ Dormant Churners    │ Very inactive (60+ days), many        │
  │                     │ complaints, payment issues, lowest    │
  │                     │ ARPU — immediate intervention needed  │
  └─────────────────────┴───────────────────────────────────────┘

SEGMENTATION FEATURES (7 dimensions):
  recency, frequency, monetary_value, engagement_score,
  complaint_intensity, tenure_stability, call_engagement

  These 7 dimensions capture the full customer lifecycle:
  value (RFM) + satisfaction (complaints) + loyalty (tenure)
  + multi-service stickiness (calls)
─────────────────────────────────────────────────────────────
"""
from __future__ import annotations

import logging
from typing import Dict, List

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)

# Segment names mapped from lowest → highest churn risk
SEGMENT_NAMES = [
    "Champions",
    "Engaged Regulars",
    "At-Risk Subscribers",
    "Dormant Churners",
]

SEGMENT_COLORS = {
    "Champions":           "#00D4AA",   # teal-green  — healthy
    "Engaged Regulars":    "#4ECDC4",   # cyan        — stable
    "At-Risk Subscribers": "#FFB347",   # amber       — caution
    "Dormant Churners":    "#FF6B6B",   # red         — critical
}

# 7-dimensional feature space for clustering
SEGMENTATION_FEATURES = [
    "recency",              # Days since last recharge (RFM: Recency)
    "frequency",            # Number of recharges (RFM: Frequency)
    "monetary_value",       # Avg recharge amount (RFM: Monetary)
    "engagement_score",     # Active-day + frequency blend [0,1]
    "complaint_intensity",  # Complaints per quarter (satisfaction signal)
    "tenure_stability",     # Tenure normalised to 4 years [0,1]
    "call_engagement",      # Call-minutes in 30d (stickiness proxy)
]


class CustomerSegmentor:
    def __init__(self, n_clusters: int = 4):
        self.n_clusters = n_clusters
        self.kmeans: KMeans | None = None
        self.scaler = StandardScaler()

    def fit_predict(self, df: pd.DataFrame) -> pd.DataFrame:
        # Use only features that exist (safety guard)
        features = [f for f in SEGMENTATION_FEATURES if f in df.columns]

        X = df[features].fillna(0)
        X_scaled = self.scaler.fit_transform(X)

        self.kmeans = KMeans(
            n_clusters=self.n_clusters, random_state=42, n_init=10
        )
        raw_labels = self.kmeans.fit_predict(X_scaled)

        df = df.copy()
        df["_raw_cluster"] = raw_labels

        # Map raw cluster IDs → semantic names by avg churn_score
        # Cluster with highest avg risk → "Dormant Churners"
        # Cluster with lowest avg risk  → "Champions"
        score_col = "churn_score" if "churn_score" in df.columns else "churn"
        cluster_risk = (
            df.groupby("_raw_cluster")[score_col]
            .mean()
            .sort_values(ascending=True)   # lowest risk first → Champions
        )
        rank_map = {
            cluster: SEGMENT_NAMES[i]
            for i, cluster in enumerate(cluster_risk.index)
        }
        df["segment"] = df["_raw_cluster"].map(rank_map)
        df = df.drop(columns=["_raw_cluster"])

        counts = df["segment"].value_counts().to_dict()
        logger.info(f"Segmentation complete: {counts}")
        return df

    def segment_summary(self, df: pd.DataFrame) -> List[Dict]:
        summaries = []
        for seg_name in SEGMENT_NAMES:
            if seg_name not in df["segment"].values:
                continue
            seg = df[df["segment"] == seg_name]

            # Avg churn probability: prefer model output, fall back to rule score
            if "churn_probability" in df.columns:
                avg_churn_prob = float(seg["churn_probability"].mean())
            elif "churn_score" in df.columns:
                avg_churn_prob = float(seg["churn_score"].mean())
            else:
                avg_churn_prob = float(seg["churn"].mean())

            summaries.append({
                "segment":              seg_name,
                "count":                int(len(seg)),
                "pct":                  round(len(seg) / len(df) * 100, 1),
                # Core risk metric
                "avg_churn_prob":       round(avg_churn_prob, 3),
                # Recharge behaviour
                "avg_recharge_value":   round(float(seg["avg_recharge_value"].mean()), 1),
                "avg_active_days":      round(float(seg["active_days_30d"].mean()), 1),
                "avg_frequency":        round(float(seg["recharge_frequency"].mean()), 1),
                "avg_days_since":       round(float(seg["days_since_last_recharge"].mean()), 1),
                # Account profile (new columns)
                "avg_tenure_months":    round(float(seg["customer_tenure_months"].mean()), 1) if "customer_tenure_months" in df.columns else None,
                "avg_monthly_bill":     round(float(seg["monthly_bill"].mean()), 1) if "monthly_bill" in df.columns else None,
                "avg_complaints":       round(float(seg["complaints_last_90d"].mean()), 2) if "complaints_last_90d" in df.columns else None,
                "avg_calls_30d":        round(float(seg["total_calls_30d"].mean()), 1) if "total_calls_30d" in df.columns else None,
                # Visual
                "color":                SEGMENT_COLORS.get(seg_name, "#888"),
            })

        # Always return in fixed order: highest risk first
        return summaries
