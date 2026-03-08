"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import "@xterm/xterm/css/xterm.css";
import { useWebContainerContext } from "@/app/redux/useWebContainerContext";
import { IoClose } from "react-icons/io5";
import { LuLoader } from "react-icons/lu";
import type { Terminal as XtermTerminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";
import type { WebContainerProcess } from "@webcontainer/api";

// Type definitions for window extensions
declare global {
  interface Window {
    addTerminal: (customName?: string) => string;
    isTerminalReady: (terminalId: string) => boolean;
    waitForTerminalReady: (
      terminalId: string,
      timeout?: number
    ) => Promise<boolean>;
    removeTerminal: (terminalId: string) => boolean;
    getTerminalList: () => string[];

    terminalInterrupt: () => Promise<boolean>;
    terminalReady: boolean;
    terminalIsBusy: boolean;
  }
}

interface CommandResult {
  success: boolean;
  output: string;
}

interface OutputResult {
  output: string;
  exitCode: number;
}

const Terminal = () => {
  // Store ResizeObservers for each terminal
  const resizeObserversRef = useRef<{ [id: string]: ResizeObserver }>({});
  const terminalsRef = useRef<string[]>(["terminal-1"]);
  const activeTerminalRef = useRef<string>("terminal-1");

  // State for UI updates only
  const [terminals, setTerminals] = useState<string[]>(["terminal-1"]);
  const [activeTerminal, setActiveTerminal] = useState<string>("terminal-1");

  // Store terminal names mapping
  const terminalNamesRef = useRef<{ [id: string]: string }>({
    "terminal-1": "Terminal",
  });

  const {
    isTerminalReady,
    state,
    webcontainerInstance,
    workingdirRef,
    bootContainer,
  } =
    useWebContainerContext();

  const terminalInstancesRef = useRef<{ [id: string]: XtermTerminal }>({});
  const fitAddonsRef = useRef<{ [id: string]: FitAddon }>({});
  const shellProcessesRef = useRef<{ [id: string]: WebContainerProcess }>({});
  const writersRef = useRef<{
    [id: string]: WritableStreamDefaultWriter<string> | null;
  }>({});
  const readerRef = useRef<{
    [id: string]: ReadableStreamDefaultReader<string> | null;
  }>({});

  const outputBuffersRef = useRef<{ [key: string]: string }>({});
  const commandOutputCallbacksRef = useRef<{
    [key: string]: ((output: string) => void)[];
  }>({});

  // Track initialization status to prevent double initialization
  const initializedTerminals = useRef<Set<string>>(new Set());

  const addTerminal = useCallback(
    (customName?: string): string => {
      let newId: string;
      const terminalName = customName || "Terminal";

      // If it's the claude-code terminal, use specific ID
      if (customName === "claude-code") {
        newId = "claude-code";

        // Check if claude-code terminal already exists
        if (terminals.includes("claude-code")) {
          // Just switch to existing claude-code terminal
          setActiveTerminal("claude-code");
          activeTerminalRef.current = "claude-code";
          return "claude-code"; // Return the existing terminal ID
        }
      } else {
        newId = `terminal-${Math.floor(100000 + Math.random() * 900000)}`;
      }

      // Store the terminal name
      terminalNamesRef.current[newId] = terminalName;

      // Update ref
      terminalsRef.current = [...terminalsRef.current, newId];
      activeTerminalRef.current = newId;

      // Update state for UI
      setTerminals((prev) => [...prev, newId]);
      setActiveTerminal(newId);

      // Wait for DOM to update before initializing
      setTimeout(() => {
        initTerminalInstance(newId);
      }, 100);

      return newId; // Return the new terminal ID
    },
    [terminals]
  );

  const closeTerminal = (id: string, e: React.MouseEvent): void => {
    e.stopPropagation();
    // Prevent closing claude-code terminal
    if (id === "claude-code") {
      return;
    }
    if (terminals.length > 1) {
      const index = terminals.indexOf(id);
      const newTerminals = terminals.filter((term) => term !== id);

      // Update refs
      terminalsRef.current = newTerminals;
      if (activeTerminalRef.current === id) {
        const newActiveIndex = Math.min(index, newTerminals.length - 1);
        activeTerminalRef.current = newTerminals[newActiveIndex];
      }

      // Update state for UI
      setTerminals(newTerminals);
      if (activeTerminal === id) {
        const newActiveIndex = Math.min(index, newTerminals.length - 1);
        setActiveTerminal(newTerminals[newActiveIndex]);
      }

      // Cleanup resources
      if (terminalInstancesRef.current[id]) {
        terminalInstancesRef.current[id].dispose();
        delete terminalInstancesRef.current[id];
      }

      if (writersRef.current[id]) {
        writersRef.current[id]?.releaseLock();
        delete writersRef.current[id];
      }

      if (shellProcessesRef.current[id]) {
        shellProcessesRef.current[id].kill();
        delete shellProcessesRef.current[id];
      }

      delete fitAddonsRef.current[id];

      // Clean up ResizeObserver
      if (resizeObserversRef.current[id]) {
        resizeObserversRef.current[id].disconnect();
        delete resizeObserversRef.current[id];
      }

      // Remove from initialized set
      initializedTerminals.current.delete(id);

      // Remove terminal name
      delete terminalNamesRef.current[id];
    }
  };

  const initTerminalInstance = useCallback(
    async (id: string): Promise<void> => {
      // Skip if already initialized
      if (initializedTerminals.current.has(id)) {
        return;
      }

      if (!webcontainerInstance || typeof window === "undefined") {
        return;
      }

      try {
        const [{ Terminal: XtermTerminalClass }, { FitAddon }] =
          await Promise.all([
            import("@xterm/xterm"),
            import("@xterm/addon-fit"),
          ]);
        const fit = new FitAddon();

        const term = new XtermTerminalClass({
          fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
          fontSize: 13, // slightly bigger
          lineHeight: 1.4, // more spacing
          cursorBlink: true,
          cursorStyle: "underline", // more subtle than block
          theme: {
            background: "#000000", // solid black
            foreground: "#F8F8F8", // main text
            cursor: "#52AD70", // green cursor
            black: "#1E1E1E", // dark gray/black
            red: "#E06C75", // error text
            brightRed: "#F97583",
            green: "#52AD70", // success text
            brightGreen: "#67C881",
            yellow: "#EAD64D",
            brightYellow: "#F5DA89",
            blue: "#4f92e1", // links/addresses
            brightBlue: "#4f92e1",
            magenta: "#C678DD",
            brightMagenta: "#D68DF0",
            cyan: "#56B6C2",
            brightCyan: "#67D3E0",
            white: "#ABB2BF",
            brightWhite: "#FFFFFF",
            brightBlack: "#5C6370", // muted comments
          },
          allowTransparency: true, // smoother look
          convertEol: true,
        });

        // Use FitAddon directly, as the import result is a class
        // Only load the fit addon if not already loaded
        if (!fitAddonsRef.current[id]) {
          term.loadAddon(fit);
          fitAddonsRef.current[id] = fit;
        }

        const container = document.getElementById(`terminal-container-${id}`);
        if (container) {
          term.open(container);
          // Use ResizeObserver to fit terminal when container size changes
          const resizeObserver = new ResizeObserver(() => {
            if (fit && typeof fit.fit === "function") {
              try {
                fit.fit();

                // Only focus if this is the active terminal
                if (activeTerminalRef.current === id) {
                  term.focus();
                }

                console.log(`Terminal ${id} fitted on resize.`);
              } catch (err) {
                console.error(`Fit error for terminal ${id}:`, err);
              }
            }
          });
          resizeObserver.observe(container);
          resizeObserversRef.current[id] = resizeObserver;

          // Fit once after open (in case container is already visible)
          setTimeout(() => {
            if (fit && typeof fit.fit === "function") {
              try {
                fit.fit();

                // Only focus if this is the active terminal
                if (activeTerminalRef.current === id) {
                  term.focus();
                }

                console.log(`Terminal ${id} fitted on mount.`);
              } catch (err) {
                console.error(`Fit error for terminal ${id} (mount):`, err);
              }
            }
          }, 0);
        } else {
          console.warn(`Terminal container for ${id} not found!`);
        }

        terminalInstancesRef.current[id] = term;

        // Mark as initialized
        initializedTerminals.current.add(id);

        // Spawn a shell process for this terminal

        const shellProcess = await webcontainerInstance.spawn("bash", {
          terminal: {
            cols: term.cols,
            rows: term.rows,
          },
        });

        shellProcessesRef.current[id] = shellProcess;
        const writer = shellProcess.input.getWriter();
        writersRef.current[id] = writer;

        term.onData((data: string) => {
          writer.write(data);
        });

        const reader = shellProcess.output.getReader();
        readerRef.current[id] = reader;
        const processOutput = async (): Promise<void> => {
          try {
            // Initialize output buffer for this terminal
            outputBuffersRef.current[id] = "";
            commandOutputCallbacksRef.current[id] = [];

            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                console.log("terminal command output", done, value);
                break;
              }
              if (value) {
                term.write(value);

                // Add to the shared output buffer
                outputBuffersRef.current[id] += value;

                // Notify any pending callbacks about new output
                if (commandOutputCallbacksRef.current[id]?.length > 0) {
                  commandOutputCallbacksRef.current[id].forEach((callback) =>
                    callback(value)
                  );
                }

                if (
                  value.includes("http://localhost:") ||
                  value.includes("- Local:") ||
                  value.includes("ready started server")
                ) {
                  const match = value.match(/(http:\/\/localhost:[0-9]+)/);
                  if (match && match[1]) {
                    console.log("Server URL detected:", match[1]);
                  }
                }
              }
            }
          } catch (err) {
            console.error("Error reading from shell output:", err);
          }
        };

        processOutput();
      } catch (err) {
        console.error(`Failed to initialize terminal ${id}:`, err);
      }
    },
    [webcontainerInstance]
  );

  // Focus active terminal when it changes
  useEffect(() => {
    // Update ref whenever state changes
    activeTerminalRef.current = activeTerminal;

    const terminal = terminalInstancesRef.current[activeTerminal];
    const fitAddon = fitAddonsRef.current[activeTerminal];

    if (terminal) {
      setTimeout(() => {
        if (fitAddon && typeof fitAddon.fit === "function") {
          try {
            fitAddon.fit();
          } catch (err) {
            console.error(`Fit error for terminal ${activeTerminal}:`, err);
          }
        }
        terminal.focus();
      }, 0);
    }
  }, [activeTerminal]);

  // Update the refs whenever the state changes
  useEffect(() => {
    terminalsRef.current = terminals;
  }, [terminals]);

  // Initialize first terminal when webcontainerInstance becomes available
  useEffect(() => {
    if (
      webcontainerInstance &&
      terminals.includes("terminal-1") &&
      !initializedTerminals.current.has("terminal-1")
    ) {
      setTimeout(() => {
        initTerminalInstance("terminal-1");
      }, 1000);
    }

    // Expose addTerminal function to window for external access
    window.addTerminal = addTerminal;

    // Function to check if a terminal is ready
    window.isTerminalReady = (terminalId: string): boolean => {
      return (
        initializedTerminals.current.has(terminalId) &&
        writersRef.current[terminalId] !== null &&
        writersRef.current[terminalId] !== undefined
      );
    };

    // Function to wait for terminal to be ready
    window.waitForTerminalReady = (
      terminalId: string,
      timeout = 10000
    ): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        const startTime = Date.now();

        const checkReady = (): void => {
          if (window.isTerminalReady(terminalId)) {
            resolve(true);
            return;
          }

          if (Date.now() - startTime > timeout) {
            resolve(false);
            return;
          }

          setTimeout(checkReady, 100);
        };

        checkReady();
      });
    };

    // Function to remove a specific terminal
    window.removeTerminal = (terminalId: string): boolean => {
      if (!terminals.includes(terminalId)) {
        return false; // Terminal doesn't exist
      }

      if (terminals.length <= 1) {
        return false; // Can't remove the last terminal
      }

      const index = terminals.indexOf(terminalId);
      const newTerminals = terminals.filter((term) => term !== terminalId);

      // Update refs
      terminalsRef.current = newTerminals;
      if (activeTerminalRef.current === terminalId) {
        const newActiveIndex = Math.min(index, newTerminals.length - 1);
        activeTerminalRef.current = newTerminals[newActiveIndex];
      }

      // Update state for UI
      setTerminals(newTerminals);
      if (activeTerminal === terminalId) {
        const newActiveIndex = Math.min(index, newTerminals.length - 1);
        setActiveTerminal(newTerminals[newActiveIndex]);
      }

      // Cleanup resources
      if (terminalInstancesRef.current[terminalId]) {
        terminalInstancesRef.current[terminalId].dispose();
        delete terminalInstancesRef.current[terminalId];
      }

      if (writersRef.current[terminalId]) {
        writersRef.current[terminalId]?.releaseLock();
        delete writersRef.current[terminalId];
      }

      if (shellProcessesRef.current[terminalId]) {
        shellProcessesRef.current[terminalId].kill();
        delete shellProcessesRef.current[terminalId];
      }

      delete fitAddonsRef.current[terminalId];

      // Clean up ResizeObserver
      if (resizeObserversRef.current[terminalId]) {
        resizeObserversRef.current[terminalId].disconnect();
        delete resizeObserversRef.current[terminalId];
      }

      // Remove from initialized set
      initializedTerminals.current.delete(terminalId);

      // Remove terminal name
      delete terminalNamesRef.current[terminalId];

      return true; // Successfully removed
    };

    // Function to get list of all terminal IDs
    window.getTerminalList = (): string[] => {
      return [...terminalsRef.current];
    };

    // Create a function to execute commands specifically in claude-code terminal
    window.executeClaudeCommand = async (
      command: string
    ): Promise<CommandResult> => {
      window.terminalIsBusy = true;
      const terminalId = "claude-code";
      const writer = writersRef.current[terminalId];

      if (!writer) {
        console.error("Claude terminal writer not ready");
        window.terminalIsBusy = false;
        return { success: false, output: "" };
      }

      if (webcontainerInstance) {
        workingdirRef.current = webcontainerInstance?.workdir;
      }
      // Clear any previous output buffer for this command
      let commandOutput = "";

      // Create a promise that will resolve when command completion is detected
      const outputPromise = new Promise<OutputResult>((resolve) => {
        // Initialize callbacks array if needed
        if (!commandOutputCallbacksRef.current[terminalId]) {
          commandOutputCallbacksRef.current[terminalId] = [];
        }

        // Command completion detector
        let isIdle = false;
        let idleTimer: NodeJS.Timeout | null = null;
        let outputSinceLastCheck = false;

        const outputCallback = (output: string): void => {
          commandOutput += output;
          outputSinceLastCheck = true;

          // Reset idle detection every time we get output
          if (idleTimer) {
            clearTimeout(idleTimer);
            idleTimer = null;
          }

          // Look for bash prompt pattern to detect command completion
          const promptPatterns = [
            /\$ $/, // Standard bash prompt
            />.* $/, // Windows command prompt
            /\] \$ $/, // Another common bash prompt format
            /\w+@\w+:.+\$ $/, // username@hostname:/path$ format
          ];

          // Check if output ends with a prompt pattern
          const hasPrompt = promptPatterns.some((pattern) =>
            pattern.test(commandOutput)
          );

          if (hasPrompt) {
            // Command seems to have completed
            finishCommand();
          } else {
            // Set a new idle timer - if no output comes for a while, assume command is done
            idleTimer = setTimeout(checkIdle, 500);
          }
        };

        // Check if command has been idle (no output) for a while
        const checkIdle = (): void => {
          if (!outputSinceLastCheck) {
            // Double-check if we're really idle by waiting a bit longer
            if (!isIdle) {
              isIdle = true;
              idleTimer = setTimeout(finishCommand, 500);
            }
          } else {
            // Got output since last check, reset flag and wait again
            outputSinceLastCheck = false;
            idleTimer = setTimeout(checkIdle, 500);
          }
        };

        // Finish command execution, clean up and resolve promise
        const finishCommand = (): void => {
          // Remove this callback from the list
          const index =
            commandOutputCallbacksRef.current[terminalId]?.indexOf(
              outputCallback
            );
          if (index > -1) {
            commandOutputCallbacksRef.current[terminalId].splice(index, 1);
          }

          if (idleTimer) {
            clearTimeout(idleTimer);
            idleTimer = null;
          }

          // Determine success/failure
          let exitCode = 0;

          // More sophisticated error detection
          const errorPatterns = [
            /command not found/i,
            /no such file or directory/i,
            /permission denied/i,
            /cannot access/i,
            /error:/i,
            /failed:/i,
            /not found/i,
            /exit code: [1-9][0-9]*/i, // Look for non-zero exit codes
          ];

          const hasError = errorPatterns.some((pattern) =>
            pattern.test(commandOutput)
          );
          exitCode = hasError ? 1 : 0;

          // Also look for explicit exit code references
          const exitCodeMatch = commandOutput.match(/exit code: (\d+)/i);
          if (exitCodeMatch && exitCodeMatch[1]) {
            exitCode = parseInt(exitCodeMatch[1], 10);
          }

          resolve({
            output: commandOutput,
            exitCode,
          });
        };

        // Register the callback to receive output
        commandOutputCallbacksRef.current[terminalId].push(outputCallback);

        // Set a maximum timeout as a safety - don't wait forever
        setTimeout(() => {
          if (idleTimer) {
            clearTimeout(idleTimer);
            idleTimer = null;
          }

          // If not resolved yet, force completion
          const index =
            commandOutputCallbacksRef.current[terminalId]?.indexOf(
              outputCallback
            );
          if (index > -1) {
            commandOutputCallbacksRef.current[terminalId].splice(index, 1);
            console.warn("Claude command timed out - forcing completion");

            resolve({
              output: commandOutput,
              exitCode: 0, // Assume success if we timeout
            });
          }
        }, 10000); // 10 second maximum timeout

        // Start idle detection
        idleTimer = setTimeout(checkIdle, 500);
      });

      // Send the command
      if (command === "^C" || command === "CTRL+C" || command === "CTRL_C") {
        writer.write("\x03");
      } else {
        writer.write(command + "\n");
      }

      // Wait for output
      const { output, exitCode } = await outputPromise;

      window.terminalIsBusy = false;
      const success = exitCode === 0;

      return { success, output };
    };

    // Create a generalized terminal command execution function
    window.executeTerminalCommand = async (
      command: string
    ): Promise<CommandResult> => {
      window.terminalIsBusy = true;
      const terminalId = "terminal-1";
      const writer = writersRef.current[terminalId];

      if (!writer) {
        console.error("Terminal writer not ready");
        window.terminalIsBusy = false;
        return { success: false, output: "" };
      }

      if (webcontainerInstance) {
        workingdirRef.current = webcontainerInstance?.workdir;
      }
      // Clear any previous output buffer for this command
      let commandOutput = "";

      // Create a promise that will resolve when command completion is detected
      const outputPromise = new Promise<OutputResult>((resolve) => {
        // Initialize callbacks array if needed
        if (!commandOutputCallbacksRef.current[terminalId]) {
          commandOutputCallbacksRef.current[terminalId] = [];
        }

        // Command completion detector
        let isIdle = false;
        let idleTimer: NodeJS.Timeout | null = null;
        let outputSinceLastCheck = false;

        const outputCallback = (output: string): void => {
          commandOutput += output;
          outputSinceLastCheck = true;

          // Reset idle detection every time we get output
          if (idleTimer) {
            clearTimeout(idleTimer);
            idleTimer = null;
          }

          // Look for bash prompt pattern to detect command completion
          // Adjust these patterns to match your terminal prompt
          const promptPatterns = [
            /\$ $/, // Standard bash prompt
            />.* $/, // Windows command prompt
            /\] \$ $/, // Another common bash prompt format
            /\w+@\w+:.+\$ $/, // username@hostname:/path$ format
          ];

          // Check if output ends with a prompt pattern
          const hasPrompt = promptPatterns.some((pattern) =>
            pattern.test(commandOutput)
          );

          if (hasPrompt) {
            // Command seems to have completed
            finishCommand();
          } else {
            // Set a new idle timer - if no output comes for a while, assume command is done
            idleTimer = setTimeout(checkIdle, 500);
          }
        };

        // Check if command has been idle (no output) for a while
        const checkIdle = (): void => {
          if (!outputSinceLastCheck) {
            // Double-check if we're really idle by waiting a bit longer
            if (!isIdle) {
              isIdle = true;
              idleTimer = setTimeout(finishCommand, 500);
            }
          } else {
            // Got output since last check, reset flag and wait again
            outputSinceLastCheck = false;
            idleTimer = setTimeout(checkIdle, 500);
          }
        };

        // Finish command execution, clean up and resolve promise
        const finishCommand = (): void => {
          // Remove this callback from the list
          const index =
            commandOutputCallbacksRef.current[terminalId]?.indexOf(
              outputCallback
            );
          if (index > -1) {
            commandOutputCallbacksRef.current[terminalId].splice(index, 1);
          }

          if (idleTimer) {
            clearTimeout(idleTimer);
            idleTimer = null;
          }

          // Determine success/failure
          let exitCode = 0;

          // More sophisticated error detection
          const errorPatterns = [
            /command not found/i,
            /no such file or directory/i,
            /permission denied/i,
            /cannot access/i,
            /error:/i,
            /failed:/i,
            /not found/i,
            /exit code: [1-9][0-9]*/i, // Look for non-zero exit codes
          ];

          const hasError = errorPatterns.some((pattern) =>
            pattern.test(commandOutput)
          );
          exitCode = hasError ? 1 : 0;

          // Also look for explicit exit code references
          const exitCodeMatch = commandOutput.match(/exit code: (\d+)/i);
          if (exitCodeMatch && exitCodeMatch[1]) {
            exitCode = parseInt(exitCodeMatch[1], 10);
          }

          resolve({
            output: commandOutput,
            exitCode,
          });
        };

        // Register the callback to receive output
        commandOutputCallbacksRef.current[terminalId].push(outputCallback);

        // Set a maximum timeout as a safety - don't wait forever
        setTimeout(() => {
          if (idleTimer) {
            clearTimeout(idleTimer);
            idleTimer = null;
          }

          // If not resolved yet, force completion
          const index =
            commandOutputCallbacksRef.current[terminalId]?.indexOf(
              outputCallback
            );
          if (index > -1) {
            commandOutputCallbacksRef.current[terminalId].splice(index, 1);
            console.warn("Command timed out - forcing completion");

            resolve({
              output: commandOutput,
              exitCode: 0, // Assume success if we timeout
            });
          }
        }, 10000); // 10 second maximum timeout

        // Start idle detection
        idleTimer = setTimeout(checkIdle, 500);
      });

      // Send the command
      if (command === "^C" || command === "CTRL+C" || command === "CTRL_C") {
        writer.write("\x03");
      } else {
        writer.write(command + "\n");
      }

      // Wait for output
      const { output, exitCode } = await outputPromise;

      window.terminalIsBusy = false;
      const success = exitCode === 0;

      return { success, output };
    };
    // Maintain backward compatibility
    window.terminalInterrupt = async (): Promise<boolean> => {
      if (typeof window.executeTerminalCommand === "function") {
        const result = await window.executeTerminalCommand("^C");
        return result.success;
      } else {
        return false;
      }
    };

    // Set terminal ready state for AI to access
    window.terminalReady = !!webcontainerInstance;
  }, [
    webcontainerInstance,
    initTerminalInstance,
    activeTerminal,
    terminals,
    addTerminal,
    workingdirRef,
  ]);

  // Handle global resize with throttling
  useEffect(() => {
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    const handleResize = (): void => {
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }

      resizeTimer = setTimeout(() => {
        Object.values(fitAddonsRef.current).forEach((fit) => {
          if (fit && typeof fit.fit === "function") {
            try {
              fit.fit();
            } catch (err) {
              console.error("Fit error during resize:", err);
            }
          }
        });
      }, 100);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }

      // Cleanup all terminals and processes
      Object.values(terminalInstancesRef.current).forEach((term) => {
        if (term && typeof term.dispose === "function") {
          term.dispose();
        }
      });

      Object.values(writersRef.current).forEach((writer) => {
        if (writer && typeof writer.releaseLock === "function") {
          writer.releaseLock();
        }
      });

      Object.values(shellProcessesRef.current).forEach((shell) => {
        if (shell && typeof shell.kill === "function") {
          shell.kill();
        }
      });

      // Clear initialized terminals set
      initializedTerminals.current.clear();
    };
  }, []);

  if (state === "error" || isTerminalReady === "error") {
    return (
      <div className="h-full w-full justify-center items-center gap-3 flex flex-col text-white font-sans">
        <p className="font-medium text-sm">
          Error initializing terminal.
        </p>
        <button
          onClick={() => {
            void bootContainer();
          }}
          className="rounded-md border border-[#2a2a2f] bg-[#1b1d24] px-3 py-1.5 text-xs text-[#d5d7df] hover:text-white"
        >
          Retry terminal
        </button>
      </div>
    );
  }

  if (state !== "success" && !webcontainerInstance) {
    return (
      <div className="justify-center items-center h-full w-full flex text-white font-sans font-medium text-sm">
        <LuLoader className="animate-spin text-lg" />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col text-xs shadow-md">
      <div className="h-7 flex items-center justify-between border-[#2a2a2a] border-b">
        <div className="flex items-center overflow-x-auto">
          {terminals.map((id) => (
            <div
              key={id}
              onClick={() => setActiveTerminal(id)}
              className={`px-2 flex h-7 items-center justify-between text-xs font-mono cursor-pointer relative border-r border-b border-[#222222] gap-x-4 ${
                activeTerminal === id
                  ? "bg-[#1A1A1A] text-white"
                  : "text-[#949494]"
              }`}
            >
              <div className="flex text-xs font-sans font-normal text-white items-center text-ellipsis truncate">
                {terminalNamesRef.current[id] || "Terminal"}
              </div>
              {terminals.length > 1 &&
                id !== "terminal-1" &&
                id !== "claude-code" && (
                  <IoClose
                    onClick={(e) => closeTerminal(id, e)}
                    className="text-[#949494] text-base hover:bg-[#2a2a2a] rounded-sm p-1 flex-shrink-0 cursor-pointer transition-colors"
                    style={{ width: "21px", height: "21px" }}
                  />
                )}
            </div>
          ))}
        </div>
        <button
          onClick={() => addTerminal()}
          className="px-3 h-full text-[#949494] hover:text-white font-sans text-xs flex items-center justify-center cursor-pointer hover:bg-[#2a2a2a] flex-shrink-0"
        >
          Add a new terminal
        </button>
      </div>

      <div className="flex-1 relative">
        {terminals.map((id) => (
          <div
            key={id}
            className={`absolute inset-0 ${activeTerminal === id ? "block" : "hidden"}`}
          >
            <div className="w-full h-full bg-black rounded-b overflow-hidden p-2">
              <div id={`terminal-container-${id}`} className="w-full h-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default React.memo(Terminal);
