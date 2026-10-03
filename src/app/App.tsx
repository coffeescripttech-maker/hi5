import React, { useEffect } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AppProvider } from "./context/AppContext";
import { initNativeBack } from "./services/nativeBack";

export default function App() {
  // Wire the Android/iOS hardware back button once at startup (no-op on web).
  useEffect(() => {
    initNativeBack();
  }, []);

  return (
    <AppProvider>
      <RouterProvider router={router} />
    </AppProvider>
  );
}
