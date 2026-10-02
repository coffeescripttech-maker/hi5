/**
 * Validation rules for the Transfer Request form.
 *
 * Kept in one module so the Registrar form and the server agree on what a valid
 * request looks like. The rules mirror the enrollment module's learner schema
 * (see EnrollmentModule.tsx) so a learner transferred in is held to the same
 * standard as one enrolled directly — a transfer must not be a way to bypass
 * student-record validation.
 *
 * Server-side validation is still authoritative; this exists so the Registrar
 * learns about a bad LRN before a round trip, not instead of the API.
 */
import { z } from 'zod';

/** DepEd LRNs are exactly 12 digits. */
export const LRN_PATTERN = /^\d{12}$/;

/** PH mobile: 09XXXXXXXXX or +639XXXXXXXXX. */
export const PH_MOBILE_PATTERN = /^(09|\+639)\d{9}$/;

/** Minimum sensible age for a JHS enrollee (Grade 7) and an upper sanity bound. */
const MIN_AGE = 10;
const MAX_AGE = 100;

const birthdateRules = z
  .string()
  .min(1, 'Birthdate is required')
  .refine(v => !Number.isNaN(Date.parse(v)), 'Enter a valid birthdate')
  .refine(v => new Date(v) <= new Date(), 'Birthdate cannot be in the future')
  .refine(v => {
    const age =
      (Date.now() - new Date(v).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    return age >= MIN_AGE && age <= MAX_AGE;
  }, `Learner must be between ${MIN_AGE} and ${MAX_AGE} years old`);

/**
 * A brand-new learner arriving from another school. Every field here is written
 * straight to the students table, so each one is validated.
 */
export const newLearnerSchema = z.object({
  student_name: z
    .string()
    .trim()
    .min(2, "Learner's name is required")
    .max(150, 'Name is too long (max 150 characters)'),
  lrn: z
    .string()
    .trim()
    .min(1, 'LRN is required')
    .regex(LRN_PATTERN, 'LRN must be exactly 12 digits'),
  sex: z.enum(['male', 'female'], { message: 'Select a sex' }),
  birthdate: birthdateRules,
  grade_level: z.coerce
    .number({ message: 'Select a grade level' })
    .int()
    .min(7, 'Junior high school runs from Grade 7 to Grade 12')
    .max(12, 'Junior high school runs from Grade 7 to Grade 12'),
  previous_school: z
    .string()
    .trim()
    .max(150, 'School name is too long (max 150 characters)')
    .optional()
    .or(z.literal('')),
});

/** A learner already on file returns only a reason; their record is untouched. */
export const existingLearnerSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, 'A reason is required for every transfer request')
    .max(500, 'Reason is too long (max 500 characters)'),
});

/** Transfer-Out only needs to know who is leaving and why. */
export const transferOutSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, 'A reason is required for every transfer request')
    .max(500, 'Reason is too long (max 500 characters)'),
  destination_school: z
    .string()
    .trim()
    .max(150, 'School name is too long (max 150 characters)')
    .optional()
    .or(z.literal('')),
});

export type NewLearnerValues = z.infer<typeof newLearnerSchema>;

/**
 * Validate and return field-keyed messages, or an empty object when valid.
 * `fields` lets a caller validate a subset (e.g. only the new-learner block).
 */
export function validate<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): Record<string, string> {
  const result = schema.safeParse(data);
  if (result.success) return {};

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}
