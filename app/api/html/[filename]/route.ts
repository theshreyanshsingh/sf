import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;

    // Construct absolute path to the target HTML file inside app/helpers
    const filePath = path.join(process.cwd(), "app", "helpers", `${filename}.html`);

    // Read the file as UTF-8 text
    const fileContents = await fs.readFile(filePath, "utf-8");

    // Return JSON with the raw HTML string (already a string, but JSON-encoded)
    return NextResponse.json({ html: fileContents });
  } catch (error) {
    console.error("Error reading HTML file:", error);
    return NextResponse.json(
      { error: "Failed to read requested HTML file." },
      { status: 500 }
    );
  }
} 