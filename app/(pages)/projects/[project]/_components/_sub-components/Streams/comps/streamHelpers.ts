// --- Helper to Decode JSON String Escapes ---
export function decodeJsonString(str: string | null | undefined): string {
  if (!str) return "";
  try {
    // Use a single replace with a function for better performance
    return str.replace(/\\(n|"|t|r|f|b|\\)/g, (match, char) => {
      switch (char) {
        case "n":
          return "\n";
        case '"':
          return '"';
        case "t":
          return "\t";
        case "r":
          return "\r";
        case "f":
          return "\f";
        case "b":
          return "\b";
        case "\\":
          return "\\";
        default:
          return match;
      }
    });
  } catch (e) {
    console.error("Error decoding string:", e);
    return str;
  }
}

// --- Helper to guess language from file path ---
const languageMap: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  java: "java",
  c: "c",
  cpp: "cpp",
  cs: "csharp",
  html: "markup",
  css: "css",
  scss: "scss",
  less: "less",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  md: "markdown",
  sh: "bash",
  toml: "toml",
};

export function guessLanguage(filePath: string): string {
  const lastDotIndex = filePath.lastIndexOf(".");
  if (lastDotIndex === -1) return "plaintext";

  const extension = filePath.slice(lastDotIndex + 1).toLowerCase();
  return languageMap[extension] || "plaintext";
}
