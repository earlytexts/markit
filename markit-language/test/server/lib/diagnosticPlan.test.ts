import { describe, expect, it } from "vitest";
import type { MarkitError } from "@earlytexts/markit";
import planDiagnostics from "../../../src/server/lib/diagnosticPlan.ts";

const error = (over: Partial<MarkitError> = {}): MarkitError => ({
  message: "boom",
  line: 3,
  column: 5,
  endLine: 3,
  endColumn: 9,
  severity: "error",
  ...over,
});

describe("planDiagnostics", () => {
  it("converts Markit's 1-based positions to 0-based ranges", () => {
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
      error({ message: "second", line: 10 }),
    ]);
    expect(plans.map((plan) => plan.message)).toEqual(["first", "second"]);
    expect(plans[1]?.startLine).toBe(9);
  });
});
