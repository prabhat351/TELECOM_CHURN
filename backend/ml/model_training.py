"""
model_training.py  —  RiskScorer (replaces ML model training)
─────────────────────────────────────────────────────────────
WHY NO MACHINE LEARNING HERE?

  We have a single snapshot of customer data — not two separate
  time periods. Training XGBoost/LightGBM to predict a churn label
  that was itself derived from the same features is circular: the
  model simply re-learns the rule you already wrote and hits ~100%
  accuracy, which is meaningless.

  Instead:
  • feature_engineering.py computes an honest multi-factor churn
    risk score from 8 weighted behavioural signals.
  • This module (RiskScorer) reads that score, maps it to risk zones,
    and produces per-factor transparency metrics.
  • K-Means clustering (customer_segmentation.py) remains — it groups
    customers by behavioural similarity, which IS a meaningful
    unsupervised learning task on a snapshot dataset.

RISK ZONES:
  Critical  ≥ 0.80  →  Immediate win-back action needed
  High      ≥ 0.60  →  Targeted retention offer
  Medium    ≥ 0.30  →  Proactive engagement nudge
  Low       < 0.30  →  Loyalty reward / maintain relationship
─────────────────────────────────────────────────────────────
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Dict, List

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# Import scoring weights from feature engineering (single source of truth)
try:
    from ml.feature_engineering import SCORING_WEIGHTS
except ImportError:
    from feature_engineering import SCORING_WEIGHTS


@dataclass
class FactorMetric:
    """Transparency metric for one scoring factor."""
    factor: str
    weight: float           # Assigned weight in the formula
    avg_signal: float       # Average normalised signal across all customers [0,1]
    avg_contribution: float # avg_signal × weight = actual score contribution


@dataclass
class ScoringResult:
    """
    Summary of the risk scoring run.
    Kept API-compatible with the old TrainingResult dataclass
    so existing endpoints continue to work.
    """
    scorer_type: str                          = "Multi-Factor Rule-Based Risk Scorer"
    best_model_name: str                      = "Rule-Based Risk Scorer"
    scoring_weights: Dict[str, float]         = field(default_factory=dict)
    factor_metrics: List[FactorMetric]        = field(default_factory=list)
    feature_importance: Dict[str, float]      = field(default_factory=dict)
    risk_distribution: Dict[str, int]         = field(default_factory=dict)
    churn_rate: float                         = 0.0
    total_customers: int                      = 0
    high_risk_count: int                      = 0
    # Kept for API compatibility
    train_size: int                           = 0
    test_size: int                            = 0
    metrics: List                             = field(default_factory=list)


class RiskScorer:
    """
    Reads churn_score computed by feature_engineering.engineer_features()
    and produces risk zone labels, zone counts, and factor transparency.

    Interface is intentionally similar to the old ModelTrainer so that
    main.py changes remain minimal.
    """

    def __init__(self, model_dir: str = "./models"):
        self.model_dir = model_dir

    def score(self, df: pd.DataFrame) -> tuple[pd.DataFrame, ScoringResult]:
        """
        Parameters
        ----------
        df : DataFrame that has already been through engineer_features()
             and therefore contains the 'churn_score' and 'contract_type' columns.

        Returns
        -------
        predictions : DataFrame with Customer_id, churn_probability,
                      churn_prediction, risk_level
        result      : ScoringResult summary
        """
        predictions = df[["Customer_id"]].copy()

        # churn_probability IS the churn_score (transparent, rule-based)
        predictions["churn_probability"] = df["churn_score"].round(4)
        predictions["churn_prediction"]  = (df["churn_score"] >= 0.50).astype(int)
        predictions["risk_level"] = pd.cut(
            df["churn_score"],
            bins=[0, 0.30, 0.60, 0.80, 1.01],
            labels=["Low", "Medium", "High", "Critical"],
            include_lowest=True,
        )

        # Risk zone distribution
        risk_dist = {
            str(k): int(v)
            for k, v in predictions["risk_level"].value_counts().items()
        }

        # Per-factor transparency: recompute each normalised signal
        factor_signals = {
            "inactivity":           np.clip(df["days_since_last_recharge"] / 180, 0, 1),
            "low_engagement":       1 - np.clip(df["active_days_30d"] / 30, 0, 1),
            "complaint_signal":     np.clip(df["complaints_last_90d"] / 6, 0, 1),
            "payment_risk":         np.clip(df["payment_delays_last_year"] / 6, 0, 1),
            "contract_instability": (df["contract_type"] == "monthly").astype(float),
            "low_tenure":           1 - np.clip(df["customer_tenure_months"] / 48, 0, 1),
            "network_quality":      np.clip(df["dropped_call_rate"] / 0.30, 0, 1),
            "low_call_activity":    1 - np.clip(df["total_calls_30d"] / 150, 0, 1),
        }

        factor_metrics: List[FactorMetric] = []
        feature_importance: Dict[str, float] = {}
        for factor, weight in SCORING_WEIGHTS.items():
            avg_sig    = round(float(factor_signals[factor].mean()), 4)
            avg_contrib = round(avg_sig * weight, 4)
            factor_metrics.append(FactorMetric(
                factor=factor,
                weight=weight,
                avg_signal=avg_sig,
                avg_contribution=avg_contrib,
            ))
            feature_importance[factor] = avg_contrib

        # Sort by contribution descending (mirrors old feature_importance format)
        feature_importance = dict(
            sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)
        )

        result = ScoringResult(
            scoring_weights=SCORING_WEIGHTS,
            factor_metrics=factor_metrics,
            feature_importance=feature_importance,
            risk_distribution=risk_dist,
            churn_rate=round(float(predictions["churn_prediction"].mean()), 4),
            total_customers=len(df),
            high_risk_count=int((df["churn_score"] >= 0.60).sum()),
            train_size=len(df),
            test_size=0,
        )

        logger.info(
            f"Risk scoring complete | "
            f"Low={risk_dist.get('Low', 0)}  "
            f"Medium={risk_dist.get('Medium', 0)}  "
            f"High={risk_dist.get('High', 0)}  "
            f"Critical={risk_dist.get('Critical', 0)}  "
            f"Churn rate={result.churn_rate:.1%}"
        )
        return predictions, result

    # ── Kept for API backward-compatibility ─────────────────
    def predict(self, df: pd.DataFrame) -> pd.DataFrame:
        """Alias so any code that calls .predict() still works."""
        predictions, _ = self.score(df)
        return predictions
