"use client";

import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import type * as monacoEditor from "monaco-editor";
import dynamic from "next/dynamic";
import prettier from "prettier/standalone";
import parserBabel from "prettier/plugins/babel";
import parserTypeScript from "prettier/plugins/typescript";
import parserHTML from "prettier/plugins/html";
import parserEstree from "prettier/plugins/estree";
import EditorHeader from "./EditorHeader";
import { AppDispatch } from "@/app/redux/store";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/app/redux/store";
import { FileEntry, UIFileEntry } from "../types";
import { setCurrentFile } from "@/app/redux/reducers/projectFiles";
import { refreshPreview } from "@/app/redux/reducers/projectOptions";
// TODO: re-wire after webcontainer rewrite
const createFileSystemOperations = (dispatch: any, fileTree: any) => ({
  writeFile: async (_path: string, _content: string | Uint8Array) => false,
  mkdir: async (_path: string, _opts?: { recursive?: boolean }) => false,
  uploadFile: async (_file: File, _destPath: string) => false,
  updateFileTree: () => {},
});
import FileCreationModal from "../../../../../_modals/FileCreationModal";
import MediaViewer from "../MediaViewer";
import FileExplorer from "./FileExplorer";
import { usePathname } from "next/navigation";
import { useAuthenticated } from "@/app/helpers/useAuthenticated";
import { API } from "@/app/config/publicEnv";
import { ensureWorkspacePath } from "@/app/helpers/workspacePaths";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});

type CodeEditorProps = {
  language?: string;
  value?: string;
  onChange?: (value: string | undefined) => void;
  onSave?: (value: string) => void;
};

// interface FileContent {
//   [path: string]: string;
// }

// Define React snippets interface
interface SnippetDefinition {
  prefix: string;
  body: string[];
  description: string;
}

interface ReactSnippets {
  [key: string]: SnippetDefinition;
}

const CodeEditor = ({
  language = "javascript",
  value = "",
  onChange,
  onSave,
}: CodeEditorProps) => {
  const editorRef = useRef<monacoEditor.editor.IStandaloneCodeEditor | null>(
    null,
  );
  const monacoRef = useRef<typeof monacoEditor | null>(null);

  // Get files from the redux store
  const { currentFile, files: projectFiles } = useSelector(
    (state: RootState) => state.projectFiles,
  );
  const projectData = useSelector(
    (state: RootState) => state.projectFiles.data,
  );
  const { previewRuntime } = useSelector(
    (state: RootState) => state.projectOptions,
  );

  const path = usePathname();

  const getProjectId = useCallback(() => {
    const segments = path.split("/");
    const id = segments[2] || "";
    return id;
  }, [path]);

  const projectId = getProjectId();

  const { email } = useAuthenticated();

  // Initialize with an empty array if there are no files
  // const fileTree = useMemo(() => {
  //   if (!projectFiles) return [];

  //   // If files is an array, return it as is
  //   if (Array.isArray(projectFiles)) {
  //     return projectFiles;
  //   }

  //   // Otherwise, convert the object to an array safely
  //   try {
  //     return Object.keys(projectFiles).map((key) => {
  //       const item = projectFiles[key];
  //       return {
  //         name: key,
  //         type: "file",
  //         ...(typeof item === 'object' ? item : {})
  //       };
  //     });
  //   } catch (error) {
  //     console.error("Error processing file tree:", error);
  //     return [];
  //   }
  // }, [projectFiles]);

  // Extract file name and path for use in the editor
  // const currentFileName =
  //   currentFile && typeof currentFile === "object" && "name" in currentFile
  //     ? currentFile.name
  //     : null;
  // Try to get path from UIFileEntry
  const currentFilePath =
    currentFile && typeof currentFile === "object"
      ? "path" in currentFile && typeof currentFile.path === "string"
        ? currentFile.path
        : currentFile.name
      : undefined;

  // Convert files string to FileEntry[] if needed
  const [parsedFiles, setParsedFiles] = useState<FileEntry[]>([]);

  // Parse the files string from Redux into FileEntry[] structure when it changes
  useEffect(() => {
    if (typeof projectFiles === "string") {
      try {
        const parsed = JSON.parse(projectFiles);
        if (Array.isArray(parsed)) {
          setParsedFiles(parsed);
        }
      } catch (err) {
        console.error("Error parsing files data:", err);
        setParsedFiles([]);
      }
    } else {
      setParsedFiles([]);
    }
  }, [projectFiles]);

  // State for file explorer and editor
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [currentFileContent, setCurrentFileContent] = useState<string>(value);
  const [currentLanguage, setCurrentLanguage] = useState<string>(language);

  // State for the explorer width (percentage)
  const [explorerWidth, setExplorerWidth] = useState<number>(20);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState(false);

  // State for file creation modal
  const [fileCreationModal, setFileCreationModal] = useState({
    isOpen: false,
    type: "file" as "file" | "folder",
    parentPath: "",
  });

  // Previous width before collapse (to restore when expanding)
  const [previousWidth, setPreviousWidth] = useState<number>(20);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);

  // State to determine if we should show media viewer instead of code editor
  const [isMediaFile, setIsMediaFile] = useState(false);

  // State for tracking file changes and save status
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [lastSavedContent, setLastSavedContent] = useState<string>("");

  const appDispatch = useDispatch();

  // Create file system operations
  const fileSystemData = useSelector(
    (state: RootState) => state.projectFiles.files,
  );
  const fileSystem = useMemo(() => {
    return createFileSystemOperations(
      appDispatch as AppDispatch,
      typeof fileSystemData === "object" && fileSystemData !== null
        ? fileSystemData
        : {},
    );
  }, [appDispatch, fileSystemData]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
  }, [previewRuntime]);

  // Store the editor instance when mounted
  const handleEditorMountWrapper = (editor: any, monaco: any): void => {
    editorRef.current = editor;
    handleEditorDidMount(editor, monaco);
  };

  // Handle mouse down on the divider - NOT passive
  const handleDragStart = (e: React.MouseEvent): void => {
    e.preventDefault();
    setIsDragging(true);

    // Disable the editor to prevent errors during resize
    if (editorRef.current) {
      try {
        editorRef.current.updateOptions({ readOnly: true });
      } catch (error) {
        // Ignore errors from Monaco
      }
    }
  };

  // Handle mouse events
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent): void => {
      if (!isDragging || !containerRef.current) return;

      // Calculate the new width as a percentage
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth =
        ((e.clientX - containerRect.left) / containerRect.width) * 100;

      // Limit the size between 10% and 50%
      if (newWidth >= 10 && newWidth <= 50) {
        setExplorerWidth(newWidth);
      }
    };

    const handleMouseUp = (): void => {
      setIsDragging(false);

      // Re-enable the editor after resize
      if (editorRef.current) {
        setTimeout(() => {
          try {
            editorRef.current!.updateOptions({ readOnly: false });
            editorRef.current!.layout();
          } catch (error) {
            console.log("Error", error);
            // Ignore errors from Monaco
          }
        }, 0);
      }
    };

    // Add listeners only when dragging
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // Mobile touch support with non-passive listeners
  useEffect(() => {
    if (!dividerRef.current || !containerRef.current) return;

    // Touch handling - separate from mouse events
    const divider = dividerRef.current;
    const container = containerRef.current;

    const handleTouchStart = (e: TouchEvent): void => {
      e.preventDefault(); // This is OK in a non-passive listener
      setIsDragging(true);

      // Disable editor during touch resize
      if (editorRef.current) {
        try {
          editorRef.current.updateOptions({ readOnly: true });
        } catch (error) {
          // Ignore errors
        }
      }
    };

    const handleTouchMove = (e: TouchEvent): void => {
      if (!isDragging || !containerRef.current) return;

      const touch = e.touches[0];
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth =
        ((touch.clientX - containerRect.left) / containerRect.width) * 100;

      // Limit the size between 10% and 50%
      if (newWidth >= 10 && newWidth <= 50) {
        setExplorerWidth(newWidth);
      }
    };

    const handleTouchEnd = (): void => {
      setIsDragging(false);

      if (editorRef.current) {
        setTimeout(() => {
          try {
            editorRef.current!.updateOptions({ readOnly: false });
            editorRef.current!.layout();
          } catch (error) {
            console.log("Error", error);
            // Ignore errors from Monaco
          }
        }, 0);
      }
    };

    // Add non-passive touch event listeners directly to the divider
    divider.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      divider.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, dividerRef, containerRef]);

  // Layout the editor when dimensions change
  useEffect(() => {
    if (editorRef.current) {
      try {
        setTimeout(() => {
          editorRef.current!.layout();
        }, 10);
      } catch (error) {}
    }
  }, [explorerWidth]);

  // Define custom theme that matches app's dark aesthetic
  const defineCustomTheme = (monaco: typeof monacoEditor) => {
    monaco.editor.defineTheme("superblocks-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6A9955", fontStyle: "italic" },
        { token: "keyword", foreground: "C586C0" },
        { token: "string", foreground: "CE9178" },
        { token: "number", foreground: "B5CEA8" },
        { token: "regexp", foreground: "D16969" },
        { token: "type", foreground: "4EC9B0" },
        { token: "class", foreground: "4EC9B0" },
        { token: "interface", foreground: "4EC9B0" },
        { token: "namespace", foreground: "4EC9B0" },
        { token: "function", foreground: "DCDCAA" },
        { token: "variable", foreground: "9CDCFE" },
        { token: "variable.predefined", foreground: "569CD6" },

        // JSX/HTML support
        { token: "tag", foreground: "569CD6" },
        { token: "tag.delimiter", foreground: "808080" },
        { token: "tag.attribute", foreground: "9CDCFE" },
        { token: "metatag", foreground: "569CD6" },
        { token: "metatag.content.html", foreground: "D4D4D4" },
        { token: "metatag.html", foreground: "808080" },
      ],
      colors: {
        "editor.background": "#141415", // KEEP this as requested
        "editor.foreground": "#D4D4D4",
        "editorCursor.foreground": "#AEAFAD",
        "editor.lineHighlightBackground": "#1F1F1F",
        "editorLineNumber.foreground": "#5A5A5A",
        "editorLineNumber.activeForeground": "#C6C6C6",

        "editor.selectionBackground": "#264F78",
        "editor.selectionHighlightBackground": "#1F3347",
        "editor.inactiveSelectionBackground": "#3A3D41",

        "editorWidget.background": "#151515",
        "editorWidget.border": "#303030",

        "editorSuggestWidget.background": "#151515",
        "editorSuggestWidget.border": "#303030",
        "editorSuggestWidget.selectedBackground": "#062F4A",
        "editorHoverWidget.background": "#151515",
        "editorHoverWidget.border": "#303030",

        "minimap.background": "#141415",
        "minimap.selectionHighlight": "#264F78",

        "scrollbarSlider.background": "#3F3F3F80",
        "scrollbarSlider.hoverBackground": "#5A5A5A80",
        "scrollbarSlider.activeBackground": "#6E6E6E80",

        "editorError.foreground": "#F14C4C",
        "editorError.border": "#F14C4C",
        "editorWarning.foreground": "#CCA700",
        "editorWarning.border": "#CCA700",

        "editorMarkerNavigation.background": "#1F1F1F",
        "editorMarkerNavigationError.background": "#F14C4C20",
        "editorMarkerNavigationWarning.background": "#CCA70020",
      },
    });
  };

  // Helper function to create a model marker (error/warning)
  const createMarker = (
    monaco: typeof monacoEditor,
    model: monacoEditor.editor.ITextModel,
    startLineNumber: number,
    startColumn: number,
    endLineNumber: number,
    endColumn: number,
    message: string,
    severity: monacoEditor.MarkerSeverity,
  ) => {
    monaco.editor.setModelMarkers(model, "custom-validation", [
      {
        startLineNumber,
        startColumn,
        endLineNumber,
        endColumn,
        message,
        severity,
      },
    ]);
  };

  const configureReactSnippets = (monaco: typeof monacoEditor) => {
    // Define React snippets similar to VS Code's ES7+ React snippets
    const reactSnippets: ReactSnippets = {
      rafce: {
        prefix: "rafce",
        body: [
          'import React from "react";',
          "",
          "const ${1:ComponentName} = () => {",
          "\treturn (",
          "\t\t<div>$0</div>",
          "\t);",
          "};",
          "",
          "export default ${1:ComponentName};",
        ],
        description: "React Arrow Function Component with Export",
      },
      rafc: {
        prefix: "rafc",
        body: [
          'import React from "react";',
          "",
          "const ${1:ComponentName} = () => {",
          "\treturn <div>$0</div>;",
          "};",
          "",
          "export const ${1:ComponentName} = ${1:ComponentName};",
        ],
        description: "React Arrow Function Component",
      },
      rfc: {
        prefix: "rfc",
        body: [
          'import React from "react";',
          "",
          "function ${1:ComponentName}() {",
          "\treturn (",
          "\t\t<div>$0</div>",
          "\t);",
          "}",
          "",
          "export default ${1:ComponentName};",
        ],
        description: "React Function Component",
      },
      rfce: {
        prefix: "rfce",
        body: [
          'import React from "react";',
          "",
          "function ${1:ComponentName}() {",
          "\treturn (",
          "\t\t<div>$0</div>",
          "\t);",
          "}",
          "",
          "export default ${1:ComponentName};",
        ],
        description: "React Function Component with Export",
      },
      rcc: {
        prefix: "rcc",
        body: [
          'import React, { Component } from "react";',
          "",
          "export default class ${1:ComponentName} extends Component {",
          "\trender() {",
          "\t\treturn <div>$0</div>;",
          "\t}",
          "}",
        ],
        description: "React Class Component",
      },
      usestate: {
        prefix: "usestate",
        body: [
          "const [${1:state}, set${1/(.*)/${1:/capitalize}/}] = useState(${2:initialState});",
        ],
        description: "React useState() Hook",
      },
      useeffect: {
        prefix: "useeffect",
        body: [
          "useEffect(() => {",
          "\t${1}",
          "\t",
          "\treturn () => {",
          "\t\t${2}",
          "\t};",
          "}, [${3}]);",
        ],
        description: "React useEffect() Hook",
      },
      usereducer: {
        prefix: "usereducer",
        body: [
          "const [${1:state}, ${2:dispatch}] = useReducer(${3:reducer}, ${4:initialState});",
        ],
        description: "React useReducer() Hook",
      },
      useref: {
        prefix: "useref",
        body: ["const ${1:refName} = useRef(${2:initialValue});"],
        description: "React useRef() Hook",
      },
      usecallback: {
        prefix: "usecallback",
        body: [
          "const ${1:memoizedCallback} = useCallback(",
          "\t() => {",
          "\t\t${2}",
          "\t},",
          "\t[${3}],",
          ");",
        ],
        description: "React useCallback() Hook",
      },
      usememo: {
        prefix: "usememo",
        body: [
          "const ${1:memoizedValue} = useMemo(() => ${2:computeExpensiveValue}(${3:dependencies}), [${3:dependencies}]);",
        ],
        description: "React useMemo() Hook",
      },
    };

    // Register for JavaScript and TypeScript and JSX/TSX
    const languages = [
      "javascript",
      "typescript",
      "javascriptreact",
      "typescriptreact",
    ];

    languages.forEach((lang) => {
      monaco.languages.registerCompletionItemProvider(lang, {
        provideCompletionItems: (model, position) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          const suggestions = Object.entries(reactSnippets).map(
            ([key, snippet]) => {
              return {
                label: snippet.prefix,
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: snippet.body.join("\n"),
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: snippet.description,
                range,
              };
            },
          );

          return { suggestions };
        },
      });
    });
  };

  const configureStandardSnippets = (monaco: typeof monacoEditor) => {
    // Define JavaScript/TypeScript snippets
    const languages = [
      "javascript",
      "typescript",
      "javascriptreact",
      "typescriptreact",
    ];

    languages.forEach((lang) => {
      monaco.languages.registerCompletionItemProvider(lang, {
        provideCompletionItems: (model, position) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          const suggestions = [
            {
              label: "clg",
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: "console.log($1);",
              insertTextRules:
                monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: "Log to the console",
              range,
            },
            {
              label: "clo",
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: "console.log({$1});",
              insertTextRules:
                monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: "Log object to the console",
              range,
            },
            {
              label: "imp",
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'import { $2 } from "$1";',
              insertTextRules:
                monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: "Import statement",
              range,
            },
            {
              label: "fn",
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: "function $1($2) {\n\t$3\n}",
              insertTextRules:
                monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: "Function declaration",
              range,
            },
            {
              label: "afn",
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: "const $1 = ($2) => {\n\t$3\n}",
              insertTextRules:
                monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: "Arrow function",
              range,
            },
          ];

          return { suggestions };
        },
      });
    });
  };

  const handleEditorDidMount = (
    editor: monacoEditor.editor.IStandaloneCodeEditor,
    monaco: typeof monacoEditor,
  ) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Define and set custom theme
    defineCustomTheme(monaco);
    monaco.editor.setTheme("superblocks-dark");

    // Configure minimap and error display options
    editor.updateOptions({
      minimap: {
        enabled: true,
      },
      // Enable inline error highlighting
      renderValidationDecorations: "on",
      // Show the glyph margin for error indicators
      glyphMargin: true,
      // Highlight errors with red squiggly underlines
      renderLineHighlight: "all",
      // Show error messages on hover
      hover: { enabled: true, delay: 300 },
    });

    // Disable built-in diagnostics (red squiggly underlines) for JavaScript & TypeScript
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
      diagnosticCodesToIgnore: [],
    });

    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
      diagnosticCodesToIgnore: [],
    });

    // Cmd+S or Ctrl+S to format and save code
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleFormatCode();
      const currentValue = editor.getValue();
      onSave?.(currentValue);
      // The save function will handle the preview refresh
    });

    // Configure React snippets
    configureReactSnippets(monaco);

    // Configure standard snippets
    configureStandardSnippets(monaco);

    // Set up model markers change listener to handle errors
    const model = editor.getModel();
    if (model) {
      monaco.editor.onDidChangeMarkers((uris) => {
        const editorUri = model.uri.toString();
        if (uris.some((uri) => uri.toString() === editorUri)) {
          const markers = monaco.editor.getModelMarkers({
            resource: model.uri,
          });
          // You can process markers here if needed (e.g., for custom UI elements)
          console.log("Current errors:", markers.length > 0 ? markers : "None");
        }
      });
    }
  };

  const handleFormatCode = () => {
    if (!editorRef.current) return;

    const unformatted = editorRef.current.getValue();
    prettier
      .format(unformatted, {
        parser:
          language === "typescript"
            ? "typescript"
            : language === "html"
              ? "html"
              : "babel",
        plugins: [parserBabel, parserTypeScript, parserHTML, parserEstree],
        singleQuote: true,
        semi: true,
      })
      .then((formatted) => {
        if (!editorRef.current) return;

        // Save current cursor position
        const position = editorRef.current.getPosition();

        editorRef.current.setValue(formatted);

        // Restore cursor position if possible
        if (position) {
          editorRef.current.setPosition(position);
          editorRef.current.revealPositionInCenter(position);
        }
      })
      .catch((err) => {
        console.error("Prettier formatting error:", err);
      });
  };

  // Function to manually validate code and show errors
  const validateCode = () => {
    if (!editorRef.current || !monacoRef.current) return;

    const model = editorRef.current.getModel();
    if (!model) return;

    // Clear existing markers
    monacoRef.current.editor.setModelMarkers(model, "custom-validation", []);

    // Get current code
    const code = model.getValue();

    try {
      // Basic syntax validation (this is just an example)
      // In a real implementation, you might use a proper parser
      if (
        language === "javascript" ||
        language === "typescript" ||
        language === "javascriptreact" ||
        language === "typescriptreact"
      ) {
        // Check for common syntax errors
        if (code.includes("console.log(") && !code.includes(")")) {
          // Example of detecting unclosed parenthesis
          const lineNumber =
            code
              .split("\n")
              .findIndex(
                (line) => line.includes("console.log(") && !line.includes(")"),
              ) + 1;

          if (lineNumber > 0 && monacoRef.current) {
            createMarker(
              monacoRef.current,
              model,
              lineNumber,
              1,
              lineNumber,
              model.getLineMaxColumn(lineNumber),
              "Unclosed parenthesis",
              monacoRef.current.MarkerSeverity.Error,
            );
          }
        }
      }
    } catch (error) {
      console.error("Error during validation:", error);
    }
  };

  // Add effect to validate code when it changes
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        // Set up model change listener for validation
        const disposable = model.onDidChangeContent(() => {
          // Debounce validation to avoid performance issues
          setTimeout(() => validateCode(), 500);
        });

        return () => disposable.dispose();
      }
    }
  }, []);

  // Handle file selection from FileExplorer
  const handleFileSelect = (filePath: string) => {
    setSelectedFile(filePath);

    // If we already have the file content in state, use it
    if (fileContents[filePath]) {
      setCurrentFileContent(fileContents[filePath]);
    } else {
      // In a real implementation, this would fetch the file content from WebContainer
      // For now, we'll use a mock content based on the file extension
      const extension = filePath.split(".").pop()?.toLowerCase();
      let mockContent = "";
      let fileLanguage = "typescript";

      switch (extension) {
        case "js":
          mockContent =
            '// JavaScript file\nconsole.log("Hello from JavaScript");';
          fileLanguage = "javascript";
          break;
        case "jsx":
          mockContent =
            'import React from "react";\n\nconst Component = () => {\n  return <div>Hello from JSX</div>;\n};\n\nexport default Component;';
          fileLanguage = "javascriptreact";
          break;
        case "ts":
          mockContent =
            '// TypeScript file\ninterface User {\n  name: string;\n  age: number;\n}\n\nconst user: User = {\n  name: "John",\n  age: 30\n};\n\nconsole.log(user);';
          fileLanguage = "typescript";
          break;
        case "tsx":
          mockContent =
            'import React from "react";\n\ninterface Props {\n  name: string;\n}\n\nconst Component: React.FC<Props> = ({ name }) => {\n  return <div>Hello, {name}</div>;\n};\n\nexport default Component;';
          fileLanguage = "typescriptreact";
          break;
        case "css":
          mockContent =
            "/* CSS file */\nbody {\n  margin: 0;\n  padding: 0;\n  font-family: sans-serif;\n}\n\n.container {\n  max-width: 1200px;\n  margin: 0 auto;\n}";
          fileLanguage = "css";
          break;
        case "html":
          mockContent =
            '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Document</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>';
          fileLanguage = "html";
          break;
        case "json":
          mockContent =
            '{\n  "name": "project",\n  "version": "1.0.0",\n  "description": "A sample project",\n  "main": "index.js",\n  "scripts": {\n    "start": "node index.js"\n  }\n}';
          fileLanguage = "json";
          break;
        case "md":
          mockContent =
            "# Markdown File\n\n## Introduction\n\nThis is a sample markdown file.\n\n- Item 1\n- Item 2\n- Item 3";
          fileLanguage = "markdown";
          break;
        default:
          mockContent = `// File: ${filePath}\n// This is a mock content for demonstration purposes.`;
      }

      // Update state with the new file content
      setFileContents((prev) => ({ ...prev, [filePath]: mockContent }));
      setCurrentFileContent(mockContent);
      setCurrentLanguage(fileLanguage);
    }
  };

  const getFileLanguage = (fileName: string) => {
    const extension = fileName.split(".").pop()?.toLowerCase();

    switch (extension) {
      case "js":
        return "javascript";
      case "jsx":
        return "javascriptreact";
      case "ts":
        return "typescript";
      case "tsx":
        return "typescriptreact";
      case "css":
        return "css";
      case "html":
        return "html";
      case "json":
        return "json";
      case "md":
        return "markdown";
      default:
        return "javascript";
    }
  };

  // Function to toggle explorer collapse/expand
  const toggleExplorerCollapse = useCallback(() => {
    if (isExplorerCollapsed) {
      // Expand - restore previous width
      setExplorerWidth(previousWidth);
    } else {
      // Collapse - save current width for later restoration
      setPreviousWidth(explorerWidth);
      setExplorerWidth(0);
    }
    setIsExplorerCollapsed(!isExplorerCollapsed);
  }, [isExplorerCollapsed, explorerWidth, previousWidth]);

  //responsible for updating the files to the backend
  const updateFilestoBackend = useCallback(
    async (
      content: string,
      filePath: string,
      currentFile: string,
      projectFiles: string,
    ) => {
      console.log(
        content,
        filePath,
        currentFile,
        projectFiles,
        projectId,
        email.value,
      );
      const response = await fetch(`${API}/updatefiles`, {
        method: "POST",
        body: JSON.stringify({
          content,
          filePath,
          currentFile,
          projectFiles,
          projectId,
          email: email.value,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();
    },
    [],
  );

  // Handle content changes in the editor - use memoized callback to prevent re-renders
  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined && selectedFile) {
        // Don't update state on every keystroke to prevent re-renders
        // Instead, just update the fileContents ref directly
        setCurrentFileContent(value);
        setFileContents((prev) => ({ ...prev, [selectedFile]: value }));

        // Check if content has changed from last saved version
        if (value !== lastSavedContent) {
          setHasUnsavedChanges(true);
        } else {
          setHasUnsavedChanges(false);
        }
      }

      // Call the original onChange handler if provided
      if (onChange) {
        onChange(value);
      }
    },
    [selectedFile, onChange, lastSavedContent],
  );

  // Method to save the current file
  const saveCurrentFile = useCallback(async () => {
    if (currentFile && editorRef.current) {
      const content = editorRef.current.getValue();

      // Check if content has changed since last save
      if (content === lastSavedContent) {
        console.log("No changes to save");
        // Even with no changes, show a quick saved confirmation
        setIsSaved(true);
        setTimeout(() => {
          setIsSaved(false);
        }, 3100);
        return false; // Nothing to save
      }

      // Get file path safely
      let filePath = "/";
      if (currentFile && typeof currentFile === "object") {
        if ("path" in currentFile && typeof currentFile.path === "string") {
          filePath = currentFile.path.startsWith("/")
            ? currentFile.path
            : `/${currentFile.path}`;
        } else if (
          "name" in currentFile &&
          typeof currentFile.name === "string"
        ) {
          filePath = `/${currentFile.name}`;
        }
      }

      const resolvedFilePath =
        previewRuntime === "web"
          ? `/${ensureWorkspacePath(filePath)}`
          : filePath;

      if (process.env.NODE_ENV !== "production") {
        console.log("[EditorFiles] save requested", {
          filePath: resolvedFilePath,
          bytes: content.length,
        });
      }

      updateFilestoBackend(
        content,
        resolvedFilePath,
        JSON.stringify(currentFile),
        JSON.stringify(projectFiles),
      );
      // Use WebContainer to save the file
      const success = await fileSystem.writeFile(resolvedFilePath, content);
      if (process.env.NODE_ENV !== "production") {
        console.log("[EditorFiles] save result", {
          filePath: resolvedFilePath,
          success,
        });
      }

      // If onSave is provided as a prop, call it
      if (onSave) {
        onSave(content);
      }

      // Update last saved content and reset unsaved changes flag
      setLastSavedContent(content);
      setHasUnsavedChanges(false);

      // Show saved confirmation
      setIsSaved(true);

      // Reset saved confirmation after it's displayed
      setTimeout(() => {
        setIsSaved(false);
      }, 3100);

      // Trigger preview refresh after successful save
      if (success) {
        console.log("Triggering preview refresh after file save");
        dispatch(refreshPreview());
      }

      return success;
    }
    return false;
  }, [currentFile, onSave, lastSavedContent, fileSystem]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (!projectData || typeof projectData !== "object") return;
  }, [projectData]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (!currentFile || typeof currentFile !== "object") return;
  }, [currentFile]);

  // Get Redux state and dispatch for actions
  const dispatch = useDispatch();
  const selectedFolderPath = useSelector(
    (state: RootState) => state.projectFiles.selectedFolderPath,
  );

  // Handle file creation and upload operations
  // Open file creation modal with the appropriate type and parent path
  const handleFileOperation = useCallback(
    (type: "file" | "folder") => {
      // Determine the parent path for the new file/folder
      let parentPath = "";

      try {
        if (selectedFolderPath) {
          // Use the selected folder path if available
          parentPath = selectedFolderPath;
        } else if (
          currentFile &&
          typeof currentFile === "object" &&
          "path" in currentFile
        ) {
          // Fallback to the directory of the currently open file
          const pathValue = currentFile.path;
          if (typeof pathValue === "string" && pathValue) {
            // Get directory path by removing file name
            const pathParts = pathValue.split("/").filter(Boolean);
            pathParts.pop(); // Remove the filename
            parentPath = pathParts.join("/");
            console.log(`Using current file's directory: ${parentPath}`);
          }
        }
      } catch (error) {
        console.error("Error processing path:", error);
        parentPath = "";
      }

      // Normalize parentPath - ensure it doesn't start with a slash for internal processing
      if (parentPath.startsWith("/")) {
        parentPath = parentPath.substring(1);
      }

      // Get a clean path that always starts with /
      const cleanPath = parentPath
        ? parentPath.startsWith("/")
          ? parentPath
          : `/${parentPath}`
        : "";

      // Open the custom modal for file/folder creation
      setFileCreationModal({
        isOpen: true,
        type,
        parentPath: cleanPath,
      });
    },
    [currentFile, fileSystem, dispatch, selectedFolderPath],
  );

  // Handle file/folder creation from the modal
  const handleCreateFileOrFolder = useCallback(
    (name: string) => {
      const { type, parentPath } = fileCreationModal;

      // Perform validation checks
      const checkPath = parentPath ? `${parentPath}/${name}` : `/${name}`;
      console.log(`Checking path for duplicates: ${checkPath}`);

      // Use the fileSystemData from Redux to check for duplicates
      if (typeof fileSystemData === "object" && fileSystemData !== null) {
        // Navigate to parent directory to check for duplicates
        let currentNode = fileSystemData as Record<string, any>;
        const pathParts = checkPath.split("/").filter(Boolean);
        const fileName = pathParts.pop(); // Get the filename

        // Navigate through the path
        let pathExists = true;
        for (const part of pathParts) {
          if (currentNode[part] && currentNode[part].directory) {
            currentNode = currentNode[part].directory;
          } else {
            pathExists = false;
            break;
          }
        }

        // Check if file/folder already exists
        if (pathExists && fileName && currentNode[fileName]) {
          alert(
            `A file or folder with name "${name}" already exists in this location.`,
          );
          return;
        }
      }

      if (type === "file") {
        // Path where the file will be created
        const filePath = parentPath ? `${parentPath}/${name}` : `/${name}`;

        // Create empty file
        fileSystem.writeFile(filePath, "").then((success) => {
          if (success) {
            // Auto-select the new file
            const newFile = {
              name: name,
              type: "file",
              contents: "",
              path: filePath.startsWith("/") ? filePath.substring(1) : filePath,
            };
            dispatch(setCurrentFile(newFile));

            // Close the modal
            setFileCreationModal((prev) => ({ ...prev, isOpen: false }));

            // Trigger preview refresh after successful file creation
            console.log("Triggering preview refresh after file creation");
            dispatch(refreshPreview());
          } else {
            alert(`Failed to create file "${name}"`);
          }
        });
      } else {
        // Path where the folder will be created
        const folderPath = parentPath ? `${parentPath}/${name}` : `/${name}`;

        // Create directory
        fileSystem.mkdir(folderPath, { recursive: true }).then((success) => {
          if (success) {
            // Close the modal
            setFileCreationModal((prev) => ({ ...prev, isOpen: false }));

            // Trigger preview refresh after successful folder creation
            console.log("Triggering preview refresh after folder creation");
            dispatch(refreshPreview());
          } else {
            alert(`Failed to create folder "${name}"`);
          }
        });
      }
    },
    [fileCreationModal, fileSystemData, fileSystem, dispatch],
  );

  // Handle file upload
  const handleFileUpload = useCallback(() => {
    // Create a hidden file input
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.style.display = "none";

    // Get the current path for context - handle safely
    let currentPath = "";

    try {
      if (
        currentFile &&
        typeof currentFile === "object" &&
        "path" in currentFile
      ) {
        const pathValue = currentFile.path;
        if (typeof pathValue === "string" && pathValue) {
          // Get directory path by removing file name
          const pathParts = pathValue.split("/").filter(Boolean);
          pathParts.pop(); // Remove the filename
          currentPath = pathParts.join("/");
        }
      }
    } catch (error) {
      console.error("Error processing path:", error);
      currentPath = "";
    }

    // Get a clean path that always starts with /
    const cleanPath = currentPath
      ? currentPath.startsWith("/")
        ? currentPath
        : `/${currentPath}`
      : "";

    // Append to DOM
    document.body.appendChild(fileInput);

    // Listen for file selection
    fileInput.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      const files = target.files;

      if (files && files.length > 0) {
        // Upload the file to WebContainer
        fileSystem.uploadFile(files[0], cleanPath).then((success) => {
          console.log(
            success
              ? `File "${files[0].name}" uploaded successfully`
              : `Failed to upload file "${files[0].name}"`,
          );

          // Trigger preview refresh after successful file upload
          if (success) {
            console.log("Triggering preview refresh after file upload");
            dispatch(refreshPreview());
          }
          // No alerts needed - the UI will update automatically when the file appears in the explorer
        });
      }

      // Clean up
      document.body.removeChild(fileInput);
    });

    // Trigger file input click
    fileInput.click();
  }, [currentFile, fileSystem]);

  // Update the lastSavedContent when a new file is loaded
  useEffect(() => {
    if (currentFile && currentFileContent) {
      setLastSavedContent(currentFileContent);
      setHasUnsavedChanges(false);
    }
  }, [currentFile?.name]); // Only run when a different file is selected

  // Add keyboard shortcut for saving
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+S or Cmd+S
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault(); // Prevent default browser save
        saveCurrentFile();
        console.log("Saved current file");
      }
    };

    // Add global event listener
    document.addEventListener("keydown", handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [saveCurrentFile]);

  // Handle navigation when clicking breadcrumbs
  const handleBreadcrumbNavigation = useCallback((path: string) => {
    // If it's a file, select it
    console.log("Navigate to file:", path);
    if (path.includes(".")) {
      handleFileSelect(path);
    } else {
      // If it's a directory, you might want to expand it in the file explorer
      // This would require updating your FileExplorer component to accept a prop for expanding paths
      console.log("Navigate to directory:", path);
    }
  }, []);

  // --- ADDED: Handler to prevent context menu ---
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault(); // This stops the default browser menu
    console.log("Default context menu prevented on editor area.");
    // You could add logic here to show a custom menu if needed
  };

  useEffect(() => {
    // Prevent infinite loop by checking if we've already loaded this file
    const fileKey =
      currentFile && typeof currentFile === "object" && "name" in currentFile
        ? currentFile.name
        : null;

    // Skip if we've already loaded this file
    if (!fileKey || (selectedFile === fileKey && currentFileContent !== "")) {
      return;
    }

    // Make sure currentFile exists and is a proper FileEntry with a name
    // Get content from Redux and local state
    const fileContentFromRedux =
      currentFile &&
      typeof currentFile === "object" &&
      "contents" in currentFile &&
      typeof currentFile.contents === "string"
        ? currentFile.contents
        : undefined;
    const fileContentFromState = fileContents[fileKey];

    // Prefer Redux content if available and different
    if (
      fileContentFromRedux !== undefined &&
      currentFileContent !== fileContentFromRedux
    ) {
      setCurrentFileContent(fileContentFromRedux);
      if (fileContentFromState !== fileContentFromRedux) {
        setFileContents((prev) => ({
          ...prev,
          [fileKey]: fileContentFromRedux || "",
        }));
      }
      setSelectedFile(fileKey);
      return;
    }

    // If we have local state content, use it
    if (fileContentFromState && currentFileContent !== fileContentFromState) {
      setCurrentFileContent(fileContentFromState);
      setSelectedFile(fileKey);
      return;
    }

    // Otherwise, generate mock content based on extension
    if (!fileContentFromRedux && !fileContentFromState) {
      const fileName = currentFile?.name || "";
      const extension = fileName.split(".").pop()?.toLowerCase();
      let mockContent = "";
      let fileLanguage = "typescript";
      switch (extension) {
        case "js":
          mockContent =
            '// JavaScript file\nconsole.log("Hello from JavaScript");';
          fileLanguage = "javascript";
          break;
        case "jsx":
          mockContent =
            'import React from "react";\n\nconst Component = () => {\n  return <div>Hello from JSX</div>;\n};\n\nexport default Component;';
          fileLanguage = "javascriptreact";
          break;
        case "ts":
          mockContent =
            '// TypeScript file\ninterface User {\n  name: string;\n  age: number;\n}\n\nconst user: User = {\n  name: "John",\n  age: 30\n};\n\nconsole.log(user);';
          fileLanguage = "typescript";
          break;
        case "tsx":
          mockContent =
            'import React from "react";\n\ninterface Props {\n  name: string;\n}\n\nconst Component: React.FC<Props> = ({ name }) => {\n  return <div>Hello, {name}</div>;\n};\n\nexport default Component;';
          fileLanguage = "typescriptreact";
          break;
        case "css":
          mockContent =
            "/* CSS file */\nbody {\n  margin: 0;\n  padding: 0;\n  font-family: sans-serif;\n}\n\n.container {\n  max-width: 1200px;\n  margin: 0 auto;\n}";
          fileLanguage = "css";
          break;
        case "html":
          mockContent =
            '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Document</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>';
          fileLanguage = "html";
          break;
        case "json":
          mockContent =
            '{\n  "name": "project",\n  "version": "1.0.0",\n  "description": "A sample project",\n  "main": "index.js",\n  "scripts": {\n    "start": "node index.js"\n  }\n}';
          fileLanguage = "json";
          break;
        case "md":
          mockContent =
            "# Markdown File\n\n## Introduction\n\nThis is a sample markdown file.\n\n- Item 1\n- Item 2\n- Item 3";
          fileLanguage = "markdown";
          break;
        default:
          mockContent = `// File: ${fileName}`;
      }
      setFileContents((prev) => ({
        ...prev,
        [fileKey]: mockContent,
      }));
      setCurrentFileContent(mockContent);
      setCurrentLanguage(fileLanguage);
      setSelectedFile(fileKey);
    }
  }, [currentFile, fileContents, selectedFile, currentFileContent]);

  // Helper function to check if a file is a media file based on extension
  const isMediaFileType = useCallback((filename: string) => {
    if (!filename) return false;

    const extension = filename.split(".").pop()?.toLowerCase() || "";
    return [
      // Images
      "jpg",
      "jpeg",
      "png",
      "gif",
      "svg",
      "webp",
      // Videos
      "mp4",
      "webm",
      "ogg",
      "mov",
      // Audio
      "mp3",
      "wav",
      // Documents
      "pdf",
      "doc",
      "docx",
    ].includes(extension);
  }, []);

  // When the currentFile changes, update the editor content and check if it's a media file
  useEffect(() => {
    if (!currentFile) return;

    if ("name" in currentFile) {
      // Check if this is a media file
      const isMedia = isMediaFileType(currentFile.name);
      setIsMediaFile(isMedia);
    } else {
      setIsMediaFile(false);
    }

    if ("contents" in currentFile) {
      const content = currentFile.contents;
      if (typeof content === "string") {
        setCurrentFileContent(content);
      } else if (content && typeof content === "object") {
        // Handle case where content might be an object (e.g. from API)
        setCurrentFileContent(JSON.stringify(content, null, 2));
      } else {
        setCurrentFileContent(String(content || ""));
      }
    }
  }, [currentFile, isMediaFileType]);

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex justify-start items-center border-b border-[#2a2a2a]">
        {/* Search Header - width synchronized with explorer */}
        <div
          className="border-r px-1 h-7 border-[#2a2a2a] font-normal text-xs gap-x-1 text-[#949494] flex items-center justify-between sticky top-0 bg-[#141415] z-10"
          style={{
            width: isExplorerCollapsed ? "28px" : `${explorerWidth}%`,
            transition: "width 150ms ease",
          }}
        >
          {/* Toggle Explorer Button */}
          {/* <button
            className="text-[#949494] hover:text-white transition-colors p-1"
            onClick={toggleExplorerCollapse}
            title={isExplorerCollapsed ? "Show Explorer" : "Hide Explorer"}
          >
            {isExplorerCollapsed ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="13 17 18 12 13 7"></polyline>
                <polyline points="6 17 11 12 6 7"></polyline>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="11 17 6 12 11 7"></polyline>
                <polyline points="18 17 13 12 18 7"></polyline>
              </svg>
            )}
          </button> */}

          {/* Icon + Input Wrapper - Only show when not collapsed */}
          {!isExplorerCollapsed && (
            <div className="flex flex-grow items-center justify-between overflow-hidden" />
          )}
        </div>

        {/* Editor Header */}
        <EditorHeader
          currentFilePath={currentFilePath}
          onNavigate={handleBreadcrumbNavigation}
          onSave={saveCurrentFile}
          isSaved={isSaved}
        />
      </div>

      {/* File Creation Modal */}
      <FileCreationModal
        isOpen={fileCreationModal.isOpen}
        onClose={() =>
          setFileCreationModal((prev) => ({ ...prev, isOpen: false }))
        }
        type={fileCreationModal.type}
        parentPath={fileCreationModal.parentPath}
        onConfirm={handleCreateFileOrFolder}
      />

      <div ref={containerRef} className="relative flex h-full w-full">
        {/* File Explorer with dynamic width */}
        <div
          className="h-full overflow-auto"
          style={{
            width: isExplorerCollapsed ? "28px" : `${explorerWidth}%`,
            transition: "width 150ms ease",
            overflow: isExplorerCollapsed ? "hidden" : "auto",
          }}
        >
          <FileExplorer />
        </div>

        {/* Drag handle */}
        <div
          ref={dividerRef}
          className={`h-full cursor-col-resize transition-all duration-150 ${
            isHovering || isDragging
              ? "w-1 bg-[#4a4a4a]"
              : "w-px bg-transparent"
          }`}
          onMouseDown={handleDragStart}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          style={{
            userSelect: "none",
            borderRight:
              isHovering || isDragging ? "none" : "1px solid #2a2a2a",
            position: "relative",
          }}
        >
          {/* Invisible touch target overlay */}
          <div
            className="absolute top-0 bottom-0 -left-2 w-5"
            style={{
              zIndex: 5,
            }}
          />
        </div>

        {/* Code Editor / Media Viewer container with dynamic width */}
        <div
          className="h-full flex flex-col bg-[#141415]"
          style={{
            width: isExplorerCollapsed
              ? "calc(100% - 28px - 1px)"
              : `calc(100% - ${explorerWidth}% - ${isHovering || isDragging ? "8px" : "1px"})`,
            transition: "width 150ms ease",
          }}
          onContextMenu={handleContextMenu}
        >
          <div className="flex-grow relative bg-[#141415]">
            {/* Main container */}
            <div className="absolute inset-0">
              {isMediaFile && currentFile && "path" in currentFile ? (
                /* Media Viewer for images, videos, PDFs, etc. */
                <div className="h-full w-full">
                  <MediaViewer file={currentFile as UIFileEntry} />
                </div>
              ) : (
                /* Monaco Editor for code files */
                <MonacoEditor
                  height="100%"
                  defaultLanguage="javascript"
                  language={currentLanguage}
                  value={currentFileContent}
                  theme="superblocks-dark"
                  onChange={handleEditorChange}
                  onMount={handleEditorMountWrapper}
                  options={{
                    minimap: { enabled: true },
                    fontSize: 12,
                    lineHeight: 21,
                    formatOnPaste: true,
                    formatOnType: true,
                    scrollBeyondLastLine: false,
                    wordWrap: "on",
                    wrappingIndent: "indent",
                    automaticLayout: true,
                    tabSize: 2,
                    scrollbar: {
                      vertical: "visible",
                      horizontal: "visible",
                    },
                    showUnused: true,
                    quickSuggestions: true,
                    autoClosingBrackets: "always",
                    acceptSuggestionOnEnter: "smart",
                    accessibilitySupport: "off",
                    fontFamily: "Fira Code, monospace",
                    lineNumbers: "on",
                    folding: true,
                    suggest: {
                      showWords: true,
                      showSnippets: true,
                    },
                    renderValidationDecorations: "on",
                    glyphMargin: true,
                    "semanticHighlighting.enabled": true,
                    autoIndent: "full",
                    padding: {
                      top: 8,
                      bottom: 8,
                    },
                    lineDecorationsWidth: 0,
                    lineNumbersMinChars: 2,
                  }}
                />
              )}
            </div>

            {/* No file selected message */}
            <div
              className="absolute inset-0 z-20 flex items-center justify-center bg-[#141415] text-gray-400"
              style={{
                opacity: !(
                  currentFile &&
                  typeof currentFile === "object" &&
                  "name" in currentFile &&
                  typeof currentFile.name === "string"
                )
                  ? 1
                  : 0,
                transition: "opacity 150ms ease",
                pointerEvents: !(
                  currentFile &&
                  typeof currentFile === "object" &&
                  "name" in currentFile &&
                  typeof currentFile.name === "string"
                )
                  ? "auto"
                  : "none",
              }}
            >
              <div className="text-center p-6">
                <h3 className="text-lg font-medium mb-2 font-[insSerifIt]">
                  Ask the agent to make changes!
                </h3>
              </div>
            </div>
          </div>
        </div>

        {/* Overlay to prevent interaction during resizing */}
        {isDragging && (
          <div
            className="fixed inset-0 z-50 cursor-col-resize bg-transparent"
            style={{ userSelect: "none" }}
          />
        )}
      </div>
    </div>
  );
};

export default React.memo(CodeEditor);
