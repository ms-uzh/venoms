import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  calculate,
  calculateFormula,
  calculateHdx,
  calculateMass,
  calculatePrecursor1,
  calculatePrecursor2,
  calculatePrecursorHdx1,
  calculatePrecursorHdx2,
  calculateQuaternary,
  joinChemicalFormula,
  quaternaryName,
} from "../src/calc/calculate";
import type { CalcConfig, CalcUnit } from "../src/types";

const examples = {
  one: {
    head: unit("4-OH-IndAc", ["C10", "H8", "N", "O2"], 174.0555, 2),
    tail: unit("", ["H2", "N"], 16.01872, 2),
    polyamines: [
      unit("3", ["C3", "H7", "N"], 57.05785, 1),
      unit("(OH)3", ["C3", "H7", "N", "O"], 73.05276, 1, 0, "O", 15.99491),
      unit("4", ["C4", "H9", "N"], 71.0735, 1),
    ],
  },
  two: {
    head: unit("4-OH-IndAc", ["C10", "H8", "N", "O2"], 174.0555, 2),
    tail: unit("(NMe₃)", ["C3", "H9", "N"], 59.0735, 0, 1, "C3H7", 43.05478),
    polyamines: [
      unit("3", ["C3", "H7", "N"], 57.05785, 1),
      unit("(OH)3", ["C3", "H7", "N", "O"], 73.05276, 1, 0, "O", 15.99491),
      unit("5", ["C5", "H11", "N"], 85.08915, 1),
    ],
  },
  three: {
    head: unit("IndLac", ["C11", "H10", "N1", "O2"], 188.07115, 2),
    tail: unit("", ["H2", "N"], 16.01872, 2),
    polyamines: [
      unit("4", ["C4", "H9", "N"], 71.0735, 1),
      unit("(Me₂)3", ["C5", "H12", "N"], 86.09697, 0, 1, "C2H5", 29.03913),
      unit("(Me₂)3", ["C5", "H12", "N"], 86.09697, 0, 1, "C2H5", 29.03913),
    ],
  },
};

describe("calculator core parity", () => {
  test("calculates old Go example names and formulae", () => {
    expect(calculateWithExamples(["3", "(OH)3", "4"], "").genericName).toBe("4-OH-IndAc3(OH)34");
    expect(calculateWithExamples(["3", "(OH)3", "5"], "(NMe₃)").genericName).toBe("4-OH-IndAc3(OH)35(NMe₃)+");

    const formulaOne = calculateFormula(examples.one.head, examples.one.tail, examples.one.polyamines, 0);
    const formulaTwo = calculateFormula(examples.two.head, examples.two.tail, examples.two.polyamines, 1);
    const formulaThree = calculateFormula(examples.three.head, examples.three.tail, examples.three.polyamines, 2);

    expect(formulaOne).toEqual(["C20", "H33", "N5", "O3"]);
    expect(formulaTwo).toEqual(["C24", "H42", "N5", "O3", "+"]);
    expect(formulaThree).toEqual(["C25", "H45", "N5", "O2", "2+"]);
    expect(joinChemicalFormula(formulaThree)).toBe("C₂₅H₄₅N₅O₂²⁺");
  });

  test("calculates old Go example masses, HDX, quaternary state, and precursors", () => {
    assertClose(calculateMass(examples.one.head, examples.one.tail, examples.one.polyamines), 391.25832999999994);
    assertClose(calculateMass(examples.two.head, examples.two.tail, examples.two.polyamines), 448.32821142010005);
    assertClose(calculateMass(examples.three.head, examples.three.tail, examples.three.polyamines), 447.35621284019993);

    expect(calculateHdx(examples.one.head, examples.one.tail, examples.one.polyamines)).toBe(7);
    expect(calculateHdx(examples.two.head, examples.two.tail, examples.two.polyamines)).toBe(5);
    expect(calculateHdx(examples.three.head, examples.three.tail, examples.three.polyamines)).toBe(5);
    expect(calculateQuaternary(examples.three.head, examples.three.tail, examples.three.polyamines)).toBe(2);
    expect(quaternaryName(2)).toBe("2+");

    const massOne = calculateMass(examples.one.head, examples.one.tail, examples.one.polyamines);
    const massTwo = calculateMass(examples.two.head, examples.two.tail, examples.two.polyamines);
    const massThree = calculateMass(examples.three.head, examples.three.tail, examples.three.polyamines);

    assertClose(calculatePrecursor1(massOne, 0), 392.26560645232996);
    assertClose(calculatePrecursor2(massOne, 0), 196.63644145232996);
    assertClose(calculatePrecursorHdx1(massOne, 0, 7), 400.31582041944995);
    assertClose(calculatePrecursorHdx2(massOne, 0, 7), 201.16468680883497);

    assertClose(calculatePrecursor1(massTwo, 1), 448.32821142010005);
    assertClose(calculatePrecursor2(massTwo, 1), 224.66774393621503);
    assertClose(calculatePrecursorHdx1(massTwo, 1, 5), 453.35959514955005);
    assertClose(calculatePrecursorHdx2(massTwo, 1, 5), 227.68657417388502);

    expect(calculatePrecursor1(massThree, 2)).toBe(-1);
    assertClose(calculatePrecursor2(massThree, 2), 223.67810642009997);
    expect(calculatePrecursorHdx1(massThree, 2, 5)).toBe(-1);
    assertClose(calculatePrecursorHdx2(massThree, 2, 5), 226.19379828482496);
  });
});

describe("generated calculator data", () => {
  test("calculates Prop3334Gu from imported YAML data", () => {
    const config = JSON.parse(readFileSync(new URL("../data/calc/config.json", import.meta.url), "utf8")) as CalcConfig;
    const result = calculate(config, {
      head: "Prop",
      polyamines: ["3", "3", "3", "4"],
      tail: "Gu",
      spiders: [],
    });

    expect(result.genericName).toBe("Prop3334Gu");
    expect(result.chemicalFormulaHtml).toBe("C₁₇H₃₉N₇O");
    assertClose(result.molecularMass, 357.32160890755);
    assertClose(result.precursor1, 358.32888535988);
    assertClose(result.precursor2, 179.668080906105);
    assertClose(result.precursorHdx1, 367.38537607289);
    assertClose(result.precursorHdx2, 184.699464635555);
    expect(result.hdx).toBe(8);
    expect(result.quaternary).toBe(0);
    expect(result.fragments).toHaveLength(4);
    expect(result.markdown).toContain('title = "Prop3334Gu"');
    expect(result.markdown).toContain("| Molecular formula | C₁₇H₃₉N₇O |");
  });
});

function calculateWithExamples(polyamines: string[], tail: string) {
  return calculate(exampleConfig(), {
    head: "4-OH-IndAc",
    polyamines,
    tail,
    spiders: [],
  });
}

function exampleConfig(): CalcConfig {
  return {
    heads: [examples.one.head, examples.three.head],
    polyamines: [
      unit("3", ["C3", "H7", "N"], 57.05785, 1),
      unit("(OH)3", ["C3", "H7", "N", "O"], 73.05276, 1, 0, "O", 15.99491),
      unit("4", ["C4", "H9", "N"], 71.0735, 1),
      unit("5", ["C5", "H11", "N"], 85.08915, 1),
    ],
    tails: [examples.one.tail, examples.two.tail],
    spiders: [],
    app: { maxPolyamineSelectors: 10 },
  };
}

function unit(name: string, formula: string[], mass: number, hdx: number, quaternary = 0, subName = "", subMass = 0): CalcUnit {
  return {
    name,
    formula,
    mass,
    hdx,
    quaternary,
    sub: {
      name: subName,
      mass: subMass,
    },
  };
}

function assertClose(actual: number, expected: number) {
  expect(actual).toBeCloseTo(expected, 10);
}
