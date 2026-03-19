"""
data_pipeline.py
─────────────────────────────────────────────────────────────
Stage 1 & 2: Data Validation + Preprocessing

Dataset schema: 24 columns covering recharge behaviour,
call activity, account profile, and service quality.
─────────────────────────────────────────────────────────────
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────
# Schema contract  (columns that MUST exist in the CSV)
# ──────────────────────────────────────────────────────────────
REQUIRED_COLUMNS = [
    "Customer_id",
    # Account profile
    "customer_tenure_months",
    "plan_type",
    "contract_type",
    "monthly_bill",
    # Recharge behaviour
    "last_recharge_date",
    "last_recharge_amount",
    "recharge_frequency",
    "total_recharge_amount_30d",
    "total_recharge_amount_90d",
    "avg_recharge_value",
    "days_since_last_recharge",
    "active_days_30d",
    # Call & data activity
    "avg_call_duration_mins",
    "total_calls_30d",
    "data_usage_gb_30d",
    "sms_count_30d",
    # Service quality & risk signals
    "complaints_last_90d",
    "dropped_call_rate",
    "payment_delays_last_year",
    "customer_support_calls_30d",
    # Account flags
    "has_auto_pay",
    "num_products",
]

NUMERIC_COLUMNS = [
    "customer_tenure_months",
    "monthly_bill",
    "last_recharge_amount",
    "recharge_frequency",
    "total_recharge_amount_30d",
    "total_recharge_amount_90d",
    "avg_recharge_value",
    "days_since_last_recharge",
    "active_days_30d",
    "avg_call_duration_mins",
    "total_calls_30d",
    "data_usage_gb_30d",
    "sms_count_30d",
    "complaints_last_90d",
    "dropped_call_rate",
    "payment_delays_last_year",
    "customer_support_calls_30d",
    "has_auto_pay",
    "num_products",
]

CATEGORICAL_COLUMNS = ["plan_type", "contract_type"]


@dataclass
class ValidationReport:
    passed: bool = True
    missing_columns: List[str] = field(default_factory=list)
    null_counts: Dict[str, int] = field(default_factory=dict)
    duplicate_count: int = 0
    outlier_count: int = 0
    invalid_numeric: Dict[str, int] = field(default_factory=dict)
    total_rows: int = 0
    valid_rows: int = 0
    messages: List[str] = field(default_factory=list)


# ──────────────────────────────────────────────────────────────
# Step 1 – Data Validation
# ──────────────────────────────────────────────────────────────
class DataValidator:
    def validate(self, df: pd.DataFrame) -> ValidationReport:
        report = ValidationReport(total_rows=len(df))

        # Schema check
        missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
        if missing:
            report.missing_columns = missing
            report.passed = False
            report.messages.append(f"Missing columns: {missing}")

        # Null check
        nulls = df.isnull().sum()
        report.null_counts = {k: int(v) for k, v in nulls[nulls > 0].items()}
        if report.null_counts:
            report.messages.append(f"Null values found: {report.null_counts}")

        # Duplicate customer IDs
        report.duplicate_count = int(df.duplicated(subset=["Customer_id"]).sum())
        if report.duplicate_count:
            report.messages.append(f"{report.duplicate_count} duplicate customer IDs")

        # Negative value check on numeric columns
        for col in NUMERIC_COLUMNS:
            if col in df.columns:
                neg = int((pd.to_numeric(df[col], errors="coerce") < 0).sum())
                if neg:
                    report.invalid_numeric[col] = neg

        # Outlier detection (IQR × 3)
        outlier_mask = pd.Series(False, index=df.index)
        for col in NUMERIC_COLUMNS:
            if col in df.columns:
                s = pd.to_numeric(df[col], errors="coerce")
                Q1, Q3 = s.quantile(0.25), s.quantile(0.75)
                IQR = Q3 - Q1
                outlier_mask |= (s < Q1 - 3 * IQR) | (s > Q3 + 3 * IQR)
        report.outlier_count = int(outlier_mask.sum())

        report.valid_rows = report.total_rows - report.duplicate_count
        if not report.messages:
            report.messages.append("All validation checks passed ✓")
        return report


# ──────────────────────────────────────────────────────────────
# Step 2 – Preprocessing
# ──────────────────────────────────────────────────────────────
class DataPreprocessor:
    def __init__(self):
        self.scaler = MinMaxScaler()
        self._fitted = False

    def preprocess(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()

        # Remove duplicate customer IDs
        df = df.drop_duplicates(subset=["Customer_id"])

        # Numeric: coerce → fill median → clip negatives
        for col in NUMERIC_COLUMNS:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")
                df[col] = df[col].fillna(df[col].median())
                df[col] = df[col].clip(lower=0)

        # Categorical: fill with mode
        for col in CATEGORICAL_COLUMNS:
            if col in df.columns:
                mode = df[col].mode()
                df[col] = df[col].fillna(mode[0] if not mode.empty else "monthly")

        # Date parsing
        df["last_recharge_date"] = pd.to_datetime(
            df["last_recharge_date"], errors="coerce", dayfirst=False
        )
        df["last_recharge_date"] = df["last_recharge_date"].fillna(
            pd.Timestamp("2025-01-01")
        )

        # Extract date features
        df["recharge_month"]     = df["last_recharge_date"].dt.month
        df["recharge_week"]      = df["last_recharge_date"].dt.isocalendar().week.astype(int)
        df["recharge_dayofweek"] = df["last_recharge_date"].dt.dayofweek

        logger.info(f"Preprocessed {len(df)} rows — {len(df.columns)} columns")
        return df

    def scale_features(
        self, df: pd.DataFrame, cols: List[str]
    ) -> Tuple[pd.DataFrame, List[str]]:
        df = df.copy()
        scaled_cols = [f"{c}_scaled" for c in cols]
        df[scaled_cols] = self.scaler.fit_transform(df[cols].fillna(0))
        self._fitted = True
        return df, scaled_cols


# ──────────────────────────────────────────────────────────────
# Loader helper
# ──────────────────────────────────────────────────────────────
def load_data(path: str = "./data/telecom_data.csv") -> pd.DataFrame:
    df = pd.read_csv(path)
    logger.info(f"Loaded {len(df)} rows, {len(df.columns)} columns from {path}")
    return df
