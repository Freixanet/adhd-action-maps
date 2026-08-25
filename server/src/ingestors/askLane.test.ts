import { describe, expect, it } from 'vitest';
import { isAskLaneInput } from './askLane';

const QUESTION = '¿Qué es la memoria de trabajo?';

describe('textMode ask vs source', () => {
  it('same short question pasted as source never becomes ASK', () => {
    expect(
      isAskLaneInput({
        type: 'text',
        text: QUESTION,
        textMode: 'source',
      })
    ).toBe(false);
  });

  it('same text as ask becomes ASK', () => {
    expect(
      isAskLaneInput({
        type: 'text',
        text: QUESTION,
        textMode: 'ask',
      })
    ).toBe(true);
  });

  it('retry preserves explicit source mode', () => {
    const body = {
      type: 'text' as const,
      text: QUESTION,
      textMode: 'source' as const,
      sourceRequestId: '11111111-1111-4111-8111-111111111111',
    };
    expect(isAskLaneInput(body)).toBe(false);
    expect(isAskLaneInput({ ...body })).toBe(false);
  });

  it('legacy heuristic still asks for short questions without textMode', () => {
    expect(isAskLaneInput({ type: 'text', text: QUESTION })).toBe(true);
  });
});
