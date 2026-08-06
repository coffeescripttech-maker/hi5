"""Shared linear-regression risk model for the HI5 Portal AI service.

Two layers, both least-squares linear regression (scikit-learn):

1. A **baseline model** trained on the school's historical quarterly general
   averages (feature = grading period 1..4, target = general average). This is
   the "trained model" a panelist would expect — it learns the typical grade
   trajectory for the school and is saved to ``saved/model.joblib``.

2. A **per-student fit** over the student's own quarterly averages, projecting
   their final grade at quarter 4. The exact same thresholds as the Node.js
   classifier (``server/src/utils/linearRegression.ts``) turn that projection
   into On Track / Needs Monitoring / At-Risk — so switching providers never
   changes the numbers the school sees.
"""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

# Classification thresholds — mirror server/src/utils/linearRegression.ts
PASSING = 75.0
MONITOR = 80.0
DECLINE = -1.0
IMPROVE = 1.0
FINAL_QUARTER = 4

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
SAVED_DIR = BASE_DIR / "saved"
DATA_CSV = DATA_DIR / "grades.csv"
MODEL_PATH = SAVED_DIR / "model.joblib"
METRICS_PATH = SAVED_DIR / "metrics.json"


def fit_linear(xs: np.ndarray, ys: np.ndarray) -> tuple[float, float]:
    """Least-squares fit → (slope, intercept) using scikit-learn."""
    model = LinearRegression().fit(np.asarray(xs, dtype=float).reshape(-1, 1), np.asarray(ys, dtype=float))
    return float(model.coef_[0]), float(model.intercept_)


def classify_quarters(quarters) -> dict:
    """Classify one student from ``[q1, q2, q3, q4]`` (missing = null).

    Returns the same shape as the Node.js ``StudentRisk`` object so the two
    providers are interchangeable.
    """
    points = [
        (i + 1, float(y))
        for i, y in enumerate(quarters)
        if y is not None and not (isinstance(y, float) and np.isnan(y))
    ]
    n = len(points)
    if n == 0:
        return {
            "risk_level": None,
            "trend": "stable",
            "current_average": None,
            "slope": None,
            "projected": None,
        }

    current_average = round(float(np.mean([y for _, y in points])), 2)

    if n == 1:
        avg = points[0][1]
        level = "at_risk" if avg < PASSING else ("needs_monitoring" if avg < MONITOR else "on_track")
        return {
            "risk_level": level,
            "trend": "stable",
            "current_average": current_average,
            "slope": None,
            "projected": round(avg, 2),
        }

    xs = np.array([p[0] for p in points], dtype=float)
    ys = np.array([p[1] for p in points], dtype=float)
    slope, intercept = fit_linear(xs, ys)
    projected = round(float(np.clip(intercept + slope * FINAL_QUARTER, 0, 100)), 2)

    if current_average < PASSING or projected < PASSING:
        level = "at_risk"
    elif slope < DECLINE or projected < MONITOR:
        level = "needs_monitoring"
    else:
        level = "on_track"

    trend = "improving" if slope > IMPROVE else ("declining" if slope < DECLINE else "stable")

    return {
        "risk_level": level,
        "trend": trend,
        "current_average": current_average,
        "slope": round(slope, 2),
        "projected": projected,
    }


def train_from_dataframe(df: pd.DataFrame) -> tuple[LinearRegression, dict]:
    """Fit the baseline model on (quarter → general average) rows."""
    df = df.dropna(subset=["avg_grade"])
    samples = int(len(df))
    if samples == 0:
        raise ValueError("No grade data to train on.")
    X = df["quarter"].to_numpy(dtype=float).reshape(-1, 1)
    y = df["avg_grade"].to_numpy(dtype=float)
    model = LinearRegression().fit(X, y)
    preds = model.predict(X)
    metrics = {
        "samples": samples,
        "slope": round(float(model.coef_[0]), 4),
        "intercept": round(float(model.intercept_), 4),
        "mae": round(float(np.mean(np.abs(y - preds))), 4),
        "r2": round(float(model.score(X, y)), 4),
    }
    return model, metrics


def load_metrics() -> dict | None:
    if METRICS_PATH.exists():
        with open(METRICS_PATH, "r", encoding="utf-8") as fh:
            return json.load(fh)
    return None


def save_model(model: LinearRegression, metrics: dict) -> None:
    SAVED_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    with open(METRICS_PATH, "w", encoding="utf-8") as fh:
        json.dump(metrics, fh, indent=2)


def load_or_train() -> tuple[LinearRegression | None, dict | None]:
    """Load the saved model, else train from the exported CSV, else None."""
    if MODEL_PATH.exists():
        return joblib.load(MODEL_PATH), load_metrics()
    if DATA_CSV.exists():
        model, metrics = train_from_dataframe(pd.read_csv(DATA_CSV))
        save_model(model, metrics)
        return model, metrics
    return None, None
