"use client";

import { useEffect, useRef, useState } from "react";

/* ---------------------------------------------------------------- */
/* HeaderField — single editable label + input row                  */
/* ---------------------------------------------------------------- */

function HeaderField({
  label,
  value,
  onChange,
  boxClass = "w-48",
  grow = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  boxClass?: string;
  /** Size the input from its content so long names stay on one line on every device. */
  grow?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [growWidth, setGrowWidth] = useState<number | null>(null);

  useEffect(() => {
    if (!grow) return;
    const el = inputRef.current;
    const font = el ? getComputedStyle(el).font : "";
    const ctx = document.createElement("canvas").getContext("2d");
    const textW = ctx && font ? ctx.measureText(value || " ").width : 0;
    setGrowWidth(Math.max(Math.ceil(textW) + 12, 180));
  }, [value, grow]);

  return (
    <div className="flex items-end gap-1">
      <span className="whitespace-nowrap text-[11px] font-semibold text-foreground">
        {label}
      </span>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={grow && growWidth != null ? { width: `${growWidth}px` } : undefined}
        className={`sf1-input ${boxClass} border border-foreground/70 px-1 text-[11px] leading-5 outline-none focus:bg-amber-50`}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Header state type                                                */
/* ---------------------------------------------------------------- */

export interface SchoolHeaderState {
  schoolId: string;
  region: string;
  division: string;
  district: string;
  schoolName: string;
  schoolYear: string;
  gradeLevel: string;
  section: string;
}

const DEFAULT_HEADER: SchoolHeaderState = {
  schoolId: "",
  region: "Region VIII",
  division: "",
  district: "",
  schoolName: "",
  schoolYear: "",
  gradeLevel: "",
  section: "",
};

/* ---------------------------------------------------------------- */
/* useSchoolHeader hook                                             */
/* ---------------------------------------------------------------- */

export function useSchoolHeader(
  initial?: Partial<SchoolHeaderState>
): [SchoolHeaderState, (key: keyof SchoolHeaderState, val: string) => void] {
  const [header, setHeader] = useState<SchoolHeaderState>({
    ...DEFAULT_HEADER,
    ...initial,
  });

  const setField = (key: keyof SchoolHeaderState, val: string) =>
    setHeader((prev) => ({ ...prev, [key]: val }));

  return [header, setField];
}

/* ---------------------------------------------------------------- */
/* SchoolFormHeader — renders the two-row header fields block       */
/* ---------------------------------------------------------------- */

export function SchoolFormHeader({
  header,
  onChange,
}: {
  header: SchoolHeaderState;
  onChange: (key: keyof SchoolHeaderState, val: string) => void;
}) {
  return (
    <div className="mb-2 space-y-2">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
        <HeaderField
          label="School ID"
          value={header.schoolId}
          onChange={(v) => onChange("schoolId", v)}
          boxClass="w-28"
        />
        <HeaderField
          label="Region"
          value={header.region}
          onChange={(v) => onChange("region", v)}
          boxClass="w-28"
        />
        <HeaderField
          label="Division"
          value={header.division}
          onChange={(v) => onChange("division", v)}
          boxClass="w-64"
        />
        <HeaderField
          label="District"
          value={header.district}
          onChange={(v) => onChange("district", v)}
          boxClass="w-56"
        />
      </div>
      <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
        <HeaderField
          label="School Name"
          value={header.schoolName}
          onChange={(v) => onChange("schoolName", v)}
          boxClass="w-[30rem]"
          grow
        />
        <HeaderField
          label="School Year"
          value={header.schoolYear}
          onChange={(v) => onChange("schoolYear", v)}
          boxClass="w-40"
        />
        <HeaderField
          label="Grade Level"
          value={header.gradeLevel}
          onChange={(v) => onChange("gradeLevel", v)}
          boxClass="w-24"
        />
        <HeaderField
          label="Section"
          value={header.section}
          onChange={(v) => onChange("section", v)}
          boxClass="w-56"
        />
      </div>
    </div>
  );
}
