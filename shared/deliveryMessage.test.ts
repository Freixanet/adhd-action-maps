import { describe, expect, it } from 'vitest';
import {
  buildDeliveryMessageFallback,
  isGenericDeliveryMessage,
  pickReadyAssistantMessage,
  pickReadyAssistantMessageFromMap,
} from './deliveryMessage';

describe('ready assistant delivery message', () => {
  it('keeps a specific model deliveryMessage', () => {
    const msg =
      'He pasado tu informe de onboarding de 37 páginas a 6 pasos: acceso, permisos y primer ticket.';
    expect(
      pickReadyAssistantMessage({
        deliveryMessage: msg,
        title: 'Onboarding',
        coreIdea: 'El primer ticket valida el acceso real',
      })
    ).toBe(msg);
  });

  it('rejects generic model copy and rebuilds from map facts', () => {
    const rebuilt = pickReadyAssistantMessage({
      deliveryMessage:
        'He convertido tu material en un Núcleo corto para usarlo sin releer la fuente.',
      title: 'Onboarding interno Q3',
      coreIdea: 'El primer ticket valida el acceso real',
      sourceLabel: 'Manual de onboarding Q3',
      stepCount: 6,
      stepNames: ['Acceso', 'Permisos', 'Primer ticket'],
    });
    expect(rebuilt.toLowerCase()).not.toContain('tu material');
    expect(rebuilt.toLowerCase()).not.toContain('sin releer la fuente');
    expect(rebuilt).toMatch(/onboarding|primer ticket|acceso/i);
  });

  it('flags interchangeable templates as generic', () => {
    expect(
      isGenericDeliveryMessage(
        'He condensado tu documento en un Núcleo centrado en la idea para que recuperes lo esencial sin releerlo entero.'
      )
    ).toBe(true);
  });

  it('builds fallback from concrete map fields only', () => {
    const msg = buildDeliveryMessageFallback({
      title: 'Atención como recurso limitado',
      coreIdea: 'La atención se agota con cada cambio de foco del entorno',
      sourceLabel: 'Notas de productividad',
      stepCount: 5,
      stepNames: ['Avisos', 'Contexto', 'Cierre'],
    });
    expect(msg).toMatch(/Notas de productividad|Avisos|atención/i);
    expect(msg.toLowerCase()).not.toContain('tu material');
  });

  it('reads deliveryMessage from the map when specific', () => {
    expect(
      pickReadyAssistantMessageFromMap({
        title: 'X',
        coreIdea: 'Y',
        coreSupport: 'Z',
        deliveryMessage:
          'Del PDF «Manual HVAC» saqué 4 pasos sobre filtros y caudal de aire.',
        tldr: [],
        steps: [{ id: '1', shortNav: 'Filtros', title: 'Filtros', time: '~1 min', content: [] }],
      })
    ).toMatch(/Manual HVAC|filtros/i);
  });
});
