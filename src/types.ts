export type PageIndexEntry = {
  slug: string;
  fallbackSlug: string;
  sourcePath: string;
  title: string;
  kind: "compound" | "guide";
  description: string;
  categories: string[];
  tags: string[];
  bodyText: string;
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
