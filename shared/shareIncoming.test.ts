import { describe, expect, it } from 'vitest';
import { nextIncompleteReminderDate } from './incompleteReminderSchedule';
import { parseNucleoIncomingUrl } from './shareIncoming';

describe('parseNucleoIncomingUrl', () => {
  it('parses map deep links', () => {
    expect(parseNucleoIncomingUrl('nucleo://map/abc-123')).toEqual({
      kind: 'map',
      entryId: 'abc-123',
    });
  });

  it('parses import url shares', () => {
    expect(parseNucleoIncomingUrl('nucleo://import?url=https%3A%2F%2Fexample.com%2Fx')).toEqual({
      kind: 'url',
      url: 'https://example.com/x',
    });
  });
});

describe('nextIncompleteReminderDate', () => {
  it('schedules today 18:00 when before that hour', () => {
    const now = new Date('2026-08-20T10:00:00');
    const next = nextIncompleteReminderDate(now);
    expect(next.getHours()).toBe(18);
    expect(next.getDate()).toBe(20);
  });

  it('schedules tomorrow 18:00 after 21:00', () => {
    const now = new Date('2026-08-20T22:00:00');
    const next = nextIncompleteReminderDate(now);
    expect(next.getHours()).toBe(18);
    expect(next.getDate()).toBe(21);
  });
});
