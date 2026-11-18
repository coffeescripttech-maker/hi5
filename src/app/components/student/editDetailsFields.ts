/**
 * Student Details Edit (client revision: Hi5_Portal_Student_Details_Edit_
 * Expected_Behavior.md) — the edit panel and the change-history tab used on
 * the learner profile.
 *
 * Rules implemented here (mirrored server-side in
 * server/src/controllers/studentDetails.controller.ts):
 *   - Routine fields edit freely; identity fields (name parts, suffix, LRN,
 *     birthdate, sex) require a reason.
 *   - Save is disabled until something changes; changed fields are
 *     highlighted with the old → new values.
 *   - A confirmation dialog lists each change and its effects.
 *   - Optimistic conflict: if the learner was updated after the panel was
 *     opened, the save returns the latest values (409).
 */

export interface EditFieldDef {
  key: string;
  label: string;
  type?: "text" | "date" | "select" | "number" | "checkbox";
  options?: string[];
}

export const NAME_SUFFIX_OPTIONS = [
  'Jr.',
  'Sr.',
  'II',
  'III',
  'IV',
  'V',
  'Other'
] as const;

export const ROUTINE_FIELDS: EditFieldDef[] = [
  { key: 'contact', label: 'Contact Number', type: 'text' },
  { key: 'guardian', label: 'Guardian Name', type: 'text' },
  { key: 'guardian_relationship', label: 'Guardian Relationship', type: 'text' },
  { key: 'house_street', label: 'House #/Street', type: 'text' },
  { key: 'barangay', label: 'Barangay', type: 'text' },
  { key: 'city_municipality', label: 'Municipality/City', type: 'text' },
  { key: 'province', label: 'Province', type: 'text' },
  { key: 'zip_code', label: 'ZIP', type: 'text' },
  { key: 'father_name', label: "Father's Name", type: 'text' },
  { key: 'mother_name', label: "Mother's Maiden Name", type: 'text' },
  { key: 'mother_tongue', label: 'Mother Tongue', type: 'text' },
  { key: 'ip_ethnic_group', label: 'IP (Ethnic Group)', type: 'text' },
  { key: 'religion', label: 'Religion', type: 'text' },
  { key: 'guardian_4ps', label: '4Ps Member', type: 'checkbox' },
  { key: 'height_cm', label: 'Height (cm)', type: 'number' },
  { key: 'weight_kg', label: 'Weight (kg)', type: 'number' }
];

export const IDENTITY_FIELDS: EditFieldDef[] = [
  { key: 'last_name', label: 'Last Name', type: 'text' },
  { key: 'first_name', label: 'First Name', type: 'text' },
  { key: 'middle_name', label: 'Middle Name', type: 'text' },
  { key: 'name_ext', label: 'Name Suffix', type: 'select', options: [...NAME_SUFFIX_OPTIONS] },
  { key: 'lrn', label: 'LRN', type: 'text' },
  { key: 'birthdate', label: 'Birthdate', type: 'date' },
  { key: 'sex', label: 'Sex', type: 'select', options: ['male', 'female'] }
];

export const EDIT_REASONS = [
  'Typo',
  'Per birth certificate',
  'Per LIS or LRN record',
  'Other'
] as const;

/** Label lookup for history rows (DB column → human label). */
export function fieldLabel(field: string): string {
  if (field === 'name') return 'Full Name';
  const sfEdit = field.match(/^sf_edit:(SF\d+):(.+)$/);
  if (sfEdit) {
    const form = sfEdit[1];
    const key = sfEdit[2];
    const what = key.startsWith('learner:')
      ? key.slice('learner:'.length)
      : key.replace(/^s:/, '');
    return `Saved edit on ${form}: ${what}`;
  }
  const all = [...ROUTINE_FIELDS, ...IDENTITY_FIELDS];
  const hit = all.find(f => f.key === field);
  return hit ? hit.label : field;
}
