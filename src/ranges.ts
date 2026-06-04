import {
  mergeCodePointRanges,
  type TextCodePointRange,
} from "@textfilters/core";
import { type TextMeta } from "./meta.js";
import { collectCandidateRanges } from "./scanner.js";

export type CodePointRange = TextCodePointRange;

export const collectRanges = (meta: TextMeta): readonly CodePointRange[] =>
  mergeCodePointRanges(collectCandidateRanges(meta));
