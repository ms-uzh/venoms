/**
 * A page as shipped in the runtime index (public/data/content-index.json).
 * Build-only fields (bodyText, fallbackSlug) are stripped from that payload and
 * live in .generated/content-index.json instead — see scripts/build-content-index.mjs.
 */
export type PageIndexEntry = {
  slug: string;
  sourcePath: string;
  title: string;
  kind: "compound" | "guide";
  description: string;
  categories: string[];
  tags: string[];
  formula: string;
  nominalMass: number | null;
  precursor1: number | null;
  family: string[];
  species: string[];
  /** Row-level [species, family] pairs from the compound's spider-species table. */
  speciesFamily?: Array<[string, string]>;
  level: string;
  confidence: string;
};

export type ContentIndex = {
  generatedAt: string;
  pages: PageIndexEntry[];
};

export type RedirectIndex = {
  generatedAt: string;
  redirects: Record<string, string>;
};

export type CalcSubstitution = {
  name: string;
  mass: number;
};

export type CalcUnit = {
  name: string;
  formula: string[];
  mass: number;
  hdx: number;
  quaternary: number;
  sub: CalcSubstitution;
};

export type CalcSpider = {
  species: string;
  family: string;
};

export type CalcConfig = {
  heads: CalcUnit[];
  polyamines: CalcUnit[];
  tails: CalcUnit[];
  spiders: CalcSpider[];
  app: {
    maxPolyamineSelectors: number;
  };
};
