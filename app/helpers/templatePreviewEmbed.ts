/** Same-origin proxy so deployed sites render in iframes (many block direct embedding). */
export function embedPreviewSrc(siteUrl: string): string {
  return `/api/proxy-html?url=${encodeURIComponent(siteUrl)}&embed=1`;
}
