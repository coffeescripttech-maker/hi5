import React, { useState, useEffect, useRef } from 'react';
import {
  UserPlus,
  UserCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  Check,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  User,
  Users,
  UserX,
  MapPin,
  Phone,
  Clock,
  BookOpen,
  FileText,
  GraduationCap,
  X,
  UserMinus,
  Lock
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  studentsApi,
  StudentRow,
  CreateStudentPayload
} from '../../services/students';
import { enrollmentsApi, EnrollmentRow } from '../../services/enrollments';
import { strandTracksApi, StrandTrackRow } from '../../services/strandTracks';
import { schoolYearsApi } from '../../services/schoolYears';
import { sectionsApi, SectionRow } from '../../services/sections';
import { HybridTable } from '../../components/HybridTable';
import { z } from 'zod';

// ── Zod Validation Schemas ──────────────────────────────────────────────

const newStudentSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .min(2, 'First name must be at least 2 characters'),
  middleName: z.string().optional(),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .min(2, 'Last name must be at least 2 characters'),
  birthdate: z
    .string()
    .min(1, 'Birthdate is required')
    .refine(val => !isNaN(Date.parse(val)), 'Invalid date')
    .refine(
      val => new Date(val) <= new Date(),
      'Birthdate cannot be in the future'
    )
    .refine(val => {
      const age = Math.floor(
        (Date.now() - new Date(val).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      );
      return age <= 100;
    }, 'Invalid birthdate'),
  sex: z.string().min(1, 'Sex is required'),
  address: z.string().min(5, 'Address must be at least 5 characters'),
  lrn: z
    .string()
    .min(1, 'LRN is required')
    .regex(/^\d{12}$/, 'LRN must be exactly 12 digits'),
  guardian: z
    .string()
    .min(1, 'Guardian name is required')
    .min(2, 'Guardian name must be at least 2 characters'),
  contact: z
    .string()
    .min(1, 'Contact number is required')
    .regex(
      /^(09|\+639)\d{9}$/,
      'Enter a valid PH mobile number (e.g. 09123456789'
    )
});

const retSearchSchema = z.object({
  query: z.string().min(1, 'Enter an LRN or Student ID to search')
});

const dropReasonSchema = z.object({
  reason: z.string().min(1, 'Please select a reason for the drop or transfer')
});

// ── End Validation Schemas ──────────────────────────────────────────────

type Flow = 'select' | 'new' | 'returning' | 'drop';
type NewStep = 1 | 2 | 3 | 4 | 5;
type RetStep = 1 | 2 | 3 | 4;
type DropStep = 1 | 2 | 3;

const DROP_REASONS = [
  'Dropout — Family/Financial Reasons',
  'Dropout — Health Reasons',
  'Dropout — Relocation',
  'Transfer Out — To Another Public School',
  'Transfer Out — To Private School',
  'Transfer In — From Another School',
  'Other'
];

const GRADE_LEVELS = [7, 8, 9, 10, 11, 12];

const PROGRAMS = [
  {
    value: 'regular',
    label: 'Mainstream / Regular',
    desc: 'Standard DepEd Basic Education Curriculum',
    color: 'blue'
  },
  {
    value: 'ste',
    label: 'STE',
    desc: 'Science, Technology & Engineering',
    color: 'purple'
  },
  {
    value: 'spfl',
    label: 'SPFL',
    desc: 'Special Program in Foreign Language',
    color: 'teal'
  },
  {
    value: 'open_high',
    label: 'Open High School',
    desc: 'Flexible learning for independent study',
    color: 'amber'
  },
  {
    value: 'als_shs',
    label: 'ALS SHS',
    desc: 'Alternative Learning System',
    color: 'emerald'
  }
];

const PROGRAM_BADGES: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  regular: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Mainstream' },
  ste: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'STE' },
  spfl: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'SPFL' },
  open_high: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Open High' },
  als_shs: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'ALS SHS' }
};

const REQUIREMENTS_LIST = [
  { key: 'psa_birth_cert', label: 'PSA/NSO Birth Certificate (photocopy)' },
  { key: 'previous_grade_card', label: 'Previous Report Card / Form 138' },
  { key: 'good_moral', label: 'Good Moral Certificate' },
  { key: 'id_photo', label: '2 pcs. 2x2 ID Picture' },
  { key: 'medical_clearance', label: 'Medical/Dental Clearance' },
  { key: 'parent_consent', label: 'Parent/Guardian Consent Form' },
  { key: 'transcript', label: 'Transcript of Records / Form 137' },
  { key: 'lrn_verification', label: 'LRN Verification Slip' }
];

// Requirements that MUST be submitted per student classification. Keys must
// reference REQUIREMENTS_LIST keys. Classifications without an entry
// (e.g. Non-Reader, Regular) only need the base list above.
const CATEGORY_REQUIREMENTS: Record<string, string[]> = {
  Transferee: ['previous_grade_card', 'good_moral', 'transcript', 'lrn_verification'],
  PWD: ['psa_birth_cert', 'medical_clearance'],
  '4Ps Beneficiary': ['psa_birth_cert', 'parent_consent', 'lrn_verification'],
  'Balik-aral': ['previous_grade_card', 'good_moral', 'lrn_verification']
};

// Set of requirement keys required by the selected classifications
function requiredReqKeysFor(classifications: string[]): Set<string> {
  const keys = new Set<string>();
  for (const c of classifications) {
    (CATEGORY_REQUIREMENTS[c] || []).forEach(k => keys.add(k));
  }
  return keys;
}

// Which selected classifications require a given requirement key
function categoriesRequiring(key: string, classifications: string[]): string[] {
  return classifications.filter(c => (CATEGORY_REQUIREMENTS[c] || []).includes(key));
}

// ── Landing-card illustrations (flat vector) ────────────────────────────
// Hand-drawn inline SVGs so the landing cards stay self-contained — no image
// assets, no external requests. Each shares a soft blob backdrop in its
// accent hue and a small friendly character.

function NewStudentIllustration({ className = 'w-full h-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 440 320" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="ns-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E7F1FF" />
          <stop offset="100%" stopColor="#F8FBFF" />
        </linearGradient>
      </defs>
      {/* backdrop */}
      <ellipse cx="220" cy="170" rx="196" ry="126" fill="url(#ns-bg)" />
      <ellipse cx="220" cy="170" rx="150" ry="90" fill="#FFFFFF" opacity="0.55" />
      {/* sun */}
      <circle cx="356" cy="60" r="26" fill="#FFD98A" />
      <circle cx="356" cy="60" r="17" fill="#FFE4A8" />
      {/* clouds */}
      <g fill="#FFFFFF" opacity="0.95">
        <rect x="62" y="58" width="66" height="16" rx="8" />
        <rect x="72" y="48" width="34" height="12" rx="6" />
        <rect x="322" y="112" width="54" height="13" rx="6.5" />
        <rect x="330" y="103" width="30" height="10" rx="5" />
      </g>
      {/* school building */}
      <g>
        <path d="M80 134 L163 80 L246 134 Z" fill="#7FB2FF" />
        <rect x="92" y="134" width="142" height="112" rx="12" fill="#FFFFFF" stroke="#CBDFF8" strokeWidth="2" />
        <path d="M112 122 L163 88 L214 122 Z" fill="#A9C9F8" opacity="0.6" />
        {/* flag */}
        <rect x="155" y="60" width="5" height="24" rx="2.5" fill="#A5C6F7" />
        <path d="M160 63 L186 70 L160 77 Z" fill="#4C8CFF" />
        {/* clock */}
        <circle cx="163" cy="166" r="9" fill="#FFE4A8" stroke="#F2C463" strokeWidth="2" />
        <path d="M163 161 v6 M163 166 l5 3" stroke="#C9973C" strokeWidth="2" strokeLinecap="round" />
        {/* windows */}
        <circle cx="118" cy="168" r="11" fill="#EAF3FF" stroke="#A9CCF8" strokeWidth="2" />
        <circle cx="208" cy="168" r="11" fill="#EAF3FF" stroke="#A9CCF8" strokeWidth="2" />
        <rect x="113" y="163" width="10" height="3" rx="1.5" fill="#BFDCFF" />
        <rect x="203" y="163" width="10" height="3" rx="1.5" fill="#BFDCFF" />
        {/* door */}
        <rect x="145" y="190" width="36" height="56" rx="18" fill="#BFDBFF" />
        <circle cx="174" cy="219" r="3.5" fill="#8FB4E8" />
      </g>
      {/* student */}
      <g>
        <ellipse cx="316" cy="266" rx="42" ry="7" fill="#D6E6FA" />
        {/* backpack */}
        <rect x="266" y="192" width="22" height="52" rx="11" fill="#7FB2FF" />
        <rect x="270" y="204" width="14" height="22" rx="7" fill="#A5C6F7" />
        {/* legs */}
        <rect x="292" y="240" width="15" height="26" rx="7.5" fill="#42508C" />
        <rect x="316" y="240" width="15" height="26" rx="7.5" fill="#42508C" />
        {/* shoes */}
        <rect x="287" y="262" width="21" height="9" rx="4.5" fill="#2E3A63" />
        <rect x="314" y="262" width="21" height="9" rx="4.5" fill="#2E3A63" />
        {/* body */}
        <rect x="282" y="186" width="62" height="60" rx="16" fill="#4C8CFF" />
        <path d="M300 246 l7 -15 h20 l7 15 z" fill="#3E7CE8" />
        {/* left arm + enrollment paper */}
        <rect x="266" y="194" width="15" height="42" rx="7.5" fill="#4C8CFF" />
        <circle cx="272" cy="238" r="8" fill="#FFC9A3" />
        <rect x="256" y="210" width="24" height="32" rx="4" fill="#FFFFFF" stroke="#CBDFF8" strokeWidth="2" />
        <rect x="261" y="217" width="14" height="3" rx="1.5" fill="#BFD9F5" />
        <rect x="261" y="224" width="14" height="3" rx="1.5" fill="#BFD9F5" />
        <rect x="261" y="231" width="9" height="3" rx="1.5" fill="#BFD9F5" />
        {/* right arm waving */}
        <rect x="338" y="194" width="16" height="44" rx="8" fill="#4C8CFF" transform="rotate(12 346 216)" />
        <circle cx="356" cy="192" r="8" fill="#FFC9A3" />
        {/* head */}
        <circle cx="316" cy="164" r="24" fill="#FFC9A3" />
        <path d="M290 158 a26 26 0 0 1 52 0 l-4 7 h-44 z" fill="#4A3A2A" />
        {/* face */}
        <circle cx="306" cy="167" r="2.8" fill="#33281F" />
        <circle cx="326" cy="167" r="2.8" fill="#33281F" />
        <path d="M311 176 Q316 181 321 176" stroke="#33281F" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <ellipse cx="302" cy="173" rx="4" ry="2.5" fill="#FFB59E" opacity="0.85" />
        <ellipse cx="330" cy="173" rx="4" ry="2.5" fill="#FFB59E" opacity="0.85" />
        {/* graduation cap */}
        <path d="M316 128 L344 140 L316 152 L288 140 Z" fill="#42508C" />
        <circle cx="316" cy="140" r="4" fill="#FFD98A" />
        <path d="M344 140 q13 11 6 21" stroke="#FF9F6B" strokeWidth="3" fill="none" strokeLinecap="round" />
        <circle cx="350" cy="161" r="3.5" fill="#FF9F6B" />
      </g>
      {/* floating */}
      <g>
        <path d="M96 98 l4 8 8 4 -8 4 -4 8 -4 -8 -8 -4 8 -4 z" fill="#7FB2FF" />
        <path d="M356 252 l3.5 7 7 3.5 -7 3.5 -3.5 7 -3.5 -7 -7 -3.5 7 -3.5 z" fill="#FFD98A" />
        <g fill="#C8E0FC">
          <circle cx="58" cy="224" r="5" />
          <circle cx="398" cy="140" r="4" />
          <circle cx="392" cy="182" r="3" />
        </g>
        {/* open book */}
        <g>
          <path d="M120 274 q11 -7 22 0 v13 q-11 -7 -22 0 z" fill="#4C8CFF" />
          <path d="M142 274 q11 -7 22 0 v13 q-11 -7 -22 0 z" fill="#7FB2FF" />
        </g>
      </g>
    </svg>
  );
}

function ReturningStudentIllustration({ className = 'w-full h-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 440 320" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="rs-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E5F6ED" />
          <stop offset="100%" stopColor="#F7FCF9" />
        </linearGradient>
      </defs>
      {/* backdrop */}
      <ellipse cx="220" cy="170" rx="196" ry="126" fill="url(#rs-bg)" />
      <ellipse cx="220" cy="170" rx="150" ry="90" fill="#FFFFFF" opacity="0.55" />
      {/* clouds */}
      <g fill="#FFFFFF" opacity="0.95">
        <rect x="60" y="60" width="64" height="16" rx="8" />
        <rect x="70" y="50" width="34" height="12" rx="6" />
        <rect x="330" y="104" width="50" height="13" rx="6.5" />
        <rect x="336" y="95" width="30" height="10" rx="5" />
      </g>
      {/* ground shadow */}
      <ellipse cx="222" cy="266" rx="96" ry="8" fill="#CFEEDD" />
      {/* laptop on the side */}
      <g>
        <rect x="108" y="232" width="72" height="46" rx="7" fill="#E8F6EE" stroke="#9DBBA8" strokeWidth="2" />
        <rect x="115" y="239" width="58" height="32" rx="4" fill="#A8E2C2" />
        <path d="M100 282 h88 l-12 10 h-64 z" fill="#9AA5B5" />
      </g>
      {/* student */}
      <g>
        {/* backpack */}
        <rect x="176" y="184" width="24" height="54" rx="12" fill="#2E9C63" />
        <rect x="180" y="196" width="16" height="24" rx="8" fill="#57BE85" />
        {/* legs walking */}
        <rect x="198" y="238" width="15" height="28" rx="7.5" fill="#2E3A63" transform="rotate(7 205 252)" />
        <rect x="228" y="238" width="15" height="28" rx="7.5" fill="#2E3A63" transform="rotate(-7 235 252)" />
        {/* shoes */}
        <rect x="195" y="264" width="21" height="9" rx="4.5" fill="#1F2944" />
        <rect x="227" y="264" width="21" height="9" rx="4.5" fill="#1F2944" />
        {/* body */}
        <rect x="192" y="178" width="62" height="64" rx="16" fill="#3EBB79" />
        <path d="M210 242 l8 -17 h22 l8 17 z" fill="#32A76B" />
        {/* left arm down */}
        <rect x="184" y="186" width="16" height="42" rx="8" fill="#3EBB79" />
        <circle cx="190" cy="228" r="8" fill="#FFC9A3" />
        {/* right arm holding books */}
        <rect x="242" y="186" width="16" height="44" rx="8" fill="#3EBB79" transform="rotate(-14 250 208)" />
        <circle cx="256" cy="190" r="8" fill="#FFC9A3" />
        {/* books stack */}
        <g>
          <rect x="256" y="210" width="54" height="15" rx="5" fill="#F5C46B" />
          <rect x="261" y="196" width="48" height="14" rx="5" fill="#3EBB79" />
          <rect x="266" y="184" width="40" height="13" rx="5" fill="#8FD9B0" transform="rotate(7 286 190)" />
        </g>
        {/* head */}
        <circle cx="220" cy="148" r="24" fill="#FFC9A3" />
        <path d="M196 142 a24 24 0 0 1 48 0 l-4 7 h-40 z" fill="#5B4A2F" />
        <circle cx="211" cy="150" r="2.8" fill="#33281F" />
        <circle cx="229" cy="150" r="2.8" fill="#33281F" />
        <path d="M215 159 Q220 164 225 159" stroke="#33281F" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <ellipse cx="207" cy="156" rx="4" ry="2.5" fill="#FFB59E" opacity="0.85" />
        <ellipse cx="233" cy="156" rx="4" ry="2.5" fill="#FFB59E" opacity="0.85" />
      </g>
      {/* floating */}
      <g>
        <path d="M362 92 l4 8 8 4 -8 4 -4 8 -4 -8 -8 -4 8 -4 z" fill="#3EBB79" />
        <path d="M78 100 q12 -12 24 0 q-5 -15 -24 -15 q-19 0 -24 15 q12 -12 24 0 z" fill="#57BE85" />
        <path d="M78 190 q9 -9 18 0 q-4 -11 -18 -11 q-14 0 -18 11 q9 -9 18 0 z" fill="#8FD9B0" />
        <g fill="#B8E7CD">
          <circle cx="52" cy="160" r="5" />
          <circle cx="398" cy="210" r="4" />
          <circle cx="390" cy="120" r="3" />
        </g>
        {/* paper plane */}
        <path d="M332 258 l28 -15 -11 28 -7 -9 z" fill="#57BE85" />
        <path d="M349 271 l11 -28" stroke="#2E9C63" strokeWidth="1.5" opacity="0.5" />
      </g>
    </svg>
  );
}

function DropStudentIllustration({ className = 'w-full h-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 440 320" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="ds-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF1E5" />
          <stop offset="100%" stopColor="#FFFBF7" />
        </linearGradient>
      </defs>
      {/* backdrop */}
      <ellipse cx="220" cy="170" rx="196" ry="126" fill="url(#ds-bg)" />
      <ellipse cx="220" cy="170" rx="150" ry="90" fill="#FFFFFF" opacity="0.55" />
      {/* counter */}
      <g>
        <rect x="64" y="214" width="312" height="30" rx="10" fill="#F2C9A4" />
        <rect x="64" y="238" width="312" height="18" fill="#E8B891" />
      </g>
      {/* registrar */}
      <g>
        <rect x="130" y="162" width="42" height="56" rx="12" fill="#F5A25D" />
        <path d="M148 162 v22" stroke="#E28B47" strokeWidth="2" />
        <circle cx="151" cy="138" r="22" fill="#E8B48C" />
        <path d="M129 132 a22 22 0 0 1 44 0 l-3 7 h-38 z" fill="#3A2C24" />
        <circle cx="127" cy="130" r="7" fill="#3A2C24" />
        <g stroke="#4C3B2E" strokeWidth="1.8" fill="none">
          <rect x="140" y="135" width="9" height="7" rx="3" />
          <rect x="153" y="135" width="9" height="7" rx="3" />
          <path d="M149 138 h2" />
        </g>
        <path d="M145 149 Q151 153 157 149" stroke="#4C3B2E" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
      {/* counter items */}
      <g>
        <rect x="104" y="188" width="30" height="36" rx="4" fill="#FFFFFF" stroke="#F3D8C0" strokeWidth="1.5" />
        <rect x="108" y="194" width="22" height="3" rx="1.5" fill="#F0CBB0" />
        <rect x="108" y="201" width="22" height="3" rx="1.5" fill="#F0CBB0" />
        <rect x="108" y="208" width="14" height="3" rx="1.5" fill="#F0CBB0" />
        {/* stamp */}
        <g>
          <rect x="178" y="196" width="26" height="26" rx="5" fill="#FFE1A6" stroke="#F2C463" strokeWidth="2" />
          <circle cx="191" cy="209" r="6" fill="#F5C46B" />
        </g>
      </g>
      {/* student */}
      <g>
        <ellipse cx="306" cy="272" rx="42" ry="7" fill="#F8DDC8" />
        {/* legs */}
        <rect x="290" y="240" width="15" height="30" rx="7.5" fill="#42508C" />
        <rect x="312" y="240" width="15" height="30" rx="7.5" fill="#42508C" />
        {/* shoes */}
        <rect x="286" y="266" width="21" height="9" rx="4.5" fill="#2E3A63" />
        <rect x="311" y="266" width="21" height="9" rx="4.5" fill="#2E3A63" />
        {/* body */}
        <rect x="278" y="180" width="62" height="62" rx="16" fill="#FF8A5C" />
        <path d="M296 242 l7 -16 h22 l7 16 z" fill="#F27949" />
        {/* left arm down */}
        <rect x="334" y="188" width="16" height="42" rx="8" fill="#FF8A5C" />
        <circle cx="342" cy="230" r="8" fill="#FFC9A3" />
        {/* right arm handing paper */}
        <rect x="252" y="182" width="15" height="44" rx="7.5" fill="#FF8A5C" transform="rotate(-18 259 204)" />
        <circle cx="256" cy="184" r="8" fill="#FFC9A3" />
        {/* paper */}
        <rect x="220" y="188" width="28" height="36" rx="4" fill="#FFFFFF" stroke="#F0CBB0" strokeWidth="1.5" />
        <rect x="225" y="195" width="18" height="3" rx="1.5" fill="#F0CBB0" />
        <rect x="225" y="202" width="18" height="3" rx="1.5" fill="#F0CBB0" />
        <rect x="225" y="209" width="12" height="3" rx="1.5" fill="#F0CBB0" />
        {/* head */}
        <circle cx="306" cy="156" r="24" fill="#FFC9A3" />
        <path d="M282 150 a24 24 0 0 1 48 0 l-4 7 h-40 z" fill="#3A2C24" />
        <circle cx="297" cy="158" r="2.8" fill="#33281F" />
        <circle cx="315" cy="158" r="2.8" fill="#33281F" />
        <path d="M301 167 Q306 172 311 167" stroke="#33281F" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <ellipse cx="293" cy="164" rx="4" ry="2.5" fill="#FFB59E" opacity="0.85" />
        <ellipse cx="319" cy="164" rx="4" ry="2.5" fill="#FFB59E" opacity="0.85" />
      </g>
      {/* floating */}
      <g>
        {/* clipboard check */}
        <g>
          <rect x="368" y="68" width="34" height="44" rx="6" fill="#FFFFFF" stroke="#F3D8C0" strokeWidth="2" />
          <rect x="374" y="74" width="22" height="4" rx="2" fill="#F0CBB0" />
          <path d="M382 94 l5 5 8 -10" stroke="#3EBB79" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        {/* clock */}
        <g>
          <circle cx="72" cy="96" r="17" fill="#FFF7EF" stroke="#F0CBB0" strokeWidth="2" />
          <path d="M72 96 v-8 M72 96 l6 4" stroke="#C9973C" strokeWidth="2" strokeLinecap="round" />
        </g>
        {/* padlock */}
        <g>
          <path d="M66 176 a9 9 0 0 1 18 0 v8 h-18 z" fill="#F5C46B" />
          <rect x="64" y="184" width="22" height="16" rx="4" fill="#F5A25D" />
          <circle cx="75" cy="190" r="2" fill="#B0762F" />
        </g>
        <g fill="#F8D4B8">
          <circle cx="392" cy="208" r="4" />
          <circle cx="386" cy="128" r="3" />
        </g>
      </g>
    </svg>
  );
}

const genStudentID = (grade: number) => {
  const yr = new Date().getFullYear() + 1;
  const g = String(grade).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `${yr}-${g}-${seq}`;
};

const getSection = (avg: number | null) => {
  if (avg === null) return 'Pending Section';
  if (avg >= 90) return 'Star Section';
  if (avg >= 85) return 'Gold Section';
  if (avg >= 80) return 'Silver Section';
  if (avg >= 75) return 'Regular Section';
  return 'Non-Reader Section';
};

export function EnrollmentModule() {
  const { showToast } = useApp();
  const [flow, setFlow] = useState<Flow>('select');

  // New student state
  const [newStep, setNewStep] = useState<NewStep>(1);
  const [newData, setNewData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    birthdate: '',
    sex: 'Female',
    address: '',
    lrn: '',
    guardian: '',
    contact: '',
    classifications: [] as string[]
  });
  const [newGrade, setNewGrade] = useState<number | null>(null);
  const [newStudentID, setNewStudentID] = useState('');
  const [enrolledNew, setEnrolledNew] = useState(false);
  const [newErrors, setNewErrors] = useState<Record<string, string>>({});
  const [enrolledSectionName, setEnrolledSectionName] = useState('');
  const [program, setProgram] = useState('regular');
  const [strandTracks, setStrandTracks] = useState<StrandTrackRow[]>([]);
  const [selectedStrandTrackId, setSelectedStrandTrackId] = useState<
    number | null
  >(null);
  const [requirements, setRequirements] = useState<Record<string, boolean>>({
    psa_birth_cert: false,
    previous_grade_card: false,
    good_moral: false,
    id_photo: false,
    medical_clearance: false,
    parent_consent: false,
    transcript: false,
    lrn_verification: false
  });
  const [gradeFile, setGradeFile] = useState<File | null>(null);

  // Returning student state
  const [retStep, setRetStep] = useState<RetStep>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [foundStudent, setFoundStudent] = useState<StudentRow | null>(null);
  const [retGrade, setRetGrade] = useState<number | null>(null);
  const [enrolledRet, setEnrolledRet] = useState(false);
  const [retErrors, setRetErrors] = useState<Record<string, string>>({});
  const [notFound, setNotFound] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Drop/Transfer state
  const [dropStep, setDropStep] = useState<DropStep>(1);
  const [dropSearch, setDropSearch] = useState('');
  const [dropFound, setDropFound] = useState<StudentRow | null>(null);
  const [dropNotFound, setDropNotFound] = useState(false);
  const [dropErrors, setDropErrors] = useState<Record<string, string>>({});
  const [dropReason, setDropReason] = useState('');
  const [dropRemarks, setDropRemarks] = useState('');
  const [dropDone, setDropDone] = useState(false);
  const [dropShowSuggestions, setDropShowSuggestions] = useState(false);
  const dropSearchRef = useRef<HTMLDivElement>(null);

  // API data state
  const [allStudents, setAllStudents] = useState<StudentRow[]>([]);
  const [allSections, setAllSections] = useState<SectionRow[]>([]);
  const [allEnrollments, setAllEnrollments] = useState<EnrollmentRow[]>([]);
  const [selectedSYId, setSelectedSYId] = useState<number>(1);
  const [currentSYLabel, setCurrentSYLabel] = useState('');
  const [enrollmentOpen, setEnrollmentOpen] = useState(true);

  // Fetch data on mount
  useEffect(() => {
    Promise.all([
      studentsApi.list(),
      sectionsApi.list(),
      schoolYearsApi.list(),
      enrollmentsApi.list()
    ])
      .then(([students, sections, years, enrollments]) => {
        setAllStudents(students);
        setAllSections(sections);
        setAllEnrollments(enrollments);
        const current = years.find(y => y.is_current === 1);
        if (current) {
          setSelectedSYId(current.id);
          setCurrentSYLabel(current.sy_label);
          setEnrollmentOpen(current.enrollment_open === 1);
        }
      })
      .catch(err => {
        showToast(
          'error',
          'Failed to load data: ' + (err.detail?.error || err.message)
        );
      });
  }, []);

  // Fetch strand tracks when new grade or ret grade changes
  useEffect(() => {
    const grade = newGrade || retGrade;
    if (!grade) return;
    setSelectedStrandTrackId(null);
    const trackType = grade >= 11 ? 'shs_strand' : 'tle';
    strandTracksApi
      .list({ track_type: trackType, grade_level: grade })
      .then(setStrandTracks)
      .catch(() => setStrandTracks([]));
  }, [newGrade, retGrade]);

  // Close suggestions on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
      if (
        dropSearchRef.current &&
        !dropSearchRef.current.contains(e.target as Node)
      ) {
        setDropShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Compute suggestions from allStudents based on search query
  const q = searchQuery.trim().toLowerCase();
  const suggestions = q
    ? allStudents
        .filter(
          s =>
            s.lrn.includes(q) ||
            s.student_id.toLowerCase().includes(q) ||
            s.name.toLowerCase().includes(q)
        )
        .slice(0, 8)
    : [];

  const dq = dropSearch.trim().toLowerCase();
  const dropSuggestions = dq
    ? allStudents
        .filter(
          s =>
            s.lrn.includes(dq) ||
            s.student_id.toLowerCase().includes(dq) ||
            s.name.toLowerCase().includes(dq)
        )
        .slice(0, 8)
    : [];

  const toggleClassification = (val: string) => {
    setNewData(d => ({
      ...d,
      classifications: d.classifications.includes(val)
        ? d.classifications.filter(c => c !== val)
        : [...d.classifications, val]
    }));
  };

  // ── Validation Helpers ─────────────────────────────────────
  const validateNewField = (field: string, value: string) => {
    const fieldSchema = z.object({
      firstName: z
        .string()
        .min(1, 'First name is required')
        .min(2, 'First name must be at least 2 characters'),
      middleName: z.string().optional(),
      lastName: z
        .string()
        .min(1, 'Last name is required')
        .min(2, 'Last name must be at least 2 characters'),
      birthdate: z
        .string()
        .min(1, 'Birthdate is required')
        .refine(val => !isNaN(Date.parse(val)), 'Invalid date')
        .refine(
          val => new Date(val) <= new Date(),
          'Birthdate cannot be in the future'
        ),
      sex: z.string().min(1, 'Sex is required'),
      address: z.string().min(5, 'Address must be at least 5 characters'),
      lrn: z
        .string()
        .min(1, 'LRN is required')
        .regex(/^\d{12}$/, 'LRN must be exactly 12 digits'),
      guardian: z
        .string()
        .min(1, 'Guardian name is required')
        .min(2, 'Guardian name must be at least 2 characters'),
      contact: z
        .string()
        .min(1, 'Contact number is required')
        .regex(
          /^(09|\+639)\d{9}$/,
          'Enter a valid PH mobile number (e.g. 09123456789)'
        ),
      classifications: z.array(z.string()).optional()
    });
    const result =
      fieldSchema.shape[field as keyof typeof fieldSchema.shape]?.safeParse(
        value
      );
    if (!result || result.success) {
      setNewErrors(prev => ({ ...prev, [field]: '' }));
    } else {
      const err = result.error as { issues: Array<{ message: string }> };
      setNewErrors(prev => ({
        ...prev,
        [field]: err.issues[0]?.message || ''
      }));
    }
  };

  const validateNewStep1 = (): boolean => {
    const result = newStudentSchema.safeParse({
      ...newData,
      middleName: newData.middleName || undefined
    });
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach((issue: any) => {
        const path = issue.path[0] as string;
        if (!errs[path]) errs[path] = issue.message;
      });
      setNewErrors(errs);
      return false;
    }
    setNewErrors({});
    return true;
  };

  const updateNewField = (field: string, value: string) => {
    setNewData(d => ({ ...d, [field]: value }));
    validateNewField(field, value);
  };

  const clearNewError = (field: string) => {
    setNewErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleNewNext = () => {
    if (newStep === 1 && !validateNewStep1()) return;
    if (newStep === 2 && !newGrade) return;
    if (newStep === 3) {
      setNewStudentID(genStudentID(newGrade!));
    }
    if (newStep < 5) {
      setNewStep((newStep + 1) as NewStep);
    }
  };

  const handleNewBack = () => {
    setNewErrors({});
    setNewStep((newStep - 1) as NewStep);
  };

  const handleSearch = async () => {
    // Validate search query
    const result = retSearchSchema.safeParse({ query: searchQuery });
    if (!result.success) {
      setRetErrors({ query: 'Enter an LRN or Student ID to search' });
      return;
    }
    setRetErrors({});
    try {
      const students = await studentsApi.list({ search: searchQuery });
      if (students.length > 0) {
        setFoundStudent(students[0]);
        setNotFound(false);
        setRetStep(2);
        // Clear any grade picked for a previously searched student so the
        // validation for the new student always starts from a clean slate.
        setRetGrade(null);
      } else {
        setNotFound(true);
      }
    } catch {
      showToast('error', 'Search failed. Please try again.');
    }
  };

  // Grade the student completed before this enrollment — shown as "Previous Grade"
  // on returning enrollment. students.grade_level reflects the CURRENT grade (e.g. 8
  // after promotion), so derive the completed grade from the student's enrollment
  // history and the grade level of the section they were in:
  //   1. the most recent enrollment in a PRIOR school year (normal re-enrollment), or
  //   2. the latest enrollment's section grade when it lags the current grade level
  //      (promotion recorded within the same school year), or
  //   3. the student's current grade level as a last resort.
  const prevGradeLevel = (() => {
    if (!foundStudent) return null;
    const sectionGrade = (enr: EnrollmentRow) =>
      allSections.find(s => s.id === enr.section_id)?.grade_level;
    const sorted = [...allEnrollments]
      .filter(e => e.student_id === foundStudent.id)
      .sort((a, b) => b.school_year_id - a.school_year_id || b.id - a.id);
    const prior = sorted.find(e => e.school_year_id !== selectedSYId);
    if (prior) {
      const g = sectionGrade(prior);
      if (g) return g;
    }
    const latest = sorted[0];
    if (latest) {
      const g = sectionGrade(latest);
      if (g && g < foundStudent.grade_level) return g;
    }
    return foundStudent.grade_level;
  })();

  // Data-integrity guard for the returning flow's grade selection: a student who
  // completed Grade N may only be enrolled in Grade N (retained/repeating) or Grade
  // N+1 (the normal next level) — never a grade they skipped or moved back to.
  const allowedRetGrades = (() => {
    if (prevGradeLevel == null) return GRADE_LEVELS;
    const allowed = new Set<number>();
    if (prevGradeLevel >= 7 && prevGradeLevel <= 12)
      allowed.add(prevGradeLevel); // retained / repeating
    if (prevGradeLevel >= 7 && prevGradeLevel < 12)
      allowed.add(prevGradeLevel + 1); // next level
    return GRADE_LEVELS.filter(g => allowed.has(g));
  })();
  const recommendedRetGrade =
    prevGradeLevel != null && prevGradeLevel < 12 ? prevGradeLevel + 1 : null;
  const completedGrade12 = prevGradeLevel === 12;

  // A student can only have one enrollment per school year (DB unique key). If they
  // already have one in the school year this flow targets (the current SY), the
  // confirm step would fail with a duplicate-enrollment error — surface that early
  // with guidance instead of letting the API throw a raw error.
  const alreadyEnrolledThisSY =
    foundStudent != null &&
    allEnrollments.some(
      e => e.student_id === foundStudent.id && e.school_year_id === selectedSYId
    );

  const handleRetNext = () => {
    if (retStep === 3) {
      // Block advancing unless a grade that is valid for this student is selected
      if (retGrade != null && allowedRetGrades.includes(retGrade))
        setRetStep(4);
      return;
    }
    if (retStep < 4) setRetStep((retStep + 1) as RetStep);
  };

  const resetAll = () => {
    setFlow('select');
    setNewStep(1);
    setNewData({
      firstName: '',
      middleName: '',
      lastName: '',
      birthdate: '',
      sex: 'Female',
      address: '',
      lrn: '',
      guardian: '',
      contact: '',
      classifications: []
    });
    setNewGrade(null);
    setNewStudentID('');
    setGradeFile(null);
    setEnrolledNew(false);
    setNewErrors({});
    setEnrolledSectionName('');
    setProgram('regular');
    setSelectedStrandTrackId(null);
    setStrandTracks([]);
    setRequirements({
      psa_birth_cert: false,
      previous_grade_card: false,
      good_moral: false,
      id_photo: false,
      medical_clearance: false,
      parent_consent: false,
      transcript: false,
      lrn_verification: false
    });
    setRetStep(1);
    setRetErrors({});
    setSearchQuery('');
    setFoundStudent(null);
    setRetGrade(null);
    setEnrolledRet(false);
    setNotFound(false);
    setShowSuggestions(false);
    setDropStep(1);
    setDropSearch('');
    setDropFound(null);
    setDropNotFound(false);
    setDropErrors({});
    setDropReason('');
    setDropRemarks('');
    setDropDone(false);
    setDropShowSuggestions(false);
  };

  const handleDropSearch = async () => {
    if (!dropSearch.trim()) {
      setDropErrors({ search: 'Enter an LRN or Student ID' });
      return;
    }
    setDropErrors({});
    try {
      const students = await studentsApi.list({ search: dropSearch });
      if (students.length > 0) {
        setDropFound(students[0]);
        setDropNotFound(false);
        setDropStep(2);
      } else {
        setDropNotFound(true);
      }
    } catch {
      showToast('error', 'Search failed. Please try again.');
    }
  };

  const handleConfirmNewEnrollment = async () => {
    if (!newGrade) return;
    // Per-category validation: documents required for the student's
    // classifications must be checked off before the student can be enrolled.
    const categoryRequiredKeys = requiredReqKeysFor(newData.classifications);
    const missing = [...categoryRequiredKeys].filter(k => !requirements[k]);
    if (missing.length > 0) {
      const labels = missing.map(k => REQUIREMENTS_LIST.find(r => r.key === k)?.label || k);
      showToast(
        'error',
        `Missing required documents for ${newData.classifications.join(', ')}: ${labels.join('; ')}`
      );
      return;
    }
    try {
      const fullName = [newData.firstName, newData.middleName, newData.lastName]
        .filter(Boolean)
        .join(' ');
      const created = await studentsApi.create({
        student_id: newStudentID,
        lrn: newData.lrn,
        name: fullName,
        grade_level: newGrade,
        sex: newData.sex.toLowerCase() as 'male' | 'female',
        birthdate: newData.birthdate,
        address: newData.address || undefined,
        guardian: newData.guardian || undefined,
        contact: newData.contact || undefined
      });
      // Enroll without section — student goes to Pending Section Queue
      await enrollmentsApi.create({
        student_id: created.id,
        school_year_id: selectedSYId,
        enrollment_date: new Date().toISOString().split('T')[0],
        program: program,
        strand_track_id: selectedStrandTrackId || undefined,
        requirements: REQUIREMENTS_LIST.map(r => ({
          requirement_key: r.key,
          label: r.label,
          is_submitted: requirements[r.key]
        }))
      });
      setEnrolledSectionName('Pending Section');
      // Add classifications (batch)
      if (newData.classifications.length > 0) {
        const clsMap: Record<string, string> = {
          '4Ps Beneficiary': '4ps',
          PWD: 'pwd',
          Transferee: 'transferee',
          'Non-Reader': 'non_reader',
          'Balik-aral': 'balik_aral'
        };
        try {
          await studentsApi.addClassification(created.id, {
            classifications: newData.classifications.map(
              c => clsMap[c] || 'regular'
            ),
            school_year_id: selectedSYId
          });
        } catch {
          /* skip if classification fails — not critical */
        }
      }
      setEnrolledNew(true);
    } catch (err: any) {
      showToast(
        'error',
        err.detail?.error || err.message || 'Failed to enroll student'
      );
    }
  };

  const handleConfirmReturning = async () => {
    if (!foundStudent || !retGrade) return;
    // A student can only be enrolled once per school year — the returned student
    // must be moved into the NEXT school year, not re-enrolled in the current one.
    if (alreadyEnrolledThisSY) {
      showToast(
        'error',
        `${foundStudent.name} is already enrolled for school year ${currentSYLabel}. This flow enrolls into the current school year — create the next school year and set it as current (Admin → Academic Year Mgmt.), or use Bulk Promotion to move this student forward.`
      );
      return;
    }
    // Last-line data-integrity guard: never enroll into a grade the student
    // hasn't reached (previous grade + 1) or is repeating (same grade).
    if (prevGradeLevel != null && !allowedRetGrades.includes(retGrade)) {
      showToast(
        'error',
        `Grade ${retGrade} is not a valid level for this student (previous grade: Grade ${prevGradeLevel}).`
      );
      return;
    }
    try {
      // Promote student to new grade level first
      await studentsApi.update(foundStudent.id, {
        grade_level: retGrade,
        status: 'enrolled'
      });
      // Enroll without section — goes to Pending Section Queue
      await enrollmentsApi.create({
        student_id: foundStudent.id,
        school_year_id: selectedSYId,
        enrollment_date: new Date().toISOString().split('T')[0],
        program: program,
        strand_track_id: selectedStrandTrackId || undefined
      });
      setEnrolledSectionName('Pending Section');
      setEnrolledRet(true);
    } catch (err: any) {
      showToast(
        'error',
        err.detail?.error || err.message || 'Failed to re-enroll student'
      );
    }
  };

  const handleConfirmDrop = async () => {
    if (!dropFound) return;
    try {
      const isTransferIn = dropReason.includes('Transfer In');
      const isTransfer = dropReason.includes('Transfer');
      const lbl = isTransferIn
        ? 'Transfer In'
        : isTransfer
          ? 'Transfer Out'
          : 'Dropout';
      const newStatus = isTransferIn
        ? 'transferred'
        : isTransfer
          ? 'transferred'
          : 'dropped';

      // Find the student's current enrollment for this school year
      const enrollment = allEnrollments.find(
        e =>
          e.student_id === dropFound.id &&
          e.school_year_id === selectedSYId &&
          e.status === 'enrolled'
      );
      if (enrollment) {
        await enrollmentsApi.update(enrollment.id, {
          status: newStatus as 'dropped' | 'transferred',
          remarks: dropRemarks || `${lbl}: ${dropReason}`
        });
      } else {
        // Fallback: just update the student record
        await studentsApi.update(dropFound.id, {
          status: newStatus as 'dropped' | 'transferred'
        });
      }

      showToast('success', `${lbl} processed for ${dropFound.name}.`);
      setDropDone(true);
    } catch (err: any) {
      showToast(
        'error',
        err.detail?.error || err.message || 'Failed to process drop/transfer'
      );
    }
  };

  // ── FLOW SELECT ──────────────────────────────────────────
  if (flow === 'select') {
    // Derived stats for the landing dashboard (current SY only)
    const syEnrollments = allEnrollments.filter(
      e => e.school_year_id === selectedSYId
    );
    const enrolledCount = syEnrollments.filter(
      e => e.status === 'enrolled'
    ).length;
    const pendingCount = syEnrollments.filter(
      e => e.status === 'enrolled' && !e.section_id
    ).length;
    const todayStr = new Date().toISOString().split('T')[0];
    const todayCount = syEnrollments.filter(
      e => e.enrollment_date === todayStr
    ).length;
    const closedCount = syEnrollments.filter(
      e => e.status === 'dropped' || e.status === 'transferred'
    ).length;
    const recentEnrollments = [...syEnrollments]
      .sort(
        (a, b) =>
          (b.enrollment_date || '').localeCompare(a.enrollment_date || '') ||
          b.id - a.id
      )
      .slice(0, 6);

    const statCards = [
      {
        label: 'Total Enrolled',
        value: enrolledCount,
        icon: UserCheck,
        iconTile: 'from-emerald-400 to-emerald-600',
        tileShadow: 'shadow-emerald-200/60',
        valueCls: 'text-emerald-600',
        bar: 'from-emerald-400 via-emerald-500 to-emerald-400',
        hint: 'this school year'
      },
      {
        label: 'Pending Section',
        value: pendingCount,
        icon: Users,
        iconTile: 'from-amber-400 to-amber-600',
        tileShadow: 'shadow-amber-200/60',
        valueCls: 'text-amber-600',
        bar: 'from-amber-400 via-amber-500 to-amber-400',
        hint: 'awaiting sectioning'
      },
      {
        label: 'Enrolled Today',
        value: todayCount,
        icon: Clock,
        iconTile: 'from-sky-400 to-sky-600',
        tileShadow: 'shadow-sky-200/60',
        valueCls: 'text-sky-600',
        bar: 'from-sky-400 via-sky-500 to-sky-400',
        hint: todayStr
      },
      {
        label: 'Drop / Transfer',
        value: closedCount,
        icon: UserX,
        iconTile: 'from-rose-400 to-rose-600',
        tileShadow: 'shadow-rose-200/60',
        valueCls: 'text-rose-600',
        bar: 'from-rose-400 via-rose-500 to-rose-400',
        hint: 'this school year'
      }
    ];

    const enrollmentTiles = [
      {
        key: 'new',
        flow: 'new' as Flow,
        code: 'NEW',
        title: 'New Student',
        subtitle: 'Start your academic journey with us.',
        desc: 'First-time enrollees · Grades 7–12. Your Student ID is generated automatically and the student is queued for sectioning.',
        action: 'Start Enrollment',
        illustration: NewStudentIllustration,
        featured: true,
        chips: [
          { icon: GraduationCap, label: 'Grades 7–12' },
          { icon: Sparkles, label: 'Auto Student ID' }
        ],
        accent: {
          grad: 'from-sky-400 via-blue-500 to-blue-600',
          panelBg: 'bg-gradient-to-br from-sky-50 via-blue-50/70 to-white',
          text: 'text-blue-700',
          textSoft: 'text-blue-500',
          chip: 'bg-blue-50 text-blue-700 border-blue-200',
          dot: 'bg-blue-500',
          glow: 'hover:shadow-blue-200/70'
        },
        disabled: !enrollmentOpen,
        statusOpen: 'Open',
        statusClosed: 'Closed'
      },
      {
        key: 'returning',
        flow: 'returning' as Flow,
        code: 'RETURN',
        title: 'Returning Student',
        subtitle: 'Continue your enrollment quickly and easily.',
        desc: 'Search by LRN or Student ID to auto-fill the record, then promote the student to their next grade level.',
        action: 'Continue Enrollment',
        illustration: ReturningStudentIllustration,
        featured: false,
        chips: [
          { icon: Search, label: 'Search by LRN / ID' },
          { icon: RefreshCw, label: 'Next-grade promotion' }
        ],
        accent: {
          grad: 'from-emerald-400 via-green-500 to-green-600',
          panelBg: 'bg-gradient-to-br from-emerald-50 via-green-50/70 to-white',
          text: 'text-green-700',
          textSoft: 'text-green-500',
          chip: 'bg-green-50 text-green-700 border-green-200',
          dot: 'bg-green-500',
          glow: 'hover:shadow-green-200/70'
        },
        disabled: !enrollmentOpen,
        statusOpen: 'Open',
        statusClosed: 'Closed'
      },
      {
        key: 'drop',
        flow: 'drop' as Flow,
        code: 'DROP',
        title: 'Dropping Student',
        subtitle: 'Submit your dropping request securely.',
        desc: 'Process a dropout or school transfer with an official reason. Academic records are preserved for SF10.',
        action: 'Proceed',
        illustration: DropStudentIllustration,
        featured: false,
        chips: [
          { icon: ShieldCheck, label: 'Secure & documented' },
          { icon: FileText, label: 'Records preserved' }
        ],
        accent: {
          grad: 'from-amber-400 via-orange-500 to-orange-600',
          panelBg: 'bg-gradient-to-br from-orange-50 via-amber-50/70 to-white',
          text: 'text-orange-700',
          textSoft: 'text-orange-500',
          chip: 'bg-orange-50 text-orange-700 border-orange-200',
          dot: 'bg-orange-500',
          glow: 'hover:shadow-orange-200/70'
        },
        disabled: false,
        statusOpen: 'Available',
        statusClosed: 'Available'
      }
    ];

    return (
      <div className="w-full max-w-8xl mx-auto space-y-6 px-3 sm:px-0">
        {/* Enrollment closed banner */}
        {!enrollmentOpen && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-5 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <Lock size={20} className="text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-red-800 text-sm">
                Enrollment is currently CLOSED
              </p>
              <p className="text-red-600 text-xs mt-0.5 leading-relaxed">
                New enrollments and returning student enrollments are disabled
                while enrollment is closed. You may still process student
                drop/transfer requests.
              </p>
            </div>
          </div>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map(s => (
            <div
              key={s.label}
              className="group relative overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-[0_2px_14px_rgba(15,23,42,0.06)] p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
              {/* top accent bar */}
              <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${s.bar}`} />
              {/* soft radial glow */}
              <div className={`absolute -top-10 -right-10 w-28 h-28 rounded-full bg-gradient-to-br ${s.iconTile} opacity-[0.08] blur-2xl group-hover:opacity-[0.15] transition-opacity duration-300`} />
              <div className="relative flex items-center justify-between gap-2 mb-3">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">
                  {s.label}
                </span>
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${s.iconTile} shadow-md ${s.tileShadow} flex items-center justify-center flex-shrink-0`}>
                  <s.icon size={16} className="text-white" />
                </div>
              </div>
              <p className={`relative text-2xl font-bold tracking-[-0.02em] leading-none ${s.valueCls}`}>
                {s.value}
              </p>
              <p className="relative text-xs text-gray-400 mt-2 truncate">{s.hint}</p>
            </div>
          ))}
        </div>

        {/* Enrollment option cards — featured New Student hero + compact secondary, one viewport row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 lg:gap-6 items-start">
          {enrollmentTiles.map(card => {
            const a = card.accent;
            const featured = card.featured;
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => setFlow(card.flow)}
                disabled={card.disabled}
                className={`group relative w-full text-left bg-white rounded-3xl border border-gray-100 shadow-[0_2px_14px_rgba(15,23,42,0.06)] hover:shadow-xl ${a.glow} hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col disabled:opacity-55 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[0_2px_14px_rgba(15,23,42,0.06)] ${
                  featured ? 'md:col-span-12 lg:col-span-6' : 'md:col-span-6 lg:col-span-3'
                } ${card.key === 'returning' ? 'lg:mt-6' : ''} ${card.key === 'drop' ? 'lg:mt-14' : ''}`}>
                {/* Illustration band */}
                <div className={`relative ${a.panelBg} flex items-center justify-center overflow-hidden ${featured ? 'h-40 sm:h-44 lg:h-52 p-4 sm:p-5' : 'h-28 sm:h-32 p-3.5 sm:p-4'}`}>
                  <card.illustration className={featured ? 'w-full h-full' : undefined} />
                  <span className="absolute top-3.5 left-3.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/85 backdrop-blur border border-white/70 shadow-sm text-[10px] font-bold text-gray-600">
                    {card.code}
                  </span>
                  <span className={`absolute top-3.5 right-3.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                    card.disabled
                      ? 'bg-gray-100/90 text-gray-500 border-gray-200'
                      : a.chip
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${card.disabled ? 'bg-gray-400' : a.dot} ${card.disabled ? '' : 'animate-pulse'}`} />
                    {card.disabled ? card.statusClosed : card.statusOpen}
                  </span>
                </div>
                {/* Content */}
                <div className={`flex flex-col flex-1 ${featured ? 'p-6 sm:p-7' : 'p-5 sm:p-6'}`}>
                  {featured && (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r ${a.grad} text-white text-[10px] font-bold tracking-wide shadow-sm self-start`}>
                      <Sparkles size={11} /> Featured
                    </span>
                  )}
                  <h3 className={`font-bold text-gray-900 tracking-[-0.01em] ${featured ? 'text-xl sm:text-2xl mt-3' : 'text-lg mt-2'}`}>
                    {card.title}
                  </h3>
                  <p className={`text-sm font-semibold mt-0.5 ${a.text}`}>
                    {card.subtitle}
                  </p>
                  <p className="text-sm text-gray-400 mt-2 leading-relaxed flex-1">
                    {card.desc}
                  </p>
                  <div className={`flex flex-wrap gap-2 ${featured ? 'mt-4' : 'mt-3'}`}>
                    {card.chips.map(ch => (
                      <span key={ch.label} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${a.chip}`}>
                        <ch.icon size={12} />
                        {ch.label}
                      </span>
                    ))}
                  </div>
                  <span className={`mt-5 inline-flex items-center justify-center gap-2 text-white text-sm font-semibold py-3 rounded-2xl bg-gradient-to-r ${a.grad} shadow-lg transition-all duration-200 group-hover:shadow-xl group-hover:brightness-105`}>
                    {card.action}
                    <ChevronRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Recently enrolled */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gray-50 ring-1 ring-gray-100 flex items-center justify-center">
                <Clock size={16} className="text-gray-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">
                  Recently Enrolled
                </h3>
                <p className="text-[11px] text-gray-400">
                  Latest enrollments · SY {currentSYLabel || `#${selectedSYId}`}
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-gray-500 bg-gray-50 ring-1 ring-gray-100 px-2.5 py-1 rounded-full flex-shrink-0">
              {enrolledCount} enrolled
            </span>
          </div>

          {recentEnrollments.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 ring-1 ring-gray-100 flex items-center justify-center mx-auto mb-3">
                <UserCheck size={24} className="text-gray-300" />
              </div>
              <p className="font-semibold text-gray-500 text-sm">
                No enrollments yet
              </p>
              <p className="text-gray-400 text-xs mt-1">
                Use one of the options above to enroll your first student.
              </p>
            </div>
          ) : (
            <HybridTable
              desktop={
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/80">
                        <th className="text-left px-6 py-3 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">
                          Student
                        </th>
                        <th className="text-left px-6 py-3 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">
                          LRN
                        </th>
                        <th className="text-left px-6 py-3 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">
                          Grade
                        </th>
                        <th className="text-left px-6 py-3 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">
                          Section
                        </th>
                        <th className="text-left px-6 py-3 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">
                          Program
                        </th>
                        <th className="text-left px-6 py-3 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {recentEnrollments.map(e => (
                        <tr
                          key={e.id}
                          className="hover:bg-emerald-50/40 transition-colors duration-150">
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-100 to-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs flex-shrink-0">
                                {e.student_name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900 truncate">
                                  {e.student_name}
                                </p>
                                <p className="text-[11px] text-gray-400 font-mono">
                                  {e.student_display_id || `#${e.id}`}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-3.5 font-mono text-xs text-gray-400">
                            {e.lrn}
                          </td>
                          <td className="px-6 py-3.5 text-gray-600">
                            Grade {e.grade_level}
                          </td>
                          <td className="px-6 py-3.5">
                            {e.section_name ? (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                                {e.section_name}
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/50">
                                Pending Section
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3.5">
                            {PROGRAM_BADGES[e.program] ? (
                              <span
                                className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-medium border ${PROGRAM_BADGES[e.program]?.bg || 'bg-emerald-50'} ${PROGRAM_BADGES[e.program]?.text || 'text-emerald-700'}`}>
                                {PROGRAM_BADGES[e.program]?.label || e.program}
                              </span>
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-6 py-3.5">
                            {e.status === 'enrolled' ? (
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/50 px-2.5 py-1 rounded-full text-[11px] font-medium">
                                Enrolled
                              </span>
                            ) : e.status === 'dropped' ? (
                              <span className="bg-red-50 text-red-600 border border-red-200/50 px-2.5 py-1 rounded-full text-[11px] font-medium">
                                Dropped
                              </span>
                            ) : (
                              <span className="bg-amber-50 text-amber-700 border border-amber-200/50 px-2.5 py-1 rounded-full text-[11px] font-medium">
                                Transferred
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              }
              mobile={
                <ul className="divide-y divide-gray-50">
                  {recentEnrollments.map(e => (
                    <li key={e.id} className="px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-100 to-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm flex-shrink-0">
                            {e.student_name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">
                              {e.student_name}
                            </p>
                            <p className="text-[11px] text-gray-400 font-mono truncate">
                              {e.student_display_id || `#${e.id}`} · {e.lrn}
                            </p>
                          </div>
                        </div>
                        {e.status === 'enrolled' ? (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/50 px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0">
                            Enrolled
                          </span>
                        ) : e.status === 'dropped' ? (
                          <span className="bg-red-50 text-red-600 border border-red-200/50 px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0">
                            Dropped
                          </span>
                        ) : (
                          <span className="bg-amber-50 text-amber-700 border border-amber-200/50 px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0">
                            Transferred
                          </span>
                        )}
                      </div>
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-gray-600">Grade {e.grade_level}</span>
                        {e.section_name ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                            {e.section_name}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200/50">
                            Pending Section
                          </span>
                        )}
                        {PROGRAM_BADGES[e.program] ? (
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${PROGRAM_BADGES[e.program]?.bg || 'bg-emerald-50'} ${PROGRAM_BADGES[e.program]?.text || 'text-emerald-700'}`}>
                            {PROGRAM_BADGES[e.program]?.label || e.program}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              }
            />
          )}
        </div>
      </div>
    );
  }

  // ── NEW STUDENT FLOW ──────────────────────────────────────
  if (flow === 'new') {
    const steps = [
      'Personal Details',
      'Grade & Program',
      'Requirements',
      'Student ID',
      'Preview & Confirm'
    ];
    const fullName = [newData.firstName, newData.middleName, newData.lastName]
      .filter(Boolean)
      .join(' ');

    if (enrolledNew) {
      return (
        <div className="w-full max-w-lg mx-auto text-center py-12 sm:py-16 px-3 sm:px-0">
          {/* Animated checkmark */}
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-200/50 animate-[pulse_2s_ease-in-out_infinite]">
            <CheckCircle size={44} className="text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">
            Enrollment Successful!
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            {fullName} has been successfully enrolled.
          </p>
          <div className="bg-white/80 backdrop-blur-sm border border-emerald-100 shadow-xl shadow-emerald-100/30 rounded-2xl p-6 mb-6 text-left space-y-3">
            <div className="flex items-center gap-3 pb-3 border-b border-emerald-100/60">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md flex items-center justify-center flex-shrink-0">
                <UserCheck size={18} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-gray-900">{fullName}</p>
                <p className="text-xs text-gray-400">
                  Student ID:{' '}
                  <span className="font-mono text-emerald-700 font-semibold">
                    {newStudentID}
                  </span>
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-[0.04em] font-semibold">
                  Grade Level
                </p>
                <p className="font-semibold text-gray-800">Grade {newGrade}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-[0.04em] font-semibold">
                  Section
                </p>
                <p className="font-semibold text-emerald-700">
                  {enrolledSectionName}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-[0.04em] font-semibold">
                  LRN
                </p>
                <p className="font-mono text-xs text-gray-700">{newData.lrn}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-[0.04em] font-semibold">
                  Program
                </p>
                <p>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${PROGRAM_BADGES[program]?.bg || 'bg-emerald-100'} ${PROGRAM_BADGES[program]?.text || 'text-emerald-700'}`}>
                    {PROGRAM_BADGES[program]?.label || 'Regular'}
                  </span>
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={resetAll}
            className="bg-gradient-to-r from-emerald-600 to-emerald-600 hover:from-emerald-700 hover:to-emerald-700 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-emerald-200 hover:shadow-xl hover:shadow-emerald-300">
            Enroll Another Student
          </button>
        </div>
      );
    }

    return (
      <div className="w-full max-w-4xl mx-auto space-y-5 px-3 sm:px-0">
        <div className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <button
            onClick={resetAll}
            className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-all flex-shrink-0">
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-4 flex-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md flex items-center justify-center flex-shrink-0">
              <UserPlus size={20} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Enroll New Student</h2>
              <p className="text-gray-400 text-sm">
                Complete all steps to finish enrollment
              </p>
            </div>
          </div>
        </div>

        {/* Stepper */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
          <div className="flex items-center justify-between relative">
            <div
              className="absolute top-5 left-0 right-0 h-1 bg-gray-100 z-0 rounded-full"
              style={{ left: '8%', right: '8%' }}
            />
            <div
              className="absolute top-5 left-0 right-0 h-1 z-0 rounded-full overflow-hidden"
              style={{ left: '8%', right: '8%' }}>
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-500 transition-all duration-500 rounded-full"
                style={{
                  width: `${((newStep - 1) / (steps.length - 1)) * 100}%`
                }}
              />
            </div>
            {steps.map((s, i) => {
              const stepNum = i + 1;
              const done = newStep > stepNum;
              const active = newStep === stepNum;
              return (
                <div
                  key={s}
                  className="flex flex-col items-center gap-2 z-10 flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                      done
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200'
                        : active
                          ? 'bg-white text-emerald-600 border-2 border-emerald-500 shadow-lg shadow-emerald-200 scale-110'
                          : 'bg-gray-100 text-gray-400 border-2 border-gray-200'
                    }`}>
                    {done ? <Check size={15} /> : stepNum}
                  </div>
                  <p
                    className={`text-[11px] font-semibold text-center leading-tight hidden sm:block transition-all duration-200 ${
                      active
                        ? 'text-emerald-700'
                        : done
                          ? 'text-emerald-600'
                          : 'text-gray-400'
                    }`}>
                    {s}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step content */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-7 transition-all duration-300">
          {newStep === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-100 flex items-center justify-center shadow-sm">
                  <User size={18} className="text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    Personal Details
                  </h3>
                  <p className="text-gray-400 text-[11px]">
                    Enter the student's basic personal information
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={newData.firstName}
                    onChange={e => updateNewField('firstName', e.target.value)}
                    className={`w-full border ${newErrors.firstName ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:border-emerald-400 focus:ring-emerald-100'} rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-3 transition-all bg-white/75`}
                    placeholder="Maria"
                  />
                  {newErrors.firstName && (
                    <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle size={10} />
                      {newErrors.firstName}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                    Middle Name
                  </label>
                  <input
                    type="text"
                    value={newData.middleName}
                    onChange={e => updateNewField('middleName', e.target.value)}
                    className="w-full border border-gray-200 focus:border-emerald-400 focus:ring-emerald-100 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-3 transition-all bg-white/75"
                    placeholder="Cruz"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={newData.lastName}
                    onChange={e => updateNewField('lastName', e.target.value)}
                    className={`w-full border ${newErrors.lastName ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:border-emerald-400 focus:ring-emerald-100'} rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-3 transition-all bg-white/75`}
                    placeholder="Santos"
                  />
                  {newErrors.lastName && (
                    <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle size={10} />
                      {newErrors.lastName}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                    Birthdate *
                  </label>
                  <input
                    type="date"
                    value={newData.birthdate}
                    onChange={e => updateNewField('birthdate', e.target.value)}
                    className={`w-full border ${newErrors.birthdate ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:border-emerald-400 focus:ring-emerald-100'} rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-3 transition-all bg-white/75`}
                  />
                  {newErrors.birthdate && (
                    <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle size={10} />
                      {newErrors.birthdate}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                    Sex *
                  </label>
                  <select
                    value={newData.sex}
                    onChange={e => updateNewField('sex', e.target.value)}
                    className={`w-full border ${newErrors.sex ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:border-emerald-400 focus:ring-emerald-100'} rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-3 transition-all bg-white/75`}>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                  </select>
                  {newErrors.sex && (
                    <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle size={10} />
                      {newErrors.sex}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                  <MapPin size={11} className="inline mr-1" />
                  Complete Address *
                </label>
                <input
                  type="text"
                  value={newData.address}
                  onChange={e => updateNewField('address', e.target.value)}
                  className={`w-full border ${newErrors.address ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:border-emerald-400 focus:ring-emerald-100'} rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-3 transition-all bg-white/75`}
                  placeholder="House No., Street, Barangay, City/Municipality, Province"
                />
                {newErrors.address && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle size={10} />
                    {newErrors.address}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                    LRN (12 digits) *
                  </label>
                  <input
                    type="text"
                    maxLength={12}
                    value={newData.lrn}
                    onChange={e => updateNewField('lrn', e.target.value)}
                    className={`w-full border ${newErrors.lrn ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:border-emerald-400 focus:ring-emerald-100'} rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-3 transition-all bg-white/75`}
                    placeholder="000000000000"
                  />
                  {newErrors.lrn && (
                    <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle size={10} />
                      {newErrors.lrn}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                    Guardian Name *
                  </label>
                  <input
                    type="text"
                    value={newData.guardian}
                    onChange={e => updateNewField('guardian', e.target.value)}
                    className={`w-full border ${newErrors.guardian ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:border-emerald-400 focus:ring-emerald-100'} rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-3 transition-all bg-white/75`}
                    placeholder="Full name"
                  />
                  {newErrors.guardian && (
                    <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle size={10} />
                      {newErrors.guardian}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                    <Phone size={11} className="inline mr-1" />
                    Contact Number *
                  </label>
                  <input
                    type="text"
                    value={newData.contact}
                    onChange={e => updateNewField('contact', e.target.value)}
                    className={`w-full border ${newErrors.contact ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:border-emerald-400 focus:ring-emerald-100'} rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-3 transition-all bg-white/75`}
                    placeholder="09XXXXXXXXX"
                  />
                  {newErrors.contact && (
                    <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle size={10} />
                      {newErrors.contact}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-2">
                  Classification (check all that apply)
                </label>
                <div className="flex flex-wrap gap-3">
                  {['4Ps Beneficiary', 'PWD', 'Transferee', 'Non-Reader', 'Balik-aral'].map(
                    cls => (
                      <label
                        key={cls}
                        className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border-2 cursor-pointer transition-all duration-200 ${newData.classifications.includes(cls) ? 'border-emerald-400 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-gray-100 bg-gray-50/50 text-gray-600 hover:border-gray-200 hover:bg-gray-50'}`}>
                        <input
                          type="checkbox"
                          checked={newData.classifications.includes(cls)}
                          onChange={() => toggleClassification(cls)}
                          className="accent-emerald-600 w-4 h-4"
                        />
                        <span className="text-sm font-medium">{cls}</span>
                      </label>
                    )
                  )}
                </div>
              </div>
            </div>
          )}

          {newStep === 2 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-100 flex items-center justify-center shadow-sm">
                  <BookOpen size={18} className="text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    Grade Level & Program
                  </h3>
                  <p className="text-gray-400 text-[11px]">
                    Select the grade level and curriculum program
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-2.5">
                  Grade Level *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {GRADE_LEVELS.map(g => (
                    <button
                      key={g}
                      onClick={() => setNewGrade(g)}
                      className={`p-4 sm:p-5 rounded-xl border-2 text-center transition-all duration-200 ${
                        newGrade === g
                          ? 'border-emerald-400 bg-emerald-50 shadow-md shadow-emerald-100/50'
                          : 'border-gray-100 bg-gray-50/50 hover:border-gray-200 hover:bg-gray-50 hover:shadow-sm'
                      }`}>
                      <p
                        className={`font-bold text-lg ${newGrade === g ? 'text-emerald-700' : 'text-gray-700'}`}>
                        Grade {g}
                      </p>
                      <p
                        className={`text-[11px] mt-0.5 font-medium ${newGrade === g ? 'text-emerald-500' : 'text-gray-400'}`}>
                        {g <= 10 ? 'Junior High' : 'Senior High'}
                      </p>
                      {newGrade === g && (
                        <div className="mt-2 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-sm">
                          <Check size={11} strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Program selector */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-2.5">
                  Curriculum Program *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PROGRAMS.map(p => {
                    const active = program === p.value;
                    const borderCls = active
                      ? 'border-emerald-400 bg-emerald-50'
                      : 'border-gray-100 bg-gray-50/50 hover:border-gray-200 hover:bg-gray-50';
                    const dotCls = active
                      ? 'border-emerald-500'
                      : 'border-gray-300';
                    const innerDotCls = active ? 'bg-emerald-500' : '';
                    return (
                      <button
                        key={p.value}
                        onClick={() => setProgram(p.value)}
                        className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all duration-200 ${borderCls}`}>
                        <div
                          className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center flex-shrink-0 transition-colors ${dotCls}`}>
                          {active && (
                            <div
                              className={`w-2.5 h-2.5 rounded-full ${innerDotCls}`}
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`font-semibold text-sm ${active ? 'text-emerald-700' : 'text-gray-800'}`}>
                            {p.label}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {p.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Strand/Track selector — shown when tracks are available for the selected grade */}
              {strandTracks.length > 0 && (
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-2.5">
                    {newGrade && newGrade >= 11
                      ? 'SHS Strand *'
                      : 'TLE Specialization (optional)'}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {strandTracks.map(t => {
                      const active = selectedStrandTrackId === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() =>
                            setSelectedStrandTrackId(active ? null : t.id)
                          }
                          className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                            active
                              ? 'border-emerald-400 bg-emerald-50'
                              : 'border-gray-100 bg-gray-50/50 hover:border-gray-200 hover:bg-gray-50'
                          }`}>
                          <div
                            className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center flex-shrink-0 transition-colors ${
                              active ? 'border-emerald-500' : 'border-gray-300'
                            }`}>
                            {active && (
                              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`font-semibold text-sm ${active ? 'text-emerald-700' : 'text-gray-800'}`}>
                              {t.name}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5 font-mono uppercase">
                              {t.code}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {newStep === 3 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-100 flex items-center justify-center shadow-sm">
                  <FileText size={18} className="text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    Enrollment Requirements
                  </h3>
                  <p className="text-gray-400 text-[11px]">
                    Check off the requirements the student has submitted. These
                    can be submitted later.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {REQUIREMENTS_LIST.map(r => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() =>
                      setRequirements(prev => ({
                        ...prev,
                        [r.key]: !prev[r.key]
                      }))
                    }
                    className={`flex items-start gap-3.5 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 text-left w-full ${
                      requirements[r.key]
                        ? 'border-emerald-400 bg-emerald-50/80 shadow-sm'
                        : 'border-gray-100 bg-gray-50/50 hover:border-gray-200 hover:bg-gray-50'
                    }`}>
                    <div
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center mt-0.5 flex-shrink-0 transition-all duration-200 ${
                        requirements[r.key]
                          ? 'bg-emerald-500 border-emerald-500 shadow-sm shadow-emerald-200'
                          : 'border-gray-300 bg-white'
                      }`}>
                      {requirements[r.key] && (
                        <Check
                          size={12}
                          className="text-white"
                          strokeWidth={3}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span
                        className={`text-sm block ${requirements[r.key] ? 'text-emerald-800 font-medium' : 'text-gray-600'}`}>
                        {r.label}
                      </span>
                      {categoriesRequiring(r.key, newData.classifications).length > 0 && (
                        <span className="inline-block mt-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded-md uppercase tracking-wide">
                          Required: {categoriesRequiring(r.key, newData.classifications).join(', ')}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Check size={14} className="text-emerald-600" />
                </div>
                <p className="text-xs text-emerald-700 font-medium">
                  {Object.values(requirements).filter(Boolean).length} of{' '}
                  {REQUIREMENTS_LIST.length} requirements checked
                </p>
              </div>
            </div>
          )}

          {newStep === 4 && (
            <div className="space-y-5 text-center">
              <div className="flex items-center gap-3 justify-center">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-100 flex items-center justify-center shadow-sm">
                  <FileText size={18} className="text-emerald-700" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-gray-900 text-sm">
                    Auto-Generated Student ID
                  </h3>
                  <p className="text-gray-400 text-[11px]">
                    System-generated unique identifier for this student
                  </p>
                </div>
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-50 border-2 border-emerald-200 rounded-2xl p-8 shadow-inner">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-semibold mb-4">
                  <Check size={12} /> Generated Successfully
                </div>
                <p className="text-gray-500 text-sm mb-2 tracking-[0.04em]">
                  System Generated Student ID
                </p>
                <p className="text-4xl sm:text-5xl font-black text-emerald-700 font-mono tracking-[0.08em]">
                  {newStudentID}
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-5 text-xs text-gray-500">
                  <span className="px-3 py-1.5 bg-white/70 rounded-lg border border-emerald-100">
                    <span className="font-bold text-emerald-700">
                      {newStudentID.split('-')[0]}
                    </span>{' '}
                    — School Year
                  </span>
                  <span className="px-3 py-1.5 bg-white/70 rounded-lg border border-emerald-100">
                    <span className="font-bold text-emerald-700">
                      {newStudentID.split('-')[1]}
                    </span>{' '}
                    — Grade Level
                  </span>
                  <span className="px-3 py-1.5 bg-white/70 rounded-lg border border-emerald-100">
                    <span className="font-bold text-emerald-700">
                      {newStudentID.split('-')[2]}
                    </span>{' '}
                    — Sequence No.
                  </span>
                </div>
              </div>
              <p className="text-gray-400 text-xs">
                This ID is unique and will be used for all records of this
                student throughout their academic journey.
              </p>
            </div>
          )}

          {newStep === 5 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-100 flex items-center justify-center shadow-sm">
                  <CheckCircle size={18} className="text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    Enrollment Preview
                  </h3>
                  <p className="text-gray-400 text-[11px]">
                    Review all details before confirming enrollment
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-5 space-y-3">
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.06em] flex items-center gap-2">
                    <User size={13} /> Student Information
                  </p>
                  {[
                    ['Full Name', fullName || '—'],
                    ['Student ID', newStudentID],
                    ['LRN', newData.lrn || '—'],
                    ['Birthdate', newData.birthdate || '—'],
                    ['Sex', newData.sex],
                    ['Grade Level', `Grade ${newGrade}`]
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="flex justify-between text-sm border-b border-gray-100/80 pb-2 last:border-0 last:pb-0">
                      <span className="text-gray-500">{k}:</span>
                      <span className="font-medium text-gray-800 text-right max-w-[60%]">
                        {v}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-5 space-y-3">
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.06em] flex items-center gap-2">
                    <MapPin size={13} /> Contact & Classification
                  </p>
                  {[
                    ['Address', newData.address || '—'],
                    ['Guardian', newData.guardian || '—'],
                    ['Contact', newData.contact || '—'],
                    [
                      'Classification',
                      newData.classifications.join(', ') || 'None'
                    ]
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="flex justify-between text-sm border-b border-gray-100/80 pb-2 last:border-0 last:pb-0">
                      <span className="text-gray-500">{k}:</span>
                      <span className="font-medium text-gray-800 text-right max-w-[60%]">
                        {v}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Program:</span>
                    <span
                      className={`font-medium ${PROGRAM_BADGES[program]?.text || 'text-emerald-700'}`}>
                      {PROGRAM_BADGES[program]?.label || 'Regular'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Requirements summary */}
              <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.06em] flex items-center gap-2">
                    <FileText size={13} /> Requirements Submitted
                  </p>
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                    {Object.values(requirements).filter(Boolean).length}/
                    {REQUIREMENTS_LIST.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {REQUIREMENTS_LIST.map(r => {
                    const reqCats = categoriesRequiring(r.key, newData.classifications);
                    return (
                      <span
                        key={r.key}
                        className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${
                          requirements[r.key]
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-400'
                        }`}>
                        {requirements[r.key] ? '✓' : '○'}{' '}
                        {r.label.replace(/\(.*\)/, '').trim()}
                        {reqCats.length > 0 && (
                          <span className="ml-1.5 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded-md">
                            req · {reqCats.join(', ')}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <AlertCircle size={16} className="text-amber-600" />
                </div>
                <div>
                  <p className="font-semibold text-amber-800 text-sm">
                    Section Status: Pending Section
                  </p>
                  <p className="text-amber-600 text-xs mt-0.5 leading-relaxed">
                    New students without previous grades are temporarily
                    assigned to Pending Section until their average is computed.
                    The system will automatically move them to the appropriate
                    section once grades are uploaded and computed.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {newStep > 1 && (
            <button
              onClick={handleNewBack}
              className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-sm font-semibold py-2.5 transition-all duration-200">
              ← Back
            </button>
          )}
          {newStep < 5 ? (
            <button
              onClick={handleNewNext}
              disabled={newStep === 2 && !newGrade}
              className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-600 hover:from-emerald-700 hover:to-emerald-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md shadow-emerald-200 hover:shadow-lg hover:shadow-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {newStep === 4 ? 'Continue to Preview' : 'Next Step'}{' '}
              <ChevronRight size={15} />
            </button>
          ) : (
            <button
              onClick={handleConfirmNewEnrollment}
              className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-600 hover:from-emerald-700 hover:to-emerald-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md shadow-emerald-200 hover:shadow-lg hover:shadow-emerald-300 flex items-center justify-center gap-2">
              <CheckCircle size={16} /> Confirm Enrollment
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── RETURNING STUDENT FLOW ────────────────────────────────
  if (flow === 'returning') {
    if (enrolledRet && foundStudent) {
      return (
        <div className="w-full max-w-lg mx-auto text-center py-12 sm:py-16 px-3 sm:px-0">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-200/50 animate-[pulse_2s_ease-in-out_infinite]">
            <CheckCircle size={44} className="text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">
            Re-enrollment Successful!
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            {foundStudent.name} has been enrolled for Grade {retGrade}.
          </p>
          <div className="bg-white/80 backdrop-blur-sm border border-emerald-100 shadow-xl shadow-emerald-100/30 rounded-2xl p-6 mb-6 text-left space-y-3">
            <div className="flex items-center gap-3 pb-3 border-b border-emerald-100/60">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md flex items-center justify-center flex-shrink-0">
                <RefreshCw size={18} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-gray-900">{foundStudent.name}</p>
                <p className="text-xs text-gray-400">
                  Student ID:{' '}
                  <span className="font-mono text-emerald-700 font-semibold">
                    {foundStudent.student_id}
                  </span>
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-[0.04em] font-semibold">
                  Previous Grade
                </p>
                <p className="font-semibold text-gray-700">
                  Grade {prevGradeLevel}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-[0.04em] font-semibold">
                  New Grade
                </p>
                <p className="font-semibold text-emerald-700">
                  Grade {retGrade}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-[0.04em] font-semibold">
                  Assigned Section
                </p>
                <p className="font-semibold text-emerald-700">
                  {enrolledSectionName}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-[0.04em] font-semibold">
                  Program
                </p>
                <p>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${PROGRAM_BADGES[program]?.bg || 'bg-emerald-100'} ${PROGRAM_BADGES[program]?.text || 'text-emerald-700'}`}>
                    {PROGRAM_BADGES[program]?.label || 'Regular'}
                  </span>
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={resetAll}
            className="bg-gradient-to-r from-emerald-600 to-emerald-600 hover:from-emerald-700 hover:to-emerald-700 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-emerald-200 hover:shadow-xl hover:shadow-emerald-300">
            Enroll Another Student
          </button>
        </div>
      );
    }

    return (
      <div className="w-full max-w-4xl mx-auto space-y-5 px-3 sm:px-0">
        <div className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <button
            onClick={resetAll}
            className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-all flex-shrink-0">
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-4 flex-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md flex items-center justify-center flex-shrink-0">
              <RefreshCw size={20} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">
                Enroll Returning Student
              </h2>
              <p className="text-gray-400 text-sm">
                Search by LRN or Student ID to auto-populate student records
              </p>
            </div>
          </div>
        </div>

        {/* Stepper */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between relative">
            <div
              className="absolute top-5 left-0 right-0 h-1 bg-gray-100 z-0 rounded-full"
              style={{ left: '8%', right: '8%' }}
            />
            <div
              className="absolute top-5 left-0 right-0 h-1 z-0 rounded-full overflow-hidden"
              style={{ left: '8%', right: '8%' }}>
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-500 transition-all duration-500 rounded-full"
                style={{ width: `${((retStep - 1) / 3) * 100}%` }}
              />
            </div>
            {[
              'Search LRN/ID',
              'Student Details',
              'Grade & Program',
              'Confirm'
            ].map((s, i) => {
              const stepNum = i + 1;
              const done = retStep > stepNum;
              const active = retStep === stepNum;
              return (
                <div
                  key={s}
                  className="flex flex-col items-center gap-2 z-10 flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                      done
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200'
                        : active
                          ? 'bg-white text-emerald-600 border-2 border-emerald-500 shadow-lg shadow-emerald-200 scale-110'
                          : 'bg-gray-100 text-gray-400 border-2 border-gray-200'
                    }`}>
                    {done ? <Check size={15} /> : stepNum}
                  </div>
                  <p
                    className={`text-[11px] font-semibold text-center leading-tight hidden sm:block transition-all duration-200 ${
                      active
                        ? 'text-emerald-700'
                        : done
                          ? 'text-emerald-600'
                          : 'text-gray-400'
                    }`}>
                    {s}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-7 transition-all duration-300">
          {retStep === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-100 flex items-center justify-center shadow-sm">
                  <Search size={18} className="text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    Search Student Record
                  </h3>
                  <p className="text-gray-400 text-[11px]">
                    Enter the student's LRN or Student ID to retrieve their
                    record
                  </p>
                </div>
              </div>
              <div className="flex gap-3" ref={searchRef}>
                <div className="relative flex-1">
                  <Search
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => {
                      setSearchQuery(e.target.value);
                      setRetErrors({});
                      setNotFound(false);
                      setShowSuggestions(e.target.value.trim().length > 0);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        setShowSuggestions(false);
                        handleSearch();
                      }
                    }}
                    onFocus={() => {
                      if (searchQuery.trim()) setShowSuggestions(true);
                    }}
                    className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-3 transition-all bg-white/75 ${retErrors.query ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:border-emerald-400 focus:ring-emerald-100'}`}
                    placeholder="Enter LRN (e.g. 123456789012) or Student ID (e.g. 2026-07-0001)"
                  />
                  {/* Suggestions dropdown */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-50 top-full mt-1.5 left-0 right-0 bg-white border border-gray-100 rounded-2xl shadow-xl shadow-gray-200/50 max-h-72 overflow-y-auto">
                      {suggestions.map(s => (
                        <button
                          key={s.id}
                          className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-emerald-50 border-b border-gray-50 last:border-0 text-left transition"
                          onClick={() => {
                            setSearchQuery(s.lrn);
                            setFoundStudent(s);
                            setShowSuggestions(false);
                            setRetStep(2);
                          }}>
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs flex-shrink-0 shadow-sm">
                            {s.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {s.name}
                            </p>
                            <p className="text-xs text-gray-400">
                              <span className="font-mono">{s.lrn}</span> · ID:{' '}
                              {s.student_id} · Grade {s.grade_level}
                            </p>
                          </div>
                          <ChevronRight
                            size={14}
                            className="text-gray-300 flex-shrink-0"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                  {retErrors.query && (
                    <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle size={10} />
                      {retErrors.query}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setShowSuggestions(false);
                    handleSearch();
                  }}
                  className="bg-gradient-to-r from-emerald-600 to-emerald-600 hover:from-emerald-700 hover:to-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md shadow-emerald-200">
                  Search
                </button>
              </div>
              {notFound && (
                <div className="flex items-center gap-2.5 text-red-600 bg-red-50/80 border border-red-200 rounded-xl px-4 py-3 text-sm">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  No student record found for "<strong>{searchQuery}</strong>".
                  Please check the LRN or Student ID.
                </div>
              )}
              {allStudents.length > 0 && !showSuggestions && !foundStudent && (
                <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-4">
                  <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-[0.04em] mb-2.5">
                    Quick access
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {allStudents.slice(0, 4).map(s => (
                      <button
                        key={s.lrn}
                        onClick={() => {
                          setSearchQuery(s.lrn);
                          setNotFound(false);
                          setShowSuggestions(true);
                        }}
                        className="text-xs bg-white border border-gray-200 hover:border-emerald-300 text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-all">
                        {s.lrn} — {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {retStep === 2 && foundStudent && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-100 flex items-center justify-center shadow-sm">
                  <CheckCircle size={18} className="text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    Student Record Found
                  </h3>
                  <p className="text-gray-400 text-[11px]">
                    Details auto-populated from existing record
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-5 space-y-3">
                  <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-[0.06em] flex items-center gap-2">
                    <User size={13} /> Student Information
                  </p>
                  {[
                    ['Full Name', foundStudent.name],
                    ['Student ID', foundStudent.student_id],
                    ['LRN', foundStudent.lrn],
                    ['Sex', foundStudent.sex === 'male' ? 'Male' : 'Female'],
                    ['Address', foundStudent.address || '—']
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="flex justify-between text-sm border-b border-emerald-100/50 pb-2 last:border-0 last:pb-0">
                      <span className="text-gray-500">{k}:</span>
                      <span className="font-medium text-gray-800 text-right max-w-[55%]">
                        {v}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-5 space-y-3">
                  <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-[0.06em] flex items-center gap-2">
                    <FileText size={13} /> Previous Academic Record
                  </p>
                  {[
                    ['Previous Grade', `Grade ${prevGradeLevel}`],
                    ['Guardian', foundStudent.guardian || '—'],
                    ['Contact', foundStudent.contact || '—']
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="flex justify-between text-sm border-b border-emerald-100/50 pb-2 last:border-0 last:pb-0">
                      <span className="text-gray-500">{k}:</span>
                      <span className="font-medium text-gray-800">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {alreadyEnrolledThisSY && (
                <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <AlertCircle
                    size={16}
                    className="text-amber-600 flex-shrink-0 mt-0.5"
                  />
                  <div className="text-xs text-amber-800 leading-relaxed">
                    <p className="font-semibold">
                      Already enrolled for {currentSYLabel}
                    </p>
                    <p className="mt-0.5">
                      {foundStudent.name} already has an enrollment for this
                      school year, so confirming here will be blocked (a student
                      can only be enrolled once per school year). To move them
                      forward, create the next school year (e.g. 2026-2027) and
                      set it as current in{' '}
                      <span className="font-semibold">
                        Admin → Academic Year Mgmt.
                      </span>
                      , or use Bulk Promotion for the year-end rollover.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {retStep === 3 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-100 flex items-center justify-center shadow-sm">
                  <BookOpen size={18} className="text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    Grade Level & Program
                  </h3>
                  <p className="text-gray-400 text-[11px]">
                    Select the new grade level and curriculum program
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-2.5">
                  Grade Level *
                </label>

                {prevGradeLevel != null && (
                  <div
                    className={`mb-3 rounded-xl border px-4 py-3 ${
                      completedGrade12
                        ? 'bg-amber-50/60 border-amber-200/60 text-amber-800'
                        : 'bg-emerald-50/50 border-emerald-100 text-emerald-800'
                    }`}>
                    <p className="font-semibold flex items-center gap-1.5">
                      <AlertCircle size={14} className="flex-shrink-0" />
                      {completedGrade12
                        ? 'This student has completed Grade 12'
                        : `Previous Grade: Grade ${prevGradeLevel}`}
                    </p>
                    <p className="text-xs mt-0.5 opacity-80">
                      {completedGrade12
                        ? 'They should be marked as Graduated rather than re-enrolled. Only Grade 12 (repeating) is available here.'
                        : `New grade is limited to${
                            recommendedRetGrade
                              ? ` Grade ${recommendedRetGrade} (next level)`
                              : ''
                          }${
                            recommendedRetGrade &&
                            allowedRetGrades.includes(prevGradeLevel)
                              ? ' or'
                              : ''
                          }${
                            allowedRetGrades.includes(prevGradeLevel)
                              ? ` Grade ${prevGradeLevel} (repeating)`
                              : ''
                          }.`}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {GRADE_LEVELS.map(g => {
                    const isAllowed = allowedRetGrades.includes(g);
                    const isRecommended = recommendedRetGrade === g;
                    const isSameGrade = prevGradeLevel === g;
                    const isSelected = retGrade === g;
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => isAllowed && setRetGrade(g)}
                        disabled={!isAllowed}
                        className={`relative p-4 sm:p-5 rounded-xl border-2 text-center transition-all duration-200 ${
                          !isAllowed
                            ? 'border-gray-100 bg-gray-50/40 opacity-45 cursor-not-allowed'
                            : isSelected
                              ? 'border-emerald-400 bg-emerald-50 shadow-md shadow-emerald-100/50'
                              : 'border-gray-100 bg-gray-50/50 hover:border-gray-200 hover:bg-gray-50 hover:shadow-sm'
                        }`}>
                        <p
                          className={`font-bold text-lg ${
                            !isAllowed
                              ? 'text-gray-400'
                              : isSelected
                                ? 'text-emerald-700'
                                : 'text-gray-700'
                          }`}>
                          Grade {g}
                        </p>
                        <p
                          className={`text-[11px] mt-0.5 font-medium ${
                            !isAllowed
                              ? 'text-gray-300'
                              : isSelected
                                ? 'text-emerald-500'
                                : 'text-gray-400'
                          }`}>
                          {g <= 10 ? 'Junior High' : 'Senior High'}
                        </p>
                        <div className="mt-2 flex items-center justify-center gap-1">
                          {isAllowed && (
                            <>
                              {isRecommended ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wide">
                                  <Check size={10} strokeWidth={3} /> Next level
                                </span>
                              ) : isSameGrade ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wide">
                                  <RefreshCw size={10} /> Repeating
                                </span>
                              ) : null}
                            </>
                          )}
                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                              <Check size={11} strokeWidth={3} />
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Program selector for returning student */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-2.5">
                  Curriculum Program *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PROGRAMS.map(p => {
                    const active = program === p.value;
                    const borderCls = active
                      ? 'border-emerald-400 bg-emerald-50'
                      : 'border-gray-100 bg-gray-50/50 hover:border-gray-200 hover:bg-gray-50';
                    const dotCls = active
                      ? 'border-emerald-500'
                      : 'border-gray-300';
                    const innerDotCls = active ? 'bg-emerald-500' : '';
                    return (
                      <button
                        key={p.value}
                        onClick={() => setProgram(p.value)}
                        className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all duration-200 ${borderCls}`}>
                        <div
                          className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center flex-shrink-0 transition-colors ${dotCls}`}>
                          {active && (
                            <div
                              className={`w-2.5 h-2.5 rounded-full ${innerDotCls}`}
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`font-semibold text-sm ${active ? 'text-emerald-700' : 'text-gray-800'}`}>
                            {p.label}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {p.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Strand/Track selector for returning student */}
              {strandTracks.length > 0 && (
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-2.5">
                    {retGrade && retGrade >= 11
                      ? 'SHS Strand *'
                      : 'TLE Specialization (optional)'}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {strandTracks.map(t => {
                      const active = selectedStrandTrackId === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() =>
                            setSelectedStrandTrackId(active ? null : t.id)
                          }
                          className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                            active
                              ? 'border-emerald-400 bg-emerald-50'
                              : 'border-gray-100 bg-gray-50/50 hover:border-gray-200 hover:bg-gray-50'
                          }`}>
                          <div
                            className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center flex-shrink-0 transition-colors ${
                              active ? 'border-emerald-500' : 'border-gray-300'
                            }`}>
                            {active && (
                              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`font-semibold text-sm ${active ? 'text-emerald-700' : 'text-gray-800'}`}>
                              {t.name}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5 font-mono uppercase">
                              {t.code}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {retStep === 4 && foundStudent && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-100 flex items-center justify-center shadow-sm">
                  <CheckCircle size={18} className="text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    Confirm Re-Enrollment
                  </h3>
                  <p className="text-gray-400 text-[11px]">
                    Please review the details before confirming
                  </p>
                </div>
              </div>
              <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-5 space-y-3">
                {[
                  ['Student Name', foundStudent.name],
                  ['Student ID', foundStudent.student_id],
                  ['LRN', foundStudent.lrn],
                  ['Previous Grade', `Grade ${prevGradeLevel}`],
                  ['New Grade Level', `Grade ${retGrade}`],
                  ['School Year', currentSYLabel || '—'],
                  ['Assigned Section', getSection(null)],
                  ['Program', PROGRAM_BADGES[program]?.label || 'Regular']
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex justify-between text-sm border-b border-gray-100/80 pb-2.5 last:border-0 last:pb-0">
                    <span className="text-gray-500">{k}:</span>
                    <span
                      className={`font-medium text-right max-w-[55%] ${k.includes('Section') ? 'text-emerald-700' : k === 'New Grade Level' ? 'text-emerald-700' : 'text-gray-800'}`}>
                      {v}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          {retStep > 1 && (
            <button
              onClick={() => setRetStep((retStep - 1) as RetStep)}
              className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-sm font-semibold py-2.5 transition-all duration-200">
              ← Back
            </button>
          )}
          {retStep < 4 ? (
            <button
              onClick={handleRetNext}
              disabled={
                retStep === 3 &&
                (retGrade == null || !allowedRetGrades.includes(retGrade))
              }
              className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-600 hover:from-emerald-700 hover:to-emerald-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md shadow-emerald-200 hover:shadow-lg hover:shadow-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              Next Step <ChevronRight size={15} />
            </button>
          ) : (
            <button
              onClick={handleConfirmReturning}
              className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-600 hover:from-emerald-700 hover:to-emerald-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md shadow-emerald-200 hover:shadow-lg hover:shadow-emerald-300 flex items-center justify-center gap-2">
              <CheckCircle size={16} /> Confirm Re-Enrollment
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── DROP / TRANSFER FLOW ─────────────────────────────────
  if (flow === 'drop') {
    const isTransferIn = dropReason.includes('Transfer In');
    const isTransfer = dropReason.includes('Transfer');
    const actionLabel = isTransferIn
      ? 'Transfer In'
      : isTransfer
        ? 'Transfer Out'
        : 'Dropout';

    if (dropDone && dropFound) {
      return (
        <div className="w-full max-w-lg mx-auto text-center py-12 sm:py-16 px-3 sm:px-0">
          <div className="w-20 h-20 bg-gradient-to-br from-red-100 to-orange-100 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-red-200/50 animate-[pulse_2s_ease-in-out_infinite]">
            <CheckCircle size={44} className="text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">
            {actionLabel} Processed
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            {dropFound.name}'s record has been updated with {actionLabel}{' '}
            status.
          </p>
          <div className="bg-white/80 backdrop-blur-sm border border-red-100 shadow-xl shadow-red-100/30 rounded-2xl p-6 mb-6 text-left space-y-3">
            <div className="flex items-center gap-3 pb-3 border-b border-red-100/60">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 shadow-md flex items-center justify-center flex-shrink-0">
                <UserMinus size={18} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-gray-900">{dropFound.name}</p>
                <p className="text-xs text-gray-400">
                  Student ID:{' '}
                  <span className="font-mono text-gray-700">
                    {dropFound.student_id}
                  </span>
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-[0.04em] font-semibold">
                  Action
                </p>
                <p className="font-semibold text-red-700">{actionLabel}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-[0.04em] font-semibold">
                  Grade
                </p>
                <p className="font-semibold text-gray-700">
                  Grade {dropFound.grade_level}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-[11px] text-gray-400 uppercase tracking-[0.04em] font-semibold">
                  Reason
                </p>
                <p className="font-medium text-gray-700">{dropReason}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[11px] text-gray-400 uppercase tracking-[0.04em] font-semibold">
                  Date Processed
                </p>
                <p className="font-medium text-gray-700">
                  {new Date().toLocaleDateString('en-PH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={resetAll}
            className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-red-200 hover:shadow-xl hover:shadow-red-300">
            Process Another
          </button>
        </div>
      );
    }

    return (
      <div className="w-full max-w-4xl mx-auto space-y-5 px-3 sm:px-0">
        <div className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <button
            onClick={resetAll}
            className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-all flex-shrink-0">
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-4 flex-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 shadow-md flex items-center justify-center flex-shrink-0">
              <UserMinus size={20} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">
                Student Drop / Transfer
              </h2>
              <p className="text-gray-400 text-sm">
                Search for a student, select action reason, and confirm
              </p>
            </div>
          </div>
        </div>

        {/* Stepper */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between relative">
            <div
              className="absolute top-5 left-0 right-0 h-1 bg-gray-100 z-0 rounded-full"
              style={{ left: '8%', right: '8%' }}
            />
            <div
              className="absolute top-5 left-0 right-0 h-1 z-0 rounded-full overflow-hidden"
              style={{ left: '8%', right: '8%' }}>
              <div
                className="h-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-500 rounded-full"
                style={{ width: `${((dropStep - 1) / 2) * 100}%` }}
              />
            </div>
            {['Search Student', 'Select Reason', 'Confirm'].map((s, i) => {
              const stepNum = i + 1;
              const done = dropStep > stepNum;
              const active = dropStep === stepNum;
              return (
                <div
                  key={s}
                  className="flex flex-col items-center gap-2 z-10 flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                      done
                        ? 'bg-red-500 text-white shadow-md shadow-red-200'
                        : active
                          ? 'bg-white text-red-600 border-2 border-red-500 shadow-lg shadow-red-200 scale-110'
                          : 'bg-gray-100 text-gray-400 border-2 border-gray-200'
                    }`}>
                    {done ? <Check size={15} /> : stepNum}
                  </div>
                  <p
                    className={`text-[11px] font-semibold text-center leading-tight hidden sm:block transition-all duration-200 ${
                      active
                        ? 'text-red-700'
                        : done
                          ? 'text-red-500'
                          : 'text-gray-400'
                    }`}>
                    {s}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-7 transition-all duration-300">
          {/* Step 1 — Search */}
          {dropStep === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-100 to-orange-100 flex items-center justify-center shadow-sm">
                  <Search size={18} className="text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    Search Student Record
                  </h3>
                  <p className="text-gray-400 text-[11px]">
                    Enter the student's LRN or Student ID to locate their record
                  </p>
                </div>
              </div>
              <div className="flex gap-3" ref={dropSearchRef}>
                <div className="relative flex-1">
                  <Search
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    value={dropSearch}
                    onChange={e => {
                      setDropSearch(e.target.value);
                      setDropNotFound(false);
                      setDropErrors({});
                      setDropShowSuggestions(e.target.value.trim().length > 0);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        setDropShowSuggestions(false);
                        handleDropSearch();
                      }
                    }}
                    onFocus={() => {
                      if (dropSearch.trim()) setDropShowSuggestions(true);
                    }}
                    className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-3 transition-all bg-white/75 ${dropErrors.search ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:border-red-400 focus:ring-red-100'}`}
                    placeholder="Enter LRN or Student ID"
                  />
                  {/* Suggestions dropdown */}
                  {dropShowSuggestions && dropSuggestions.length > 0 && (
                    <div className="absolute z-50 top-full mt-1.5 left-0 right-0 bg-white border border-gray-100 rounded-2xl shadow-xl shadow-gray-200/50 max-h-72 overflow-y-auto">
                      {dropSuggestions.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-red-50 border-b border-gray-50 last:border-0 text-left transition"
                          onClick={() => {
                            setDropSearch(s.lrn);
                            setDropFound(s);
                            setDropShowSuggestions(false);
                            setDropStep(2);
                          }}>
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-100 to-orange-100 flex items-center justify-center text-red-700 font-bold text-xs flex-shrink-0 shadow-sm">
                            {s.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {s.name}
                            </p>
                            <p className="text-xs text-gray-400">
                              <span className="font-mono">{s.lrn}</span> · ID:{' '}
                              {s.student_id} · Grade {s.grade_level}
                            </p>
                          </div>
                          <ChevronRight
                            size={14}
                            className="text-gray-300 flex-shrink-0"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                  {dropErrors.search && (
                    <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle size={10} />
                      {dropErrors.search}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setDropShowSuggestions(false);
                    handleDropSearch();
                  }}
                  className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md shadow-red-200">
                  Search
                </button>
              </div>
              {dropNotFound && (
                <div className="flex items-center gap-2.5 text-red-600 bg-red-50/80 border border-red-200 rounded-xl px-4 py-3 text-sm">
                  <AlertCircle size={16} className="flex-shrink-0" /> No record
                  found for "<strong>{dropSearch}</strong>". Please check the
                  LRN or Student ID.
                </div>
              )}
              {allStudents.length > 0 && !dropFound && !dropShowSuggestions && (
                <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-4">
                  <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-[0.04em] mb-2.5">
                    Quick access
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {allStudents.slice(0, 4).map(s => (
                      <button
                        key={s.lrn}
                        onClick={() => {
                          setDropSearch(s.lrn);
                          setDropNotFound(false);
                          setDropShowSuggestions(true);
                        }}
                        className="text-xs bg-white border border-gray-200 hover:border-red-300 text-gray-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all">
                        {s.lrn} — {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2 — Select Reason */}
          {dropStep === 2 && dropFound && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-100 flex items-center justify-center shadow-sm">
                  <CheckCircle size={18} className="text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    Student Found — Select Action & Reason
                  </h3>
                  <p className="text-gray-400 text-[11px]">
                    Choose the reason for this drop or transfer
                  </p>
                </div>
              </div>
              {/* Student info strip */}
              <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-4 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-200 to-orange-200 flex items-center justify-center text-red-800 font-bold text-sm flex-shrink-0 shadow-sm">
                  {dropFound.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{dropFound.name}</p>
                  <p className="text-xs text-gray-500">
                    ID: {dropFound.student_id} · LRN: {dropFound.lrn} · Grade{' '}
                    {dropFound.grade_level}
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-2.5">
                  Action / Reason *
                </label>
                <div className="space-y-2">
                  {DROP_REASONS.map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setDropReason(r)}
                      className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl border-2 cursor-pointer transition-all duration-200 text-left ${dropReason === r ? 'border-red-400 bg-red-50/80 shadow-sm' : 'border-gray-100 bg-gray-50/50 hover:border-gray-200 hover:bg-gray-50'}`}>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${dropReason === r ? 'border-red-500' : 'border-gray-300'}`}>
                        {dropReason === r && (
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                        )}
                      </div>
                      <span className="text-sm text-gray-700 font-medium">
                        {r}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
                  Additional Remarks (optional)
                </label>
                <textarea
                  value={dropRemarks}
                  onChange={e => setDropRemarks(e.target.value)}
                  rows={3}
                  placeholder="Any additional information for the record..."
                  className="w-full border border-gray-200 focus:border-red-400 focus:ring-red-100 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-3 transition-all bg-white/75 resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 3 — Confirm */}
          {dropStep === 3 && dropFound && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-100 to-orange-100 flex items-center justify-center shadow-sm">
                  <AlertCircle size={18} className="text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    Confirm {actionLabel}
                  </h3>
                  <p className="text-gray-400 text-[11px]">
                    Please review the details before confirming this action
                  </p>
                </div>
              </div>
              <div className="bg-red-50/70 border border-red-100 rounded-xl p-5 space-y-3">
                {[
                  ['Student Name', dropFound.name],
                  ['Student ID', dropFound.student_id],
                  ['LRN', dropFound.lrn],
                  ['Current Grade', `Grade ${dropFound.grade_level}`],
                  ['Action', actionLabel],
                  ['Reason', dropReason],
                  ...(dropRemarks ? [['Remarks', dropRemarks]] : []),
                  [
                    'Date Processed',
                    new Date().toLocaleDateString('en-PH', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })
                  ]
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex justify-between text-sm border-b border-red-100/60 pb-2.5 last:border-0 last:pb-0">
                    <span className="text-gray-500">{k}:</span>
                    <span
                      className={`font-medium text-right max-w-[60%] ${k === 'Action' ? 'text-red-700 font-bold' : 'text-gray-800'}`}>
                      {v}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <AlertCircle size={16} className="text-amber-600" />
                </div>
                <div>
                  <p className="font-semibold text-amber-800 text-sm">
                    Important Notice
                  </p>
                  <p className="text-amber-600 text-xs mt-0.5 leading-relaxed">
                    This action will update the student's enrollment status in
                    the system. The student's academic records will be preserved
                    for reference and SF10 generation.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {dropStep > 1 && (
            <button
              onClick={() => setDropStep((dropStep - 1) as DropStep)}
              className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-sm font-semibold py-2.5 transition-all duration-200">
              ← Back
            </button>
          )}
          {dropStep < 3 ? (
            <button
              onClick={() => {
                if (dropStep === 2) {
                  const result = dropReasonSchema.safeParse({
                    reason: dropReason
                  });
                  if (!result.success) {
                    showToast(
                      'error',
                      'Please select a reason before proceeding.'
                    );
                    return;
                  }
                }
                setDropStep((dropStep + 1) as DropStep);
              }}
              disabled={dropStep === 2 && !dropReason}
              className="flex-1 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md shadow-red-200 hover:shadow-lg hover:shadow-red-300 flex items-center justify-center gap-2">
              Next Step <ChevronRight size={15} />
            </button>
          ) : (
            <button
              onClick={handleConfirmDrop}
              className="flex-1 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md shadow-red-200 hover:shadow-lg hover:shadow-red-300 flex items-center justify-center gap-2">
              <CheckCircle size={16} /> Confirm {actionLabel}
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
