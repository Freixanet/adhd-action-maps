/**
 * High-risk final-action guard.
 * A caution in adaptation never legitimizes a dangerous imperative instruction.
 */

import type { AdaptationRisk } from './types';
import { isHighRisk } from './policy';

const MEDICAL_DIRECT_CHANGE =
  /\b(cambi(a|ar)|ajust(a|ar)|sub(e|ir)|baj(a|ar)|modific(a|ar)|aument(a|ar)|reduc(e|ir)|par(a|ar)|suspend(e|er)|empez(a|ar)|inici(a|ar))\b.{0,40}\b(dosis|medicaci[oó]n|f[aá]rmaco|tratamiento|antidepresiv|estimulant)/i;

const MEDICAL_DIAGNOSE =
  /\b(diagn[oó]stic(a|ar)|automedic|prescrib)/i;

const LEGAL_DIRECT =
  /\b(firm(a|ar)|demand(a|ar)|rescind(e|ir)|demandar|contrato\s+sin\s+abogado)/i;

const FINANCIAL_DIRECT =
  /\b(inviert\w*|invers\w*|invert\w*|compra\s+(acciones|cripto)|pide\s+un\s+pr[eé]stamo|endeud)/i;

const PHYSICAL_DIRECT =
  /\b(levanta\s+peso|haz\s+ayuno\s+extremo|ignor(a|ar)\s+el\s+dolor|forz(a|ar)\s+la\s+lesi[oó]n)/i;

const CONSULT_OK =
  /^\s*(consult(a|ar)|habla\s+con|pide\s+cita|pregunta\s+a)\b/i;

export function isDangerousHighRiskInstruction(
  risk: AdaptationRisk,
  verbLedInstruction: string
): boolean {
  if (!isHighRisk(risk)) return false;
  const text = verbLedInstruction.trim();
  if (!text) return false;
  if (CONSULT_OK.test(text)) {
    return false;
  }
  switch (risk) {
    case 'high_medical':
    case 'high_psychological':
      return (
        MEDICAL_DIRECT_CHANGE.test(text) ||
        MEDICAL_DIAGNOSE.test(text) ||
        /\bcambia\s+la\s+dosis\b/i.test(text) ||
        /\bajusta\s+la\s+medicaci[oó]n\b/i.test(text)
      );
    case 'high_legal':
      return LEGAL_DIRECT.test(text);
    case 'high_financial':
      return FINANCIAL_DIRECT.test(text);
    case 'high_physical':
      return PHYSICAL_DIRECT.test(text);
    default:
      return false;
  }
}

export function safeConsultInstructionForRisk(risk: AdaptationRisk): string {
  switch (risk) {
    case 'high_legal':
      return 'Consulta con un profesional legal antes de tomar una decisión vinculante.';
    case 'high_financial':
      return 'Consulta con un asesor financiero cualificado antes de mover dinero.';
    case 'high_physical':
      return 'Consulta con un profesional de salud antes de forzar el cuerpo.';
    case 'high_psychological':
      return 'Consulta con tu profesional de salud mental antes de realizar cambios.';
    case 'high_medical':
    default:
      return 'Consulta con tu profesional antes de realizar cambios.';
  }
}

export function actionContradictsSourceBasis(
  verbLedInstruction: string,
  sourceBasis: string
): boolean {
  const action = verbLedInstruction.toLowerCase();
  const basis = sourceBasis.toLowerCase();
  // Source says consult / don't change alone, but action changes directly.
  if (
    /\b(consult|psiquiat|profesional|antes\s+de\s+cambiar)\b/i.test(basis) &&
    MEDICAL_DIRECT_CHANGE.test(action)
  ) {
    return true;
  }
  return false;
}
