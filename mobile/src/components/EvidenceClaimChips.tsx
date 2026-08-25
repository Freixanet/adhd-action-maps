/**
 * Epistemic / evidence rows bound to identifiable claims (progressive disclosure).
 * Each status sits next to claim text; links can open the exact fragment used.
 */

import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { ContentClaim, EvidenceLinkV1 } from '@shared/evidence/types';
import { EVIDENCE_UI_LABELS } from '@shared/evidence/policy';
import { useSourceViewer } from '../context/SourceViewerContext';
import { type } from '@shared/design-tokens';

function statusCopy(claim: ContentClaim): { label: string; detail: string; tone: 'ok' | 'warn' | 'info' } {
  switch (claim.presentationStatus) {
    case 'verified':
      return {
        label:
          claim.epistemicStatus === 'direct_source'
            ? 'Fuente directa'
            : 'Paráfrasis respaldada',
        detail: EVIDENCE_UI_LABELS.verified,
        tone: 'ok',
      };
    case 'qualified':
      return {
        label: 'Con matiz',
        detail: EVIDENCE_UI_LABELS.qualified,
        tone: 'warn',
      };
    case 'contradicted':
      return {
        label: 'Incompatible con la fuente',
        detail: EVIDENCE_UI_LABELS.contradicted,
        tone: 'warn',
      };
    case 'inference':
      return {
        label: 'Inferencia de Núcleo',
        detail: 'Adaptación o síntesis; no es cita directa de la fuente.',
        tone: 'info',
      };
    case 'insufficient':
    case 'degraded':
      return {
        label: 'No determinable',
        detail: EVIDENCE_UI_LABELS.insufficient,
        tone: 'warn',
      };
    default:
      return {
        label: 'Pendiente',
        detail: EVIDENCE_UI_LABELS.pending,
        tone: 'info',
      };
  }
}

function claimPreview(claim: ContentClaim): string {
  const raw = claim.presentationText || claim.text;
  return raw.length > 96 ? `${raw.slice(0, 93)}…` : raw;
}

export default function EvidenceClaimChips({
  claims,
  links,
  onOpenChunk,
}: {
  claims?: ContentClaim[] | null;
  links?: EvidenceLinkV1[] | null;
  onOpenChunk?: (chunkId: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { openCitation } = useSourceViewer();
  if (!claims?.length) return null;

  const critical = claims.filter((c) => c.criticality === 'critical').slice(0, 8);
  if (!critical.length) return null;

  const linksByClaim = new Map<string, EvidenceLinkV1[]>();
  for (const link of links ?? []) {
    const list = linksByClaim.get(link.contentNodeId) ?? [];
    list.push(link);
    linksByClaim.set(link.contentNodeId, list);
  }

  const openChunk = (chunkId: string) => {
    if (onOpenChunk) onOpenChunk(chunkId);
    else openCitation(chunkId, { label: 'Evidencia', locator: chunkId, chunkId });
  };

  return (
    <View className="mt-3 gap-2" accessibilityRole="summary">
      {critical.map((claim) => {
        const copy = statusCopy(claim);
        const claimLinks = linksByClaim.get(claim.id) ?? [];
        const openable = claimLinks.find((l) => Boolean(l.chunkId));
        const expanded = expandedId === claim.id;
        return (
          <Pressable
            key={claim.id}
            accessibilityRole="button"
            accessibilityLabel={`${copy.label}. ${claimPreview(claim)}. ${copy.detail}`}
            accessibilityHint={
              openable && onOpenChunk ? 'Toca dos veces para ver el fragmento de la fuente' : undefined
            }
            onPress={() => {
              setExpandedId(expanded ? null : claim.id);
            }}
            className={
              copy.tone === 'ok'
                ? 'rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-2'
                : copy.tone === 'warn'
                  ? 'rounded-2xl border border-amber-400/25 bg-amber-400/10 px-3 py-2'
                  : 'rounded-2xl border border-white/12 bg-white/6 px-3 py-2'
            }
          >
            <Text className="text-meta font-semibold uppercase tracking-wide text-body/70">
              {copy.label}
            </Text>
            <Text className="mt-0.5 text-label leading-5 text-body" numberOfLines={expanded ? 6 : 2}>
              {claimPreview(claim)}
            </Text>
            {expanded ? (
              <Text className="mt-1 text-meta leading-4 text-body/65">{copy.detail}</Text>
            ) : null}
            {expanded && openable ? (
              <Pressable
                onPress={() => openChunk(openable.chunkId)}
                accessibilityRole="button"
                accessibilityLabel="Ver fragmento de la fuente"
                className="mt-1 self-start"
              >
                <Text className="text-meta font-medium text-accent">Ver fragmento</Text>
              </Pressable>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
