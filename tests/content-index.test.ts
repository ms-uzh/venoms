import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import type { ContentIndex, RedirectIndex } from "../src/types";

const root = new URL("..", import.meta.url);

describe("generated content index", () => {
  test("indexes Markdown pages with stable slugs and extracted facets", () => {
    const index = JSON.parse(readFileSync(new URL("../public/data/content-index.json", import.meta.url), "utf8")) as ContentIndex;
    expect(index.pages.length).toBeGreaterThan(500);

    const slugs = new Set(index.pages.map((page) => page.slug));
    expect(slugs.size).toBe(index.pages.length);

    const prop3334Gu = index.pages.find((page) => page.title === "Prop3334Gu");
    expect(prop3334Gu).toBeTruthy();
    expect(prop3334Gu?.slug).toBe("alkaloids/prop/prop3334gu");
    expect(prop3334Gu?.kind).toBe("compound");
    expect(prop3334Gu?.formula).toBeTruthy();
    expect(existsSync(join(root.pathname, prop3334Gu?.sourcePath || ""))).toBe(true);

    const serotonin = index.pages.find((page) => page.title === "Serotonin");
    expect(serotonin?.slug).toBe("small-compounds/biogenic-amines/serotonin");
    expect(serotonin?.family.length).toBeGreaterThan(0);
    expect(serotonin?.species.length).toBeGreaterThan(0);
  });

  test("generates redirects for fallback and legacy paths", () => {
    const redirects = JSON.parse(readFileSync(new URL("../public/data/redirects.json", import.meta.url), "utf8")) as RedirectIndex;
    expect(redirects.redirects["/calc/"]).toBe("/calc");
    expect(Object.keys(redirects.redirects).length).toBeGreaterThan(0);
  });
});
