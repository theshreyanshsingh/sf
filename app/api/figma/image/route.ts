import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("figma_token")?.value;
  if (!token) return new NextResponse("Unauthorized", { status: 401 });

  const { url } = (await req.json()) as { url: string };
  if (!url) return new NextResponse("Missing url", { status: 400 });
  console.log(url);
  // Parse file key and optional node-id from provided Figma URL
  let fileKey: string | undefined;
  let nodeIdFromUrl: string | null = null;
  try {
    const u = new URL(url);
    // /file/{key}/... or /design/{key}/...
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p === "file" || p === "design");
    if (idx !== -1 && parts[idx + 1]) fileKey = parts[idx + 1];
    nodeIdFromUrl =
      u.searchParams.get("node-id") || u.searchParams.get("node_id");
  } catch {
    // fallback regex
    const match = url.match(/figma\.com\/(?:file|design)\/([A-Za-z0-9]+)\//);
    fileKey = match?.[1];
  }
  if (!fileKey) return new NextResponse("Invalid Figma URL", { status: 400 });

  // Get file to extract first node id
  const fileRes = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!fileRes.ok) {
    const text = await fileRes.text();
    return new NextResponse(text || "Failed to read file", { status: 400 });
  }
  const fileJson = await fileRes.json();
  // Find a FRAME node – prefer node-id if present, else first FRAME
  const findNodeById = (node: any, id: string): any | null => {
    if (!node) return null;
    if (node.id === id) return node;
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        const found = findNodeById(child, id);
        if (found) return found;
      }
    }
    return null;
  };
  const findFirstOfType = (node: any, type: string): any | null => {
    if (!node) return null;
    if (node.type === type) return node;
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        const found = findFirstOfType(child, type);
        if (found) return found;
      }
    }
    return null;
  };

  let targetFrame: any | null = null;
  if (nodeIdFromUrl && nodeIdFromUrl.length > 0) {
    const decoded = decodeURIComponent(nodeIdFromUrl);
    const normalizedId = decoded.includes(":")
      ? decoded
      : decoded.replace(/-/g, ":");
    const selected = findNodeById(fileJson.document, normalizedId);
    if (selected?.type === "FRAME") targetFrame = selected;
    else if (selected) targetFrame = findFirstOfType(selected, "FRAME");
  }
  if (!targetFrame) targetFrame = findFirstOfType(fileJson.document, "FRAME");
  if (!targetFrame?.id)
    return new NextResponse("No FRAME found to render", { status: 400 });
  const nodeId = targetFrame.id as string;

  const imgRes = await fetch(
    `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&format=png&scale=2`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }
  );
  if (!imgRes.ok) {
    const text = await imgRes.text();
    return new NextResponse(text || "Failed to request image", { status: 400 });
  }
  const imgJson = await imgRes.json();
  const imageUrl = imgJson.images?.[nodeId];
  if (!imageUrl) return new NextResponse("Image URL missing", { status: 400 });

  const rawImage = await fetch(imageUrl);
  if (!rawImage.ok)
    return new NextResponse("Image fetch failed", { status: 400 });
  const arrayBuffer = await rawImage.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return NextResponse.json({ base64: `data:image/png;base64,${base64}` });
}
