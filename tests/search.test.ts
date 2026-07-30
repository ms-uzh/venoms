import { describe, expect, test } from "vitest";
import { fallbackSearch, searchParams } from "../src/index";
import { buildNavModel, searchPage } from "../src/html";
import { normalizeTermKey } from "../src/search";
import type { ContentIndex, PageIndexEntry } from "../src/types";

function page(overrides: Partial<PageIndexEntry>): PageIndexEntry {
  return {
    slug: "x", sourcePath: "content/x.md", title: "X", kind: "compound",
    description: "", categories: [], tags: [], formula: "", nominalMass: null,
    precursor1: null, family: [], species: [], level: "", confidence: "", ...overrides,
  };
}

const index: ContentIndex = {
  generatedAt: "test",
  pages: [
    page({ slug: "a", title: "PhAcAsn3(Me)43", precursor1: 481.31329, family: ["Araneidae"], level: "S-3", categories: ["2-4-OH2-PhAcAsn3(Me)43"] }),
    page({ slug: "b", title: "PhAcAsn353", precursor1: 481.31329, family: ["Araneidae"], level: "S-3" }),
    page({ slug: "c", title: "Arginine", precursor1: 175.11895, family: ["Lycosidae"], level: "S-1" }),
    page({ slug: "d", title: "Guanosine", precursor1: 284.09879, family: ["Agelenidae"], level: "S-2" }),
  ],
};

describe("searchParams", () => {
  test("parses repeated facet params and mass window", () => {
    const params = searchParams("https://x/search?family=Araneidae&family=Lycosidae&mz=481.31&tol=0.02&sort=mass");
    expect(params.family).toEqual(["Araneidae", "Lycosidae"]);
    expect(params.mz).toBe(481.31);
    expect(params.tol).toBe(0.02);
    expect(params.sort).toBe("mass");
  });

  test("defaults tolerance and treats blank mz as null", () => {
    const params = searchParams("https://x/search?mz=");
    expect(params.mz).toBeNull();
    expect(params.tol).toBe(0.02);
  });
});

describe("fallbackSearch", () => {
  test("matches a precursor mass within tolerance", () => {
    const results = fallbackSearch(index, searchParams("https://x/search?mz=481.31&tol=0.02"));
    expect(results.map((r) => r.slug).sort()).toEqual(["a", "b"]);
  });

  test("ANDs across facet types and ORs within a type", () => {
    const results = fallbackSearch(index, searchParams("https://x/search?family=Araneidae&family=Lycosidae&level=S-1"));
    expect(results.map((r) => r.slug)).toEqual(["c"]);
  });

  test("sorts by mass ascending", () => {
    const results = fallbackSearch(index, searchParams("https://x/search?sort=mass"));
    expect(results.map((r) => r.slug)).toEqual(["c", "d", "a", "b"]);
  });

  test("normalizes legacy taxonomy notation", () => {
    expect(normalizeTermKey("2,4-(OH)₂-PhAcAsn3(Me)43")).toBe(normalizeTermKey("2-4-OH2-PhAcAsn3(Me)43"));
    const results = fallbackSearch(index, searchParams("https://x/search?term=2%2C4-%28OH%29%E2%82%82-PhAcAsn3%28Me%2943"));
    expect(results.map((result) => result.slug)).toEqual(["a"]);
  });

  // The runtime index ships no body prose, so free text matches metadata only.
  test("matches free text against title, description, and taxonomy", () => {
    const metadataIndex: ContentIndex = {
      generatedAt: "test",
      pages: [
        page({ slug: "t", title: "Serotonin" }),
        page({ slug: "d", title: "Other", description: "A hydroxytryptamine derivative" }),
        page({ slug: "f", title: "Other", family: ["Agelenidae"] }),
      ],
    };
    const bySlug = (query: string) =>
      fallbackSearch(metadataIndex, searchParams(`https://x/search?q=${encodeURIComponent(query)}`)).map((r) => r.slug);

    expect(bySlug("serotonin")).toEqual(["t"]);
    expect(bySlug("hydroxytryptamine")).toEqual(["d"]);
    expect(bySlug("Agelenidae")).toEqual(["f"]);
  });
});

describe("buildNavModel", () => {
  test("reuses the model for the same pages array", () => {
    expect(buildNavModel(index.pages)).toBe(buildNavModel(index.pages));
  });

  test("recomputes for a different array", () => {
    expect(buildNavModel([...index.pages])).not.toBe(buildNavModel(index.pages));
  });
});

describe("searchPage", () => {
  test("preserves a legacy term in sort links and forms", () => {
    const params = searchParams("https://x/search?term=3");
    const html = searchPage(params, [], []);
    expect(html).toContain("/search?term=3&amp;sort=mass");
    expect(html).toContain('name="term" value="3"');
    expect(html).toContain('href="/search"');
  });
});
