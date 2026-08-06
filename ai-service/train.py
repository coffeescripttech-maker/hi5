"""Export quarterly general averages from MySQL and train the baseline model.

Usage:  python train.py

Reads DB_* variables from server/.env (the same values the Node.js backend
uses), writes data/grades.csv, fits the baseline LinearRegression, and saves
the model + metrics to saved/.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pandas as pd
import pymysql
from dotenv import load_dotenv

import model as risk_model

# Windows consoles default to cp1252 and choke on symbols like ≈ and ×.
if sys.stdout and sys.stdout.encoding and sys.stdout.encoding.lower().startswith("cp"):
    sys.stdout.reconfigure(encoding="utf-8")

SERVER_ENV = Path(__file__).resolve().parents[1] / "server" / ".env"
load_dotenv(SERVER_ENV)

QUERY = """
SELECT g.student_id, g.quarter, ROUND(AVG(g.grade), 2) AS avg_grade
FROM grades g
GROUP BY g.student_id, g.quarter
ORDER BY g.student_id, g.quarter
"""


def main() -> None:
    conn = pymysql.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "hi5_portal"),
        charset="utf8mb4",
    )
    cur = conn.cursor()
    cur.execute(QUERY)
    columns = [d[0] for d in cur.description]
    rows = cur.fetchall()
    conn.close()
    df = pd.DataFrame(rows, columns=columns)

    risk_model.DATA_DIR.mkdir(parents=True, exist_ok=True)
    df.to_csv(risk_model.DATA_CSV, index=False)

    model, metrics = risk_model.train_from_dataframe(df)
    risk_model.save_model(model, metrics)
    print(f"[OK] Trained on {metrics['samples']} quarterly-average rows")
    print(f"   Baseline: avg grade ≈ {metrics['intercept']:.2f} + {metrics['slope']:.3f} × quarter")
    print(f"   R² = {metrics['r2']:.4f}  |  MAE = {metrics['mae']:.2f} points")
    print(f"   Saved model → {risk_model.MODEL_PATH}")


if __name__ == "__main__":
    main()
