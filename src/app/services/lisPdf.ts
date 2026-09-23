/**
 * Official LIS PDF composer.
 *
 * Fetches the export dataset (via /lis/data) plus the school profile, then
 * builds a self-contained official HTML document — DepEd letterhead with both
 * logos, bordered table, zebra rows, repeating header per page, signature
 * block — and prints it to PDF through the existing /api/pdf/render pipeline
 * (puppeteer + system Chrome), exactly like the school forms.
 */
import depedLogoUrl from "../../assets/deped-logo.png";
import schoolLogoUrl from "../../assets/7bbc1fa74b8ecc07e723d0d3864673c9601cbba5.png";
import { api } from "./api";
import { lisApi, LisCard, LisDataset, ExportParams } from "./lis";
import { settingsApi } from "./settings";

interface SchoolProfile {
  school_name: string;
  school_id: string;
  region: string;
  division: string;
  district?: string | null;
  principal_name?: string | null;
  registrar_name?: string | null;
}

async function toDataUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return ""; // logo missing is cosmetic — never block the export
  }
}

function esc(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml(ds: LisDataset, school: SchoolProfile | null, depedLogo: string, schoolLogo: string): string {
  const name = school?.school_name || "School";
  const head = `
    <div class="letterhead">
      ${depedLogo ? `<img class="logo" src="${depedLogo}" alt="DepEd" />` : "<div class='logo'></div>"}
      <div class="center">
        <div class="republic">Republic of the Philippines</div>
        <div class="deped"><strong>Department of Education</strong></div>
        <div class="region">Region: ${esc(school?.region || "—")}${school?.division ? ` &nbsp;·&nbsp; Division: ${esc(school.division)}` : ""}</div>
        <div class="schoolname">${esc(name.toUpperCase())}</div>
        <div class="schoolid">School ID: ${esc(school?.school_id || "—")}</div>
      </div>
      ${schoolLogo ? `<img class="logo" src="${schoolLogo}" alt="School Logo" />` : "<div class='logo'></div>"}
    </div>`;

  const today = new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // ── Grade Summary: repaginate across several landscape pages ────────────────
  // The subjects are pivoted into 4 quarterly columns each, so a flat table
  // would squeeze 60+ columns into one page. Every page repeats the learner
  // info columns (LRN, Learner Name, Grade, Section) plus the General Average
  // and Promotion Status, and carries a readable 2-row header — subject name
  // spanning Q1–Q4 — for at most 3 subjects.
  if (ds.title === "Grade Summary") {
    const qWidth = 36;
    // LRN + Learner Name + Grade + Section + General Average + Promotion.
    const fixedWidth = 70 + 200 + 40 + 84 + 60 + 86;
    const pageWidth = 1054; // A4 landscape (297mm) minus 9mm side margins, at 96dpi
    const subjectsPerPage = Math.max(1, Math.floor((pageWidth - fixedWidth) / (qWidth * 4)));

    // Column start index of each subject's 4-quarter block.
    const subjectStarts: number[] = [];
    for (let i = 4; i < ds.columns.length - 2; i += 4) subjectStarts.push(i);

    const chunks: number[][] = [];
    for (let i = 0; i < subjectStarts.length; i += subjectsPerPage) {
      chunks.push(subjectStarts.slice(i, i + subjectsPerPage));
    }
    if (chunks.length === 0) chunks.push([]);

    const metaHead =
      `<th rowspan="2" class="col-lrn">LRN</th>` +
      `<th rowspan="2" class="col-name">Learner Name</th>` +
      `<th rowspan="2" class="col-grade">Grade</th>` +
      `<th rowspan="2" class="col-section">Section</th>`;
    const tailHead =
      `<th rowspan="2" class="col-ga">Gen. Average</th>` +
      `<th rowspan="2" class="col-promo">Promotion Status</th>`;
    const subHeadTop = (chunk: number[]) =>
      chunk
        .map(i => `<th class="col-sub-head" colspan="4">${esc(ds.columns[i].replace(/_[Qq][1-4]$/, ""))}</th>`)
        .join("");
    const subHeadQuarters = (chunk: number[]) =>
      chunk.map(() => `<th class="col-q">Q1</th><th class="col-q">Q2</th><th class="col-q">Q3</th><th class="col-q">Q4</th>`).join("");

    const metaCells = (r: unknown[]) =>
      `<td class="col-lrn">${esc(r[0])}</td>` +
      `<td class="col-name">${esc(r[1])}</td>` +
      `<td class="col-grade">${esc(r[2])}</td>` +
      `<td class="col-section">${esc(r[3])}</td>`;
    const tailCells = (r: unknown[]) =>
      `<td class="col-ga">${esc(r[r.length - 2])}</td>` +
      `<td class="col-promo">${esc(r[r.length - 1])}</td>`;
    const subCells = (r: unknown[], chunk: number[]) =>
      chunk.map(i => [0, 1, 2, 3].map(q => `<td class="col-q">${esc(r[i + q])}</td>`).join("")).join("");

    const chunkWidth = (chunk: number[]) => fixedWidth + chunk.length * qWidth * 4;

    const tables = chunks.map(chunk => {
      const visibleCols = 4 + chunk.length * 4 + 2;
      const body =
        ds.rows.length > 0
          ? ds.rows.map(r => `<tr>${metaCells(r)}${subCells(r, chunk)}${tailCells(r)}</tr>`).join("")
          : `<tr><td colspan="${visibleCols}" class="empty">No records found.</td></tr>`;
      return `<table class="grades" style="width:${chunkWidth(chunk)}px">
  <thead>
    <tr>${metaHead}${subHeadTop(chunk)}${tailHead}</tr>
    <tr>${subHeadQuarters(chunk)}</tr>
  </thead>
  <tbody>${body}</tbody>
</table>`;
    });

    const pages = tables
      .map((table, k) => {
        const band = k === 0 ? "" : `<div class="chunk-band">${esc(name.toUpperCase())} · School Year ${esc(ds.sy_label)} · (continued)</div>`;
        return `<div class="chunk${k === 0 ? "" : " chunk-break"}">
  ${head}
  <div class="doc-title">${esc(ds.title.toUpperCase())}</div>
  <div class="doc-sub">School Year ${esc(ds.sy_label)} &nbsp;·&nbsp; Generated on ${esc(today)}</div>
  ${band}
  ${table}
</div>`;
      })
      .join("\n");

    return doc(pages, name, today, school);
  }

  // ── Other LIS cards: single landscape table (few, wide columns) ─────────────
  const th = ds.columns.map(c => `<th>${esc(c)}</th>`).join("");
  const trs = ds.rows.map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join("")}</tr>`).join("");

  const pages = `<div class="chunk">
  ${head}
  <div class="doc-title">${esc(ds.title.toUpperCase())}</div>
  <div class="doc-sub">School Year ${esc(ds.sy_label)} &nbsp;·&nbsp; Generated on ${esc(today)}</div>
  <table class="simple">
    <thead><tr>${th}</tr></thead>
    <tbody>${trs || `<tr><td colspan="${ds.columns.length}" class="empty">No records found.</td></tr>`}</tbody>
  </table>
</div>`;

  return doc(pages, name, today, school);
}

function doc(pages: string, name: string, today: string, school: SchoolProfile | null): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4 landscape; margin: 9mm 9mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, Helvetica, sans-serif; color: #111; margin: 0; }
  .letterhead { display: flex; align-items: center; gap: 16px; border-bottom: 3px double #1f3a93; padding-bottom: 8px; }
  .logo { width: 66px; height: 66px; object-fit: contain; flex-shrink: 0; }
  .center { flex: 1; text-align: center; line-height: 1.35; }
  .republic { font-size: 10px; letter-spacing: 1px; }
  .deped { font-size: 13px; }
  .region { font-size: 9.5px; color: #333; }
  .schoolname { font-size: 17px; font-weight: 800; letter-spacing: 0.5px; margin-top: 2px; }
  .schoolid { font-size: 10px; color: #333; }
  .doc-title { text-align: center; font-size: 15px; font-weight: 800; letter-spacing: 2px; margin: 14px 0 4px; }
  .doc-sub { text-align: center; font-size: 11px; color: #333; margin-bottom: 12px; }
  .chunk-band { text-align: center; font-size: 8.5px; color: #555; margin-bottom: 6px; }
  .chunk-break { page-break-before: always; }
  table { border-collapse: collapse; font-size: 9px; }
  th, td { border: 1px solid #444; padding: 3px 4px; word-break: break-word; overflow-wrap: break-word; vertical-align: middle; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th { background: #eef1f8; font-weight: 700; text-align: center; }
  tbody tr:nth-child(even) td { background: #f7f8fa; }
  .empty { text-align: center; color: #777; }
  table.grades { table-layout: fixed; margin: 0 auto; }
  .col-lrn { width: 70px; }
  .col-name { width: 200px; text-align: left; font-weight: 600; }
  .col-grade { width: 40px; }
  .col-section { width: 84px; }
  .col-sub-head { font-size: 8.5px; background: #dfe7f6; }
  .col-q { width: 36px; text-align: center; }
  .col-ga { width: 60px; text-align: center; font-weight: 600; }
  .col-promo { width: 86px; text-align: center; }
  table.simple { width: 100%; }
  table.simple td { text-align: left; }
  table.simple th { text-align: center; }
  .signatures { margin-top: 30px; display: flex; justify-content: space-between; page-break-inside: avoid; }
  .sig { text-align: center; width: 280px; }
  .sig .line { border-top: 1px solid #111; margin-bottom: 4px; padding-top: 4px; font-weight: 700; font-size: 10.5px; }
  .sig .role { font-size: 9px; color: #333; letter-spacing: 1px; }
  .doc-footer { margin-top: 20px; font-size: 8px; color: #666; text-align: center; border-top: 1px solid #bbb; padding-top: 6px; }
</style>
</head>
<body>
  ${pages}
  ${buildSignatureBlock(school, name, today)}
</body>
</html>`;
}

function buildSignatureBlock(school: SchoolProfile | null, name: string, today: string): string {
  return `
  <div class="signatures">
    <div class="sig">
      <div class="line">${esc(school?.registrar_name || "Registrar")}</div>
      <div class="role">Registrar</div>
    </div>
    <div class="sig">
      <div class="line">${esc(school?.principal_name || "Principal")}</div>
      <div class="role">Principal</div>
    </div>
  </div>
  <div class="doc-footer">Officially generated by the HI5 Portal · ${esc(name)} · DepEd LIS export · ${esc(today)}</div>`;
}

/**
 * Compose and download the official PDF for an LIS export.
 */
export async function exportLisPdf(
  card: LisCard,
  params: ExportParams | undefined,
  baseName: string
): Promise<void> {
  const [ds, school, depedLogo, schoolLogo] = await Promise.all([
    lisApi.fetchData(card, params),
    settingsApi.get().catch(() => null),
    toDataUrl(depedLogoUrl),
    toDataUrl(schoolLogoUrl),
  ]);

  const html = buildHtml(ds, school, depedLogo, schoolLogo);

  const response = await api.postBlob("/pdf/render", { html, filename: baseName });
  if (!response.ok) {
    let message = `PDF render failed (${response.status})`;
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      /* not JSON */
    }
    throw new Error(message);
  }

  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?(.+?)"?$/);
  const filename = match ? match[1] : `${baseName}.pdf`;
  const blob = await response.blob();

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}