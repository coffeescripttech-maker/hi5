import { test } from "node:test";
import assert from "node:assert/strict";
import { evalProgramEligibility, CohortStudent, ProgramType } from "../services/sectioningRules";

function base(over: Partial<CohortStudent> = {}): CohortStudent {
  return {
    enrollment_id: 1,
    student_id: 1,
    student_display_id: "S1",
    lrn: "L1",
    name: "Test Student",
    grade_level: 7,
    sex: "male",
    program: "regular",
    classifications: [],
    general_average: null,
    subject_finals: {},
    has_grades: true,
    science: null,
    math: null,
    english: null,
    filipino: null,
    entrance_exam_grade: null,
    entrance_exam_passed: true,
    interview_passed: true,
    current_section_id: null,
    current_section_name: null,
    current_section_type: null,
    prev_section_name: null,
    prev_section_type: null,
    prev_section_id: null,
    ...over,
  } as CohortStudent;
}

function eligible(type: ProgramType, mode: "entrance" | "continuing", over: Partial<CohortStudent>) {
  const r = evalProgramEligibility(base(over), type, mode);
  return r.eligible;
}

function reasons(type: ProgramType, mode: "entrance" | "continuing", over: Partial<CohortStudent>): string[] {
  const r = evalProgramEligibility(base(over), type, mode);
  return r.reasons;
}

test("STE entrance: GWA >=85 + Sci/Math >=85 + exam/interview", () => {
  assert.equal(eligible("ste", "entrance", { general_average: 88, science: 90, math: 90 }), true);
  assert.equal(eligible("ste", "entrance", { general_average: 84, science: 90, math: 90 }), false);
  assert.equal(eligible("ste", "entrance", { general_average: 88, science: 84, math: 90 }), false);
  assert.equal(eligible("ste", "entrance", { general_average: 88, science: 90, math: 90, entrance_exam_passed: null }), false);
  assert.equal(eligible("ste", "entrance", { general_average: 88, science: 90, math: 90, interview_passed: null }), false);
});

test("STE entrance: low MAPEH/TLE ignored (no all-subject floor)", () => {
  assert.equal(
    eligible("ste", "entrance", {
      general_average: 88,
      science: 90,
      math: 90,
      subject_finals: { mapeh: 70, tle: 60 },
    }),
    true
  );
});

test("STE entrance: no grades yet → lenient on academics", () => {
  assert.equal(
    eligible("ste", "entrance", {
      has_grades: false,
      general_average: null,
      science: null,
      math: null,
    }),
    true
  );
});

test("SPFL entrance: no GWA gate; Eng/Fil >=85", () => {
  assert.equal(eligible("spfl", "entrance", { general_average: 80, english: 90, filipino: 90 }), true);
  assert.equal(eligible("spfl", "entrance", { general_average: 80, english: 84, filipino: 90 }), false);
  assert.equal(eligible("spfl", "entrance", { general_average: 80, english: 90, filipino: null }), false);
});

test("SPFL entrance: other subjects ignored", () => {
  assert.equal(
    eligible("spfl", "entrance", {
      general_average: 80,
      english: 90,
      filipino: 90,
      subject_finals: { mapeh: 70 },
    }),
    true
  );
});

test("STE continuing: GWA>=85 + Sci/Math>=85; missing tolerated", () => {
  assert.equal(eligible("ste", "continuing", { general_average: 88, science: 90, math: 90 }), true);
  assert.equal(eligible("ste", "continuing", { general_average: 80, science: 90, math: 90 }), false);
  assert.equal(eligible("ste", "continuing", { general_average: 88, science: null, math: 90 }), true);
  assert.equal(eligible("ste", "continuing", { general_average: 88, science: 80, math: 90 }), false);
});

test("SPFL continuing: no GWA gate; Eng/Fil >=85; missing tolerated", () => {
  assert.equal(eligible("spfl", "continuing", { general_average: 70, english: 90, filipino: 90 }), true);
  assert.equal(eligible("spfl", "continuing", { general_average: 90, english: 80, filipino: 90 }), false);
  assert.equal(eligible("spfl", "continuing", { general_average: 70, english: null, filipino: null }), true);
});

test("SPFL continuing: no GWA gate (verifies reasons not forcing GWA)", () => {
  const r = reasons("spfl", "continuing", { general_average: 70, english: 90, filipino: 90 });
  assert.equal(r.length, 0);
});

/* ── SPJ (previously unsupported) + configurable minimums ── */

test("SPJ entrance: GA >=85 + Eng/Fil >=85 (legacy rules apply by default)", () => {
  assert.equal(eligible("spj", "entrance", { general_average: 88, english: 90, filipino: 90 }), true);
  assert.equal(eligible("spj", "entrance", { general_average: 84, english: 90, filipino: 90 }), false);
  assert.equal(eligible("spj", "entrance", { general_average: 88, english: 84, filipino: 90 }), false);
  assert.equal(eligible("spj", "entrance", { general_average: 88, english: 90, filipino: null }), false);
  assert.equal(eligible("spj", "entrance", { general_average: 88, english: 90, filipino: 90, entrance_exam_passed: null }), false);
  assert.equal(eligible("spj", "entrance", { general_average: 88, english: 90, filipino: 90, interview_passed: null }), false);
});

test("SPJ continuing: GA>=85 + Eng/Fil>=85; missing tolerated", () => {
  assert.equal(eligible("spj", "continuing", { general_average: 88, english: 90, filipino: 90 }), true);
  assert.equal(eligible("spj", "continuing", { general_average: 80, english: 90, filipino: 90 }), false);
  assert.equal(eligible("spj", "continuing", { general_average: 88, english: 80, filipino: 90 }), false);
  assert.equal(eligible("spj", "continuing", { general_average: 88, english: null, filipino: 90 }), true);
});

test("Configured minimums: screen values replace the legacy 85/75 rules", () => {
  const cfg = {
    ste: { ga: 90, science: 90, math: 90, english: null, filipino: null },
    spfl: { ga: 80, science: null, math: null, english: 84, filipino: 84 },
    spj: { ga: null, science: null, math: null, english: 85, filipino: 85 },
    regular: { ga: 75 },
  };
  // STE raised to 90: 88/85 isenough for the old rule, not the new one.
  assert.equal(eligible("ste", "entrance", { general_average: 88, science: 85, math: 85 }), true);
  const r = evalProgramEligibility(base({ general_average: 88, science: 85, math: 85 }), "ste", "entrance", cfg);
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.some(x => /General Average 88.00 below 90/.test(x)));

  // SPFL gains an 80 GA rule and drops 85→84 on subjects.
  assert.equal(
    evalProgramEligibility(base({ general_average: 80, english: 84, filipino: 84 }), "spfl", "entrance", cfg).eligible,
    true
  );
  assert.equal(
    evalProgramEligibility(base({ general_average: 79, english: 90, filipino: 90 }), "spfl", "entrance", cfg).eligible,
    false
  );

  // SPJ without a GA rule: only Eng/Fil are checked.
  assert.equal(
    evalProgramEligibility(base({ general_average: 70, english: 85, filipino: 85 }), "spj", "entrance", cfg).eligible,
    true
  );
});

test("Configured null subject minimums never break eligibility", () => {
  const cfg = {
    ste: { ga: 85, science: null, math: null, english: null, filipino: null },
    spfl: { ga: null, science: null, math: null, english: null, filipino: null },
    spj: { ga: 85, science: null, math: null, english: null, filipino: null },
    regular: { ga: 75 },
  };
  // Science/Math dropped for STE: only GA matters.
  const r = evalProgramEligibility(base({ general_average: 90, science: null, math: null }), "ste", "entrance", cfg);
  assert.equal(r.eligible, true);
});
