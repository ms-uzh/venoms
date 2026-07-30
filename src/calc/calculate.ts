import type { CalcConfig, CalcSpider, CalcUnit } from "../types";

const H = 1.00782503223;
const D = 2.01410177812;
const NH = 15.01089903666;
const NH3 = 17.02654910112;
const H2O = 18.01056468403;
const MASS_ELECTRON = 0.0005485799;

export type CalculationInput = {
  head: string;
  polyamines: string[];
  tail: string;
  spiders: string[];
};

export type Fragment = {
  a: number;
  b: number;
  c: number;
  ta: number;
  z: number;
  y: number;
  tz: number;
};

export type CalculationResult = {
  input: CalculationInput;
  genericName: string;
  chemicalFormula: string[];
  chemicalFormulaHtml: string;
  molecularMass: number;
  precursor1: number;
  precursor2: number;
  precursorHdx1: number;
  precursorHdx2: number;
  fragments: Fragment[];
  hdx: number;
  quaternary: number;
  markdown: string;
};

export function defaultInput(config: CalcConfig): CalculationInput {
  return {
    head: "-",
    polyamines: Array(config.app.maxPolyamineSelectors || 10).fill("-"),
    tail: "-",
    spiders: ["-", "-", "-"],
  };
}

export function inputFromForm(form: FormData, config: CalcConfig): CalculationInput {
  const max = config.app.maxPolyamineSelectors || 10;
  return {
    head: String(form.get("head") ?? defaultInput(config).head),
    tail: String(form.get("tail") ?? "Gu"),
    polyamines: Array.from({ length: max }, (_, index) => String(form.get(`polyamine${index + 1}`) ?? "-")),
    spiders: [1, 2, 3].map((index) => String(form.get(`spider${index}`) ?? "-")),
  };
}

export function calculate(config: CalcConfig, input: CalculationInput): CalculationResult {
  const head = findUnit(config.heads, input.head);
  const tail = findUnit(config.tails, input.tail);
  const polyamines = selectedPolyamines(config, input.polyamines);
  const spiders = input.spiders
    .filter((species) => species && species !== "-")
    .map((species) => config.spiders.find((spider) => spider.species === species))
    .filter((spider): spider is CalcSpider => Boolean(spider));

  const quaternary = calculateQuaternary(head, tail, polyamines);
  const hdx = calculateHdx(head, tail, polyamines);
  const molecularMass = calculateMass(head, tail, polyamines);
  const chemicalFormula = calculateFormula(head, tail, polyamines, quaternary);
  const fragments = calculateFragments(head, tail, polyamines);
  const genericName = `${head.name === "-" ? "" : head.name}${polyamines.map((unit) => unit.name).join("")}${tail.name}${quaternaryName(quaternary)}`;

  const result = {
    input,
    genericName,
    chemicalFormula,
    chemicalFormulaHtml: joinChemicalFormula(chemicalFormula),
    molecularMass,
    precursor1: calculatePrecursor1(molecularMass, quaternary),
    precursor2: calculatePrecursor2(molecularMass, quaternary),
    precursorHdx1: calculatePrecursorHdx1(molecularMass, quaternary, hdx),
    precursorHdx2: calculatePrecursorHdx2(molecularMass, quaternary, hdx),
    fragments,
    hdx,
    quaternary,
    markdown: "",
  };

  result.markdown = generateMarkdown(result, spiders);
  return result;
}

export function selectedPolyamines(config: CalcConfig, names: string[]): CalcUnit[] {
  const result: CalcUnit[] = [];
  for (const name of names) {
    if (!name || name === "-") {
      break;
    }
    result.push(findUnit(config.polyamines, name));
  }
  return result;
}

export function calculateFormula(head: CalcUnit, tail: CalcUnit, polyamines: CalcUnit[], quaternary: number): string[] {
  const counts = new Map<string, number>();
  for (const formula of [head, ...polyamines, tail].flatMap((unit) => unit.formula)) {
    const match = formula.match(/^([A-Za-z]+)(\d*)$/);
    if (!match) {
      throw new Error(`Invalid formula token: ${formula}`);
    }
    counts.set(match[1], (counts.get(match[1]) || 0) + Number(match[2] || 1));
  }
  const joined = [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([element, count]) => `${element}${count}`);
  const charge = quaternaryName(quaternary);
  return charge ? [...joined, charge] : joined;
}

export function calculateMass(head: CalcUnit, tail: CalcUnit, polyamines: CalcUnit[]): number {
  const mass = [head, ...polyamines, tail].reduce((sum, unit) => sum + unit.mass, 0);
  return mass - MASS_ELECTRON * calculateQuaternary(head, tail, polyamines);
}

export function calculateHdx(head: CalcUnit, tail: CalcUnit, polyamines: CalcUnit[]): number {
  return [head, ...polyamines, tail].reduce((sum, unit) => sum + unit.hdx, 0);
}

export function calculateQuaternary(head: CalcUnit, tail: CalcUnit, polyamines: CalcUnit[]): number {
  return [head, ...polyamines, tail].reduce((sum, unit) => sum + unit.quaternary, 0);
}

export function calculatePrecursor1(mass: number, quaternary: number): number {
  if (quaternary === 0) {
    return mass - MASS_ELECTRON + H;
  }
  if (quaternary === 1) {
    return mass;
  }
  return -1;
}

export function calculatePrecursor2(mass: number, quaternary: number): number {
  if (quaternary === 0) {
    return (mass - 2 * MASS_ELECTRON + 2 * H) * 0.5;
  }
  if (quaternary === 1) {
    return (mass - MASS_ELECTRON + H) * 0.5;
  }
  if (quaternary === 2) {
    return mass * 0.5;
  }
  return -1;
}

export function calculatePrecursorHdx1(mass: number, quaternary: number, hdx: number): number {
  if (quaternary === 0) {
    return mass - MASS_ELECTRON - hdx * H + (hdx + 1) * D;
  }
  if (quaternary === 1) {
    return mass - hdx * H + hdx * D;
  }
  return -1;
}

export function calculatePrecursorHdx2(mass: number, quaternary: number, hdx: number): number {
  if (quaternary === 0) {
    return (mass - 2 * MASS_ELECTRON - hdx * H + (hdx + 2) * D) * 0.5;
  }
  if (quaternary === 1) {
    return (mass - MASS_ELECTRON - hdx * H + (hdx + 1) * D) * 0.5;
  }
  if (quaternary === 2) {
    return (mass - hdx * H + hdx * D) * 0.5;
  }
  return -1;
}

export function calculateFragments(head: CalcUnit, tail: CalcUnit, polyamines: CalcUnit[]): Fragment[] {
  const fragments = polyamines.map(() => ({ a: 0, b: 0, c: 0, ta: 0, z: 0, y: 0, tz: 0 }));
  calculateFromHead(fragments, head, tail, polyamines);
  calculateFromTail(fragments, tail, polyamines);
  return fragments;
}

export function joinChemicalFormula(parts: string[]): string {
  return parts.map((part) => {
    if (/^\d?\+$/.test(part)) {
      return superscript(part);
    }
    return part.replace(/[0-9]+/g, (digits) => digits === "1" ? "" : subscript(digits));
  }).join("");
}

export function quaternaryName(quaternary: number): string {
  if (quaternary === 0) {
    return "";
  }
  return quaternary === 1 ? "+" : `${quaternary}+`;
}

function calculateFromHead(fragments: Fragment[], head: CalcUnit, tail: CalcUnit, polyamines: CalcUnit[]): void {
  const previous = { a: head.mass, b: head.mass, c: head.mass, ta: head.mass };

  for (let index = 0; index < polyamines.length; index++) {
    const polyamine = polyamines[index];
    const isFirst = index === 0;
    const isLast = index === polyamines.length - 1;
    const following = isLast ? emptyUnit() : polyamines[index + 1];

    previous.a = previous.a + polyamine.mass - polyamine.quaternary * H - (isFirst ? MASS_ELECTRON : 0);
    previous.b = previous.b + polyamine.mass - polyamine.quaternary * H - (isFirst ? H2O + MASS_ELECTRON : 0);
    previous.c = previous.c + polyamine.mass - polyamine.quaternary * H - (isFirst ? NH3 + MASS_ELECTRON : 0);
    previous.ta = calculateTa(previous.ta, polyamine, following, tail, isFirst, isLast);

    fragments[index] = {
      ...fragments[index],
      a: previous.a,
      b: previous.b,
      c: previous.c,
      ta: previous.ta,
    };
  }
}

function calculateFromTail(fragments: Fragment[], tail: CalcUnit, polyamines: CalcUnit[]): void {
  const previous = { z: tail.mass, y: tail.mass, tz: tail.mass };
  let insertIndex = 0;

  for (let index = polyamines.length - 1; index >= 0; index--) {
    const polyamine = polyamines[index];
    const previousPolyamine = index === polyamines.length - 1 ? emptyUnit() : polyamines[index + 1];
    const isFirst = index === polyamines.length - 1;

    previous.z = isFirst
      ? previous.z + polyamine.mass - polyamine.sub.mass - tail.quaternary * H - NH - MASS_ELECTRON
      : previous.z + polyamine.mass + previousPolyamine.sub.mass - polyamine.sub.mass - previousPolyamine.quaternary * H;
    previous.y = isFirst
      ? previous.y + polyamine.mass - polyamine.sub.mass - tail.quaternary * H - NH - NH3 - MASS_ELECTRON
      : previous.y + polyamine.mass + previousPolyamine.sub.mass - polyamine.sub.mass - tail.quaternary * H;
    previous.tz = isFirst
      ? previous.tz + polyamine.mass - polyamine.quaternary * H - NH + NH3 - MASS_ELECTRON
      : previous.tz + polyamine.mass - polyamine.quaternary * H;

    fragments[insertIndex] = {
      ...fragments[insertIndex],
      z: previous.z,
      y: previous.y,
      tz: previous.tz,
    };
    insertIndex++;
  }
}

function calculateTa(previousMass: number, current: CalcUnit, following: CalcUnit, tail: CalcUnit, isFirst: boolean, isLast: boolean): number {
  if (isFirst && isLast) {
    return calculateLastTa(previousMass, current, tail);
  }
  if (isFirst) {
    return previousMass + current.mass + following.sub.mass - following.quaternary * H + NH3 - MASS_ELECTRON;
  }
  if (isLast) {
    return calculateLastTa(previousMass, current, tail);
  }
  return previousMass + current.mass - current.sub.mass + following.sub.mass - following.quaternary * H;
}

function calculateLastTa(previousMass: number, current: CalcUnit, tail: CalcUnit): number {
  return previousMass + current.mass - current.sub.mass + tail.sub.mass - tail.quaternary * H;
}

function generateMarkdown(result: CalculationResult, spiders: CalcSpider[]): string {
  const fragments = result.fragments.map((fragment, index) =>
    `| ${index + 1} | ${round(fragment.a)} | ${round(fragment.b)} | ${round(fragment.c)} | ${round(fragment.ta)} | ${round(fragment.z)} | ${round(fragment.y)} | ${round(fragment.tz)} |`
  ).join("\n");
  const spiderRows = spiders.map((spider) => `| ${spider.species} | ${spider.family} | |`).join("\n");

  return `+++
title = "${result.genericName}"
categories = []
tags = []
+++

![](/img/2.png)

## General Description

| Name | Value |
|------|-------|
| Molecular formula | ${result.chemicalFormulaHtml} |
| Precursor 1 [M+H]⁺ | ${round(result.precursor1)} |
| Precursor 2 [M+2H]²⁺ | ${round(result.precursor2)} |
| HDX | ${result.hdx} |
| Precursor HDX [M(D${result.hdx})+D]⁺ | ${round(result.precursorHdx1)} |
| Precursor HDX 2 [M(D${result.hdx})+2D]²⁺ | ${round(result.precursorHdx2)} |

## Calculated MS/MS fragments

| # | a | b | c | ta | z | y | tz |
|---|---|---|---|----|---|---|----|
${fragments}

## Spider species

| Spider species | Family | Discovered |
|----------------|--------|------------|
${spiderRows}`;
}

function findUnit(units: CalcUnit[], name: string): CalcUnit {
  return units.find((unit) => unit.name === name) || units[0] || emptyUnit();
}

function emptyUnit(): CalcUnit {
  return { name: "-", formula: [], mass: 0, hdx: 0, quaternary: 0, sub: { name: "", mass: 0 } };
}

function round(value: number): string {
  return value === -1 ? "-" : value.toFixed(5);
}

function subscript(value: string): string {
  return value.replace(/[0-9]/g, (digit) => "₀₁₂₃₄₅₆₇₈₉"[Number(digit)]);
}

function superscript(value: string): string {
  return value.replace(/[0-9+]/g, (char) => char === "+" ? "⁺" : "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(char)]);
}
