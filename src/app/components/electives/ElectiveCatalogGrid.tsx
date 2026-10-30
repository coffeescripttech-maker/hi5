/**
 * ElectiveCatalogGrid — shared grid for browsing and ticking Strengthened SHS
 * electives.
 *
 * The catalog can hit ~170 subjects (14 clusters × 2 grades), so this grid adds
 * three aids on top of the old flat cluster-chip lists, with no extra API calls:
 *
 * - Search: client-side substring match on the subject name.
 * - Grade tabs: appear automatically when subjects from more than one grade
 *   level are present (otherwise the caller's list is already grade-scoped).
 * - Collapsible clusters: each cluster header collapses its chips and shows a
 *   "picked / on" count badge.
 *
 * A pinned "picks" bar lists every selected subject with an ✕, so a selection
 * hidden by the current search stays visible and removable — searching must
 * never be able to strand a tick the user can no longer untick.
 *
 * Variants:
 * - 'pick'     — round chips that toggle the caller's selection
 *                (EnrollmentModule, SectionAssignment elective editor).
 * - 'offering' — ON/OFF toggle buttons (SubjectManagement, admin panel).
 */
import React, { useMemo, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import {
  ElectiveCatalogGroup,
  ElectiveSubject,
} from '../../services/electives';

export type ElectiveCatalogVariant = 'pick' | 'offering';

const ACCENT = {
  indigo: {
    tabOn: 'bg-indigo-50 border-indigo-300 text-indigo-700',
    chipOn: 'border-indigo-400 bg-indigo-50 text-indigo-700',
    chipOff: 'border-gray-200 bg-gray-50/50 text-gray-500 hover:border-gray-300',
    ring: 'focus:ring-indigo-500/30 focus:border-indigo-400',
    barBorder: 'border-indigo-100',
    barTitle: 'text-indigo-700',
    chipX: 'text-indigo-300 hover:text-indigo-600',
  },
  emerald: {
    tabOn: 'bg-emerald-50 border-emerald-300 text-emerald-700',
    chipOn: 'border-emerald-400 bg-emerald-50 text-emerald-700',
    chipOff: 'border-gray-200 bg-gray-50/50 text-gray-500 hover:border-gray-300',
    ring: 'focus:ring-emerald-500/30 focus:border-emerald-400',
    barBorder: 'border-emerald-100',
    barTitle: 'text-emerald-700',
    chipX: 'text-emerald-300 hover:text-emerald-600',
  },
} as const;

interface Props {
  groups: ElectiveCatalogGroup[];
  variant?: ElectiveCatalogVariant;
  /** Selected subject ids ('pick' variant). */
  selectedIds?: number[];
  /** Called when a 'pick' chip is clicked. */
  onTogglePick?: (id: number) => void;
  /** Called when an 'offering' button is clicked (id, newOfferedState). */
  onToggleOffer?: (id: number, offered: boolean) => void;
  /** Subject ids whose offering toggle is mid-flight ('offering' variant). */
  busyIds?: Set<number>;
  accent?: 'indigo' | 'emerald';
  emptyMessage?: string;
}

export function ElectiveCatalogGrid({
  groups,
  variant = 'pick',
  selectedIds = [],
  onTogglePick,
  onToggleOffer,
  busyIds,
  accent = 'indigo',
  emptyMessage = 'No electives are offered for this selection yet.',
}: Props) {
  const a = ACCENT[accent];
  const [query, setQuery] = useState('');
  const [gradeTab, setGradeTab] = useState<number | 'all'>('all');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  // Grades present across the whole catalog — tabs only make sense when the
  // list spans more than one (e.g. the admin offerings panel).
  const grades = useMemo(() => {
    const set = new Set<number>();
    for (const g of groups)
      for (const s of g.subjects) set.add(s.grade_level);
    return [...set].sort((x, y) => x - y);
  }, [groups]);

  const multiGrade = grades.length > 1;

  // Track names present — the header shows them only when mixed, since the
  // caller usually pre-filters to a single track.
  const multiTrack = useMemo(() => {
    const set = new Set(groups.map(g => g.track_name));
    return set.size > 1;
  }, [groups]);

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  // Apply query + grade tab, then drop clusters whose subjects all vanished.
  const visible = useMemo(() => {
    return groups
      .map(g => ({
        ...g,
        subjects: g.subjects.filter(
          s =>
            (gradeTab === 'all' || s.grade_level === gradeTab) &&
            (!searching || s.name.toLowerCase().includes(q))
        ),
      }))
      .filter(g => g.subjects.length > 0);
  }, [groups, gradeTab, searching, q]);

  // All selections across the full catalog (not just the filtered view) — the
  // picks bar renders these so a selection hidden by the search stays visible
  // and removable. Ids the filtered view no longer shows get a 🔍 marker.
  const allSelected = useMemo(
    () =>
      groups
        .flatMap(g => g.subjects)
        .filter(s => selected.has(s.id)),
    [groups, selected]
  );

  const visibleIds = useMemo(() => {
    const set = new Set<number>();
    for (const g of visible) for (const s of g.subjects) set.add(s.id);
    return set;
  }, [visible]);

  // How many catalog subjects match the current filters (offering summary).
  const totalCount = useMemo(
    () =>
      groups.reduce(
        (n, g) =>
          n +
          g.subjects.filter(
            s =>
              (gradeTab === 'all' || s.grade_level === gradeTab) &&
              (!searching || s.name.toLowerCase().includes(q))
          ).length,
        0
      ),
    [groups, gradeTab, searching, q]
  );

  // Subjects switched ON that the current filters show ('offering' variant).
  const offeredInView = useMemo(
    () =>
      groups.reduce(
        (n, g) => n + g.subjects.filter(s => visibleIds.has(s.id) && s.is_offered === 1).length,
        0
      ),
    [groups, visibleIds]
  );

  const toggleCollapse = (key: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const chipFor = (s: ElectiveSubject) => {
    if (variant === 'offering') {
      const on = s.is_offered === 1;
      const busy = busyIds?.has(s.id) ?? false;
      return (
        <button
          key={s.id}
          type="button"
          disabled={busy}
          onClick={() => onToggleOffer?.(s.id, !on)}
          className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
            on
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              : 'border-gray-200 bg-gray-50 text-gray-400 hover:border-gray-300'
          } ${busy ? 'opacity-50 cursor-wait' : ''}`}>
          {on ? '● ON ' : '○ OFF '}
          {s.name}
        </button>
      );
    }
    const active = selected.has(s.id);
    return (
      <button
        key={s.id}
        type="button"
        onClick={() => onTogglePick?.(s.id)}
        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-200 ${
          active ? a.chipOn : a.chipOff
        }`}>
        {active ? '✓ ' : ''}
        {s.name}
      </button>
    );
  };

  if (groups.length === 0) {
    return <p className="text-sm text-gray-400 py-2">{emptyMessage}</p>;
  }

  return (
    <div>
      {/* ── Search + grade tabs ── */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none"
          />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search electives…"
            className={`w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-gray-200 bg-white outline-none focus:ring-2 ${a.ring} placeholder:text-gray-300`}
          />
          {searching && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
              aria-label="Clear search">
              <X size={13} />
            </button>
          )}
        </div>
        {multiGrade && (
          <div className="flex gap-1">
            {[...grades, 'all' as const].map(tab => {
              const activeChip = gradeTab === tab;
              const label =
                tab === 'all' ? 'All' : `G${tab}`;
              return (
                <button
                  key={String(tab)}
                  type="button"
                  onClick={() => setGradeTab(tab)}
                  className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-all ${
                    activeChip
                      ? a.tabOn
                      : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
                  }`}>
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Pinned picks / summary bar — survives filtering ── */}
      {variant === 'pick' && allSelected.length > 0 ? (
        <div
          className={`flex flex-wrap items-center gap-1.5 mb-3 p-2.5 rounded-lg border bg-white ${a.barBorder}`}>
          <span
            className={`text-[11px] font-bold uppercase tracking-[0.04em] mr-1 ${a.barTitle}`}>
            Picked ({allSelected.length})
          </span>
          {allSelected.map(s => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full border bg-white border-gray-200 text-xs font-medium text-gray-600">
              {!visibleIds.has(s.id) && (
                <Search
                  size={10}
                  className="text-gray-300"
                  aria-label="Currently hidden by search"
                />
              )}
              {s.name}
              <button
                type="button"
                onClick={() => onTogglePick?.(s.id)}
                className={`rounded-full p-0.5 transition-colors ${a.chipX}`}
                aria-label={`Remove ${s.name}`}>
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      ) : variant === 'offering' ? (
        <p className="text-[11px] font-semibold text-gray-400 mb-3">
          {offeredInView} of {totalCount} electives
          {multiGrade && gradeTab !== 'all'
            ? ` for Grade ${gradeTab}`
            : ''}
          {searching ? ' matching the search' : ''} offered
        </p>
      ) : null}

      {/* ── Clusters ── */}
      {visible.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">
          No electives match {searching ? `“${query.trim()}”` : 'this filter'}.
        </p>
      ) : (
        visible.map(g => {
          const key = `${g.track_id}-${g.cluster}`;
          const isCollapsed = collapsed.has(key);
          const count = variant === 'pick'
            ? g.subjects.filter(s => selected.has(s.id)).length
            : g.subjects.filter(s => s.is_offered === 1).length;
          return (
            <div key={key} className="mb-2.5">
              <button
                type="button"
                onClick={() => toggleCollapse(key)}
                className="flex items-center gap-1.5 w-full text-left group">
                <ChevronDown
                  size={13}
                  className={`text-gray-300 transition-transform duration-200 group-hover:text-gray-500 ${
                    isCollapsed ? '-rotate-90' : ''
                  }`}
                />
                <span className="text-[11px] font-bold text-gray-600 uppercase tracking-[0.05em]">
                  {g.cluster}
                </span>
                {multiTrack && (
                  <span className="font-medium normal-case tracking-normal text-gray-400">
                    · {g.track_name}
                  </span>
                )}
                {count > 0 && (
                  <span
                    className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full ${a.tabOn}`}>
                    {variant === 'pick' ? `${count} picked` : `${count} on`}
                  </span>
                )}
              </button>
              {!isCollapsed && (
                <div className="flex flex-wrap gap-2 mt-2">{g.subjects.map(chipFor)}</div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
