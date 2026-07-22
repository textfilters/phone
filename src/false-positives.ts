import {
  isWhitespaceSeparator,
  previousContent,
  previousVisible,
  skipZeroWidthForward,
} from "./boundaries.js";
import { isValidPhoneGroups } from "./phone-groups.js";
import { type TextMeta, WHITESPACE_RE } from "./meta.js";

const YEAR_GROUP_RE = /^(?:19|20)[0-9]{2}$/u;
const DAY_FIRST_YEAR_GROUP_RE = /^(?:(?:19|20)[0-9]{2}|[0-9]{2})$/u;

export const separatorHas = (
  separator: string | undefined,
  chars: string,
): boolean => Array.from(separator ?? "").some((ch) => chars.includes(ch));

const allZeroes = (value: string): boolean => /^[0]+$/u.test(value);

const isValidCoordinatePart = (
  whole: string | undefined,
  fraction: string | undefined,
  max: number,
): boolean => {
  if (!whole || !fraction) return false;
  if (fraction.length < 1 || fraction.length > 6) return false;
  const n = Number(whole);
  if (!Number.isInteger(n) || n < 0 || n > max) return false;
  return n < max || allZeroes(fraction);
};

const isCoordinateLike = (
  groups: readonly string[],
  separators: readonly string[],
): boolean => {
  const coordinateGroups =
    groups.length === 5 &&
    isWhitespaceSeparator(separators[3] ?? "") &&
    groups[4] !== undefined &&
    groups[4].length >= 1 &&
    groups[4].length <= 5
      ? groups.slice(0, 4)
      : groups;
  const coordinateSeparators =
    coordinateGroups === groups ? separators : separators.slice(0, 3);
  const coordinateSeparator = separators[1] ?? "";
  if (
    coordinateGroups.length !== 4 ||
    (coordinateGroups[0]?.length !== 1 && coordinateGroups[0]?.length !== 2) ||
    (coordinateGroups[2]?.length !== 1 &&
      coordinateGroups[2]?.length !== 2 &&
      coordinateGroups[2]?.length !== 3) ||
    !separatorHas(coordinateSeparators[0], ".,") ||
    !separatorHas(coordinateSeparators[2], ".,") ||
    // A real coordinate pair has a visible separator between latitude and longitude.
    (!separatorHas(coordinateSeparator, ",") &&
      !isWhitespaceSeparator(coordinateSeparator))
  ) {
    return false;
  }
  return (
    isValidCoordinatePart(coordinateGroups[0], coordinateGroups[1], 90) &&
    isValidCoordinatePart(coordinateGroups[2], coordinateGroups[3], 180)
  );
};

const isLeapYear = (year: number): boolean =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

const daysInMonth = (year: number, month: number): number => {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
};

const isValidDateParts = (
  year: string | undefined,
  month: string | undefined,
  day: string | undefined,
): boolean => {
  if (!year || !month || !day) return false;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  return (
    Number.isInteger(y) &&
    Number.isInteger(m) &&
    Number.isInteger(d) &&
    m >= 1 &&
    m <= 12 &&
    d >= 1 &&
    d <= daysInMonth(y, m)
  );
};

export const hasDayFirstDatePrefix = (
  groups: readonly string[],
  separators: readonly string[],
): boolean =>
  (groups[0]?.length === 1 || groups[0]?.length === 2) &&
  (groups[1]?.length === 1 || groups[1]?.length === 2) &&
  DAY_FIRST_YEAR_GROUP_RE.test(groups[2] ?? "") &&
  separatorHas(separators[0], "./-") &&
  separatorHas(separators[1], "./-") &&
  isValidDateParts(groups[2], groups[1], groups[0]);

export const hasMonthFirstDatePrefix = (
  groups: readonly string[],
  separators: readonly string[],
): boolean =>
  (groups[0]?.length === 1 || groups[0]?.length === 2) &&
  (groups[1]?.length === 1 || groups[1]?.length === 2) &&
  DAY_FIRST_YEAR_GROUP_RE.test(groups[2] ?? "") &&
  separatorHas(separators[0], "/-") &&
  separatorHas(separators[1], "/-") &&
  isValidDateParts(groups[2], groups[0], groups[1]);

export const hasYearFirstDatePrefix = (
  groups: readonly string[],
  separators: readonly string[],
): boolean =>
  groups[0]?.length === 4 &&
  YEAR_GROUP_RE.test(groups[0]) &&
  (groups[1]?.length === 1 || groups[1]?.length === 2) &&
  (groups[2]?.length === 1 || groups[2]?.length === 2) &&
  separatorHas(separators[0], "./-") &&
  separatorHas(separators[1], "./-") &&
  isValidDateParts(groups[0], groups[1], groups[2]);

const isDateTimeLike = (
  groups: readonly string[],
  separators: readonly string[],
): boolean => {
  if (groups.length < 4) return false;

  return (
    hasDayFirstDatePrefix(groups, separators) ||
    hasMonthFirstDatePrefix(groups, separators) ||
    hasYearFirstDatePrefix(groups, separators)
  );
};

export const isValidTimeParts = (
  hour: string | undefined,
  minute: string | undefined,
  separator: string | undefined,
): boolean => {
  if (
    !hour ||
    !minute ||
    hour.length < 1 ||
    hour.length > 2 ||
    minute.length !== 2
  ) {
    return false;
  }
  if (!separatorHas(separator, ":.")) return false;
  const h = Number(hour);
  const m = Number(minute);
  return (
    Number.isInteger(h) &&
    Number.isInteger(m) &&
    h >= 0 &&
    h <= 23 &&
    m >= 0 &&
    m <= 59
  );
};

interface DecimalRun {
  readonly whole: string;
  readonly fraction: string;
  readonly start: number;
  readonly end: number;
  readonly sign: string;
}

const readDecimalForward = (
  meta: TextMeta,
  start: number,
): DecimalRun | null => {
  let pos = start;
  let sign = "";
  if (meta.raw[pos] === "+" || meta.raw[pos] === "-") {
    sign = meta.raw[pos];
    pos++;
  }

  let whole = "";
  let fraction = "";
  let lastDigit = -1;
  while (pos < meta.codePoints.length) {
    if (meta.zeroWidth[pos]) {
      pos++;
      continue;
    }
    if (!meta.digit[pos]) break;
    whole += meta.raw[pos];
    lastDigit = pos;
    pos++;
  }
  if (
    !whole ||
    pos >= meta.codePoints.length ||
    !separatorHas(meta.raw[pos], ".,")
  ) {
    return null;
  }

  pos++;
  while (pos < meta.codePoints.length) {
    if (meta.zeroWidth[pos]) {
      pos++;
      continue;
    }
    if (!meta.digit[pos]) break;
    fraction += meta.raw[pos];
    lastDigit = pos;
    pos++;
  }

  return fraction ? { whole, fraction, start, end: lastDigit + 1, sign } : null;
};

const readDecimalBackward = (
  meta: TextMeta,
  endExclusive: number,
): DecimalRun | null => {
  let pos = previousContent(meta, endExclusive - 1);
  if (pos < 0 || !meta.digit[pos]) return null;

  const fractionChars: string[] = [];
  const fractionEnd = pos + 1;
  while (pos >= 0 && meta.digit[pos]) {
    fractionChars.unshift(meta.raw[pos]);
    pos = previousVisible(meta, pos - 1);
  }
  if (pos < 0 || !separatorHas(meta.raw[pos], ".,")) return null;

  pos = previousVisible(meta, pos - 1);
  const wholeChars: string[] = [];
  let wholeStart = pos;
  while (pos >= 0 && meta.digit[pos]) {
    wholeChars.unshift(meta.raw[pos]);
    wholeStart = pos;
    pos = previousVisible(meta, pos - 1);
  }

  let sign = "";
  let start = wholeStart;
  if (pos >= 0 && (meta.raw[pos] === "+" || meta.raw[pos] === "-")) {
    sign = meta.raw[pos];
    start = pos;
  }

  const whole = wholeChars.join("");
  const fraction = fractionChars.join("");
  return whole && fraction
    ? { whole, fraction, start, end: fractionEnd, sign }
    : null;
};

export const getSignedLongitudeEnd = (
  meta: TextMeta,
  start: number,
): number | null => {
  const longitude = readDecimalForward(meta, start);
  if (!longitude?.sign) return null;

  const separator = previousContent(meta, start - 1);
  if (separator < 0 || meta.raw[separator] !== ",") return null;

  const latitude = readDecimalBackward(meta, separator);
  if (
    !latitude ||
    !isValidCoordinatePart(latitude.whole, latitude.fraction, 90) ||
    !isValidCoordinatePart(longitude.whole, longitude.fraction, 180)
  ) {
    return null;
  }
  return longitude.end;
};

const readDigitsForward = (
  meta: TextMeta,
  start: number,
  count: number,
): { readonly value: string; readonly end: number } | null => {
  let value = "";
  let pos = start;
  while (pos < meta.codePoints.length && value.length < count) {
    if (meta.zeroWidth[pos]) {
      pos++;
      continue;
    }
    if (!meta.digit[pos]) return null;
    value += meta.raw[pos];
    pos++;
  }
  return value.length === count ? { value, end: pos } : null;
};

const readDigitsBackward = (
  meta: TextMeta,
  endExclusive: number,
  count: number,
): { readonly value: string; readonly before: number } | null => {
  let pos = previousVisible(meta, endExclusive - 1);
  const digits: string[] = [];
  while (pos >= 0 && digits.length < count) {
    if (!meta.digit[pos]) return null;
    digits.unshift(meta.raw[pos]);
    pos = previousVisible(meta, pos - 1);
  }
  return digits.length === count
    ? { value: digits.join(""), before: pos }
    : null;
};

const readHourBeforeSeparator = (
  meta: TextMeta,
  separator: number,
): string | null => {
  const hourLast = previousVisible(meta, separator - 1);
  if (hourLast < 0 || !meta.digit[hourLast]) return null;

  const hourFirst = previousVisible(meta, hourLast - 1);
  if (hourFirst < 0 || !meta.digit[hourFirst]) return meta.raw[hourLast];

  const beforeHour = previousVisible(meta, hourFirst - 1);
  if (beforeHour >= 0 && meta.digit[beforeHour]) return null;
  return `${meta.raw[hourFirst]}${meta.raw[hourLast]}`;
};

const readCompactTimezoneEnd = (
  meta: TextMeta,
  start: number,
): number | null => {
  let pos = skipZeroWidthForward(meta, start);
  if (pos >= meta.codePoints.length || !separatorHas(meta.raw[pos], "+-")) {
    return null;
  }

  const hour = readDigitsForward(meta, pos + 1, 2);
  if (!hour) return null;
  const hourValue = Number(hour.value);
  if (!Number.isInteger(hourValue) || hourValue > 23) return null;

  pos = skipZeroWidthForward(meta, hour.end);
  if (pos < meta.codePoints.length && meta.raw[pos] === ":") {
    const minute = readDigitsForward(meta, pos + 1, 2);
    if (!minute) return null;
    const minuteValue = Number(minute.value);
    return Number.isInteger(minuteValue) && minuteValue <= 59
      ? minute.end
      : null;
  }

  const minute = readDigitsForward(meta, pos, 2);
  if (!minute) return hour.end;
  const minuteValue = Number(minute.value);
  return Number.isInteger(minuteValue) && minuteValue <= 59 ? minute.end : null;
};

export const extendTimeSuffixEnd = (
  meta: TextMeta,
  end: number,
  { allowFraction = false }: { readonly allowFraction?: boolean } = {},
): number => {
  let pos = end;
  if (allowFraction) {
    const separator = skipZeroWidthForward(meta, pos);
    if (
      separator < meta.codePoints.length &&
      separatorHas(meta.raw[separator], ".,")
    ) {
      const fraction = readVisibleDigitGroupForward(meta, separator + 1);
      if (fraction) pos = fraction.end;
    }
  }

  return readCompactTimezoneEnd(meta, pos) ?? pos;
};

const isIpv4Like = (
  groups: readonly string[],
  separators: readonly string[],
): boolean =>
  groups.length === 4 &&
  separators.slice(0, 3).every((separator) => separator === ".") &&
  groups.every((group) => {
    const value = Number(group);
    return group.length >= 1 && group.length <= 3 && value >= 0 && value <= 255;
  });

const isCidrLength = (value: string | undefined): boolean => {
  if (value === undefined || value.length < 1 || value.length > 2) return false;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 32;
};

// Thousands groups may be punctuation- or whitespace-separated, but a single
// leading 7/8 with 3-digit chunks is still a common RU phone shape.
const isThousandsLike = (
  groups: readonly string[],
  separators: readonly string[],
): boolean => {
  const hasDecimalFraction =
    groups.length >= 3 &&
    groups.slice(1, -1).every((group) => group.length === 3) &&
    groups[groups.length - 1]?.length === 2;
  if (
    groups.length < 2 ||
    groups[0] === undefined ||
    groups[0].length < 1 ||
    groups[0].length > 3 ||
    (!groups.slice(1).every((group) => group.length === 3) &&
      !hasDecimalFraction)
  ) {
    return false;
  }

  const actualSeparators = separators.slice(0, Math.max(groups.length - 1, 0));
  const decimalAmountSeparated =
    hasDecimalFraction &&
    actualSeparators
      .slice(0, -1)
      .every((separator) => separator === actualSeparators[0]) &&
    separatorHas(actualSeparators[0], ".,") &&
    separatorHas(actualSeparators[actualSeparators.length - 1], ".,") &&
    actualSeparators[actualSeparators.length - 1] !== actualSeparators[0];
  const whitespaceSeparated = actualSeparators.every((separator) =>
    isWhitespaceSeparator(separator),
  );
  const punctuationSeparated = actualSeparators.every((separator) =>
    separatorHas(separator, ",."),
  );
  const hasPhoneCountryCodeShape = /^[78]$/u.test(groups[0]);
  return (
    (punctuationSeparated || whitespaceSeparated || decimalAmountSeparated) &&
    !hasPhoneCountryCodeShape
  );
};

const STRUCTURED_FALSE_POSITIVES = {
  coordinate: "coordinate",
  datetime: "datetime",
  ipv4: "ipv4",
  thousands: "thousands",
} as const;

type StructuredFalsePositive =
  (typeof STRUCTURED_FALSE_POSITIVES)[keyof typeof STRUCTURED_FALSE_POSITIVES];

export const getStructuredFalsePositive = (
  groups: readonly string[],
  separators: readonly string[],
  options: { readonly hasPlus: boolean },
): StructuredFalsePositive | null => {
  if (isCoordinateLike(groups, separators)) {
    return STRUCTURED_FALSE_POSITIVES.coordinate;
  }
  if (options.hasPlus) return null;
  if (isDateTimeLike(groups, separators))
    return STRUCTURED_FALSE_POSITIVES.datetime;
  if (isIpv4Like(groups, separators)) return STRUCTURED_FALSE_POSITIVES.ipv4;
  if (isThousandsLike(groups, separators)) {
    return STRUCTURED_FALSE_POSITIVES.thousands;
  }
  return null;
};

export const isClearPhoneSuffix = (groups: readonly string[]): boolean => {
  if (groups.length === 1) return groups[0]?.length >= 10;

  const first = groups[0] ?? "";
  const rest = groups.slice(1);
  if (/^[78][0-9]{3}$/u.test(first)) {
    return rest.every((group) => group.length >= 2 && group.length <= 3);
  }
  if (/^[78]$/u.test(first) && rest.length >= 3) {
    return rest.every((group) => group.length >= 2 && group.length <= 3);
  }
  return false;
};

export const isLocalGroupedPhoneSuffix = (groups: readonly string[]): boolean =>
  groups.length === 3 &&
  groups[0]?.length === 3 &&
  groups[1]?.length === 3 &&
  groups[2]?.length === 4;

export const isRecoverablePhoneSuffix = (groups: readonly string[]): boolean =>
  isClearPhoneSuffix(groups) || isLocalGroupedPhoneSuffix(groups);

export const getLeadingDecimalPhoneSuffixStart = (
  groups: readonly string[],
  separators: readonly string[],
  groupStarts: readonly number[],
): number | null => {
  // Preserve decimal-like prefixes such as "55.75" and "55,75" while letting a
  // clear phone suffix after the number be censored from its own first group.
  if (groups.length < 3 || !separatorHas(separators[0], ".,")) return null;
  const suffixGroups = groups.slice(2);
  const suffixStart = groupStarts[2];
  if (suffixStart === undefined) return null;
  if (
    isRecoverablePhoneSuffix(suffixGroups) &&
    isValidPhoneGroups(suffixGroups, {
      hasPlus: false,
      hasParentheses: false,
    }) &&
    !getStructuredFalsePositive(suffixGroups, separators.slice(2), {
      hasPlus: false,
    })
  ) {
    return suffixStart;
  }
  return null;
};

export const getLeadingFormattedAmountPhoneSuffixStart = (
  groups: readonly string[],
  separators: readonly string[],
  groupStarts: readonly number[],
): number | null => {
  if (
    groups.length < 4 ||
    groups[0] === undefined ||
    groups[0].length < 1 ||
    groups[0].length > 3 ||
    groups[1]?.length !== 3 ||
    groups[2]?.length !== 2 ||
    (!(separatorHas(separators[0], ",") && separatorHas(separators[1], ".")) &&
      !(separatorHas(separators[0], ".") && separatorHas(separators[1], ",")))
  ) {
    return null;
  }

  const suffixGroups = groups.slice(3);
  const suffixStart = groupStarts[3];
  if (suffixStart === undefined) return null;
  if (
    isRecoverablePhoneSuffix(suffixGroups) &&
    isValidPhoneGroups(suffixGroups, {
      hasPlus: false,
      hasParentheses: false,
    }) &&
    !getStructuredFalsePositive(suffixGroups, separators.slice(3), {
      hasPlus: false,
    })
  ) {
    return suffixStart;
  }
  return null;
};

export const getLeadingVersionPhoneSuffixStart = (
  groups: readonly string[],
  separators: readonly string[],
  groupStarts: readonly number[],
): number | null => {
  // Preserve dotted versions such as "1.2.3" and rescan the clear phone suffix
  // instead of allowing the version fields to become a phone prefix.
  const isVersionPart = (group: string | undefined): boolean =>
    group !== undefined && group.length >= 1 && group.length <= 3;
  if (
    groups.length < 4 ||
    !isVersionPart(groups[0]) ||
    !isVersionPart(groups[1]) ||
    !isVersionPart(groups[2]) ||
    !separatorHas(separators[0], ".") ||
    !separatorHas(separators[1], ".")
  ) {
    return null;
  }

  const suffixGroups = groups.slice(3);
  const suffixStart = groupStarts[3];
  if (suffixStart === undefined) return null;
  if (
    isRecoverablePhoneSuffix(suffixGroups) &&
    isValidPhoneGroups(suffixGroups, {
      hasPlus: false,
      hasParentheses: false,
    }) &&
    !getStructuredFalsePositive(suffixGroups, separators.slice(3), {
      hasPlus: false,
    })
  ) {
    return suffixStart;
  }
  return null;
};

export const getLeadingTimeEnd = (
  groups: readonly string[],
  separators: readonly string[],
  groupEnds: readonly number[],
): number | null => {
  if (groups.length < 3) return null;
  if (!isValidTimeParts(groups[0], groups[1], separators[0])) return null;
  if (
    groups[2]?.length === 2 &&
    separatorHas(separators[1], ":.") &&
    Number(groups[2]) >= 0 &&
    Number(groups[2]) <= 59
  ) {
    return groupEnds[2] ?? null;
  }
  return groupEnds[1] ?? null;
};

const PHONE_LABELS = new Set([
  "call",
  "mobile",
  "phone",
  "tel",
  "telegram",
  "tg",
  "wa",
  "whatsapp",
  "тел",
  "телефон",
]);

export const isUuidNumericSuffix = (
  meta: TextMeta,
  start: number,
  end: number,
  groups: readonly string[],
): boolean => {
  if (groups.length !== 1 || !/^[0-9]{12}$/u.test(groups[0] ?? "")) {
    return false;
  }
  const prefix = meta.raw.slice(Math.max(0, start - 24), start).join("");
  const suffix = meta.raw.slice(start, end).join("");
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-$/iu.test(prefix) &&
    /^[0-9]{12}$/u.test(suffix)
  );
};

export const isLabeledBookIdentifier = (
  meta: TextMeta,
  start: number,
  groups: readonly string[],
): boolean => {
  if (groups.length !== 1 || !/^[0-9]{13}$/u.test(groups[0] ?? "")) {
    return false;
  }

  const prefix = meta.raw.slice(Math.max(0, start - 32), start).join("");
  return /(?:^|[^\p{L}\p{N}_])(?:isbn(?:[-\s]?1[03])?|ean(?:[-\s]?13)?)[\s:#-]*$/iu.test(
    prefix,
  );
};

type JsonNumericMetadataKey = "cursor" | "serverTs";

interface JsonNumericMetadata {
  readonly key: JsonNumericMetadataKey;
  readonly keyStart: number;
  readonly quoted: boolean;
}

const JSON_WHITESPACE = new Set([" ", "\t", "\n", "\r"]);

const skipJsonWhitespaceBackward = (meta: TextMeta, start: number): number => {
  let cursor = start;
  while (cursor >= 0 && JSON_WHITESPACE.has(meta.codePoints[cursor])) {
    cursor--;
  }
  return cursor;
};

const isEscapedJsonQuote = (meta: TextMeta, quotePosition: number): boolean => {
  let slashCount = 0;
  for (
    let cursor = quotePosition - 1;
    cursor >= 0 && meta.codePoints[cursor] === "\\";
    cursor--
  ) {
    slashCount++;
  }
  return slashCount % 2 === 1;
};

const jsonStringStartBefore = (
  meta: TextMeta,
  closingQuote: number,
): number | null => {
  for (let cursor = closingQuote - 1; cursor >= 0; cursor--) {
    if (meta.codePoints[cursor] === '"' && !isEscapedJsonQuote(meta, cursor)) {
      return cursor;
    }
  }
  return null;
};

const decodeJsonMetadataKey = (
  meta: TextMeta,
  openingQuote: number,
  closingQuote: number,
): JsonNumericMetadataKey | null => {
  const encodedKey = meta.codePoints
    .slice(openingQuote, closingQuote + 1)
    .join("");

  if (encodedKey === '"cursor"') return "cursor";
  if (encodedKey === '"serverTs"') return "serverTs";

  try {
    const decodedKey: unknown = JSON.parse(encodedKey);
    return decodedKey === "cursor" || decodedKey === "serverTs"
      ? decodedKey
      : null;
  } catch {
    return null;
  }
};

const jsonNumericMetadataKeyBefore = (
  meta: TextMeta,
  start: number,
): JsonNumericMetadata | null => {
  let cursor = start - 1;
  let quoted = false;

  if (cursor >= 0 && meta.codePoints[cursor] === '"') {
    quoted = true;
    cursor--;
  }
  cursor = skipJsonWhitespaceBackward(meta, cursor);
  if (cursor < 0 || meta.codePoints[cursor] !== ":") {
    return null;
  }

  cursor = skipJsonWhitespaceBackward(meta, cursor - 1);
  if (
    cursor < 0 ||
    meta.codePoints[cursor] !== '"' ||
    isEscapedJsonQuote(meta, cursor)
  ) {
    return null;
  }

  const closingQuote = cursor;
  const openingQuote = jsonStringStartBefore(meta, closingQuote);
  if (openingQuote === null) {
    return null;
  }

  cursor = skipJsonWhitespaceBackward(meta, openingQuote - 1);
  if (
    cursor >= 0 &&
    meta.codePoints[cursor] !== "{" &&
    meta.codePoints[cursor] !== ","
  ) {
    return null;
  }

  const key = decodeJsonMetadataKey(meta, openingQuote, closingQuote);
  return key === null ? null : { key, keyStart: openingQuote, quoted };
};

const jsonObjectStartBefore = (
  meta: TextMeta,
  position: number,
): number | null => {
  let depth = 0;
  let inString = false;

  for (let cursor = position - 1; cursor >= 0; cursor--) {
    const codePoint = meta.codePoints[cursor];
    if (codePoint === '"' && !isEscapedJsonQuote(meta, cursor)) {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (codePoint === "}") {
      depth++;
    } else if (codePoint === "{") {
      if (depth === 0) return cursor;
      depth--;
    }
  }

  return null;
};

const jsonObjectEndAfter = (
  meta: TextMeta,
  objectStart: number,
): number | null => {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let cursor = objectStart; cursor < meta.codePoints.length; cursor++) {
    const codePoint = meta.codePoints[cursor];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (codePoint === "\\") {
        escaped = true;
      } else if (codePoint === '"') {
        inString = false;
      }
      continue;
    }

    if (codePoint === '"') {
      inString = true;
    } else if (codePoint === "{") {
      depth++;
    } else if (codePoint === "}") {
      depth--;
      if (depth === 0) return cursor + 1;
    }
  }

  return null;
};

const hasCompleteJsonMetadataObject = (
  meta: TextMeta,
  metadata: JsonNumericMetadata,
  valueEnd: number,
): boolean => {
  const objectStart = jsonObjectStartBefore(meta, metadata.keyStart);
  if (objectStart === null) return false;

  const objectEnd = jsonObjectEndAfter(meta, objectStart);
  if (objectEnd === null || objectEnd <= valueEnd) return false;

  try {
    const parsed: unknown = JSON.parse(
      meta.codePoints.slice(objectStart, objectEnd).join(""),
    );
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      Object.prototype.hasOwnProperty.call(parsed, metadata.key)
    );
  } catch {
    return false;
  }
};

const sourceSpanEquals = (
  meta: TextMeta,
  start: number,
  end: number,
  expected: string,
): boolean => {
  const expectedCodePoints = Array.from(expected);
  if (end - start !== expectedCodePoints.length) return false;

  return expectedCodePoints.every(
    (codePoint, offset) => meta.codePoints[start + offset] === codePoint,
  );
};

const hasExactJsonMetadataValueEnd = (
  meta: TextMeta,
  end: number,
  quoted: boolean,
): boolean => {
  if (quoted) return meta.codePoints[end] === '"';

  let cursor = end;
  while (
    cursor < meta.codePoints.length &&
    JSON_WHITESPACE.has(meta.codePoints[cursor])
  ) {
    cursor++;
  }

  return meta.codePoints[cursor] === "," || meta.codePoints[cursor] === "}";
};

export const getNonContactNumericMetadataEnd = (
  meta: TextMeta,
  start: number,
  candidateEnd: number,
  groups: readonly string[],
  separators: readonly string[],
  groupStarts: readonly number[],
  groupEnds: readonly number[],
): number | null => {
  if (
    groups.length === 1 &&
    groups[0] === "2147483648" &&
    meta.codePoints[start - 1] === "-" &&
    sourceSpanEquals(meta, start, candidateEnd, "2147483648")
  ) {
    return candidateEnd;
  }

  if (!/^[0-9]{13}$/u.test(groups[0] ?? "")) {
    return null;
  }

  const metadata = jsonNumericMetadataKeyBefore(meta, start);
  const firstGroupEnd = groupEnds[0];
  if (
    metadata === null ||
    firstGroupEnd === undefined ||
    !sourceSpanEquals(meta, start, firstGroupEnd, groups[0] ?? "") ||
    !hasCompleteJsonMetadataObject(meta, metadata, candidateEnd)
  ) {
    return null;
  }

  let protectedEnd = firstGroupEnd;
  let nextGroupIndex = 1;

  if (metadata.key === "cursor" && groups[1] === "0" && separators[0] === "-") {
    const cursorSequenceEnd = groupEnds[1];
    if (
      cursorSequenceEnd === undefined ||
      !sourceSpanEquals(meta, start, cursorSequenceEnd, `${groups[0]}-0`)
    ) {
      return null;
    }
    protectedEnd = cursorSequenceEnd;
    nextGroupIndex = 2;
  }

  if (groups.length > nextGroupIndex) {
    const nextGroupStart = groupStarts[nextGroupIndex];
    const separator = separators[nextGroupIndex - 1];
    const suffixGroups = groups.slice(nextGroupIndex);
    if (
      nextGroupStart === undefined ||
      separator === undefined ||
      !sourceSpanEquals(meta, protectedEnd, nextGroupStart, separator) ||
      !isRecoverablePhoneSuffix(suffixGroups) ||
      !isValidPhoneGroups(suffixGroups, {
        hasPlus: false,
        hasParentheses: false,
      }) ||
      getStructuredFalsePositive(
        suffixGroups,
        separators.slice(nextGroupIndex),
        { hasPlus: false },
      ) !== null
    ) {
      return null;
    }
  } else if (
    !hasExactJsonMetadataValueEnd(meta, protectedEnd, metadata.quoted)
  ) {
    return null;
  }

  return protectedEnd;
};

export const hasPhoneLabelBefore = (meta: TextMeta, pos: number): boolean => {
  let cursor = previousContent(meta, pos - 1);
  if (cursor < 0 || !meta.wordChar[cursor]) return false;

  const chars: string[] = [];
  while (cursor >= 0 && meta.wordChar[cursor]) {
    chars.unshift(meta.raw[cursor]);
    cursor = previousVisible(meta, cursor - 1);
  }
  return PHONE_LABELS.has(chars.join(""));
};

export const getMinuteAfterTimeEnd = (
  meta: TextMeta,
  start: number,
): number | null => {
  const minute = readDigitsForward(meta, start, 2);
  if (!minute) return null;

  let separator = start - 1;
  while (separator >= 0 && meta.zeroWidth[separator]) separator--;
  if (separator < 0 || !separatorHas(meta.raw[separator], ":.")) return null;

  const hour = readHourBeforeSeparator(meta, separator);
  return isValidTimeParts(hour ?? undefined, minute.value, meta.raw[separator])
    ? extendTimeSuffixEnd(meta, minute.end)
    : null;
};

export const getSecondAfterTimeEnd = (
  meta: TextMeta,
  start: number,
): number | null => {
  const second = readDigitsForward(meta, start, 2);
  if (!second) return null;

  const seconds = Number(second.value);
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 59) return null;

  let secondSeparator = start - 1;
  while (secondSeparator >= 0 && meta.zeroWidth[secondSeparator]) {
    secondSeparator--;
  }
  if (secondSeparator < 0 || !separatorHas(meta.raw[secondSeparator], ":.")) {
    return null;
  }

  const minute = readDigitsBackward(meta, secondSeparator, 2);
  if (!minute) return null;

  const minuteSeparator = minute.before;
  if (minuteSeparator < 0 || !separatorHas(meta.raw[minuteSeparator], ":.")) {
    return null;
  }

  const hour = readHourBeforeSeparator(meta, minuteSeparator);
  return isValidTimeParts(
    hour ?? undefined,
    minute.value,
    meta.raw[minuteSeparator],
  )
    ? extendTimeSuffixEnd(meta, second.end, { allowFraction: true })
    : null;
};

const readVisibleDigitGroupForward = (
  meta: TextMeta,
  start: number,
): { readonly value: string; readonly end: number } | null => {
  let pos = start;
  let value = "";
  while (pos < meta.codePoints.length) {
    if (meta.zeroWidth[pos]) {
      pos++;
      continue;
    }
    if (!meta.digit[pos]) break;
    value += meta.raw[pos];
    pos++;
  }
  return value ? { value, end: pos } : null;
};

const readVisibleDigitGroupBackward = (
  meta: TextMeta,
  endExclusive: number,
): { readonly value: string; readonly before: number } | null => {
  let pos = previousVisible(meta, endExclusive - 1);
  const digits: string[] = [];
  while (pos >= 0 && meta.digit[pos]) {
    digits.unshift(meta.raw[pos]);
    pos = previousVisible(meta, pos - 1);
  }
  return digits.length > 0 ? { value: digits.join(""), before: pos } : null;
};

export const getIpv4PortEnd = (
  meta: TextMeta,
  start: number,
): number | null => {
  // A scan starting on the first port digit after "10.0.0.1:" looks like a
  // time field ("1:44"). Skip only the port so the following phone can rescan.
  let colon = start - 1;
  while (colon >= 0 && meta.zeroWidth[colon]) colon--;
  if (colon < 0 || meta.raw[colon] !== ":") return null;

  let groupEnd = colon;
  const groups: string[] = [];
  for (let i = 0; i < 4; i++) {
    const group = readVisibleDigitGroupBackward(meta, groupEnd);
    if (!group) return null;
    groups.unshift(group.value);
    if (i === 3) break;
    if (group.before < 0 || meta.raw[group.before] !== ".") return null;
    groupEnd = group.before;
  }

  if (!isIpv4Like(groups, [".", ".", "."])) return null;

  const port = readVisibleDigitGroupForward(meta, start);
  if (!port || port.value.length > 5) return null;
  const value = Number(port.value);
  return Number.isInteger(value) && value <= 65535 ? port.end : null;
};

export const getIpv6TailFieldEnd = (
  meta: TextMeta,
  start: number,
): number | null => {
  let separator = start - 1;
  while (separator >= 0 && meta.zeroWidth[separator]) separator--;
  if (separator < 0 || meta.raw[separator] !== ":") return null;

  let cursor = separator - 1;
  let colonCount = 1;
  let hasHex = false;
  while (cursor >= 0 && !WHITESPACE_RE.test(meta.raw[cursor])) {
    const raw = meta.raw[cursor];
    if (meta.zeroWidth[cursor]) {
      cursor--;
      continue;
    }
    if (raw === ":") {
      colonCount++;
      cursor--;
      continue;
    }
    if (/^[0-9a-f]$/iu.test(raw)) {
      hasHex = true;
      cursor--;
      continue;
    }
    return null;
  }
  if (colonCount < 2 || !hasHex) return null;

  const group = readVisibleDigitGroupForward(meta, start);
  return group !== null && group.value.length <= 4 ? group.end : null;
};

export const getStructuredPrefixEnd = (
  groups: readonly string[],
  separators: readonly string[],
  groupEnds: readonly number[],
): number | null => {
  if (isIpv4Like(groups.slice(0, 4), separators.slice(0, 3))) {
    if (
      separatorHas(separators[3], "/") &&
      isCidrLength(groups[4]) &&
      groupEnds[4] !== undefined
    ) {
      return groupEnds[4];
    }
    return groupEnds[3] ?? null;
  }
  return null;
};
