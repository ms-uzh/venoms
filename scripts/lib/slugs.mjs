const subscriptDigits = new Map([
  ["₀", ""],
  ["₁", ""],
  ["₂", ""],
  ["₃", ""],
  ["₄", ""],
  ["₅", ""],
  ["₆", ""],
  ["₇", ""],
  ["₈", ""],
  ["₉", ""],
]);

export function slugifySegment(segment) {
  return segment
    .trim()
    .split("")
    .map((char) => subscriptDigits.get(char) ?? char)
    .join("")
    .toLowerCase()
    .replace(/,/g, "")
    .replace(/[()[\]{}]/g, "")
    .replace(/\+/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9ß_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function fallbackSlugFromSourcePath(sourcePath) {
  const parts = sourcePath
    .replace(/^content\//, "")
    .replace(/\.md$/, "")
    .split("/")
    .filter((part) => part !== "_index" && !part.startsWith("_"));
  return parts.map(slugifySegment).filter(Boolean).join("/");
}

export function stripUriToSlug(uri) {
  try {
    const url = new URL(uri);
    return url.pathname.replace(/^\/+|\/+$/g, "");
  } catch {
    return String(uri).replace(/^https?:\/\/[^/]+\//, "").replace(/^\/+|\/+$/g, "");
  }
}
