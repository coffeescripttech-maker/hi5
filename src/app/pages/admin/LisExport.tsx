import React from "react";
import { ArrowRight, Upload } from "lucide-react";

/**
 * Legacy admin LIS Export page.
 *
 * LIS Export was moved entirely under the Registrar console (backend routes
 * are now registrar-only). This page is kept on its route only so an admin
 * hitting a stale bookmark sees a clear pointer instead of a 403 loop.
 */
export function LisExport() {
  return (
    <div className="max-w-2xl mx-auto mt-10 bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-4">
        <Upload size={26} className="text-indigo-600" />
      </div>
      <h2 className="font-bold text-gray-900 text-lg mb-2">
        LIS Export has moved to the Registrar console
      </h2>
      <p className="text-sm text-gray-500 leading-relaxed mb-6">
        Per the 2026 role-permission policy, the DepEd LIS Export tool is now
        available only to the Registrar role. Please use the Registrar account
        to download LIS-ready CSV files.
      </p>
      <a
        href="/registrar/lis-export"
        className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all"
      >
        Open Registrar LIS Export <ArrowRight size={15} />
      </a>
    </div>
  );
}
