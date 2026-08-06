"""FastAPI microservice for the HI5 Portal AI at-risk model.

Run the service (after installing requirements.txt):

    uvicorn main:app --host 127.0.0.1 --port 8000

Train the baseline model on the school's real grades:

    python train.py            # exports from MySQL → data/grades.csv + saves model

The Node.js backend talks to this service only when ``AI_PROVIDER=python`` in
``server/.env``; the default ``node`` provider keeps the built-in regression.
"""

from __future__ import annotations

from typing import List, Optional

import pandas as pd
from fastapi import FastAPI, Response, status
from pydantic import BaseModel

import model as risk_model

app = FastAPI(title="HI5 Portal — At-Risk AI Service", version="1.0.0")

# Loaded once at startup; refreshable via POST /train.
global_model, global_metrics = risk_model.load_or_train()


class PredictRequest(BaseModel):
    student_id: Optional[int] = None
    # Indexed by quarter-1: [q1, q2, q3, q4]; missing quarters are null.
    quarters: List[Optional[float]]


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_trained": global_model is not None,
        "samples": (global_metrics or {}).get("samples", 0),
        "algorithm": "scikit-learn LinearRegression",
    }


@app.get("/model")
def model_info():
    return {
        "algorithm": "scikit-learn LinearRegression",
        "trained": global_model is not None,
        "metrics": global_metrics,
        "training_data": str(risk_model.DATA_CSV.name) if risk_model.DATA_CSV.exists() else None,
    }


@app.post("/predict")
def predict(req: PredictRequest):
    result = risk_model.classify_quarters(req.quarters)
    result["student_id"] = req.student_id
    return result


@app.post("/train")
def train(response: Response):
    if not risk_model.DATA_CSV.exists():
        response.status_code = status.HTTP_409_CONFLICT
        return {
            "error": "No training data found. Run `python train.py` first to export grades from MySQL.",
        }
    df = pd.read_csv(risk_model.DATA_CSV)
    model, metrics = risk_model.train_from_dataframe(df)
    risk_model.save_model(model, metrics)
    global global_model, global_metrics
    global_model, global_metrics = model, metrics
    return {"message": "Model trained successfully.", "metrics": metrics}
