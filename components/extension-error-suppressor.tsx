"use client";

import { useEffect } from "react";
import { suppressExtensionErrors } from "@/lib/suppress-extension-errors";

/**
 * Component to suppress browser extension errors globally
 * This should be included in the root layout
 */
export function ExtensionErrorSuppressor() {
  useEffect(() => {
    const cleanup = suppressExtensionErrors();
    return cleanup;
  }, []);

  return null;
}







