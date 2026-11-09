import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { MessageKey, Messages, PluralKey, TextKey } from './keys.ts';
import { de } from './locales/de.ts';
import { en } from './locales/en.ts';
import { es } from './locales/es.ts';
import { fr } from './locales/fr.ts';
import { ja } from './locales/ja.ts';
import { ptBR } from './locales/pt-BR.ts';
import { ru } from './locales/ru.ts';

export const LOCALES = ['en', 'ru', 'es', 'de', 'fr', 'ja', 'pt-BR'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  ru: 'Русский',
  es: 'Español',
  de: 'Deutsch',
  fr: 'Français',
  ja: '日本語',
  'pt-BR': 'Português (Brasil)',
};

export const MESSAGES: Record<Locale, Messages> = { en, ru, es, de, fr, ja, 'pt-BR': ptBR };

export type Params = Record<string, string | number>;

export function interpolate(template: string, params?: Params, locale: Locale = 'en'): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const v = params[name];
    if (v === undefined) return match;
    return typeof v === 'number' ? new Intl.NumberFormat(locale).format(v) : v;
  });
}

export function matchLocale(candidates: readonly string[]): Locale {
  for (const raw of candidates) {
    const c = raw.toLowerCase();
    const exact = LOCALES.find((l) => l.toLowerCase() === c);
    if (exact) return exact;
    const base = c.split('-')[0];
    if (base === 'pt') return 'pt-BR';
    const byBase = LOCALES.find((l) => l.toLowerCase() === base);
    if (byBase) return byBase;
  }
  return 'en';
}

export interface Translator {
  locale: Locale;
  t: (key: TextKey, params?: Params) => string;
  tp: (key: PluralKey, count: number, params?: Params) => string;
  /** Ordinal form, e.g. "11th generation", "11-е поколение", "第11世代". */
  ordinal: (key: PluralKey, n: number) => string;
  has: (key: string) => boolean;
  formatDate: (iso: string) => string;
}

export function createTranslator(locale: Locale): Translator {
  const messages = MESSAGES[locale];
  const plural = new Intl.PluralRules(locale);
  const ordinalRules = new Intl.PluralRules(locale, { type: 'ordinal' });
  const fallback = MESSAGES.en;
  return {
    locale,
    t: (key, params) => interpolate((messages[key] as string) ?? (fallback[key] as string) ?? key, params, locale),
    tp: (key, count, params) => {
      const forms = messages[key] as Messages[PluralKey];
      const cat = plural.select(count);
      const template = forms[cat] ?? forms.other;
      return interpolate(template, { count, ...params }, locale);
    },
    ordinal: (key, n) => {
      const forms = messages[key] as Messages[PluralKey];
      return interpolate(forms[ordinalRules.select(n)] ?? forms.other, { n: String(n) }, locale);
    },
    has: (key) => key in messages,
    formatDate: (iso) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`)),
  };
}

export const I18nContext = createContext<Translator>(createTranslator('en'));

export function useI18n(): Translator {
  return useContext(I18nContext);
}

export function isMessageKey(key: string): key is MessageKey {
  return key in en;
}

/** Localized generation label: numbered generations are translated, names stay as-is. */
export function generationLabel(device: { generation: string; ordinal?: number; year: number }, tr: Translator): string {
  return device.ordinal ? `${tr.ordinal('device.ordinal', device.ordinal)} (${device.year})` : device.generation;
}
