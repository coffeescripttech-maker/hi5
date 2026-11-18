/**
 * LIS Import (client revision: Hi5_Portal_LIS_Import_Expected_Behavior.md).
 *
 * Lets the Registrar/Administrator import a DepEd LIS learner file to fill
 * learner details Hi5 does not yet hold, so they print automatically on SF1.
 *
 * Hard rules (per the client doc):
 *   - Existing learners only — never creates a learner, never touches
 *     enrollment status, BOSY/EOSY, dropped/transferred flags, or grades.
 *   - Identity fields (name, birthdate, sex) are COMPARED, never written;
 *     differences become mismatches the Registrar resolves via Edit details.
 *   - New detail fields fill-if-empty by default (per-group overwrite).
 *   - The uploaded file is processed in memory and never stored.
 *   - One transaction per apply; every changed field written to
 *     student_field_history (reason 'LIS import') with a batch id; one
 *     Activity Log summary per import. Re-importing the same file is safe.
 */
import { Request, Response } from "express";
import { RowDataPacket } from "mysql2";
import * as XLSX from "xlsx";
import { randomUUID } from "crypto";
import { query, getConnection } from "../config/database";
import { logActivity } from "../utils/activityLogger";
import { createNotification } from "../services/notify";
import { namesMatch, parseName } from "../utils/nameFormatter";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 5000;
const ALLOWED_EXT = ["xlsx", "xls", "csv"];

/** Target importable learner fields → the LIS header names they may map from. */
const FIELD_HEADERS: Record<string, string[]> = {
  lrn: ["LRN", "Learner Reference Number", "Learner LRN"],
  last_name: ["Surname", "Last Name", "Apelyido", "Student Surname"],
  first_name: ["Given Name", "First Name", "Pangalan", "Student First Name"],
  middle_name: ["Middle Name", "Middle", "Student Middle Name"],
  name_ext: ["Extension Name", "Name Extension", "Suffix", "Ext Name"],
  birthdate: ["Date of Birth", "Birthdate", "Birthday", "Birth Date"],
  sex: ["Sex", "Gender", "Kasarian"],
  mother_tongue: ["Mother Tongue", "Mother Tongue Language"],
  ip_ethnic_group: ["Indigenous People", "IP (Ethnic Group)", "IP Ethnic Group", "Ethnic Group"],
  religion: ["Religion"],
  house_street: ["House No", "House No./Street", "House #/Street", "House Street", "Street Address", "House/Street"],
  barangay: ["Barangay", "Brgy"],
  city_municipality: ["Municipality", "City", "City/Municipality", "Municipality/City"],
  province: ["Province"],
  zip_code: ["ZIP", "Zip Code", "ZIP Code"],
  father_name: ["Father's Name", "Father Name", "Father"],
  mother_name: ["Mother's Name", "Mother's Maiden Name", "Mother Maiden Name", "Mother"],
  guardian: ["Guardian Name", "Name of Guardian", "Guardian"],
  guardian_relationship: ["Relationship", "Guardian Relationship", "Relation to Learner", "Relationship to Learner"],
  contact: ["Contact No", "Contact Number", "Cellphone No", "Mobile No", "Contact Number of Parent or Guardian"],
  disability: ["Disability", "Special Needs", "PWD", "Disability/Special Needs"]
};

/** Field groups for the Fill-empty-only / Overwrite toggles. */
const FIELD_GROUPS: { group: string; fields: string[] }[] = [
  { group: "personal", fields: ["mother_tongue", "ip_ethnic_group", "religion"] },
  { group: "address", fields: ["house_street", "barangay", "city_municipality", "province", "zip_code"] },
  { group: "guardian", fields: ["father_name", "mother_name", "guardian", "guardian_relationship", "contact"] }
];

/** The SF1 saved-edit cell key for each importable field (to flag rows whose
 *  SF1 cell already has a manually saved value). */
const SF1_CELL_KEYS: Record<string, string> = {
  mother_tongue: "s:mothertongue",
  ip_ethnic_group: "s:ip",
  religion: "s:religion",
  house_street: "s:addr_house",
  barangay: "s:addr_barangay",
  city_municipality: "s:addr_city",
  province: "s:addr_province",
  father_name: "s:father",
  mother_name: "s:mother",
  guardian: "s:guardian_name",
  guardian_relationship: "s:guardian_rel",
  contact: "s:contact"
};

/** Normalize a header cell for matching: lowercase, alphanumerics only. */
const normHeader = (v: string): string =>
  String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const FIELD_CANDIDATES: Record<string, string[]> = Object.fromEntries(
  Object.entries(FIELD_HEADERS).map(([field, cands]) => [
    field,
    cands.map(normHeader)
  ])
);

interface SheetCell {
  v: unknown;
}

/** Read a row cell as cleaned text (plain values from sheet_to_json header:1). */
function cellText(row: unknown[], col: number | undefined): string {
  if (col === undefined) return "";
  const v = row[col];
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

/** Normalize a birthdate cell → "YYYY-MM-DD" or null when unreadable. */
function cleanBirthdate(row: unknown[], col: number | undefined): string | null {
  if (col === undefined) return null;
  const v = row[col];
  if (v === undefined || v === null || String(v).trim() === "") return null;
  if (v instanceof Date) {
    const d = v;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const mm = Number(mdy[1]);
    const dd = Number(mdy[2]);
    const yyyy = Number(mdy[3]);
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
  }
  const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymd) {
    const mm = Number(ymd[2]);
    const dd = Number(ymd[3]);
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${ymd[1]}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return null;
}

/** Normalize a sex cell → "male"/"female" or null when unreadable. */
function cleanSex(row: unknown[], col: number | undefined): string | null {
  if (col === undefined) return null;
  const s = String(cellText(row, col)).toLowerCase();
  if (!s) return null;
  if (s === "m" || s.startsWith("male")) return "male";
  if (s === "f" || s.startsWith("female")) return "female";
  return null;
}

/** Normalize an LRN cell → 12-digit string or null when invalid. */
function cleanLrn(row: unknown[], col: number | undefined): string | null {
  if (col === undefined) return null;
  const digits = String(cellText(row, col)).replace(/\D/g, "");
  if (digits.length !== 12) return null;
  return digits;
}

/** Does the learner already carry a 'pwd' classification tag? */
async function hasPwdTag(studentId: number): Promise<boolean> {
  const rows = await query<RowDataPacket[]>(
    "SELECT 1 FROM student_classifications WHERE student_id = ? AND classification = 'pwd' LIMIT 1",
    [studentId]
  );
  return rows.length > 0;
}

/** Parse + classify every data row (shared by preview and apply). */
interface EngineRow {
  rowNum: number;
  lrn: string;
  name: string;
  result: "matched_update" | "matched_no_change" | "mismatch" | "not_in_hi5" | "error";
  error?: string;
  mismatches?: string[];
  student_id?: number;
  hi5_name?: string;
  changes?: { field: string; label: string; group: string; old: string; new: string; savedEdit: boolean }[];
  has_saved_sf_edit?: boolean;
  pwd_value?: string;
  pwd_already?: boolean;
}

/** Locate the header row and map columns per field (auto-detection). */
function mapColumns(
  sheetRows: unknown[][]
): { headerRowIdx: number; mapping: Record<string, number>; headerTexts: string[] } {
  const maxCols = Math.max(...sheetRows.slice(0, 12).map(r => r.length), 0);
  let bestIdx = -1;
  let bestScore = 0;
  for (let r = 0; r < Math.min(sheetRows.length, 12); r++) {
    let score = 0;
    for (let c = 0; c < maxCols; c++) {
      const h = normHeader(String(sheetRows[r][c] ?? ""));
      if (!h) continue;
      for (const cands of Object.values(FIELD_CANDIDATES)) {
        if (cands.some(cand => h === cand)) {
          score++;
          break;
        }
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestIdx = r;
    }
  }
  if (bestIdx < 0 || bestScore < 2) {
    throw new Error("Could not find a header row with known LIS column names. Adjust the file or rename the header row.");
  }
  const headerTexts: string[] = [];
  for (let c = 0; c < maxCols; c++) {
    headerTexts.push(String(sheetRows[bestIdx][c] ?? "").trim());
  }
  const mapping: Record<string, number> = {};
  for (const [field, cands] of Object.entries(FIELD_CANDIDATES)) {
    for (let c = 0; c < maxCols; c++) {
      const h = normHeader(headerTexts[c]);
      if (h && cands.includes(h)) {
        mapping[field] = c;
        break;
      }
    }
  }
  return { headerRowIdx: bestIdx, mapping, headerTexts };
}

async function runEngine(
  buffer: Buffer,
  schoolYearId: number,
  mappingOverride: Record<string, number> | null,
  modes: Record<string, string>
): Promise<{ rowsOut: EngineRow[]; counts: Record<string, number>; mapping: Record<string, number>; headerRowIdx: number; headerTexts: string[] }> {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("The file has no worksheets.");
  const sheet = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<SheetCell[]>(sheet, {
    header: 1,
    raw: true,
    defval: null
  }) as SheetCell[][];
  if (matrix.length === 0) throw new Error("The file is empty.");

  const auto = mapColumns(matrix);
  const mapping = mappingOverride ?? auto.mapping;
  const headerRowIdx = auto.headerRowIdx;
  const headerTexts = auto.headerTexts;

  const dataRows = matrix.slice(headerRowIdx + 1).filter(r => r.some(c => c !== undefined && c !== null && String(c).trim() !== ""));
  if (dataRows.length === 0) throw new Error("No data rows found under the header row.");
  if (dataRows.length > MAX_ROWS) {
    throw new Error(`The file has ${dataRows.length} data rows — the limit is ${MAX_ROWS}. Split the file.`);
  }

  const lrnList = dataRows
    .map(r => cleanLrn(r, mapping.lrn))
    .filter((v): v is string => !!v);
  const placeholders = lrnList.length > 0 ? lrnList.map(() => "?").join(",") : "NULL";
  const hi5Rows = await query<RowDataPacket[]>(
    `SELECT id, student_id, lrn, name, last_name, first_name, middle_name, name_ext, sex, birthdate,
            mother_tongue, ip_ethnic_group, religion, house_street, barangay, city_municipality, province, zip_code,
            father_name, mother_name, guardian, guardian_relationship, contact, guardian_4ps
       FROM students WHERE lrn IN (${placeholders})`,
    lrnList
  );
  const byLrn = new Map<string, RowDataPacket>();
  for (const s of hi5Rows) byLrn.set(String(s.lrn), s);

  const savedEdits = await query<RowDataPacket[]>(
    `SELECT student_id, field_key, value FROM sf_form_edits
      WHERE school_year_id = ? AND form = 'SF1' AND student_id IS NOT NULL
        AND field_key IN ('s:mothertongue','s:ip','s:religion','s:addr_house','s:addr_barangay','s:addr_city','s:addr_province','s:father','s:mother','s:guardian_name','s:guardian_rel','s:contact')`,
    [schoolYearId]
  );
  const savedEditsByStudent = new Map<number, Set<string>>();
  for (const e of savedEdits) {
    const set = savedEditsByStudent.get(Number(e.student_id)) ?? new Set<string>();
    set.add(String(e.field_key));
    savedEditsByStudent.set(Number(e.student_id), set);
  }

  const rowsOut: EngineRow[] = [];
  const seenLrns = new Set<string>();
  const counts: Record<string, number> = {
    matched_update: 0,
    matched_no_change: 0,
    mismatch: 0,
    not_in_hi5: 0,
    error: 0
  };

  for (const [rowIdx, row] of dataRows.entries()) {
    const rowNum = headerRowIdx + 2 + rowIdx; // 1-based sheet row
    const lrn = cleanLrn(row, mapping.lrn);
    const fileLast = cellText(row, mapping.last_name);
    const fileFirst = cellText(row, mapping.first_name);
    const fileMiddle = cellText(row, mapping.middle_name);
    const fileName = [fileLast, fileFirst, fileMiddle].filter(Boolean).join(", ");
    const fileBd = cleanBirthdate(row, mapping.birthdate);
    const fileSex = cleanSex(row, mapping.sex);

    const base = { rowNum, lrn: lrn || cellText(row, mapping.lrn), name: fileName };

    if (!lrn) {
      counts.error++;
      rowsOut.push({ ...base, result: "error", error: cellText(row, mapping.lrn) ? "Bad LRN (not 12 digits)." : "LRN is empty." });
      continue;
    }
    if (seenLrns.has(lrn)) {
      counts.error++;
      rowsOut.push({ ...base, lrn, result: "error", error: "Duplicate LRN in the file." });
      continue;
    }
    seenLrns.add(lrn);
    if (mapping.sex !== undefined && fileSex === null && cellText(row, mapping.sex)) {
      counts.error++;
      rowsOut.push({ ...base, lrn, result: "error", error: "Unreadable sex value." });
      continue;
    }
    if (mapping.birthdate !== undefined && fileBd === null && cellText(row, mapping.birthdate)) {
      counts.error++;
      rowsOut.push({ ...base, lrn, result: "error", error: "Unreadable birthdate." });
      continue;
    }

    const hi5 = byLrn.get(lrn);
    if (!hi5) {
      counts.not_in_hi5++;
      rowsOut.push({ ...base, lrn, result: "not_in_hi5", error: "LRN is not enrolled in Hi5 Portal — skipped, never created." });
      continue;
    }

    // Identity comparison (name / birthdate / sex) — never overwritten
    const storedParts = parseName(String(hi5.name));
    const hi5Last = String(hi5.last_name ?? storedParts.last ?? "");
    const hi5First = String(hi5.first_name ?? storedParts.first ?? "");
    const fileComma = `${fileLast}, ${fileFirst} ${fileMiddle}`.replace(/,\s*$/, "");
    const nameMatches =
      namesMatch(fileComma, String(hi5.name)) ||
      (fileLast.toLowerCase() === hi5Last.toLowerCase() &&
        fileFirst.toLowerCase() === hi5First.toLowerCase());
    const bdMatches = !fileBd || String(hi5.birthdate).slice(0, 10) === fileBd;
    const sexMatches = !fileSex || String(hi5.sex).toLowerCase() === fileSex;
    const mismatches: string[] = [];
    if (!nameMatches) mismatches.push(`Name: file "${fileName}" vs Hi5 "${hi5.name}"`);
    if (fileBd && !bdMatches) mismatches.push(`Birthdate: file ${fileBd} vs Hi5 ${String(hi5.birthdate).slice(0, 10)}`);
    if (fileSex && !sexMatches) mismatches.push(`Sex: file ${fileSex} vs Hi5 ${String(hi5.sex)}`);
    if (mismatches.length > 0) {
      counts.mismatch++;
      rowsOut.push({ ...base, lrn, result: "mismatch", mismatches });
      continue;
    }

    // Candidate detail changes per group + mode
    const candidateFields: Record<string, { old: string; new: string; group: string; savedEdit: boolean }> = {};
    for (const { group, fields } of FIELD_GROUPS) {
      for (const field of fields) {
        const col = mapping[field];
        if (col === undefined) continue;
        const newVal = cellText(row, col);
        if (!newVal) continue;
        const oldVal = String(hi5[field as keyof RowDataPacket] ?? "");
        const mode = modes[group] || "fill";
        if (mode === "overwrite" || !oldVal) {
          if (oldVal.toLowerCase() !== newVal.toLowerCase()) {
            const savedEdit = (savedEditsByStudent.get(Number(hi5.id)) ?? new Set()).has(SF1_CELL_KEYS[field]);
            candidateFields[field] = { old: oldVal, new: newVal, group, savedEdit };
          }
        }
      }
    }
    const changeList = Object.entries(candidateFields).map(([field, c]) => ({
      field,
      label: field,
      old: c.old,
      new: c.new,
      group: c.group,
      savedEdit: c.savedEdit
    }));
    const hasSavedEdit = changeList.some(c => c.savedEdit);
    const disabilityValue = mapping.disability !== undefined ? cellText(row, mapping.disability) : "";

    if (changeList.length === 0) {
      counts.matched_no_change++;
      rowsOut.push({
        ...base,
        lrn,
        result: "matched_no_change",
        pwd_value: disabilityValue,
        pwd_already: disabilityValue ? await hasPwdTag(Number(hi5.id)) : false
      });
      continue;
    }
    counts.matched_update++;
    rowsOut.push({
      ...base,
      lrn,
      result: "matched_update",
      student_id: Number(hi5.id),
      hi5_name: String(hi5.name),
      changes: changeList,
      has_saved_sf_edit: hasSavedEdit,
      pwd_value: disabilityValue,
      pwd_already: disabilityValue ? await hasPwdTag(Number(hi5.id)) : false
    });
  }

  return { rowsOut, counts, mapping, headerRowIdx, headerTexts };
}

/** POST /api/lis/import/preview — multipart: file + school_year_id. No writes. */
export async function lisImportPreview(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Choose an .xlsx, .xls, or .csv file to import." });
      return;
    }
    if (req.file.size > MAX_FILE_BYTES) {
      res.status(400).json({ error: "The file exceeds the 10 MB limit." });
      return;
    }
    const schoolYearId = parseInt(String(req.body.school_year_id || ""));
    if (!Number.isInteger(schoolYearId)) {
      res.status(400).json({ error: "school_year_id is required." });
      return;
    }
    const ext = (req.file.originalname.split(".").pop() || "").toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      res.status(400).json({ error: `Unsupported file type ".${ext}". Allowed: .xlsx, .xls, .csv.` });
      return;
    }
    const result = await runEngine(req.file.buffer, schoolYearId, null, {});
    res.json({
      mapping: result.mapping,
      header_texts: result.headerTexts,
      counts: result.counts,
      rows: result.rowsOut
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to read the LIS file." });
  }
}

/** POST /api/lis/import/apply — multipart: file + school_year_id + mapping JSON + modes JSON. */
export async function lisImportApply(req: Request, res: Response): Promise<void> {
  const batchId = randomUUID();
  try {
    if (!req.file) {
      res.status(400).json({ error: "Choose an .xlsx, .xls, or .csv file to import." });
      return;
    }
    if (req.file.size > MAX_FILE_BYTES) {
      res.status(400).json({ error: "The file exceeds the 10 MB limit." });
      return;
    }
    const schoolYearId = parseInt(String(req.body.school_year_id || ""));
    if (!Number.isInteger(schoolYearId)) {
      res.status(400).json({ error: "school_year_id is required." });
      return;
    }
    let mappingOverride: Record<string, number> | null = null;
    if (req.body.mapping) {
      try {
        mappingOverride = JSON.parse(String(req.body.mapping));
      } catch {
        res.status(400).json({ error: "Invalid mapping payload." });
        return;
      }
    }
    let modes: Record<string, string> = {};
    if (req.body.modes) {
      try {
        modes = JSON.parse(String(req.body.modes));
      } catch {
        res.status(400).json({ error: "Invalid modes payload." });
        return;
      }
    }
    const ext = (req.file.originalname.split(".").pop() || "").toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      res.status(400).json({ error: `Unsupported file type ".${ext}". Allowed: .xlsx, .xls, .csv.` });
      return;
    }

    const engine = await runEngine(req.file.buffer, schoolYearId, mappingOverride, modes);
    const updatable = engine.rowsOut.filter(r => r.result === "matched_update");

    const conn = await getConnection();
    let applied = 0;
    try {
      await conn.beginTransaction();
      for (const row of updatable) {
        const studentId = Number(row.student_id);
        const setClauses: string[] = [];
        const setParams: (string | number | null)[] = [];
        const allowed: { field: string; old: string; new: string }[] = [];
        for (const ch of row.changes ?? []) {
          const fieldName = ch.field as string;
          const groupMode = modes[ch.group as string] || "fill";
          const [curRows] = await conn.execute<RowDataPacket[]>(
            `SELECT ${fieldName} FROM students WHERE id = ?`,
            [studentId]
          );
          const currentValStr = String(curRows[0]?.[fieldName] ?? "");
          if (groupMode !== "overwrite" && currentValStr.trim() !== "") continue; // fill-empty-only
          setClauses.push(`${fieldName} = ?`);
          setParams.push(ch.new);
          allowed.push({ field: fieldName, old: currentValStr, new: ch.new });
        }
        if (setClauses.length === 0) continue;
        await conn.execute(`UPDATE students SET ${setClauses.join(", ")} WHERE id = ?`, [...setParams, studentId]);
        for (const f of allowed) {
          await conn.execute(
            `INSERT INTO student_field_history (student_id, field, old_value, new_value, reason, changed_by, batch_id)
             VALUES (?, ?, ?, ?, 'LIS import', ?, ?)`,
            [studentId, f.field, f.old, f.new, req.user!.userId, batchId]
          );
          applied++;
        }
        // PWD classification: only when the file's disability column has a
        // value for this learner and the tag is not already present.
        if (row.pwd_value && !row.pwd_already) {
          const [pwdRows] = await conn.execute<RowDataPacket[]>(
            "SELECT 1 FROM student_classifications WHERE student_id = ? AND classification = 'pwd' LIMIT 1",
            [studentId]
          );
          if (pwdRows.length === 0) {
            await conn.execute(
              "INSERT INTO student_classifications (student_id, classification, school_year_id) VALUES (?, 'pwd', ?)",
              [studentId, schoolYearId]
            );
          }
        }
      }

      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }

    logActivity(
      req.user!.userId,
      `Imported LIS file "${req.file.originalname}" — ${applied} field(s) updated across ${updatable.length} learner(s); ${engine.counts.mismatch} mismatch(es), ${engine.counts.not_in_hi5} not in Hi5, ${engine.counts.error} error(s)`,
      "students",
      null
    );
    createNotification({
      title: "LIS import completed",
      message: `${applied} learner detail field(s) imported from "${req.file.originalname}".`,
      type: "success",
      role: "registrar"
    }).catch(() => {});

    res.json({
      message: `Import complete — ${applied} field(s) updated.`,
      batch_id: batchId,
      counts: engine.counts,
      applied,
      rows: engine.rowsOut
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to import the LIS file." });
  }
}
