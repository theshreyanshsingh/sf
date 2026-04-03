const { spawn } = require("child_process");

function getInstalledNextMajorVersion() {
  try {
    const { version } = require("next/package.json");
    const major = Number.parseInt(String(version).split(".")[0], 10);
    return Number.isFinite(major) ? major : null;
  } catch (error) {
    console.warn(
      "[run-next] Unable to detect installed Next.js version, falling back to plain next command.",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

function main() {
  const [, , command, ...restArgs] = process.argv;

  if (!command) {
    console.error("[run-next] Missing Next.js command. Expected one of: dev, build, start, lint.");
    process.exit(1);
  }

  const nextBin = require.resolve("next/dist/bin/next");
  const nextMajor = getInstalledNextMajorVersion();
  const args = [nextBin, command, ...restArgs];

  // Next.js 16 enables Turbopack by default and errors when a custom webpack
  // config exists without an explicit bundler choice. We keep using webpack
  // until this app is migrated, but only when the installed Next version
  // actually supports the flag.
  if ((command === "dev" || command === "build") && nextMajor >= 16) {
    args.push("--webpack");
  }

  const child = spawn(process.execPath, args, {
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });

  child.on("error", (error) => {
    console.error("[run-next] Failed to launch Next.js:", error);
    process.exit(1);
  });
}

main();
