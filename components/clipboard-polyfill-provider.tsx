"use client";

import { useEffect } from "react";

// Clipboard API polyfill for environments where navigator.clipboard is not available
// This fixes the "Cannot read properties of undefined (reading 'writeText')" error
export function ClipboardPolyfillProvider() {
  useEffect(() => {
    // Run polyfill immediately on client side
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      const fallbackWriteText = async (text: string): Promise<void> => {
        // Fallback to legacy document.execCommand method
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          if (!successful) {
            throw new Error('Copy command failed');
          }
        } catch (error) {
          document.body.removeChild(textArea);
          throw error;
        }
      };

      // Create clipboard object if it doesn't exist
      if (!navigator.clipboard) {
        (navigator as any).clipboard = {
          writeText: fallbackWriteText,
          readText: async () => {
            throw new Error('readText not supported in fallback');
          },
        };
      } else {
        // If clipboard exists but writeText is missing or broken, replace it
        try {
          // Test if writeText exists
          if (!navigator.clipboard.writeText) {
            (navigator.clipboard as any).writeText = fallbackWriteText;
          }
        } catch (error) {
          // If there's an error accessing writeText, replace it
          (navigator.clipboard as any).writeText = fallbackWriteText;
        }
      }
    }
  }, []);

  return null;
}

