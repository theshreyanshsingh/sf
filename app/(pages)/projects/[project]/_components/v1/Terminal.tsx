"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import "@xterm/xterm/css/xterm.css";
import { boot, getContainer, onServerReady } from "@/app/helpers/webcontainer";
import { useDispatch } from "react-redux";
import { setPreviewUrl } from "@/app/redux/reducers/projectOptions";
import { IoClose } from "react-icons/io5";
import { LuLoader } from "react-icons/lu";
import type { Terminal as XtermTerminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";
import type { WebContainerProcess } from "@webcontainer/api";

declare global {
  interface Window {
    addTerminal: (customName?: string) => string;
    isTerminalReady: (terminalId: string) => boolean;
    waitForTerminalReady: (terminalId: string, timeout?: number) => Promise<boolean>;
    removeTerminal: (terminalId: string) => boolean;
    getTerminalList: () => string[];
    writeTerminalInput?: (terminalId: string, input: string) => Promise<boolean>;
    executeTerminalCommand?: (command: string) => Promise<{ success: boolean; output: string }>;
    executeClaudeCommand?: (command: string) => Promise<{ success: boolean; output: string }>;
    terminalInterrupt: () => Promise<boolean>;
    terminalReady: boolean;
    terminalIsBusy: boolean;
  }
}

type BootState = "idle" | "booting" | "ready" | "error";

const XTERM_THEME = {
  background: "#000000",
  foreground: "#F8F8F8",
  cursor: "#52AD70",
  black: "#1E1E1E",
  red: "#E06C75",
  brightRed: "#F97583",
  green: "#52AD70",
  brightGreen: "#67C881",
  yellow: "#EAD64D",
  brightYellow: "#F5DA89",
  blue: "#4f92e1",
  brightBlue: "#4f92e1",
  magenta: "#C678DD",
  brightMagenta: "#D68DF0",
  cyan: "#56B6C2",
  brightCyan: "#67D3E0",
  white: "#ABB2BF",
  brightWhite: "#FFFFFF",
  brightBlack: "#5C6370",
};

const Terminal = () => {
  const dispatch = useDispatch();
  const [bootState, setBootState] = useState<BootState>("idle");
  const [terminals, setTerminals] = useState<string[]>(["terminal-1"]);
  const [activeTerminal, setActiveTerminal] = useState("terminal-1");

  const terminalsRef = useRef(["terminal-1"]);
  const activeTerminalRef = useRef("terminal-1");
  const terminalNamesRef = useRef<Record<string, string>>({ "terminal-1": "Terminal" });

  const xtermRef = useRef<Record<string, XtermTerminal>>({});
  const fitRef = useRef<Record<string, FitAddon>>({});
  const shellRef = useRef<Record<string, WebContainerProcess>>({});
  const writerRef = useRef<Record<string, WritableStreamDefaultWriter<string>>>({});
  const observerRef = useRef<Record<string, ResizeObserver>>({});
  const initedRef = useRef(new Set<string>());

  const outputBuf = useRef<Record<string, string>>({});
  const outputCbs = useRef<Record<string, ((chunk: string) => void)[]>>({});

  /* ------------------------------------------------------------ */
  /*  Boot WebContainer once                                       */
  /* ------------------------------------------------------------ */

  useEffect(() => {
    if (bootState !== "idle") return;
    setBootState("booting");
    let unregisterServerReady: (() => void) | null = null;

    boot()
      .then(() => {
        return onServerReady((_port, url) => dispatch(setPreviewUrl(url)));
      })
      .then((unsubscribe) => {
        unregisterServerReady = unsubscribe;
        setBootState("ready");
      })
      .catch(() => setBootState("error"));

    return () => {
      unregisterServerReady?.();
    };
  }, [bootState, dispatch]);

  /* ------------------------------------------------------------ */
  /*  Create xterm + spawn bash for a given tab id                 */
  /* ------------------------------------------------------------ */

  const initTab = useCallback(async (id: string) => {
    if (initedRef.current.has(id)) return;
    const wc = getContainer();
    if (!wc) return;

    const [{ Terminal: Xterm }, { FitAddon }] = await Promise.all([
      import("@xterm/xterm"),
      import("@xterm/addon-fit"),
    ]);

    const fit = new FitAddon();
    const term = new Xterm({
      fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: "underline",
      theme: XTERM_THEME,
      allowTransparency: true,
      convertEol: true,
    });
    term.loadAddon(fit);

    const el = document.getElementById(`terminal-container-${id}`);
    if (!el) return;

    term.open(el);

    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
        if (activeTerminalRef.current === id) term.focus();
      } catch { /* */ }
    });
    ro.observe(el);
    setTimeout(() => { try { fit.fit(); term.focus(); } catch { /* */ } }, 0);

    xtermRef.current[id] = term;
    fitRef.current[id] = fit;
    observerRef.current[id] = ro;
    initedRef.current.add(id);

    // Spawn bash
    const shell = await wc.spawn("bash", {
      terminal: { cols: term.cols, rows: term.rows },
    });
    shellRef.current[id] = shell;

    const writer = shell.input.getWriter();
    writerRef.current[id] = writer;
    if (id === "terminal-1" && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("SB_PRIMARY_TERMINAL_READY"));
    }

    term.onData((data) => writer.write(data));
    term.onResize(({ cols, rows }) => shell.resize({ cols, rows }));

    // Read output
    outputBuf.current[id] = "";
    outputCbs.current[id] = [];

    const reader = shell.output.getReader();
    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            term.write(value);
            outputBuf.current[id] += value;
            outputCbs.current[id]?.forEach((cb) => cb(value));
          }
        }
      } catch { /* stream closed */ }
    })();

  }, []);

  /* ------------------------------------------------------------ */
  /*  Init first terminal once container is ready                  */
  /* ------------------------------------------------------------ */

  useEffect(() => {
    if (bootState !== "ready") return;
    if (!initedRef.current.has("terminal-1")) {
      setTimeout(() => initTab("terminal-1"), 100);
    }
  }, [bootState, initTab]);

  /* ------------------------------------------------------------ */
  /*  Add / close tabs                                             */
  /* ------------------------------------------------------------ */

  const addTerminal = useCallback((customName?: string): string => {
    const name = customName || "Terminal";
    const id = customName === "claude-code"
      ? "claude-code"
      : `terminal-${Math.floor(100000 + Math.random() * 900000)}`;

    if (id === "claude-code" && terminalsRef.current.includes("claude-code")) {
      setActiveTerminal("claude-code");
      activeTerminalRef.current = "claude-code";
      return "claude-code";
    }

    terminalNamesRef.current[id] = name;
    terminalsRef.current = [...terminalsRef.current, id];
    activeTerminalRef.current = id;
    setTerminals((prev) => [...prev, id]);
    setActiveTerminal(id);

    setTimeout(() => initTab(id), 100);
    return id;
  }, [initTab]);

  const closeTerminal = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (id === "claude-code" || terminals.length <= 1) return;

    const idx = terminals.indexOf(id);
    const next = terminals.filter((t) => t !== id);
    terminalsRef.current = next;

    if (activeTerminalRef.current === id) {
      const ni = Math.min(idx, next.length - 1);
      activeTerminalRef.current = next[ni];
      setActiveTerminal(next[ni]);
    }
    setTerminals(next);

    xtermRef.current[id]?.dispose();
    delete xtermRef.current[id];
    writerRef.current[id]?.releaseLock();
    delete writerRef.current[id];
    shellRef.current[id]?.kill();
    delete shellRef.current[id];
    delete fitRef.current[id];
    observerRef.current[id]?.disconnect();
    delete observerRef.current[id];
    initedRef.current.delete(id);
    delete terminalNamesRef.current[id];
  };

  /* ------------------------------------------------------------ */
  /*  Focus / fit on tab switch                                    */
  /* ------------------------------------------------------------ */

  useEffect(() => {
    activeTerminalRef.current = activeTerminal;
    const term = xtermRef.current[activeTerminal];
    const fit = fitRef.current[activeTerminal];
    if (term) setTimeout(() => { try { fit?.fit(); } catch {} term.focus(); }, 0);
  }, [activeTerminal]);

  useEffect(() => { terminalsRef.current = terminals; }, [terminals]);

  /* ------------------------------------------------------------ */
  /*  Execute a command programmatically & wait for result         */
  /* ------------------------------------------------------------ */

  const execInTerminal = useCallback((terminalId: string, command: string): Promise<{ success: boolean; output: string }> => {
    const writer = writerRef.current[terminalId];
    if (!writer) return Promise.resolve({ success: false, output: "" });

    window.terminalIsBusy = true;

    return new Promise((resolve) => {
      let buf = "";
      let idle: ReturnType<typeof setTimeout> | null = null;
      let outputSince = false;

      const promptRe = [/\$ $/, />.* $/, /\] \$ $/, /\w+@\w+:.+\$ $/];
      const errorRe = [/command not found/i, /no such file or directory/i, /permission denied/i, /error:/i, /failed:/i];

      const finish = () => {
        const i = (outputCbs.current[terminalId] ?? []).indexOf(cb);
        if (i > -1) outputCbs.current[terminalId].splice(i, 1);
        if (idle) clearTimeout(idle);
        const hasErr = errorRe.some((r) => r.test(buf));
        const codeMatch = buf.match(/exit code: (\d+)/i);
        const code = codeMatch ? parseInt(codeMatch[1], 10) : hasErr ? 1 : 0;
        window.terminalIsBusy = false;
        resolve({ success: code === 0, output: buf });
      };

      const checkIdle = () => {
        if (!outputSince) { finish(); return; }
        outputSince = false;
        idle = setTimeout(checkIdle, 500);
      };

      const cb = (chunk: string) => {
        buf += chunk;
        outputSince = true;
        if (idle) clearTimeout(idle);
        if (promptRe.some((r) => r.test(buf))) { finish(); return; }
        idle = setTimeout(checkIdle, 500);
      };

      if (!outputCbs.current[terminalId]) outputCbs.current[terminalId] = [];
      outputCbs.current[terminalId].push(cb);

      // Safety timeout
      setTimeout(() => {
        const i = (outputCbs.current[terminalId] ?? []).indexOf(cb);
        if (i > -1) { outputCbs.current[terminalId].splice(i, 1); finish(); }
      }, 10000);

      idle = setTimeout(checkIdle, 500);

      if (command === "^C" || command === "CTRL+C" || command === "CTRL_C") {
        writer.write("\x03");
      } else {
        writer.write(command + "\n");
      }
    });
  }, []);

  /* ------------------------------------------------------------ */
  /*  Expose window APIs for AI / external callers                 */
  /* ------------------------------------------------------------ */

  useEffect(() => {
    window.addTerminal = addTerminal;
    window.getTerminalList = () => [...terminalsRef.current];

    window.isTerminalReady = (id) =>
      initedRef.current.has(id) && !!writerRef.current[id];

    window.waitForTerminalReady = (id, timeout = 10000) =>
      new Promise((resolve) => {
        const t0 = Date.now();
        const poll = () => {
          if (window.isTerminalReady(id)) { resolve(true); return; }
          if (Date.now() - t0 > timeout) { resolve(false); return; }
          setTimeout(poll, 100);
        };
        poll();
      });

    window.removeTerminal = (id) => {
      if (!terminalsRef.current.includes(id) || terminalsRef.current.length <= 1) return false;
      const idx = terminalsRef.current.indexOf(id);
      const next = terminalsRef.current.filter((t) => t !== id);
      terminalsRef.current = next;
      if (activeTerminalRef.current === id) {
        activeTerminalRef.current = next[Math.min(idx, next.length - 1)];
        setActiveTerminal(activeTerminalRef.current);
      }
      setTerminals([...next]);
      xtermRef.current[id]?.dispose(); delete xtermRef.current[id];
      writerRef.current[id]?.releaseLock(); delete writerRef.current[id];
      shellRef.current[id]?.kill(); delete shellRef.current[id];
      delete fitRef.current[id];
      observerRef.current[id]?.disconnect(); delete observerRef.current[id];
      initedRef.current.delete(id);
      delete terminalNamesRef.current[id];
      return true;
    };

    window.writeTerminalInput = async (terminalId, input) => {
      const writer = writerRef.current[terminalId];
      if (!writer) return false;
      try {
        await writer.write(input);
        return true;
      } catch {
        return false;
      }
    };

    window.executeTerminalCommand = (cmd) => execInTerminal("terminal-1", cmd);
    window.executeClaudeCommand = (cmd) => execInTerminal("claude-code", cmd);

    window.terminalInterrupt = async () => {
      if (window.executeTerminalCommand) {
        return (await window.executeTerminalCommand("^C")).success;
      }
      return false;
    };

    window.terminalReady = bootState === "ready";
    window.terminalIsBusy = false;
  }, [bootState, addTerminal, execInTerminal, terminals, activeTerminal]);

  /* ------------------------------------------------------------ */
  /*  Global resize handler + cleanup                              */
  /* ------------------------------------------------------------ */

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        Object.values(fitRef.current).forEach((f) => { try { f.fit(); } catch {} });
      }, 100);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (timer) clearTimeout(timer);
      Object.values(xtermRef.current).forEach((t) => t?.dispose());
      Object.values(writerRef.current).forEach((w) => { try { w?.releaseLock(); } catch {} });
      Object.values(shellRef.current).forEach((s) => { try { s?.kill(); } catch {} });
      Object.values(observerRef.current).forEach((o) => o?.disconnect());
      initedRef.current.clear();
    };
  }, []);

  /* ------------------------------------------------------------ */
  /*  Render                                                       */
  /* ------------------------------------------------------------ */

  if (bootState === "error") {
    return (
      <div className="h-full w-full justify-center items-center gap-3 flex flex-col text-white font-sans">
        <p className="font-medium text-sm">Error initializing terminal.</p>
        <button
          onClick={() => setBootState("idle")}
          className="rounded-md border border-[#2a2a2f] bg-[#1b1d24] px-3 py-1.5 text-xs text-[#d5d7df] hover:text-white"
        >
          Retry terminal
        </button>
      </div>
    );
  }

  if (bootState !== "ready") {
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
                activeTerminal === id ? "bg-[#1A1A1A] text-white" : "text-[#949494]"
              }`}
            >
              <div className="flex text-xs font-sans font-normal text-white items-center text-ellipsis truncate">
                {terminalNamesRef.current[id] || "Terminal"}
              </div>
              {terminals.length > 1 && id !== "terminal-1" && id !== "claude-code" && (
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
          <div key={id} className={`absolute inset-0 ${activeTerminal === id ? "block" : "hidden"}`}>
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
