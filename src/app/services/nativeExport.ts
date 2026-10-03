/**
 * Native (Capacitor) file output helpers.
 *
 * Inside the Android/iOS WebView, `URL.createObjectURL` + `<a download>` is a
 * no-op and `window.print()` is unsupported. These helpers detect the native
 * platform and route generated files through the Filesystem + Share plugins so
 * the OS share sheet (which includes "Save to Files" and "Print") appears.
 * On the web they fall back to the original anchor-download behaviour, so
 * desktop behaviour is unchanged.
 */
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export interface ShareOptions {
  /** Share-sheet title / dialog title. */
  title?: string;
  /** Text shown alongside the file in the share sheet. */
  text?: string;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the "data:<mime>;base64," prefix — Filesystem expects raw base64.
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

/** Browser fallback: trigger a download via a temporary anchor. */
function webDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Save a generated file. On native, write it to the app cache and surface the
 * OS share sheet; on the web, start a normal browser download.
 */
export async function saveOrShareFile(
  blob: Blob,
  filename: string,
  options: ShareOptions = {}
): Promise<void> {
  if (!isNativePlatform()) {
    webDownload(blob, filename);
    return;
  }

  const data = await blobToBase64(blob);
  const written = await Filesystem.writeFile({
    path: filename,
    data,
    directory: Directory.Cache,
    recursive: true,
  });

  await Share.share({
    title: options.title ?? filename,
    text: options.text,
    url: written.uri,
    dialogTitle: options.title ?? `Share ${filename}`,
  });
}

/** Extract the server-provided filename from a Content-Disposition header. */
export function filenameFromResponse(
  response: Response,
  fallback: string
): string {
  const disposition = response.headers.get("Content-Disposition") || "";
  // RFC 5987 form: filename*=UTF-8''name.ext
  const ext = disposition.match(/filename\*=(?:UTF-8''|utf-8'')?([^;\r\n]+)/i);
  const plain = disposition.match(/filename="?([^";\r\n]+)"?/i);
  const raw = (ext && ext[1]) || (plain && plain[1]);
  if (!raw) return fallback;
  try {
    return decodeURIComponent(raw.replace(/^["']|["']$/g, ""));
  } catch {
    return raw.replace(/^["']|["']$/g, "");
  }
}

/**
 * Save (or share) a downloaded API response, deriving the filename from the
 * response's Content-Disposition header when present.
 */
export async function saveOrShareResponse(
  response: Response,
  fallbackFilename: string,
  options: ShareOptions = {}
): Promise<void> {
  const filename = filenameFromResponse(response, fallbackFilename);
  const blob = await response.blob();
  await saveOrShareFile(blob, filename, options);
}
