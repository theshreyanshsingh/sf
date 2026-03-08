"use client";

import { useEffect, useRef, useState } from "react";
import "@xterm/xterm/css/xterm.css";
import type { Terminal } from "@xterm/xterm";
import type { WebContainer, SpawnOptions } from "@webcontainer/api";
import type * as monacoEditor from "monaco-editor";

// Track the WebContainer instance globally
let webcontainerInstance: WebContainer | null = null;

type FileEntry = {
  name: string;
  type: "file" | "directory";
  contents?: string;
  children?: FileEntry[];
};

export default function WebContainerPage() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const monacoRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string>("");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const editorInstance =
    useRef<monacoEditor.editor.IStandaloneCodeEditor | null>(null);
  const fitAddon = useRef<any>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<string> | null>(null);
  const shellProcessRef = useRef<any>(null);

  // Setup initial files for a Next.js 15 project
  const fileSystem: Record<string, any> = {
    "next.config.mjs": {
      // Using mjs extension for Next.js 15
      devIndicators: false,
      file: {
        contents: `/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;`,
      },
    },
    "tsconfig.json": {
      file: {
        contents: `{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}`,
      },
    },
    app: {
      directory: {
        "layout.tsx": {
          file: {
            contents: `import './globals.css';
import { ReactNode } from 'react';

export const metadata = {
  title: 'Next.js 15 App',
  description: 'Created with WebContainer',
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}`,
          },
        },
        "page.tsx": {
          file: {
            contents: `"use client";
import { useState } from 'react';

export default function Home() {
  const [count, setCount] = useState(0);
  
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-4">Next.js 15 App</h1>
      <p className="mb-4">Edit app/page.tsx to get started</p>
      <button 
        onClick={() => setCount(prev => prev + 1)}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Count: {count}
      </button>
    </main>
  )
}`,
          },
        },
        "globals.css": {
          file: {
            contents: `
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground-rgb: 0, 0, 0;
  --background-start-rgb: 214, 219, 220;
  --background-end-rgb: 255, 255, 255;
}

@media (prefers-color-scheme: dark) {
  :root {
    --foreground-rgb: 255, 255, 255;
    --background-start-rgb: 0, 0, 0;
    --background-end-rgb: 0, 0, 0;
  }
}

body {
  color: rgb(var(--foreground-rgb));
  background: linear-gradient(
      to bottom,
      transparent,
      rgb(var(--background-end-rgb))
    )
    rgb(var(--background-start-rgb));
}`,
          },
        },
      },
    },
    "tailwind.config.js": {
      file: {
        contents: `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}`,
      },
    },
    "postcss.config.js": {
      file: {
        contents: `
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`,
      },
    },
    ".env.local": {
      file: {
        contents: `
# Environment variables
NEXT_PUBLIC_APP_NAME=WebContainer Next.js 15 App
`,
      },
    },
    ".npmrc": {
      file: {
        contents: `
# Force legacy peer deps to avoid installation issues
legacy-peer-deps=true
`,
      },
    },
    "package.json": {
      file: {
        contents: JSON.stringify(
          {
            name: "nextjs",
            version: "0.1.0",
            private: true,
            scripts: {
              dev: "next dev",
              build: "next build",
              start: "next start",
              lint: "next lint",
            },
            dependencies: {
              "@hookform/resolvers": "^3.9.0",
              "@next/swc-wasm-nodejs": "13.5.1",
              "@radix-ui/react-accordion": "^1.2.0",
              "@radix-ui/react-alert-dialog": "^1.1.1",
              "@radix-ui/react-aspect-ratio": "^1.1.0",
              "@radix-ui/react-avatar": "^1.1.0",
              "@radix-ui/react-checkbox": "^1.1.1",
              "@radix-ui/react-collapsible": "^1.1.0",
              "@radix-ui/react-context-menu": "^2.2.1",
              "@radix-ui/react-dialog": "^1.1.1",
              "@radix-ui/react-dropdown-menu": "^2.1.1",
              "@radix-ui/react-hover-card": "^1.1.1",
              "@radix-ui/react-label": "^2.1.0",
              "@radix-ui/react-menubar": "^1.1.1",
              "@radix-ui/react-navigation-menu": "^1.2.0",
              "@radix-ui/react-popover": "^1.1.1",
              "@radix-ui/react-progress": "^1.1.0",
              "@radix-ui/react-radio-group": "^1.2.0",
              "@radix-ui/react-scroll-area": "^1.1.0",
              "@radix-ui/react-select": "^2.1.1",
              "@radix-ui/react-separator": "^1.1.0",
              "@radix-ui/react-slider": "^1.2.0",
              "@radix-ui/react-slot": "^1.1.0",
              "@radix-ui/react-switch": "^1.1.0",
              "@radix-ui/react-tabs": "^1.1.0",
              "@radix-ui/react-toast": "^1.2.1",
              "@radix-ui/react-toggle": "^1.1.0",
              "@radix-ui/react-toggle-group": "^1.1.0",
              "@radix-ui/react-tooltip": "^1.1.2",
              "@react-three/drei": "^9.102.6",
              "@react-three/fiber": "^8.15.19",
              "@types/node": "20.6.2",
              "@types/react": "18.2.22",
              "@types/react-dom": "18.2.7",
              "@types/three": "^0.162.0",
              autoprefixer: "10.4.15",
              "class-variance-authority": "^0.7.0",
              clsx: "^2.1.1",
              cmdk: "^1.0.0",
              "date-fns": "^3.6.0",
              "embla-carousel-react": "^8.3.0",
              eslint: "8.49.0",
              "eslint-config-next": "13.5.1",
              "input-otp": "^1.2.4",
              "lucide-react": "^0.446.0",
              next: "13.5.1",
              "next-themes": "^0.3.0",
              postcss: "8.4.30",
              react: "18.2.0",
              "react-day-picker": "^8.10.1",
              "react-dom": "18.2.0",
              "react-hook-form": "^7.53.0",
              "react-resizable-panels": "^2.1.3",
              recharts: "^2.12.7",
              sonner: "^1.5.0",
              "tailwind-merge": "^2.5.2",
              tailwindcss: "3.3.3",
              "tailwindcss-animate": "^1.0.7",
              three: "^0.162.0",
              typescript: "5.2.2",
              vaul: "^0.9.9",
              zod: "^3.23.8",
            },
          },
          null,
          2
        ),
      },
    },
  };

  // Flatten file system for UI display
  const processFileTree = (
    obj: Record<string, any>,
    path: string = ""
  ): FileEntry[] => {
    const result: FileEntry[] = [];

    Object.keys(obj).forEach((key) => {
      const currentPath = path ? `${path}/${key}` : key;
      if (obj[key].directory) {
        const dirEntry: FileEntry = {
          name: key,
          type: "directory",
          children: [],
        };
        result.push(dirEntry);
        dirEntry.children = processFileTree(obj[key].directory, currentPath);
      } else if (obj[key].file) {
        result.push({
          name: key,
          type: "file",
          contents: obj[key].file.contents,
        });
      }
    });

    return result;
  };

  // Convert file structure to WebContainer mount format
  const convertFileTreeToMount = (
    obj: Record<string, any>
  ): Record<string, any> => {
    const result: Record<string, any> = {};

    for (const key in obj) {
      if (obj[key].directory) {
        result[key] = {
          directory: convertFileTreeToMount(obj[key].directory),
        };
      } else if (obj[key].file) {
        result[key] = {
          file: {
            contents: obj[key].file.contents,
          },
        };
      }
    }

    return result;
  };

  // Function to get file content based on path
  const getFileContentByPath = async (path: string): Promise<string> => {
    if (!webcontainerInstance) return "";
    try {
      const file = await webcontainerInstance.fs.readFile(path, "utf-8");
      return file;
    } catch (err) {
      console.error(`Failed to read file at ${path}:`, err);
      return "";
    }
  };

  // Function to save the current file
  const saveCurrentFile = async () => {
    if (!currentFile || !editorInstance.current || !webcontainerInstance)
      return;

    const content = editorInstance.current.getValue();
    try {
      await webcontainerInstance.fs.writeFile(currentFile, content);
      console.log(`Saved file: ${currentFile}`);

      // Show saving indicator in terminal
      if (terminalInstance.current) {
        terminalInstance.current.writeln(
          `\r\n\x1b[32m✓ Saved: ${currentFile}\x1b[0m`
        );
      }
    } catch (err) {
      console.error(`Failed to save file ${currentFile}:`, err);
      setError(`Failed to save file: ${String(err)}`);
    }
  };

  // Load and initialize Monaco editor properly
  const loadMonaco = async (): Promise<typeof monacoEditor | null> => {
    try {
      // Set up global Monaco environment first
      window.MonacoEnvironment = {
        getWorkerUrl: function (_moduleId: string, label: string) {
          const workerPath =
            label === "typescript" || label === "javascript"
              ? "./ts.worker.js"
              : "./editor.worker.js";

          return workerPath;
        },
      };

      // Load Monaco editor dynamically
      const monaco = await import("monaco-editor");
      return monaco;
    } catch (err) {
      console.error("Failed to load Monaco:", err);
      return null;
    }
  };

  // Create the Monaco editor instance
  const createMonacoEditor = async () => {
    if (!monacoRef.current || editorInstance.current) return;

    try {
      const monaco = await loadMonaco();
      if (!monaco) return;

      const editor = monaco.editor.create(monacoRef.current, {
        value: "",
        theme: "vs-dark",
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        renderLineHighlight: "all",
        tabSize: 2,
      });

      editorInstance.current = editor;

      // Add keyboard shortcuts
      editor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
        saveCurrentFile
      );

      // Initially load empty content
      if (currentFile) {
        updateEditorContent();
      }
    } catch (err) {
      console.error("Error creating Monaco editor:", err);
      setError(`Failed to initialize code editor: ${String(err)}`);
    }
  };

  // Update editor content when file changes
  const updateEditorContent = async () => {
    if (!currentFile || !editorInstance.current || !webcontainerInstance)
      return;

    try {
      const content = await getFileContentByPath(currentFile);

      // Determine language by file extension
      const ext = currentFile.split(".").pop()?.toLowerCase();
      let language = "plaintext";

      switch (ext) {
        case "js":
        case "mjs":
        case "cjs":
          language = "javascript";
          break;
        case "ts":
          language = "typescript";
          break;
        case "jsx":
          language = "javascript";
          break;
        case "tsx":
          language = "typescript";
          break;
        case "html":
          language = "html";
          break;
        case "css":
          language = "css";
          break;
        case "json":
          language = "json";
          break;
        case "md":
          language = "markdown";
          break;
      }

      // Set editor model language and content
      const monaco = await loadMonaco();
      if (monaco) {
        const model = editorInstance.current.getModel();
        if (model) {
          monaco.editor.setModelLanguage(model, language);
        }
        editorInstance.current.setValue(content);
      }
    } catch (err) {
      console.error("Error updating editor content:", err);
    }
  };

  // Initialize WebContainer and tools
  useEffect(() => {
    // Skip on server side
    if (typeof window === "undefined") return;

    let isUnmounted = false;

    const startWebContainer = async () => {
      try {
        setLoading(true);

        // Dynamically import browser-only modules
        const [{ WebContainer }, { Terminal }, { FitAddon }] =
          await Promise.all([
            import("@webcontainer/api"),
            import("@xterm/xterm"),
            import("@xterm/addon-fit"),
          ]);

        if (isUnmounted) return;

        // Initialize terminal
        if (terminalRef.current && !terminalInstance.current) {
          const term = new Terminal({
            fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
            fontSize: 12,
            lineHeight: 1.3,
            cursorBlink: true,
            cursorStyle: "block",
            theme: {
              background: "#000000",
              foreground: "#F8F8F8",
              cursor: "#52AD70",
              green: "#52AD70",
              brightGreen: "#67C881",
              yellow: "#EAD64D",
              brightYellow: "#F5DA89",
              blue: "#2388FF",
              brightBlue: "#61AFEF",
              cyan: "#56B6C2",
              brightCyan: "#67D3E0",
              red: "#E06C75",
              brightRed: "#F97583",
              magenta: "#C678DD",
              brightMagenta: "#D68DF0",
              white: "#ABB2BF",
              brightWhite: "#FFFFFF",
              black: "#1E1E1E",
              brightBlack: "#5C6370",
            },
            allowTransparency: false,
            convertEol: true,
          });

          // Add fit addon
          const fit = new FitAddon();
          term.loadAddon(fit);
          fitAddon.current = fit;

          // Open terminal in DOM
          term.open(terminalRef.current);
          fit.fit();

          terminalInstance.current = term;
          term.writeln("WebContainer terminal initialized...\r\n");
        }

        // Boot WebContainer
        console.log("Booting WebContainer...");
        const container = await WebContainer.boot();
        webcontainerInstance = container;

        // Process file tree for UI
        const processedFiles = processFileTree(fileSystem);
        setFiles(processedFiles);

        // Mount files to WebContainer
        await container.mount(convertFileTreeToMount(fileSystem));

        // Load Monaco editor
        await createMonacoEditor();

        // Set default file to show
        setCurrentFile("app/page.tsx");

        // Start shell for interactive terminal
        const terminal = terminalInstance.current;
        if (!terminal) {
          throw new Error("Terminal not initialized");
        }

        terminal.clear();
        terminal.writeln("Setting up Next.js 15 environment...\r\n");

        try {
          // Start an interactive shell
          const shellProcess = await container.spawn("bash", {
            terminal: {
              cols: terminal.cols,
              rows: terminal.rows,
            },
          });
          shellProcessRef.current = shellProcess;

          // Get writer for shell input
          const writer = shellProcess.input.getWriter();
          writerRef.current = writer;

          // Forward terminal input to shell
          terminal.onData((data) => {
            writer.write(data);
          });

          // Forward shell output to terminal
          const reader = shellProcess.output.getReader();

          const processOutput = async () => {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (value) {
                  terminal.write(value);

                  // Check for server started message in the output
                  if (
                    value.includes("http://localhost:") ||
                    value.includes("- Local:") ||
                    value.includes("ready started server")
                  ) {
                    const match = value.match(/(http:\/\/localhost:[0-9]+)/);
                    if (match && match[1]) {
                      console.log("Server URL detected:", match[1]);
                      //   setUrl(match[1]);
                      setLoading(false);
                    }
                  }
                }
              }
            } catch (err) {
              console.error("Error reading shell output:", err);
            }
          };

          processOutput();

          // Run commands to set up environment
          const runCommand = async (cmd: string) => {
            if (writer) {
              await writer.write(cmd + "\n");
            }
          };

          // Install dependencies with a progress indicator
          terminal.writeln(
            "\r\nInstalling dependencies (this may take a while)...\r\n"
          );
          await runCommand("npm install");

          // Start development server
          setTimeout(async () => {
            terminal.writeln(
              "\r\nStarting Next.js 15 development server...\r\n"
            );
            await runCommand("npm run dev");
          }, 1000);

          // Listen for server-ready event
          container.on("server-ready", (port, url) => {
            console.log("Server ready on port:", port, "URL:", url);
            setUrl(url);
            setLoading(false);
          });

          // Set timeout to ensure loading state doesn't get stuck
          setTimeout(() => {
            if (!isUnmounted) {
              setLoading(false);
            }
          }, 60000);
        } catch (err) {
          console.error("Failed to start development environment:", err);
          if (terminal) {
            terminal.writeln(`\r\n\x1b[31mError: ${String(err)}\x1b[0m`);
          }
          setError(`Failed to start development environment: ${String(err)}`);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to initialize WebContainer:", err);
        setError(`Failed to initialize environment: ${String(err)}`);
        setLoading(false);
      }
    };

    startWebContainer();

    // Cleanup on unmount
    return () => {
      isUnmounted = true;

      // Clean up resources
      if (terminalInstance.current) {
        terminalInstance.current.dispose();
      }

      if (editorInstance.current) {
        editorInstance.current.dispose();
      }

      if (writerRef.current) {
        try {
          writerRef.current.releaseLock();
        } catch (e) {
          // Ignore errors during cleanup
        }
      }

      if (shellProcessRef.current) {
        try {
          shellProcessRef.current.kill();
        } catch (e) {
          // Ignore errors during cleanup
        }
      }

      webcontainerInstance = null;
    };
  }, []);

  console.log(url);

  // Update editor when current file changes
  useEffect(() => {
    if (currentFile && editorInstance.current) {
      updateEditorContent();
    }
  }, [currentFile]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (fitAddon.current) {
        fitAddon.current.fit();
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Render file tree recursively
  const renderFileTree = (entries: FileEntry[], basePath: string = "") => {
    return (
      <ul className="ml-2">
        {entries.map((entry) => {
          const path = basePath ? `${basePath}/${entry.name}` : entry.name;
          return (
            <li key={path} className="my-1">
              {entry.type === "directory" ? (
                <div>
                  <span className="font-bold">📁 {entry.name}</span>
                  {entry.children && renderFileTree(entry.children, path)}
                </div>
              ) : (
                <div
                  className={`cursor-pointer hover:text-blue-500 ${
                    currentFile === path ? "text-blue-500 font-bold" : ""
                  }`}
                  onClick={() => setCurrentFile(path)}
                >
                  📄 {entry.name}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  // Reload the iframe manually
  const reloadIframe = () => {
    if (iframeRef.current && url) {
      iframeRef.current.src = `${url}?refresh=${Date.now()}`;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {error && (
        <div className="bg-red-600 p-2 text-white">
          Error: {error}
          <button
            className="ml-2 bg-red-800 px-2 rounded"
            onClick={() => setError(null)}
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 bg-gray-800 overflow-y-auto p-2">
          <h2 className="text-lg font-bold mb-2">Files</h2>
          {renderFileTree(files)}
        </div>

        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-hidden">
            {currentFile ? (
              <div
                ref={monacoRef}
                className="h-full w-full"
                style={{ minHeight: "300px" }}
              ></div>
            ) : (
              <div className="flex items-center justify-center h-full text-center p-4">
                <div>
                  <p className="text-xl mb-2">Select a file to edit</p>
                  <p className="text-sm text-gray-400">or</p>
                  <button
                    className="mt-2 px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
                    onClick={() => {
                      setCurrentFile("app/page.tsx");
                    }}
                  >
                    Open Homepage
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="h-64 bg-black">
            <div ref={terminalRef} className="h-full"></div>
          </div>
        </div>

        <div className="w-1/2 border-l border-gray-700">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-2xl mb-4">Loading...</div>
                <div className="text-gray-400">
                  Setting up Next.js 15 with npm
                </div>
                <div className="mt-4 text-sm text-gray-500">
                  This may take a minute or two...
                </div>
              </div>
            </div>
          ) : url ? (
            <div className="flex flex-col h-full">
              <div className="bg-gray-800 p-2 flex justify-between items-center">
                <span className="text-sm text-gray-300">Preview</span>
                <button
                  onClick={reloadIframe}
                  className="px-2 py-1 bg-blue-700 text-xs rounded hover:bg-blue-600"
                >
                  Refresh
                </button>
              </div>
              <iframe
                ref={iframeRef}
                src={url}
                className="flex-1 w-full"
                title="Preview"
                onError={() => {
                  // Try refreshing if initial load fails
                  if (iframeRef.current) {
                    setTimeout(() => {
                      if (iframeRef.current) {
                        iframeRef.current.src = url;
                      }
                    }, 2000);
                  }
                }}
              ></iframe>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-2xl mb-4">Waiting for server...</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center p-2 bg-gray-800 border-t border-gray-700">
        <div>
          {currentFile && (
            <button
              className="px-3 py-1 bg-green-600 rounded hover:bg-green-700 mr-2"
              onClick={saveCurrentFile}
            >
              Save (Ctrl+S)
            </button>
          )}
        </div>
        <div>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              {url}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
