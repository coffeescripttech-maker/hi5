import React from "react";
import { LucideIcon } from "lucide-react";

// ── PAGE LOADER ──────────────────────────────────────────────
export function PageLoader({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
        <div className="absolute inset-0 rounded-full border-4 border-t-blue-600 animate-spin" />
      </div>
      <p className="text-gray-400 text-sm font-medium">{label}</p>
    </div>
  );
}

// ── EMPTY STATE ──────────────────────────────────────────────
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <Icon size={28} className="text-gray-400" />
      </div>
      <p className="font-semibold text-gray-700 text-base mb-1">{title}</p>
      {description && <p className="text-gray-400 text-sm max-w-sm">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-xl transition"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ── PAGE HEADER ──────────────────────────────────────────────
export function PageHeader({
  icon: Icon,
  title,
  description,
  iconBg = "bg-blue-100",
  iconColor = "text-blue-700",
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  iconBg?: string;
  iconColor?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
          <Icon size={20} className={iconColor} />
        </div>
        <div>
          <h2 className="font-bold text-gray-800">{title}</h2>
          {description && <p className="text-gray-500 text-sm">{description}</p>}
        </div>
      </div>
      {children && <div className="flex items-center gap-3 flex-shrink-0">{children}</div>}
    </div>
  );
}
