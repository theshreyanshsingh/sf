import dynamic from "next/dynamic";
import React, { memo, useCallback } from "react";
import type * as monacoEditor from "monaco-editor";
import { RootState } from "@/app/redux/store";
import { useSelector } from "react-redux";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});

const Playground = () => {
  const { currentFile } = useSelector((state: RootState) => state.projectFiles);

  // editor mount
  const handleEditorDidMount = (
    editor: monacoEditor.editor.IStandaloneCodeEditor,
    monaco: typeof monacoEditor
  ) => {
    //edtior options
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

    // define the theme
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
        "editor.background": "#141415",
        "minimap.background": "#1b1b1c",
      },
    });

    //set the theme
    monaco.editor.setTheme("superblocks-dark");

    // Cmd+S or Ctrl+S to format and save code
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      const currentValue = editor.getValue();
      console.log(currentValue, "save");
      //   onSave?.(currentValue);
    });

    //listening for errors
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

  // writing changes
  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      console.log(value);
    }

    // Call the original onChange handler if provided
    //   if (onChange) {
    //     onChange(value);
    //   }
  }, []);

  return (
    <>
      <MonacoEditor
        height="100%"
        defaultLanguage="javascript"
        language={"javascript"}
        value={JSON.stringify(currentFile)}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
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
    </>
  );
};

export default memo(Playground);
