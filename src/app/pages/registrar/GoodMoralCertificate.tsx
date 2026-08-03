import React, { useState } from "react";
import { Search, FileText, User, Download, School } from "lucide-react";
import { certificatesApi, CertificateResponse } from "../../services/certificates";
import { exportToPdf } from "../../services/pdfExport";
import { useApp } from "../../context/AppContext";

export function GoodMoralCertificate() {
  const { showToast } = useApp();
  const [lrn, setLrn] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CertificateResponse | null>(null);

  const handleSearch = async () => {
    const trimmed = lrn.trim();
    if (!trimmed) { showToast("error", "Please enter an LRN."); return; }
    setLoading(true);
    setData(null);
    try {
      const { studentsApi } = await import("../../services/students");
      const studentsRes = await studentsApi.list({ search: trimmed });
      const student = Array.isArray(studentsRes) ? studentsRes[0] : null;
      if (!student) { showToast("error", "No student found with that LRN."); return; }

      const result = await certificatesApi.goodMoral(student.id);
      setData(result);
    } catch (err: any) {
      showToast("error", err.detail?.error || err.message || "Failed to load certificate data");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleExport = () => {
    exportToPdf({
      elementId: "cert-goodmoral-content",
      filename: `Good_Moral_Certificate_${data?.student.lrn || "unknown"}`,
      orientation: "portrait",
      format: "letter",
      scale: 2,
    });
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* HEADER */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-violet-500 via-violet-600 to-violet-400" />
        <div className="p-5 sm:p-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 shadow-lg shadow-violet-200 flex items-center justify-center flex-shrink-0">
              <FileText size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">Good Moral Certificate</h2>
              <p className="text-gray-500 text-sm">Generate Certificate of Good Moral Character for students</p>
            </div>
          </div>
        </div>
      </div>

      {/* SEARCH */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text" placeholder="Enter student LRN..."
              value={lrn} onChange={e => setLrn(e.target.value)} onKeyDown={handleKeyDown}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400"
            />
          </div>
          <button onClick={handleSearch} disabled={loading}
            className="bg-violet-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-violet-700 transition disabled:opacity-50 flex items-center gap-2">
            {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search size={14} />}
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
      </div>

      {/* CERTIFICATE PREVIEW */}
      {data && (
        <>
          <div className="flex justify-end">
            <button onClick={handleExport}
              className="bg-violet-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-violet-700 transition flex items-center gap-2 shadow-lg shadow-violet-200">
              <Download size={14} /> Download PDF
            </button>
          </div>

          <div id="cert-goodmoral-content" className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Certificate Inner */}
            <div className="p-10 sm:p-14" style={{ fontFamily: "serif" }}>
              {/* School Letterhead */}
              <div className="text-center mb-8">
                <p className="text-sm uppercase tracking-[0.15em] text-gray-500 mb-1">Republic of the Philippines</p>
                <p className="text-sm uppercase tracking-[0.12em] text-gray-500 mb-1">Department of Education</p>
                {data.school && (
                  <>
                    <p className="text-sm text-gray-500">{data.school.region}</p>
                    <p className="text-sm text-gray-500">{data.school.division}</p>
                    {data.school.district && (
                      <p className="text-sm text-gray-500">{data.school.district}</p>
                    )}
                    <div className="mt-4 mb-2">
                      <p className="text-xl font-bold text-gray-800 uppercase tracking-wider">{data.school.school_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">School ID: {data.school.school_id}</p>
                    </div>
                  </>
                )}
              </div>

              {/* Horizontal rule */}
              <div className="border-t-2 border-b border-gray-300 mb-8" />

              {/* Title */}
              <h1 className="text-center text-2xl font-bold text-gray-900 uppercase tracking-wider mb-8">
                Certificate of Good Moral Character
              </h1>

              {/* Body */}
              <div className="text-gray-700 leading-relaxed space-y-4 text-[15px]">
                <p>
                  To whom it may concern:
                </p>

                <p>
                  This is to certify that{" "}
                  <strong className="text-gray-900 uppercase">{data.student.name}</strong>,{" "}
                  a {data.student.sex === "male" ? "male" : "female"} student with LRN{" "}
                  <strong className="text-gray-900">{data.student.lrn}</strong>,{" "}
                  born on{" "}
                  <strong className="text-gray-900">
                    {new Date(data.student.birthdate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </strong>,{" "}
                  is currently enrolled in Grade{" "}
                  <strong className="text-gray-900">{data.student.grade_level}</strong>{" "}
                  for School Year{" "}
                  <strong className="text-gray-900">{data.school_year || "—"}</strong>{" "}
                  at{" "}
                  <strong className="text-gray-900">{data.school?.school_name || "this school"}</strong>.
                </p>

                <p>
                  During her/his stay in this school, she/he has manifested{" "}
                  <strong className="text-gray-900">good moral character</strong>,{" "}
                  consistently exhibiting honesty, respect, diligence, and responsible conduct
                  both inside and outside the classroom. She/he has{" "}
                  <strong className="text-gray-900">no derogatory record</strong>{" "}
                  on file with this school.
                </p>

                <p>
                  This certification is issued upon the request of the concerned student for
                  <strong className="text-gray-900"> lawful purposes</strong>.
                </p>

                {data.student.address && (
                  <p className="text-sm text-gray-500">
                    <span className="font-medium text-gray-600">Address:</span> {data.student.address}
                  </p>
                )}
                {data.student.guardian && (
                  <p className="text-sm text-gray-500">
                    <span className="font-medium text-gray-600">Parent/Guardian:</span> {data.student.guardian}
                  </p>
                )}
              </div>

              {/* Signature block */}
              <div className="mt-12 flex justify-end">
                <div className="text-center">
                  <div className="border-t border-gray-400 pt-2 w-64">
                    <p className="font-bold text-gray-800 uppercase text-sm">
                      {data.school ? "School Principal / Registrar" : "Authorized Signatory"}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {data.school?.school_name || "School"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-10 text-center text-xs text-gray-400 border-t border-gray-200 pt-4">
                <p>This certificate is valid only with the official school seal and signature.</p>
                <p className="mt-1">Not valid if altered or tampered with.</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
