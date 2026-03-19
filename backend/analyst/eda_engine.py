"""
eda_engine.py
─────────────────────────────────────────────────────────────
Comprehensive Exploratory Data Analysis engine.
Works on any CSV dataset – fully independent of the churn pipeline.
─────────────────────────────────────────────────────────────
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from typing import Any, Dict, List


def _safe(v):
    """Convert numpy types to Python natives; handle NaN/Inf."""
    if isinstance(v, (np.bool_,)):
        return bool(v)
    if isinstance(v, float) and (np.isnan(v) or np.isinf(v)):
        return None
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return float(v) if not (np.isnan(v) or np.isinf(v)) else None
    if isinstance(v, np.ndarray):
        return [_safe(x) for x in v.tolist()]
    return v


def _sanitize(obj):
    """Recursively sanitize all numpy types in a nested dict/list."""
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(x) for x in obj]
    return _safe(obj)


class EDAEngine:
    """Runs full EDA on any pandas DataFrame."""

    def analyze(self, df: pd.DataFrame) -> Dict[str, Any]:
        raw = {
            "overview": self._overview(df),
            "column_info": self._column_info(df),
            "numeric_stats": self._numeric_stats(df),
            "categorical_stats": self._categorical_stats(df),
            "missing_analysis": self._missing_analysis(df),
            "outliers": self._outlier_analysis(df),
            "correlations": self._correlations(df),
            "data_quality": self._data_quality_score(df),
            "distributions": self._distributions(df),
        }
        return _sanitize(raw)

    # ── Overview ───────────────────────────────────────────────
    def _overview(self, df: pd.DataFrame) -> Dict[str, Any]:
        total_cells = df.shape[0] * df.shape[1]
        return {
            "rows": int(df.shape[0]),
            "columns": int(df.shape[1]),
            "column_names": df.columns.tolist(),
            "total_cells": int(total_cells),
            "total_missing": int(df.isnull().sum().sum()),
            "missing_pct": round(df.isnull().sum().sum() / total_cells * 100, 2) if total_cells else 0,
            "duplicate_rows": int(df.duplicated().sum()),
            "duplicate_pct": round(df.duplicated().sum() / len(df) * 100, 2) if len(df) else 0,
            "memory_mb": round(df.memory_usage(deep=True).sum() / 1024 ** 2, 3),
            "dtypes": {
                "numeric": int(len(df.select_dtypes(include="number").columns)),
                "categorical": int(len(df.select_dtypes(include=["object", "category"]).columns)),
                "datetime": int(len(df.select_dtypes(include="datetime").columns)),
                "boolean": int(len(df.select_dtypes(include="bool").columns)),
            },
        }

    # ── Column Info ────────────────────────────────────────────
    def _column_info(self, df: pd.DataFrame) -> List[Dict]:
        result = []
        for col in df.columns:
            s = df[col]
            null_count = int(s.isnull().sum())
            unique_count = int(s.nunique())
            result.append({
                "name": col,
                "dtype": str(s.dtype),
                "null_count": null_count,
                "null_pct": round(null_count / len(s) * 100, 2) if len(s) else 0,
                "unique_count": unique_count,
                "unique_pct": round(unique_count / len(s) * 100, 2) if len(s) else 0,
                "is_numeric": bool(pd.api.types.is_numeric_dtype(s)),
                "sample_values": [str(v) for v in s.dropna().head(3).tolist()],
            })
        return result

    # ── Numeric Stats ──────────────────────────────────────────
    def _numeric_stats(self, df: pd.DataFrame) -> List[Dict]:
        num_df = df.select_dtypes(include="number")
        result = []
        for col in num_df.columns:
            s = num_df[col].dropna()
            if len(s) == 0:
                continue

            skewness = _safe(s.skew())
            kurt = _safe(s.kurtosis())

            if skewness is None:
                shape = "Unknown"
            elif abs(skewness) < 0.5:
                shape = "Approximately Normal"
            elif skewness > 1:
                shape = "Right Skewed (positive)"
            elif skewness < -1:
                shape = "Left Skewed (negative)"
            elif skewness > 0:
                shape = "Slightly Right Skewed"
            else:
                shape = "Slightly Left Skewed"

            mean_val = s.mean()
            result.append({
                "column": col,
                "count": int(s.count()),
                "mean": _safe(mean_val),
                "median": _safe(s.median()),
                "std": _safe(s.std()),
                "min": _safe(s.min()),
                "q1": _safe(s.quantile(0.25)),
                "q3": _safe(s.quantile(0.75)),
                "max": _safe(s.max()),
                "skewness": skewness,
                "kurtosis": kurt,
                "shape": shape,
                "cv": _safe(s.std() / mean_val * 100) if mean_val != 0 else None,
            })
        return result

    # ── Categorical Stats ──────────────────────────────────────
    def _categorical_stats(self, df: pd.DataFrame) -> List[Dict]:
        cat_df = df.select_dtypes(include=["object", "category"])
        result = []
        for col in cat_df.columns:
            s = df[col].dropna()
            if len(s) == 0:
                continue
            val_counts = s.value_counts().head(10)
            result.append({
                "column": col,
                "unique_count": int(s.nunique()),
                "most_frequent": str(val_counts.index[0]) if len(val_counts) else None,
                "most_frequent_count": int(val_counts.iloc[0]) if len(val_counts) else 0,
                "most_frequent_pct": round(val_counts.iloc[0] / len(s) * 100, 2) if len(val_counts) else 0,
                "top_values": [
                    {"value": str(k), "count": int(v), "pct": round(v / len(s) * 100, 2)}
                    for k, v in val_counts.items()
                ],
            })
        return result

    # ── Missing Analysis ───────────────────────────────────────
    def _missing_analysis(self, df: pd.DataFrame) -> List[Dict]:
        result = []
        for col in df.columns:
            null_count = int(df[col].isnull().sum())
            if null_count == 0:
                continue
            pct = null_count / len(df)
            result.append({
                "column": col,
                "missing_count": null_count,
                "missing_pct": round(pct * 100, 2),
                "severity": "Critical" if pct > 0.5 else ("High" if pct > 0.2 else ("Medium" if pct > 0.05 else "Low")),
            })
        return sorted(result, key=lambda x: x["missing_count"], reverse=True)

    # ── Outlier Detection (IQR) ────────────────────────────────
    def _outlier_analysis(self, df: pd.DataFrame) -> List[Dict]:
        num_df = df.select_dtypes(include="number")
        result = []
        for col in num_df.columns:
            s = num_df[col].dropna()
            if len(s) < 4:
                continue
            Q1, Q3 = s.quantile(0.25), s.quantile(0.75)
            IQR = Q3 - Q1
            if IQR == 0:
                continue
            lower, upper = Q1 - 1.5 * IQR, Q3 + 1.5 * IQR
            outliers = s[(s < lower) | (s > upper)]
            if len(outliers) == 0:
                continue
            pct = len(outliers) / len(s)
            result.append({
                "column": col,
                "outlier_count": int(len(outliers)),
                "outlier_pct": round(pct * 100, 2),
                "lower_bound": _safe(lower),
                "upper_bound": _safe(upper),
                "min_outlier": _safe(outliers.min()),
                "max_outlier": _safe(outliers.max()),
                "severity": "High" if pct > 0.1 else ("Medium" if pct > 0.05 else "Low"),
            })
        return sorted(result, key=lambda x: x["outlier_pct"], reverse=True)

    # ── Correlations ───────────────────────────────────────────
    def _correlations(self, df: pd.DataFrame) -> Dict:
        num_df = df.select_dtypes(include="number")
        if num_df.shape[1] < 2:
            return {"columns": [], "matrix": [], "top_pairs": []}

        corr = num_df.corr().round(3)
        cols = corr.columns.tolist()

        pairs = []
        for i in range(len(cols)):
            for j in range(i + 1, len(cols)):
                v = corr.iloc[i, j]
                if not np.isnan(v):
                    pairs.append({
                        "col1": cols[i],
                        "col2": cols[j],
                        "correlation": round(float(v), 3),
                        "strength": "Strong" if abs(v) > 0.7 else ("Moderate" if abs(v) > 0.4 else "Weak"),
                        "direction": "Positive" if v > 0 else "Negative",
                    })

        pairs = sorted(pairs, key=lambda x: abs(x["correlation"]), reverse=True)[:20]

        return {
            "columns": cols,
            "matrix": [[_safe(v) for v in row] for row in corr.values.tolist()],
            "top_pairs": pairs,
        }

    # ── Data Quality Score ─────────────────────────────────────
    def _data_quality_score(self, df: pd.DataFrame) -> Dict:
        total_cells = df.shape[0] * df.shape[1]
        missing_pct = df.isnull().sum().sum() / total_cells * 100 if total_cells else 0
        dup_pct = df.duplicated().sum() / len(df) * 100 if len(df) else 0
        constant_cols = [c for c in df.columns if df[c].nunique() <= 1]

        completeness = max(0.0, 100.0 - missing_pct)
        uniqueness = max(0.0, 100.0 - dup_pct)
        consistency = max(0.0, 100.0 - len(constant_cols) / max(len(df.columns), 1) * 100)

        overall = round(completeness * 0.5 + uniqueness * 0.3 + consistency * 0.2, 1)
        return {
            "overall_score": overall,
            "completeness": round(completeness, 1),
            "uniqueness": round(uniqueness, 1),
            "consistency": round(consistency, 1),
            "grade": "A" if overall >= 90 else ("B" if overall >= 75 else ("C" if overall >= 60 else ("D" if overall >= 40 else "F"))),
            "issues": {
                "missing_values": missing_pct > 5,
                "duplicates": dup_pct > 1,
                "constant_columns": len(constant_cols) > 0,
                "constant_column_names": constant_cols,
            },
        }

    # ── Distributions (histogram data) ────────────────────────
    def _distributions(self, df: pd.DataFrame, max_cols: int = 10) -> List[Dict]:
        num_df = df.select_dtypes(include="number")
        result = []
        for col in list(num_df.columns)[:max_cols]:
            s = num_df[col].dropna()
            if len(s) < 2:
                continue
            try:
                n_bins = min(20, max(5, int(np.sqrt(len(s)))))
                counts, bin_edges = np.histogram(s, bins=n_bins)
                result.append({
                    "column": col,
                    "bins": [f"{bin_edges[i]:.3g}–{bin_edges[i+1]:.3g}" for i in range(len(bin_edges) - 1)],
                    "counts": counts.tolist(),
                    "bin_edges": [_safe(v) for v in bin_edges.tolist()],
                })
            except Exception:
                pass
        return result
