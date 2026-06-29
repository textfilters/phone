import { describe, expect, it } from "vitest";

import {
  checkPhoneRanges,
  createPhoneScanner,
  scanPhoneRangeMatches,
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

  it("checks phone candidates without collecting every range", () => {
    const scanner = createPhoneScanner();
    const text = "call +1 202 555 0187 or +1 303 555 0199";
    const input = { text, codePoints: Array.from(text) };

    expect(scanner.check(input)).toBe(true);
    expect(checkPhoneRanges(input)).toBe(true);
    expect(scanner.check({ text: "plain words only", codePoints: [] })).toBe(
      false,
    );
  });

  it("streams ranges into a sink and supports early stop", () => {
    const scanner = createPhoneScanner();
    const text = "call +1 202 555 0187 or +1 303 555 0199";
    const seen: Array<readonly [number, number]> = [];

    const completed = scanner.scan(
      { text, codePoints: Array.from(text) },
      (match) => {
        seen.push(match.range);
        return false;
      },
    );

    expect(completed).toBe(false);
    expect(seen).toEqual([[5, 20]]);
  });

  it("uses shared-style hints to skip low-digit text", () => {
    expect(
      checkPhoneRanges({
        text: "code 12345",
        codePoints: Array.from("code 12345"),
        hints: {
          textLength: "code 12345".length,
          digitCount: 5,
          hasPlus: false,
          hasPunctuation: false,
        },
      }),
    ).toBe(false);
  });

  it("does not let non-folded digit hints hide foldable phone digits", () => {
    const scanner = createPhoneScanner();
    const text = "call ⁰¹²³⁴⁵⁶⁷⁸⁹";
    const input = {
      text,
      codePoints: Array.from(text),
      hints: {
        textLength: text.length,
        digitCount: 0,
        hasPlus: false,
        hasPunctuation: false,
      },
    };
    const seen: Array<readonly [number, number]> = [];

    expect(scanner.check(input)).toBe(true);
    expect(
      scanner.scan(input, (match) => {
        seen.push(match.range);
        return false;
      }),
    ).toBe(false);
    expect(seen).toEqual([[5, 15]]);
  });

  it("streams separated, plus-prefixed, and punctuated ranges", () => {
    const text = "call +1 (202) 555-0187, then 303.555.0199";
    const seen: Array<readonly [number, number]> = [];

    expect(
      scanPhoneRangeMatches({ text, codePoints: Array.from(text) }, (match) => {
        seen.push(match.range);
      }),
    ).toBe(true);
    expect(seen).toEqual([
      [5, 22],
      [29, 41],
    ]);
  });

  it("streams merged adjacent ranges", () => {
    const text = "79991234567(79991234567)";
    const seen: Array<readonly [number, number]> = [];

    expect(
      scanPhoneRangeMatches({ text, codePoints: Array.from(text) }, (match) => {
        seen.push(match.range);
        return false;
      }),
    ).toBe(false);
    expect(scanPhoneRanges(text)).toEqual([[0, 24]]);
    expect(seen).toEqual([[0, 24]]);
  });

  it("keeps false-positive guards behind the prefilter", () => {
    expect(scanPhoneRanges("server 10.100.100.100")).toEqual([]);
    expect(scanPhoneRanges("balance 1,234,567,890")).toEqual([]);
  });
});
