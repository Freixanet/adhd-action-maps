import { describe, expect, it } from 'vitest';
import { space, type } from './design-tokens';
import {
  COMPOSER_LINE_HEIGHT,
  COMPOSER_REST_INPUT_HEIGHT,
  COMPOSER_REST_TEXT_PAD_BOTTOM,
  COMPOSER_REST_TEXT_PAD_TOP,
} from '../mobile/src/logic/composerText';

describe('composer rest text box', () => {
  it('keeps the input em-square on the pill center', () => {
    expect(COMPOSER_LINE_HEIGHT).toBe(type.input.fontSize);
    expect(COMPOSER_REST_TEXT_PAD_TOP + COMPOSER_LINE_HEIGHT / 2).toBe(
      COMPOSER_REST_INPUT_HEIGHT / 2
    );
  });

  it('adds descender room below the line without moving the em-square', () => {
    const inner =
      COMPOSER_REST_INPUT_HEIGHT -
      COMPOSER_REST_TEXT_PAD_TOP -
      COMPOSER_REST_TEXT_PAD_BOTTOM;
    expect(inner).toBe(COMPOSER_LINE_HEIGHT + space.stack.xs);
  });
});
