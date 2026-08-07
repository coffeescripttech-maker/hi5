/**
 * Certificate of Enrollment — registrar module.
 *
 * The certificate template is always on screen (letterhead with the school
 * logo on the right, dynamic school info + Registrar/Principal signatories
 * from school_settings). Searching a student fills the fields; the search box
 * autocompletes like the rest of the app. Download PDF + Print are available
 * once a student is loaded.
 */
import React, { useEffect, useState } from "react";
import { Download, FileText, Printer } from "lucide-react";
import { certificatesApi, CertificateResponse, CertificateSchool } from "../../services/certificates";
import { exportToPdf } from "../../services/pdfExport";
import { settingsApi } from "../../services/settings";
import type { StudentRow } from "../../services/students";
import { useApp } from "../../context/AppContext";
import { useRoleAccent } from "../../utils/roleTheme";
import {
  Letterhead, SignatureBlock, FieldValue,
  printCertificate, pickSignatory
} from "./CertificateParts";
import { CertificateStudentSearch } from "./CertificateStudentSearch";

export function CertificateOfEnrollment() {
  const { showToast } = useApp();
  const accent = useRoleAccent();
  const [school, setSchool] = useState<CertificateSchool | null>(null);
  const [data, setData] = useState<CertificateResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Load school info up-front so the letterhead + signatories show immediately.
  useEffect(() => {
    settingsApi
      .get()
      .then(s => setSchool(s as unknown as CertificateSchool))
      .catch(() => { /* letterhead falls back to "Loading…" */ });
  }, []);

  const handlePick = async (student: StudentRow) => {
    setLoading(true);
    setData(null);
    try {
      const result = await certificatesApi.enrollment(student.id);
      setData(result);
      if (result.school) setSchool(result.school);
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Failed to load certificate data");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      await exportToPdf({
        elementId: "cert-enrollment-content",
        filename: `Certificate_of_Enrollment_${data?.student.lrn || "unknown"}`,
        orientation: "portrait",
        format: "letter",
      });
    } catch {
      showToast("error", "Failed to generate the PDF. Please try again.");
    }
  };

  const signatory = pickSignatory(school, "registrar");

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* ── Header ── */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className={`h-1.5 bg-gradient-to-r ${accent.gradient}`} />
        <div className="flex items-center gap-4 p-5 sm:p-6">
          <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${accent.tile} shadow-lg ${accent.tileShadow}`}>
            <FileText size={22} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-[-0.02em] text-gray-900">Certificate of Enrollment</h2>
            <p className="text-sm text-gray-500">Generate Certificate of Enrollment for current students</p>
          </div>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <CertificateStudentSearch onPick={handlePick} busy={loading} />
          <div className="flex items-center gap-2 whitespace-nowrap rounded-xl border border-gray-100 bg-gray-50/80 px-3.5 py-2.5 text-xs text-gray-400">
            {data ? (
              <>
                Selected: <span className="font-semibold text-gray-600">{data.student.name}</span>
              </>
            ) : (
              "Type 2+ characters for suggestions"
            )}
          </div>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          onClick={() => printCertificate("cert-enrollment-content")}
          disabled={!data}
          className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">
          <Printer size={14} /> Print
        </button>
        <button
          onClick={handleExport}
          disabled={!data || loading}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg ${accent.tileShadow} ${accent.button} transition disabled:cursor-not-allowed disabled:opacity-50`}>
          <Download size={14} /> Download PDF
        </button>
      </div>

      {/* ── Certificate ── */}
      <div id="cert-enrollment-content" className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="p-10 sm:p-14" style={{ fontFamily: "serif" }}>
          <Letterhead school={school} />

          <div className="mb-8 border-t-2 border-b border-gray-300" />

          <h1 className="mb-8 text-center text-2xl font-bold uppercase tracking-wider text-gray-900">
            Certificate of Enrollment
          </h1>

          <div className="space-y-4 text-[15px] leading-relaxed text-gray-700">
            <p>
              This is to certify that{" "}
              <FieldValue filled={!!data} className="uppercase">
                {data?.student.name}
              </FieldValue>,{" "}
              a{" "}
              <FieldValue filled={!!data}>
                {data?.student.sex === "male" ? "male" : "female"}
              </FieldValue>{" "}
              student of{" "}
              <FieldValue filled={!!school?.school_name}>
                {school?.school_name}
              </FieldValue>{" "}
              with LRN <FieldValue filled={!!data?.student.lrn}>{data?.student.lrn}</FieldValue>,{" "}
              born on{" "}
              <FieldValue filled={!!data}>
                {data
                  ? new Date(data.student.birthdate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                  : undefined}
              </FieldValue>,{" "}
              is officially enrolled for School Year{" "}
              <FieldValue filled={!!data?.school_year}>{data?.school_year}</FieldValue>{" "}
              in{" "}
              <FieldValue filled={!!data?.student.grade_level}>
                Grade {data?.student.grade_level}
              </FieldValue>.
            </p>

            {data?.enrollment && (
              <p>
                The student is currently attending{" "}
                <FieldValue>Section {data.enrollment.section_name}</FieldValue>{" "}
                under the advisership of{" "}
                <FieldValue>{data.enrollment.adviser_name || "the class adviser"}</FieldValue>.
                Enrollment was confirmed on{" "}
                <FieldValue>
                  {new Date(data.enrollment.enrollment_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </FieldValue>.
              </p>
            )}

            <p>
              This certification is issued upon the request of the concerned student for
              <strong className="text-gray-900"> lawful purposes</strong>.
            </p>

            {data?.student.address && (
              <p className="text-sm text-gray-500">
                <span className="font-medium text-gray-600">Address:</span>{" "}
                <span className="border-b border-gray-400 px-1 pb-px text-gray-700">{data.student.address}</span>
              </p>
            )}
            {data?.student.guardian && (
              <p className="text-sm text-gray-500">
                <span className="font-medium text-gray-600">Parent/Guardian:</span>{" "}
                <span className="border-b border-gray-400 px-1 pb-px text-gray-700">{data.student.guardian}</span>
              </p>
            )}
          </div>

          <SignatureBlock
            name={signatory.name}
            title={signatory.title}
            schoolName={school?.school_name || null}
          />

          <div className="mt-10 border-t border-gray-200 pt-4 text-center text-xs text-gray-400">
            <p>This certificate is valid only with the official school seal and signature.</p>
            <p className="mt-1">Not valid if altered or tampered with.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
