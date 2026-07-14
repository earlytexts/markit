import { describe, expect, it } from "vitest";
import {
  guardMarkitDocument,
  guardSavedDocument,
} from "../../../src/client/lib/documentGuard.ts";

describe("guardMarkitDocument", () => {
  it("rejects a document whose languageId isn't markit", () => {
    expect(
      guardMarkitDocument({ languageId: "plaintext", isUntitled: false }),
    ).toBe("Active file is not a Markit document");
  });

  it("passes a markit document", () => {
    expect(
      guardMarkitDocument({ languageId: "markit", isUntitled: false }),
    ).toBeUndefined();
  });
});

describe("guardSavedDocument", () => {
  it("rejects an untitled document", () => {
    expect(guardSavedDocument({ languageId: "markit", isUntitled: true })).toBe(
      "Please save the file before compiling",
    );
  });

  it("passes a saved document", () => {
    expect(
      guardSavedDocument({ languageId: "markit", isUntitled: false }),
    ).toBeUndefined();
  });
});
