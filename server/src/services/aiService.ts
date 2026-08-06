import { StudentRisk } from "../utils/linearRegression";

/**
 * Pluggable AI provider for risk classification.
 *
 * - "node" (default)   → built-in least-squares regression (linearRegression.ts)
 * - "python"           → scikit-learn + FastAPI microservice (ai-service/)
 *
 * Configured via AI_PROVIDER / AI_SERVICE_URL in server/.env. When the Python
 * service is unreachable the caller falls back to the local regression, so the
 * feature never breaks.
 */
export function getAiProvider(): "node" | "python" {
  return (process.env.AI_PROVIDER || "node").toLowerCase() === "python" ? "python" : "node";
}

export function getAiServiceUrl(): string {
  return process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";
}

/** Classify one student via the Python AI microservice. */
export async function predictWithPython(
  studentId: number,
  quarters: (number | null)[],
  baseUrl = getAiServiceUrl()
): Promise<StudentRisk> {
  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ student_id: studentId, quarters }),
  });
  if (!res.ok) {
    throw new Error(`AI service responded ${res.status}`);
  }
  const data: any = await res.json();
  return {
    risk_level: data.risk_level ?? null,
    trend: data.trend ?? "stable",
    current_average: data.current_average ?? null,
    slope: data.slope ?? null,
    projected: data.projected ?? null,
  };
}
