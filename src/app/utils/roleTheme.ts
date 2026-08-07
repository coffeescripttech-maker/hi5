import { useApp } from "../context/AppContext";
import type { Role } from "../navigation";

/**
 * Single source of truth for each role's accent color, aligned with the
 * sidebar color scheme in Layout.tsx (roleBadgeColors / sidebar backgrounds):
 *   admin = blue, teacher = emerald, registrar = indigo, principal = purple.
 *
 * Pages and shared components call `useRoleAccent()` and build their header
 * accent-bars, icon tiles, buttons, and focus rings from these class bundles,
 * so every page — including shared school-form pages — renders in the
 * current viewer's role color.
 */
export interface RoleAccent {
  /** Top accent bar + header gradient: `from-X-500 via-X-600 to-X-400` */
  gradient: string;
  /** Gradient icon tile / avatar: `from-X-500 to-X-600` */
  tile: string;
  /** Soft shadow for the icon tile: `shadow-X-200` */
  tileShadow: string;
  /** Solid button: `bg-X-600 hover:bg-X-700` */
  button: string;
  /** Input focus ring: `focus:ring-X-500/30` (or similar) */
  ring: string;
  /** Accent text colour: `text-X-600` */
  text: string;
  /** Soft tint background: `bg-X-50` */
  soft: string;
  /** Soft tint icon tile: `bg-X-100 text-X-600` */
  softTile: string;
  /** Role chip: `bg-X-50 text-X-700 border-X-200` */
  chip: string;
  /** Solid dot / small marker: `bg-X-500` */
  dot: string;
  /** Spinner track ring: `border-X-100` */
  spinnerTrack: string;
  /** Spinner active arc: `border-t-X-600` */
  spinnerArc: string;
  /** Hex colour for charts + legends */
  chartHex: string;
  /** Secondary hex for charts (e.g. gender pie, capacity bars) */
  chartHexSoft: string;
}

export const ROLE_ACCENTS: Record<Role, RoleAccent> = {
  admin: {
    gradient: "from-blue-500 via-blue-600 to-blue-400",
    tile: "from-blue-500 to-blue-600",
    tileShadow: "shadow-blue-200",
    button: "bg-blue-600 hover:bg-blue-700",
    ring: "focus:ring-blue-500/30",
    text: "text-blue-600",
    soft: "bg-blue-50",
    softTile: "bg-blue-100 text-blue-600",
    chip: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
    spinnerTrack: "border-blue-100",
    spinnerArc: "border-t-blue-600",
    chartHex: "#2563eb",
    chartHexSoft: "#93c5fd",
  },
  teacher: {
    gradient: "from-emerald-500 via-emerald-600 to-emerald-400",
    tile: "from-emerald-500 to-emerald-600",
    tileShadow: "shadow-emerald-200",
    button: "bg-emerald-600 hover:bg-emerald-700",
    ring: "focus:ring-emerald-500/30",
    text: "text-emerald-600",
    soft: "bg-emerald-50",
    softTile: "bg-emerald-100 text-emerald-600",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    spinnerTrack: "border-emerald-100",
    spinnerArc: "border-t-emerald-600",
    chartHex: "#10b981",
    chartHexSoft: "#6ee7b7",
  },
  registrar: {
    gradient: "from-indigo-500 via-indigo-600 to-indigo-400",
    tile: "from-indigo-500 to-indigo-600",
    tileShadow: "shadow-indigo-200",
    button: "bg-indigo-600 hover:bg-indigo-700",
    ring: "focus:ring-indigo-500/30",
    text: "text-indigo-600",
    soft: "bg-indigo-50",
    softTile: "bg-indigo-100 text-indigo-600",
    chip: "bg-indigo-50 text-indigo-700 border-indigo-200",
    dot: "bg-indigo-500",
    spinnerTrack: "border-indigo-100",
    spinnerArc: "border-t-indigo-600",
    chartHex: "#6366f1",
    chartHexSoft: "#a5b4fc",
  },
  principal: {
    gradient: "from-purple-500 via-purple-600 to-purple-400",
    tile: "from-purple-500 to-purple-600",
    tileShadow: "shadow-purple-200",
    button: "bg-purple-600 hover:bg-purple-700",
    ring: "focus:ring-purple-500/30",
    text: "text-purple-600",
    soft: "bg-purple-50",
    softTile: "bg-purple-100 text-purple-600",
    chip: "bg-purple-50 text-purple-700 border-purple-200",
    dot: "bg-purple-500",
    spinnerTrack: "border-purple-100",
    spinnerArc: "border-t-purple-600",
    chartHex: "#9333ea",
    chartHexSoft: "#d8b4fe",
  },
};

export function useRoleAccent(): RoleAccent {
  const { role } = useApp();
  return ROLE_ACCENTS[role || "admin"];
}
