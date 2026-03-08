/**
 * Execute a command in the terminal and wait for result
 * @param command Command to execute
 * @returns Promise resolving to result object
 */
export const executeTerminalCmd = async (
  command: string
): Promise<{ success: boolean; output: string }> => {
  if (typeof window === "undefined" || !window.executeTerminalCommand) {
    console.error("Terminal command execution not available");
    return { success: false, output: "" };
  }

  // Wait if terminal is busy
  let attempts = 0;
  while (window.terminalIsBusy && attempts < 50) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    attempts++;
  }

  if (window.terminalIsBusy) {
    console.error("Terminal is busy");
    return { success: false, output: "" };
  }

  return await window.executeTerminalCommand(command);
};

/**
 * Execute a command with timeout
 * @param command Command to execute
 * @param timeout Timeout in milliseconds
 * @returns Promise resolving to result object
 */
export const executeWithTimeout = async (
  command: string,
  timeout = 10000
): Promise<{ success: boolean; timedOut: boolean; output: string }> => {
  let timedOut = false;

  const timer = new Promise<{ success: boolean; output: string }>((resolve) => {
    setTimeout(async () => {
      timedOut = true;
      await window.terminalInterrupt?.();
      resolve({ success: false, output: "Command timed out." });
    }, timeout);
  });

  const execution = executeTerminalCmd(command);
  const { success, output } = await Promise.race([execution, timer]);

  return { success, timedOut, output };
};
