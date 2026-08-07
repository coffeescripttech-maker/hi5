/**
 * Role-scoped visual tokens for the app shell (sidebar + topbar).
 *
 * These keep the shell aligned with the rest of the app: the dark sidebar
 * gradients are the role's brand surface (unchanged from the original
 * Layout.tsx), while the accent color used for active pills, focus rings
 * and badges comes from `utils/roleTheme.ts` (`useRoleAccent()`).
 */
import type { ElementType } from 'react';
import { Shield, GraduationCap, FileText, User } from 'lucide-react';
import type { Role } from '../../navigation';

/** Dark sidebar gradient per role (brand surface, preserved verbatim). */
export const ROLE_GRADIENTS: Record<Role, string> = {
  admin: 'from-[#0d1b3e] to-[#1a3a8f]',
  teacher: 'from-[#064e35] to-[#065f46]',
  registrar: 'from-[#1a1040] to-[#3730a3]',
  principal: 'from-[#3b0764] to-[#6b21a8]'
};

/** Solid avatar / badge chip color per role. */
export const ROLE_BADGE_COLORS: Record<Role, string> = {
  admin: 'bg-blue-700',
  teacher: 'bg-emerald-600',
  registrar: 'bg-indigo-600',
  principal: 'bg-purple-600'
};

/** Small role glyph used next to the role label in the sidebar footer. */
export const ROLE_ICONS: Record<Role, ElementType> = {
  admin: Shield,
  teacher: GraduationCap,
  registrar: FileText,
  principal: User
};
