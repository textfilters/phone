import { describe, expect, it } from "vitest";

import {
  checkPhoneRanges,
  createPhoneFilter,
  createPhoneScanner,
  scanPhoneRangeMatches,
  scanPhoneRanges,
  PHONE_FILTER_NAME,
  type PhoneRangeScanner,
  type PhoneRangeScanResult,
  type PhoneScanHints,
} from "../src/index.js";

const mask = (value: string, maskChar = "*"): string =>
  maskChar.repeat(Array.from(value).length);

describe("@textfilters/phone scanner", () => {
  it("keeps scanner contracts compatible with shared range shapes", () => {
    const scanner: PhoneRangeScanner = createPhoneScanner();
    const hints: PhoneScanHints = {
      textLength: "call +1 202 555 0187 now".length,
      digitCount: 11,
      hasPlus: true,
      hasPunctuation: true,
    };
    const text = "call +1 202 555 0187 now";
    const result: PhoneRangeScanResult = scanner.scan({
      text,
      codePoints: Array.from(text),
      hints,
    });

    expect(result).toEqual({ ranges: [[5, 20]] });
  });

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

  it("keeps the public censor wrapper aligned with scanner ranges", () => {
    const text = "call +1 202 555 0187 now";
    const scanner = createPhoneScanner();
    const ranges = scanner.scan({
      text,
      codePoints: Array.from(text),
    }).ranges;

    expect(ranges).toEqual([[5, 20]]);
    expect(createPhoneFilter({ maskChar: "#" }).censor(text)).toBe(
      `call ${mask("+1 202 555 0187", "#")} now`,
    );
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
    const text = "79991234567(79991234567) or 79991234568";
    const seen: Array<readonly [number, number]> = [];

    expect(
      scanPhoneRangeMatches({ text, codePoints: Array.from(text) }, (match) => {
        seen.push(match.range);
        return false;
      }),
    ).toBe(false);
    expect(scanPhoneRanges("79991234567(79991234567)")).toEqual([[0, 24]]);
    expect(seen).toEqual([[0, 24]]);
  });

  it("keeps false-positive guards behind the prefilter", () => {
    expect(scanPhoneRanges("server 10.100.100.100")).toEqual([]);
    expect(scanPhoneRanges("balance 1,234,567,890")).toEqual([]);
    expect(scanPhoneRanges("-2147483648")).toEqual([]);
    expect(
      scanPhoneRanges(
        '{ "cursor": "1784477618588-0", "serverTs": 1784477618588 }',
      ),
    ).toEqual([]);
    const cursorWithPhone = '{"cursor":"1784477618588-79991234567"}';
    const cursorPhoneStart = cursorWithPhone.indexOf("79991234567");
    expect(scanPhoneRanges(cursorWithPhone)).toEqual([
      [cursorPhoneStart, cursorPhoneStart + "79991234567".length],
    ]);

    const cursorSequenceWithPhone = '{"cursor":"1784477618588-0-79991234567"}';
    const cursorSequencePhoneStart =
      cursorSequenceWithPhone.indexOf("79991234567");
    expect(scanPhoneRanges(cursorSequenceWithPhone)).toEqual([
      [
        cursorSequencePhoneStart,
        cursorSequencePhoneStart + "79991234567".length,
      ],
    ]);

    const serverTimestampWithPhone = '{"serverTs":"1784477618588-79991234567"}';
    const serverTimestampPhoneStart =
      serverTimestampWithPhone.indexOf("79991234567");
    expect(scanPhoneRanges(serverTimestampWithPhone)).toEqual([
      [
        serverTimestampPhoneStart,
        serverTimestampPhoneStart + "79991234567".length,
      ],
    ]);

    const longJsonWhitespace = " ".repeat(49);
    const spacedServerTimestamp = `{"serverTs":${longJsonWhitespace}1784477618588}`;
    const spacedCursor = `{"cursor":${longJsonWhitespace}"1784477618588-0"}`;
    expect(scanPhoneRanges(spacedServerTimestamp)).toEqual([]);
    expect(scanPhoneRanges(spacedCursor)).toEqual([]);

    const spacedCursorWithPhone = `{"cursor":${longJsonWhitespace}"1784477618588-79991234567"}`;
    const spacedCursorPhoneStart = spacedCursorWithPhone.indexOf("79991234567");
    expect(scanPhoneRanges(spacedCursorWithPhone)).toEqual([
      [spacedCursorPhoneStart, spacedCursorPhoneStart + "79991234567".length],
    ]);

    const escapedServerTimestamp = '{"server\\u0054s":1784477618588}';
    const escapedCursor = '{"cur\\u0073or":"1784477618588-0"}';
    expect(scanPhoneRanges(escapedServerTimestamp)).toEqual([]);
    expect(scanPhoneRanges(escapedCursor)).toEqual([]);

    const escapedServerTimestampWithPhone =
      '{"server\\u0054s":"1784477618588-79991234567"}';
    const escapedServerPhoneStart =
      escapedServerTimestampWithPhone.indexOf("79991234567");
    expect(scanPhoneRanges(escapedServerTimestampWithPhone)).toEqual([
      [escapedServerPhoneStart, escapedServerPhoneStart + "79991234567".length],
    ]);

    expect(scanPhoneRanges('{"CURSOR":1784477618588}')).toHaveLength(1);
    expect(scanPhoneRanges('{"serverts":1784477618588}')).toHaveLength(1);
    expect(scanPhoneRanges('{"phone":1784477618588}')).toHaveLength(1);

    const obfuscatedMetadataValues = [
      [
        '{"serverTs":"178447\u200B7618588"}',
        "178447\u200B7618588",
        "178447\u200B7618588",
      ],
      [
        '{"cursor":"1784477618588-\u200B0"}',
        "1784477618588-\u200B0",
        "1784477618588",
      ],
      [
        '{"cursor":"1784477618588\u200B"}',
        "1784477618588\u200B",
        "1784477618588\u200B",
      ],
      ['{"serverTs":"178447７618588"}', "178447７618588", "178447７618588"],
    ] as const;

    for (const [input, value, matchedValue] of obfuscatedMetadataValues) {
      const valueStart = Array.from(
        input.slice(0, input.indexOf(value)),
      ).length;
      expect(scanPhoneRanges(input)).toEqual([
        [valueStart, valueStart + Array.from(matchedValue).length],
      ]);
    }

    const zeroWidthServerTimestampWithPhone =
      '{"serverTs":"1784477618588\u200B-79991234567"}';
    const metadataStart =
      zeroWidthServerTimestampWithPhone.indexOf("1784477618588");
    const phoneStart = zeroWidthServerTimestampWithPhone.indexOf("79991234567");
    expect(scanPhoneRanges(zeroWidthServerTimestampWithPhone)).toEqual([
      [metadataStart, metadataStart + "1784477618588".length],
      [phoneStart, phoneStart + "79991234567".length],
    ]);
  });
});
