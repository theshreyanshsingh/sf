"use client";

/**
 * Bash one-liner for WebContainer primary terminal: npm install + dev server.
 * Caller should send Ctrl+C (`\\u0003`) first if a prior process may be running.
 */
export const WEB_DEV_SERVER_SHELL_COMMAND =
  "echo 'legacy-peer-deps=true' > ~/.npmrc && " +
  "echo 'fetch-retry-mintimeout=20000' >> ~/.npmrc && " +
  "echo 'fetch-retry-maxtimeout=120000' >> ~/.npmrc && " +
  "npm install --legacy-peer-deps --prefer-offline --no-update-notifier && " +
  "npm run dev\n";
