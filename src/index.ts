import {
  maskCodePointRangesPreservingLength,
  normalizeMaskChar,
  normalizeTextInput,
  type TextCodePointRange,
} from "@textfilters/core";
import { toRawChar } from "./digits.js";
import { collectRanges, createMeta } from "./parser.js";

export interface PhoneFilterConfig {
  readonly maskChar?: string;
}

export const PHONE_FILTER_NAME = "phone";

export interface PhoneFilter {
  readonly name: typeof PHONE_FILTER_NAME;
  censor(text: unknown): string;
}

export interface PhoneScannerConfig {}

export interface PhoneScanInput {
  readonly text: string;
  readonly codePoints: readonly string[];
}

export interface PhoneRangeScanResult {
  readonly ranges: readonly TextCodePointRange[];
}

export interface PhoneRangeScanner {
  readonly name: typeof PHONE_FILTER_NAME;
  scan(input: PhoneScanInput): PhoneRangeScanResult;
}

export function createPhoneScanner(
  _config: PhoneScannerConfig = {},
): PhoneRangeScanner {
  return {
    name: PHONE_FILTER_NAME,
    scan(input) {
      return {
        ranges: scanPhoneRanges(input.text),
      };
    },
  };
}

export function scanPhoneRanges(text: unknown): readonly TextCodePointRange[] {
  const source = String(text ?? "");
  if (!source || !hasPhoneCandidate(source)) return [];

  const meta = createMeta(source);
  return collectRanges(meta);
}

export function createPhoneFilter(config: PhoneFilterConfig = {}): PhoneFilter {
  const scanner = createPhoneScanner();
  const maskChar = normalizeMaskChar(config.maskChar);

  return {
    name: PHONE_FILTER_NAME,
    censor(text) {
      const source = normalizeTextInput(text);
      if (!source) return source;
      const codePoints = Array.from(source);
      const ranges = scanner.scan({ text: source, codePoints }).ranges;
      return maskCodePointRangesPreservingLength(codePoints, ranges, maskChar);
    },
  };
}

export const phoneFilter = createPhoneFilter;
export const filter = createPhoneFilter();

function hasPhoneCandidate(source: string): boolean {
  let digitCount = 0;

  for (const codePoint of Array.from(source)) {
    const raw = toRawChar(codePoint);
    if (raw >= "0" && raw <= "9") {
      digitCount++;
      if (digitCount >= 10) return true;
    }
  }

  return false;
}
