import { NextResponse } from "next/server";

function directoryBaseHref(pageUrl: string): string {
  return new URL(".", pageUrl).href;
}

function injectBaseForEmbed(html: string, pageUrl: string): string {
  const baseHref = directoryBaseHref(pageUrl);
  if (/<base\s/i.test(html)) return html;
  const injection = `<base href="${baseHref}">`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${injection}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(
      /<html([^>]*)>/i,
      `<html$1><head>${injection}</head>`,
    );
  }
  return `<!DOCTYPE html><html><head>${injection}</head><body>${html}</body></html>`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get("url");
    const embed = searchParams.get("embed") === "1";

    if (!targetUrl) {
      return new NextResponse("Missing 'url' query parameter.", {
        status: 400,
      });
    }

    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return new NextResponse("Invalid URL.", { status: 400 });
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return new NextResponse("Only http(s) URLs are allowed.", {
        status: 400,
      });
    }

    const remoteResp = await fetch(parsed.href, {
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (compatible; SuperblocksEmbed/1.0; +https://superblocks.xyz)",
      },
    });

    if (!remoteResp.ok) {
      return new NextResponse(
        `Failed to fetch remote URL. Status: ${remoteResp.status}`,
        { status: remoteResp.status },
      );
    }

    let html = await remoteResp.text();

    if (embed) {
      html = injectBaseForEmbed(html, parsed.href);
    }

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        // Same-origin iframe in our app — not the remote’s X-Frame-Options
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[proxy-html] error:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
