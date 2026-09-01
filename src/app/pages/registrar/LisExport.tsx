/**
 * Registrar LIS Export — sole owner of the DepEd LIS CSV exports.
 * Backend routes are gated to `registrar` (server/src/routes/lis.routes.ts).
 */
import { LisExportPanel } from "../../components/LisExportPanel";

export function LisExport() {
  return <LisExportPanel accent="from-indigo-500 via-indigo-600 to-blue-500" />;
}