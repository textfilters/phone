import { describe, expect, it } from "vitest";

import {
  createPhoneScanner,
  scanPhoneRanges,
  PHONE_FILTER_NAME,
} from "../src/index.js";

describe("@textfilters/phone scanner", () => {
  it("exposes scanner ranges compatible with code point masking", () => {
    const scanner = createPhoneScanner();
    expect(
      scanner.scan({
        text: "call +1 202 555 0187 now",
        codePoints: Array.from("call +1 202 555 0187 now"),
      }),
    ).toEqual({
      ranges: [[5, 20]],
    });
    expect(scanner.name).toBe(PHONE_FILTER_NAME);
  });

  it("keeps accepted phone coverage through the scanner path", () => {
    expect(scanPhoneRanges("+7 (999) 123-45-67")).toEqual([[0, 18]]);
    expect(scanPhoneRanges("call １２３４５６７８９０ now")).toEqual([[5, 15]]);
    expect(scanPhoneRanges("call ٧٩٩٩١٢٣٤٥٦٧ now")).toEqual([[5, 16]]);
  });

  it("returns no ranges for clearly clean text", () => {
    const scanner = createPhoneScanner();
    expect(
      scanner.scan({
        text: "plain words only",
        codePoints: Array.from("plain words only"),
      }),
    ).toEqual({ ranges: [] });
  });

  it("keeps false-positive guards behind the prefilter", () => {
    expect(scanPhoneRanges("server 10.100.100.100")).toEqual([]);
    expect(scanPhoneRanges("balance 1,234,567,890")).toEqual([]);
  });
});
