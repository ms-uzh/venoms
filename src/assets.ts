import type { CalcConfig, ContentIndex, RedirectIndex } from "./types";

export async function fetchTextAsset(assets: Fetcher, request: Request, pathname: string): Promise<string | null> {
  const url = new URL(request.url);
  url.pathname = pathname.startsWith("/") ? pathname : `/${pathname}`;
  url.search = "";
  const response = await assets.fetch(new Request(url));
  if (!response.ok) {
    return null;
  }
  return response.text();
}

export async function fetchJsonAsset<T>(assets: Fetcher, request: Request, pathname: string): Promise<T> {
  const text = await fetchTextAsset(assets, request, pathname);
  if (!text) {
    throw new Error(`Missing asset ${pathname}`);
  }
  return JSON.parse(text) as T;
}

export function loadContentIndex(assets: Fetcher, request: Request): Promise<ContentIndex> {
  return fetchJsonAsset<ContentIndex>(assets, request, "/data/content-index.json");
}

export function loadRedirectIndex(assets: Fetcher, request: Request): Promise<RedirectIndex> {
  return fetchJsonAsset<RedirectIndex>(assets, request, "/data/redirects.json");
}

export function loadCalcConfig(assets: Fetcher, request: Request): Promise<CalcConfig> {
  return fetchJsonAsset<CalcConfig>(assets, request, "/data/calc/config.json");
}
