import type { Source } from './types.ts';

/** Commits and tags pinned when the catalog was last verified. */
const CROSSPOINT_TAG = '2.0.0';
const CROSSPOINT_REPO = 'https://github.com/crosspoint-reader/crosspoint-reader';
const FREEINK_COMMIT = 'c996d1b90d5725519f3e479eed99c592c5b081b7';
const KCC_COMMIT = '892f2a8df0a9db4b43f36e97d255f9ec1582314a';
const KOREADER_COMMIT = '01ccbd790d6269301ad523e75c45f62d022a6d7b';

export const SRC = {
  crosspointGuide: {
    kind: 'firmware',
    title: 'CrossPoint User Guide, 3.7 Sleep Screen',
    url: `${CROSSPOINT_REPO}/blob/develop/USER_GUIDE.md#37-sleep-screen`,
  },
  crosspointSleep: {
    kind: 'firmware',
    title: `CrossPoint ${CROSSPOINT_TAG} SleepActivity.cpp`,
    url: `${CROSSPOINT_REPO}/blob/${CROSSPOINT_TAG}/src/activities/boot_sleep/SleepActivity.cpp`,
    note: '/sleep.bmp has priority, then random BMP from /.sleep or /sleep.',
  },
  crosspointBitmap: {
    kind: 'firmware',
    title: `CrossPoint ${CROSSPOINT_TAG} Bitmap.cpp`,
    url: `${CROSSPOINT_REPO}/blob/${CROSSPOINT_TAG}/lib/GfxRenderer/Bitmap.cpp`,
    note: 'BI_RGB 1/2/4/8/24/32 bpp, BI_BITFIELDS only for 32 bpp, max 2048x3072.',
  },
  crosspointRelease: {
    kind: 'firmware',
    title: `CrossPoint ${CROSSPOINT_TAG} release assets`,
    url: `${CROSSPOINT_REPO}/releases/tag/${CROSSPOINT_TAG}`,
    note: 'Builds for x3-x4, x4c, x4pro and picco.',
  },
  crosspointPxcPr: {
    kind: 'firmware',
    title: 'CrossPoint PR #1614: PXC image format support (open, unmerged)',
    url: `${CROSSPOINT_REPO}/pull/1614`,
  },
  freeinkBoard: {
    kind: 'firmware',
    title: 'FreeInk SDK BoardConfig.h (panel definitions used by CrossPoint)',
    url: `https://github.com/Free-Ink/freeink-sdk/blob/${FREEINK_COMMIT}/libs/hardware/BoardConfig/include/BoardConfig.h`,
  },
  freeinkDisplay: {
    kind: 'firmware',
    title: 'FreeInk SDK FreeInkDisplay.h (X4 800x480, X3 792x528 panels)',
    url: `https://github.com/Free-Ink/freeink-sdk/blob/${FREEINK_COMMIT}/libs/display/FreeInkDisplay/include/FreeInkDisplay.h`,
  },
  freeinkX4Pro: {
    kind: 'firmware',
    title: 'FreeInk SDK: Xteink X4 Pro support notes',
    url: `https://github.com/Free-Ink/freeink-sdk/blob/${FREEINK_COMMIT}/docs/xteink-x4pro-support.md`,
  },
  freeinkX4C: {
    kind: 'firmware',
    title: 'FreeInk SDK: Xteink X4 Classic support notes',
    url: `https://github.com/Free-Ink/freeink-sdk/blob/${FREEINK_COMMIT}/docs/xteink-x4c-support.md`,
  },
  xteinkX4Pro: {
    kind: 'manufacturer',
    title: 'Xteink X4 Pro product page',
    url: 'https://www.xteink.com/products/xteink-x4-pro-pocket-ereader',
    note: 'Image formats JPG and BMP; wallpaper via USB Mode and All Files > Wallpapers.',
  },
  referenceTool: {
    kind: 'community',
    title: 'E-ink Wallpaper Tool: Xteink stock firmware help',
    url: 'https://wallpaperconverter.jakegreen.dev/',
  },
  booxScreensavers: {
    kind: 'manufacturer',
    title: 'BOOX Help Center: Screensavers',
    url: 'https://booxsupport.zendesk.com/hc/en-us/articles/8569260546196-Screensavers',
  },
  kccProfiles: {
    kind: 'community',
    title: 'Kindle Comic Converter device profiles',
    url: `https://github.com/ciromattia/kcc/blob/${KCC_COMMIT}/kindlecomicconverter/image.py`,
  },
  kccPw6Fix: {
    kind: 'community',
    title: 'KCC PR #1299: Paperwhite 12th Gen and Colorsoft are 1272x1696 (from device screenshots)',
    url: 'https://github.com/ciromattia/kcc/pull/1299',
  },
  pw6Marketing: {
    kind: 'secondary',
    title: 'The eBook Reader: 12th gen Paperwhite specs (lists 1264x1680)',
    url: 'https://blog.the-ebook-reader.com/2024/10/16/new-12th-gen-kindle-paperwhite-specs-and-features-summary/',
  },
  koreaderRemarkable: {
    kind: 'community',
    title: 'KOReader reMarkable device definitions',
    url: `https://github.com/koreader/koreader/blob/${KOREADER_COMMIT}/frontend/device/remarkable/device.lua`,
  },
  koreaderScreensaverMenu: {
    kind: 'community',
    title: 'KOReader sleep screen menu',
    url: `https://github.com/koreader/koreader/blob/${KOREADER_COMMIT}/frontend/ui/elements/screensaver_menu.lua`,
  },
  koreaderImageTypes: {
    kind: 'community',
    title: 'KOReader DocumentRegistry image types',
    url: `https://github.com/koreader/koreader/blob/${KOREADER_COMMIT}/frontend/document/documentregistry.lua`,
  },
  kindleDisplayCover: {
    kind: 'manufacturer',
    title: 'About Amazon: Kindle features, Display Cover under Screen & Brightness',
    url: 'https://www.aboutamazon.com/news/devices/fun-kindle-features',
  },
  kdpCoverImage: {
    kind: 'manufacturer',
    title: 'Kindle Direct Publishing: internal cover image in EPUB (cover-image property, meta name="cover")',
    url: 'https://kdp.amazon.com/en_US/help/topic/G6GTK3T3NUHKLEFX',
  },
  kindleCoverSetting: {
    kind: 'secondary',
    title: 'The eBook Reader: book cover setting moved after Kindle software update',
    url: 'https://blog.the-ebook-reader.com/2024/02/08/book-cover-setting-changed-on-kindles-after-software-update/',
  },
  kindleCoverHowTo: {
    kind: 'secondary',
    title: 'How-To Geek: set a book cover as your Kindle screensaver',
    url: 'https://www.howtogeek.com/724066/how-to-set-a-book-cover-as-your-kindle-screensaver/',
  },
  koboScreensaverFolder: {
    kind: 'secondary',
    title: 'The eBook Reader: custom screensavers on Kobo eReaders (tested on Sage, firmware 4.37.21586)',
    url: 'https://blog.the-ebook-reader.com/2023/07/25/how-to-use-custom-screensavers-on-kobo-ereaders/',
  },
  koboHacksWiki: {
    kind: 'community',
    title: 'MobileRead Wiki: Kobo eReader hacks',
    url: 'https://wiki.mobileread.com/wiki/Kobo_eReader_hacks',
  },
  tolinoCoverFaq: {
    kind: 'manufacturer',
    title: 'tolino FAQ (vision color, shine color, shine 5): sleep screen options',
    url: 'https://mytolino.com/faq-tolino-vision-color/',
  },
  tolinoLegacyFaq: {
    kind: 'manufacturer',
    title: 'tolino FAQ, previous device generations: custom sleep screen image',
    url: 'https://mytolino.com/faq/how-do-i-customize-the-background-image-that-appears-on-the-sleep-screen-of-my-tolino/',
  },
  pocketbookFw69: {
    kind: 'manufacturer',
    title: 'PocketBook Verse Pro firmware 6.9: logo personalization',
    url: 'https://pocketbook.ch/en-ch/news/pocketbook-verse-pro-fw-6-9-ch',
  },
  nookSimpleTouch: {
    kind: 'manufacturer',
    title: 'B&N Help: NOOK Simple Touch, Selecting a Screensaver',
    url: 'https://help.barnesandnoble.com/hc/en-us/articles/5463551893019-NOOK-Simple-Touch-Selecting-a-Screensaver',
  },
  nookGlowLightCustomize: {
    kind: 'manufacturer',
    title: 'B&N Help: NOOK GlowLight, Customize Screensaver (600 x 800, 16-level grayscale)',
    url: 'https://help.barnesandnoble.com/hc/en-us/articles/5472096447899-NOOK-GlowLight-Customize-Screensaver',
  },
  nookGlowLight2013: {
    kind: 'manufacturer',
    title: 'B&N Help: Configure NOOK GlowLight (retired 2013 model)',
    url: 'https://help.barnesandnoble.com/hc/en-us/articles/5465657684763-Configure-NOOK-GlowLight',
  },
  nookCompare: {
    kind: 'secondary',
    title: 'B&N: Compare NOOKs (states 300 ppi only)',
    url: 'https://www.barnesandnoble.com/h/nook/compare',
  },
  supernoteScreensaver: {
    kind: 'manufacturer',
    title: 'Supernote Support: how to customize screensaver',
    url: 'https://support.supernote.com/t_CN/how-to-customize-screensaver',
  },
  supernoteTemplates: {
    kind: 'manufacturer',
    title: 'Supernote Support: custom note template image sizes per model',
    url: 'https://support.supernote.com/how-to-create-a-custom-note-template',
  },
  plato: {
    kind: 'community',
    title: 'Plato reader for Kobo: framebuffer size per model',
    url: 'https://github.com/baskerville/plato/blob/7da89f296e58c7426692abb6fda16431b9631e60/crates/core/src/device.rs',
  },
  linkss: {
    kind: 'community',
    title: 'MobileRead Wiki: Kindle Screen Saver Hack for 2.x, 3.x and 4.x Kindles',
    url: 'https://wiki.mobileread.com/wiki/Kindle_Screen_Saver_Hack_for_all_2.x,_3.x_%26_4.x_Kindles',
  },
  onyxRuManual: {
    kind: 'manufacturer',
    title: 'ONYX BOOX Volta user manual: changing the power-off screen image (copy on mcgrp.ru)',
    url: 'https://mcgrp.ru/files/viewer/825888/16',
  },
  remarkableGuide: {
    kind: 'community',
    title: 'remarkable.guide: Manage system splash screens',
    url: 'https://remarkable.guide/guide/software/screens.html',
  },
} satisfies Record<string, Source>;

export function booxProduct(handle: string, title: string): Source {
  return { kind: 'manufacturer', title: `BOOX store: ${title}`, url: `https://shop.boox.com/products/${handle}` };
}

export function koboProduct(slug: string, title: string): Source {
  return { kind: 'manufacturer', title: `Kobo: ${title} technical specs`, url: `https://ereader.kobo.com/en-us/products/${slug}` };
}

export function pocketbookProduct(path: string, title: string): Source {
  return { kind: 'manufacturer', title: `PocketBook: ${title} specifications`, url: `https://pocketbook.ch/en-ch/catalog/${path}` };
}

export function tolinoProduct(slug: string, title: string): Source {
  return { kind: 'manufacturer', title: `tolino: ${title}`, url: `https://mytolino.com/${slug}/` };
}

export function bigmeProduct(handle: string, title: string): Source {
  return { kind: 'manufacturer', title: `Bigme official store: ${title}`, url: `https://store.bigme.vip/products/${handle}` };
}

/** A device page on the MobileRead Wiki, maintained by device owners. */
export function mobileread(page: string, title: string): Source {
  return { kind: 'community', title: `MobileRead Wiki: ${title}`, url: `https://wiki.mobileread.com/wiki/${encodeURIComponent(page.replace(/ /g, '_')).replace(/%2F/g, '/')}` };
}

/** Product page on onyx-boox.ru, the official ONYX distributor site for Russia. */
export function onyxRuProduct(slug: string, title: string): Source {
  return { kind: 'manufacturer', title: `ONYX BOOX Russia: ${title} specifications`, url: `https://onyx-boox.ru/${slug}#tabSpecs` };
}

export function secondary(title: string, url: string): Source {
  return { kind: 'secondary', title, url };
}
