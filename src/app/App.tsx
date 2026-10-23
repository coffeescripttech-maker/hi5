import React, { useEffect } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AppProvider } from "./context/AppContext";
import { initNativeBack } from "./services/nativeBack";
import { initNativeStatusBar } from "./services/nativeStatusBar";

export default function App() {
  // Wire the Android/iOS hardware back button once at startup (no-op on web).
  useEffect(() => {
    initNativeBack();
    // Keep native app content below the phone's status bar (never covered).
    void initNativeStatusBar();
  }, []);

  return (
    <AppProvider>
      <RouterProvider router={router} />
    </AppProvider>
  );
}
