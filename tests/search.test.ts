import { describe, expect, test } from "vitest";
import { fallbackSearch, searchParams } from "../src/index";
import type { ContentIndex, PageIndexEntry } from "../src/types";

function page(overrides: Partial<PageIndexEntry>): PageIndexEntry {
  return {
    slug: "x", fallbackSlug: "x", sourcePath: "content/x.md", title: "X", kind: "compound",
    description: "", categories: [], tags: [], bodyText: "", formula: "", nominalMass: null,
    precursor1: null, family: [], species: [], level: "", confidence: "", ...overrides,
  };
}

const index: ContentIndex = {
  generatedAt: "test",
  pages: [
    page({ slug: "a", title: "PhAcAsn3(Me)43", precursor1: 481.31329, family: ["Araneidae"], level: "S-3" }),
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
});
