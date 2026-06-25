import {
  maskCodePointRangesPreservingLength,
  normalizeMaskChar,
  normalizeTextInput,
} from "@textfilters/core";
import { collectRanges, createMeta } from "./parser.js";

export interface PhoneFilterConfig {
  readonly maskChar?: string;
}

export const PHONE_FILTER_NAME = "phone";

export interface PhoneFilter {
  readonly name: typeof PHONE_FILTER_NAME;
  censor(text: unknown): string;
}

export function createPhoneFilter(config: PhoneFilterConfig = {}): PhoneFilter {
  const maskChar = normalizeMaskChar(config.maskChar);

  return {
    name: PHONE_FILTER_NAME,
    censor(text) {
      const source = normalizeTextInput(text);
      if (!source) return source;
      const meta = createMeta(source);
      const ranges = collectRanges(meta);
      return maskCodePointRangesPreservingLength(
        meta.codePoints,
        ranges,
        maskChar,
      );
    },
  };
}

export const phoneFilter = createPhoneFilter;
export const filter = createPhoneFilter();
