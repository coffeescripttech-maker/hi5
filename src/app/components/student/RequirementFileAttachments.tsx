/**
 * Requirement file attachments — Digital Requirements Upload (client revision
 * #1), rendered inside each Document Checklist row.
 *
 * Permissions (mirrors the server): Committee + Registrar see the
 * Take Photo / Choose File / Replace / Delete controls; the Administrator
 * sees View only; Teacher and Principal see nothing (and the server 403s
 * everything anyway).
 *
 * Rules: PDF / JPG / PNG only (content-validated server-side by magic
 * bytes), 5 MB per file, up to 3 files per requirement. Uploading a copy
 * does NOT change the checklist item's Received state — checking stays its
 * own action.
 */
import { useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  FileText,
  Loader2,
  Paperclip,
  RefreshCw,
  Trash2,
  Upload,
  Eye,
  X
} from 'lucide-react';
import { requireFilesApi, RequirementFileRow } from '../../services/requirementFiles';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 3;
const ACCEPT = '.pdf,.jpg,.jpeg,.png';

/** Photos wider/taller than this get downscaled before upload. */
const MAX_PHOTO_EDGE = 1600;
/** Photos larger than this (bytes) are candidates for compression. */
const COMPRESS_OVER = 300 * 1024;

/**
 * Client doc #1: "Phone photos are compressed in the browser before upload."
 * Downscales large photos to ≤1600px on the long edge and re-encodes JPEG at
 * moderate quality. PDFs and small files pass through untouched.
 */
async function compressPhoto(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/png' || file.size <= COMPRESS_OVER) {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1 && file.size <= COMPRESS_OVER) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>(res =>
      canvas.toBlob(res, 'image/jpeg', 0.82)
    );
    if (!blob || blob.size >= file.size) return file;
    const base = file.name.replace(/\.[^.]+$/, '');
    const out = new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
    return out.size < file.size ? out : file;
  } catch {
    return file; // compression is best-effort — the original still uploads
  }
}

const fmtSize = (n: number): string =>
  n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

/** Client-side pre-check with the friendly messages the client doc asks for
 *  (the server re-validates the actual content by magic bytes). */
function validate(file: File): string | null {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'heic' || ext === 'heif') {
    return 'HEIC is not supported — switch the camera to JPG or convert the photo first.';
  }
  if (!['pdf', 'jpg', 'jpeg', 'png'].includes(ext)) {
    return 'Only PDF, JPG/JPEG, or PNG files are accepted.';
  }
  if (file.size > MAX_FILE_BYTES) {
    return 'The file exceeds the 5 MB limit.';
  }
  if (file.size === 0) {
    return 'The file is empty.';
  }
  return null;
}

export function RequirementFileAttachments({
  enrollmentId,
  reqKey,
  files,
  canManage,
  onReload,
  showToast
}: {
  enrollmentId: number;
  reqKey: string;
  files: RequirementFileRow[];
  canManage: boolean;
  onReload: () => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [busyFileId, setBusyFileId] = useState<number | null>(null);
  const [pendingReplaceId, setPendingReplaceId] = useState<number | null>(null);
  const [viewingId, setViewingId] = useState<number | null>(null);
  /** Upload progress (0–100) while a copy is being sent; null when idle. */
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  /** The failed file is retained so the user can press Retry (client doc #1). */
  const [failedFile, setFailedFile] = useState<File | null>(null);

  const atCap = files.length >= MAX_FILES;

  const withGuard = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const performUpload = async (file: File) => {
    setUploadPct(0);
    setFailedFile(null);
    try {
      await requireFilesApi.uploadWithProgress(enrollmentId, reqKey, file, setUploadPct);
      showToast('success', `Attached "${file.name}".`);
      onReload();
    } catch (err: any) {
      setFailedFile(file); // retained for Retry
      showToast(
        'error',
        err.detail?.error || err.message || 'Upload failed — you can retry.'
      );
    } finally {
      setUploadPct(null);
    }
  };

  const handlePicked = async (raw: File | undefined | null) => {
    if (!raw) return;
    const problem = validate(raw);
    if (problem) {
      showToast('error', problem);
      return;
    }
    // Phone photos are compressed in the browser before upload (client doc #1).
    const file = await compressPhoto(raw);
    withGuard(() => performUpload(file));
  };

  const retryUpload = () => {
    const file = failedFile;
    if (!file || busy) return;
    withGuard(() => performUpload(file));
  };

  const handleReplace = (file: File | undefined | null) => {
    const target = pendingReplaceId;
    setPendingReplaceId(null);
    if (!file || target == null) return;
    const problem = validate(file);
    if (problem) {
      showToast('error', problem);
      return;
    }
    withGuard(async () => {
      try {
        await requireFilesApi.replace(enrollmentId, reqKey, target, file);
        showToast('success', `Replaced with "${file.name}".`);
        onReload();
      } catch (err: any) {
        showToast('error', err.detail?.error || err.message || 'Replace failed.');
      }
    });
  };

  const handleView = (f: RequirementFileRow) =>
    withGuard(async () => {
      setViewingId(f.id);
      try {
        const url = await requireFilesApi.openView(enrollmentId, reqKey, f.id);
        window.open(url, '_blank', 'noopener');
        // the object URL is a temporary, page-scoped handle — revoke shortly
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } catch (err: any) {
        showToast('error', err.detail?.error || err.message || 'Could not open the file.');
      } finally {
        setViewingId(null);
      }
    });

  const handleDelete = (f: RequirementFileRow) =>
    withGuard(async () => {
      setBusyFileId(f.id);
      try {
        await requireFilesApi.delete(enrollmentId, reqKey, f.id);
        showToast('success', `Deleted "${f.original_name}".`);
        onReload();
      } catch (err: any) {
        showToast('error', err.detail?.error || err.message || 'Delete failed.');
      } finally {
        setBusyFileId(null);
      }
    });

  const pick = (ref: React.RefObject<HTMLInputElement | null>) => {
    if (ref === cameraRef || ref === fileRef) {
      if (atCap || busy) return;
    }
    if (busy) return;
    ref.current?.click();
  };

  return (
    <div className="w-full mt-2.5 pl-11">
      {/* upload progress (client doc #1: display progress while sending) */}
      {uploadPct != null && (
        <div className="mb-2 rounded-lg border border-indigo-100 bg-indigo-50/60 px-2.5 py-2">
          <div className="flex items-center gap-2 text-[11px] text-indigo-700 font-semibold mb-1">
            <Loader2 size={11} className="animate-spin" />
            Uploading… {uploadPct}%
          </div>
          <div className="h-1 rounded-full bg-white overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-200"
              style={{ width: `${uploadPct}%` }}
            />
          </div>
        </div>
      )}

      {/* retry bar (client doc #1: failed uploads offer a Retry button) */}
      {failedFile && uploadPct == null && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50/70 px-2.5 py-2 text-[11px]">
          <AlertCircle size={12} className="text-red-600 flex-shrink-0" />
          <span className="text-red-700 font-semibold truncate flex-1 min-w-0" title={failedFile.name}>
            "{failedFile.name}" failed to upload.
          </span>
          <button
            type="button"
            onClick={retryUpload}
            disabled={busy}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 flex-shrink-0">
            <RefreshCw size={10} />
            Retry
          </button>
          <button
            type="button"
            onClick={() => setFailedFile(null)}
            disabled={busy}
            title="Dismiss"
            className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0">
            <X size={12} />
          </button>
        </div>
      )}

      {/* attached files */}
      {files.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {files.map(f => (
            <div
              key={f.id}
              className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50/60 px-2.5 py-1.5 text-[11px]">
              <FileText size={12} className="text-gray-400 flex-shrink-0" />
              <span className="font-medium text-gray-700 truncate max-w-45 flex-1 min-w-0" title={f.original_name}>
                {f.original_name}
              </span>
              <span className="text-gray-400 flex-shrink-0">{fmtSize(f.file_size)}</span>
              <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleView(f)}
                  disabled={busy}
                  title="View the file"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 disabled:opacity-60">
                  {viewingId === f.id ? (
                    <Loader2 size={10} className="animate-spin" />
                  ) : (
                    <Eye size={10} />
                  )}
                  View
                </button>
                {canManage && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingReplaceId(f.id);
                        if (busy) return;
                        replaceRef.current?.click();
                      }}
                      disabled={busy}
                      title="Replace this file"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-gray-600 border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60">
                      <RefreshCw size={10} />
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(f)}
                      disabled={busy || busyFileId === f.id}
                      title="Delete this file"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 disabled:opacity-60">
                      {busyFileId === f.id ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : (
                        <Trash2 size={10} />
                      )}
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Take Photo — mobile camera capture */}
          <button
            type="button"
            onClick={() => pick(cameraRef)}
            disabled={atCap || busy}
            title={atCap ? `Up to ${MAX_FILES} files per requirement` : 'Take a photo with the camera'}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold text-gray-700 border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
            <Camera size={12} />
            Take Photo
          </button>
          {/* Choose File */}
          <button
            type="button"
            onClick={() => pick(fileRef)}
            disabled={atCap || busy}
            title={atCap ? `Up to ${MAX_FILES} files per requirement` : 'Attach a PDF / JPG / PNG copy'}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            Choose File
          </button>
          <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
            <Paperclip size={10} />
            {files.length}/{MAX_FILES} files · PDF / JPG / PNG · up to 5 MB
          </span>
        </div>
      )}

      {/* hidden inputs — camera capture + file picker */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => {
          handlePicked(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={e => {
          handlePicked(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={replaceRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={e => {
          handleReplace(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
