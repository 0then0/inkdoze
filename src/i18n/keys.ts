import type { EnMessages } from './locales/en.ts';

export type MessageKey = keyof EnMessages;

type PluralForms = { other: string } & Partial<Record<Intl.LDMLPluralRule, string>>;

/** Shape every locale must satisfy: same keys, plural entries as plural objects. */
export type Messages = {
  [K in MessageKey]: EnMessages[K] extends string ? string : PluralForms;
};

export type PluralKey = {
  [K in MessageKey]: EnMessages[K] extends string ? never : K;
}[MessageKey];

export type TextKey = Exclude<MessageKey, PluralKey>;
