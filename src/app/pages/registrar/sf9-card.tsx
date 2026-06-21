"use client"

import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"

/* ---------------------------------------------------------------- */
/* DepEd School Form 9 (SF9) — Learner's Progress Report Card        */
/* ---------------------------------------------------------------- */

const LEARNING_AREAS = [
  "Filipino",
  "English",
  "Mathematics",
  "Science",
  "Araling Panlipunan (AP)",
  "Edukasyon sa Pagpapakatao (EsP)",
  "Edukasyong Pantahanan at Pangkabuhayan",
]

const MAPEH_SUB = ["Music", "Arts", "Physical Education", "Health"]

const CORE_VALUES: { value: string; statements: string[] }[] = [
  {
    value: "1. Maka-Diyos",
    statements: [
      "Expresses one's spiritual beliefs while respecting the spiritual beliefs of others.",
      "Shows adherence to ethical principles by upholding truth in all undertakings.",
    ],
  },
  {
    value: "2. Makatao",
    statements: [
      "In sensitive to individual, social, and cultural diffrences;",
      "Demonstrates contributions towards solidarity.",
    ],
  },
  {
    value: "3. Maka-Kalikasan",
    statements: ["Cares for environment and utilizes resources wisely, judiciously and economically."],
  },
  {
    value: "4. Maka-Bansa",
    statements: [
      "Demonstrates pride in being a Filipino; exercises the rights and responsibilities of a Filipino citizen.",
      "Demonstrate appropriate behavior in carrying out activities in school, community and country.",
    ],
  },
]

const DESCRIPTORS = [
  ["Outstanding", "90-100", "Passed"],
  ["Very Satisfactory", "85-89", "Passed"],
  ["Satisfactory", "80-84", "Passed"],
  ["Fairly Satisfactory", "75-79", "Passed"],
  ["Did Not Meet Expectations", "Below 75", "Failed"],
]

const MARKINGS = [
  ["AO", "Always Observed"],
  ["SO", "Sometimes Observed"],
  ["RO", "Rarely Observed"],
  ["NO", "Not Observed"],
]

const MONTHS = ["Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "Total"]
const ATTENDANCE_ROWS = ["No. of School Days", "No. of Days Present", "No. of Days Absent"]

/* A blank editable cell used throughout the card */
function Cell({ className = "" }: { className?: string }) {
  return <input className={`sf1-input w-full bg-transparent text-center text-[10px] outline-none focus:bg-amber-50 ${className}`} />
}

/* A labelled fill-in line, e.g. "Name : ____" */
function FillLine({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div className="flex items-end gap-1">
      <span className="whitespace-nowrap text-[11px] font-semibold">{label}</span>
      <input className={`sf1-input min-w-0 flex-1 border-b border-black bg-transparent text-[11px] outline-none focus:bg-amber-50 ${className}`} />
    </div>
  )
}

export function SF9Card() {
  return (
    <div className="min-h-screen bg-muted/40 py-6">
      {/* Toolbar */}
      <div className="no-print mx-auto mb-4 flex max-w-[1100px] items-center justify-between px-4">
        <div>
          <h1 className="text-lg font-bold text-foreground">
            School Form 9 (SF9) — Learner&apos;s Progress Report Card
          </h1>
          <p className="text-sm text-muted-foreground">Fillable report card. Use Print for the official layout.</p>
        </div>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-4" /> Print
        </Button>
      </div>

      <div className="sf1-sheet mx-auto w-fit max-w-full space-y-8 overflow-x-auto bg-white p-6 text-black shadow-sm">
        {/* ============================================================ */}
        {/* PAGE 1 — Cover spread: attendance + learner info/letter      */}
        {/* ============================================================ */}
        <div className="sf1-page" style={{ minWidth: "900px" }}>
          <div className="grid grid-cols-2 gap-8">
            {/* ---- Left: attendance + transfer ---- */}
            <div className="space-y-5">
              <div>
                <h3 className="mb-1 text-center text-[12px] font-bold">REPORT ON ATTENDANCE</h3>
                <table className="w-full table-fixed border-collapse text-[9px]">
                  <thead>
                    <tr>
                      <th className="border border-black px-0.5 py-0.5" />
                      {MONTHS.map((m) => (
                        <th key={m} className="border border-black px-0.5 py-0.5 font-bold">{m}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ATTENDANCE_ROWS.map((label) => (
                      <tr key={label}>
                        <td className="border border-black px-1 py-1 text-left font-semibold leading-tight">{label}</td>
                        {MONTHS.map((m) => (
                          <td key={m} className="border border-black p-0"><Cell className="h-7" /></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h4 className="text-[11px] font-bold">PARENT / GUARDIAN&apos;S SIGNATURE</h4>
                <div className="mt-2 space-y-3 text-[11px]">
                  {["1st Quarter", "2nd Quarter", "3rd Quarter", "4th Quarter"].map((q) => (
                    <FillLine key={q} label={q} />
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-center text-[11px] font-bold">Certificate of Transfer</h4>
                <div className="mt-2 space-y-3 text-[11px]">
                  <div className="flex items-end gap-2">
                    <FillLine label="Admitted to Grade:" className="w-24" />
                    <FillLine label="Section:" />
                  </div>
                  <FillLine label="Eligibility for Admission to Grade:" />
                  <div className="flex items-end gap-6 pt-2">
                    <FillLine label="Approved:" />
                    <input className="sf1-input min-w-0 flex-1 border-b border-black bg-transparent outline-none focus:bg-amber-50" />
                  </div>
                  <div className="flex justify-between text-center text-[9px] italic">
                    <span className="flex-1">School Head</span>
                    <span className="flex-1">Adviser</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-center text-[11px] font-bold">Cancellation of Eligibility to Transfer</h4>
                <div className="mt-2 space-y-3 text-[11px]">
                  <FillLine label="Admitted in:" />
                  <div className="flex items-end gap-6">
                    <FillLine label="Date:" />
                    <input className="sf1-input min-w-0 flex-1 border-b border-black bg-transparent outline-none focus:bg-amber-50" />
                  </div>
                  <div className="text-right text-[9px] italic">School Head</div>
                </div>
              </div>
            </div>

            {/* ---- Right: letterhead + learner info + letter ---- */}
            <div className="space-y-3">
              <div className="flex justify-between text-[10px] italic">
                <span>SF9-SHS</span>
                <div className="flex items-center gap-1">
                  <span className="font-semibold not-italic">LRN</span>
                  <div className="flex">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <input key={i} className="sf1-input size-4 border border-black text-center text-[9px] outline-none focus:bg-amber-50" />
                    ))}
                  </div>
                </div>
              </div>

              {/* Letterhead */}
              <div className="flex items-center justify-center gap-2 text-center">
                <Image
                  src="/deped-seal.png"
                  alt="Department of Education seal"
                  width={48}
                  height={48}
                  className="size-10 object-contain"
                />
                <div className="text-[11px] leading-tight">
                  <p>Republic of the Philippines</p>
                  <p className="text-[13px] font-bold">DEPARTMENT OF EDUCATION</p>
                  <p className="italic">Region</p>
                </div>
              </div>
              <div className="text-center text-[11px] leading-tight">
                <p className="font-bold underline">DIVISION OF XXXXXXX</p>
                <p className="italic">Division</p>
                <p className="mt-1 font-bold underline">DEPED TAMBAYAN NATIONAL HIGH SCHOOL</p>
                <p className="italic">School</p>
              </div>

              {/* Learner identification */}
              <div className="space-y-2 pt-2">
                <FillLine label="Name :" />
                <div className="grid grid-cols-3 pl-12 text-[9px]">
                  <span>Last Name</span>
                  <span>First Name</span>
                  <span>Middle Name</span>
                </div>
                <div className="flex items-end gap-4">
                  <FillLine label="Age :" className="w-20" />
                  <FillLine label="Sex:" />
                </div>
                <div className="flex items-end gap-4">
                  <FillLine label="Grade :" className="w-20" />
                  <FillLine label="Section:" />
                </div>
                <FillLine label="Curriculum:" />
                <FillLine label="School Year:" />
                <FillLine label="Track/ Strand:" />
              </div>

              {/* Letter */}
              <div className="space-y-2 pt-3 text-[10px] italic leading-snug">
                <p>Dear Parent/Guardian,</p>
                <p className="pl-4">
                  This report card shows the ability and progress your child has made in the different learning areas as
                  well as his/her core values.
                </p>
                <p className="pl-4">The school welcomes you should you desire to know more about your child&apos;s progress.</p>
              </div>

              {/* Signatures */}
              <div className="flex justify-between pt-6 text-center text-[10px]">
                <div className="flex-1">
                  <div className="mx-2 border-t border-black pt-0.5 italic">Principal IV</div>
                </div>
                <div className="flex-1">
                  <div className="font-bold">RICHARD R. RAQUEÑO</div>
                  <div className="italic">Adviser</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* PAGE 2 — Inside spread: grades + observed values             */}
        {/* ============================================================ */}
        <div className="sf1-page" style={{ minWidth: "900px" }}>
          {/* Title block: logo left, title center, logo right */}
          <div className="mb-4 flex items-center justify-between gap-4">
            <Image
              src="/deped-seal.png"
              alt="Department of Education seal"
              width={64}
              height={64}
              className="size-14 shrink-0 object-contain"
            />
            <div className="text-center">
              <h2 className="text-[14px] font-bold">School Form 9 (SF9)</h2>
              <p className="text-[11px] font-semibold">Learner&apos;s Progress Report Card</p>
            </div>
            <Image
              src="/right-logo.png"
              alt="Department of Education logo"
              width={140}
              height={76}
              className="h-11 w-auto shrink-0 object-contain"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* ---- Report on Learning Progress and Achievement ---- */}
            <div>
              <h3 className="mb-1 text-center text-[12px] font-bold">REPORT ON LEARNING PROGRESS AND ACHIEVEMENT</h3>
              <table className="w-full table-fixed border-collapse text-[10px]">
                <colgroup>
                  <col style={{ width: "34%" }} />
                  <col span={4} style={{ width: "8%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "18%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th rowSpan={2} className="border border-black px-1 py-1 align-middle font-bold">Learning Areas</th>
                    <th colSpan={4} className="border border-black px-1 py-0.5 font-bold">Quarter</th>
                    <th rowSpan={2} className="border border-black px-1 py-1 align-middle font-bold">Final Rating</th>
                    <th rowSpan={2} className="border border-black px-1 py-1 align-middle font-bold">Remarks</th>
                  </tr>
                  <tr className="font-bold">
                    {[1, 2, 3, 4].map((q) => (
                      <th key={q} className="border border-black px-1 py-0.5">{q}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {LEARNING_AREAS.map((area) => (
                    <tr key={area}>
                      <td className="border border-black px-1 py-0.5 text-left">{area}</td>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <td key={i} className="border border-black p-0"><Cell className="h-6" /></td>
                      ))}
                    </tr>
                  ))}
                  {/* MAPEH with sub areas */}
                  <tr>
                    <td className="border border-black px-1 pt-0.5 text-left font-semibold align-top" rowSpan={MAPEH_SUB.length + 1}>
                      MAPEH
                      <div className="pl-3 font-normal">
                        {MAPEH_SUB.map((m) => (
                          <div key={m}>{m}</div>
                        ))}
                      </div>
                    </td>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <td key={i} className="border border-black p-0"><Cell className="h-6" /></td>
                    ))}
                  </tr>
                  {MAPEH_SUB.slice(1).map((m) => (
                    <tr key={m}>
                      {Array.from({ length: 4 }).map((_, i) => (
                        <td key={i} className="border border-black p-0"><Cell className="h-6" /></td>
                      ))}
                      <td className="border border-black bg-gray-200 p-0" />
                      <td className="border border-black bg-gray-200 p-0" />
                    </tr>
                  ))}
                  {/* General Average */}
                  <tr>
                    <td colSpan={5} className="border border-black px-1 py-1 text-center font-bold">General Average</td>
                    <td className="border border-black p-0"><Cell className="h-6" /></td>
                    <td className="border border-black p-0"><Cell className="h-6" /></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ---- Report on Learner's Observed Values ---- */}
            <div>
              <h3 className="mb-1 text-center text-[12px] font-bold">REPORT ON LEARNER&apos;S OBSERVES VALUES</h3>
              <table className="w-full table-fixed border-collapse text-[10px]">
                <colgroup>
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "44%" }} />
                  <col span={4} style={{ width: "10%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th rowSpan={2} className="border border-black px-1 py-1 align-middle font-bold">Core Values</th>
                    <th rowSpan={2} className="border border-black px-1 py-1 align-middle font-bold">Behavior Statements</th>
                    <th colSpan={4} className="border border-black px-1 py-0.5 font-bold">Quarter</th>
                  </tr>
                  <tr className="font-bold">
                    {[1, 2, 3, 4].map((q) => (
                      <th key={q} className="border border-black px-1 py-0.5">{q}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CORE_VALUES.map((cv) =>
                    cv.statements.map((st, idx) => (
                      <tr key={cv.value + idx}>
                        {idx === 0 ? (
                          <td
                            rowSpan={cv.statements.length}
                            className="border border-black px-1 py-1 text-left align-middle font-semibold"
                          >
                            {cv.value}
                          </td>
                        ) : null}
                        <td className="border border-black px-1 py-1 text-left align-middle leading-tight">{st}</td>
                        {[1, 2, 3, 4].map((q) => (
                          <td key={q} className="border border-black p-0"><Cell className="h-10" /></td>
                        ))}
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ---- Legends ---- */}
          <div className="mt-4 grid grid-cols-2 gap-6 text-[10px]">
            <div>
              <div className="grid grid-cols-3 font-bold">
                <span>Descriptors</span>
                <span>Grading Scale</span>
                <span>Remarks</span>
              </div>
              {DESCRIPTORS.map((d) => (
                <div key={d[0]} className="grid grid-cols-3">
                  <span>{d[0]}</span>
                  <span>{d[1]}</span>
                  <span>{d[2]}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="grid grid-cols-2 font-bold">
                <span>Marking</span>
                <span>Non- Numerical Rating</span>
              </div>
              {MARKINGS.map((m) => (
                <div key={m[0]} className="grid grid-cols-2">
                  <span>{m[0]}</span>
                  <span>{m[1]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
