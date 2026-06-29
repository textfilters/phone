import {
  maskCodePointRangesPreservingLength,
  normalizeMaskChar,
  normalizeTextInput,
  type TextCodePointRange,
} from "@textfilters/core";
import { toRawChar } from "./digits.js";
import {
  collectCandidateRangeMatches,
  collectRanges,
  createMeta,
} from "./parser.js";

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
  readonly hints?: {
    readonly textLength?: number;
    readonly digitCount?: number;
    readonly hasPlus?: boolean;
    readonly hasPunctuation?: boolean;
  };
}

export interface PhoneRangeScanResult {
  readonly ranges: readonly TextCodePointRange[];
}

export interface PhoneRangeMatch {
  readonly range: TextCodePointRange;
}

export type PhoneRangeMatchSink = (match: PhoneRangeMatch) => boolean | void;

export interface PhoneRangeScanner {
  readonly name: typeof PHONE_FILTER_NAME;
  check(input: PhoneScanInput): boolean;
  scan(input: PhoneScanInput): PhoneRangeScanResult;
  scan(input: PhoneScanInput, sink: PhoneRangeMatchSink): boolean | void;
}

export function createPhoneScanner(
  _config: PhoneScannerConfig = {},
): PhoneRangeScanner {
  function scan(input: PhoneScanInput): {
    ranges: readonly TextCodePointRange[];
  };
  function scan(input: PhoneScanInput, sink: PhoneRangeMatchSink): boolean;
  function scan(input: PhoneScanInput, sink?: PhoneRangeMatchSink) {
    if (sink === undefined) {
      return {
        ranges: scanPhoneRanges(input.text),
      };
    }

    return scanPhoneRangeMatches(input, sink);
  }

  return {
    name: PHONE_FILTER_NAME,
    check(input) {
      return checkPhoneRanges(input);
    },
    scan,
  };
}

export function scanPhoneRanges(text: unknown): readonly TextCodePointRange[] {
  const source = String(text ?? "");
  if (!source || !hasPhoneCandidate(source)) return [];

  const meta = createMeta(source);
  return collectRanges(meta);
}

export function checkPhoneRanges(input: PhoneScanInput): boolean {
  if (!hasPhoneCandidateInput(input)) return false;

  const meta = createMeta(input.text);
  let found = false;
  collectCandidateRangeMatches(meta, () => {
    found = true;
    return false;
  });
  return found;
}

export function scanPhoneRangeMatches(
  input: PhoneScanInput,
  sink: PhoneRangeMatchSink,
): boolean {
  if (!hasPhoneCandidateInput(input)) return true;

  const meta = createMeta(input.text);
  return collectCandidateRangeMatches(meta, (range) => sink({ range }));
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

function hasPhoneCandidateInput(input: PhoneScanInput): boolean {
  const hints = input.hints;
  if (hints?.digitCount !== undefined && hints.digitCount < 10) return false;
  return hasPhoneCandidate(input.text);
}
