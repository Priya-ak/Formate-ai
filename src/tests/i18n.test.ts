import { describe, expect, it } from 'vitest';
import { hasKey, tx } from '@/services/i18n';
import { LANGUAGES } from '@/types/voice';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'src/services/i18n.ts'), 'utf8');
const enBlock = src.slice(src.indexOf('const en'), src.indexOf('const ta'));
const keys = [...enBlock.matchAll(/^\s*'?([\w.]+)'?:/gm)].map((m) => m[1]);

describe('translations', () => {
  it('every language has every English key', () => {
    expect(keys.length).toBeGreaterThan(90);
    for (const l of LANGUAGES) for (const k of keys) expect(hasKey(l.code, k), `${l.code}:${k}`).toBe(true);
  });
  it('keeps {placeholders} intact in every language', () => {
    for (const l of LANGUAGES) {
      const r = tx(l.code, 'review.intro', { filled: 4, attention: 2 });
      expect(r.text).not.toMatch(/\{\w+\}/);
      expect(r.fallback).toBe(false);
    }
  });
});
