/**
 * Learner Details Import — template download (client revision:
 * Hi5_Portal_Learner_Details_File_Import_Revised.md §3).
 *
 * GET /api/lis/import/template → .xlsx, built in memory, never stored:
 *   Sheet 1 "Learners"  — one header row, no data rows. LRN cells are
 *                         text-formatted so Excel never turns a 12-digit
 *                         LRN into scientific notation.
 *   Sheet 2 "How to fill" — one line per column: what to type, the date
 *                         format (mm/dd/yyyy), the Sex values (M or F).
 *                         Only the LRN is required; blank cells are skipped.
 */
import { Request, Response } from "express";
import ExcelJS from "exceljs";

/** The template column order (§3) — mirrors FIELD_HEADERS in the engine. */
const TEMPLATE_COLUMNS: { header: string; width: number }[] = [
  { header: "LRN", width: 16 },
  { header: "Last Name", width: 18 },
  { header: "First Name", width: 18 },
  { header: "Middle Name", width: 18 },
  { header: "Name Suffix", width: 10 },
  { header: "Birth Date", width: 14 },
  { header: "Sex", width: 6 },
  { header: "Mother Tongue", width: 16 },
  { header: "IP (Ethnic Group)", width: 16 },
  { header: "Religion", width: 16 },
  { header: "House No./Street/Sitio/Purok", width: 26 },
  { header: "Barangay", width: 16 },
  { header: "Municipality/City", width: 18 },
  { header: "Province", width: 16 },
  { header: "ZIP", width: 8 },
  { header: "Father's Name", width: 24 },
  { header: "Mother's Maiden Name", width: 24 },
  { header: "Guardian Name", width: 22 },
  { header: "Relationship", width: 14 },
  { header: "Contact Number", width: 16 },
  { header: "Disability", width: 18 }
];

const HOW_TO_FILL_LINES: string[] = [
  "How to fill this template — one line per column below.",
  "",
  "LRN — REQUIRED. The learner's 12-digit Learner Reference Number. Hi5 matches learners by LRN only; a row without a valid 12-digit LRN is an error.",
  "Last Name / First Name / Middle Name — used only to compare with the learner Hi5 already has. Names are never imported or changed. A different name shows a \"Name differs\" warning but other fields still update.",
  "Name Suffix — Jr., Sr., II, III, IV, V, or any custom suffix. Leave blank when the learner has none.",
  "Birth Date — mm/dd/yyyy (for example 06/15/2010). A different birthdate is a Mismatch and that learner is not changed.",
  "Sex — M or F (Male or Female is also accepted).",
  "Mother Tongue — e.g. Tagalog, Bikol. Leave blank to skip.",
  "IP (Ethnic Group) — the learner's indigenous people group, if any. Leave blank to skip.",
  "Religion — e.g. Roman Catholic. Leave blank to skip.",
  "House No./Street/Sitio/Purok — house number and street. Leave blank to skip.",
  "Barangay — leave blank to skip.",
  "Municipality/City — leave blank to skip.",
  "Province — leave blank to skip.",
  "ZIP — postal/ZIP code. Leave blank to skip.",
  "Father's Name — typed exactly as it should appear (no reordering). Leave blank to skip.",
  "Mother's Maiden Name — typed exactly as it should appear (no reordering). Leave blank to skip.",
  "Guardian Name — when the guardian is not a parent. Leave blank to skip.",
  "Relationship — the guardian's relationship to the learner (e.g. Mother, Grandmother). Leave blank to skip.",
  "Contact Number — of the parent or guardian. Leave blank to skip.",
  "Disability — a value here adds the PWD classification to the learner once. Leave blank to skip.",
  "",
  "Notes:",
  "- Only the LRN is required. Every other blank cell is skipped.",
  "- Type dates as mm/dd/yyyy. Keep the LRN column formatted as text (it already is).",
  "- One learner per row. Nothing is saved until you press Confirm Import on the import page.",
  "- Existing learners only: rows whose LRN is not enrolled in Hi5 are listed as \"Not in Hi5\" and skipped — nothing is created."
];

/** GET /api/lis/import/template — Registrar/Administrator only. */
export async function downloadImportTemplate(
  _req: Request,
  res: Response
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Hi5 Portal";

  // Sheet 1 — "Learners": header row only. LRN column text-formatted.
  const ws = wb.addWorksheet("Learners");
  ws.columns = TEMPLATE_COLUMNS.map(c => ({ header: c.header, width: c.width }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { vertical: "middle", wrapText: true };
  // Sheet 1 — "Learners": header row only. Whole-column text format on the
  // LRN column (numFmt 49 = "@") so a pasted/typed 12-digit LRN never turns
  // into 9.00001E+11 — applies to every row, and no data cells are created.
  ws.getColumn(1).numFmt = "@";

  // Sheet 2 — "How to fill": one line per column.
  const ws2 = wb.addWorksheet("How to fill");
  ws2.getColumn(1).width = 110;
  for (const line of HOW_TO_FILL_LINES) {
    ws2.addRow([line]);
  }

  const buf = await wb.xlsx.writeBuffer();
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="learner-details-import-template.xlsx"'
  );
  res.send(Buffer.from(buf));
}
