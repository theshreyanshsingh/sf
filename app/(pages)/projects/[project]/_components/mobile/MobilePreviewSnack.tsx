"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Snack,
  type SDKVersion,
  type SnackDependency,
  type SnackFile,
  type SnackFiles,
  type SnackState,
  type SnackWindowRef,
  standardizeDependencies,
} from "snack-sdk";
import { BiLoaderCircle } from "react-icons/bi";

import type { AppDispatch, RootState } from "@/app/redux/store";
import {
  setPreviewUrl,
  setPreviewSnackFiles,
  updatePreviewSnackFiles,
  updatePreviewSnackDependencies,
} from "@/app/redux/reducers/projectOptions";
import {
  normalizeIncomingFileContent,
  normalizeDependencySpecifier,
  normalizeWorkspacePathForSnack,
  resolveDependencyUpdatesForWrites,
  sanitizeFileWriteContent,
} from "@/app/_services/fileUpdatesMobile";
import { NEXT_PUBLIC_SNACK_WEB_PLAYER_URL } from "@/app/config/publicEnv";
import type {
  PreviewSnackDependencies,
  PreviewSnackFiles,
} from "@/default/mobile";
import { DEFAULT_PREVIEW_SNACK_FILES } from "@/default/mobile";
import { IphoneFrame } from "./IphoneFrame";

const DEFAULT_SNACK_WEB_PLAYER_URL =
  "https://superblocks-snack-runtime-worker.theshreyanshsingh7.workers.dev/v2/%%SDK_VERSION%%";
const PREVIEW_STARTUP_TIMEOUT_MS = 20000;
const NON_EXTENSION_FILE_NAMES = new Set([
  "dockerfile",
  "makefile",
  "license",
  "readme",
]);
const ROOT_APP_ENTRY_CANDIDATES = ["App.js", "App.tsx", "App.ts", "App.jsx"];

const looksLikeFilePath = (path: string): boolean => {
  const trimmed = path.trim().replace(/^\/+/, "");
  if (!trimmed || trimmed.endsWith("/")) return false;

  const fileName = trimmed.split("/").pop()?.toLowerCase() || "";
  if (
    trimmed.includes(".") ||
    trimmed.includes("/") ||
    NON_EXTENSION_FILE_NAMES.has(fileName)
  ) {
    return true;
  }

  return false;
};

const createAppBridgeSource = (targetPath: string): string =>
  `import App from "./${targetPath.replace(/^\/+/, "")}";\nexport default App;\n`;

const ensureMobileEntrypointFiles = (
  files: PreviewSnackFiles,
): PreviewSnackFiles => {
  const next = { ...files };
  const rootAppSource = next["App.js"];
  const isDefaultRootApp =
    typeof rootAppSource === "string" &&
    rootAppSource === DEFAULT_PREVIEW_SNACK_FILES["App.js"];
  const isAutoBridgeRootApp =
    typeof rootAppSource === "string" &&
    /^import App from "\.\/.+?";\nexport default App;\n?$/.test(rootAppSource);
  const canReplaceRootApp =
    !rootAppSource || isDefaultRootApp || isAutoBridgeRootApp;

  const preferredNestedEntry = ROOT_APP_ENTRY_CANDIDATES.map(
    (candidate) => `frontend/${candidate}`,
  ).find((path) => typeof next[path] === "string");

  if (preferredNestedEntry && canReplaceRootApp) {
    next["App.js"] = createAppBridgeSource(preferredNestedEntry);
  }

  if (!next["App.js"]) {
    const rootAlt = ROOT_APP_ENTRY_CANDIDATES.find(
      (candidate) => candidate !== "App.js" && typeof next[candidate] === "string",
    );
    if (rootAlt) {
      next["App.js"] = createAppBridgeSource(rootAlt);
    }
  }

  if (!next["App.js"]) {
    const nestedEntryPath = Object.keys(next).find((path) =>
      /(?:^|\/)App\.(js|jsx|ts|tsx)$/i.test(path),
    );
    if (nestedEntryPath && nestedEntryPath !== "App.js") {
      next["App.js"] = createAppBridgeSource(nestedEntryPath);
    }
  }

  if (!next["App.js"]) {
    const hasExpoRouterTree = Object.keys(next).some(
      (path) =>
        path === "app/_layout.js" ||
        path === "app/_layout.tsx" ||
        path === "app/_layout.ts" ||
        path.startsWith("app/"),
    );
    if (hasExpoRouterTree) {
      next["App.js"] = 'export { default } from "expo-router/entry";\n';
    }
  }

  if (!next["App.js"]) {
    next["App.js"] = DEFAULT_PREVIEW_SNACK_FILES["App.js"];
  }
  if (!next["package.json"]) {
    next["package.json"] = DEFAULT_PREVIEW_SNACK_FILES["package.json"];
  }
  if (!next["app.json"]) {
    next["app.json"] = DEFAULT_PREVIEW_SNACK_FILES["app.json"];
  }

  return next;
};

const isValidWebPlayerTemplate = (value: string) => {
  if (!value.includes("%%SDK_VERSION%%")) return false;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return false;
    return (
      parsed.hostname.endsWith(".workers.dev") ||
      parsed.hostname.endsWith(".superblocks.xyz") ||
      parsed.hostname.endsWith(".superblocks.pages.dev")
    );
  } catch {
    return false;
  }
};

const toSnackFiles = (files: PreviewSnackFiles): SnackFiles => {
  return Object.entries(files).reduce<SnackFiles>((acc, [path, contents]) => {
    acc[path] = { type: "CODE", contents };
    return acc;
  }, {});
};

const toSnackDependencyUpdates = (
  updates: Record<string, string | null>,
): Record<string, SnackDependency | null> => {
  const normalized: Record<string, SnackDependency | null> = {};
  const additions: Record<string, string> = {};

  Object.entries(updates).forEach(([name, version]) => {
    if (!name) return;
    if (version === null) {
      normalized[name] = null;
      return;
    }
    additions[name] = version;
  });

  if (Object.keys(additions).length > 0) {
    const standardized = standardizeDependencies(additions);
    Object.entries(standardized).forEach(([name, dependency]) => {
      normalized[name] = dependency;
    });
  }

  return normalized;
};

const getFileUpdates = (
  previousFiles: PreviewSnackFiles,
  nextFiles: PreviewSnackFiles,
): Record<string, SnackFile | null> => {
  const updates: Record<string, SnackFile | null> = {};

  Object.entries(nextFiles).forEach(([path, contents]) => {
    if (previousFiles[path] !== contents) {
      updates[path] = { type: "CODE", contents };
    }
  });

  Object.keys(previousFiles).forEach((path) => {
    if (!(path in nextFiles)) {
      updates[path] = null;
    }
  });

  return updates;
};

const getDependencyUpdates = (
  previousDependencies: PreviewSnackDependencies,
  nextDependencies: PreviewSnackDependencies,
): Record<string, SnackDependency | null> => {
  const updates: Record<string, string | null> = {};

  Object.entries(nextDependencies).forEach(([name, version]) => {
    if (previousDependencies[name] !== version) {
      updates[name] = version;
    }
  });

  Object.keys(previousDependencies).forEach((name) => {
    if (!(name in nextDependencies)) {
      updates[name] = null;
    }
  });

  return toSnackDependencyUpdates(updates);
};

const hasUpdates = (
  updates: Record<string, SnackFile | SnackDependency | null>,
) => Object.keys(updates).length > 0;

const applyDependencyPatch = (
  currentDependencies: PreviewSnackDependencies,
  updates: Record<string, string | null>,
): PreviewSnackDependencies => {
  const next = { ...currentDependencies };
  Object.entries(updates).forEach(([name, version]) => {
    if (version === null) {
      delete next[name];
      return;
    }
    next[name] = version;
  });
  return next;
};

const sendCodeChangesAfterPendingOperations = (snack: Snack) => {
  void snack
    .getStateAsync()
    .then(() => {
      snack.sendCodeChanges();
    })
    .catch(() => {
      snack.sendCodeChanges();
    });
};

const applySnackDependencyUpdates = (
  snack: Snack,
  updates: Record<string, string | null>,
) => {
  if (!Object.keys(updates).length) return;
  snack.updateDependencies(toSnackDependencyUpdates(updates));
  sendCodeChangesAfterPendingOperations(snack);
};

const getMissingDependencyUpdates = (
  missingDependencies: SnackState["missingDependencies"],
  currentDependencies: PreviewSnackDependencies,
): Record<string, string | null> => {
  const updates: Record<string, string | null> = {};
  Object.entries(missingDependencies || {}).forEach(([name, dependency]) => {
    const normalizedName = normalizeDependencySpecifier(name);
    if (!normalizedName) return;
    const wantedVersion =
      typeof dependency?.wantedVersion === "string" &&
      dependency.wantedVersion.trim()
        ? dependency.wantedVersion.trim()
        : "*";
    if (currentDependencies[normalizedName] !== wantedVersion) {
      updates[normalizedName] = wantedVersion;
    }
  });
  return updates;
};

const UNRESOLVED_MODULE_REGEX = /Unable to resolve module ['"]([^'"]+)['"]/gi;

const getRuntimeErrorDependencyUpdates = (
  errorMessage: string,
  currentDependencies: PreviewSnackDependencies,
): Record<string, string | null> => {
  const updates: Record<string, string | null> = {};
  const seen = new Set<string>();
  UNRESOLVED_MODULE_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = UNRESOLVED_MODULE_REGEX.exec(errorMessage))) {
    const unresolvedSpecifier = match[1];
    if (!unresolvedSpecifier || seen.has(unresolvedSpecifier)) continue;
    seen.add(unresolvedSpecifier);

    const normalizedName = normalizeDependencySpecifier(unresolvedSpecifier);
    if (!normalizedName) continue;

    const existingVersion = currentDependencies[normalizedName];
    updates[normalizedName] =
      typeof existingVersion === "string" && existingVersion.trim()
        ? existingVersion
        : "*";
  }

  return updates;
};

const normalizeProjectFileMapForPreview = (
  value: unknown,
): PreviewSnackFiles => {
  if (!value || typeof value !== "object") return {};

  const normalized: PreviewSnackFiles = {};
  Object.entries(value as Record<string, unknown>).forEach(([path, content]) => {
    if (typeof path !== "string") return;
    if (!looksLikeFilePath(path)) return;

    const snackPath = normalizeWorkspacePathForSnack(path);
    if (!snackPath) return;

    let nextContent: string;
    if (typeof content === "string") {
      nextContent = normalizeIncomingFileContent(content);
    } else if (
      content &&
      typeof content === "object" &&
      "code" in content &&
      typeof (content as { code?: unknown }).code === "string"
    ) {
      nextContent = normalizeIncomingFileContent(
        (content as { code: string }).code,
      );
    } else if (
      content &&
      typeof content === "object" &&
      "content" in content &&
      typeof (content as { content?: unknown }).content === "string"
    ) {
      nextContent = normalizeIncomingFileContent(
        (content as { content: string }).content,
      );
    } else if (
      content &&
      typeof content === "object" &&
      "contents" in content &&
      typeof (content as { contents?: unknown }).contents === "string"
    ) {
      nextContent = normalizeIncomingFileContent(
        (content as { contents: string }).contents,
      );
    } else {
      nextContent = JSON.stringify(content ?? "", null, 2);
    }

    normalized[snackPath] = sanitizeFileWriteContent(snackPath, nextContent);
  });

  const hasRootPackageJson = typeof normalized["package.json"] === "string";
  const hasFrontendPackageJson =
    typeof normalized["frontend/package.json"] === "string";
  const hasRootAppEntry = ROOT_APP_ENTRY_CANDIDATES.some(
    (path) => typeof normalized[path] === "string",
  );
  const hasFrontendAppEntry = ROOT_APP_ENTRY_CANDIDATES.some(
    (path) => typeof normalized[`frontend/${path}`] === "string",
  );
  const rootPackageContent = normalized["package.json"] || "";
  const frontendPackageContent = normalized["frontend/package.json"] || "";
  const rootPackageIsMobile =
    rootPackageContent.includes("\"expo\"") ||
    rootPackageContent.includes("\"react-native\"");
  const frontendPackageIsMobile =
    frontendPackageContent.includes("\"expo\"") ||
    frontendPackageContent.includes("\"react-native\"");

  if (
    (!hasRootPackageJson && hasFrontendPackageJson) ||
    (frontendPackageIsMobile && !rootPackageIsMobile) ||
    (hasFrontendAppEntry && !hasRootAppEntry)
  ) {
    const flattened: PreviewSnackFiles = {};

    // Preserve non-frontend files first.
    Object.entries(normalized).forEach(([path, content]) => {
      if (path.startsWith("frontend/")) return;
      flattened[path] = content;
    });

    // Then overlay frontend files so mobile app files always win.
    Object.entries(normalized).forEach(([path, content]) => {
      if (!path.startsWith("frontend/")) return;
      flattened[path.replace(/^frontend\//, "")] = content;
    });
    return ensureMobileEntrypointFiles(flattened);
  }

  return ensureMobileEntrypointFiles(normalized);
};

const isPreviewInBootstrapState = (files: PreviewSnackFiles): boolean => {
  const fileKeys = Object.keys(files);
  const defaultKeys = Object.keys(DEFAULT_PREVIEW_SNACK_FILES);
  if (fileKeys.length !== defaultKeys.length) return false;
  return defaultKeys.every(
    (path) => files[path] === DEFAULT_PREVIEW_SNACK_FILES[path],
  );
};

const arePreviewFilesEqual = (
  left: PreviewSnackFiles,
  right: PreviewSnackFiles,
): boolean => {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((path) => right[path] === left[path]);
};

const MobilePreviewSnack = () => {
  const dispatch = useDispatch<AppDispatch>();
  const {
    previewRuntime,
    previewSnackName,
    previewSnackDescription,
    previewSnackSdkVersion,
    previewSnackFiles,
    previewSnackDependencies,
    refreshCounter,
    responsive,
  } = useSelector((state: RootState) => state.projectOptions);
  const projectFileData = useSelector((state: RootState) => state.projectFiles.data);

  const webPreviewRef = useRef<Window | null>(null);
  const snackRef = useRef<Snack | null>(null);
  const [previewLink, setPreviewLink] = useState<string | null>(null);
  const [previewRuntimeIssue, setPreviewRuntimeIssue] = useState<string | null>(
    null,
  );
  const [iframeRenderIssue, setIframeRenderIssue] = useState<string | null>(
    null,
  );
  const [hasHealthyClient, setHasHealthyClient] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [hasBootstrappedPreview, setHasBootstrappedPreview] = useState(false);
  const [snackBootNonce, setSnackBootNonce] = useState(0);

  const previousFilesRef = useRef<PreviewSnackFiles>({ ...previewSnackFiles });
  const previousDepsRef = useRef<PreviewSnackDependencies>({
    ...previewSnackDependencies,
  });
  const previousMetaRef = useRef({
    name: previewSnackName,
    description: previewSnackDescription,
    sdkVersion: previewSnackSdkVersion,
  });
  const previousRefreshCounterRef = useRef<number>(refreshCounter);
  const previewSnackDependenciesRef = useRef<PreviewSnackDependencies>({
    ...previewSnackDependencies,
  });
  const runtimeDependencyRetryKeysRef = useRef<Set<string>>(new Set());
  const lastPreviewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    previewSnackDependenciesRef.current = previewSnackDependencies;
  }, [previewSnackDependencies]);

  const frameWidthClass = useMemo(() => {
    if (responsive === "mobile") {
      return "max-w-[230px]";
    }
    return "max-w-[340px]";
  }, [responsive]);
  const webPlayerURL = useMemo(() => {
    const candidate = NEXT_PUBLIC_SNACK_WEB_PLAYER_URL?.trim();
    if (candidate && isValidWebPlayerTemplate(candidate)) {
      return candidate;
    }
    return DEFAULT_SNACK_WEB_PLAYER_URL;
  }, []);

  const handleWebPreviewIframeRef = useCallback(
    (iframe: HTMLIFrameElement | null) => {
      webPreviewRef.current = iframe?.contentWindow ?? null;
    },
    [],
  );

  const syncPreviewUrl = useCallback(
    (nextPreviewUrl: string | null) => {
      if (lastPreviewUrlRef.current === nextPreviewUrl) return;
      lastPreviewUrlRef.current = nextPreviewUrl;
      dispatch(setPreviewUrl(nextPreviewUrl));
    },
    [dispatch],
  );

  useEffect(() => {
    if (previewRuntime !== "mobile") return;

    const normalizedProjectFiles =
      normalizeProjectFileMapForPreview(projectFileData);
    const normalizedEntries = Object.entries(normalizedProjectFiles);
    if (!normalizedEntries.length) return;

    const isBootstrapState = isPreviewInBootstrapState(previewSnackFiles);
    const writes: Array<{ path: string; content: string }> = [];

    if (isBootstrapState) {
      if (arePreviewFilesEqual(previewSnackFiles, normalizedProjectFiles)) {
        return;
      }
      dispatch(setPreviewSnackFiles(normalizedProjectFiles));
      normalizedEntries.forEach(([path, content]) => {
        writes.push({ path, content });
      });
    } else {
      const fileUpdates: Record<string, string | null> = {};
      normalizedEntries.forEach(([path, content]) => {
        if (previewSnackFiles[path] === content) return;
        fileUpdates[path] = content;
        writes.push({ path, content });
      });

      if (!writes.length) return;
      dispatch(updatePreviewSnackFiles(fileUpdates));
    }

    const dependencyUpdates = resolveDependencyUpdatesForWrites({
      fileWrites: writes,
      currentDependencies: previewSnackDependenciesRef.current,
      allowRemovals: false,
    });

    if (Object.keys(dependencyUpdates).length > 0) {
      previewSnackDependenciesRef.current = applyDependencyPatch(
        previewSnackDependenciesRef.current,
        dependencyUpdates,
      );
      dispatch(updatePreviewSnackDependencies(dependencyUpdates));
    }
  }, [
    dispatch,
    previewRuntime,
    projectFileData,
    previewSnackFiles,
  ]);

  // Keep Snack initialization stable; incremental updates are handled by dedicated effects below.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (previewRuntime !== "mobile") return;

    const snackSourceFiles = ensureMobileEntrypointFiles(previewSnackFiles);
    const missingRuntimeFilesPatch: Record<string, string> = {};
    Object.entries(snackSourceFiles).forEach(([path, content]) => {
      if (previewSnackFiles[path] === content) return;
      missingRuntimeFilesPatch[path] = content;
    });
    if (Object.keys(missingRuntimeFilesPatch).length > 0) {
      dispatch(updatePreviewSnackFiles(missingRuntimeFilesPatch));
    }

    const sanitizedInitialFiles = Object.entries(snackSourceFiles).reduce<
      PreviewSnackFiles
    >((acc, [path, content]) => {
      acc[path] = sanitizeFileWriteContent(path, content);
      return acc;
    }, {});

    setIsRefreshing(true);
    setPreviewRuntimeIssue(null);
    setPreviewLink(null);
    setHasBootstrappedPreview(false);
    setHasHealthyClient(false);
    setIframeLoaded(false);
    setIframeRenderIssue(null);
    syncPreviewUrl(null);

    const snack = new Snack({
      sdkVersion: previewSnackSdkVersion as SDKVersion,
      name: previewSnackName,
      description: previewSnackDescription,
      files: toSnackFiles(sanitizedInitialFiles),
      dependencies: standardizeDependencies(previewSnackDependencies),
      webPlayerURL,
      online: true,
      webPreviewRef: webPreviewRef as SnackWindowRef,
      codeChangesDelay: 350,
      verbose: false,
    });

    snackRef.current = snack;
    runtimeDependencyRetryKeysRef.current.clear();
    previousFilesRef.current = { ...sanitizedInitialFiles };
    previousDepsRef.current = { ...previewSnackDependencies };
    previousMetaRef.current = {
      name: previewSnackName,
      description: previewSnackDescription,
      sdkVersion: previewSnackSdkVersion,
    };

    const unsubscribe = snack.addStateListener((nextState) => {
      const nextPreviewUrl = nextState.webPreviewURL || null;
      setPreviewLink(nextPreviewUrl);
      syncPreviewUrl(nextPreviewUrl);
      if (nextPreviewUrl) {
        setHasBootstrappedPreview(true);
        setIframeLoaded(false);
        setIframeRenderIssue(null);
      }

      const missingDependencyUpdates = getMissingDependencyUpdates(
        nextState.missingDependencies,
        previewSnackDependenciesRef.current,
      );
      if (Object.keys(missingDependencyUpdates).length > 0) {
        previewSnackDependenciesRef.current = applyDependencyPatch(
          previewSnackDependenciesRef.current,
          missingDependencyUpdates,
        );
        dispatch(updatePreviewSnackDependencies(missingDependencyUpdates));
        applySnackDependencyUpdates(snack, missingDependencyUpdates);
        setIsRefreshing(true);
      }

      const connectedClients = Object.values(nextState.connectedClients || {});
      const healthyClient = connectedClients.find(
        (client) => client.status === "ok",
      );
      const erroredClient = connectedClients.find(
        (client) => client.status === "error",
      );

      if (healthyClient) {
        setHasHealthyClient(true);
        setIsRefreshing(false);
        setPreviewRuntimeIssue(null);
      }

      if (erroredClient?.error?.message) {
        const runtimeErrorMessage = erroredClient.error.message;
        setPreviewRuntimeIssue(runtimeErrorMessage);

        const runtimeErrorDependencyUpdates = getRuntimeErrorDependencyUpdates(
          runtimeErrorMessage,
          previewSnackDependenciesRef.current,
        );

        const filteredUpdates: Record<string, string | null> = {};
        Object.entries(runtimeErrorDependencyUpdates).forEach(([name, version]) => {
          if (version === null) return;
          const retryKey = `${name}@${version}`;
          if (runtimeDependencyRetryKeysRef.current.has(retryKey)) return;
          runtimeDependencyRetryKeysRef.current.add(retryKey);
          filteredUpdates[name] = version;
        });

        if (Object.keys(filteredUpdates).length > 0) {
          previewSnackDependenciesRef.current = applyDependencyPatch(
            previewSnackDependenciesRef.current,
            filteredUpdates,
          );
          dispatch(updatePreviewSnackDependencies(filteredUpdates));
          applySnackDependencyUpdates(snack, filteredUpdates);
          setIsRefreshing(true);
        }
      }
    });

    const unsubscribeLogs = snack.addLogListener((event) => {
      if (event.type !== "error") return;

      const errorMessage =
        (typeof event.message === "string" && event.message.trim()) ||
        (typeof event.error?.message === "string" &&
          event.error.message.trim()) ||
        null;

      if (errorMessage) {
        setPreviewRuntimeIssue(errorMessage);

        const runtimeErrorDependencyUpdates = getRuntimeErrorDependencyUpdates(
          errorMessage,
          previewSnackDependenciesRef.current,
        );

        const filteredUpdates: Record<string, string | null> = {};
        Object.entries(runtimeErrorDependencyUpdates).forEach(([name, version]) => {
          if (version === null) return;
          const retryKey = `${name}@${version}`;
          if (runtimeDependencyRetryKeysRef.current.has(retryKey)) return;
          runtimeDependencyRetryKeysRef.current.add(retryKey);
          filteredUpdates[name] = version;
        });

        if (Object.keys(filteredUpdates).length > 0) {
          previewSnackDependenciesRef.current = applyDependencyPatch(
            previewSnackDependenciesRef.current,
            filteredUpdates,
          );
          dispatch(updatePreviewSnackDependencies(filteredUpdates));
          applySnackDependencyUpdates(snack, filteredUpdates);
          setIsRefreshing(true);
        }
      }
    });

    sendCodeChangesAfterPendingOperations(snack);

    return () => {
      unsubscribe();
      unsubscribeLogs();
      snack.setOnline(false);
      snack.setDisabled(true);
      snackRef.current = null;
      syncPreviewUrl(null);
    };
  }, [dispatch, previewRuntime, snackBootNonce, syncPreviewUrl]);
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    if (previewRuntime !== "mobile") return;

    const snack = snackRef.current;
    if (!snack) return;

    if (previousMetaRef.current.name !== previewSnackName) {
      snack.setName(previewSnackName);
    }
    if (previousMetaRef.current.description !== previewSnackDescription) {
      snack.setDescription(previewSnackDescription);
    }
    if (previousMetaRef.current.sdkVersion !== previewSnackSdkVersion) {
      setIsRefreshing(true);
      snack.setSDKVersion(previewSnackSdkVersion as SDKVersion);
    }

    previousMetaRef.current = {
      name: previewSnackName,
      description: previewSnackDescription,
      sdkVersion: previewSnackSdkVersion,
    };
  }, [
    previewRuntime,
    previewSnackDescription,
    previewSnackName,
    previewSnackSdkVersion,
  ]);

  useEffect(() => {
    if (previewRuntime !== "mobile") return;

    const snack = snackRef.current;
    if (!snack) return;

    const snackSourceFiles = ensureMobileEntrypointFiles(previewSnackFiles);
    const missingRuntimeFilesPatch: Record<string, string> = {};
    Object.entries(snackSourceFiles).forEach(([path, content]) => {
      if (previewSnackFiles[path] === content) return;
      missingRuntimeFilesPatch[path] = content;
    });
    if (Object.keys(missingRuntimeFilesPatch).length > 0) {
      dispatch(updatePreviewSnackFiles(missingRuntimeFilesPatch));
    }

    const sanitizedFiles = Object.entries(snackSourceFiles).reduce<
      PreviewSnackFiles
    >((acc, [path, content]) => {
      acc[path] = sanitizeFileWriteContent(path, content);
      return acc;
    }, {});

    const updates = getFileUpdates(previousFilesRef.current, sanitizedFiles);
    if (hasUpdates(updates)) {
      setIsRefreshing(true);
      snack.updateFiles(updates);
      snack.sendCodeChanges();
    }

    previousFilesRef.current = sanitizedFiles;
  }, [dispatch, previewRuntime, previewSnackFiles]);

  useEffect(() => {
    if (previewRuntime !== "mobile") return;

    const snack = snackRef.current;
    if (!snack) return;

    const updates = getDependencyUpdates(
      previousDepsRef.current,
      previewSnackDependencies,
    );

    if (hasUpdates(updates)) {
      setIsRefreshing(true);
      snack.updateDependencies(updates);
      sendCodeChangesAfterPendingOperations(snack);
    }

    previousDepsRef.current = previewSnackDependencies;
  }, [previewRuntime, previewSnackDependencies]);

  useEffect(() => {
    if (previewRuntime !== "mobile") return;
    if (!previewLink || iframeLoaded) return;

    const timeoutId = window.setTimeout(() => {
      setIsRefreshing(false);
      setIframeRenderIssue(
        "Could not render the mobile preview inside the embedded frame.",
      );
    }, 10000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [previewRuntime, previewLink, iframeLoaded]);

  useEffect(() => {
    if (previewRuntime !== "mobile") return;
    if (!previewLink || hasHealthyClient) return;

    const timeoutId = window.setTimeout(() => {
      setPreviewRuntimeIssue(
        "Mobile runtime did not become healthy in time. Please retry mobile preview.",
      );
    }, 12000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [previewRuntime, previewLink, hasHealthyClient]);

  useEffect(() => {
    if (previewRuntime !== "mobile") return;
    if (refreshCounter === previousRefreshCounterRef.current) return;

    previousRefreshCounterRef.current = refreshCounter;
    setPreviewRuntimeIssue(null);
    setIframeRenderIssue(null);
    setHasBootstrappedPreview(false);
    setHasHealthyClient(false);
    setIframeLoaded(false);
    setPreviewLink(null);
    setIsRefreshing(true);
    syncPreviewUrl(null);
    setSnackBootNonce((nonce) => nonce + 1);
  }, [previewRuntime, refreshCounter, syncPreviewUrl]);

  useEffect(() => {
    if (previewRuntime !== "mobile") return;
    if (hasBootstrappedPreview || previewLink || previewRuntimeIssue) return;
    if (typeof window === "undefined") return;

    const timeoutId = window.setTimeout(() => {
      setIsRefreshing(false);
      setPreviewRuntimeIssue(
        `Mobile runtime took too long to start. Verify runtime URL/domain and refresh preview. URL: ${webPlayerURL}`,
      );
    }, PREVIEW_STARTUP_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    hasBootstrappedPreview,
    previewLink,
    previewRuntime,
    previewRuntimeIssue,
    webPlayerURL,
  ]);

  if (previewRuntime !== "mobile") return null;

  const activeIssue = previewRuntimeIssue || iframeRenderIssue;
  const showStartupOverlay =
    !activeIssue && !hasBootstrappedPreview && (!previewLink || isRefreshing);
  const showRefreshingBadge =
    !activeIssue && hasBootstrappedPreview && isRefreshing;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-[#2a2a2f] bg-[#0f1014]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(46,85,170,0.22),rgba(10,10,14,0.92)_60%)]" />
      <div className="relative z-10 flex h-full min-h-0 w-full items-center justify-center p-4 md:p-6">
        <div className={`h-full min-h-0 w-full ${frameWidthClass}`}>
          <IphoneFrame
            iframeSrc={previewLink || undefined}
            iframeTitle="Superblocks mobile preview"
            iframeRef={handleWebPreviewIframeRef}
            iframeOnLoad={() => {
              setIframeLoaded(true);
              setIframeRenderIssue(null);
              if (!previewRuntimeIssue) {
                setIsRefreshing(false);
              }
            }}
            iframeOnError={() => {
              setIframeLoaded(false);
              setIsRefreshing(false);
              setIframeRenderIssue(
                "Failed to load the mobile preview frame.",
              );
            }}
            className="h-full w-full"
          />
        </div>
      </div>

      {showStartupOverlay && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40">
          <div className="flex items-center gap-3 rounded-xl border border-[#2a2a2f] bg-[#151518] px-5 py-4 text-white">
            <BiLoaderCircle className="animate-spin text-lg text-[#2563eb]" />
            <div className="text-sm">
              <p className="font-medium">Starting mobile runtime preview</p>
              <p className="text-gray-400">Initializing Expo runtime...</p>
            </div>
          </div>
        </div>
      )}

      {activeIssue && (
        <div className="absolute left-4 right-4 top-4 z-20 rounded-lg border border-[#3a2e1f] bg-[#201a12]/95 px-3 py-2 text-xs text-[#f4d29a]">
          {activeIssue} Use `Refresh` above to retry mobile runtime.
        </div>
      )}

      {showRefreshingBadge && (
        <div className="absolute right-4 top-4 z-20 rounded-lg border border-[#2a2a2f] bg-[#151518]/95 px-3 py-2 text-xs text-gray-300">
          Updating preview...
        </div>
      )}
    </div>
  );
};

export default MobilePreviewSnack;
