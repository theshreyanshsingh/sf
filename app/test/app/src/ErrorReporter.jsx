import React, { Component, useEffect, useRef } from "react";

/**
 * SILENT ERROR REPORTER
 * Captures errors and communicates them via postMessage without displaying UI.
 *
 * Error Types Captured:
 * 1. React Component Errors (via ErrorBoundary)
 * 2. JavaScript Runtime Errors (window.onerror)
 * 3. Unhandled Promise Rejections
 * 4. Vite Dev Overlay Errors
 */

// ==================== ERROR BOUNDARY ====================
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  // eslint-disable-next-line no-unused-vars
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    const errorData = {
      type: "SUPERBLOCKS_ERRORS",
      errorType: "react_component_error",
      error: {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        source: "ErrorBoundary",
      },
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    // Send to parent via postMessage
    if (window.parent !== window) {
      window.parent.postMessage(errorData, "*");
    }

    // Send to API
    this.sendToAPI(errorData);
  }

  async sendToAPI(errorData) {
    try {
      await fetch("/api/vite/errors?projectId=default", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: errorData.error.message,
          stack: errorData.error.stack,
          source: errorData.error.source,
          componentStack: errorData.error.componentStack,
          url: errorData.url,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.error("[ErrorBoundary] Failed to send to API:", err);
    }
  }

  render() {
    // Render children normally even if error occurs (or return null if you want to hide broken parts)
    // Since we want "silent" reporting, we usually just render children.
    // However, if the error is critical, React might unmount the tree anyway.
    // For a true "silent" reporter that keeps the app running if possible, we return children.
    // If the error prevents rendering, we return null to avoid crashing the whole app.
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

// ==================== GLOBAL ERROR LISTENER ====================
function GlobalErrorListener() {
  const lastViteOverlayMsg = useRef("");
  const pollRef = useRef(null);

  useEffect(() => {
    const inIframe = window.parent !== window;

    // Centralized error handler
    const handleError = (errorData) => {
      // Send to parent via postMessage with SUPERBLOCKS_ERRORS type
      if (inIframe) {
        window.parent.postMessage(errorData, "*");
      }

      // Log to console
      console.error("[SUPERBLOCKS_ERRORS]", errorData);

      // Send to API
      sendToAPI(errorData);
    };

    const sendToAPI = async (errorData) => {
      try {
        await fetch("/api/vite/errors?projectId=default", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: errorData.error.message,
            stack: errorData.error.stack,
            source: errorData.error.source || errorData.error.filename,
            lineno: errorData.error.lineno,
            colno: errorData.error.colno,
            url: errorData.url,
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (err) {
        console.error("[ErrorReporter] Failed to send to API:", err);
      }
    };

    // 1. Global JavaScript Errors AND Resource Loading Errors
    const onError = (e) => {
      // Check if it's a resource loading error (CSS, JS, IMG)
      if (e.target !== window && e.target?.tagName) {
        const tagName = e.target.tagName.toLowerCase();
        if (tagName === "link" || tagName === "script" || tagName === "img") {
          handleError({
            type: "SUPERBLOCKS_ERRORS",
            errorType: "resource_loading_error",
            error: {
              message: `Failed to load ${tagName}: ${
                e.target.href || e.target.src
              }`,
              resourceType: tagName,
              src: e.target.href || e.target.src,
              source: "resource-load-failure",
            },
            timestamp: Date.now(),
            url: window.location.href,
            userAgent: navigator.userAgent,
          });
          return;
        }
      }

      // Regular JavaScript execution errors
      handleError({
        type: "SUPERBLOCKS_ERRORS",
        errorType: "javascript_runtime_error",
        error: {
          message: e.message,
          stack: e.error?.stack,
          filename: e.filename,
          lineno: e.lineno,
          colno: e.colno,
          source: "window.onerror",
        },
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      });
    };

    // 2. Unhandled Promise Rejections
    const onReject = (e) => {
      handleError({
        type: "SUPERBLOCKS_ERRORS",
        errorType: "unhandled_promise_rejection",
        error: {
          message: e.reason?.message ?? String(e.reason),
          stack: e.reason?.stack,
          source: "unhandledrejection",
        },
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      });
    };

    // 3. Vite Dev Overlay Errors (module/import errors)
    const pollViteOverlay = () => {
      const overlay = document.querySelector("vite-error-overlay");
      if (!overlay) return;

      const shadowRoot = overlay.shadowRoot;
      if (!shadowRoot) return;

      const errorNode = shadowRoot.querySelector(
        ".message-body, .message, pre, .error"
      );
      const txt = errorNode?.textContent || errorNode?.innerHTML || "";

      if (txt && txt !== lastViteOverlayMsg.current) {
        lastViteOverlayMsg.current = txt;

        handleError({
          type: "SUPERBLOCKS_ERRORS",
          errorType: "vite_module_error",
          error: {
            message: txt,
            source: "vite-dev-overlay",
          },
          timestamp: Date.now(),
          url: window.location.href,
          userAgent: navigator.userAgent,
        });
      }
    };

    // 4. Custom API Errors
    const onApiError = (e) => {
      const detail = e.detail || {};
      handleError({
        type: "SUPERBLOCKS_ERRORS",
        errorType: "api_request_error",
        error: {
          message: detail.error || "Unknown API Error",
          endpoint: detail.endpoint,
          status: detail.status,
          source: "api-client",
        },
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      });
    };

    // Register listeners with CAPTURE PHASE for resource errors
    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onReject);
    window.addEventListener("SUPERBLOCKS_API_ERROR", onApiError);
    pollRef.current = setInterval(pollViteOverlay, 1000);

    // Notify parent that error reporter is ready
    if (inIframe) {
      window.parent.postMessage(
        {
          type: "SUPERBLOCKS_ERROR_REPORTER_READY",
          timestamp: Date.now(),
        },
        "*"
      );
    }

    console.log("[SUPERBLOCKS_ERRORS] Silent error reporter initialized");

    // Cleanup
    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onReject);
      window.removeEventListener("SUPERBLOCKS_API_ERROR", onApiError);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  return null; // No UI
}

// ==================== MAIN EXPORT ====================
export default function ErrorReporter({ children }) {
  return (
    <ErrorBoundary>
      <GlobalErrorListener />
      {children}
    </ErrorBoundary>
  );
}
