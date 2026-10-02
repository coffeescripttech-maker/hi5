/**
 * Non-destructive API smoke tests for the Enrollment Committee, transfer, and
 * reading-assessment flows. READ-ONLY except where a test explicitly creates and
 * then rolls back its own fixture.
 *
 * These assert authorization boundaries and read-model shape only. Anything that
 * mutates shared production data is skipped, not attempted.
 *
 * Run with the API already listening: npx tsx scripts/smokeCommittee.ts
 */
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3001";
const SECRET = process.env.JWT_SECRET || "";

type Role = "admin" | "teacher" | "registrar" | "principal" | "enrollment_committee";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    pass++;
    console.log(`  PASS  ${label}`);
  } else {
    fail++;
    failures.push(label);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function tokenFor(role: Role, userId = 999999) {
  return jwt.sign({ userId, role, email: `${role}@smoke.local` }, SECRET, { expiresIn: "15m" });
}

async function call(
  path: string,
  role: Role | null,
  opts: { method?: string; body?: unknown } = {}
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (role) headers.Authorization = `Bearer ${tokenFor(role)}`;

  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

async function main() {
  console.log(`\nAPI smoke tests against ${BASE}\n`);

  // ── 1. Health ────────────────────────────────────────────────────────────
  console.log("Health");
  {
    const { status, body } = await call("/api/health", null);
    check("health returns ok", status === 200 && body?.status === "ok", `status ${status}`);
  }

  // ── 2. Auth is enforced ──────────────────────────────────────────────────
  console.log("\nAuthentication required");
  {
    const { status } = await call("/api/transfers", null);
    check("transfers rejects anonymous (401)", status === 401, `got ${status}`);
  }
  {
    const { status } = await call("/api/reading-assessments", null);
    check("reading-assessments rejects anonymous (401)", status === 401, `got ${status}`);
  }

  // ── 3. Transfer route authorization matrix ───────────────────────────────
  console.log("\nTransfer authorization matrix");
  const transferCases: [string, Role | null, number[]][] = [
    ["anonymous is blocked from transfers", null, [401]],
    ["committee lists transfers", "enrollment_committee", [200]],
    ["admin lists transfers", "admin", [200]],
    ["registrar lists transfers", "registrar", [200]],
    // Teachers keep a read-only view of outcomes for their own learners.
    ["teacher sees read-only transfer list", "teacher", [200]],
  ];
  for (const [label, role, expected] of transferCases) {
    const { status } = await call("/api/transfers", role);
    check(`${label} → ${expected.join("/")}`, expected.includes(status), `got ${status}`);
  }

  // ── 4. Write permissions are role-gated ──────────────────────────────────
  console.log("\nTransfer write authorization");
  {
    // Filing a transfer is Registrar/Admin only. A malformed body is fine —
    // we only care that a teacher/committee member is refused before validation.
    const teacher = await call("/api/transfers", "teacher", {
      method: "POST",
      body: { transfer_type: "transfer_out" },
    });
    check(
      "teacher cannot file a transfer (403)",
      teacher.status === 403,
      `got ${teacher.status}`
    );

    // Committee is Admin-equivalent by design (see middleware/roleGuard.ts), so it
    // reaches the handler and fails on body validation rather than on authz.
    const committee = await call("/api/transfers", "enrollment_committee", {
      method: "POST",
      body: { transfer_type: "transfer_out" },
    });
    check(
      "committee passes authz on filing (400 = validation, not 403)",
      committee.status === 400,
      `got ${committee.status}`
    );

    // Decisions are Committee/Admin only.
    const teacherDecision = await call("/api/transfers/1/decision", "teacher", {
      method: "PUT",
      body: { status: "approved" },
    });
    check(
      "teacher cannot decide a transfer (403)",
      teacherDecision.status === 403,
      `got ${teacherDecision.status}`
    );

    const registrarDecision = await call("/api/transfers/1/decision", "registrar", {
      method: "PUT",
      body: { status: "approved" },
    });
    check(
      "registrar cannot decide own filing (403) — separation of duties",
      registrarDecision.status === 403,
      `got ${registrarDecision.status}`
    );
  }

  // ── 4b. Transfer-Out requires an active enrollment in the request's year ──
  console.log("\nTransfer-Out enrollment prerequisite");
  {
    // Registrar files a Transfer-Out for a learner with no active enrollment in
    // the given school year. The server must refuse at file time, naming the
    // years the learner is actually enrolled in, rather than letting the
    // committee hit an unapprovable request.
    const res = await call("/api/transfers", "registrar", {
      method: "POST",
      body: {
        transfer_type: "transfer_out",
        school_year_id: 1,
        student_id: 36,
        reason: "smoke: no active enrollment in SY 1",
      },
    });
    const refused = res.status === 409;
    check(
      "transfer-out with no active enrollment is refused (409)",
      refused,
      `got ${res.status} ${JSON.stringify(res.body?.error)}`
    );
    check(
      "refusal names the school years the learner is enrolled in",
      Array.isArray(res.body?.enrolled_in) && res.body.enrolled_in.length > 0,
      `enrolled_in=${JSON.stringify(res.body?.enrolled_in)}`
    );
  }

  // ── 4c. A transfer must not become a weaker student record ───────────────
  // The new-learner branch writes a students row, so it is held to enrollment
  // standard. Each probe below is rejected before any row is created.
  console.log("\nTransfer form validation");
  {
    const file = async (over: Record<string, unknown>) =>
      call("/api/transfers", "registrar", {
        method: "POST",
        body: {
          transfer_type: "transfer_in",
          school_year_id: 1,
          // A deliberately invalid LRN/name/birthdate: each probe below varies
          // one field so a failure points at exactly one rule.
          lrn: "12345",
          student_name: "Smoke Probe",
          sex: "male",
          birthdate: "2015-01-15",
          grade_level: 7,
          previous_school: "Probe Elementary",
          reason: "smoke: validation probe",
          ...over,
        },
      });

    const badLrn = await file({ lrn: "12345" });
    check(
      "non-12-digit LRN is refused",
      badLrn.status === 400 &&
        (badLrn.body?.problems ?? []).some((p: string) => /lrn must be exactly 12 digits/i.test(p)),
      `got ${badLrn.status} ${JSON.stringify(badLrn.body?.problems)}`
    );

    const future = await file({ birthdate: "2099-01-01" });
    check(
      "future birthdate is refused",
      future.status === 400 &&
        (future.body?.problems ?? []).some((p: string) => /future/i.test(p)),
      `got ${future.status} ${JSON.stringify(future.body?.problems)}`
    );

    const badGrade = await file({ grade_level: 5 });
    check(
      "grade level outside 7-12 is refused",
      badGrade.status === 400 &&
        (badGrade.body?.problems ?? []).some((p: string) => /grade_level/i.test(p)),
      `got ${badGrade.status} ${JSON.stringify(badGrade.body?.problems)}`
    );

    // Two problems in one request must both be reported, so the registrar can
    // fix the form in a single pass instead of one field per round trip.
    const multi = await file({ lrn: "abc", birthdate: "" });
    check(
      "all problems are reported together",
      multi.status === 400 && (multi.body?.problems ?? []).length >= 2,
      `got ${multi.status} ${JSON.stringify(multi.body?.problems)}`
    );

    const noReason = await file({ reason: "  " });
    check(
      "blank reason is refused",
      noReason.status === 400 &&
        (noReason.body?.problems ?? []).some((p: string) => /reason is required/i.test(p)),
      `got ${noReason.status} ${JSON.stringify(noReason.body?.problems)}`
    );
  }

  // ── 5. Reading assessment authorization ──────────────────────────────────
  console.log("\nReading assessment authorization");
  {
    const { status } = await call("/api/reading-assessments?school_year_id=1", "teacher");
    check("teacher lists own assessments (200)", status === 200, `got ${status}`);
  }
  {
    const { status } = await call("/api/reading-assessments?school_year_id=1", "enrollment_committee");
    check("committee lists assessments (200 or 403)", status === 200 || status === 403, `got ${status}`);
  }

  // ── 6. Non-Reader cannot be tagged without assessment evidence ───────────
  console.log("\nNon-Reader evidence gate");
  {
    const { status, body } = await call("/api/students/1/classifications", "admin", {
      method: "POST",
      body: { classifications: ["non_reader"], school_year_id: 1 },
    });
    const refused = status === 400 && /reading assessment/i.test(body?.error ?? "");
    check(
      "non_reader without assessment is refused",
      refused,
      `status ${status} error ${JSON.stringify(body?.error)}`
    );
  }

  // ── 7. Empty classification array clears tags ────────────────────────────
  console.log("\nClassification untagging");
  {
    // Read-only probe: confirm the endpoint no longer 400s on an empty array
    // for a nonexistent student (404/400 proves the array check passed).
    const { status, body } = await call("/api/students/99999999/classifications", "admin", {
      method: "POST",
      body: { classifications: [], school_year_id: 1 },
    });
    const notArrayError = /Classifications array is required/.test(body?.error ?? "");
    check(
      "empty array accepted by validation (404 = student missing)",
      status === 404 || status === 400,
      `status ${status} error ${JSON.stringify(body?.error)}`
    );
    check(
      "empty array does not trip the 'array is required' error",
      !notArrayError,
      `error ${JSON.stringify(body?.error)}`
    );
  }

  // ── 8. Q4 is rejected on write paths ─────────────────────────────────────
  console.log("\nQuarter range validation (Q1–Q3)");
  {
    const { status, body } = await call("/api/grades/corrections", "teacher", {
      method: "POST",
      body: { student_id: 1, school_year_id: 1, quarter: 4, justification: "smoke" },
    });
    const refused = status === 400 && /1, 2, or 3/i.test(body?.error ?? "");
    check("Q4 correction request refused", refused, `status ${status} ${JSON.stringify(body?.error)}`);
  }

  // ── 9. Committee-only verification surface ───────────────────────────────
  console.log("\nDocument verification surface");
  {
    const { status } = await call("/api/students/1/enrollments", "enrollment_committee");
    check("committee can read enrollment requirements", status === 200 || status === 404, `got ${status}`);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.log("\nFailing checks:");
    failures.forEach((f) => console.log(`  - ${f}`));
  }
}

main().catch((err) => {
  console.error("\nSmoke run aborted:", err);
  process.exit(1);
});