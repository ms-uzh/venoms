import { describe, expect, test } from "vitest";
import { fact, parseCompoundRecord } from "../src/content";

const SAMPLE = `![](/img/2-4-OH2-PhAcAsn3(Me)43.png)

## General Description

| Name              | Value                |
|-------------------|----------------------|
| Level             | S-3 / C-1            |
| Synonym           | LF 480A              |
| Molecular formula | C₂₃H₄₀N₆O₅           |
| SMILES            | \`O=C(NC)CC1=CC=C(O)C=C1O\` |
| Precursor 1 [M+H]⁺ | 481.31329           |
| HDX               | 9                    |
| Rt                | 3.01                 |
| Rt HDX            | 2.33                 |

## Calculated MS/MS fragments

| # | a         | z        |
|---|-----------|----------|
| 1 | 265.08190 | 58.06513 |

## Spider species

| Spider species       | Family    | Discovered |
|----------------------|-----------|------------|
| Larinioides cornutus | Araneidae | 2020       |
`;

describe("parseCompoundRecord", () => {
  const record = parseCompoundRecord(SAMPLE);

  test("extracts the structure image even when the filename contains parentheses", () => {
    expect(record.imageSrc).toBe("/img/2-4-OH2-PhAcAsn3(Me)43.png");
  });

  test("parses the General Description table into facts and strips backticks", () => {
    expect(fact(record.facts, "synonym")).toBe("LF 480A");
    expect(fact(record.facts, "precursor 1")).toBe("481.31329");
    expect(fact(record.facts, "hdx")).toBe("9");
    expect(fact(record.facts, "smiles")).toBe("O=C(NC)CC1=CC=C(O)C=C1O");
  });

  test("keeps the fragment section separate and excludes General Description from the rest", () => {
    expect(record.fragmentSection).toContain("265.08190");
    expect(record.restMarkdown).toContain("## Spider species");
    expect(record.restMarkdown).not.toContain("General Description");
    expect(record.restMarkdown).not.toContain("Calculated MS/MS fragments");
  });
});
