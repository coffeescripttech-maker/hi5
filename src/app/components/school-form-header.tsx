"use client";

import { useState } from "react";

/* ---------------------------------------------------------------- */
/* HeaderField — a bounded grid cell holding one label + input row   */
/* ---------------------------------------------------------------- */

/**
 * One header field inside a 12-column grid cell. The cell (never the input)
 * owns the layout width, so the label and the underlined input fill exactly
 * the cell on every device — no fixed px/rem input widths to collide with
 * neighbouring fields when the row runs short of space, and no
 * device-dependent measuring. `sf-fill-input` marks the input as one whose
 * value span should keep the full cell width in the serialized PDF page.
 */
function HeaderField({
  label,
  value,
  onChange,
  span,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Tailwind col-span utility, e.g. `col-span-4`. */
  span: string;
}) {
  return (
    <div className={`${span} flex min-w-0 items-end gap-1`}>
      <span className="whitespace-nowrap text-[11px] font-semibold text-foreground">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sf1-input sf-fill-input min-w-0 flex-1 border border-foreground/70 px-1 text-[11px] leading-5 outline-none focus:bg-amber-50"
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
/*                                                                  */
/* A 12-column proportional grid instead of flex-wrap rows with     */
/* fixed rem inputs: every field occupies a fixed fraction of the   */
/* sheet width, identically on screen, in the Print Preview, and in */
/* the serialized PDF page (grid tracks reflow to fr units during   */
/* serialization), so school name and school year can no longer     */
/* crowd or overlap each other.                                     */
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
      <div className="grid grid-cols-12 items-end gap-x-4 gap-y-2">
        <HeaderField
          label="School ID"
          span="col-span-2"
          value={header.schoolId}
          onChange={(v) => onChange("schoolId", v)}
        />
        <HeaderField
          label="Region"
          span="col-span-3"
          value={header.region}
          onChange={(v) => onChange("region", v)}
        />
        <HeaderField
          label="Division"
          span="col-span-4"
          value={header.division}
          onChange={(v) => onChange("division", v)}
        />
        <HeaderField
          label="District"
          span="col-span-3"
          value={header.district}
          onChange={(v) => onChange("district", v)}
        />
      </div>
      <div className="grid grid-cols-12 items-end gap-x-4 gap-y-2">
        <HeaderField
          label="School Name"
          span="col-span-5"
          value={header.schoolName}
          onChange={(v) => onChange("schoolName", v)}
        />
        <HeaderField
          label="School Year"
          span="col-span-2"
          value={header.schoolYear}
          onChange={(v) => onChange("schoolYear", v)}
        />
        <HeaderField
          label="Grade Level"
          span="col-span-2"
          value={header.gradeLevel}
          onChange={(v) => onChange("gradeLevel", v)}
        />
        <HeaderField
          label="Section"
          span="col-span-3"
          value={header.section}
          onChange={(v) => onChange("section", v)}
        />
      </div>
    </div>
  );
}
