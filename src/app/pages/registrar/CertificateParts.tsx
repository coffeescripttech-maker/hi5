/**
 * Shared building blocks for the registrar certificate pages.
 *
 * Letterhead renders the DepEd school header with the school logo on the
 * RIGHT, and SignatureBlock renders a dynamic signatory line from the
 * School Principal / Registrar names stored in school_settings. Both are
 * used verbatim by CertificateOfEnrollment and GoodMoralCertificate, and
 * the whole certificate container is what pdfExport / window.print() capture.
 */
import React from 'react';
import logoImage from '../../../assets/7bbc1fa74b8ecc07e723d0d3864673c9601cbba5.png';
import depedLogo from '../../../assets/deped-logo.png';
import type { CertificateSchool } from '../../services/certificates';

/** Placeholder shown while a student hasn't been loaded yet. */
export const PLACEHOLDER = '________________________';

/** Render a value or the underline placeholder when empty. */
export const orBlank = (value?: string | number | null): string =>
  value !== undefined && value !== null && String(value).trim() !== ''
    ? String(value)
    : PLACEHOLDER;

/**
 * A fill-in value on the certificate. Once a real value exists it is drawn
 * with a line underneath — like a filled-in blank on a printed DepEd form.
 * While empty it falls back to the underscore placeholder.
 */
export function FieldValue({
  filled = true,
  children,
  className = "",
}: {
  /** Whether a real value is present; when false the underscore placeholder shows. */
  filled?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <strong
      className={`text-gray-900 ${className} ${
        filled ? "border-b-2 border-gray-700 px-1 pb-0.5" : ""
      }`}
    >
      {filled ? children : PLACEHOLDER}
    </strong>
  );
}

/** DepEd letterhead — DepEd logo pinned left, school info centred, school logo right. */
export function Letterhead({ school }: { school: CertificateSchool | null }) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <img
        src={depedLogo}
        alt="Department of Education Logo"
        className="h-16 w-16 flex-shrink-0 object-contain sm:h-20 sm:w-20"
      />
      <div className="min-w-0 flex-1 text-center">
        <p className="mb-1 text-sm uppercase tracking-[0.15em] text-gray-500">
          Republic of the Philippines
        </p>
        <p className="mb-1 text-sm uppercase tracking-[0.12em] text-gray-500">
          Department of Education
        </p>
        {school ? (
          <>
            <p className="text-sm text-gray-500">{orBlank(school.region)}</p>
            <p className="text-sm text-gray-500">{orBlank(school.division)}</p>
            {school.district && (
              <p className="text-sm text-gray-500">{orBlank(school.district)}</p>
            )}
            <div className="mb-2 mt-4">
              <p className="text-xl font-bold uppercase tracking-wider text-gray-800">
                {orBlank(school.school_name)}
              </p>
              {school.school_id && (
                <p className="mt-0.5 text-xs text-gray-400">
                  School ID: {school.school_id}
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm italic text-gray-400">
            Loading school information…
          </p>
        )}
      </div>
      <img
        src={logoImage}
        alt="School Logo"
        className="h-16 w-16 flex-shrink-0 object-contain sm:h-20 sm:w-20"
      />
    </div>
  );
}

interface SignatureBlockProps {
  name: string;
  title: string;
  schoolName: string | null;
}

/** Signature area — signatory name above the line, title + school below. */
export function SignatureBlock({ name, title, schoolName }: SignatureBlockProps) {
  return (
    <div className="mt-12 flex justify-end">
      <div className="text-center">
        <div className="w-64 border-t border-gray-400 pt-2">
          <p className="text-sm font-bold uppercase text-gray-800">
            {name?.trim() ? name.trim() : 'Authorized Signatory'}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">{title}</p>
          {schoolName && (
            <p className="mt-0.5 text-[11px] text-gray-400">{schoolName}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Print only the certificate container via the visibility technique:
 * everything else is hidden, and the certificate is pinned to the top-left
 * of the printed page.
 */
export function printCertificate(elementId: string) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const style = document.createElement('style');
  style.id = 'cert-print-style';
  style.textContent = `
    @page { size: letter; margin: 0; }
    @media print {
      body * { visibility: hidden !important; }
      #${elementId}, #${elementId} * { visibility: visible !important; }
      #${elementId} {
        position: absolute !important;
        left: 0;
        top: 0;
        width: 100%;
        box-shadow: none !important;
        border: none !important;
        border-radius: 0 !important;
      }
    }
  `;
  document.head.appendChild(style);
  window.print();
  setTimeout(() => {
    const s = document.getElementById('cert-print-style');
    s?.parentNode?.removeChild(s);
  }, 500);
}

/** Resolve the signatory name + title for a certificate, preferring one role. */
export function pickSignatory(
  school: CertificateSchool | null,
  prefer: 'principal' | 'registrar'
): { name: string; title: string } {
  const p = school?.principal_name?.trim() || '';
  const r = school?.registrar_name?.trim() || '';
  if (prefer === 'principal' && p) return { name: p, title: 'School Principal' };
  if (prefer === 'registrar' && r) return { name: r, title: 'Registrar' };
  if (p) return { name: p, title: 'School Principal' };
  if (r) return { name: r, title: 'Registrar' };
  return { name: '', title: 'School Principal / Registrar' };
}
