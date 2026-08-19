/**
 * Deterministic fidelity checks — model cannot override numeric/name/date failures.
 */

import type { AbstentionReasonCode, CheckCode } from './types';

export type DeterministicCheckResult = {
  ok: boolean;
  checkCodes: CheckCode[];
  abstentionCodes: AbstentionReasonCode[];
  numericOk: boolean | null;
  nameOk: boolean | null;
  dateOk: boolean | null;
  unitOk: boolean | null;
  negationOk: boolean | null;
  modalityOk: boolean | null;
  causalityOk: boolean | null;
};

const NUMBER_RE =
  /([+-]?\d{1,3}(?:[.\s]\d{3})*(?:,\d+)?|[+-]?\d+(?:[.,]\d+)?)\s*(%|‰|€|\$|USD|EUR|millones?|miles?|kg|km|m|cm|mm|°C|°F)?/gi;

const NEGATION_RE =
  /\b(no|nunca|tampoco|sin|ningún|ninguna|ninguno|not|never|without|neither)\b/i;

const MODALITY_RE =
  /\b(puede|podría|podria|suele|en algunos casos|posiblemente|quizá|quiza|maybe|might|could|often|sometimes|possibly)\b/i;

const CAUSAL_RE =
  /\b(causa|causan|causó|causo|provoca|provocan|debido a|porque|causes?|because|leads? to)\b/i;

const CORRELATION_RE =
  /\b(correlacion|correlación|asocia|asociad|relacionad|correlated|associated with)\b/i;

function normalizeDecimal(raw: string): number | null {
  let s = raw.replace(/\s/g, '');
  // Spanish: 1.234,56 → 1234.56 ; English 1,234.56 → 1234.56
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    s = s.replace(/,/g, '');
  } else if (/^\d+,\d+$/.test(s)) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export type ExtractedNumber = {
  value: number;
  raw: string;
  unit?: string;
  isPercent: boolean;
  sign: number;
};

export function extractNumbers(text: string): ExtractedNumber[] {
  const out: ExtractedNumber[] = [];
  const re = new RegExp(NUMBER_RE);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1]!;
    const unit = m[2]?.trim();
    const value = normalizeDecimal(raw);
    if (value === null) continue;
    out.push({
      value: Math.abs(value),
      raw,
      unit,
      isPercent: unit === '%' || /por\s*ciento/i.test(text.slice(Math.max(0, m.index - 12), m.index + 20)),
      sign: value < 0 || /−|–/.test(raw) ? -1 : 1,
    });
  }
  return out;
}

const DATE_RE =
  /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+\d{4})\b/gi;

export function extractDates(text: string): string[] {
  const out: string[] = [];
  const re = new RegExp(DATE_RE);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(m[1]!.toLowerCase());
  }
  return out;
}

/** Proper names: capitalized tokens not at sentence start only — simple heuristic. */
export function extractProperNames(text: string): string[] {
  const names = new Set<string>();
  const re = /(?:^|[^\p{L}])([\p{Lu}][\p{Ll}]{2,}(?:\s+[\p{Lu}][\p{Ll}]{2,})?)/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = m[1]!.trim();
    if (n.length < 3) continue;
    if (/^(El|La|Los|Las|Un|Una|The|A|An|En|De|Del)$/.test(n)) continue;
    names.add(n);
  }
  return [...names];
}

function numbersCompatible(claimNums: ExtractedNumber[], sourceNums: ExtractedNumber[]): {
  ok: boolean | null;
  codes: CheckCode[];
  abs: AbstentionReasonCode[];
} {
  if (!claimNums.length) return { ok: null, codes: [], abs: [] };
  if (!sourceNums.length) {
    return { ok: false, codes: ['NUMERIC_FAIL'], abs: ['NUMERIC_MISMATCH'] };
  }
  const codes: CheckCode[] = [];
  const abs: AbstentionReasonCode[] = [];
  for (const cn of claimNums) {
    const match = sourceNums.find((sn) => {
      if (cn.isPercent !== sn.isPercent) return false;
      if (cn.sign !== sn.sign) return false;
      if (cn.unit && sn.unit && cn.unit.toLowerCase() !== sn.unit.toLowerCase()) return false;
      // Exact value — never treat 5 and 50 / millions and thousands as equal
      return Math.abs(cn.value - sn.value) < 1e-9;
    });
    if (!match) {
      if (cn.isPercent) {
        codes.push('PERCENT_FAIL');
        abs.push('NUMERIC_MISMATCH');
      } else if (cn.unit === '$' || cn.unit === '€' || cn.unit === 'USD' || cn.unit === 'EUR') {
        codes.push('CURRENCY_FAIL');
        abs.push('UNIT_MISMATCH');
      } else if (cn.unit) {
        codes.push('UNIT_FAIL');
        abs.push('UNIT_MISMATCH');
      } else {
        codes.push('NUMERIC_FAIL');
        abs.push('NUMERIC_MISMATCH');
      }
      // Sign check
      const sameAbs = sourceNums.find((sn) => Math.abs(sn.value - cn.value) < 1e-9);
      if (sameAbs && sameAbs.sign !== cn.sign) {
        codes.push('SIGN_FAIL');
        abs.push('SIGN_MISMATCH');
      }
      return { ok: false, codes, abs: [...new Set(abs)] };
    }
    if (cn.isPercent) codes.push('PERCENT_OK');
    else if (cn.unit) codes.push('UNIT_OK');
    else codes.push('NUMERIC_OK');
    codes.push('SIGN_OK');
  }
  return { ok: true, codes, abs: [] };
}

/**
 * Compare claim text against concatenated candidate source text.
 * Failures are decisive — entailment cannot override.
 */
export function runDeterministicChecks(
  claimText: string,
  sourceText: string
): DeterministicCheckResult {
  const checkCodes: CheckCode[] = [];
  const abstentionCodes: AbstentionReasonCode[] = [];

  const claimNums = extractNumbers(claimText);
  const sourceNums = extractNumbers(sourceText);
  const num = numbersCompatible(claimNums, sourceNums);
  checkCodes.push(...num.codes);
  abstentionCodes.push(...num.abs);

  // Dates
  const claimDates = extractDates(claimText);
  const sourceDates = extractDates(sourceText);
  let dateOk: boolean | null = null;
  if (claimDates.length) {
    dateOk = claimDates.every((d) => sourceDates.some((s) => s === d || s.includes(d) || d.includes(s)));
    checkCodes.push(dateOk ? 'DATE_OK' : 'DATE_FAIL');
    if (!dateOk) abstentionCodes.push('DATE_MISMATCH');
  }

  // Names (only when claim has proper names)
  const claimNames = extractProperNames(claimText);
  const sourceLower = sourceText.toLowerCase();
  let nameOk: boolean | null = null;
  if (claimNames.length) {
    nameOk = claimNames.every((n) => sourceLower.includes(n.toLowerCase()));
    checkCodes.push(nameOk ? 'NAME_OK' : 'NAME_FAIL');
    if (!nameOk) abstentionCodes.push('NAME_MISMATCH');
  }

  // Negation
  const claimNeg = NEGATION_RE.test(claimText);
  const sourceNeg = NEGATION_RE.test(sourceText);
  let negationOk: boolean | null = null;
  if (claimNeg || sourceNeg) {
    negationOk = claimNeg === sourceNeg;
    checkCodes.push(negationOk ? 'NEGATION_OK' : 'NEGATION_FAIL');
    if (!negationOk) abstentionCodes.push('NEGATION_INVERTED');
  }

  // Modality: claim asserts certainty while source hedges
  const claimModal = MODALITY_RE.test(claimText);
  const sourceModal = MODALITY_RE.test(sourceText);
  let modalityOk: boolean | null = null;
  if (sourceModal && !claimModal && !NEGATION_RE.test(claimText)) {
    // Source hedges; claim dropped the hedge → fail
    modalityOk = false;
    checkCodes.push('MODALITY_FAIL');
    abstentionCodes.push('MODALITY_UPGRADED');
  } else if (claimModal || sourceModal) {
    modalityOk = true;
    checkCodes.push('MODALITY_OK');
  }

  // Causality upgrade from correlation
  const claimCausal = CAUSAL_RE.test(claimText);
  const sourceCorr = CORRELATION_RE.test(sourceText);
  const sourceCausal = CAUSAL_RE.test(sourceText);
  let causalityOk: boolean | null = null;
  if (claimCausal && sourceCorr && !sourceCausal) {
    causalityOk = false;
    checkCodes.push('CAUSALITY_FAIL');
    abstentionCodes.push('CAUSALITY_UPGRADED');
  } else if (claimCausal || sourceCausal || sourceCorr) {
    causalityOk = true;
    checkCodes.push('CAUSALITY_OK');
  }

  const hardFail =
    num.ok === false ||
    dateOk === false ||
    nameOk === false ||
    negationOk === false ||
    modalityOk === false ||
    causalityOk === false;

  return {
    ok: !hardFail,
    checkCodes,
    abstentionCodes: [...new Set(abstentionCodes)],
    numericOk: num.ok,
    nameOk,
    dateOk,
    unitOk: num.ok === false && abstentionCodes.includes('UNIT_MISMATCH') ? false : num.ok,
    negationOk,
    modalityOk,
    causalityOk,
  };
}
