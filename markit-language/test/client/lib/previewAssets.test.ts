import { describe, expect, it } from "vitest";
import injectPreviewAssets from "../../../src/client/lib/previewAssets.ts";

describe("injectPreviewAssets", () => {
  it("links the stylesheet and script before </head>", () => {
    const html = injectPreviewAssets(
      "<html><head></head><body></body></html>",
      "css-uri",
      "js-uri",
    );
    expect(html).toContain('<link rel="stylesheet" href="css-uri">');
    expect(html).toContain('<script src="js-uri"></script>');
    expect(html.indexOf("<link")).toBeLessThan(html.indexOf("</head>"));
  });

  it("leaves the rest of the document untouched", () => {
    const html = injectPreviewAssets(
      "<html><head></head><body>content</body></html>",
      "css-uri",
      "js-uri",
    );
    expect(html).toContain("<body>content</body>");
  });
});
