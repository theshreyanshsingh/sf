import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

async function getFilesRecursively(dir: string, baseDir: string) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: Record<string, string> = {};

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    // Ignore specific directories and files
    if (
      entry.isDirectory() &&
      (entry.name === "node_modules" ||
        entry.name === ".git" ||
        entry.name === ".next")
    ) {
      continue;
    }

    if (entry.isFile() && entry.name === "bun.lock") {
      continue;
    }

    if (entry.isDirectory()) {
      const subFiles = await getFilesRecursively(fullPath, baseDir);
      Object.assign(files, subFiles);
    } else {
      try {
        const content = await fs.readFile(fullPath, "utf-8");
        files[relativePath] = content;
      } catch (error) {
        console.error(`Error reading file ${relativePath}:`, error);
      }
    }
  }

  return files;
}

export async function GET() {
  try {
    const testAppDir = path.join(process.cwd(), "app/test/app");

    // Check if directory exists
    try {
      await fs.access(testAppDir);
    } catch {
      return NextResponse.json(
        { error: "Test app directory not found" },
        { status: 404 }
      );
    }

    const files = await getFilesRecursively(testAppDir, testAppDir);
    return NextResponse.json(files);
  } catch (error) {
    console.error("Error serving test files:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
