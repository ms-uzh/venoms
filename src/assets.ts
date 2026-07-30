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

/**
 * Fetch a JSON asset once per isolate.
 *
 * Static assets are immutable for the lifetime of a deployment and a new deploy
 * gets fresh isolates, so the parsed value can be held indefinitely. The promise
 * (not the resolved value) is cached so concurrent requests share one fetch; a
 * rejection clears the slot so a transient failure is not cached forever.
 */
function memoizeJsonAsset<T>(pathname: string): (assets: Fetcher, request: Request) => Promise<T> {
  let pending: Promise<T> | null = null;
  return (assets, request) => {
    if (!pending) {
      pending = fetchJsonAsset<T>(assets, request, pathname).catch((error) => {
        pending = null;
        throw error;
      });
    }
    return pending;
  };
}

export const loadContentIndex = memoizeJsonAsset<ContentIndex>("/data/content-index.json");
export const loadRedirectIndex = memoizeJsonAsset<RedirectIndex>("/data/redirects.json");
export const loadCalcConfig = memoizeJsonAsset<CalcConfig>("/data/calc/config.json");
