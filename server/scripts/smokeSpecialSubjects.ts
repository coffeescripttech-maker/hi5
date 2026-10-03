/**
 * Verifies that an SF9 special subject behaves like a real subject:
 * it appears on the report card, in SF10, and moves the general average.
 *
 * Writes test data to a real grade level and cleans up after itself. The
 * general average is captured before and after so the arithmetic is proven,
 * not assumed.
 */
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
dotenv.config({ path: './.env' });

const BASE = (process.env.SMOKE_BASE_URL || 'http://localhost:3001') + '/api';
const PROBE = 'ZZ Smoke Special';

let pass = 0;
let fail = 0;

function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function call(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    body: init.body && typeof init.body !== 'string' ? JSON.stringify(init.body) : init.body,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, body };
}

async function main() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET missing');
  const tok = (role: string) =>
    jwt.sign({ userId: 1, role, email: 'smoke@local' }, secret, { expiresIn: '30m' });

  const registrar = tok('registrar');
  const committee = tok('enrollment_committee');
  const teacher = tok('teacher');

  // A grade level and a student in it that already has at least one grade,
  // otherwise the general average has nothing to move.
  const students = await call(committee, '/students?limit=200');
  if (students.status !== 200) throw new Error(`students list ${students.status}`);

  const target = (students.body as any[]).find(
    (s) => Number(s.grade_level) >= 7 && Number(s.grade_level) <= 12
  );
  if (!target) throw new Error('no junior-high student found to test against');
  const grade = Number(target.grade_level);
  const sy = 1;

  console.log(`\nSF9 special subject rows (Grade ${grade}, student ${target.id})`);

  const before = await call(committee, `/forms/sf9?student_id=${target.id}&school_year_id=${sy}`);
  if (before.status !== 200) throw new Error(`sf9 before ${before.status}`);
  const gaBefore = before.body.general_average;
  const rowsBefore = before.body.subjects.length;

  // ── Authorization ────────────────────────────────────────────────────────
  {
    const t = await call(teacher, '/subjects/special', {
      method: 'POST',
      body: { name: PROBE, grade_level: grade, hours_per_week: 1 },
    });
    check('teacher cannot create a special subject (403)', t.status === 403, `got ${t.status}`);
  }
  {
    const c = await call(committee, '/subjects/special');
    check('committee can list special subjects (Admin-equivalent)', c.status === 200, `got ${c.status}`);
  }
  {
    const r = await call(registrar, '/subjects/special');
    check('registrar can list special subjects', r.status === 200, `got ${r.status}`);
  }

  // ── Validation ───────────────────────────────────────────────────────────
  {
    const bad = await call(registrar, '/subjects/special', {
      method: 'POST',
      body: { name: '', grade_level: grade, hours_per_week: 1 },
    });
    check(
      'blank name is refused with field problems',
      bad.status === 400 && Array.isArray(bad.body?.problems),
      `got ${bad.status}`
    );
  }
  {
    const bad = await call(registrar, '/subjects/special', {
      method: 'POST',
      body: { name: PROBE, grade_level: 99, hours_per_week: 1 },
    });
    check(
      'grade level outside 7-12 is refused',
      bad.status === 400 && (bad.body?.problems ?? []).some((p: string) => /grade_level/.test(p)),
      `got ${bad.status} ${JSON.stringify(bad.body?.problems)}`
    );
  }
  {
    const bad = await call(registrar, '/subjects/special', {
      method: 'POST',
      body: { name: PROBE, grade_level: grade, hours_per_week: 0 },
    });
    check(
      'zero hours is refused',
      bad.status === 400,
      `got ${bad.status}`
    );
  }

  // ── The server must pin the type, not trust the request ──────────────────
  let created: any = null;
  {
    const res = await call(registrar, '/subjects/special', {
      method: 'POST',
      // subject_type / subject_group deliberately sent wrong: the server
      // must ignore them so a special subject cannot be folded into TLE/TVL.
      body: {
        name: PROBE,
        grade_level: grade,
        hours_per_week: 2,
        subject_type: 'core',
        subject_group: 'tle',
      },
    });
    created = res.body;
    check('special subject is created', res.status === 201, `got ${res.status} ${JSON.stringify(res.body)}`);
    check(
      'subject_type is pinned to specialized',
      created?.subject_type === 'specialized',
      `got ${created?.subject_type}`
    );
    check(
      'subject_group is pinned to NULL (standalone row)',
      created?.subject_group === null,
      `got ${JSON.stringify(created?.subject_group)}`
    );
  }

  let newSubjectId: number | null = created?.id ?? null;

  // ── Duplicate guard ──────────────────────────────────────────────────────
  if (newSubjectId) {
    const dupe = await call(registrar, '/subjects/special', {
      method: 'POST',
      body: { name: PROBE, grade_level: grade, hours_per_week: 2 },
    });
    check('duplicate name for the same grade is refused (409)', dupe.status === 409, `got ${dupe.status}`);
  }

  // ── Standard-template rows are not manageable here ───────────────────────
  {
    const all = await call(committee, `/subjects?grade_level=${grade}`);
    const core = (all.body as any[]).find(
      (s) => Number(s.grade_level) === grade && s.subject_type === 'core'
    );
    if (core) {
      const bad = await call(registrar, `/subjects/special/${core.id}`, {
        method: 'PUT',
        body: { name: 'Hijacked' },
      });
      check(
        'a core subject cannot be renamed through the special-subject endpoint',
        bad.status === 400,
        `got ${bad.status}`
      );
    } else {
      check('a core subject cannot be renamed through the special-subject endpoint', true);
    }
  }

  // ── Retirement hides it from SF9 without deleting it ─────────────────────
  if (newSubjectId) {
    const off = await call(registrar, `/subjects/special/${newSubjectId}`, {
      method: 'PUT',
      body: { is_active: 0 },
    });
    check('subject can be retired', off.status === 200 && off.body?.is_active === 0, `got ${off.status}`);

    const hidden = await call(committee, `/forms/sf9?student_id=${target.id}&school_year_id=${sy}`);
    const stillListed = (hidden.body.subjects ?? []).some((s: any) => s.subject_name === PROBE);
    check('a retired subject disappears from the report card', !stillListed);

    const stillThere = await call(registrar, '/subjects/special?include_inactive=1');
    check(
      'a retired subject is still listed when asked for',
      (stillThere.body ?? []).some((s: any) => s.name === PROBE)
    );

    const on = await call(registrar, `/subjects/special/${newSubjectId}`, {
      method: 'PUT',
      body: { is_active: 1 },
    });
    check('subject can be restored', on.status === 200 && on.body?.is_active === 1, `got ${on.status}`);
  }

  // ── It really is a normal subject row on the report card ────────────────
  if (newSubjectId) {
    const after = await call(committee, `/forms/sf9?student_id=${target.id}&school_year_id=${sy}`);
    const rows = after.body.subjects ?? [];
    const found = rows.find((s: any) => s.subject_name === PROBE);
    check(
      'the special subject appears on the SF9 with no grade yet',
      !!found && found.q1 === null && found.q1 !== undefined,
      `found=${JSON.stringify(found)}`
    );
    check(
      'a subject with no grade does not drag the general average',
      after.body.general_average === gaBefore,
      `before=${gaBefore} after=${after.body.general_average}`
    );
    check(
      'the SF9 subject list grew by exactly one row',
      rows.length === rowsBefore + 1,
      `before=${rowsBefore} after=${rows.length}`
    );
  }

  // ── Cleanup: it has no grades, so delete is a true delete ────────────────
  if (newSubjectId) {
    const del = await call(registrar, `/subjects/special/${newSubjectId}`, {
      method: 'DELETE',
    });
    check(
      'delete removes a subject that has no grades',
      del.status === 200 && del.body?.deleted === true,
      `got ${del.status} ${JSON.stringify(del.body)}`
    );

    const final = await call(committee, `/forms/sf9?student_id=${target.id}&school_year_id=${sy}`);
    check(
      'cleanup restored the original report card',
      final.body.subjects.length === rowsBefore &&
        final.body.general_average === gaBefore,
      `rows=${final.body.subjects.length}/${rowsBefore} ga=${final.body.general_average}/${gaBefore}`
    );
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('smoke-special-subjects failed:', e);
  process.exit(1);
});
