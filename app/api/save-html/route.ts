import { writeFile } from 'fs/promises';
import { join } from 'path';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { html, css, filename = 'custom.html' } = await request.json();

    // Compose a full HTML document
    const fullHtml = `<!DOCTYPE html>\n<html>\n<head>\n<meta charset=\"utf-8\">\n<style>${css}</style>\n</head>\n<body>${html}</body>\n</html>`;

    // Always write to the public directory so it is directly fetch-able from the site root
    const filepath = join(process.cwd(), 'public', filename);
    await writeFile(filepath, fullHtml, 'utf8');

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[save-html] error:', err);
    return new NextResponse('Unable to save file', { status: 500 });
  }
} 