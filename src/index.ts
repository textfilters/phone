import {
  maskCodePointRangesPreservingLength,
  normalizeMaskChar,
  type TextCensor,
} from "@textfilters/core";
import { collectRanges, createMeta } from "./parser.js";

export interface PhoneFilterConfig {
  readonly maskChar?: string;
}

export const PHONE_FILTER_NAME = "phone";

export type PhoneFilter = TextCensor & {
  readonly name: typeof PHONE_FILTER_NAME;
};

export function createPhoneFilter(config: PhoneFilterConfig = {}): PhoneFilter {
  const maskChar = normalizeMaskChar(config.maskChar);

  return {
    name: PHONE_FILTER_NAME,
    censor(text) {
      if (text === null || text === undefined) return "";
      const source = String(text);
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
