"use client";

import {
  MOBILE_SNACK_BLOCKED_DEPENDENCIES,
  PREVIEW_SDK_54_CORE_DEPENDENCIES,
  isValidNpmPackageNameForSnack,
} from "@/default/mobile";
import type { PreviewRuntime } from "@/default/mobile";

type RawFileWrite = {
  path: string;
  content: string;
};

type NormalizedFileWrite = {
  path: string;
  content: string;
};

const SOURCE_FILE_REGEX = /\.(js|jsx|ts|tsx|mjs|cjs)$/i;
const PACKAGE_EXTENSION_SUFFIX_REGEX = /\.(cjs|mjs|js|jsx|ts|tsx)$/i;
const IMPORT_EXPORT_SPECIFIER_REGEX =
  /(\b(?:import|export)\s*(?:[^"'`]*?\s+from\s*)?)(["'])([^"']+)\2/g;
const REQUIRE_SPECIFIER_REGEX = /(require\s*\(\s*)(["'])([^"']+)\2(\s*\))/g;
const DYNAMIC_IMPORT_SPECIFIER_REGEX =
  /(import\s*\(\s*)(["'])([^"']+)\2(\s*\))/g;
const BUILTIN_MODULES = new Set<string>([
  "assert",
  "buffer",
  "child_process",
  "crypto",
  "dns",
  "events",
  "fs",
  "http",
  "https",
  "module",
  "net",
  "os",
  "path",
  "process",
  "stream",
  "timers",
  "tls",
  "url",
  "util",
  "worker_threads",
  "zlib",
]);

const MODULE_ALIAS_PREFIXES = ["@/", "~/", "~~/", "#/", "virtual:"];
const LOCAL_SOURCE_ROOT_PREFIXES = new Set<string>([
  "src",
  "app",
  "assets",
  "components",
  "context",
  "screens",
  "utils",
  "hooks",
  "services",
  "lib",
  "api",
  "data",
  "theme",
  "navigation",
  "store",
  "redux",
]);

const SPECIFIER_MAP: Record<string, string> = {
  "react/jsx-runtime": "react",
  "react/jsx-dev-runtime": "react",
  "react-dom/client": "react-dom",
  "react-dom/server": "react-dom",
};

const DEFAULT_AUTO_DEPENDENCY_VERSION = "*";
const MOBILE_DEPENDENCY_NAMES = new Set<string>([
  "expo",
  "react-native",
  "expo-router",
]);
const WEB_DEPENDENCY_NAMES = new Set<string>([
  "next",
  "react-dom",
  "vite",
  "webpack",
  "@vitejs/plugin-react",
  "react-scripts",
  "nuxt",
  "astro",
  "svelte",
  "@sveltejs/kit",
]);
const KNOWN_PEER_DEPENDENCIES: Record<string, Record<string, string>> = {
  "@react-navigation/native": {
    "react-native-screens": "~4.10.0",
    "react-native-safe-area-context": "~5.4.0",
  },
  "@react-navigation/stack": {
    "react-native-gesture-handler": "~2.24.0",
    "@react-native-masked-view/masked-view": "~0.3.2",
  },
  "@react-navigation/drawer": {
    "react-native-gesture-handler": "~2.24.0",
    "react-native-reanimated": "~3.17.0",
  },
  "@react-navigation/bottom-tabs": {
    "react-native-screens": "~4.10.0",
    "react-native-safe-area-context": "~5.4.0",
  },
  "expo-camera": {
    "expo-media-library": "*",
  },
  "expo-image-picker": {
    "expo-media-library": "*",
  },
};

const WRAPPED_CONTENT_KEYS = [
  "code",
  "content",
  "contents",
  "text",
  "value",
] as const;
const MAX_CONTENT_UNWRAP_PASSES = 4;
const SCOPED_PACKAGE_WITH_EXTENSION_REGEX =
  /(@[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+)\.(?:cjs|mjs|js|jsx|ts|tsx)\b/g;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizeWorkspacePath = (filePath: string): string =>
  filePath
    .trim()
    .replace(/^\/workspace\//, "")
    .replace(/^workspace\//, "")
    .replace(/^\/+/, "");

const extractWrappedContent = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (!isObject(value)) return null;

  for (const key of WRAPPED_CONTENT_KEYS) {
    const candidate = value[key];
    if (typeof candidate === "string") return candidate;
  }

  if (isObject(value.file)) {
    const fileNode = value.file as Record<string, unknown>;
    for (const key of WRAPPED_CONTENT_KEYS) {
      const candidate = fileNode[key];
      if (typeof candidate === "string") return candidate;
    }
  }

  return null;
};

const tryParseJsonString = (value: string): unknown | null => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const tryDecodeSingleQuotedString = (value: string): string | null => {
  const trimmed = value.trim();
  if (!(trimmed.startsWith("'") && trimmed.endsWith("'"))) return null;
  const inner = trimmed.slice(1, -1);
  if (!inner) return "";

  const jsonEscaped = inner.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  try {
    return JSON.parse(`"${jsonEscaped}"`);
  } catch {
    return inner;
  }
};

export const normalizeIncomingFileContent = (rawContent: string): string => {
  if (typeof rawContent !== "string") return "";

  let current = rawContent;
  for (let pass = 0; pass < MAX_CONTENT_UNWRAP_PASSES; pass += 1) {
    const trimmed = current.trim();
    if (!trimmed) break;

    // Only unwrap double-stringified values (e.g. '"actual content"').
    // Do NOT parse JSON objects/arrays — those are valid file content
    // (e.g. package.json, config files) and unwrapping them via
    // extractWrappedContent corrupts files that have keys like
    // "content", "code", "value", etc.
    const isDoubleStringified =
      trimmed.startsWith('"') && trimmed.endsWith('"');

    if (isDoubleStringified) {
      const parsed = tryParseJsonString(trimmed);
      if (parsed !== null && typeof parsed === "string") {
        if (parsed === current) break;
        current = parsed;
        continue;
      }
    }

    const singleQuoted = tryDecodeSingleQuotedString(trimmed);
    if (singleQuoted !== null) {
      if (singleQuoted === current) break;
      current = singleQuoted;
      continue;
    }

    break;
  }

  return current;
};

const asFileWrite = (value: unknown): RawFileWrite | null => {
  if (!isObject(value)) return null;

  const rawPath =
    "path" in value
      ? value.path
      : "file" in value
        ? value.file
        : "name" in value
          ? value.name
          : null;
  const rawContent =
    "content" in value
      ? value.content
      : "contents" in value
        ? value.contents
        : "code" in value
          ? value.code
        : null;

  if (typeof rawPath !== "string" || typeof rawContent !== "string") {
    return null;
  }

  return {
    path: rawPath,
    content: rawContent,
  };
};

const toFileWriteArray = (value: unknown): RawFileWrite[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => asFileWrite(entry))
      .filter((entry): entry is RawFileWrite => Boolean(entry));
  }

  const single = asFileWrite(value);
  return single ? [single] : [];
};

const parseFileWrite = (write: RawFileWrite): NormalizedFileWrite | null => {
  if (!isObject(write)) return null;
  if (typeof write.path !== "string" || typeof write.content !== "string") {
    return null;
  }
  const normalizedPath = normalizeWorkspacePath(write.path.trim());
  if (!normalizedPath) return null;
  const normalizedContent = normalizeIncomingFileContent(write.content);
  return {
    path: normalizedPath,
    content: normalizedContent,
  };
};

const isLikelySourceFilePath = (filePath: string): boolean => {
  const normalized = normalizeWorkspacePath(filePath).toLowerCase();
  if (!SOURCE_FILE_REGEX.test(normalized)) return false;
  if (normalized.endsWith(".d.ts")) return false;
  if (normalized.includes("node_modules/")) return false;
  return true;
};

const stripSpecifierDecorators = (rawSpecifier: string): string => {
  let clean = rawSpecifier.trim();
  let removedDecorator = false;
  if (clean.startsWith("module://")) {
    clean = clean.slice("module://".length);
    removedDecorator = true;
  } else if (clean.startsWith("module:")) {
    clean = clean.slice("module:".length);
    removedDecorator = true;
  } else if (clean.startsWith("npm:")) {
    clean = clean.slice("npm:".length);
    removedDecorator = true;
  } else if (clean.startsWith("jsr:")) {
    clean = clean.slice("jsr:".length);
    removedDecorator = true;
  }
  clean = clean.split("?")[0] ?? clean;
  clean = clean.split("#")[0] ?? clean;
  if (removedDecorator && clean.startsWith("/@")) {
    clean = clean.replace(/^\/+/, "");
  }
  return clean.trim();
};

const isLikelyRelativeSpecifier = (specifier: string): boolean =>
  specifier.startsWith(".") || specifier.startsWith("/");

const isLikelyExternalSpecifier = (specifier: string): boolean => {
  if (!specifier) return false;
  if (isLikelyRelativeSpecifier(specifier)) return false;
  if (
    specifier.startsWith("http://") ||
    specifier.startsWith("https://") ||
    specifier.startsWith("data:") ||
    specifier.startsWith("node:")
  ) {
    return false;
  }
  if (MODULE_ALIAS_PREFIXES.some((prefix) => specifier.startsWith(prefix))) {
    return false;
  }
  return true;
};

const normalizePackageName = (specifier: string): string | null => {
  if (!specifier) return null;
  const mappedSpecifier = SPECIFIER_MAP[specifier] || specifier;
  if (!isLikelyExternalSpecifier(mappedSpecifier)) return null;

  if (mappedSpecifier.startsWith("@")) {
    const [scope, name] = mappedSpecifier.split("/");
    if (!scope || !name) return null;
    const cleanName = name.replace(PACKAGE_EXTENSION_SUFFIX_REGEX, "");
    if (!cleanName) return null;
    return `${scope}/${cleanName}`;
  }

  const [name] = mappedSpecifier.split("/");
  if (!name) return null;
  return name.replace(PACKAGE_EXTENSION_SUFFIX_REGEX, "") || null;
};

const collectDependencySpecifiersFromSource = (content: string): Set<string> => {
  const specifiers = new Set<string>();

  const collectFromRegex = (regex: RegExp, groupIndex: number) => {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content))) {
      const rawSpecifier = match[groupIndex];
      if (!rawSpecifier) continue;
      const cleanSpecifier = stripSpecifierDecorators(rawSpecifier);
      if (!cleanSpecifier) continue;
      specifiers.add(cleanSpecifier);
    }
  };

  collectFromRegex(IMPORT_EXPORT_SPECIFIER_REGEX, 3);
  collectFromRegex(REQUIRE_SPECIFIER_REGEX, 3);
  collectFromRegex(DYNAMIC_IMPORT_SPECIFIER_REGEX, 3);

  return specifiers;
};

const inferDependenciesFromSource = (content: string): Set<string> => {
  const dependencies = new Set<string>();
  const specifiers = collectDependencySpecifiersFromSource(content);

  specifiers.forEach((specifier) => {
    const packageName = normalizePackageName(specifier);
    if (!packageName) return;
    if (BUILTIN_MODULES.has(packageName)) return;

    const firstSegment = packageName.split("/")[0];
    if (LOCAL_SOURCE_ROOT_PREFIXES.has(firstSegment)) return;
    dependencies.add(packageName);
  });

  return dependencies;
};

const parsePackageJsonDependencies = (
  content: string,
): Record<string, string | null> => {
  try {
    const parsed = JSON.parse(content);
    if (!isObject(parsed)) return {};

    const devDeps = isObject(parsed.devDependencies) ? parsed.devDependencies : {};
    const deps = isObject(parsed.dependencies) ? parsed.dependencies : {};
    const nextDependencies = { ...devDeps, ...deps };

    const updates: Record<string, string | null> = {};
    Object.keys(PREVIEW_SDK_54_CORE_DEPENDENCIES).forEach((name) => {
      const value = nextDependencies[name];
      if (typeof value === "string" && value.trim()) {
        updates[name] = value.trim();
      } else {
        updates[name] = PREVIEW_SDK_54_CORE_DEPENDENCIES[name];
      }
    });

    Object.entries(nextDependencies).forEach(([name, value]) => {
      const normalizedName = normalizeDependencySpecifier(name);
      if (!normalizedName) return;
      if (!isValidNpmPackageNameForSnack(normalizedName)) return;
      if (MOBILE_SNACK_BLOCKED_DEPENDENCIES.has(normalizedName)) return;
      if (typeof value !== "string" || !value.trim()) return;
      updates[normalizedName] = value.trim();
    });
    return updates;
  } catch {
    return {};
  }
};

const parseDependencyUpdates = (value: unknown): Record<string, string | null> => {
  if (!isObject(value)) return {};
  const updates: Record<string, string | null> = {};

  const sources: Array<Record<string, unknown>> = [];
  const pushSource = (candidate: unknown) => {
    if (isObject(candidate)) sources.push(candidate as Record<string, unknown>);
  };

  pushSource(value.updates);
  pushSource(value.dependencies);
  pushSource(value.missingDependencies);
  pushSource(value.result);

  if (isObject(value.result)) {
    pushSource(value.result.updates);
    pushSource(value.result.dependencies);
    pushSource(value.result.missingDependencies);
    if (isObject(value.result.metadata)) {
      pushSource(value.result.metadata.dependencies);
      pushSource(value.result.metadata.missingDependencies);
    }
  }

  if (!sources.length) {
    pushSource(value);
  }

  sources.forEach((updatesSource) => {
    Object.entries(updatesSource).forEach(([name, depValue]) => {
      const normalizedName = normalizeDependencySpecifier(name);
      if (!normalizedName) return;

      if (depValue === null) {
        updates[normalizedName] = null;
        return;
      }

      if (typeof depValue === "string") {
        const normalizedVersion = depValue.trim();
        if (normalizedVersion) updates[normalizedName] = normalizedVersion;
        return;
      }

      if (isObject(depValue)) {
        const maybeAction = depValue.action;
        const maybeVersion =
          typeof depValue.version === "string" ? depValue.version.trim() : null;
        const maybeWantedVersion =
          typeof depValue.wantedVersion === "string"
            ? depValue.wantedVersion.trim()
            : null;

        if (
          typeof maybeAction === "string" &&
          (maybeAction === "remove" || maybeAction === "delete")
        ) {
          updates[normalizedName] = null;
          return;
        }

        if (maybeVersion) {
          updates[normalizedName] = maybeVersion;
          return;
        }

        if (maybeWantedVersion) {
          updates[normalizedName] = maybeWantedVersion;
        }
      }
    });
  });

  return updates;
};

export const normalizeDependencySpecifier = (
  rawSpecifier: string,
): string | null => {
  const cleaned = stripSpecifierDecorators(rawSpecifier);
  return normalizePackageName(cleaned);
};

export const normalizeWorkspacePathForSnack = (filePath: string): string =>
  normalizeWorkspacePath(filePath);

const normalizeExternalImportSpecifier = (specifier: string): string => {
  const cleaned = stripSpecifierDecorators(specifier);
  if (!isLikelyExternalSpecifier(cleaned)) return cleaned;

  const segments = cleaned.split("/");
  if (segments.length === 0) return cleaned;

  if (cleaned.startsWith("@")) {
    if (segments.length < 2) return cleaned;
    const [scope, pkg, ...rest] = segments;
    const normalizedPkg = pkg.replace(PACKAGE_EXTENSION_SUFFIX_REGEX, "");
    if (!normalizedPkg) return cleaned;
    if (!rest.length) return `${scope}/${normalizedPkg}`;

    const normalizedRest = [...rest];
    const lastSegment = normalizedRest[normalizedRest.length - 1];
    normalizedRest[normalizedRest.length - 1] =
      lastSegment.replace(PACKAGE_EXTENSION_SUFFIX_REGEX, "");
    return [scope, normalizedPkg, ...normalizedRest].join("/");
  }

  if (segments.length === 1) {
    return segments[0].replace(PACKAGE_EXTENSION_SUFFIX_REGEX, "");
  }

  const normalizedSegments = [...segments];
  const lastSegment = normalizedSegments[normalizedSegments.length - 1];
  normalizedSegments[normalizedSegments.length - 1] =
    lastSegment.replace(PACKAGE_EXTENSION_SUFFIX_REGEX, "");
  return normalizedSegments.join("/");
};

export const sanitizeFileWriteContent = (filePath: string, content: string): string => {
  const normalizeImportSpecifier = (rawSpecifier: string): string =>
    normalizeExternalImportSpecifier(rawSpecifier);

  let sanitized = content
    .replace(/module:\/\/\/?@/g, "@")
    .replace(/module:@/g, "@");

  sanitized = sanitized.replace(
    IMPORT_EXPORT_SPECIFIER_REGEX,
    (fullMatch, prefix: string, quote: string, rawSpecifier: string) =>
      `${prefix}${quote}${normalizeImportSpecifier(rawSpecifier)}${quote}`,
  );

  sanitized = sanitized.replace(
    REQUIRE_SPECIFIER_REGEX,
    (
      fullMatch,
      prefix: string,
      quote: string,
      rawSpecifier: string,
      suffix: string,
    ) =>
      `${prefix}${quote}${normalizeImportSpecifier(rawSpecifier)}${quote}${suffix}`,
  );

  sanitized = sanitized.replace(
    DYNAMIC_IMPORT_SPECIFIER_REGEX,
    (
      fullMatch,
      prefix: string,
      quote: string,
      rawSpecifier: string,
      suffix: string,
    ) =>
      `${prefix}${quote}${normalizeImportSpecifier(rawSpecifier)}${quote}${suffix}`,
  );

  // Fallback normalization for malformed or escaped payloads where import AST-like regex
  // misses but scoped package names still leak with file extensions.
  sanitized = sanitized.replace(
    SCOPED_PACKAGE_WITH_EXTENSION_REGEX,
    (_match, scopedPackageName: string) => scopedPackageName,
  );

  if (!isLikelySourceFilePath(filePath)) return sanitized;

  return sanitized;
};

const parsePackageJsonRuntimeSignal = (
  content: string,
): PreviewRuntime | null => {
  try {
    const parsed = JSON.parse(content);
    if (!isObject(parsed)) return null;

    const deps = isObject(parsed.dependencies) ? parsed.dependencies : {};
    const devDeps = isObject(parsed.devDependencies)
      ? parsed.devDependencies
      : {};
    const depNames = new Set([
      ...Object.keys(deps),
      ...Object.keys(devDeps),
    ]);

    for (const depName of depNames) {
      if (MOBILE_DEPENDENCY_NAMES.has(depName)) return "mobile";
    }

    for (const depName of depNames) {
      if (WEB_DEPENDENCY_NAMES.has(depName)) return "web";
    }
  } catch {
    return null;
  }

  return null;
};

export const inferPreviewRuntimeFromWrites = (
  writes: Array<{ path: string; content: string }>,
): PreviewRuntime | null => {
  if (!writes.length) return null;

  let hasMobileSignal = false;
  let hasWebSignal = false;

  writes.forEach((write) => {
    const normalizedPath = normalizeWorkspacePath(write.path).toLowerCase();
    const lowerContent = write.content.toLowerCase();

    if (
      normalizedPath.startsWith("ios/") ||
      normalizedPath.startsWith("android/")
    ) {
      hasMobileSignal = true;
    }

    if (
      normalizedPath === "index.html" ||
      normalizedPath.endsWith(".html") ||
      /(?:^|\/)(next|vite|webpack|nuxt|svelte|astro)\.config\.(js|mjs|cjs|ts)$/.test(
        normalizedPath,
      )
    ) {
      hasWebSignal = true;
    }

    if (
      normalizedPath === "package.json" ||
      normalizedPath.endsWith("/package.json")
    ) {
      const runtimeFromPackageJson = parsePackageJsonRuntimeSignal(write.content);
      if (runtimeFromPackageJson === "mobile") hasMobileSignal = true;
      if (runtimeFromPackageJson === "web") hasWebSignal = true;
    }

    if (
      (normalizedPath === "app.json" ||
        normalizedPath.endsWith("/app.json")) &&
      (lowerContent.includes("\"expo\"") || lowerContent.includes("'expo'"))
    ) {
      hasMobileSignal = true;
    }

    if (
      lowerContent.includes("from \"react-native\"") ||
      lowerContent.includes("from 'react-native'") ||
      lowerContent.includes("from \"expo\"") ||
      lowerContent.includes("from 'expo'") ||
      lowerContent.includes("expo-router")
    ) {
      hasMobileSignal = true;
    }

    if (
      lowerContent.includes("from \"react-dom\"") ||
      lowerContent.includes("from 'react-dom'") ||
      lowerContent.includes("from \"next/") ||
      lowerContent.includes("from 'next/")
    ) {
      hasWebSignal = true;
    }
  });

  if (hasMobileSignal && !hasWebSignal) return "mobile";
  if (hasWebSignal && !hasMobileSignal) return "web";
  if (hasMobileSignal) return "mobile";
  if (hasWebSignal) return "web";
  return null;
};

const addSnapshotWrite = (
  writes: Array<NormalizedFileWrite>,
  seen: Set<string>,
  path: string,
  content: string,
) => {
  const parsed = parseFileWrite({ path, content });
  if (!parsed) return;

  const key = `${parsed.path}::${parsed.content}`;
  if (seen.has(key)) return;
  seen.add(key);

  writes.push({
    path: parsed.path,
    content: sanitizeFileWriteContent(parsed.path, parsed.content),
  });
};

const collectSnapshotTreeWrites = ({
  node,
  currentPath,
  writes,
  seen,
}: {
  node: unknown;
  currentPath: string;
  writes: Array<NormalizedFileWrite>;
  seen: Set<string>;
}) => {
  if (!isObject(node)) return;

  if (isObject(node.file)) {
    const fileNode = node.file as Record<string, unknown>;
    const fileContent =
      typeof fileNode.content === "string"
        ? fileNode.content
        : typeof fileNode.contents === "string"
          ? fileNode.contents
          : null;
    if (fileContent !== null) {
      addSnapshotWrite(writes, seen, currentPath, fileContent);
      return;
    }
  }

  if (isObject(node.directory)) {
    Object.entries(node.directory as Record<string, unknown>).forEach(
      ([childName, childValue]) => {
        const nextPath = currentPath
          ? `${currentPath}/${childName}`
          : childName;
        collectSnapshotTreeWrites({
          node: childValue,
          currentPath: nextPath,
          writes,
          seen,
        });
      },
    );
  }
};

const collectSnapshotMapWrites = ({
  mapValue,
  writes,
  seen,
}: {
  mapValue: unknown;
  writes: Array<NormalizedFileWrite>;
  seen: Set<string>;
}) => {
  if (!isObject(mapValue)) return;

  Object.entries(mapValue).forEach(([path, value]) => {
    if (typeof value === "string") {
      addSnapshotWrite(writes, seen, path, value);
      return;
    }

    if (!isObject(value)) return;

    if (typeof value.content === "string") {
      addSnapshotWrite(writes, seen, path, value.content);
      return;
    }

    if (typeof value.contents === "string") {
      addSnapshotWrite(writes, seen, path, value.contents);
      return;
    }

    if (typeof value.code === "string") {
      addSnapshotWrite(writes, seen, path, value.code);
      return;
    }

    if (isObject(value.file)) {
      const fileNode = value.file as Record<string, unknown>;
      if (typeof fileNode.content === "string") {
        addSnapshotWrite(writes, seen, path, fileNode.content);
        return;
      }
      if (typeof fileNode.contents === "string") {
        addSnapshotWrite(writes, seen, path, fileNode.contents);
        return;
      }
      if (typeof fileNode.code === "string") {
        addSnapshotWrite(writes, seen, path, fileNode.code);
        return;
      }
    }

    if (isObject(value.directory)) {
      collectSnapshotTreeWrites({
        node: value,
        currentPath: path,
        writes,
        seen,
      });
    }
  });
};

export const extractFileWritesFromSnapshot = (
  snapshot: unknown,
): Array<NormalizedFileWrite> => {
  const writes: Array<NormalizedFileWrite> = [];
  const seen = new Set<string>();

  if (Array.isArray(snapshot)) {
    snapshot.forEach((entry) => {
      const fileWrite = asFileWrite(entry);
      if (!fileWrite) return;
      addSnapshotWrite(writes, seen, fileWrite.path, fileWrite.content);
    });
  }

  collectSnapshotMapWrites({ mapValue: snapshot, writes, seen });

  if (isObject(snapshot)) {
    const directFilesArray = snapshot.files;
    if (Array.isArray(directFilesArray)) {
      directFilesArray.forEach((entry) => {
        const fileWrite = asFileWrite(entry);
        if (!fileWrite) return;
        addSnapshotWrite(writes, seen, fileWrite.path, fileWrite.content);
      });
    }

    if (isObject(snapshot.files)) {
      collectSnapshotMapWrites({ mapValue: snapshot.files, writes, seen });
    }
    if (isObject(snapshot.generatedFiles)) {
      collectSnapshotMapWrites({
        mapValue: snapshot.generatedFiles,
        writes,
        seen,
      });
    }
    if (isObject(snapshot.initialCode)) {
      collectSnapshotMapWrites({
        mapValue: snapshot.initialCode,
        writes,
        seen,
      });
    }
    if (isObject(snapshot.code)) {
      collectSnapshotMapWrites({
        mapValue: snapshot.code,
        writes,
        seen,
      });
    }
    if (Array.isArray(snapshot.initialCode)) {
      snapshot.initialCode.forEach((entry) => {
        const fileWrite = asFileWrite(entry);
        if (!fileWrite) return;
        addSnapshotWrite(writes, seen, fileWrite.path, fileWrite.content);
      });
    }
    if (isObject(snapshot.data)) {
      collectSnapshotMapWrites({ mapValue: snapshot.data, writes, seen });

      const nestedDataFiles = (snapshot.data as Record<string, unknown>).files;
      if (Array.isArray(nestedDataFiles)) {
        nestedDataFiles.forEach((entry) => {
          const fileWrite = asFileWrite(entry);
          if (!fileWrite) return;
          addSnapshotWrite(writes, seen, fileWrite.path, fileWrite.content);
        });
      }
    }
    if (isObject(snapshot.result)) {
      collectSnapshotMapWrites({ mapValue: snapshot.result, writes, seen });

      const nestedResultFiles = (snapshot.result as Record<string, unknown>).files;
      if (Array.isArray(nestedResultFiles)) {
        nestedResultFiles.forEach((entry) => {
          const fileWrite = asFileWrite(entry);
          if (!fileWrite) return;
          addSnapshotWrite(writes, seen, fileWrite.path, fileWrite.content);
        });
      }
    }
    if (isObject(snapshot.tree)) {
      collectSnapshotMapWrites({ mapValue: snapshot.tree, writes, seen });
    }
  }

  return writes;
};

const isJsonFilePath = (path: string): boolean =>
  path.trim().toLowerCase().endsWith(".json");

const isValidJsonContent = (content: string): boolean => {
  try {
    JSON.parse(content);
    return true;
  } catch {
    return false;
  }
};

export const dedupeFileWrites = (
  writes: Array<NormalizedFileWrite>,
): Array<NormalizedFileWrite> => {
  if (!writes.length) return writes;

  const byPath = new Map<string, NormalizedFileWrite>();
  const jsonValidity = new Map<string, boolean>();

  writes.forEach((write) => {
    const pathKey = write.path;
    const isJson = isJsonFilePath(pathKey);
    const isValidJson = isJson ? isValidJsonContent(write.content) : false;

    const existing = byPath.get(pathKey);
    if (!existing) {
      byPath.set(pathKey, write);
      if (isJson) jsonValidity.set(pathKey, isValidJson);
      return;
    }

    if (!isJson) {
      byPath.set(pathKey, write);
      return;
    }

    const existingValid = jsonValidity.get(pathKey) ?? isValidJsonContent(existing.content);
    if (isValidJson && !existingValid) {
      byPath.set(pathKey, write);
      jsonValidity.set(pathKey, true);
      return;
    }
    if (!isValidJson && existingValid) {
      jsonValidity.set(pathKey, true);
      return;
    }

    if (
      write.content.length >= existing.content.length &&
      (isValidJson || !existingValid)
    ) {
      byPath.set(pathKey, write);
      jsonValidity.set(pathKey, isValidJson);
    }
  });

  return Array.from(byPath.values());
};

export const extractFileWritesFromToolResult = (
  toolResult: unknown,
): Array<NormalizedFileWrite> => {
  if (!isObject(toolResult)) return [];

  const result = isObject(toolResult.result) ? toolResult.result : {};
  const candidates: RawFileWrite[] = [
    ...toFileWriteArray(toolResult.fileWrite),
    ...toFileWriteArray(toolResult.fileWrites),
    ...toFileWriteArray(result.fileWrite),
    ...toFileWriteArray(result.fileWrites),
  ];

  const snapshotCandidates = [
    toolResult.fileWrites,
    result.fileWrites,
    result.files,
  ];

  snapshotCandidates.forEach((candidate) => {
    extractFileWritesFromSnapshot(candidate).forEach((write) => {
      candidates.push({
        path: write.path,
        content: write.content,
      });
    });
  });

  const seen = new Set<string>();
  return candidates
    .map((write) => parseFileWrite(write))
    .filter((write): write is NormalizedFileWrite => Boolean(write))
    .filter((write) => {
      const key = `${write.path}::${write.content}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((write) => ({
      path: write.path,
      content: sanitizeFileWriteContent(write.path, write.content),
    }));
};

export const resolveDependencyUpdatesForWrites = ({
  toolResult,
  fileWrites,
  currentDependencies,
  allowRemovals = false,
}: {
  toolResult?: unknown;
  fileWrites?: Array<{ path: string; content: string }>;
  currentDependencies: Record<string, string>;
  allowRemovals?: boolean;
}): Record<string, string | null> => {
  const updates: Record<string, string | null> = {};
  const normalizedCurrent: Record<string, string> = {};

  Object.entries(currentDependencies || {}).forEach(([name, version]) => {
    const normalizedName = normalizeDependencySpecifier(name) || name;
    normalizedCurrent[normalizedName] = version;
  });

  const parsedToolUpdates = parseDependencyUpdates(toolResult);
  Object.entries(parsedToolUpdates).forEach(([name, version]) => {
    updates[name] = version;
  });

  const writes = fileWrites || [];
  writes.forEach(({ path, content }) => {
    const normalizedPath = normalizeWorkspacePath(path);

    const lowerPath = normalizedPath.toLowerCase();
    if (
      lowerPath === "package.json" ||
      lowerPath.endsWith("/package.json")
    ) {
      const packageJsonUpdates = parsePackageJsonDependencies(content);
      Object.entries(packageJsonUpdates).forEach(([name, version]) => {
        updates[name] = version;
      });
      return;
    }

    if (!isLikelySourceFilePath(normalizedPath)) return;
    inferDependenciesFromSource(content).forEach((dependencyName) => {
      if (!isValidNpmPackageNameForSnack(dependencyName)) return;
      if (MOBILE_SNACK_BLOCKED_DEPENDENCIES.has(dependencyName)) return;
      if (normalizedCurrent[dependencyName]) return;
      if (updates[dependencyName] === undefined) {
        updates[dependencyName] = DEFAULT_AUTO_DEPENDENCY_VERSION;
      }
    });
  });

  if (!allowRemovals) {
    Object.entries(updates).forEach(([name, version]) => {
      if (version === null && PREVIEW_SDK_54_CORE_DEPENDENCIES[name]) {
        updates[name] = PREVIEW_SDK_54_CORE_DEPENDENCIES[name];
      }
    });
  }

  const expandedNames = new Set(Object.keys(updates));
  for (const name of expandedNames) {
    const peers = KNOWN_PEER_DEPENDENCIES[name];
    if (!peers) continue;
    for (const [peerName, peerVersion] of Object.entries(peers)) {
      if (updates[peerName] !== undefined) continue;
      if (normalizedCurrent[peerName]) continue;
      updates[peerName] = peerVersion;
    }
  }

  const sanitized: Record<string, string | null> = {};
  Object.entries(updates).forEach(([name, version]) => {
    if (!isValidNpmPackageNameForSnack(name)) return;
    if (MOBILE_SNACK_BLOCKED_DEPENDENCIES.has(name)) return;
    sanitized[name] = version;
  });
  return sanitized;
};
