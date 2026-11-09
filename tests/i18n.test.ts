import { describe, expect, it } from 'vitest';
import { LOCALES, MESSAGES, createTranslator, interpolate, matchLocale } from '../src/i18n/index.ts';
import { en } from '../src/i18n/locales/en.ts';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const texts = (v: unknown): string[] => (typeof v === 'string' ? [v] : Object.values(v as Record<string, string>));

describe('locales', () => {
  for (const locale of LOCALES) {
    const messages = MESSAGES[locale] as Record<string, unknown>;

    it(`${locale} has exactly the English keys`, () => {
      expect(Object.keys(messages).sort()).toEqual(Object.keys(en).sort());
    });

    it(`${locale} keeps the same placeholders and has no empty strings`, () => {
      for (const [key, source] of Object.entries(en)) {
        const expected = placeholders(texts(source)[0]!);
        for (const text of texts(messages[key])) {
          expect(text.trim(), `${locale} ${key}`).not.toBe('');
          const found = placeholders(text);
          // Plural forms may omit {count} in rare languages, but must not invent new names.
          for (const p of found) expect(expected, `${locale} ${key} {${p}}`).toContain(p);
          for (const p of expected) if (p !== 'count') expect(found, `${locale} ${key} missing {${p}}`).toContain(p);
        }
      }
    });

    it(`${locale} provides every plural category it needs`, () => {
      const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
      const ordinals = new Intl.PluralRules(locale, { type: 'ordinal' }).resolvedOptions().pluralCategories;
      for (const [key, source] of Object.entries(en)) {
        if (typeof source === 'string') continue;
        if (key === 'device.ordinal') {
          const forms = messages[key] as Record<string, string>;
          for (const c of ordinals) expect(forms[c] ?? forms.other, `${locale} ordinal ${c}`).toBeTruthy();
          continue;
        }
        const forms = messages[key] as Record<string, string>;
        for (const c of categories) expect(forms[c] ?? forms.other, `${locale} ${key} ${c}`).toBeTruthy();
        if (locale === 'ru') for (const c of ['one', 'few', 'many']) expect(forms[c], `${key} ${c}`).toBeTruthy();
      }
    });
  }

  it('does not leave English sentences in translations', () => {
    // Keys whose value may legitimately equal English (format names, numbers, units).
    const same = /^(method\.|format\.|settings\.levels(16|4)$|preview\.size$|settings\.ditherFs$|settings\.ditherAtkinson$|adjust\.zoom$|device\.title$|settings\.targetDevice$|settings\.targetOriginal$|install\.sourceKind\.community$|install\.sources$|files\.title$|device\.colorColor$|device\.color$|status\.|settings\.color$|settings\.colorMode$|settings\.dither$|download\.title$|crop\.region$|settings\.contrast$|preview\.title$|app\.language$|device\.portrait$)/;
    for (const locale of LOCALES) {
      if (locale === 'en') continue;
      const m = MESSAGES[locale] as Record<string, unknown>;
      const identical = Object.entries(en)
        .filter(([k, v]) => typeof v === 'string' && v.length > 12 && m[k] === v && !same.test(k))
        .map(([k]) => k);
      expect(identical, locale).toEqual([]);
    }
  });
});

describe('translator', () => {
  it('interpolates and formats numbers per locale', () => {
    expect(interpolate('{a} and {b}', { a: 'x', b: 1234 }, 'de')).toBe('x and 1.234');
    expect(interpolate('{missing}', {})).toBe('{missing}');
  });

  it('selects Russian plural forms', () => {
    const t = createTranslator('ru');
    expect(t.tp('files.count', 1)).toBe('1 изображение');
    expect(t.tp('files.count', 3)).toBe('3 изображения');
    expect(t.tp('files.count', 5)).toBe('5 изображений');
    expect(t.tp('files.count', 21)).toBe('21 изображение');
  });

  it('formats ordinal generations', () => {
    const ordinal = (l: 'en' | 'ru' | 'fr' | 'ja' | 'de', n: number) => createTranslator(l).ordinal('device.ordinal', n);
    expect([1, 2, 3, 4, 11, 12, 21].map((n) => ordinal('en', n))).toEqual([
      '1st generation', '2nd generation', '3rd generation', '4th generation', '11th generation', '12th generation', '21st generation',
    ]);
    expect(ordinal('fr', 1)).toBe('1re génération');
    expect(ordinal('fr', 2)).toBe('2e génération');
    expect(ordinal('ru', 11)).toBe('11-е поколение');
    expect(ordinal('ja', 5)).toBe('第5世代');
    expect(ordinal('de', 12)).toBe('12. Generation');
  });

  it('matches browser languages', () => {
    expect(matchLocale(['pt-PT'])).toBe('pt-BR');
    expect(matchLocale(['de-AT', 'en'])).toBe('de');
    expect(matchLocale(['ja-JP'])).toBe('ja');
    expect(matchLocale(['zh-CN'])).toBe('en');
    expect(matchLocale(['pt-br'])).toBe('pt-BR');
  });
});
