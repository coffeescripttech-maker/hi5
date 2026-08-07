/**
 * Photo URL validation.
 *
 * Profile photos are stored as base64 data URLs. Before migration 016 widened
 * the column to MEDIUMTEXT, the column was VARCHAR(255), so a saved photo got
 * truncated mid-base64 — a value an <img> can never decode (renders as a broken
 * or blank image, or shows the raw `data:image/jpeg;base64,...` prefix on
 * inspect). This guard rejects such values so callers can fall back to initials.
 */
export function isValidPhotoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  // Remote URLs are allowed as-is.
  if (/^https?:\/\//i.test(url)) return true;
  // Must be a raster base64 data URL AND have real payload. Our thumbnails are
  // ~256px JPEGs (thousands of chars); a truncated-at-255 value never passes.
  return /^data:image\/(png|jpe?g|gif|webp|avif);base64,/.test(url) && url.length > 500;
}
