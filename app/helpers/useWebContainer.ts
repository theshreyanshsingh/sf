// Add TypeScript declaration for window properties
declare global {
  interface Window {
    terminalInterrupt: () => Promise<boolean>;
    executeTerminalCommand?: (
      command: string
    ) => Promise<{ success: boolean; output: string }>;
    executeClaudeCommand?: (
      command: string
    ) => Promise<{ success: boolean; output: string }>;
    terminalIsBusy: boolean;
    terminalReady: boolean;
    terminalCurrentDir: string;
    webcontainer: WebContainer;
    webcontainerGlobal: WebContainer;
    getWebContainerInstance: () => void;
    addTerminal: (customName?: string) => string;
    isTerminalReady: (terminalId: string) => boolean;
    waitForTerminalReady: (
      terminalId: string,
      timeout?: number
    ) => Promise<boolean>;
    removeTerminal: (terminalId: string) => boolean;
    getTerminalList: () => string[];
  }
}

import type { FileSystemTree, WebContainer } from "@webcontainer/api";
import { useCallback, useRef, useState, useEffect } from "react";
import type { Terminal } from "@xterm/xterm";
import { useDispatch } from "react-redux";
import { usePathname } from "next/navigation";
import {
  setprojectFiles,
  setNewProjectData,
} from "../redux/reducers/projectFiles";
import { setPreviewUrl } from "../redux/reducers/projectOptions";
// import indexHtml from '@/public/index.html';

let webcontainerInstance: WebContainer | null = null;

let initializationPromise: Promise<WebContainer> | null = null;

const WEB_CONTAINER_SINGLETON_KEY = "__superblocksWebContainerSingleton__";

type WebContainerSingletonState = {
  instance: WebContainer | null;
  initializationPromise: Promise<WebContainer> | null;
};

type MutableFileTreeNode = {
  file?: {
    contents: string;
  };
  directory?: Record<string, MutableFileTreeNode>;
};

const getWebContainerSingleton = (): WebContainerSingletonState | null => {
  if (typeof window === "undefined") return null;
  const singletonHost = window as Window & {
    [WEB_CONTAINER_SINGLETON_KEY]?: WebContainerSingletonState;
  };
  if (!singletonHost[WEB_CONTAINER_SINGLETON_KEY]) {
    singletonHost[WEB_CONTAINER_SINGLETON_KEY] = {
      instance: null,
      initializationPromise: null,
    };
  }
  return singletonHost[WEB_CONTAINER_SINGLETON_KEY] ?? null;
};

const restoreWebContainerSingletonState = () => {
  const singleton = getWebContainerSingleton();
  if (!singleton) return;
  const legacyHost = window as unknown as {
    webcontainer?: WebContainer;
    webcontainerGlobal?: WebContainer;
  };
  if (!singleton.instance && legacyHost.webcontainerGlobal) {
    singleton.instance = legacyHost.webcontainerGlobal;
  } else if (!singleton.instance && legacyHost.webcontainer) {
    singleton.instance = legacyHost.webcontainer;
  }
  webcontainerInstance = singleton.instance;
  initializationPromise = singleton.initializationPromise;
};

const persistWebContainerSingletonState = () => {
  const singleton = getWebContainerSingleton();
  if (!singleton) return;
  singleton.instance = webcontainerInstance;
  singleton.initializationPromise = initializationPromise;
  const legacyHost = window as unknown as {
    webcontainer?: WebContainer;
    webcontainerGlobal?: WebContainer;
    getWebContainerInstance?: () => void;
  };
  if (webcontainerInstance) {
    legacyHost.webcontainer = webcontainerInstance;
    legacyHost.webcontainerGlobal = webcontainerInstance;
  }
  legacyHost.getWebContainerInstance = () => {};
};

const clearWebContainerSingletonState = () => {
  const singleton = getWebContainerSingleton();
  if (!singleton) return;
  singleton.instance = null;
  singleton.initializationPromise = null;
  const legacyHost = window as unknown as {
    webcontainer?: WebContainer;
    webcontainerGlobal?: WebContainer;
    getWebContainerInstance?: () => void;
  };
  legacyHost.webcontainer = undefined;
  legacyHost.webcontainerGlobal = undefined;
  legacyHost.getWebContainerInstance = () => {};
};

const teardownWebContainerInstance = (reason: string) => {
  restoreWebContainerSingletonState();
  if (!webcontainerInstance) {
    initializationPromise = null;
    clearWebContainerSingletonState();
    return;
  }

  try {
    webcontainerInstance.teardown();
    console.warn(`[WebContainer] teardown called (${reason})`);
  } catch (teardownError) {
    console.warn("[WebContainer] teardown failed:", teardownError);
  }

  webcontainerInstance = null;
  initializationPromise = null;
  clearWebContainerSingletonState();
};

restoreWebContainerSingletonState();

const files = {
  "index.html": {
    file: {
      contents: "",
    },
  },

  "package.json": {
    file: {
      contents: `{
  "name": "grapesjs-webcontainer",
  "type": "module",
  "scripts": {
    "start": "node proxy.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "serve-index": "^1.9.1",
    "morgan":"latest"
  }
}`,
    },
  },

  "proxy.js": {
    file: {
      contents: `
      import express from 'express';
import path from 'path';
import serveIndex from 'serve-index';
import morgan from 'morgan';
import fs from 'fs'; // Add this import for file system access

const PORT = 8080;
const app = express();

// Add morgan middleware for request logging
app.use(morgan('dev'));

// CORS middleware - allow all origins for WebContainer compatibility
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Explicitly serve root index.html for the root route
app.get('/', (req, res) => {
  const indexPath = path.resolve('./index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('index.html not found');
  }
});

// Serve WYSIWYG helper script from common locations
app.get('/wysiwyg-editor.js', (req, res) => {
  const candidates = [
    path.resolve('./wysiwyg-editor.js'),
    path.resolve('./workspace/wysiwyg-editor.js'),
    path.resolve('./pages/wysiwyg-editor.js'),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (found) {
    return res.sendFile(found);
  }
  res.status(404).send('wysiwyg-editor.js not found');
});

// Serve static files from the root of the virtual filesystem
app.use(express.static(path.resolve('.')));

// Expose directory listing for /components
app.use('/components', express.static(path.resolve('./components')));
app.use('/components', serveIndex(path.resolve('./components'), { icons: true }));
app.use('/pages', express.static(path.resolve('./pages')));
app.use('/pages', serveIndex(path.resolve('./pages'), { icons: true }));

app.use('/design-system', express.static(path.resolve('./design-system')));
app.use('/design-system', serveIndex(path.resolve('./design-system'), { icons: true }));
app.use('/scripts', express.static(path.resolve('./scripts')));
app.use('/scripts', serveIndex(path.resolve('./scripts'), { icons: true }));

// Function to list directory contents
function listDirectoryContents(dirPath) {
  return new Promise((resolve, reject) => {
    fs.readdir(dirPath, (err, files) => {
      if (err) {
        reject(err);
      } else {
        resolve(files);
      }
    });
  });
}

// Log components folder contents when server starts
const componentsDir = path.resolve('./components');
listDirectoryContents(componentsDir)
  .then(files => {
    console.log('Contents of components folder:', files);
  })
  .catch(err => {
    console.error('Unable to scan components directory:', err.message);
  });

app.listen(PORT, () => {
  console.log('🌐 Server listening on http://localhost:8080');
});
      `,
    },
  },
  // Ensure `/components` directory exists so directory listing does not 404
  components: {
    directory: {},
  },
  pages: {
    directory: {},
  },
  "design-system": {
    directory: {},
  },
  scripts: {
    directory: {
      "block-registry.js": {
        file: {
          contents: `

        (function(){
  const _origLog = console.log;
  console.log = (...args)=>_origLog('[block-registry.js]', ...args);
})();

function maybeLoadDemo(editor, demoPath) {
if (!demoPath) return;
fetch(demoPath)
  .then(r => r.ok ? r.text() : '')
  .then(html => {
    if (!html) return;
    if (typeof window.loadHtmlIntoEditor === 'function') {
      window.loadHtmlIntoEditor(html);
    } else {
      // Fallback: basic injection (no <style|script> preservation)
      editor.DomComponents.clear();
      editor.setComponents(html);
    }
  })
  .catch(err => console.warn('Failed to load demo file', demoPath, err));
}

export async function registerBlocks(editor) {
try {
  const res = await fetch('/components/block-manifest.json');
  if (!res.ok) return; // Manifest not found, skip silently
  const manifest = await res.json();

  // Determine blocks array depending on manifest shape
  const blocks = Array.isArray(manifest) ? manifest : (manifest.blocks || []);

  blocks.forEach(b => {
    if (editor.BlockManager.get(b.id)) return; // Avoid duplicates
    editor.BlockManager.add(b.id, {
      label: b.label || b.id,
      category: b.category || 'Basics',
      content: b.content || \`<\${b.id}></\${b.id}>\`,
    });
  });

  // Load demo page if provided
  if (!Array.isArray(manifest) && manifest.demo) {
    maybeLoadDemo(editor, manifest.demo);
  }
} catch (err) {
  console.error('Failed to load external blocks', err);
}
}`,
        },
      },
      "loader.js": {
        file: {
          contents: "",
        },
      },
    },
  },
};

const ensureWysiwygScriptTag = (html: string) => {
  if (!html || typeof html !== "string") return html;
  if (html.includes("wysiwyg-editor.js")) return html;
  const scriptTag = `\n    <script src="/wysiwyg-editor.js"></script>\n  `;
  if (html.includes("</head>")) {
    return html.replace("</head>", `${scriptTag}</head>`);
  }
  if (html.includes("</body>")) {
    return html.replace("</body>", `${scriptTag}</body>`);
  }
  return `${html}${scriptTag}`;
};

const writeWysiwygScript = async (
  wc: WebContainer,
  scriptContent: string | null
) => {
  if (!scriptContent) return;
  const workdir = wc.workdir || "/";
  const roots = new Set([workdir, "/project", "/workspace", "/"]);
  const targets = Array.from(roots)
    .map((root) => root.replace(/\/$/, ""))
    .filter(Boolean)
    .map((root) => `${root}/wysiwyg-editor.js`);

  await Promise.all(
    targets.map(async (target) => {
      try {
        const dir = target.substring(0, target.lastIndexOf("/"));
        if (dir && dir !== "/") {
          await wc.fs.mkdir(dir, { recursive: true }).catch(() => {});
        }
        await wc.fs.writeFile(target, scriptContent);
      } catch (error) {
        console.warn("[WebContainer] Failed to write WYSIWYG script:", target, error);
      }
    })
  );
};

export const useWebContainer = () => {
  const [state, setState] = useState<"loading" | "error" | "success" | null>(
    null
  );
  const [isTerminalReady, setIsTerminalReady] = useState<
    "loading" | "error" | "success" | null
  >(null);

  const path = usePathname();

  const getProjectId = useCallback(() => {
    const segments = path.split("/");
    const id = segments[2] || "";
    return id;
  }, [path]);

  const projectId = getProjectId();

  const dispatch = useDispatch();

  // Use a ref to track initialization status
  const hasInitialized = useRef<boolean>(false);
  const isolationBlockedRef = useRef<boolean>(false);
  const AIRef = useRef<string | null>(null);

  const workingdirRef = useRef<string | null>(null);

  const terminalInstanceRef = useRef<Terminal | null>(null);

  const [uri, setUri] = useState<string | null>(null);
  const [commandLogs] = useState<string[]>([]);
  // const [commandLogs, setCommandLogs] = useState<string[]>([]);

  // Provide privileges to AI for terminal control
  const grantAITerminalControl = useCallback(() => {
    if (typeof window !== "undefined") {
      AIRef.current = "terminal-control";

      // Initialize terminal control properties if not already set
      if (window.terminalIsBusy === undefined) window.terminalIsBusy = false;
      if (window.terminalCurrentDir === undefined)
        window.terminalCurrentDir = "/";

      // Create a simple interrupt function if one doesn't exist yet
      if (!window.terminalInterrupt) {
        window.terminalInterrupt = async () => {
          console.log(
            "Terminal interrupt requested, but no active terminal writer"
          );
          return false;
        };
      }

      // Update terminal ready status
      window.terminalReady = state === "success" && !!webcontainerInstance;
    }
  }, [state]);

  const watcher = async () => {
    if (webcontainerInstance) {
      webcontainerInstance.fs.watch(
        "/",
        { recursive: true },
        (event, filename) => {
          console.log(event, "lsietning to changesz", filename);
        }
      );
    }
  };

  // Initialize the file system once on mount instead of every render
  useEffect(() => {
    watcher();
    // dispatch(setprojectFiles(fileSystem));
    grantAITerminalControl();
  }, [dispatch, grantAITerminalControl]); // Only run once on mount

  // Function to boot the WebContainer
  const bootContainer = useCallback(async () => {
    restoreWebContainerSingletonState();

    if (typeof window !== "undefined" && window.crossOriginIsolated) {
      isolationBlockedRef.current = false;
    }

    // Prevent multiple initialization attempts
    if (
      typeof window === "undefined" ||
      hasInitialized.current ||
      state === "loading" ||
      (isolationBlockedRef.current && !window.crossOriginIsolated)
    ) {
      return;
    }

    // Reuse already-booted singleton instance (e.g. after remount/HMR).
    if (webcontainerInstance) {
      hasInitialized.current = true;
      setState("success");
      return;
    }

    if (!window.crossOriginIsolated) {
      console.error(
        "Error booting WebContainer:",
        "WebContainer requires cross-origin isolation (COOP/COEP). Reload after headers are applied.",
      );
      isolationBlockedRef.current = true;
      hasInitialized.current = true;
      setState("error");
      setIsTerminalReady("error");
      return;
    }

    // Set loading state
    setState("loading");
    setIsTerminalReady("loading");
    hasInitialized.current = true;

    try {
      let wysiwygScriptContent: string | null = null;
      // If initialization is already in progress, wait for it
      if (initializationPromise) {
        webcontainerInstance = await initializationPromise;
        persistWebContainerSingletonState();
      }
      // Otherwise start a new initialization
      else {
        const { WebContainer } = await import("@webcontainer/api");

        // Create a promise for initialization with network permissions
        initializationPromise = WebContainer.boot({
          workdirName: "project",
        });
        persistWebContainerSingletonState();

        // Wait for WebContainer to boot
        webcontainerInstance = await initializationPromise;
        persistWebContainerSingletonState();

        /**
         * Write the WYSIWYG editor helper script into the WebContainer filesystem.
         * We keep a copy at the server root and inside workspace for previews.
         */
        try {
          const scriptResp = await fetch("/wysiwyg-editor.js");
          if (scriptResp.ok) {
            wysiwygScriptContent = await scriptResp.text();
            await writeWysiwygScript(webcontainerInstance, wysiwygScriptContent);
            console.log("[WebContainer] WYSIWYG script deployed");
          } else {
            console.warn("[WebContainer] Failed to fetch wysiwyg-editor.js:", scriptResp.status);
          }
        } catch (scriptError) {
          console.error("Error writing wysiwyg-editor.js:", scriptError);
        }

        // Deploy template blocks manifest for preview + block registry
        try {
          const manifestResp = await fetch("/components/block-manifest.json");
          if (manifestResp.ok) {
            const manifestContent = await manifestResp.text();
            const workdir = webcontainerInstance.workdir || "/";
            const targets = [
              "/components/block-manifest.json",
              "/workspace/components/block-manifest.json",
              `${workdir.replace(/\/$/, "")}/components/block-manifest.json`,
            ];

            await Promise.all(
              Array.from(new Set(targets)).map(async (target) => {
                if (!target || target === "undefined/components/block-manifest.json") return;
                const container = webcontainerInstance;
                if (!container) return;
                try {
                  const dir = target.substring(0, target.lastIndexOf("/"));
                  if (dir && dir !== "/") {
                    await container.fs.mkdir(dir, { recursive: true }).catch(() => {});
                  }
                  await container.fs.writeFile(target, manifestContent);
                } catch (writeError) {
                  console.warn(
                    "[WebContainer] Failed to write block-manifest.json:",
                    target,
                    writeError
                  );
                }
              })
            );
            console.log("[WebContainer] Block manifest deployed to /components");
          }
        } catch (manifestError) {
          console.error("Error writing block-manifest.json:", manifestError);
        }


        // Fetch the remote HTML file and populate the virtual filesystem
        try {
          const response = await fetch(
            `/api/proxy-html?url=${encodeURIComponent(
              `https://d1wja1vnncd3ag.cloudfront.net/b.html?projectid=${projectId}`
            )}`
          );

          if (response.ok) {
            let htmlContent = await response.text();

            // Replace PROJECT_ID with the actual value using the marker
            htmlContent = htmlContent.replace(
              `let PROJECT_ID = ''; // INJECT_PROJECT_ID_HERE`,
              `let PROJECT_ID = '${projectId}'; // Injected during build`
            );

            // Replace PROJECT_PREFIX with the actual value using the marker
            htmlContent = htmlContent.replace(
              `let PROJECT_PREFIX = ''; // INJECT_PROJECT_PREFIX_HERE`,
              `let PROJECT_PREFIX = '/v1/${projectId}'; // Injected during build`
            );

            // Replace the iframe PROJECT_ID (used in canvas bootstrap)
            htmlContent = htmlContent.replace(
              `const PROJECT_ID = ""; // INJECT_IFRAME_PROJECT_ID_HERE`,
              `const PROJECT_ID = "${projectId}"; // Injected during build`
            );

            // Replace the iframe PROJECT_PREFIX (used in canvas bootstrap)
            htmlContent = htmlContent.replace(
              `const PROJECT_PREFIX = ""; // INJECT_IFRAME_PROJECT_PREFIX_HERE`,
              `const PROJECT_PREFIX = "/v1/${projectId}"; // Injected during build`
            );

            // Inject WYSIWYG helper script into the remote HTML
            htmlContent = ensureWysiwygScriptTag(htmlContent);

            // Persist index.html into the WebContainer filesystem so the preview server can serve it
            try {
              const workdir = webcontainerInstance.workdir || "/";
              const targets = [
                "/index.html",
                `${workdir.replace(/\/$/, "")}/index.html`,
              ];
              await Promise.all(
                Array.from(new Set(targets)).map(async (target) => {
                  if (!target || target === "undefined/index.html") return;
                  const container = webcontainerInstance;
                  if (!container) return;
                  try {
                    const dir = target.substring(0, target.lastIndexOf("/"));
                    if (dir && dir !== "/") {
                      await container.fs.mkdir(dir, { recursive: true }).catch(() => {});
                    }
                    await container.fs.writeFile(target, htmlContent);
                  } catch (writeError) {
                    console.warn(
                      "[WebContainer] Failed to write index.html:",
                      target,
                      writeError
                    );
                  }
                })
              );
              console.log("Wrote index.html with WYSIWYG integration to WebContainer");
            } catch (writeError) {
              console.error(
                "Error writing index.html to WebContainer filesystem:",
                writeError
              );
            }

            // Keep a local copy for debugging/consistency
            files["index.html"].file.contents = htmlContent;
          } else {
            console.error(`Failed to fetch HTML. Status: ${response.status}`);
            const fallbackHtml =
              "<!DOCTYPE html><html><body><h1>Error fetching HTML</h1></body></html>";
            files["index.html"].file.contents = fallbackHtml;
            try {
              if (webcontainerInstance) {
                await webcontainerInstance.fs.writeFile("/index.html", fallbackHtml);
              }
            } catch (fallbackWriteError) {
              console.error(
                "Error writing fallback index.html to WebContainer:",
                fallbackWriteError
              );
            }
          }
        } catch (fetchError) {
          console.error("Error fetching remote HTML:", fetchError);
          const fallbackHtml =
            "<!DOCTYPE html><html><body><h1>Error fetching HTML</h1></body></html>";
          files["index.html"].file.contents = fallbackHtml;
          try {
            const workdir = webcontainerInstance.workdir || "/";
            const targets = [
              "/index.html",
              `${workdir.replace(/\/$/, "")}/index.html`,
            ];
            await Promise.all(
              Array.from(new Set(targets)).map(async (target) => {
                if (!target || target === "undefined/index.html") return;
                const container = webcontainerInstance;
                if (!container) return;
                try {
                  const dir = target.substring(0, target.lastIndexOf("/"));
                  if (dir && dir !== "/") {
                    await container.fs.mkdir(dir, { recursive: true }).catch(() => {});
                  }
                  await container.fs.writeFile(target, fallbackHtml);
                } catch (writeError) {
                  console.warn(
                    "[WebContainer] Failed to write fallback index.html:",
                    target,
                    writeError
                  );
                }
              })
            );
          } catch (fallbackWriteError) {
            console.error(
              "Error writing fallback index.html to WebContainer:",
              fallbackWriteError
            );
          }
        }
        try {
          const response = await fetch(
            `/api/proxy-html?url=${encodeURIComponent(
              `https://d1wja1vnncd3ag.cloudfront.net/loader.js?projectid=${projectId}`
            )}`
          );
          if (response.ok) {
            let htmlContent = await response.text();

            // Replace PROJECT_ID with the actual value using the marker
            htmlContent = htmlContent.replace(
              `let PROJECT_ID = ''; // INJECT_PROJECT_ID_HERE`,
              `let PROJECT_ID = '${projectId}'; // Injected during build`
            );

            // Replace PROJECT_PREFIX with the actual value using the marker
            htmlContent = htmlContent.replace(
              `let PROJECT_PREFIX = ''; // INJECT_PROJECT_PREFIX_HERE`,
              `let PROJECT_PREFIX = '/v1/${projectId}'; // Injected during build`
            );

            // The pre-injection check is already added in the loader.js file
            // No need to modify the initializeProjectPaths function anymore

            files.scripts.directory["loader.js"].file.contents = htmlContent;
          } else {
            console.error(
              `Failed to fetch loader.js. Status: ${response.status}`
            );
            files.scripts.directory["loader.js"].file.contents =
              "<!DOCTYPE html><html><body><h1>Error fetching loader.js</h1></body></html>";
          }
        } catch (fetchError) {
          console.error("Error fetching remote HTML:", fetchError);
          files["index.html"].file.contents =
            "<!DOCTYPE html><html><body><h1>Error fetching HTML</h1></body></html>";
        }

        // Inject files from app/test/app
        try {
          const testFilesRes = await fetch("/api/test-files");
          if (testFilesRes.ok) {
            const testFiles = await testFilesRes.json();
            const mountFiles: Record<string, MutableFileTreeNode> = {};

            // Convert flat file map to WebContainer FileSystemTree
            for (const [filePath, content] of Object.entries(testFiles)) {
              // Remove leading slashes from filePath
              const cleanPath = filePath.replace(/^\/+/, "");
              const rawContent =
                typeof content === "string"
                  ? content
                  : JSON.stringify(content, null, 2);
              const finalContent = cleanPath.endsWith(".html")
                ? ensureWysiwygScriptTag(rawContent)
                : rawContent;

              // Prepend workspace/ to ensure files are mounted in the correct directory
              const parts = ("workspace/" + cleanPath).split("/");
              let current: Record<string, MutableFileTreeNode> = mountFiles;

              for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (i === parts.length - 1) {
                  current[part] = {
                    file: {
                      contents: finalContent,
                    },
                  };
                } else {
                  if (!current[part] || !current[part].directory) {
                    current[part] = {
                      directory: {},
                    };
                  }
                  current = current[part].directory as Record<
                    string,
                    MutableFileTreeNode
                  >;
                }
              }
            }

            if (wysiwygScriptContent) {
              if (!mountFiles.workspace) {
                mountFiles.workspace = { directory: {} };
              }
              if (!mountFiles.workspace.directory) {
                mountFiles.workspace.directory = {};
              }
              mountFiles.workspace.directory["wysiwyg-editor.js"] = {
                file: { contents: wysiwygScriptContent },
              };
            }

            await webcontainerInstance.mount(
              mountFiles as unknown as FileSystemTree
            );
            console.log("Mounted test files successfully");
            await writeWysiwygScript(webcontainerInstance, wysiwygScriptContent);

            // Sync to Redux
            dispatch(setprojectFiles(mountFiles));
            dispatch(setNewProjectData(testFiles));
          } else {
            console.error(
              "Failed to fetch test files:",
              testFilesRes.statusText
            );
          }
        } catch (error) {
          console.error("Error mounting test files:", error);
        }

        //getting the working dir
        workingdirRef.current = webcontainerInstance.workdir;
        // Mount the file system
        // await webcontainerInstance.mount(convertFileTreeToMount(fileSystem));

        // Setup server-ready listener
        webcontainerInstance.on("server-ready", (port, url) => {
          console.log(`Server ready at ${url} (port ${port})`);
          setUri(url);
          dispatch(setPreviewUrl(url));
        });

        // Install dependencies and start the server
        try {
          console.log("Installing npm dependencies...");
          const installProcess = await webcontainerInstance.spawn("npm", ["install"], {
            cwd: webcontainerInstance.workdir,
          });
          
          // Stream install output for debugging
          installProcess.output.pipeTo(
            new WritableStream({
              write(data) {
                console.log("[npm install]", data);
              },
            })
          );
          
          const installExitCode = await installProcess.exit;
          if (installExitCode !== 0) {
            console.warn("npm install exited with code:", installExitCode);
          } else {
            console.log("Dependencies installed successfully");
          }

          // Start the server
          console.log("Starting proxy server...");
          const startProcess = await webcontainerInstance.spawn("npm", ["start"], {
            cwd: webcontainerInstance.workdir,
          });
          
          // Stream server output for debugging
          startProcess.output.pipeTo(
            new WritableStream({
              write(data) {
                console.log("[npm start]", data);
              },
            })
          );
          
          // The server-ready event will fire when the server starts
          console.log("Server start command executed");
        } catch (serverError) {
          console.error("Error starting server:", serverError);
          // Continue anyway - server might still start via other means
        }

        console.log(
          "WebContainer booted successfully:",
          !!webcontainerInstance
        );
      }

      setState("success");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error booting WebContainer:", errorMessage);

      // SharedArrayBuffer/cross-origin errors cannot succeed via immediate retries.
      const isCrossOriginIsolationError =
        /crossoriginisolated|sharedarraybuffer/i.test(errorMessage);
      isolationBlockedRef.current = isCrossOriginIsolationError;
      hasInitialized.current = isCrossOriginIsolationError;

      // Release any stale instance before future retries.
      teardownWebContainerInstance("boot failure");

      setState("error");
      setIsTerminalReady("error");
    }
  }, [dispatch, projectId, state]);

  // Run commands in the WebContainer
  const executeCommand = useCallback(
    async (
      command: string,
      args: string[] = []
    ): Promise<{
      success: boolean;
      output: string;
      error?: string;
    }> => {
      // Validate WebContainer instance
      if (!webcontainerInstance) {
        const errorMsg = "WebContainer instance not initialized";
        return {
          success: false,
          output: "",
          error: errorMsg,
        };
      }

      try {
        // Spawn the command
        const process = await webcontainerInstance.spawn(command, args);

        let output = "";

        // Capture and process output
        await process.output.pipeTo(
          new WritableStream({
            write(data) {
              output += data;
            },
          })
        );

        // Wait for process to complete
        const exitCode = await process.exit;

        return {
          success: exitCode === 0,
          output,
          error:
            exitCode !== 0 ? `Command exited with code ${exitCode}` : undefined,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        return {
          success: false,
          output: "",
          error: errorMessage,
        };
      }
    },
    []
  );

  // Return the WebContainer context
  return {
    state,
    bootContainer,
    isTerminalReady,
    setIsTerminalReady,
    terminalInstanceRef,
    uri,
    executeCommand,
    webcontainerInstance,
    commandLogs,
    AIRef,
    grantAITerminalControl,
    workingdirRef,
  };
};

// ----- Helper to expose active instance (for non-React utilities) -----
export const getActiveWebContainer = ():
  | import("@webcontainer/api").WebContainer
  | null => {
  restoreWebContainerSingletonState();
  return webcontainerInstance;
};

// Add WebContainer-aware fetch function
export const webContainerFetch = async (
  url: string,
  options: RequestInit = {}
) => {
  if (webcontainerInstance) {
    // Use WebContainer's internal fetch which bypasses CORS
    try {
      // WebContainer provides a way to make external requests
      const response = await fetch(url, {
        ...options,
        mode: "no-cors", // This might work in WebContainer context
      });
      return response;
    } catch (error) {
      console.error("WebContainer fetch failed:", error);
      throw error;
    }
  }

  // Fallback to regular fetch
  return fetch(url, options);
};
