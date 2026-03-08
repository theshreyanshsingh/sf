/* eslint-env node */
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          function ({ types: t }) {
            return {
              visitor: {
                JSXElement(path, state) {
                  if (
                    !state.file ||
                    !state.file.opts ||
                    !state.file.opts.filename
                  )
                    return;

                  // Skip node_modules
                  if (state.file.opts.filename.includes("node_modules")) return;

                  const location = path.node.loc;
                  if (!location) return;

                  // Get relative path from project root
                  // eslint-disable-next-line no-undef
                  const projectRoot = process.cwd();
                  let relativePath = state.file.opts.filename.replace(
                    projectRoot,
                    ""
                  );
                  if (relativePath.startsWith("/"))
                    relativePath = relativePath.substring(1);

                  const startLine = location.start.line;
                  const endLine = location.end.line;
                  const column = location.start.column;

                  // Format: "filepath:startLine:endLine:column"
                  const superblocksId = `${relativePath}:${startLine}:${endLine}:${column}`;

                  const openingElement = path.get("openingElement");
                  openingElement.pushContainer(
                    "attributes",
                    t.jsxAttribute(
                      t.jsxIdentifier("data-superblocks-id"),
                      t.stringLiteral(superblocksId)
                    )
                  );

                  // Extract and inject source code
                  if (
                    state.file.code &&
                    path.node.start !== undefined &&
                    path.node.end !== undefined
                  ) {
                    const code = state.file.code.slice(
                      path.node.start,
                      path.node.end
                    );
                    openingElement.pushContainer(
                      "attributes",
                      t.jsxAttribute(
                        t.jsxIdentifier("data-superblocks-code"),
                        t.stringLiteral(encodeURIComponent(code))
                      )
                    );
                  }
                },
              },
            };
          },
        ],
      },
    }),
    tailwindcss(),
    inspectorScriptPlugin(),
    iframeEditorPlugin(),
    preBootErrorPlugin(),
    routeMessengerPlugin(),
  ],
  server: {
    host: "0.0.0.0", // Listen on all network interfaces
    port: 3001, // Use port 3001
    strictPort: false, // Try another port if 3001 is in use
    open: false, // Don't auto-open browser
    cors: true, // Enable CORS
  },
  // Preview server configuration
  preview: {
    host: "0.0.0.0",
    port: 3001,
    strictPort: false, // Try another port if 3001 is in use
  },
});

function routeMessengerPlugin() {
  const routeMessengerScript = `
(function () {
  "use strict";

  class RouteMessenger {
    constructor(options) {
      if (!options) options = {};
      this.hasInitialized = false;
      this.options = {
        targetOrigin: "*",
        messageType: "ROUTE_CHANGE",
        includeSearchParams: true,
        sendInitialRoute: true,
        customData: {},
        onlyInIframe: true,
        debug: false,
      };
      for (var key in options) {
        if (options.hasOwnProperty(key)) {
          this.options[key] = options[key];
        }
      }
      this.currentPath = "";
      this.currentSearch = "";
      this.isInIframe = window.self !== window.top;
      this.init();
    }

    init() {
      if (this.options.onlyInIframe && !this.isInIframe) {
        return;
      }
      if (this.options.sendInitialRoute) {
        this.updateRoute();
      }
      this.setupListeners();
    }

    setupListeners() {
      var self = this;
      var originalPushState = history.pushState;
      var originalReplaceState = history.replaceState;

      history.pushState = function () {
        originalPushState.apply(history, arguments);
        setTimeout(function () {
          self.updateRoute();
        }, 0);
      };

      history.replaceState = function () {
        originalReplaceState.apply(history, arguments);
        setTimeout(function () {
          self.updateRoute();
        }, 0);
      };

      window.addEventListener("popstate", function () {
        setTimeout(function () {
          self.updateRoute();
        }, 0);
      });

      window.addEventListener("hashchange", function () {
        setTimeout(function () {
          self.updateRoute();
        }, 0);
      });

      setInterval(function () {
        var newPath = window.location.pathname;
        var newSearch = window.location.search;
        if (newPath !== self.currentPath || newSearch !== self.currentSearch) {
          self.updateRoute();
        }
      }, 1000);

      window.addEventListener("message", function (event) {
        if (event.data && event.data.type === "SUPERBLOCKS_NAVIGATE") {
          var command = event.data.command;
          var url = event.data.url;

          switch (command) {
            case "NAVIGATE":
              if (url) {
                if (url.indexOf("http") === 0) {
                  window.location.assign(url);
                } else {
                  history.pushState({}, "", url);
                  self.updateRoute();
                  window.dispatchEvent(new PopStateEvent("popstate"));
                }
              }
              break;
            case "BACK":
              history.back();
              break;
            case "FORWARD":
              history.forward();
              break;
            case "RELOAD":
              window.location.reload();
              break;
          }
        }
      });
    }

    updateRoute() {
      var pathname = window.location.pathname;
      var search = this.options.includeSearchParams ? window.location.search : "";

      if (
        pathname === this.currentPath &&
        search === this.currentSearch &&
        this.hasInitialized
      ) {
        return;
      }

      this.currentPath = pathname;
      this.currentSearch = search;
      this.sendMessage(pathname, search);
      this.hasInitialized = true;
    }

    sendMessage(pathname, search) {
      var fullUrl = search ? pathname + search : pathname;
      var message = {
        type: this.options.messageType,
        data: {
          pathname: pathname,
          search: search.replace("?", ""),
          fullUrl: fullUrl,
          timestamp: Date.now(),
          origin: window.location.origin,
        },
      };

      for (var key in this.options.customData) {
        if (this.options.customData.hasOwnProperty(key)) {
          message.data[key] = this.options.customData[key];
        }
      }

      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(message, this.options.targetOrigin);
        }
      } catch (error) {
        console.error("[RouteMessenger] Failed to send message:", error);
      }
    }
  }

  function initRouteMessenger(options) {
    return new RouteMessenger(options);
  }

  if (typeof window !== "undefined") {
    var options = {};
    if (window.ROUTE_MESSENGER_CONFIG) {
      for (var key in window.ROUTE_MESSENGER_CONFIG) {
        if (window.ROUTE_MESSENGER_CONFIG.hasOwnProperty(key)) {
          options[key] = window.ROUTE_MESSENGER_CONFIG[key];
        }
      }
    }
    var messenger = initRouteMessenger(options);
    window.routeMessenger = messenger;
    window.initRouteMessenger = initRouteMessenger;
  }
})();
  `;

  return {
    name: "superblocks-route-messenger-plugin",
    transformIndexHtml(html) {
      return html.replace(
        "</body>",
        `<script>${routeMessengerScript}</script></body>`
      );
    },
  };
}

function preBootErrorPlugin() {
  const preBootScript = `
(function () {
  "use strict";

  const inIframe = window.parent !== window;
  let overlayDetected = false;

  function sendToParent(data) {
    if (inIframe) {
      window.parent.postMessage(data, "*");
    }
    console.log("[PRE-BOOT]", data);
  }

  function pollViteOverlay() {
    const overlay = document.querySelector("vite-error-overlay");
    if (overlay && !overlayDetected) {
      overlayDetected = true;
      const shadowRoot = overlay.shadowRoot;
      if (shadowRoot) {
        const messageNode =
          shadowRoot.querySelector(".message-body") ||
          shadowRoot.querySelector(".message") ||
          shadowRoot.querySelector("pre") ||
          shadowRoot.querySelector(".error");

        const errorText =
          messageNode?.textContent ||
          messageNode?.innerHTML ||
          "Unknown build error";

        const pluginNode = shadowRoot.querySelector(".plugin");
        const plugin = pluginNode?.textContent || "unknown";

        sendToParent({
          type: "SUPERBLOCKS_ERRORS",
          errorType: "build_time_error",
          error: {
            message: errorText.trim(),
            source: "vite-overlay-pre-boot",
            plugin: plugin,
            stage: "pre-boot",
          },
          timestamp: Date.now(),
          url: window.location.href,
          userAgent: navigator.userAgent,
        });

        fetch("/api/vite/errors?projectId=default", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: errorText.trim(),
            source: "build-time-vite-overlay",
            url: window.location.href,
            timestamp: new Date().toISOString(),
          }),
        }).catch((err) =>
          console.error("[PRE-BOOT] Failed to send to API:", err)
        );
      }
    }
  }

  // JavaScript runtime errors
  window.addEventListener("error", (e) => {
    // Check if it's a resource loading error (CSS, JS, IMG)
    if (e.target !== window && e.target.tagName) {
      const tagName = e.target.tagName.toLowerCase();
      if (tagName === 'link' || tagName === 'script' || tagName === 'img') {
         sendToParent({
          type: "SUPERBLOCKS_ERRORS",
          errorType: "resource_loading_error",
          error: {
            message: "Failed to load " + tagName + ": " + (e.target.href || e.target.src),
            resourceType: tagName,
            src: e.target.href || e.target.src,
            source: "resource-load-failure",
          },
          timestamp: Date.now(),
          url: window.location.href,
          userAgent: navigator.userAgent,
        });

        fetch("/api/vite/errors?projectId=default", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "Resource load failed: " + tagName + " - " + (e.target.href || e.target.src),
            source: "resource-load-failure",
            url: window.location.href,
            timestamp: new Date().toISOString(),
          }),
        }).catch((err) =>
          console.error("[PRE-BOOT] Failed to send resource error to API:", err)
        );
        return;
      }
    }

    // Regular JavaScript execution errors
    sendToParent({
      type: "SUPERBLOCKS_ERRORS",
      errorType: "pre_boot_error",
      error: {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
        stack: e.error?.stack,
        source: "pre-boot-window.error",
      },
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    });
  }, true); // CAPTURE PHASE to catch resource errors

  window.addEventListener("unhandledrejection", (e) => {
    sendToParent({
      type: "SUPERBLOCKS_ERRORS",
      errorType: "pre_boot_promise_rejection",
      error: {
        message: e.reason?.message || String(e.reason),
        stack: e.reason?.stack,
        source: "pre-boot-promise-rejection",
      },
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    });
  });

  const pollInterval = setInterval(pollViteOverlay, 100);
  setTimeout(() => {
    clearInterval(pollInterval);
  }, 30000);

  sendToParent({
    type: "SUPERBLOCKS_PRE_BOOT_ACTIVE",
    timestamp: Date.now(),
  });

  console.log("[PRE-BOOT] Error detector initialized");
})();
  `;

  return {
    name: "superblocks-pre-boot-error-plugin",
    transformIndexHtml(html) {
      return html.replace("<head>", `<head><script>${preBootScript}</script>`);
    },
  };
}

function inspectorScriptPlugin() {
  const inspectorScript = `
(function () {
  "use strict";

  const CHANNEL = "SUPERBLOCKS_INSPECTOR";
  const BOX_PADDING = 4;

  let hoverBox = null;
  let focusBox = null;
  let lastHitElement = null;
  let focusedElement = null;
  let isInspectorEnabled = false;

  function parseSuperblocksId(id) {
    if (!id) return null;
    const parts = id.split(":");
    if (parts.length < 4) return null;
    const column = parseInt(parts.pop());
    const endLine = parseInt(parts.pop());
    const startLine = parseInt(parts.pop());
    const filePath = parts.join(":");
    if (isNaN(startLine) || isNaN(endLine) || isNaN(column)) return null;
    return { filePath, startLine, endLine, column };
  }

  function createOverlays() {
    const overlay = document.createElement("div");
    overlay.id = "superblocks-inspector-overlay";
    overlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 2147483646; display: none;";

    const hover = document.createElement("div");
    hover.id = "superblocks-hover-box";
    hover.style.cssText = "position: absolute; border: 2px solid #3b82f6; background: rgba(59, 130, 246, 0.1); pointer-events: none; display: none; box-sizing: border-box; transition: all 0.1s ease; border-radius: 2px;";

    const focus = document.createElement("div");
    focus.id = "superblocks-focus-box";
    focus.style.cssText = "position: absolute; border: 2px solid #10b981; background: rgba(16, 185, 129, 0.15); pointer-events: none; display: none; box-sizing: border-box; border-radius: 2px;";

    const hoverLabel = document.createElement("div");
    hoverLabel.id = "superblocks-hover-label";
    hoverLabel.style.cssText = "position: absolute; background: #3b82f6; color: white; padding: 2px 6px; font-size: 11px; font-family: monospace; border-radius: 2px; pointer-events: none; display: none; white-space: nowrap;";

    const focusLabel = document.createElement("div");
    focusLabel.id = "superblocks-focus-label";
    focusLabel.style.cssText = "position: absolute; background: #10b981; color: white; padding: 2px 6px; font-size: 11px; font-family: monospace; border-radius: 2px; pointer-events: none; display: none; white-space: nowrap;";

    overlay.appendChild(hover);
    overlay.appendChild(focus);
    overlay.appendChild(hoverLabel);
    overlay.appendChild(focusLabel);
    (document.body || document.documentElement).appendChild(overlay);
    return { overlay, hover, focus, hoverLabel, focusLabel };
  }

  const overlays = createOverlays();

  function expandBox(rect) {
    return {
      top: rect.top - BOX_PADDING,
      left: rect.left - BOX_PADDING,
      width: rect.width + BOX_PADDING * 2,
      height: rect.height + BOX_PADDING * 2,
    };
  }

  function updateHoverBox(element) {
    if (!element || !isInspectorEnabled) {
      overlays.hover.style.display = "none";
      overlays.hoverLabel.style.display = "none";
      return;
    }
    const rect = element.getBoundingClientRect();
    const box = expandBox(rect);
    overlays.hover.style.top = box.top + "px";
    overlays.hover.style.left = box.left + "px";
    overlays.hover.style.width = box.width + "px";
    overlays.hover.style.height = box.height + "px";
    overlays.hover.style.display = "block";

    const tag = element.tagName.toLowerCase();
    const id = element.id ? "#" + element.id : "";
    const classNameValue = typeof element.className === "string" ? element.className : (element.className?.baseVal || "");
    const className = classNameValue ? "." + classNameValue.split(" ")[0] : "";
    overlays.hoverLabel.textContent = "<" + tag + id + className + ">";
    overlays.hoverLabel.style.top = box.top - 22 + "px";
    overlays.hoverLabel.style.left = box.left + "px";
    overlays.hoverLabel.style.display = "block";
  }

  function updateFocusBox(element) {
    if (!element || !isInspectorEnabled) {
      overlays.focus.style.display = "none";
      overlays.focusLabel.style.display = "none";
      return;
    }
    const rect = element.getBoundingClientRect();
    const box = expandBox(rect);
    overlays.focus.style.top = box.top + "px";
    overlays.focus.style.left = box.left + "px";
    overlays.focus.style.width = box.width + "px";
    overlays.focus.style.height = box.height + "px";
    overlays.focus.style.display = "block";

    const orchidsId = element.getAttribute("data-superblocks-id");
    let labelText = "<" + element.tagName.toLowerCase() + ">";
    if (orchidsId) {
      const parsed = parseSuperblocksId(orchidsId);
      if (parsed) {
        const fileName = parsed.filePath.split("/").pop();
        labelText = fileName + ":" + parsed.startLine + "-" + parsed.endLine;
      }
    }
    overlays.focusLabel.textContent = labelText;
    overlays.focusLabel.style.top = box.top - 22 + "px";
    overlays.focusLabel.style.left = box.left + "px";
    overlays.focusLabel.style.display = "block";
  }

  function isExcludedElement(el) {
    if (el.id && el.id.startsWith("superblocks-")) return true;
    if (el.tagName === "BODY" || el.tagName === "HTML") return true;
    if (el.getAttribute("data-superblocks-watermark") === "true") return true;
    let current = el;
    while (current && current !== document.body) {
      if (current.getAttribute && current.getAttribute("data-superblocks-watermark") === "true") return true;
      current = current.parentElement;
    }
    return false;
  }

  function getElementAtPoint(x, y) {
    const elements = document.elementsFromPoint(x, y);
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (isExcludedElement(el)) continue;
      return el;
    }
    return null;
  }

  function sendToParent(msg) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(msg, "*");
      }
    } catch (e) {
      console.error("[Superblocks Inspector] Failed to send message:", e);
    }
  }

  function enableInspector() {
    isInspectorEnabled = true;
    overlays.overlay.style.display = "block";
    document.body.style.cursor = "crosshair";
    console.log("[Superblocks Inspector] Enabled");
    sendToParent({ type: CHANNEL, msg: "INSPECTOR_ENABLED" });
  }

  function disableInspector() {
    isInspectorEnabled = false;
    overlays.overlay.style.display = "none";
    overlays.hover.style.display = "none";
    overlays.focus.style.display = "none";
    overlays.hoverLabel.style.display = "none";
    overlays.focusLabel.style.display = "none";
    document.body.style.cursor = "";
    lastHitElement = null;
    focusedElement = null;
    console.log("[Superblocks Inspector] Disabled");
    sendToParent({ type: CHANNEL, msg: "INSPECTOR_DISABLED" });
  }

  function toggleInspector() {
    if (isInspectorEnabled) disableInspector();
    else enableInspector();
  }

  function handleMouseMove(e) {
    if (!isInspectorEnabled) return;
    const element = getElementAtPoint(e.clientX, e.clientY);
    if (element !== lastHitElement) {
      lastHitElement = element;
      if (element) {
        updateHoverBox(element);
        const rect = element.getBoundingClientRect();
        const orchidsId = element.getAttribute("data-superblocks-id");
        sendToParent({
          type: CHANNEL,
          msg: "ELEMENT_HOVER",
          id: orchidsId,
          tag: element.tagName.toLowerCase(),
          rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
        });
      } else {
        updateHoverBox(null);
        sendToParent({ type: CHANNEL, msg: "ELEMENT_HOVER", id: null, tag: null, rect: null });
      }
    }
  }

  function handleClick(e) {
    if (!isInspectorEnabled) return;
    const element = getElementAtPoint(e.clientX, e.clientY);
    if (!element) return;
    e.preventDefault();
    e.stopPropagation();
    const orchidsId = element.getAttribute("data-superblocks-id");
    const encodedCode = element.getAttribute("data-superblocks-code");
    const code = encodedCode ? decodeURIComponent(encodedCode) : null;
    
    focusedElement = element;
    updateFocusBox(element);
    const parsed = orchidsId ? parseSuperblocksId(orchidsId) : null;
    sendToParent({
      type: CHANNEL,
      msg: "ELEMENT_CLICKED",
      filePath: parsed?.filePath || null,
      startLine: parsed?.startLine || null,
      endLine: parsed?.endLine || null,
      code: code,
    });
  }

  function updateBoxes() {
    if (!isInspectorEnabled) return;
    if (lastHitElement) updateHoverBox(lastHitElement);
    if (focusedElement) updateFocusBox(focusedElement);
  }

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (data.type === CHANNEL) {
      if (data.msg === "ENABLE_INSPECTOR") enableInspector();
      else if (data.msg === "DISABLE_INSPECTOR") disableInspector();
      else if (data.msg === "TOGGLE_INSPECTOR") toggleInspector();
    }
  });

  document.addEventListener("mousemove", handleMouseMove, true);
  document.addEventListener("click", handleClick, true);
  window.addEventListener("scroll", updateBoxes, true);
  window.addEventListener("resize", updateBoxes);

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "I") {
      e.preventDefault();
      toggleInspector();
    }
  });

  sendToParent({ type: CHANNEL, msg: "INSPECTOR_READY" });
  console.log("[Superblocks Inspector] Initialized");
})();
  `;

  return {
    name: "superblocks-inspector-script",
    transformIndexHtml(html) {
      return html.replace(
        "</body>",
        `<script>${inspectorScript}</script></body>`
      );
    },
  };
}

function iframeEditorPlugin() {
  const editorScript = `
(function () {
  "use strict";

  var EDIT_CHANNEL = "WYSIWYG_EDIT";
  var editableTagNames = [
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "span", "div", "a", "li", "td", "th",
    "label", "button", "strong", "em", "b", "i"
  ];

  let editModeEnabled = false;
  let activeEditElement = null;
  let activeEditOriginal = null;
  let activeEditKeydown = null;
  let cachedSelectionRange = null;
  let lastEditedElement = null; // Keep reference to last edited element for format commands
  let editModeObserver = null; // MutationObserver reference for cleanup

  // Proactive selection caching - called on every selection change
  function cacheSelection() {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    var r = sel.getRangeAt(0);
    if (r.collapsed) return;
    try { 
      cachedSelectionRange = r.cloneRange();
      // Also track the element containing the selection for format commands
      var container = r.commonAncestorContainer;
      var targetEl = container.nodeType === 3 ? container.parentElement : container;
      // Walk up to find a valid editable element
      while (targetEl && targetEl !== document.body) {
        if (editableTagNames.indexOf(targetEl.tagName.toLowerCase()) !== -1) {
          lastEditedElement = targetEl;
          break;
        }
        targetEl = targetEl.parentElement;
      }
      console.log("[WYSIWYG] Selection cached, lastEditedElement:", lastEditedElement ? lastEditedElement.tagName : "null");
    } catch (e) {}
  }

  // Set up proactive selection listeners
  function setupSelectionListeners() {
    document.addEventListener("selectionchange", cacheSelection);
    document.addEventListener("mouseup", cacheSelection, true);
    window.addEventListener("blur", cacheSelection, true);
  }

  function removeSelectionListeners() {
    document.removeEventListener("selectionchange", cacheSelection);
    document.removeEventListener("mouseup", cacheSelection, true);
    window.removeEventListener("blur", cacheSelection, true);
  }

  const styles = \`
    .wysiwyg-edit-mode .wysiwyg-editable {
      cursor: text !important;
      outline: 2px dashed rgba(74, 144, 226, 0.7) !important;
      outline-offset: 2px !important;
      transition: outline 0.15s ease, background 0.15s ease !important;
    }
    .wysiwyg-edit-mode .wysiwyg-editable:hover {
      outline-color: rgba(91, 160, 242, 0.9) !important;
      background: rgba(74, 144, 226, 0.08) !important;
    }
    .wysiwyg-editing-now {
      outline: 2px solid #4a90e2 !important;
      outline-offset: 2px !important;
      background: rgba(74, 144, 226, 0.12) !important;
      cursor: text !important;
    }
    .wysiwyg-edit-toolbar {
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483645;
      display: flex;
      gap: 6px;
      padding: 6px 10px;
      background: rgba(20, 20, 21, 0.96);
      border: 1px solid #2a2a2b;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      font-size: 12px;
    }
    .wysiwyg-edit-toolbar button {
      padding: 6px 12px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      transition: background 0.15s, color 0.15s;
    }
    .wysiwyg-edit-toolbar .save-btn {
      background: #4a90e2;
      color: white;
    }
    .wysiwyg-edit-toolbar .save-btn:hover { background: #5ba0f2; }
    .wysiwyg-edit-toolbar .save-btn:disabled {
      background: #2a2a2b;
      color: #6c6c72;
      cursor: not-allowed;
    }
    .wysiwyg-edit-toolbar .cancel-btn {
      background: transparent;
      color: #b1b1b7;
      border: 1px solid #2a2a2b;
    }
    .wysiwyg-edit-toolbar .cancel-btn:hover {
      background: #2a2a2b;
      color: white;
    }
    .wysiwyg-edit-toolbar .cancel-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  \`;

  function injectStyles() {
    if (document.getElementById("wysiwyg-edit-styles")) return;
    var el = document.createElement("style");
    el.id = "wysiwyg-edit-styles";
    el.textContent = styles;
    document.head.appendChild(el);
  }

  function isExcluded(el) {
    if (!el || !el.getAttribute) return true;
    if (el.id && el.id.indexOf("superblocks-") === 0) return true;
    if (el.id === "wysiwyg-edit-toolbar-wrap" || el.closest && el.closest("#wysiwyg-edit-toolbar-wrap")) return true;
    if (el.getAttribute("data-superblocks-watermark") === "true") return true;
    var cur = el;
    while (cur && cur !== document.body) {
      if (cur.getAttribute && cur.getAttribute("data-superblocks-watermark") === "true") return true;
      cur = cur.parentElement;
    }
    return false;
  }

  function getEditableElements() {
    var list = [];
    editableTagNames.forEach(function (tag) {
      var nodes = document.querySelectorAll(tag);
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (isExcluded(n)) continue;
        if (n.closest && n.closest(".wysiwyg-editable")) continue;
        if (!n.textContent || !n.textContent.trim()) continue;
        if (n.querySelector("script") || n.querySelector("style")) continue;
        list.push(n);
      }
    });
    return list;
  }

  function sendToParent(data) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(data, "*");
      }
    } catch (e) {
      console.error("[WYSIWYG Edit] sendToParent:", e);
    }
  }

  function getSelector(el) {
    if (!el) return "";
    if (el.id) return "#" + el.id;
    var s = el.tagName ? el.tagName.toLowerCase() : "div";
    if (el.className && typeof el.className === "string") {
      var c = el.className.split(/\\s+/).filter(function (x) { return x && x.indexOf("wysiwyg-") !== 0; }).slice(0, 2).join(".");
      if (c) s += "." + c;
    }
    var p = el.parentElement;
    if (p) {
      var idx = Array.prototype.indexOf.call(p.children, el);
      if (idx >= 0) s += ":nth-child(" + (idx + 1) + ")";
    }
    return s;
  }

  function startEditing(el) {
    if (activeEditElement) stopEditing(true);
    activeEditOriginal = el.innerHTML;
    el.contentEditable = "true";
    el.classList.add("wysiwyg-editing-now");
    el.focus();

    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    cachedSelectionRange = range.cloneRange();

    activeEditElement = el;
    lastEditedElement = el; // Keep reference for format commands
    activeEditKeydown = function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        stopEditing(false);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        stopEditing(true);
      }
    };
    el.addEventListener("keydown", activeEditKeydown);
    el.addEventListener("blur", function onBlur() {
      // Don't stop editing if clicking on format buttons or toolbar
      var activeEl = document.activeElement;
      if (activeEl && (
        activeEl.closest && activeEl.closest("#wysiwyg-edit-toolbar-wrap") ||
        activeEl.id && activeEl.id.indexOf("wysiwyg-") === 0
      )) {
        return; // Keep editing active
      }
      el.removeEventListener("blur", onBlur);
      el.removeEventListener("keydown", activeEditKeydown);
      stopEditing(false);
    }, { once: true });
    updateToolbar();
    console.log("[WYSIWYG] Started editing element:", el.tagName);
  }

  // Track if there are unsaved changes
  var hasUnsavedChanges = false;

  function stopEditing(cancel) {
    if (!activeEditElement) return;
    var el = activeEditElement;
    if (activeEditKeydown) {
      el.removeEventListener("keydown", activeEditKeydown);
      activeEditKeydown = null;
    }
    el.contentEditable = "false";
    el.classList.remove("wysiwyg-editing-now");
    var newHtml = el.innerHTML;
    if (cancel) {
      el.innerHTML = activeEditOriginal;
    } else if (newHtml !== activeEditOriginal) {
      // Mark that there are unsaved changes - DON'T send to parent yet
      // Changes will only be sent when Save button is clicked
      hasUnsavedChanges = true;
      console.log("[WYSIWYG] Change tracked (unsaved):", el.tagName);
    }
    // Don't clear lastEditedElement - keep it for format commands
    activeEditElement = null;
    activeEditOriginal = null;
    updateToolbar();
    console.log("[WYSIWYG] Stopped editing, keeping lastEditedElement:", lastEditedElement ? lastEditedElement.tagName : "null");
  }

  function updateToolbar() {
    var wrap = document.getElementById("wysiwyg-edit-toolbar-wrap");
    if (!wrap) return;
    var saveBtn = document.getElementById("wysiwyg-edit-save");
    var cancelBtn = document.getElementById("wysiwyg-edit-cancel");
    // Save button is always enabled in edit mode
    // Cancel button is only enabled when actively editing an element
    if (saveBtn) {
      saveBtn.disabled = false;
      // Visual indicator for unsaved changes
      if (hasUnsavedChanges) {
        saveBtn.textContent = "Save *";
        saveBtn.style.background = "#f59e0b"; // Orange to indicate unsaved
      } else {
        saveBtn.textContent = "Save";
        saveBtn.style.background = "";
      }
    }
    if (cancelBtn) cancelBtn.disabled = !activeEditElement;
  }

  function saveAllChanges() {
    console.log("[WYSIWYG] Saving all changes...");
    
    // If actively editing, stop and save that first
    if (activeEditElement) {
      stopEditing(false);
    }
    
    // Send full page save to parent
    var fullHtml = document.documentElement.outerHTML;
    sendToParent({
      type: "WYSIWYG_CHANGE",
      payload: {
        type: "PAGE_SAVE",
        element: {
          tag: "html",
          selector: "html",
          html: fullHtml,
          fullHtml: fullHtml
        }
      }
    });
    
    // Reset unsaved changes flag
    hasUnsavedChanges = false;
    
    // Update button to show saving state
    var saveBtn = document.getElementById("wysiwyg-edit-save");
    if (saveBtn) {
      saveBtn.textContent = "Saving...";
      saveBtn.style.background = "#6b7280";
      saveBtn.disabled = true;
    }
    
    console.log("[WYSIWYG] Save request sent to parent");
  }

  function createToolbar() {
    if (document.getElementById("wysiwyg-edit-toolbar-wrap")) return;
    var wrap = document.createElement("div");
    wrap.id = "wysiwyg-edit-toolbar-wrap";
    wrap.className = "wysiwyg-edit-toolbar";
    wrap.innerHTML = "<button id=\\"wysiwyg-edit-save\\" class=\\"save-btn\\">Save</button><button id=\\"wysiwyg-edit-cancel\\" class=\\"cancel-btn\\" disabled>Cancel</button>";
    document.body.appendChild(wrap);
    document.getElementById("wysiwyg-edit-save").addEventListener("click", function (e) { 
      e.preventDefault();
      e.stopPropagation();
      saveAllChanges(); 
    });
    document.getElementById("wysiwyg-edit-cancel").addEventListener("click", function (e) { 
      e.preventDefault();
      e.stopPropagation();
      stopEditing(true); 
    });
  }

  function removeToolbar() {
    var wrap = document.getElementById("wysiwyg-edit-toolbar-wrap");
    if (wrap) wrap.remove();
  }

  function handleClick(e) {
    if (!editModeEnabled) return;
    
    // If already editing, allow normal cursor placement
    if (activeEditElement) {
      // Check if clicking outside the active element
      var t = e.target;
      if (t && activeEditElement.contains && !activeEditElement.contains(t) && 
          t.closest && !t.closest("#wysiwyg-edit-toolbar-wrap")) {
        // Click outside, stop editing
        stopEditing(false);
      }
      return;
    }
    
    var t = e.target;
    if (!t || !t.closest) return;
    
    // Ignore clicks on toolbar
    if (t.closest("#wysiwyg-edit-toolbar-wrap")) return;
    
    var el = t.closest(".wysiwyg-editable");
    
    // If not found by class, try to find by tag name
    if (!el) {
      var current = t;
      while (current && current !== document.body) {
        if (isExcluded(current)) {
          current = current.parentElement;
          continue;
        }
        var tag = current.tagName ? current.tagName.toLowerCase() : "";
        if (editableTagNames.indexOf(tag) !== -1 && current.textContent && current.textContent.trim()) {
          el = current;
          // Add the class if missing
          if (!el.classList.contains("wysiwyg-editable")) {
            el.classList.add("wysiwyg-editable");
          }
          break;
        }
        current = current.parentElement;
      }
    }
    
    if (!el || isExcluded(el)) {
      console.log("[WYSIWYG] Click handler: element excluded or not found. target:", t.tagName, "closest:", !!t.closest(".wysiwyg-editable"));
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    console.log("[WYSIWYG] Starting edit on element:", el.tagName, el.className);
    startEditing(el);
  }

  function handleMouseUp(e) {
    if (!editModeEnabled || activeEditElement) return;
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    var range = sel.getRangeAt(0);
    if (range.collapsed) return;
    var container = range.commonAncestorContainer;
    var el = container.nodeType === 3 ? container.parentElement : container;
    if (!el || !el.tagName || isExcluded(el)) return;
    while (el && el !== document.body) {
      if (isExcluded(el)) return;
      var tag = el.tagName ? el.tagName.toLowerCase() : "";
      if (editableTagNames.indexOf(tag) !== -1 && el.textContent && el.textContent.trim()) break;
      el = el.parentElement;
    }
    if (!el || el === document.body) return;
    e.preventDefault();
    e.stopPropagation();
    if (!el.classList.contains("wysiwyg-editable")) el.classList.add("wysiwyg-editable");
    startEditing(el);
    try {
      sel.removeAllRanges();
      sel.addRange(range);
      cachedSelectionRange = range.cloneRange();
    } catch (_) {}
  }

  function enableEditMode() {
    if (editModeEnabled) {
      console.log("[WYSIWYG] Edit mode already enabled, refreshing elements");
      // Refresh editable elements
      var els = getEditableElements();
      els.forEach(function (el) {
        if (!el.classList.contains("wysiwyg-editable")) {
          el.classList.add("wysiwyg-editable");
          el.addEventListener("click", handleClick, true);
        }
      });
      return;
    }
    editModeEnabled = true;
    injectStyles();
    createToolbar();
    setupSelectionListeners(); // Set up proactive selection caching
    document.documentElement.classList.add("wysiwyg-edit-mode");
    var els = getEditableElements();
    console.log("[WYSIWYG] Found", els.length, "editable elements");
    els.forEach(function (el) {
      if (!el.classList.contains("wysiwyg-editable")) {
        el.classList.add("wysiwyg-editable");
        el.addEventListener("click", handleClick, true);
        console.log("[WYSIWYG] Made element editable:", el.tagName, el.textContent ? el.textContent.substring(0, 30) : "");
      }
    });
    document.addEventListener("mouseup", handleMouseUp, true);
    sendToParent({ type: EDIT_CHANNEL, msg: "EDIT_ENABLED" });
    console.log("[WYSIWYG] Edit mode enabled");
    
    // Watch for dynamically added elements - store reference for cleanup
    if (typeof MutationObserver !== "undefined") {
      if (editModeObserver) {
        editModeObserver.disconnect();
      }
      editModeObserver = new MutationObserver(function(mutations) {
        if (!editModeEnabled) return;
        mutations.forEach(function(mutation) {
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === 1) { // Element node
              var tag = node.tagName ? node.tagName.toLowerCase() : "";
              if (editableTagNames.indexOf(tag) !== -1 && !isExcluded(node) && node.textContent && node.textContent.trim()) {
                if (!node.classList.contains("wysiwyg-editable")) {
                  node.classList.add("wysiwyg-editable");
                  node.addEventListener("click", handleClick, true);
                  console.log("[WYSIWYG] Added editable class to new element:", tag);
                }
              }
              // Check children
              if (node.querySelectorAll) {
                var children = node.querySelectorAll(editableTagNames.join(","));
                for (var i = 0; i < children.length; i++) {
                  var child = children[i];
                  if (!isExcluded(child) && child.textContent && child.textContent.trim() && 
                      !child.classList.contains("wysiwyg-editable")) {
                    child.classList.add("wysiwyg-editable");
                    child.addEventListener("click", handleClick, true);
                  }
                }
              }
            }
          });
        });
      });
      editModeObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  function disableEditMode() {
    if (!editModeEnabled) return;
    editModeEnabled = false;
    
    // Stop any active editing first
    if (activeEditElement) stopEditing(true);
    
    // Disconnect MutationObserver
    if (editModeObserver) {
      editModeObserver.disconnect();
      editModeObserver = null;
    }
    
    // Remove selection listeners
    removeSelectionListeners();
    
    // Clear all state
    activeEditElement = null;
    activeEditOriginal = null;
    activeEditKeydown = null;
    lastEditedElement = null;
    cachedSelectionRange = null;
    hasUnsavedChanges = false; // Reset unsaved changes flag
    
    // Remove all edit mode classes and contenteditable
    document.documentElement.classList.remove("wysiwyg-edit-mode");
    document.querySelectorAll(".wysiwyg-editable, .wysiwyg-editing-now").forEach(function (el) {
      el.classList.remove("wysiwyg-editable", "wysiwyg-editing-now");
      el.removeAttribute("contenteditable");
      el.removeEventListener("click", handleClick, true);
    });
    
    // Remove event listeners
    document.removeEventListener("mouseup", handleMouseUp, true);
    
    // Remove toolbar
    removeToolbar();
    
    // Remove injected styles
    var styleEl = document.getElementById("wysiwyg-edit-styles");
    if (styleEl && styleEl.parentNode) {
      styleEl.parentNode.removeChild(styleEl);
    }
    
    sendToParent({ type: EDIT_CHANNEL, msg: "EDIT_DISABLED" });
    console.log("[WYSIWYG] Edit mode disabled completely");
  }

  window.addEventListener("message", function (ev) {
    var d = ev.data;
    if (!d) return;
    
    if (d.type === "WYSIWYG_EDIT_MODE") {
      if (d.enabled) enableEditMode();
      else disableEditMode();
      return;
    }
    
    if (d.type === "WYSIWYG_SAVED") {
      // Parent confirmed save was successful
      console.log("[WYSIWYG] Save confirmed by parent");
      var saveBtn = document.getElementById("wysiwyg-edit-save");
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Saved!";
        saveBtn.style.background = "#10b981";
        setTimeout(function() {
          saveBtn.textContent = "Save";
          saveBtn.style.background = "";
          updateToolbar(); // Restore normal state
        }, 2000);
      }
      return;
    }
    
    if (d.type === "WYSIWYG_CACHE_SELECTION") {
      cacheSelection();
      return;
    }
    
    if (d.type === "WYSIWYG_INSERT_BLOCK") {
      handleInsertBlock(d.payload);
      return;
    }
    
    if (d.type === "WYSIWYG_FORMAT") {
      var payload = d.payload || {};
      var cmd = payload.command;
      var val = payload.value;
      var allowed = ["bold", "italic", "underline", "strikeThrough", "insertUnorderedList", "insertOrderedList", "removeFormat", "formatBlock"];
      
      if (!cmd || allowed.indexOf(cmd) === -1) {
        console.warn("[WYSIWYG] Invalid format command:", cmd);
        return;
      }

      console.log("[WYSIWYG] Format command received:", cmd, "activeEditElement:", !!activeEditElement);
      window.focus();
      
      var sel = window.getSelection();
      var hasSelection = sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed;
      var editableElement = null;
      var rangeToUse = null;

      // Strategy 1: If we have an active editing element, use it
      if (activeEditElement && activeEditElement.parentNode && 
          (activeEditElement.contentEditable === "true" || activeEditElement.getAttribute("contenteditable") === "true")) {
        editableElement = activeEditElement;
        editableElement.focus();
        
        // Restore or create selection
        if (cachedSelectionRange) {
          try {
            sel.removeAllRanges();
            sel.addRange(cachedSelectionRange);
            hasSelection = true;
            rangeToUse = cachedSelectionRange;
          } catch (e) {
            // Cached range invalid, select all
            var range = document.createRange();
            range.selectNodeContents(editableElement);
            sel.removeAllRanges();
            sel.addRange(range);
            hasSelection = true;
            rangeToUse = range;
            cachedSelectionRange = range.cloneRange();
          }
        } else if (!hasSelection) {
          // Select all if no selection
          var range = document.createRange();
          range.selectNodeContents(editableElement);
          sel.removeAllRanges();
          sel.addRange(range);
          hasSelection = true;
          rangeToUse = range;
          cachedSelectionRange = range.cloneRange();
        } else {
          rangeToUse = sel.getRangeAt(0);
        }
      }
      // Strategy 1b: Use last edited element if activeEditElement is null (blurred but still valid)
      else if (lastEditedElement && lastEditedElement.parentNode && !isExcluded(lastEditedElement)) {
        editableElement = lastEditedElement;
        // Re-enable editing
        if (editableElement.contentEditable !== "true") {
          editableElement.contentEditable = "true";
          editableElement.classList.add("wysiwyg-editing-now");
          activeEditElement = editableElement;
          activeEditOriginal = editableElement.innerHTML;
        }
        editableElement.focus();
        
        // Create selection
        var range = document.createRange();
        range.selectNodeContents(editableElement);
        sel.removeAllRanges();
        sel.addRange(range);
        hasSelection = true;
        rangeToUse = range;
        cachedSelectionRange = range.cloneRange();
        console.log("[WYSIWYG] Using last edited element for format:", editableElement.tagName);
      }
      // Strategy 2: If there's a text selection, use it
      else if (hasSelection) {
        rangeToUse = sel.getRangeAt(0);
        var container = rangeToUse.commonAncestorContainer;
        var target = container.nodeType === 3 ? container.parentElement : container;

        // Walk up to find the closest valid editable tag
        editableElement = target;
        while (editableElement && editableElement !== document.body) {
          if (editableTagNames.indexOf(editableElement.tagName.toLowerCase()) !== -1) {
            break;
          }
          editableElement = editableElement.parentElement;
        }
        
        // Restore cached selection if available
        if (cachedSelectionRange) {
          try {
            sel.removeAllRanges();
            sel.addRange(cachedSelectionRange);
            rangeToUse = cachedSelectionRange;
          } catch (e) {
            // Use current selection
          }
        }
      }
      // Strategy 3: If no selection but we're in edit mode, find or create an editable element
      else if (editModeEnabled) {
        // Priority 1: use activeEditElement if it exists (even if not currently contentEditable)
        if (activeEditElement && activeEditElement.parentNode) {
          editableElement = activeEditElement;
          // Re-enable if needed
          if (editableElement.contentEditable !== "true") {
            editableElement.contentEditable = "true";
            editableElement.classList.add("wysiwyg-editing-now");
          }
        }
        // Priority 2: use lastEditedElement (most recently edited element)
        else if (lastEditedElement && lastEditedElement.parentNode && !isExcluded(lastEditedElement)) {
          editableElement = lastEditedElement;
          console.log("[WYSIWYG] Using lastEditedElement for format:", editableElement.tagName);
          // Re-enable editing
          if (editableElement.contentEditable !== "true") {
            editableElement.contentEditable = "true";
            editableElement.classList.add("wysiwyg-editing-now");
            activeEditElement = editableElement;
            activeEditOriginal = editableElement.innerHTML;
          }
        }
        // Priority 3: Try to find focused element
        else {
          var focused = document.activeElement;
          if (focused && editableTagNames.indexOf(focused.tagName.toLowerCase()) !== -1 && 
              !isExcluded(focused)) {
            editableElement = focused;
            lastEditedElement = focused; // Update reference
          } else {
            // Find any editable element that's visible
            var editableElements = document.querySelectorAll(".wysiwyg-editable");
            for (var i = 0; i < editableElements.length; i++) {
              var el = editableElements[i];
              if (!isExcluded(el) && el.offsetWidth > 0 && el.offsetHeight > 0) {
                editableElement = el;
                lastEditedElement = el; // Update reference
                break;
              }
            }
          }
        }
        
        if (editableElement) {
          // Make it editable and select all
          if (editableElement.contentEditable !== "true") {
            editableElement.contentEditable = "true";
            editableElement.classList.add("wysiwyg-editable", "wysiwyg-editing-now");
            activeEditElement = editableElement;
            activeEditOriginal = editableElement.innerHTML;
          }
          editableElement.focus();
          var range = document.createRange();
          range.selectNodeContents(editableElement);
          sel.removeAllRanges();
          sel.addRange(range);
          hasSelection = true;
          rangeToUse = range;
          cachedSelectionRange = range.cloneRange();
          console.log("[WYSIWYG] Created selection for format on element:", editableElement.tagName);
        } else {
          console.warn("[WYSIWYG] No editable element found for format command");
        }
      }

      // Apply format if we have a valid selection
      if (hasSelection && rangeToUse && editableElement) {
        try {
          // Ensure selection is active
          if (sel.rangeCount === 0 || sel.getRangeAt(0) !== rangeToUse) {
            sel.removeAllRanges();
            sel.addRange(rangeToUse);
          }

          // Apply format command
          var success = document.execCommand(cmd, false, val || null);
          console.log("[WYSIWYG] Format applied:", cmd, "success:", success, "on element:", editableElement.tagName);

          // Cache the new selection
          if (sel.rangeCount > 0) {
            try {
              cachedSelectionRange = sel.getRangeAt(0).cloneRange();
            } catch (e) {}
          }

          // Update active edit element and last edited reference
          if (!activeEditElement && editableElement.contentEditable === "true") {
            activeEditElement = editableElement;
            activeEditOriginal = editableElement.innerHTML;
          }
          // Always update lastEditedElement so format commands work even after blur
          lastEditedElement = editableElement;
          
          // Keep element editable for subsequent format commands
          if (editableElement.contentEditable !== "true") {
            editableElement.contentEditable = "true";
            editableElement.classList.add("wysiwyg-editing-now");
          }

          // Mark as having unsaved changes - DON'T send to parent yet
          // Changes will only be saved when Save button is clicked
          hasUnsavedChanges = true;
          updateToolbar();
        } catch (e) {
          console.error("[WYSIWYG] execCommand error:", e);
        }
      } else {
        console.warn("[WYSIWYG] No valid selection/element for format command. hasSelection:", hasSelection, "editableElement:", !!editableElement, "editModeEnabled:", editModeEnabled);
      }
    }
  });

  // Handle block insertion from drag & drop or click
  function handleInsertBlock(payload) {
    console.log("[WYSIWYG] Handling block insertion", payload);
    if (!payload) return;
    
    var html = payload.html;
    var position = payload.position || "prepend";
    var dropY = payload.dropY;
    
    if (!html) {
      console.error("[WYSIWYG] No HTML provided for block insertion");
      return;
    }
    
    // Create block from HTML
    var tempDiv = document.createElement("div");
    tempDiv.innerHTML = html.trim();
    var newBlock = tempDiv.firstElementChild;
    
    if (!newBlock) {
      console.error("[WYSIWYG] Could not create block from HTML");
      return;
    }
    
    // Find insertion point
    var insertionPoint = null;
    var insertPosition = position;
    
    // If dropY is provided, find element at that position for visual placement
    if (typeof dropY === "number" && dropY > 0) {
      var centerX = window.innerWidth / 2;
      var elements = document.elementsFromPoint(centerX, dropY);
      
      for (var i = 0; i < elements.length; i++) {
        var el = elements[i];
        // Skip body, html, and WYSIWYG UI elements
        if (el === document.body || el === document.documentElement) continue;
        if (el.id && el.id.indexOf("wysiwyg-") === 0) continue;
        if (el.id && el.id.indexOf("superblocks-") === 0) continue;
        if (el.getAttribute && el.getAttribute("data-superblocks-watermark") === "true") continue;
        if (el.closest && el.closest("#wysiwyg-edit-toolbar-wrap")) continue;
        
        // Found a valid element - insert relative to it
        insertionPoint = el;
        
        // Determine if we should insert before or after based on mouse position
        var rect = el.getBoundingClientRect();
        var midY = rect.top + rect.height / 2;
        insertPosition = dropY < midY ? "before" : "after";
        
        console.log("[WYSIWYG] Drop target found:", el.tagName, "position:", insertPosition);
        break;
      }
    }
    
    // Fallback to standard insertion points
    if (!insertionPoint) {
      insertionPoint = document.querySelector("main") ||
        document.getElementById("root") ||
        document.getElementById("__next") ||
        document.querySelector("article") ||
        document.querySelector("section:not([data-superblocks-watermark])") ||
        document.body;
      console.log("[WYSIWYG] Using fallback insertion point:", insertionPoint.tagName);
    }
    
    // Insert the block
    try {
      if (insertPosition === "after" && insertionPoint.parentElement) {
        insertionPoint.parentElement.insertBefore(newBlock, insertionPoint.nextSibling);
      } else if (insertPosition === "before" && insertionPoint.parentElement) {
        insertionPoint.parentElement.insertBefore(newBlock, insertionPoint);
      } else if (insertPosition === "append") {
        insertionPoint.appendChild(newBlock);
      } else {
        // prepend
        if (insertionPoint === document.body) {
          insertionPoint.insertBefore(newBlock, insertionPoint.firstChild);
        } else if (insertionPoint.prepend) {
          insertionPoint.prepend(newBlock);
        } else {
          insertionPoint.insertBefore(newBlock, insertionPoint.firstChild);
        }
      }
      
      console.log("[WYSIWYG] Block inserted successfully");
      
      // Scroll into view
      try {
        newBlock.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch (e) {}
      
      // Highlight the new block briefly
      newBlock.style.outline = "3px solid #4a90e2";
      newBlock.style.outlineOffset = "4px";
      setTimeout(function() {
        newBlock.style.outline = "";
        newBlock.style.outlineOffset = "";
      }, 1500);
      
      // Make children editable if in edit mode
      if (editModeEnabled) {
        setTimeout(function() {
          var makeEditable = function(el) {
            if (!el || !el.tagName) return;
            var tag = el.tagName.toLowerCase();
            if (editableTagNames.indexOf(tag) !== -1 && !isExcluded(el)) {
              if (!el.classList.contains("wysiwyg-editable")) {
                el.classList.add("wysiwyg-editable");
                el.addEventListener("click", handleClick, true);
              }
            }
            var children = el.children || [];
            for (var i = 0; i < children.length; i++) {
              makeEditable(children[i]);
            }
          };
          makeEditable(newBlock);
          console.log("[WYSIWYG] Block children made editable");
        }, 100);
      }
      
      // Mark as having unsaved changes - DON'T send to parent
      // Changes will only be saved when Save button is clicked
      hasUnsavedChanges = true;
      updateToolbar();
      console.log("[WYSIWYG] Block inserted - marked as unsaved");
      
    } catch (e) {
      console.error("[WYSIWYG] Error inserting block:", e);
    }
  }

  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && editModeEnabled && !activeEditElement) {
      disableEditMode();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      sendToParent({ type: "WYSIWYG_SCRIPT_READY" });
    });
  } else {
    sendToParent({ type: "WYSIWYG_SCRIPT_READY" });
  }
  console.log("[WYSIWYG Edit] Initialized, use postMessage WYSIWYG_EDIT_MODE { enabled } to toggle");
})();
  `;

  return {
    name: "superblocks-iframe-editor",
    transformIndexHtml(html) {
      return html.replace(
        "</body>",
        "<script>" + editorScript + "</script></body>"
      );
    },
  };
}

function superblocksBadgePlugin() {
  const badgeScript = `
(function () {
  "use strict";

  function createBadge() {
    const badge = document.createElement("div");
    badge.id = "superblocks-badge";
    badge.setAttribute("data-superblocks-watermark", "true");
    badge.setAttribute("aria-label", "Made by Superblocks");
    
    const text = document.createElement("span");
    text.textContent = "Made by Superblocks";
    text.style.fontWeight = "500";
    text.style.letterSpacing = "0.3px";
    badge.appendChild(text);

    const getStyles = () => \`
      position: fixed !important;
      bottom: 16px !important;
      right: 16px !important;
      padding: 4px 12px !important;
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%) !important;
      background-image: 
        repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,.03) 2px, rgba(255,255,255,.03) 4px),
        linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%) !important;
      color: white !important;
      font-size: 11px !important;
      font-family: system-ui, -apple-system, sans-serif !important;
      border-radius: 6px !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), 0 1px 3px rgba(0, 0, 0, 0.3) !important;
      cursor: pointer !important;
      z-index: 2147483647 !important;
      text-decoration: none !important;
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
      transition: all 0.2s ease !important;
      user-select: none !important;
      -webkit-user-select: none !important;
      pointer-events: auto !important;
      visibility: visible !important;
      opacity: 1 !important;
    \`;

    badge.style.cssText = getStyles();

    badge.addEventListener("click", (e) => {
      e.preventDefault();
      window.open("https://superblocks.com", "_blank", "noopener,noreferrer");
    });

    badge.addEventListener("mouseenter", () => {
      badge.style.outline = "2px solid #2daa7f";
      badge.style.outlineOffset = "2px";
    });

    badge.addEventListener("mouseleave", () => {
      badge.style.outline = "none";
      badge.style.outlineOffset = "0";
    });

    document.body.appendChild(badge);

    // Tamper protection
    setInterval(() => {
      if (document.body.contains(badge)) {
        const computed = window.getComputedStyle(badge);
        if (
          computed.display === "none" ||
          computed.visibility === "hidden" ||
          computed.opacity === "0"
        ) {
          badge.style.cssText = getStyles();
        }
      } else {
        document.body.appendChild(badge);
      }
    }, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createBadge);
  } else {
    createBadge();
  }
})();
  `;

  return {
    name: "superblocks-badge-plugin",
    transformIndexHtml(html) {
      return html.replace("</body>", `<script>${badgeScript}</script></body>`);
    },
  };
}
