"""
preprocessor.py
─────────────────────────────────────────────────────────────
Intelligent preprocessing engine for the Data Analyst download.
Decides null-fill strategy per column based on distribution shape.
─────────────────────────────────────────────────────────────
"""
from __future__ import annotations

from typing import Dict, List, Tuple

import numpy as np
import pandas as pd


def preprocess_dataframe(df: pd.DataFrame) -> Tuple[pd.DataFrame, List[Dict]]:
    """
    Apply intelligent preprocessing to any DataFrame:
      1. Remove duplicate rows
      2. Numeric nulls  → skewed (|skew|>1): fill median | normal: fill mean
      3. Categorical nulls → fill mode
      4. Clip numeric outliers at 3×IQR

    Returns
    -------
    cleaned_df : pd.DataFrame
    log        : list of dicts describing every action taken
    """
    df = df.copy()
    log: List[Dict] = []

    # ── 1. Remove duplicates ────────────────────────────────
    dup_count = int(df.duplicated().sum())
    if dup_count > 0:
        df = df.drop_duplicates()
        log.append({
            "action": "remove_duplicates",
            "column": "ALL",
            "method": "—",
            "rows_affected": dup_count,
            "detail": f"Removed {dup_count} duplicate rows",
        })

    # ── 2. Handle nulls per column ──────────────────────────
    for col in df.columns:
        null_count = int(df[col].isnull().sum())
        if null_count == 0:
            continue

        if pd.api.types.is_numeric_dtype(df[col]):
            series = df[col].dropna()
            skewness = float(series.skew()) if len(series) > 1 else 0.0
            if abs(skewness) > 1:
                fill_val = df[col].median()
                method = "median"
                reason = f"Skewness={skewness:.2f} (|skew|>1) → median chosen to reduce bias"
            else:
                fill_val = df[col].mean()
                method = "mean"
                reason = f"Skewness={skewness:.2f} (|skew|≤1) → mean is appropriate"
            df[col] = df[col].fillna(fill_val)
            log.append({
                "action": "fill_null",
                "column": col,
                "method": method,
                "fill_value": round(float(fill_val), 4) if fill_val is not None else None,
                "rows_affected": null_count,
                "detail": reason,
            })
        else:
            mode_vals = df[col].mode()
            if len(mode_vals) > 0:
                fill_val = mode_vals.iloc[0]
                df[col] = df[col].fillna(fill_val)
                log.append({
                    "action": "fill_null",
                    "column": col,
                    "method": "mode",
                    "fill_value": str(fill_val),
                    "rows_affected": null_count,
                    "detail": "Categorical column → mode imputation",
                })

    # ── 3. Clip outliers at 3×IQR ───────────────────────────
    for col in df.select_dtypes(include="number").columns:
        s = df[col]
        Q1, Q3 = s.quantile(0.25), s.quantile(0.75)
        IQR = Q3 - Q1
        if IQR == 0:
            continue
        lower, upper = Q1 - 3 * IQR, Q3 + 3 * IQR
        clipped = int(((s < lower) | (s > upper)).sum())
        if clipped > 0:
            df[col] = s.clip(lower=lower, upper=upper)
            log.append({
                "action": "clip_outliers",
                "column": col,
                "method": "3×IQR clip",
                "fill_value": f"[{lower:.3g}, {upper:.3g}]",
                "rows_affected": clipped,
                "detail": f"Values outside [{lower:.3g}, {upper:.3g}] clipped",
            })

    return df, log
