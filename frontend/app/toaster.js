"use client";

import { Toaster } from "sonner";

export default function AppToaster() {
  return (
    <Toaster
      richColors
      closeButton
      position="top-center"
      toastOptions={{
        duration: 3600,
        style: {
          borderRadius: "18px",
          border: "1px solid rgba(154, 181, 154, 0.34)",
          background: "rgba(255, 253, 247, 0.92)",
          backdropFilter: "blur(18px)",
          color: "#183229",
        },
      }}
    />
  );
}
