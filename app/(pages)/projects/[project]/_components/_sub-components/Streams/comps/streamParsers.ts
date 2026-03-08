import { decodeJsonString } from "./streamHelpers";

// PERFORMANCE OPTIMIZATIONS: Enhanced parsing with better regex and chunk processing
export function parseStepsFromContent(content: string): {
  steps: string[];
  isComplete: boolean;
} {
  const steps: string[] = [];

  // Early return if content is too small
  if (content.length < 10) return { steps, isComplete: false };

  // Find the start of the array more efficiently
  const arrayStartIndex = content.indexOf("[");
  if (arrayStartIndex === -1) return { steps, isComplete: false };

  // Find where generatedFiles starts (if it exists) to limit search scope
  const genFilesIndex = content.indexOf('"generatedFiles"');
  const searchEndIndex = genFilesIndex !== -1 ? genFilesIndex : content.length;

  // Early return if section is too small
  if (searchEndIndex - arrayStartIndex < 5) return { steps, isComplete: false };

  // Extract the section we want to parse
  const stepsSection = content.slice(arrayStartIndex, searchEndIndex);

  // Check if steps array is complete
  const isComplete = stepsSection.includes("]");

  // Optimized regex for quoted strings with better performance
  // This regex handles escaped quotes more efficiently
  const quotedStringRegex = /"((?:[^"\\]|\\.)*)"/g;
  const seenSteps = new Set<string>();
  const matches = stepsSection.matchAll(quotedStringRegex);

  for (const match of matches) {
    let stepContent = match[1];
    if (!stepContent) continue;

    // Clean up the step content in one pass
    stepContent = stepContent
      .replace(/useResponse\.tsx:\d+\s*/g, "") // Remove file references
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();

    // Enhanced filtering with better performance checks
    if (
      stepContent.length > 10 &&
      stepContent.length < 200 && // Reasonable step length
      !stepContent.includes("{") &&
      !stepContent.includes("}") &&
      !stepContent.includes("[") &&
      !stepContent.includes("]") &&
      !seenSteps.has(stepContent)
    ) {
      seenSteps.add(stepContent);
      steps.push(stepContent);

      // Limit steps to prevent memory issues with large streams
      if (steps.length >= 50) break;
    }
  }

  return { steps, isComplete };
}

export function parseCodeBlocksFromContent(content: string): {
  potentialPaths: { filePath: string; id: string }[];
  completeBlocks: { filePath: string; codeContent: string; id: string }[];
} {
  const potentialPaths: { filePath: string; id: string }[] = [];
  const completeBlocks: {
    filePath: string;
    codeContent: string;
    id: string;
  }[] = [];

  // Early return for small content
  if (content.length < 20) return { potentialPaths, completeBlocks };

  // More efficient search for generatedFiles section
  const genFilesMatch = content.match(/"generatedFiles"\s*:\s*\{/);
  if (!genFilesMatch || !genFilesMatch.index)
    return { potentialPaths, completeBlocks };

  const genFilesStart = genFilesMatch.index + genFilesMatch[0].length;
  let genFilesContent = content.slice(genFilesStart);

  // Early return if section is too small
  if (genFilesContent.length < 10) return { potentialPaths, completeBlocks };

  // Clean up content once
  genFilesContent = genFilesContent.replace(/useResponse\.tsx:\d+\s*/g, "");

  const seenPaths = new Set<string>();
  const potentialIndex = 0;

  // Enhanced regex for complete file blocks with better performance
  // This regex is more specific and handles nested structures better
  const completeFileRegex =
    /"([^"\\]+\.[a-zA-Z0-9]+)"\s*:\s*\{\s*"code"\s*:\s*"((?:[^"\\]|\\[\s\S])*)"\s*\}/g;

  const completeMatches = genFilesContent.matchAll(completeFileRegex);

  for (const match of completeMatches) {
    const filePath = match[1];
    let codeContent = match[2];

    if (filePath && codeContent && !seenPaths.has(filePath)) {
      seenPaths.add(filePath);

      potentialPaths.push({ filePath, id: filePath }); // Use filePath as ID

      // Decode the code content
      codeContent = decodeJsonString(codeContent);
      completeBlocks.push({
        filePath,
        codeContent,
        id: filePath, // Use filePath as ID
      });
    }

    // Limit to prevent memory issues
    if (potentialPaths.length >= 100) break;
  }

  // Enhanced regex for potential file paths
  const pathOnlyRegex = /"([^"\\]+\.[a-zA-Z0-9]+)"\s*:\s*\{/g;
  const pathMatches = genFilesContent.matchAll(pathOnlyRegex);

  for (const match of pathMatches) {
    const filePath = match[1];
    if (filePath && !seenPaths.has(filePath)) {
      seenPaths.add(filePath);
      potentialPaths.push({
        filePath,
        id: filePath, // Use filePath as ID
      });
    }

    // Limit to prevent memory issues
    if (potentialPaths.length >= 100) break;
  }

  return { potentialPaths, completeBlocks };
}

export function parseFilesListFromContent(content: string): {
  fileList: string[];
  filesCount: number;
} {
  const fileList: string[] = [];
  let filesCount = 0;

  // Early return for small content
  if (content.length < 15) return { fileList, filesCount };

  // Parse filesCount first with more specific regex
  const filesCountMatch = content.match(/"filesCount"\s*:\s*(\d+)/);
  if (filesCountMatch?.[1]) {
    filesCount = parseInt(filesCountMatch[1], 10);
  }

  // Enhanced regex for files array with better boundary detection
  const filesArrayMatch = content.match(/"files"\s*:\s*\[([\s\S]*?)(?:\]|$)/);
  if (filesArrayMatch && filesArrayMatch[1]) {
    const filesContent = filesArrayMatch[1];

    // More specific regex for file paths
    const filePathRegex =
      /"([^"\\]*(?:\\.[^"\\]*)*\.(?:js|jsx|ts|tsx|py|java|c|cpp|cs|html|css|scss|less|json|yaml|yml|md|sh|toml|txt|xml|svg|png|jpg|jpeg|gif|ico|woff|woff2|ttf|otf)[^"\\]*)"/gi;

    const matches = filesContent.matchAll(filePathRegex);

    for (const match of matches) {
      const filePath = match[1];

      // Enhanced validation for file paths
      if (
        filePath &&
        filePath.includes(".") &&
        (filePath.includes("/") || filePath.includes("\\")) &&
        filePath.length > 3 && // Minimum reasonable path length
        filePath.length < 500 // Maximum reasonable path length
      ) {
        fileList.push(filePath);

        // Limit to prevent memory issues
        if (fileList.length >= 500) break;
      }
    }
  }

  return { fileList, filesCount };
}
