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

  const th = ds.columns.map(c => `<th>${esc(c)}</th>`).join("");
  const trs = ds.rows.map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join("")}</tr>`).join("");

  const today = new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4 landscape; margin: 12mm 10mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, Helvetica, sans-serif; color: #111; margin: 0; }
  .letterhead { display: flex; align-items: center; gap: 18px; border-bottom: 3px double #1f3a93; padding-bottom: 10px; }
  .logo { width: 74px; height: 74px; object-fit: contain; flex-shrink: 0; }
  .center { flex: 1; text-align: center; line-height: 1.35; }
  .republic { font-size: 10px; letter-spacing: 1px; }
  .deped { font-size: 13px; }
  .region { font-size: 9.5px; color: #333; }
  .schoolname { font-size: 17px; font-weight: 800; letter-spacing: 0.5px; margin-top: 2px; }
  .schoolid { font-size: 10px; color: #333; }
  .doc-title { text-align: center; font-size: 15px; font-weight: 800; letter-spacing: 3px; margin: 16px 0 2px; }
  .doc-sub { text-align: center; font-size: 11px; color: #333; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 8.5px; }
  th, td { border: 1px solid #444; padding: 4px 5px; word-break: break-word; }
  thead { display: table-header-group; }
  th { background: #eef1f8; font-weight: 700; text-align: center; }
  tbody tr:nth-child(even) td { background: #f7f8fa; }
  .signatures { margin-top: 34px; display: flex; justify-content: space-between; page-break-inside: avoid; }
  .sig { text-align: center; width: 280px; }
  .sig .line { border-top: 1px solid #111; margin-bottom: 4px; padding-top: 4px; font-weight: 700; font-size: 10.5px; }
  .sig .role { font-size: 9px; color: #333; letter-spacing: 1px; }
  .doc-footer { margin-top: 22px; font-size: 8px; color: #666; text-align: center; border-top: 1px solid #bbb; padding-top: 6px; }
</style>
</head>
<body>
  ${head}
  <div class="doc-title">${esc(ds.title.toUpperCase())}</div>
  <div class="doc-sub">School Year ${esc(ds.sy_label)} &nbsp;·&nbsp; Generated on ${esc(today)}</div>
  <table>
    <thead><tr>${th}</tr></thead>
    <tbody>${trs || `<tr><td colspan="${ds.columns.length}" style="text-align:center;color:#777;">No records found.</td></tr>`}</tbody>
  </table>
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