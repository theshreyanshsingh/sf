"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { RootState } from "@/app/redux/store";
import { setPreviewUrl } from "@/app/redux/reducers/projectOptions";
import { normalizeWebProjectFiles } from "@/app/helpers/normalizeWebProjectFiles";
import {
  boot,
  fetchAndMountTestFiles,
  onServerReady,
  syncFiles,
} from "@/app/helpers/webcontainer";
import { mergePreviewBridgeScripts } from "@/app/helpers/mergePreviewBridgeScripts";
import { WEB_DEV_SERVER_SHELL_COMMAND } from "@/app/helpers/webContainerDevServerCommand";

const FALLBACK_BOOTSTRAP_TIMEOUT_MS = 8000;

const WebRuntimeManager = () => {
  const dispatch = useDispatch();
  const { previewRuntime, projectId, isStreamActive, url, generationSuccess } = useSelector(
    (state: RootState) => state.projectOptions,
  );
  const projectFilesData = useSelector(
    (state: RootState) => state.projectFiles.data,
  );

  const normalizedProjectFiles = useMemo(
    () =>
      normalizeWebProjectFiles(
        (projectFilesData as Record<string, unknown> | null | undefined) ?? null,
      ).files,
    [projectFilesData],
  );

  const runtimeSourceRef = useRef<"project" | "scaffold" | null>(null);
  const serverRequestedRef = useRef(false);
  const fallbackTimerRef = useRef<number | null>(null);
  const lastQueuedSyncSignatureRef = useRef("");
  const lastCompletedSyncSignatureRef = useRef("");
  const lastStartedPackageJsonRef = useRef<string | null>(null);
  /** After a streaming turn wrote package.json, run `exit` + fresh shell before npm (stream-only signal). */
  const leadWithShellExitNextBootRef = useRef(false);
  const startSequenceRef = useRef<Promise<void> | null>(null);
  const syncSequenceRef = useRef<Promise<void>>(Promise.resolve());
  const activeProjectRef = useRef<string | null>(null);
  const [runtimeRetryNonce, setRuntimeRetryNonce] = useState(0);

  const projectFileSignature = useMemo(() => {
    const fileKeys = Object.keys(normalizedProjectFiles);
    if (fileKeys.length === 0) return "";

    return [...fileKeys]
      .sort()
      .map((key) => `${key}:${normalizedProjectFiles[key]?.length ?? 0}`)
      .join("|");
  }, [normalizedProjectFiles]);

  const hasPackageJson = !!normalizedProjectFiles["package.json"]?.trim();
  const shouldUseImmediateScaffold =
    previewRuntime === "web" &&
    generationSuccess === "thinking" &&
    !url &&
    !hasPackageJson;

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const stopRuntime = useCallback(async () => {
    clearFallbackTimer();
    startSequenceRef.current = null;
    serverRequestedRef.current = false;
    runtimeSourceRef.current = null;
    lastStartedPackageJsonRef.current = null;
    lastQueuedSyncSignatureRef.current = "";
    lastCompletedSyncSignatureRef.current = "";
    syncSequenceRef.current = Promise.resolve();
    leadWithShellExitNextBootRef.current = false;

    const interrupt = window.terminalInterrupt;
    if (typeof interrupt === "function") {
      try {
        await interrupt();
      } catch {
        // Ignore interruption failures during shutdown.
      }
    }
  }, [clearFallbackTimer]);

  const writeToPrimaryTerminal = useCallback(async (input: string) => {
    if (typeof window.waitForTerminalReady !== "function") {
      throw new Error("Primary terminal readiness API is unavailable.");
    }

    const ready = await window.waitForTerminalReady("terminal-1", 15000);
    if (!ready || typeof window.writeTerminalInput !== "function") {
      throw new Error("Primary terminal is not ready for runtime boot.");
    }

    const wrote = await window.writeTerminalInput("terminal-1", input);
    if (!wrote) {
      throw new Error("Failed to write runtime command to the primary terminal.");
    }
  }, []);

  const runRuntimeBoot = useCallback(
    async ({
      source,
      packageJson,
      restart = false,
    }: {
      source: "project" | "scaffold";
      packageJson: string;
      restart?: boolean;
    }) => {
      if (!packageJson.trim()) return;
      if (startSequenceRef.current) {
        await startSequenceRef.current;
      }

      const nextSequence = (async () => {
        serverRequestedRef.current = true;
        runtimeSourceRef.current = source;
        lastStartedPackageJsonRef.current = packageJson;

        const leadWithShellExit = leadWithShellExitNextBootRef.current;
        leadWithShellExitNextBootRef.current = false;

        if (leadWithShellExit) {
          try {
            await writeToPrimaryTerminal("exit\n");
          } catch {
            /* non-fatal */
          }
          await new Promise((resolve) => window.setTimeout(resolve, 450));
          if (typeof window.respawnPrimaryTerminalShell === "function") {
            try {
              await window.respawnPrimaryTerminalShell();
            } catch {
              /* fall through; writeToPrimaryTerminal may still fail below */
            }
          }
          const shellReady = await window.waitForTerminalReady?.(
            "terminal-1",
            15000,
          );
          if (!shellReady) {
            throw new Error("Primary shell did not come back after exit.");
          }
        }

        if (restart && !leadWithShellExit) {
          await writeToPrimaryTerminal("\u0003");
          await new Promise((resolve) => window.setTimeout(resolve, 250));
        }

        await writeToPrimaryTerminal(WEB_DEV_SERVER_SHELL_COMMAND);
      })();

      const nextSequencePromise = nextSequence
        .catch((error) => {
          serverRequestedRef.current = false;
          runtimeSourceRef.current = null;
          lastStartedPackageJsonRef.current = null;
          throw error;
        })
        .finally(() => {
          if (startSequenceRef.current === nextSequencePromise) {
            startSequenceRef.current = null;
          }
        });

      startSequenceRef.current = nextSequencePromise;

      if (!nextSequencePromise) {
        return;
      }

      await nextSequencePromise;
    },
    [writeToPrimaryTerminal],
  );

  useEffect(() => {
    if (previewRuntime !== "web") return;

    let cancelled = false;
    let unregisterServerReady: (() => void) | null = null;

    void (async () => {
      try {
        await boot();
        unregisterServerReady = await onServerReady((_port, url) =>
          dispatch(setPreviewUrl(url)),
        );
      } catch (error) {
        if (!cancelled) {
          console.error("[web-runtime] boot failed:", error);
        }
      }
    })();

    return () => {
      cancelled = true;
      unregisterServerReady?.();
    };
  }, [dispatch, previewRuntime]);

  useEffect(() => {
    if (previewRuntime !== "web") return;

    const onPrimaryReady = () => {
      setRuntimeRetryNonce((value) => value + 1);
    };

    const onWebRuntimeRetry = (event: Event) => {
      const detail = (event as CustomEvent<{ exitBeforeNpm?: boolean }>).detail;
      if (detail?.exitBeforeNpm) {
        leadWithShellExitNextBootRef.current = true;
      }
      setRuntimeRetryNonce((value) => value + 1);
    };

    window.addEventListener("SB_PRIMARY_TERMINAL_READY", onPrimaryReady);
    window.addEventListener(
      "SB_WEB_RUNTIME_RETRY",
      onWebRuntimeRetry as EventListener,
    );

    return () => {
      window.removeEventListener("SB_PRIMARY_TERMINAL_READY", onPrimaryReady);
      window.removeEventListener(
        "SB_WEB_RUNTIME_RETRY",
        onWebRuntimeRetry as EventListener,
      );
    };
  }, [previewRuntime]);

  useEffect(() => {
    if (previewRuntime !== "web") return;

    const onManualStartServer = () => {
      void (async () => {
        try {
          if (startSequenceRef.current) {
            await startSequenceRef.current.catch(() => undefined);
          }
          serverRequestedRef.current = true;
          runtimeSourceRef.current = "project";
          await writeToPrimaryTerminal("\u0003");
          await new Promise((resolve) => setTimeout(resolve, 250));
          await writeToPrimaryTerminal(WEB_DEV_SERVER_SHELL_COMMAND);
        } catch (error) {
          console.warn("[web-runtime] Start server (manual) failed:", error);
        }
      })();
    };

    window.addEventListener("SB_START_WEB_DEV_SERVER", onManualStartServer);
    return () =>
      window.removeEventListener("SB_START_WEB_DEV_SERVER", onManualStartServer);
  }, [previewRuntime, writeToPrimaryTerminal]);

  useEffect(() => {
    if (previewRuntime !== "web") return;

    const currentProjectId = projectId || null;
    if (activeProjectRef.current && activeProjectRef.current !== currentProjectId) {
      void stopRuntime();
      dispatch(setPreviewUrl(null));
    }
    activeProjectRef.current = currentProjectId;
  }, [dispatch, previewRuntime, projectId, stopRuntime]);

  useEffect(() => {
    return () => {
      void stopRuntime();
    };
  }, [stopRuntime]);

  useEffect(() => {
    if (previewRuntime !== "web") return;

    if (!projectFileSignature) return;
    if (isStreamActive) {
      return;
    }
    if (lastQueuedSyncSignatureRef.current === projectFileSignature) return;

    lastQueuedSyncSignatureRef.current = projectFileSignature;

    const nextSync = syncSequenceRef.current
      .catch(() => undefined)
      .then(async () => {
        const withBridge = await mergePreviewBridgeScripts(
          normalizedProjectFiles,
        );
        await syncFiles(withBridge);
        lastCompletedSyncSignatureRef.current = projectFileSignature;
      });

    syncSequenceRef.current = nextSync.catch((error) => {
      console.warn("[web-runtime] project file sync failed:", error);
      if (lastQueuedSyncSignatureRef.current === projectFileSignature) {
        lastQueuedSyncSignatureRef.current = "";
      }
    });
  }, [
    normalizedProjectFiles,
    previewRuntime,
    projectFileSignature,
    isStreamActive,
  ]);

  useEffect(() => {
    if (previewRuntime !== "web") return;

    const packageJson = normalizedProjectFiles["package.json"]?.trim() || "";
    if (!packageJson || !projectFileSignature) return;
    if (isStreamActive) return;

    clearFallbackTimer();

    void (async () => {
      await syncSequenceRef.current.catch(() => undefined);

      if (lastCompletedSyncSignatureRef.current !== projectFileSignature) {
        return;
      }

      if (!serverRequestedRef.current) {
        await runRuntimeBoot({
          source: "project",
          packageJson,
        });
        return;
      }

      if (
        runtimeSourceRef.current === "scaffold" &&
        lastStartedPackageJsonRef.current !== packageJson
      ) {
        await runRuntimeBoot({
          source: "project",
          packageJson,
          restart: true,
        });
      }
    })().catch((error) => {
      console.error("[web-runtime] project runtime boot failed:", error);
    });
  }, [
    clearFallbackTimer,
    normalizedProjectFiles,
    projectFileSignature,
    previewRuntime,
    runRuntimeBoot,
    runtimeRetryNonce,
    isStreamActive,
  ]);

  useEffect(() => {
    if (previewRuntime !== "web") return;
    if (serverRequestedRef.current) return;
    if (hasPackageJson && !isStreamActive) return;

    clearFallbackTimer();
    const fallbackDelayMs = shouldUseImmediateScaffold
      ? 0
      : FALLBACK_BOOTSTRAP_TIMEOUT_MS;

    fallbackTimerRef.current = window.setTimeout(() => {
      void (async () => {
        if (serverRequestedRef.current) return;
        if (hasPackageJson && !isStreamActive) return;

        const scaffoldFiles = await fetchAndMountTestFiles();
        const scaffoldPackageJson = scaffoldFiles?.["package.json"]?.trim() || "";
        if (!scaffoldPackageJson) return;

        await runRuntimeBoot({
          source: "scaffold",
          packageJson: scaffoldPackageJson,
        });
      })().catch((error) => {
        console.error("[web-runtime] scaffold fallback failed:", error);
      });
    }, fallbackDelayMs);

    return () => {
      clearFallbackTimer();
    };
  }, [
    clearFallbackTimer,
    normalizedProjectFiles,
    previewRuntime,
    runRuntimeBoot,
    runtimeRetryNonce,
    hasPackageJson,
    isStreamActive,
    shouldUseImmediateScaffold,
  ]);

  return null;
};

export default WebRuntimeManager;
