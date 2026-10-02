/**
 * Reading Assessments — Teacher-facing.
 *
 * Records the reading assessment result that is the only admissible basis for
 * tagging a learner as Non-Reader. Nothing on this page reads grades: the tag
 * is driven by the recorded outcome alone.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BookMarked,
  Loader2,
  Plus,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { PageContainer } from '../../components/PageContainer';
import { useApp } from '../../context/AppContext';
import { studentsApi, StudentRow } from '../../services/students';
import { schoolYearsApi, SchoolYearRow } from '../../services/schoolYears';
import { SearchableStudentSelect } from '../../components/SearchableStudentSelect';
import {
  readingAssessmentsApi,
  ReadingAssessment,
  ReadingResult,
} from '../../services/readingAssessments';

const GRADES = [7, 8, 9, 10, 11, 12];

export function ReadingAssessments() {
  const { showToast } = useApp();
  const [syId, setSyId] = useState<number>(0);
  const [years, setYears] = useState<SchoolYearRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [assessments, setAssessments] = useState<ReadingAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New-assessment form
  const [studentId, setStudentId] = useState('');
  const [result, setResult] = useState<ReadingResult>('non_reader');
  const [score, setScore] = useState('');
  const [instrument, setInstrument] = useState('');
  const [remarks, setRemarks] = useState('');

  const rosterOptions = useMemo(
    () =>
      students.map(s => ({
        id: s.id,
        name: s.name,
        lrn: s.lrn,
        student_id: s.student_id,
        grade_level: s.grade_level,
        sex: s.sex,
        context: s.section_name || 'Pending queue',
      })),
    [students]
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([schoolYearsApi.list(), studentsApi.listMyStudents()])
      .then(([ys, studs]) => {
        if (cancelled) return;
        setYears(ys);
        setStudents(studs);
        const current = ys.find(y => y.is_current === 1);
        if (current) setSyId(current.id);
      })
      .catch(err =>
        showToast('error', 'Failed to load data: ' + (err.detail?.error || err.message))
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const loadAssessments = useCallback(() => {
    if (!syId) return;
    readingAssessmentsApi
      .list({ school_year_id: syId })
      .then(setAssessments)
      .catch(err =>
        showToast('error', 'Failed to load assessments: ' + (err.detail?.error || err.message))
      );
  }, [syId, showToast]);

  useEffect(loadAssessments, [loadAssessments]);

  const handleCreate = async () => {
    if (!studentId) {
      showToast('error', 'Select a learner first.');
      return;
    }
    if (score !== '' && (isNaN(Number(score)) || Number(score) < 0 || Number(score) > 100)) {
      showToast('error', 'Score must be between 0 and 100.');
      return;
    }
    if (!syId) {
      showToast('error', 'No school year selected.');
      return;
    }

    setSaving(true);
    try {
      await readingAssessmentsApi.create({
        student_id: parseInt(studentId),
        school_year_id: syId,
        result,
        score: score === '' ? null : Number(score),
        instrument: instrument.trim() || undefined,
        remarks: remarks.trim() || undefined,
      });
      showToast(
        'success',
        result === 'non_reader'
          ? 'Assessment recorded. This learner can now be tagged Non-Reader.'
          : 'Assessment recorded.'
      );
      setStudentId('');
      setScore('');
      setInstrument('');
      setRemarks('');
      loadAssessments();
    } catch (err: any) {
      showToast('error', err.detail?.error || err.message || 'Failed to record assessment.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (row: ReadingAssessment) => {
    if (
      !window.confirm(
        `Remove the ${row.result === 'non_reader' ? 'Non-Reader' : 'Reader'} assessment for ` +
          `${row.student_name}? If no supporting assessment remains, their Non-Reader tag is cleared.`
      )
    ) {
      return;
    }
    try {
      const res = await readingAssessmentsApi.remove(row.id);
      showToast(
        'success',
        res.non_reader_tag_cleared
          ? 'Assessment removed — Non-Reader tag cleared.'
          : 'Assessment removed.'
      );
      loadAssessments();
    } catch (err: any) {
      showToast('error', err.detail?.error || err.message || 'Failed to remove assessment.');
    }
  };

  const nonReaderCount = assessments.filter(a => a.result === 'non_reader').length;

  if (loading) {
    return (
      <PageContainer>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <Loader2 size={28} className="mx-auto text-emerald-500 animate-spin" />
          <p className="text-gray-400 text-sm font-medium mt-3">Loading reading assessments...</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {/* ── HEADER ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-400" />
        <div className="p-5 sm:p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-200 flex items-center justify-center flex-shrink-0">
            <BookMarked size={22} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em]">
              Reading Assessments
            </h2>
            <p className="text-gray-500 text-sm">
              Record reading results — the only basis for a Non-Reader tag
            </p>
          </div>
        </div>
      </div>

      {/* ── POLICY NOTE ── */}
      <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl px-5 py-4">
        <div className="flex items-start gap-3">
          <ShieldCheck size={16} className="text-emerald-600 mt-0.5 shrink-0" />
          <p className="text-xs text-emerald-800 leading-relaxed">
            <strong>Non-Reader is a manual, assessment-backed tag.</strong> It is never assigned
            automatically from grades, general averages or sectioning thresholds. Record the
            assessment result here first; the tag can then be applied on the learner's profile.
            Removing the last supporting assessment also clears the tag.
          </p>
        </div>
      </div>

      {/* ── NEW ASSESSMENT ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Plus size={15} className="text-emerald-600" /> Record Assessment
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-1">
            <SearchableStudentSelect
              accent="emerald"
              value={studentId === '' ? '' : Number(studentId)}
              onChange={id => setStudentId(id === '' ? '' : String(id))}
              options={rosterOptions}
              placeholder="Search your roster by name, LRN, or ID…"
              emptyMessage="No learner on your roster matches your search."
            />
            <p className="text-[11px] text-gray-400 mt-1.5">
              Only learners on your roster can be assessed.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
              Result
            </label>
            <select
              value={result}
              onChange={e => setResult(e.target.value as ReadingResult)}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
            >
              <option value="non_reader">Non-Reader</option>
              <option value="reader">Reader</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
              Score (optional)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={score}
              onChange={e => setScore(e.target.value)}
              placeholder="0 – 100"
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
              Instrument
            </label>
            <input
              type="text"
              value={instrument}
              onChange={e => setInstrument(e.target.value)}
              placeholder="e.g. Phil-IRI"
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] mb-1.5">
              Remarks
            </label>
            <input
              type="text"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Observations..."
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
            />
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={saving || !studentId}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          Record Assessment
        </button>
      </div>

      {/* ── SUMMARY ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">
            Assessments
          </span>
          <p className="text-2xl font-bold text-gray-900 mt-1">{assessments.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">
            Non-Reader
          </span>
          <p className="text-2xl font-bold text-red-500 mt-1">{nonReaderCount}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">
            Reader
          </span>
          <p className="text-2xl font-bold text-emerald-600 mt-1">
            {assessments.length - nonReaderCount}
          </p>
        </div>
      </div>

      {/* ── LIST ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {assessments.length === 0 ? (
          <div className="p-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <BookMarked size={28} className="text-gray-300" />
            </div>
            <p className="text-gray-500 text-sm font-semibold">No reading assessments recorded</p>
            <p className="text-gray-400 text-xs mt-1">
              Record one above to enable a Non-Reader tag for a learner.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="px-4 py-3.5 text-left text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">
                    Learner
                  </th>
                  <th className="px-4 py-3.5 text-left text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">
                    Date
                  </th>
                  <th className="px-4 py-3.5 text-center text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">
                    Result
                  </th>
                  <th className="px-4 py-3.5 text-center text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">
                    Score
                  </th>
                  <th className="px-4 py-3.5 text-left text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">
                    Instrument
                  </th>
                  <th className="px-4 py-3.5 text-right text-gray-500 text-[11px] font-semibold uppercase tracking-[0.06em]">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {assessments.map(a => (
                  <tr key={a.id} className="hover:bg-emerald-50/40 transition-colors duration-150">
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-gray-900">{a.student_name}</span>
                      <span className="block text-[11px] font-mono text-gray-400">
                        {a.student_code}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {new Date(a.assessment_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          a.result === 'non_reader'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {a.result === 'non_reader' ? 'Non-Reader' : 'Reader'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-medium text-gray-700">
                      {a.score ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{a.instrument || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleRemove(a)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50 transition"
                      >
                        <Trash2 size={13} /> Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-6 py-3 bg-gray-50/50 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Info size={12} /> Grades are never consulted.
          </span>
          <span className="flex items-center gap-1">
            <AlertTriangle size={12} /> Removing the last assessment clears the Non-Reader tag.
          </span>
        </div>
      </div>
    </PageContainer>
  );
}