import { SRC, bigmeProduct, booxProduct, koboProduct, pocketbookProduct, secondary, tolinoProduct } from './sources.ts';
import type { InstallMethodId } from './install.ts';
import type { Brand, Device, InstallStep, Source } from './types.ts';

const VERIFIED = '2026-11-10';

interface Spec {
  id: string;
  model: string;
  generation: string;
  ordinal?: number;
  year: number;
  w: number;
  h: number;
  color?: boolean;
  aliases?: string[];
  sources: Source[];
  install: InstallMethodId[];
  notes?: InstallStep[];
}

function brand(name: Brand, specs: Spec[]): Device[] {
  return specs.map((s) => ({
    id: s.id,
    brand: name,
    model: s.model,
    generation: s.generation,
    ...(s.ordinal ? { ordinal: s.ordinal } : {}),
    year: s.year,
    aliases: s.aliases ?? [],
    resolution: { width: s.w, height: s.h },
    color: s.color ?? false,
    sources: s.sources,
    verified: VERIFIED,
    install: s.install,
    ...(s.notes ? { notes: s.notes } : {}),
  }));
}

// ---------------------------------------------------------------------------
// Xteink: panel sizes from the FreeInk SDK that CrossPoint builds against.
// ---------------------------------------------------------------------------
const xteink = brand('Xteink', [
  {
    id: 'xteink-x4',
    model: 'X4',
    generation: 'X4 (2025)',
    year: 2025,
    w: 480,
    h: 800,
    aliases: ['x4', 'xteink 4.3'],
    sources: [SRC.freeinkBoard, SRC.freeinkDisplay, SRC.crosspointGuide],
    install: ['crosspoint', 'xteink-stock-community'],
  },
  {
    id: 'xteink-x4-classic',
    model: 'X4 Classic',
    generation: 'X4 Classic / X4C',
    year: 2026,
    w: 480,
    h: 800,
    aliases: ['x4c', 'x4 classic'],
    sources: [SRC.freeinkX4C, SRC.freeinkBoard],
    install: ['crosspoint', 'xteink-stock-community'],
  },
  {
    id: 'xteink-x4-pro',
    model: 'X4 Pro',
    generation: 'X4 Pro (2026)',
    year: 2026,
    w: 480,
    h: 800,
    aliases: ['x4pro', 'x4 pro touch'],
    sources: [SRC.freeinkX4Pro, SRC.freeinkBoard],
    install: ['crosspoint', 'xteink-stock-official'],
  },
  {
    id: 'xteink-x3',
    model: 'X3',
    generation: 'X3 (3.7")',
    year: 2025,
    w: 528,
    h: 792,
    aliases: ['x3', 'xteink 3.7'],
    sources: [SRC.freeinkDisplay, SRC.crosspointGuide],
    install: ['crosspoint', 'xteink-stock-community'],
  },
]);

// ---------------------------------------------------------------------------
// BOOX: resolutions from the official BOOX store spec tables.
// Colour models list the black-and-white grid; colour content renders at half.
// ---------------------------------------------------------------------------
const boox = brand('BOOX', [
  { id: 'boox-picco', model: 'Picco', generation: 'Picco (3.97")', year: 2026, w: 480, h: 800, aliases: ['onyx picco', 'boox tiles'], sources: [booxProduct('picco', 'Picco'), SRC.crosspointRelease], install: ['crosspoint'] },
  { id: 'boox-palma', model: 'Palma', generation: 'Palma (2023)', year: 2023, w: 824, h: 1648, sources: [booxProduct('palma', 'Palma')], install: ['boox-screensaver'] },
  { id: 'boox-palma-2', model: 'Palma 2', generation: 'Palma 2 (2024)', year: 2024, w: 824, h: 1648, sources: [booxProduct('palma2', 'Palma 2')], install: ['boox-screensaver'] },
  { id: 'boox-palma-2-pro', model: 'Palma 2 Pro', generation: 'Palma 2 Pro (Kaleido 3)', year: 2025, w: 824, h: 1648, color: true, sources: [booxProduct('palma2pro', 'Palma 2 Pro')], install: ['boox-screensaver'] },
  { id: 'boox-palma-3', model: 'Palma 3', generation: 'Palma 3', year: 2026, w: 824, h: 1648, sources: [booxProduct('palma3', 'Palma 3')], install: ['boox-screensaver'] },
  { id: 'boox-poke-5', model: 'Poke5', generation: 'Poke 5 (2023)', year: 2023, w: 1072, h: 1448, aliases: ['poke 5'], sources: [booxProduct('poke5', 'Poke5')], install: ['boox-screensaver'] },
  { id: 'boox-go-6', model: 'Go 6', generation: 'Go 6 (2024)', year: 2024, w: 1072, h: 1448, sources: [booxProduct('go6', 'Go 6')], install: ['boox-screensaver'] },
  { id: 'boox-go-6-gen2', model: 'Go 6 (Gen II)', generation: 'Go 6 Gen II', year: 2026, w: 1072, h: 1448, aliases: ['go 6 gen 2', 'go6 gen2'], sources: [booxProduct('go6gen2', 'Go 6 (Gen II)')], install: ['boox-screensaver'] },
  { id: 'boox-leaf-2', model: 'Leaf2', generation: 'Leaf 2 (2021)', year: 2021, w: 1264, h: 1680, aliases: ['leaf 2'], sources: [booxProduct('leaf2', 'Leaf2')], install: ['boox-screensaver'] },
  { id: 'boox-page', model: 'Page', generation: 'Page (2023)', year: 2023, w: 1264, h: 1680, sources: [booxProduct('page', 'Page')], install: ['boox-screensaver'] },
  { id: 'boox-go-7', model: 'Go 7', generation: 'Go 7 (2025)', year: 2025, w: 1264, h: 1680, sources: [booxProduct('go7', 'Go 7')], install: ['boox-screensaver'] },
  { id: 'boox-go-color-7', model: 'Go Color 7', generation: 'Go Color 7 (2024)', year: 2024, w: 1264, h: 1680, color: true, sources: [booxProduct('gocolor7', 'Go Color 7')], install: ['boox-screensaver'] },
  { id: 'boox-go-color-7-gen2', model: 'Go Color 7 (Gen II)', generation: 'Go Color 7 Gen II', year: 2025, w: 1264, h: 1680, color: true, aliases: ['go color 7 gen 2'], sources: [booxProduct('gocolor7-gen2', 'Go Color 7 (Gen II)')], install: ['boox-screensaver'] },
  { id: 'boox-nova-air-2', model: 'Nova Air2', generation: 'Nova Air 2 (2022)', year: 2022, w: 1404, h: 1872, aliases: ['nova air 2'], sources: [booxProduct('novaair2', 'Nova Air2')], install: ['boox-screensaver'] },
  { id: 'boox-tab-mini-c', model: 'Tab Mini C', generation: 'Tab Mini C (2023)', year: 2023, w: 1404, h: 1872, color: true, sources: [booxProduct('tabminic', 'Tab Mini C')], install: ['boox-screensaver'] },
  { id: 'boox-note-mini-c', model: 'Note Mini C', generation: 'Note Mini C', year: 2026, w: 1536, h: 2048, color: true, sources: [booxProduct('noteminic', 'Note Mini C')], install: ['boox-screensaver'] },
  { id: 'boox-note-air-3', model: 'Note Air3', generation: 'Note Air 3 (2023)', year: 2023, w: 1404, h: 1872, aliases: ['note air 3'], sources: [booxProduct('boox-note-air3', 'Note Air3')], install: ['boox-screensaver'], notes: [{ key: 'note.boox.noteAir3' }] },
  { id: 'boox-note-air-3-c', model: 'Note Air3 C', generation: 'Note Air 3 C (Kaleido 3, 2023)', year: 2023, w: 1860, h: 2480, color: true, aliases: ['note air 3c'], sources: [booxProduct('noteair3', 'Note Air3 C')], install: ['boox-screensaver'], notes: [{ key: 'note.boox.noteAir3' }] },
  { id: 'boox-note-air-4-c', model: 'Note Air4 C', generation: 'Note Air 4 C (2024)', year: 2024, w: 1860, h: 2480, color: true, aliases: ['note air 4c'], sources: [booxProduct('noteair4c', 'Note Air4 C')], install: ['boox-screensaver'] },
  { id: 'boox-note-air-5-c', model: 'Note Air5 C', generation: 'Note Air 5 C (2025)', year: 2025, w: 1860, h: 2480, color: true, aliases: ['note air 5c'], sources: [booxProduct('noteair5c', 'Note Air5 C')], install: ['boox-screensaver'] },
  { id: 'boox-note-air-6-c', model: 'Note Air6 C', generation: 'Note Air 6 C (2026)', year: 2026, w: 1860, h: 2480, color: true, aliases: ['note air 6c'], sources: [booxProduct('noteair6c', 'Note Air6 C')], install: ['boox-screensaver'] },
  { id: 'boox-go-10-3', model: 'Go 10.3', generation: 'Go 10.3 (2024)', year: 2024, w: 1860, h: 2480, sources: [booxProduct('go103', 'Go 10.3')], install: ['boox-screensaver'] },
  { id: 'boox-go-10-3-gen2', model: 'Go 10.3 (Gen II)', generation: 'Go 10.3 Gen II', year: 2025, w: 1860, h: 2480, aliases: ['go 10.3 gen 2'], sources: [booxProduct('go103gen2', 'Go 10.3 (Gen II)')], install: ['boox-screensaver'] },
  { id: 'boox-go-10-3-gen2-lumi', model: 'Go 10.3 (Gen II) Lumi', generation: 'Go 10.3 Gen II Lumi', year: 2025, w: 1860, h: 2480, aliases: ['go 10.3 lumi'], sources: [booxProduct('go103gen2lumi', 'Go 10.3 (Gen II) Lumi')], install: ['boox-screensaver'] },
  { id: 'boox-tab-ultra', model: 'Tab Ultra', generation: 'Tab Ultra (2022)', year: 2022, w: 1404, h: 1872, sources: [booxProduct('tab', 'Tab Ultra')], install: ['boox-screensaver'] },
  { id: 'boox-tab-ultra-c', model: 'Tab Ultra C', generation: 'Tab Ultra C (2023)', year: 2023, w: 1860, h: 2480, color: true, sources: [booxProduct('tabultrac', 'Tab Ultra C')], install: ['boox-screensaver'] },
  { id: 'boox-tab-ultra-c-pro', model: 'Tab Ultra C Pro', generation: 'Tab Ultra C Pro (2024)', year: 2024, w: 1860, h: 2480, color: true, sources: [booxProduct('tabultracpro', 'Tab Ultra C Pro')], install: ['boox-screensaver'] },
  { id: 'boox-tab-x', model: 'Tab X', generation: 'Tab X (13.3", 2022)', year: 2022, w: 1650, h: 2200, sources: [booxProduct('tabx', 'Tab X')], install: ['boox-screensaver'] },
  { id: 'boox-tab-x-c', model: 'Tab X C', generation: 'Tab X C (13.3" Kaleido 3, 2025)', year: 2025, w: 2400, h: 3200, color: true, sources: [booxProduct('tabxc', 'Tab X C')], install: ['boox-screensaver'] },
  { id: 'boox-note-max', model: 'Note Max', generation: 'Note Max (13.3", 2024)', year: 2024, w: 2400, h: 3200, sources: [booxProduct('notemax', 'Note Max')], install: ['boox-screensaver'] },
]);

// ---------------------------------------------------------------------------
// Kindle: Amazon publishes ppi but not pixel grids. Values come from KCC device
// profiles, corrected against device screenshots where marketing figures differ.
// ---------------------------------------------------------------------------
const KINDLE_COVER: InstallMethodId[] = ['kindle-cover', 'koreader-kindle'];
const KINDLE_OLD: InstallMethodId[] = ['koreader-kindle'];
const kindle = brand('Kindle', [
  { id: 'kindle-keyboard', model: 'Kindle Keyboard', generation: '3rd generation (2010)', ordinal: 3, year: 2010, w: 600, h: 800, aliases: ['kindle 3', 'k3'], sources: [SRC.kccProfiles], install: KINDLE_OLD },
  { id: 'kindle-4', model: 'Kindle 4', generation: '4th generation (2011)', ordinal: 4, year: 2011, w: 600, h: 800, aliases: ['k4', 'kindle non-touch'], sources: [SRC.kccProfiles], install: KINDLE_OLD },
  { id: 'kindle-touch', model: 'Kindle Touch', generation: '4th generation (2011)', ordinal: 4, year: 2011, w: 600, h: 800, aliases: ['kt'], sources: [SRC.kccProfiles], install: KINDLE_OLD },
  { id: 'kindle-5', model: 'Kindle 5', generation: '5th generation (2012)', ordinal: 5, year: 2012, w: 600, h: 800, aliases: ['k5'], sources: [SRC.kccProfiles], install: KINDLE_OLD },
  { id: 'kindle-7', model: 'Kindle 7', generation: '7th generation (2014)', ordinal: 7, year: 2014, w: 600, h: 800, aliases: ['kindle basic', 'kt2'], sources: [SRC.kccProfiles], install: KINDLE_OLD },
  { id: 'kindle-8', model: 'Kindle 8', generation: '8th generation (2016)', ordinal: 8, year: 2016, w: 600, h: 800, aliases: ['kt3', 'kindle basic 2'], sources: [SRC.kccProfiles], install: KINDLE_COVER },
  { id: 'kindle-10', model: 'Kindle 10', generation: '10th generation (2019)', ordinal: 10, year: 2019, w: 600, h: 800, aliases: ['kt4', 'kindle 2019'], sources: [SRC.kccProfiles], install: KINDLE_COVER },
  { id: 'kindle-11', model: 'Kindle 11', generation: '11th generation (2022)', ordinal: 11, year: 2022, w: 1072, h: 1448, aliases: ['kt5', 'kindle 2022'], sources: [SRC.kccProfiles], install: KINDLE_COVER },
  { id: 'kindle-2024', model: 'Kindle (2024)', generation: '11th generation (2024)', ordinal: 11, year: 2024, w: 1072, h: 1448, aliases: ['kindle 2024', 'basic kindle 2024'], sources: [SRC.kccProfiles], install: KINDLE_COVER },
  { id: 'kindle-paperwhite-1', model: 'Paperwhite', generation: '5th generation (2012)', ordinal: 5, year: 2012, w: 758, h: 1024, aliases: ['pw1', 'paperwhite 1'], sources: [SRC.kccProfiles], install: KINDLE_OLD },
  { id: 'kindle-paperwhite-2', model: 'Paperwhite', generation: '6th generation (2013)', ordinal: 6, year: 2013, w: 758, h: 1024, aliases: ['pw2', 'paperwhite 2'], sources: [SRC.kccProfiles], install: KINDLE_OLD },
  { id: 'kindle-paperwhite-3', model: 'Paperwhite', generation: '7th generation (2015)', ordinal: 7, year: 2015, w: 1072, h: 1448, aliases: ['pw3', 'paperwhite 3'], sources: [SRC.kccProfiles], install: KINDLE_COVER },
  { id: 'kindle-paperwhite-4', model: 'Paperwhite', generation: '10th generation (2018)', ordinal: 10, year: 2018, w: 1072, h: 1448, aliases: ['pw4', 'paperwhite 4'], sources: [SRC.kccProfiles], install: KINDLE_COVER },
  { id: 'kindle-paperwhite-5', model: 'Paperwhite', generation: '11th generation (2021)', ordinal: 11, year: 2021, w: 1236, h: 1648, aliases: ['pw5', 'paperwhite 5', 'paperwhite signature edition 2021', 'kids 2021'], sources: [SRC.kccProfiles], install: KINDLE_COVER },
  {
    id: 'kindle-paperwhite-6',
    model: 'Paperwhite',
    generation: '12th generation (2024)', ordinal: 12,
    year: 2024,
    w: 1272,
    h: 1696,
    aliases: ['pw6', 'paperwhite 6', 'paperwhite 2024', 'paperwhite signature edition 2024'],
    sources: [SRC.kccProfiles, SRC.kccPw6Fix, SRC.pw6Marketing],
    install: KINDLE_COVER,
    notes: [{ key: 'note.kindle.marketingResolution', params: { marketing: '1264 × 1680' } }],
  },
  { id: 'kindle-voyage', model: 'Voyage', generation: '7th generation (2014)', ordinal: 7, year: 2014, w: 1072, h: 1448, aliases: ['kv'], sources: [SRC.kccProfiles], install: KINDLE_COVER },
  { id: 'kindle-oasis-1', model: 'Oasis', generation: '8th generation (2016)', ordinal: 8, year: 2016, w: 1072, h: 1448, aliases: ['oasis 1', 'ko1'], sources: [SRC.kccProfiles], install: KINDLE_COVER },
  { id: 'kindle-oasis-2', model: 'Oasis', generation: '9th generation (2017)', ordinal: 9, year: 2017, w: 1264, h: 1680, aliases: ['oasis 2', 'ko2'], sources: [SRC.kccProfiles], install: KINDLE_COVER },
  { id: 'kindle-oasis-3', model: 'Oasis', generation: '10th generation (2019)', ordinal: 10, year: 2019, w: 1264, h: 1680, aliases: ['oasis 3', 'ko3'], sources: [SRC.kccProfiles], install: KINDLE_COVER },
  {
    id: 'kindle-colorsoft',
    model: 'Colorsoft',
    generation: '1st generation (2024)', ordinal: 1,
    year: 2024,
    w: 1272,
    h: 1696,
    color: true,
    aliases: ['colorsoft signature edition', 'kcs'],
    sources: [SRC.kccProfiles, SRC.kccPw6Fix],
    install: KINDLE_COVER,
    notes: [{ key: 'note.kindle.marketingResolution', params: { marketing: '1264 × 1680' } }],
  },
  { id: 'kindle-scribe', model: 'Scribe', generation: '1st generation (2022)', ordinal: 1, year: 2022, w: 1860, h: 2480, aliases: ['ks', 'scribe 1'], sources: [SRC.kccProfiles], install: KINDLE_COVER },
  { id: 'kindle-scribe-2024', model: 'Scribe', generation: '2nd generation (2024)', ordinal: 2, year: 2024, w: 1860, h: 2480, aliases: ['scribe 2', 'scribe 2024'], sources: [SRC.kccProfiles], install: KINDLE_COVER },
  { id: 'kindle-scribe-3', model: 'Scribe', generation: '3rd generation (2025)', ordinal: 3, year: 2025, w: 1986, h: 2648, aliases: ['scribe 3', 'ks3'], sources: [SRC.kccProfiles], install: KINDLE_COVER },
  { id: 'kindle-scribe-colorsoft', model: 'Scribe Colorsoft', generation: '1st generation (2025)', ordinal: 1, year: 2025, w: 1986, h: 2648, color: true, aliases: ['kscs'], sources: [SRC.kccProfiles], install: KINDLE_COVER },
]);

// ---------------------------------------------------------------------------
// Kobo: current models from kobo.com technical specs; earlier generations from
// KCC device profiles.
// ---------------------------------------------------------------------------
const KOBO: InstallMethodId[] = ['kobo-cover', 'kobo-screensaver-folder', 'koreader-kobo'];
const kobo = brand('Kobo', [
  { id: 'kobo-aura', model: 'Aura', generation: 'Aura (2013)', year: 2013, w: 758, h: 1024, aliases: ['n514'], sources: [SRC.kccProfiles], install: ['koreader-kobo'] },
  { id: 'kobo-aura-hd', model: 'Aura HD', generation: 'Aura HD (2013)', year: 2013, w: 1080, h: 1440, aliases: ['n204b'], sources: [SRC.kccProfiles], install: ['koreader-kobo'] },
  { id: 'kobo-aura-h2o', model: 'Aura H2O', generation: 'Aura H2O (2014)', year: 2014, w: 1080, h: 1430, aliases: ['n250'], sources: [SRC.kccProfiles], install: ['koreader-kobo'] },
  { id: 'kobo-glo-hd', model: 'Glo HD', generation: 'Glo HD (2015)', year: 2015, w: 1072, h: 1448, aliases: ['n437'], sources: [SRC.kccProfiles], install: ['koreader-kobo'] },
  { id: 'kobo-aura-one', model: 'Aura ONE', generation: 'Aura ONE (2016)', year: 2016, w: 1404, h: 1872, aliases: ['aura one', 'n709'], sources: [SRC.kccProfiles], install: KOBO },
  { id: 'kobo-clara-hd', model: 'Clara HD', generation: 'Clara HD (2018)', year: 2018, w: 1072, h: 1448, aliases: ['n249'], sources: [SRC.kccProfiles], install: KOBO },
  { id: 'kobo-forma', model: 'Forma', generation: 'Forma (2018)', year: 2018, w: 1440, h: 1920, aliases: ['n782'], sources: [SRC.kccProfiles], install: KOBO },
  { id: 'kobo-libra-h2o', model: 'Libra H2O', generation: 'Libra H2O (2019)', year: 2019, w: 1264, h: 1680, aliases: ['libra 1', 'n873'], sources: [SRC.kccProfiles], install: KOBO },
  { id: 'kobo-nia', model: 'Nia', generation: 'Nia (2020)', year: 2020, w: 758, h: 1024, aliases: ['n306'], sources: [SRC.kccProfiles], install: KOBO },
  { id: 'kobo-elipsa', model: 'Elipsa', generation: 'Elipsa (2021)', year: 2021, w: 1404, h: 1872, aliases: ['n604'], sources: [SRC.kccProfiles], install: KOBO },
  { id: 'kobo-sage', model: 'Sage', generation: 'Sage (2021)', year: 2021, w: 1440, h: 1920, aliases: ['n778'], sources: [koboProduct('kobo-sage', 'Sage'), SRC.kccProfiles], install: KOBO },
  { id: 'kobo-libra-2', model: 'Libra 2', generation: 'Libra 2 (2021)', year: 2021, w: 1264, h: 1680, aliases: ['n418'], sources: [SRC.kccProfiles], install: KOBO },
  { id: 'kobo-clara-2e', model: 'Clara 2E', generation: 'Clara 2E (2022)', year: 2022, w: 1072, h: 1448, aliases: ['n506'], sources: [SRC.kccProfiles], install: KOBO },
  { id: 'kobo-elipsa-2e', model: 'Elipsa 2E', generation: 'Elipsa 2E (2023)', year: 2023, w: 1404, h: 1872, aliases: ['n605'], sources: [koboProduct('kobo-elipsa-2e', 'Elipsa 2E')], install: KOBO },
  { id: 'kobo-clara-bw', model: 'Clara BW', generation: 'Clara BW (2024)', year: 2024, w: 1072, h: 1448, aliases: ['n365'], sources: [koboProduct('kobo-clara-bw', 'Clara BW')], install: KOBO },
  { id: 'kobo-clara-colour', model: 'Clara Colour', generation: 'Clara Colour (2024)', year: 2024, w: 1072, h: 1448, color: true, aliases: ['clara color', 'n367'], sources: [koboProduct('kobo-clara-colour', 'Clara Colour')], install: KOBO },
  { id: 'kobo-libra-colour', model: 'Libra Colour', generation: 'Libra Colour (2024)', year: 2024, w: 1264, h: 1680, color: true, aliases: ['libra color', 'n428'], sources: [koboProduct('kobo-libra-colour', 'Libra Colour')], install: KOBO },
]);

// ---------------------------------------------------------------------------
// PocketBook: pocketbook.ch specification tables.
// ---------------------------------------------------------------------------
const pocketbook = brand('PocketBook', [
  { id: 'pocketbook-verse', model: 'Verse', generation: 'Verse (629, 2023)', year: 2023, w: 758, h: 1024, aliases: ['pb629'], sources: [pocketbookProduct('e-readers/verse-brightblue-ch', 'Verse')], install: [] },
  { id: 'pocketbook-verse-lite', model: 'Verse Lite', generation: 'Verse Lite', year: 2025, w: 758, h: 1024, sources: [pocketbookProduct('e-readers/pocketbook-verse-lite-ch', 'Verse Lite')], install: [] },
  { id: 'pocketbook-verse-pro', model: 'Verse Pro', generation: 'Verse Pro (634, 2023)', year: 2023, w: 1072, h: 1448, aliases: ['pb634'], sources: [pocketbookProduct('e-readers/pocketbook-verse-pro-azure-ch', 'Verse Pro'), SRC.pocketbookFw69], install: ['pocketbook-logo'] },
  { id: 'pocketbook-verse-pro-color', model: 'Verse Pro Color', generation: 'Verse Pro Color (634K3, 2024)', year: 2024, w: 1072, h: 1448, color: true, aliases: ['pb634k3'], sources: [pocketbookProduct('color-e-readers/pocketbook-verse-pro-color-ch', 'Verse Pro Color')], install: [] },
  { id: 'pocketbook-verta', model: 'Verta', generation: 'Verta', year: 2025, w: 1072, h: 1448, sources: [pocketbookProduct('e-readers/pocketbook-verta-ch', 'Verta')], install: [] },
  { id: 'pocketbook-verta-color', model: 'Verta Color', generation: 'Verta Color', year: 2025, w: 1072, h: 1448, color: true, sources: [pocketbookProduct('color-e-readers/pocketbook-verta-color-ch', 'Verta Color')], install: [] },
  { id: 'pocketbook-era-color', model: 'Era Color', generation: 'Era Color (700K3, 2024)', year: 2024, w: 1264, h: 1680, color: true, aliases: ['pb700k3'], sources: [pocketbookProduct('color-e-readers/pocketbook-era-color-ch', 'Era Color')], install: [] },
  { id: 'pocketbook-era-lite', model: 'Era Lite', generation: 'Era Lite', year: 2025, w: 1264, h: 1680, sources: [pocketbookProduct('e-readers/pocketbook-era-lite-ch', 'Era Lite')], install: [] },
  { id: 'pocketbook-inkpad-4', model: 'InkPad 4', generation: 'InkPad 4 (743G, 2023)', year: 2023, w: 1404, h: 1872, aliases: ['pb743g'], sources: [pocketbookProduct('e-readers/inkpad-4-ch', 'InkPad 4')], install: [] },
  { id: 'pocketbook-inkpad-color-3', model: 'InkPad Color 3', generation: 'InkPad Color 3 (743K3, 2023)', year: 2023, w: 1404, h: 1872, color: true, aliases: ['pb743k3'], sources: [pocketbookProduct('color-e-readers/pocketbook-inkpad-color-3-ch', 'InkPad Color 3')], install: [] },
  { id: 'pocketbook-color-note', model: 'Color Note', generation: 'Color Note (10.3")', year: 2025, w: 1404, h: 1872, color: true, sources: [pocketbookProduct('e-notes/pocketbook-color-note-ch', 'Color Note')], install: [] },
  { id: 'pocketbook-inkpad-one', model: 'InkPad One', generation: 'InkPad One (10.3")', year: 2025, w: 1404, h: 1872, sources: [pocketbookProduct('e-notes/pocketbook-inkpad-one-ch', 'InkPad One')], install: [] },
  { id: 'pocketbook-inkpad-eo', model: 'InkPad Eo', generation: 'InkPad Eo (10.3" Kaleido 3)', year: 2024, w: 1860, h: 2480, color: true, sources: [pocketbookProduct('e-notes/pocketbook-inkpad-eo-ch', 'InkPad Eo')], install: [] },
]);

// ---------------------------------------------------------------------------
// tolino: current models from mytolino.com; previous generations from secondary
// sources only.
// ---------------------------------------------------------------------------
const tolino = brand('tolino', [
  { id: 'tolino-shine-5', model: 'shine', generation: '5th generation (2024)', ordinal: 5, year: 2024, w: 1072, h: 1448, aliases: ['shine 5'], sources: [tolinoProduct('tolino-shine-5-generation', 'shine 5th generation')], install: ['tolino-cover'] },
  { id: 'tolino-shine-color', model: 'shine color', generation: 'shine color (2024)', year: 2024, w: 1072, h: 1448, color: true, sources: [tolinoProduct('tolino-shine-color', 'shine color')], install: ['tolino-cover'] },
  { id: 'tolino-vision-color', model: 'vision color', generation: 'vision color (2024)', year: 2024, w: 1264, h: 1680, color: true, sources: [tolinoProduct('tolino-vision-color', 'vision color')], install: ['tolino-cover'] },
  {
    id: 'tolino-vision-5',
    model: 'vision 5',
    generation: 'vision 5 (2019)',
    year: 2019,
    w: 1264,
    h: 1680,
    sources: [secondary('Galaxus: tolino page 2, shine 3, vision 5 and epos 2 tested', 'https://www.galaxus.de/en/page/tolino-page-2-shine-3-vision-5-and-epos-2-tested-literary-quartet-15398'), SRC.tolinoLegacyFaq],
    install: ['tolino-own-picture'],
  },
  {
    id: 'tolino-epos-2',
    model: 'epos 2',
    generation: 'epos 2 (2019)',
    year: 2019,
    w: 1440,
    h: 1920,
    sources: [secondary('Galaxus: tolino eReaders listing (epos 2 1440 x 1920)', 'https://www.galaxus.de/en/s1/producttype/toplist/brand/ereaders-1138/tolino-9069')],
    install: ['tolino-own-picture'],
  },
]);

// ---------------------------------------------------------------------------
// NOOK: Barnes & Noble publishes 300 ppi but not pixel grids for recent models.
// ---------------------------------------------------------------------------
const nook = brand('NOOK', [
  { id: 'nook-simple-touch', model: 'Simple Touch', generation: 'Simple Touch, Simple Touch GlowLight (2011–2012)', year: 2011, w: 600, h: 800, aliases: ['bnrv300', 'nst', 'simple touch glowlight'], sources: [SRC.nookSimpleTouch, SRC.nookGlowLightCustomize], install: ['nook-screensavers'] },
  { id: 'nook-glowlight-2013', model: 'GlowLight', generation: 'GlowLight (2013)', year: 2013, w: 758, h: 1024, aliases: ['bnrv500'], sources: [SRC.nookGlowLight2013, secondary('MobileRead Wiki: Nook GlowLight', 'https://wiki.mobileread.com/wiki/Nook_GlowLight')], install: ['nook-screensavers'] },
  { id: 'nook-glowlight-4', model: 'GlowLight 4', generation: 'GlowLight 4 (2021)', year: 2021, w: 1072, h: 1448, aliases: ['bnrv1100'], sources: [SRC.nookCompare, secondary('Comparisontabl.es: NOOK GlowLight 4 vs 4 Plus', 'https://comparisontabl.es/e-readers/nook-glowlight-4-vs-nook-glowlight-4-plus')], install: [] },
  { id: 'nook-glowlight-4-plus', model: 'GlowLight 4 Plus', generation: 'GlowLight 4 Plus (7.8", 2023)', year: 2023, w: 1404, h: 1872, sources: [SRC.nookCompare, secondary('Good e-Reader: NOOK GlowLight 4 Plus', 'https://goodereader.com/blog/?p=366763')], install: [] },
]);

// ---------------------------------------------------------------------------
// Supernote: Ratta lists per-model image sizes for templates.
// ---------------------------------------------------------------------------
const supernote = brand('Supernote', [
  { id: 'supernote-a5x', model: 'A5 X', generation: 'A5 X (2020)', year: 2020, w: 1404, h: 1872, sources: [SRC.supernoteTemplates], install: ['supernote-screensaver'] },
  { id: 'supernote-a6x', model: 'A6 X', generation: 'A6 X (2020)', year: 2020, w: 1404, h: 1872, sources: [SRC.supernoteTemplates], install: ['supernote-screensaver'] },
  { id: 'supernote-nomad', model: 'Nomad', generation: 'A6 X2 Nomad (2023)', year: 2023, w: 1404, h: 1872, aliases: ['a6 x2', 'a6x2'], sources: [SRC.supernoteTemplates], install: ['supernote-screensaver'] },
  { id: 'supernote-manta', model: 'Manta', generation: 'A5 X2 Manta (2024)', year: 2024, w: 1920, h: 2560, aliases: ['a5 x2', 'a5x2'], sources: [SRC.supernoteTemplates], install: ['supernote-screensaver'] },
]);

// ---------------------------------------------------------------------------
// reMarkable: KOReader device code (resolutions from libremarkable).
// ---------------------------------------------------------------------------
const remarkable = brand('reMarkable', [
  { id: 'remarkable-1', model: 'reMarkable 1', generation: '1st generation (2017)', ordinal: 1, year: 2017, w: 1404, h: 1872, aliases: ['rm1'], sources: [SRC.koreaderRemarkable, SRC.kccProfiles], install: ['remarkable-ssh'] },
  { id: 'remarkable-2', model: 'reMarkable 2', generation: '2nd generation (2020)', ordinal: 2, year: 2020, w: 1404, h: 1872, aliases: ['rm2'], sources: [SRC.koreaderRemarkable, SRC.kccProfiles], install: ['remarkable-ssh'] },
  { id: 'remarkable-paper-pro', model: 'Paper Pro', generation: 'Paper Pro (2024)', year: 2024, w: 1620, h: 2160, color: true, aliases: ['rmpp', 'ferrari'], sources: [SRC.koreaderRemarkable, SRC.kccProfiles], install: ['remarkable-ssh'] },
  { id: 'remarkable-paper-pro-move', model: 'Paper Pro Move', generation: 'Paper Pro Move (2025)', year: 2025, w: 954, h: 1696, color: true, aliases: ['rmppm', 'chiappa'], sources: [SRC.koreaderRemarkable, SRC.kccProfiles], install: ['remarkable-ssh'] },
  { id: 'remarkable-paper-pure', model: 'Paper Pure', generation: 'Paper Pure', year: 2026, w: 1404, h: 1872, aliases: ['tatsu'], sources: [SRC.koreaderRemarkable], install: [] },
]);

// ---------------------------------------------------------------------------
// Bigme: only models whose official store page states the pixel grid.
// ---------------------------------------------------------------------------
const bigme = brand('Bigme', [
  { id: 'bigme-read', model: 'Read', generation: 'Read (6")', year: 2024, w: 758, h: 1024, sources: [bigmeProduct('bigme-read-6inch-dedicated-book-reader', 'Bigme Read')], install: [] },
  { id: 'bigme-inknote-s', model: 'inkNote S', generation: 'inkNote S (10.3")', year: 2024, w: 1404, h: 1872, sources: [bigmeProduct('inknotes-10-3-black-white-e-reader', 'inkNote S')], install: [] },
  { id: 'bigme-inknote-x-color', model: 'inkNoteX Color', generation: 'inkNoteX Color (Kaleido 3)', year: 2024, w: 1860, h: 2480, color: true, aliases: ['inknote x'], sources: [bigmeProduct('inknotex-color-10-3inch-kaleido-3-screen-with-android-13-os', 'inkNoteX Color')], install: [] },
]);

// ---------------------------------------------------------------------------
// Meebook: no manufacturer spec sheet found; secondary sources only.
// ---------------------------------------------------------------------------
const meebook = brand('Meebook', [
  { id: 'meebook-m7', model: 'M7', generation: 'M7 (6.8", 2023)', year: 2023, w: 1236, h: 1648, sources: [secondary('Good e-Reader: Meebook M7 review', 'https://goodereader.com/blog/?p=368860'), secondary('Comparisontabl.es: Meebook M7', 'https://comparisontabl.es/e-readers/meebook-m7')], install: [] },
  { id: 'meebook-p78-pro', model: 'P78 Pro', generation: 'P78 Pro (7.8")', year: 2022, w: 1404, h: 1872, sources: [secondary('eWritable: Meebook P78 Pro', 'https://ewritable.net/brands/meebook/tablets/meebook-p78-pro/'), secondary('Comparisontabl.es: Meebook P78 Pro', 'https://comparisontabl.es/e-readers/meebook-p78-pro/')], install: [] },
]);

// ---------------------------------------------------------------------------
// Niche phone-sized readers from the reference catalog, kept with independent
// secondary confirmation of the pixel grid.
// ---------------------------------------------------------------------------
const durobo = brand('DuRoBo', [
  { id: 'durobo-krono', model: 'Krono', generation: 'Krono (6.13")', year: 2025, w: 824, h: 1648, sources: [secondary('Notebookcheck: Durobo Krono', 'https://www.notebookcheck.net/Durobo-Krono-A-unique-Android-powered-e-reader-that-is-everything-but-a-smartphone.1068645.0.html'), secondary('GameRevolution: DuRoBo Krono review', 'https://www.gamerevolution.com/review/984877-durobo-krono-review-epaper-ereader-reading')], install: [] },
]);
const viwoods = brand('Viwoods', [
  { id: 'viwoods-aipaper-reader', model: 'AiPaper Reader', generation: 'AiPaper Reader (6.13")', year: 2025, w: 824, h: 1648, sources: [secondary('Parka Blogs: Viwoods AiPaper Reader review', 'https://www.parkablogs.com/content/viwoods-aipaper-reader-e-ink-tablet-review'), secondary('Hi-Tech.ua: AiPaper Reader', 'https://hi-tech.ua/en/aipaper-reader-the-first-e-reader-with-e-ink-an-ai-assistant-and-android-16/')], install: [] },
]);

export const DEVICES: readonly Device[] = [
  ...kindle,
  ...kobo,
  ...boox,
  ...pocketbook,
  ...xteink,
  ...tolino,
  ...nook,
  ...bigme,
  ...meebook,
  ...supernote,
  ...remarkable,
  ...durobo,
  ...viwoods,
];
