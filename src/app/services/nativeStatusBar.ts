/**
 * Native status-bar handling (Capacitor Android/iOS).
 *
 * Capacitor 8 targets SDK 35 where edge-to-edge is enforced, so the WebView
 * would render beneath the phone's status bar and cover the app header.
 * Android's WebView does not populate env(safe-area-inset-*), so the CSS
 * helpers cannot fix it there — instead we ask the OS not to overlay the
 * WebView and give the bar a clean background: the app content always starts
 * BELOW the status bar on every device.
 */
import { Capacitor } from "@capacitor/core";

let initialized = false;

export async function initNativeStatusBar(): Promise<void> {
  if (initialized || !Capacitor.isNativePlatform()) return;
  initialized = true;

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    // Place the WebView below the status bar (no content under the notch).
    await StatusBar.setOverlaysWebView({ overlay: false });
    // Solid background that matches the app shell; dark icons on light bar.
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: "#ffffff" });
  } catch {
    // Older Androids without the plugin API — the system default is fine.
  }
}
