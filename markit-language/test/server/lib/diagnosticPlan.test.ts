import { describe, expect, it } from "vitest";
import type { MarkitError } from "@earlytexts/markit";
import planDiagnostics from "../../../src/server/lib/diagnosticPlan.ts";

const error = (over: Partial<MarkitError> = {}): MarkitError => ({
  message: "boom",
  severity: "error",
  source: {
    start: { line: 2, column: 4 },
    end: { line: 2, column: 8 },
  },
  ...over,
});

describe("planDiagnostics", () => {
  it("flattens Markit's source ranges into position fields", () => {
    expect(planDiagnostics([error()])).toEqual([
      {
        startLine: 2,
        startColumn: 4,
        endLine: 2,
        endColumn: 8,
        message: "boom",
        severity: "error",
      },
    ]);
  });

  it("carries the severity through", () => {
    const [warning] = planDiagnostics([error({ severity: "warning" })]);
    expect(warning?.severity).toBe("warning");
  });

  it("plans every error in the list", () => {
    const plans = planDiagnostics([
      error({ message: "first" }),
      error({
        message: "second",
        source: {
          start: { line: 9, column: 0 },
          end: { line: 9, column: 4 },
        },
      }),
    ]);
    expect(plans.map((plan) => plan.message)).toEqual(["first", "second"]);
    expect(plans[1]?.startLine).toBe(9);
  });
});
