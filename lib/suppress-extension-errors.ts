/**
 * Global error suppression for browser extension errors
 * This should be called as early as possible in the application lifecycle
 */
export function suppressExtensionErrors() {
  if (typeof window === 'undefined') {
    return;
  }

  const isExtensionError = (message: string, filename?: string, stack?: string): boolean => {
    const checkString = `${message} ${filename || ''} ${stack || ''}`.toLowerCase();
    return (
      checkString.includes('extension context invalidated') ||
      checkString.includes('chrome-extension://') ||
      checkString.includes('moz-extension://') ||
      checkString.includes('safari-extension://') ||
      checkString.includes('content.js') ||
      checkString.includes('extension') ||
      checkString.includes('web_accessible_resources')
    );
  };

  // Handle window errors
  const handleError = (event: ErrorEvent) => {
    if (
      isExtensionError(
        event.message || '',
        event.filename,
        event.error?.stack
      )
    ) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return false;
    }
  };

  // Handle unhandled promise rejections
  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message = reason?.message || String(reason || '');
    const stack = reason?.stack || '';
    
    if (isExtensionError(message, undefined, stack)) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  };

  // Override console.error to filter extension errors
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const errorString = args.map(arg => String(arg)).join(' ');
    if (isExtensionError(errorString)) {
      // Suppress extension errors in console
      return;
    }
    originalConsoleError.apply(console, args);
  };

  // Add event listeners with capture phase to catch early
  window.addEventListener('error', handleError, true);
  window.addEventListener('unhandledrejection', handleUnhandledRejection, true);

  // Return cleanup function
  return () => {
    window.removeEventListener('error', handleError, true);
    window.removeEventListener('unhandledrejection', handleUnhandledRejection, true);
    console.error = originalConsoleError;
  };
}







