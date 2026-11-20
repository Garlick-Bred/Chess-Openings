import { describe, it, expect } from 'vitest';
import { cloveValue, cloveShortfall, formatCloves, validRating } from '../shared/cloves.js';

describe('cloves', () => {
  it('work at your level fills a whole clove, practice half', () => {
    expect(cloveValue({ success: true, mode: 'learn' })).toBe(1);
    expect(cloveValue({ success: true, mode: 'review' })).toBe(1);
    expect(cloveValue({ success: true, mode: 'deck' })).toBe(1);
    expect(cloveValue({ success: true, mode: 'extra' })).toBe(0.5);
    expect(cloveValue({ success: true, mode: 'learn', moveHints: 1 })).toBe(0.5);
    expect(cloveValue({ success: false, mode: 'learn' })).toBe(0);
    expect(cloveValue({ success: true, mode: 'extra', lessonReplay: true })).toBe(1);
  });
  it('explains a partial clove', () => {
    expect(cloveShortfall({ mode: 'extra' })).toMatch(/practice/);
    expect(cloveShortfall({ mode: 'learn' })).toBeNull();
  });
  it('formats and validates', () => {
    expect(formatCloves(0.5)).toBe('½');
    expect(formatCloves(1.25)).toBe('1¼');
    expect(validRating('1250')).toBe(1250);
    expect(validRating('50')).toBeNull();
  });
});
