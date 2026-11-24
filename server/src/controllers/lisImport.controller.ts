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

/** Target importable learner fields → the header names they may map from
 *  (template + real SF1 + our legacy CSV — see the revised import doc). */
const FIELD_HEADERS: Record<string, string[]> = {
  lrn: ["LRN", "Learner Reference Number", "Learner LRN"],
  last_name: ["Surname", "Last Name", "Apelyido", "Student Surname"],
  first_name: ["Given Name", "First Name", "Pangalan", "Student First Name"],
  middle_name: ["Middle Name", "Middle", "Student Middle Name"],
  name_ext: ["Name Suffix", "Extension Name", "Name Extension", "Suffix", "Ext Name"],
  birthdate: ["Birth Date", "Birthdate", "Date of Birth", "Birthday", "DOB"],
  sex: ["Sex", "Gender", "Kasarian"],
  mother_tongue: ["Mother Tongue", "Mother Tongue Language"],
  ip_ethnic_group: ["IP", "Indigenous People", "IP (Ethnic Group)", "IP Ethnic Group", "Ethnic Group"],
  religion: ["Religion"],
  house_street: ["House No./Street/Sitio/Purok", "House No", "House No./Street", "House #/Street", "House Street", "Street Address", "House/Street", "Address"],
  barangay: ["Barangay", "Brgy"],
  city_municipality: ["Municipality/City", "Municipality", "City", "City/Municipality"],
  province: ["Province"],
  zip_code: ["ZIP", "Zip Code", "ZIP Code", "Postal Code"],
  father_name: ["Father's Name", "Father Name", "Father"],
  mother_name: ["Mother's Maiden Name", "Mother's Name", "Mother Maiden Name", "Mother"],
  guardian: ["Guardian Name", "Name of Guardian", "Guardian"],
  guardian_relationship: ["Relationship", "Relationship to Learner", "Guardian Relationship", "Relation to Learner", "Guardian Relationship to Learner"],
  contact: ["Contact Number", "Contact No", "Cellphone No", "Mobile No", "Contact Number of Parent or Guardian"],
  disability: ["Disability", "Disability Type", "Special Needs", "PWD", "Disability/Special Needs"]
};

/** A cell value longer than this is reported as a per-field error; the rest
 *  of the row is still processed (revised doc, Values). */
const MAX_FIELD_CHARS = 255;

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

/** Bracketed text after a heading is ignored ("Sex (M/F)" → "Sex",
 *  "MOTHER TONGUE (Grade 1 to 3 Only)" → "MOTHER TONGUE"). */
const stripBrackets = (v: string): string =>
  String(v ?? "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ");

/** Clean a data value: collapse repeated spaces to one, and strip leading or
 *  trailing spaces and commas (the real SF1 writes values like
 *  "LAST, FIRST, MIDDLE," and "NCR   FOURTH   DISTRICT"). */
const cleanValue = (v: string): string =>
  String(v ?? "")
    .replace(/\s+/g, " ")
    .replace(/^[\s,]+|[\s,]+$/g, "")
    .trim();

const FIELD_CANDIDATES: Record<string, string[]> = Object.fromEntries(
  Object.entries(FIELD_HEADERS).map(([field, cands]) => [
    field,
    cands.map(c => normHeader(stripBrackets(c)))
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
  return cleanValue(String(v));
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
  // mm/dd/yyyy or mm-dd-yyyy (the real SF1 writes dates as mm-dd-yyyy text)
  const mdy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
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
  name_differs?: { file: string; hi5: string };
  field_errors?: string[];
  student_id?: number;
  hi5_name?: string;
  changes?: { field: string; label: string; group: string; old: string; new: string; savedEdit: boolean }[];
  has_saved_sf_edit?: boolean;
  pwd_value?: string;
  pwd_already?: boolean;
}

interface EngineResult {
  rowsOut: EngineRow[];
  counts: Record<string, number>;
  mapping: Record<string, number>;
  headerRowIdx: number;
  dataStartIdx: number;
  headerTexts: string[];
  nameColumn: number | undefined;
  unusedColumns: string[];
  onlyLrn: boolean;
}

/** Locate the heading and map columns per field (auto-detection).
 *
 *  Supports BOTH layouts (revised doc §4):
 *   - a single heading row (our template / CSV), and
 *   - the real SF1 layout: the heading split over TWO rows with merged
 *     cells (e.g. PARENTS over "Father's Name", GUARDIAN over "Name" and
 *     "Relationship"). The row below the LRN heading is combined into one
 *     heading unless it is a learner row (a 12-digit LRN gives it away).
 *
 *  Matching ignores case, extra spaces, punctuation, and bracketed text.
 *  A heading that matches no field is never an error — it is returned in
 *  unusedColumns so the preview can list it under "Columns not used".
 */
function mapColumns(
  sheetRows: unknown[][]
): {
  headerRowIdx: number;
  dataStartIdx: number;
  mapping: Record<string, number>;
  headerTexts: string[];
  nameColumn: number | undefined;
  unusedColumns: string[];
} {
  const scanRows = Math.min(sheetRows.length, 15);
  const maxCols = Math.max(...sheetRows.slice(0, scanRows).map(r => r.length), 0);

  // 1. find the row that contains an LRN heading
  let headerTop = -1;
  let lrnCol = -1;
  for (let r = 0; r < scanRows; r++) {
    for (let c = 0; c < maxCols; c++) {
      const h = normHeader(stripBrackets(String(sheetRows[r][c] ?? "")));
      if (h === "lrn" || h === "learnerreferencenumber" || h === "learnerlrn") {
        headerTop = r;
        lrnCol = c;
        break;
      }
    }
    if (headerTop >= 0) break;
  }
  if (headerTop < 0) {
    throw new Error("No LRN column found. Download the template or check the heading row.");
  }

  // 2. combine the row below when it is a merged sub-heading row (not a
  //    learner row — those carry a 12-digit LRN in the LRN column)
  let headerBottom = -1;
  const below = sheetRows[headerTop + 1];
  const belowHasLearner =
    below != null && cleanLrn(below as unknown[], lrnCol) !== null;
  if (
    headerTop + 1 < sheetRows.length &&
    !belowHasLearner &&
    (below as unknown[]).some(c => c !== undefined && c !== null && String(c).trim() !== "")
  ) {
    headerBottom = headerTop + 1;
  }
  const dataStartIdx = headerBottom >= 0 ? headerBottom : headerTop;

  // 3. map every column: sub-heading wins over group label; the combined
  //    "GROUP + sub" text (e.g. GUARDIAN + Name → "Guardian Name") is the
  //    fallback
  const mapping: Record<string, number> = {};
  const assigned = new Set<number>();
  const headerTexts: string[] = [];
  for (let c = 0; c < maxCols; c++) {
    const topRaw = stripBrackets(String(sheetRows[headerTop][c] ?? ""));
    const botRaw = headerBottom >= 0 ? stripBrackets(String(sheetRows[headerBottom][c] ?? "")) : "";
    const combRaw = cleanValue(`${String(topRaw).trim()} ${String(botRaw).trim()}`);
    headerTexts.push(cleanValue(`${String(sheetRows[headerTop][c] ?? "").trim()} ${botRaw.trim()}`) || String(sheetRows[headerTop][c] ?? "").trim());
    const top = normHeader(topRaw);
    const bot = normHeader(botRaw);
    const comb = normHeader(combRaw);
    if (!top && !bot) continue;

    // which field matches each level?
    let field: string | null = null;
    for (const [f, cands] of Object.entries(FIELD_CANDIDATES)) {
      if (bot && cands.includes(bot)) { field = f; break; }
    }
    if (!field) {
      for (const [f, cands] of Object.entries(FIELD_CANDIDATES)) {
        if (comb && cands.includes(comb)) { field = f; break; }
      }
    }
    if (!field) {
      for (const [f, cands] of Object.entries(FIELD_CANDIDATES)) {
        if (top && cands.includes(top)) { field = f; break; }
      }
    }
    if (field && mapping[field] === undefined) {
      mapping[field] = c;
      assigned.add(c);
    }
  }

  // 4. the learner NAME column (never imported — only compared). In the real
  //    SF1 it is "NAME" over "(Last Name, First Name, Middle Name)".
  let nameColumn: number | undefined;
  for (let c = 0; c < maxCols; c++) {
    if (assigned.has(c)) continue;
    const top = normHeader(stripBrackets(String(sheetRows[headerTop][c] ?? "")));
    const bot = headerBottom >= 0
      ? normHeader(stripBrackets(String(sheetRows[headerBottom][c] ?? "")))
      : "";
    if ((top === "name" && !bot) || bot.includes("lastname")) {
      nameColumn = c;
      break;
    }
  }

  // 5. columns with a heading that matched no field → "Columns not used"
  const unusedColumns: string[] = [];
  for (let c = 0; c < maxCols; c++) {
    if (assigned.has(c) || c === nameColumn) continue;
    const t = cleanValue(
      `${String(sheetRows[headerTop][c] ?? "").trim()} ${
        headerBottom >= 0 ? String(sheetRows[headerBottom][c] ?? "").trim() : ""
      }`
    );
    if (t) unusedColumns.push(t);
  }

  return { headerRowIdx: headerTop, dataStartIdx, mapping, headerTexts, nameColumn, unusedColumns };
}

async function runEngine(
  buffer: Buffer,
  schoolYearId: number,
  mappingOverride: Record<string, number> | null,
  modes: Record<string, string>
): Promise<EngineResult> {
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
  const dataStartIdx = auto.dataStartIdx;
  const headerTexts = auto.headerTexts;
  const nameColumn = auto.nameColumn;
  const unusedColumns = auto.unusedColumns;
  // "If only the LRN could be matched and no detail column at all, the page
  // says so and Confirm Import is disabled."
  const onlyLrn = Object.keys(mapping).filter(f => f !== "lrn").length === 0;

  const allRows = matrix.slice(dataStartIdx + 1);
  if (allRows.length === 0) throw new Error("No data rows found under the heading row.");

  // Walk the learner block: rows with a 12-digit LRN are learner rows; rows
  // whose name cell starts with "<===" are TOTAL MALE / TOTAL FEMALE /
  // COMBINED; reading stops at COMBINED or the REMARKS legend heading —
  // the legend, signatures, and footer are never counted as errors.
  const dataRows: unknown[][] = [];
  let stopped = false;
  for (const row of allRows) {
    const lead = [cellText(row, 0), cellText(row, 1), cellText(row, 2), cellText(row, nameColumn)]
      .join(" ")
      .toLowerCase();
    if (lead.includes("list and code of indicators")) break; // REMARKS legend heading
    const nameCell = cellText(row, nameColumn);
    if (nameCell.startsWith("<===")) {
      if (nameCell.toUpperCase().includes("COMBINED")) break; // end of the learner block
      continue; // TOTAL MALE / TOTAL FEMALE — skipped without a message
    }
    if (lead.includes("<===") && lead.includes("combined")) break;
    if (lead.includes("<===") && lead.includes("total")) continue;
    const hasText = row.some(c => c !== undefined && c !== null && String(c).trim() !== "");
    if (!hasText) continue;
    const lrn = cleanLrn(row, mapping.lrn);
    const hasName = !!(
      (nameColumn !== undefined && nameCell) ||
      cellText(row, mapping.last_name) ||
      cellText(row, mapping.first_name)
    );
    if (!lrn && !hasName) continue; // blank separator row inside the block
    dataRows.push(row);
    if (dataRows.length > MAX_ROWS) {
      throw new Error(`The file has more than ${MAX_ROWS} data rows — the limit is ${MAX_ROWS}. Split the file.`);
    }
  }
  void stopped;
  const dataRowCount = dataRows.length;
  if (dataRowCount === 0) throw new Error("No data rows found under the heading row.");

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
    name_differs: 0,
    not_in_hi5: 0,
    error: 0
  };

  for (const [rowIdx, row] of dataRows.entries()) {
    const rowNum = dataStartIdx + 2 + rowIdx; // 1-based sheet row
    const lrn = cleanLrn(row, mapping.lrn);
    // The file's name: either a single NAME column ("LAST,FIRST NAMES, MIDDLE")
    // or explicit surname / given-name columns.
    const nameCell = cellText(row, nameColumn);
    let fileLast = cellText(row, mapping.last_name);
    let fileFirst = cellText(row, mapping.first_name);
    let fileMiddle = cellText(row, mapping.middle_name);
    let fileComma = "";
    let fileName = "";
    if (nameCell) {
      const parts = nameCell.split(",").map(p => cleanValue(p));
      fileLast = fileLast || parts[0] || "";
      fileFirst = fileFirst || parts[1] || "";
      fileMiddle = fileMiddle || parts.slice(2).filter(Boolean).join(" ");
      fileName = cleanValue(nameCell);
      fileComma = `${fileLast}, ${fileFirst} ${fileMiddle}`.replace(/,\s*$/, "");
    } else {
      fileName = [fileLast, fileFirst, fileMiddle].filter(Boolean).join(", ");
      fileComma = `${fileLast}, ${fileFirst} ${fileMiddle}`.replace(/,\s*$/, "");
    }
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

    // Birthdate / sex differ → Mismatch: both values are shown and the
    // learner is NOT changed (revised doc §1).
    const bdMatches = !fileBd || String(hi5.birthdate).slice(0, 10) === fileBd;
    const sexMatches = !fileSex || String(hi5.sex).toLowerCase() === fileSex;
    const mismatches: string[] = [];
    if (fileBd && !bdMatches) mismatches.push(`Birthdate: file ${fileBd} vs Hi5 ${String(hi5.birthdate).slice(0, 10)}`);
    if (fileSex && !sexMatches) mismatches.push(`Sex: file ${fileSex} vs Hi5 ${String(hi5.sex)}`);
    if (mismatches.length > 0) {
      counts.mismatch++;
      rowsOut.push({ ...base, lrn, result: "mismatch", mismatches });
      continue;
    }

    // Name differs → a WARNING only: both values are shown, the name is
    // never changed, and the row still updates its other fields.
    let nameDiffers: EngineRow["name_differs"] | undefined;
    {
      const storedParts = parseName(String(hi5.name));
      const hi5Last = String(hi5.last_name ?? storedParts.last ?? "");
      const hi5First = String(hi5.first_name ?? storedParts.first ?? "");
      const nameMatches =
        namesMatch(fileComma, String(hi5.name)) ||
        (fileLast.toLowerCase() === hi5Last.toLowerCase() &&
          fileFirst.toLowerCase() === hi5First.toLowerCase());
      if (!nameMatches && fileName) {
        nameDiffers = { file: fileName, hi5: String(hi5.name) };
        counts.name_differs++;
      }
    }

    // Candidate detail changes per group + mode. Values are cleaned;
    // a value longer than 255 characters is a per-field error and the rest
    // of the row is still processed.
    const candidateFields: Record<string, { old: string; new: string; group: string; savedEdit: boolean }> = {};
    const fieldErrors: string[] = [];
    for (const { group, fields } of FIELD_GROUPS) {
      for (const field of fields) {
        const col = mapping[field];
        if (col === undefined) continue;
        const newVal = cellText(row, col);
        if (!newVal) continue; // empty cells never overwrite, even in Overwrite
        if (newVal.length > MAX_FIELD_CHARS) {
          fieldErrors.push(`${field.replace(/_/g, " ")}: value too long (over ${MAX_FIELD_CHARS} characters) — skipped.`);
          continue;
        }
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
        name_differs: nameDiffers,
        field_errors: fieldErrors.length ? fieldErrors : undefined,
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
      name_differs: nameDiffers,
      field_errors: fieldErrors.length ? fieldErrors : undefined,
      has_saved_sf_edit: hasSavedEdit,
      pwd_value: disabilityValue,
      pwd_already: disabilityValue ? await hasPwdTag(Number(hi5.id)) : false
    });
  }

  return {
    rowsOut,
    counts,
    mapping,
    headerRowIdx,
    dataStartIdx,
    headerTexts,
    nameColumn,
    unusedColumns,
    onlyLrn
  };
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
      unused_columns: result.unusedColumns,
      name_column: result.nameColumn,
      only_lrn: result.onlyLrn,
      rows: result.rowsOut
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to read the file." });
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
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            // Client revision: new changes record reason "File import";
            // older entries keep their original "LIS import" reason.
            [studentId, f.field, f.old, f.new, "File import", req.user!.userId, batchId]
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
      `Learner details file import — "${req.file.originalname}": ${applied} field(s) updated across ${updatable.length} learner(s); ${engine.counts.mismatch} mismatch(es), ${engine.counts.not_in_hi5} not in Hi5, ${engine.counts.error} error(s)`,
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
