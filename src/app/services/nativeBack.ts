/**
 * Native hardware back-button handling (Capacitor Android/iOS).
 *
 * Components register a handler while they are "on top" (an open drawer or
 * modal); handlers run LIFO and the first one to return `true` consumes the
 * press. When nothing handles it we navigate the web history back, or minimize
 * the app if there is nowhere to go — matching native expectations instead of
 * abruptly exiting.
 */
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";

type BackHandler = () => boolean;

const handlers: BackHandler[] = [];
let initialized = false;

/** Register a back handler; returns an unsubscribe function. */
export function registerNativeBackHandler(handler: BackHandler): () => void {
  handlers.push(handler);
  return () => {
    const i = handlers.lastIndexOf(handler);
    if (i >= 0) handlers.splice(i, 1);
  };
}

/** Attach the Capacitor back listener. Safe to call on web (no-op). */
export function initNativeBack(): void {
  if (initialized || !Capacitor.isNativePlatform()) return;
  initialized = true;

  void CapacitorApp.addListener("backButton", ({ canGoBack }) => {
    for (let i = handlers.length - 1; i >= 0; i--) {
      try {
        if (handlers[i]()) return;
      } catch {
        /* a broken handler must not block back navigation */
      }
    }
    if (canGoBack) {
      window.history.back();
    } else {
      void CapacitorApp.minimizeApp();
    }
  });
}
