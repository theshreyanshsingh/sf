import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get("url");

    if (!targetUrl) {
      return new NextResponse("Missing 'url' query parameter.", {
        status: 400,
      });
    }

    const remoteResp = await fetch(targetUrl);

    if (!remoteResp.ok) {
      return new NextResponse(
        `Failed to fetch remote URL. Status: ${remoteResp.status}`,
        { status: remoteResp.status }
      );
    }

    const html = await remoteResp.text();

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // Allow any origin so the browser can consume it freely on the client side
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("[proxy-html] error:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 