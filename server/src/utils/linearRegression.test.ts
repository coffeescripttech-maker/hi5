/**
 * Unit tests for the at-risk linear regression model (src/utils/linearRegression.ts).
 *
 * Run with: npm test  (tsx --test)
 * Covers the pure math behind the on-track / needs-monitoring / at-risk
 * classification shown in teacher class lists and registrar/principal dashboards.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { linearRegression, classifyStudent } from "./linearRegression";

// ─── linearRegression ────────────────────────────────────────────────────────

test("linearRegression: empty input returns zeroed result", () => {
  assert.deepEqual(linearRegression([]), { slope: 0, intercept: 0 });
});

test("linearRegression: single point collapses to horizontal fit", () => {
  assert.deepEqual(linearRegression([{ x: 2, y: 80 }]), { slope: 0, intercept: 80 });
});

test("linearRegression: upward trend yields positive slope", () => {
  const { slope, intercept } = linearRegression([
    { x: 1, y: 80 },
    { x: 2, y: 85 },
    { x: 3, y: 90 },
  ]);
  assert.equal(slope, 5);
  assert.equal(intercept, 75);
});

test("linearRegression: downward trend yields negative slope", () => {
  const { slope, intercept } = linearRegression([
    { x: 1, y: 90 },
    { x: 2, y: 80 },
    { x: 3, y: 70 },
  ]);
  assert.equal(slope, -10);
  assert.equal(intercept, 100);
});

// ─── classifyStudent ─────────────────────────────────────────────────────────

test("classifyStudent: no grades → null risk, no prediction", () => {
  const r = classifyStudent([]);
  assert.equal(r.risk_level, null);
  assert.equal(r.trend, "stable");
  assert.equal(r.current_average, null);
  assert.equal(r.slope, null);
  assert.equal(r.projected, null);
});

test("classifyStudent: all-null quarters → null risk", () => {
  const r = classifyStudent([null, null, null, null]);
  assert.equal(r.risk_level, null);
  assert.equal(r.current_average, null);
});

test("classifyStudent: single failing quarter → at_risk", () => {
  const r = classifyStudent([70]);
  assert.equal(r.risk_level, "at_risk");
  assert.equal(r.trend, "stable");
  assert.equal(r.current_average, 70);
  assert.equal(r.slope, null);
  assert.equal(r.projected, 70);
});

test("classifyStudent: single mid quarter → needs_monitoring", () => {
  assert.equal(classifyStudent([78]).risk_level, "needs_monitoring");
});

test("classifyStudent: single strong quarter → on_track", () => {
  assert.equal(classifyStudent([90]).risk_level, "on_track");
});

test("classifyStudent: improving trend → on_track", () => {
  const r = classifyStudent([78, 80, 84]);
  assert.equal(r.risk_level, "on_track");
  assert.equal(r.trend, "improving");
  assert.equal(r.current_average, 80.67);
  assert.equal(r.slope, 3);
  assert.equal(r.projected, 86.67);
});

test("classifyStudent: declining to below-passing → at_risk", () => {
  const r = classifyStudent([85, 80, 74]);
  assert.equal(r.risk_level, "at_risk");
  assert.equal(r.trend, "declining");
  assert.equal(r.current_average, 79.67);
  assert.equal(r.slope, -5.5);
  assert.equal(r.projected, 68.67);
});

test("classifyStudent: stable but below monitor threshold → needs_monitoring", () => {
  const r = classifyStudent([76, 78, 77, 77]);
  assert.equal(r.risk_level, "needs_monitoring");
  assert.equal(r.trend, "stable");
  assert.equal(r.current_average, 77);
  assert.equal(r.slope, 0.2);
  assert.equal(r.projected, 77.3);
});

test("classifyStudent: high stable → on_track", () => {
  const r = classifyStudent([90, 91, 92]);
  assert.equal(r.risk_level, "on_track");
  assert.equal(r.trend, "stable");
  assert.equal(r.current_average, 91);
  assert.equal(r.slope, 1);
  assert.equal(r.projected, 93);
});
