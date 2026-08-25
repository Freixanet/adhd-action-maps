import { describe, expect, it } from 'vitest';
import {
  balanceTitleLines,
  resolveEditorialTitleLines,
  validateTitleLines,
} from './titleBalance';

describe('titleBalance', () => {
  it('accepts planner lines for cover and enemies demo', () => {
    expect(
      validateTitleLines('Deja de procrastinar y actúa', ['Deja de procrastinar', 'y actúa'], {
        maxLines: 3,
      }).ok
    ).toBe(true);
    expect(
      validateTitleLines(
        'Los 3 enemigos que frenan tus metas',
        ['Los 3 enemigos', 'que frenan tus metas'],
        { maxLines: 2 }
      ).ok
    ).toBe(true);
  });

  it('rejects orphan last line and trailing conjunction', () => {
    expect(
      validateTitleLines('Deja de procrastinar y actúa', ['Deja de procrastinar y', 'actúa'], {
        maxLines: 3,
      }).ok
    ).toBe(false);
    expect(
      validateTitleLines('Deja de procrastinar y actúa', ['Deja de procrastinar y', 'actúa'], {
        maxLines: 3,
      }).reasons.some((r) => r.includes('actúa') || r.includes('y'))
    ).toBe(true);
  });

  it('rejects concatenation mismatch', () => {
    expect(
      validateTitleLines('Hola mundo', ['Hola', 'tierra'], { maxLines: 2 }).ok
    ).toBe(false);
  });

  it('falls back to balanced lines keeping “y actúa” together', () => {
    const lines = balanceTitleLines('Deja de procrastinar y actúa', 3);
    expect(lines.length).toBe(2);
    expect(lines[1]).toBe('y actúa');
    expect(lines.some((l) => l.endsWith(' y'))).toBe(false);
  });

  it('resolve prefers valid planner lines', () => {
    const lines = resolveEditorialTitleLines(
      'Los 3 enemigos que frenan tus metas',
      ['Los 3 enemigos', 'que frenan tus metas'],
      { maxLines: 2 }
    );
    expect(lines).toEqual(['Los 3 enemigos', 'que frenan tus metas']);
  });

  it('resolve rebalances invalid planner lines', () => {
    const lines = resolveEditorialTitleLines(
      'Deja de procrastinar y actúa',
      ['Deja de procrastinar y', 'actúa'],
      { maxLines: 3, isCover: true }
    );
    expect(lines[lines.length - 1]).not.toBe('actúa');
    expect(lines.join(' ')).toBe('Deja de procrastinar y actúa');
  });
});
