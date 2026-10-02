/**
 * Searchable learner picker.
 *
 * A native <select> becomes unusable once a school has a few hundred learners —
 * the browser renders an unscrollable, unfilterable popup. This replaces it with
 * a typeahead that matches on name, LRN, or Student ID, so the registrar can find
 * a learner by any of the three without scrolling.
 *
 * Keyboard: ↑/↓ move, Enter selects, Esc closes.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, UserCheck, Users } from 'lucide-react';

export interface SearchableStudentOption {
  id: number;
  name: string;
  lrn: string;
  student_id: string;
  grade_level: number;
  sex?: 'male' | 'female';
  /** Shown as a right-aligned tag, e.g. a section name. */
  context?: string | null;
}

interface Props {
  options: SearchableStudentOption[];
  value: number | '';
  onChange: (id: number | '') => void;
  placeholder?: string;
  /** Accent colour for focus rings and hover states. */
  accent?: 'indigo' | 'emerald';
  label?: string;
  emptyMessage?: string;
}

const ACCENT = {
  indigo: {
    ring: 'focus:ring-indigo-500/30 focus:border-indigo-400',
    hover: 'hover:bg-indigo-50/60',
    icon: 'bg-indigo-100 text-indigo-700',
    from: 'from-indigo-50 to-indigo-50',
    border: 'border-indigo-200/60',
  },
  emerald: {
    ring: 'focus:ring-emerald-500/30 focus:border-emerald-400',
    hover: 'hover:bg-emerald-50/60',
    icon: 'bg-emerald-100 text-emerald-700',
    from: 'from-emerald-50 to-emerald-50',
    border: 'border-emerald-200/60',
  },
} as const;

export function SearchableStudentSelect({
  options,
  value,
  onChange,
  placeholder = 'Search by name, LRN, or Student ID…',
  accent = 'indigo',
  label,
  emptyMessage = 'No learner matches your search.',
}: Props) {
  const theme = ACCENT[accent];
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => options.find(o => o.id === value) ?? null,
    [options, value]
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      o =>
        o.name.toLowerCase().includes(q) ||
        o.lrn.toLowerCase().includes(q) ||
        o.student_id.toLowerCase().includes(q)
    );
  }, [options, query]);

  // Show the full list when the field is focused and empty, so the user can
  // still scroll rather than staring at a blank box.
  const visible = open ? matches.slice(0, 50) : [];

  // Reflect the selection in the input; clear it so a new search starts fresh.
  useEffect(() => {
    if (selected) {
      setQuery(`${selected.name} — ${selected.lrn}`);
    } else {
      setQuery('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Keep the highlighted row inside the result window as the query narrows.
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const pick = (id: number) => {
    onChange(id);
    setOpen(false);
  };

  const clear = () => {
    onChange('');
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex(i => Math.min(i + 1, visible.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && visible[activeIndex]) {
        e.preventDefault();
        pick(visible[activeIndex].id);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div>
      {label && (
        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
          {label}
        </label>
      )}
      <div className="relative" ref={wrapRef}>
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
        <input
          type="text"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className={`w-full pl-9 pr-9 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 ${theme.ring} transition`}
        />
        {query && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear learner"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
          >
            <X size={14} />
          </button>
        )}

        {open && (
          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-72 overflow-y-auto">
            {visible.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-400">{emptyMessage}</p>
            ) : (
              visible.map((o, i) => (
                <button
                  type="button"
                  key={o.id}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => pick(o.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition border-b border-gray-50 last:border-0 ${
                    i === activeIndex ? theme.hover : ''
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg ${theme.icon} flex items-center justify-center flex-shrink-0`}>
                    <UserCheck size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800 truncate">{o.name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {o.lrn} · Gr {o.grade_level}
                      {o.sex ? ` · ${o.sex === 'male' ? 'Male' : 'Female'}` : ''}
                      {o.context ? ` · ${o.context}` : ''}
                    </p>
                  </div>
                </button>
              ))
            )}
            {matches.length > visible.length && (
              <p className="px-4 py-2 text-[11px] text-gray-400 bg-gray-50 border-t border-gray-100">
                {matches.length - visible.length} more — keep typing to narrow the list
              </p>
            )}
          </div>
        )}
      </div>

      {selected ? (
        <div className={`mt-2.5 flex items-center gap-2.5 bg-gradient-to-br ${theme.from} border ${theme.border} rounded-xl px-4 py-2.5`}>
          <div className={`w-8 h-8 rounded-lg ${theme.icon} flex items-center justify-center flex-shrink-0`}>
            <UserCheck size={14} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-800 truncate">{selected.name}</p>
            <p className="text-[11px] text-gray-500 truncate">
              {selected.lrn} · Student ID {selected.student_id} · Grade {selected.grade_level}
              {selected.sex ? ` · ${selected.sex === 'male' ? 'Male' : 'Female'}` : ''}
            </p>
          </div>
          <span className={`${theme.icon} text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider`}>
            Selected
          </span>
        </div>
      ) : (
        <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
          <Users size={11} /> {options.length} learner{options.length !== 1 ? 's' : ''} available
        </p>
      )}
    </div>
  );
}
