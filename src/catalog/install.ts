import { SRC } from './sources.ts';
import type { InstallMethod } from './types.ts';

const VERIFIED = '2026-11-10';

export type InstallMethodId =
  | 'crosspoint'
  | 'xteink-stock-official'
  | 'xteink-stock-community'
  | 'boox-screensaver'
  | 'onyx-ru-screensaver'
  | 'kindle-cover'
  | 'koreader-kindle'
  | 'kindle-linkss'
  | 'kobo-cover'
  | 'kobo-screensaver-folder'
  | 'koreader-kobo'
  | 'tolino-cover'
  | 'tolino-own-picture'
  | 'pocketbook-logo'
  | 'nook-screensavers'
  | 'supernote-screensaver'
  | 'remarkable-ssh';

/**
 * Install methods are keyed by ID and referenced from devices. A method describes what
 * the cited sources confirm; it never implies that every device sharing a screen size
 * supports the same method.
 */
export const INSTALL_METHODS: Record<InstallMethodId, InstallMethod> = {
  crosspoint: {
    id: 'crosspoint',
    status: 'third-party',
    software: 'CrossPoint 2.0.0',
    communityDocumented: false,
    formats: ['bmp24', 'bmp8', 'bmp4', 'bmp2', 'bmp1'],
    recommendedFormat: 'bmp24',
    fileName: 'sleep',
    steps: [
      { key: 'install.crosspoint.mode', params: { menu: 'Settings › Sleep Screen › Custom' } },
      { key: 'install.crosspoint.single', params: { file: 'sleep.bmp' } },
      { key: 'install.crosspoint.multiple', params: { dir: '/.sleep', legacy: '/sleep' } },
      { key: 'install.crosspoint.coverMode', params: { menu: 'Sleep Screen Cover Mode' } },
    ],
    limitations: [
      { key: 'limit.crosspoint.bmpOnly', params: { max: '2048 × 3072' } },
      { key: 'limit.crosspoint.firstSleep' },
      { key: 'limit.crosspoint.noPxc' },
    ],
    sources: [SRC.crosspointGuide, SRC.crosspointSleep, SRC.crosspointBitmap, SRC.crosspointRelease, SRC.crosspointPxcPr],
    verified: VERIFIED,
  },
  'xteink-stock-official': {
    id: 'xteink-stock-official',
    status: 'custom-image',
    software: 'Xteink stock firmware',
    communityDocumented: false,
    formats: ['bmp24', 'jpeg'],
    recommendedFormat: 'bmp24',
    steps: [
      { key: 'install.xteink.usbMode', params: { menu: 'USB Mode' } },
      { key: 'install.xteink.copyWallpaper' },
      { key: 'install.xteink.setWallpaper', params: { path: 'All Files › Wallpapers', action: 'Set as Wallpaper' } },
      { key: 'install.xteink.powerOff' },
    ],
    limitations: [{ key: 'limit.xteink.app' }],
    sources: [SRC.xteinkX4Pro],
    verified: VERIFIED,
  },
  'xteink-stock-community': {
    id: 'xteink-stock-community',
    status: 'custom-image',
    software: 'Xteink stock firmware',
    communityDocumented: true,
    formats: ['bmp24'],
    recommendedFormat: 'bmp24',
    steps: [{ key: 'install.xteinkCommunity.copy' }, { key: 'install.xteinkCommunity.select' }],
    limitations: [{ key: 'limit.xteinkCommunity.unverified' }],
    sources: [SRC.referenceTool],
    verified: VERIFIED,
  },
  'boox-screensaver': {
    id: 'boox-screensaver',
    status: 'custom-image',
    software: 'BOOX firmware (Android tablets)',
    communityDocumented: false,
    formats: [],
    recommendedFormat: 'png',
    steps: [
      { key: 'install.boox.copy' },
      { key: 'install.boox.style', params: { menu: 'Apps › Screensaver › Screensaver style' } },
      { key: 'install.boox.select', params: { option: 'Image Screensaver', action: 'Select Images' } },
    ],
    limitations: [
      { key: 'limit.formatUnspecified' },
      { key: 'limit.boox.shutdown', params: { menu: 'Apps › Screensaver › Shutdown image setting' } },
    ],
    sources: [SRC.booxScreensavers],
    verified: VERIFIED,
  },
  'onyx-ru-screensaver': {
    id: 'onyx-ru-screensaver',
    status: 'custom-image',
    software: 'ONYX BOOX firmware for Russia',
    communityDocumented: false,
    formats: ['png', 'jpeg'],
    recommendedFormat: 'png',
    steps: [
      { key: 'install.onyxRu.copy' },
      { key: 'install.onyxRu.set', params: { action: 'Установить как заставку' } },
      { key: 'install.onyxRu.choose', params: { option: 'Экран выключенного устройства', confirm: 'Confirm' } },
    ],
    limitations: [{ key: 'limit.onyxRu.powerOff' }],
    sources: [SRC.onyxRuManual],
    verified: VERIFIED,
  },
  'kindle-cover': {
    id: 'kindle-cover',
    status: 'cover-only',
    software: 'Kindle firmware 5.x, ad-free',
    communityDocumented: true,
    formats: [],
    steps: [
      { key: 'install.kindleCover.new', params: { menu: 'Settings › Screen and brightness › Show covers on lock screen' } },
      { key: 'install.kindleCover.old', params: { menu: 'Settings › Device Options › Display Cover' } },
    ],
    limitations: [{ key: 'limit.kindleCover.ads' }, { key: 'limit.coverOnly' }],
    sources: [SRC.kindleCoverSetting, SRC.kindleCoverHowTo],
    verified: VERIFIED,
  },
  'koreader-kindle': {
    id: 'koreader-kindle',
    status: 'third-party',
    software: 'KOReader on a jailbroken Kindle',
    communityDocumented: true,
    formats: ['png', 'jpeg'],
    recommendedFormat: 'png',
    steps: [
      { key: 'install.koreader.jailbreak' },
      { key: 'install.koreader.copy' },
      { key: 'install.koreader.menu', params: { menu: 'Sleep screen › Wallpaper', option: 'Show custom image or cover on sleep screen' } },
      { key: 'install.koreader.choose', params: { menu: 'Custom images › Choose image or document cover' } },
    ],
    limitations: [{ key: 'limit.koreader.onlyInKoreader' }],
    sources: [SRC.koreaderScreensaverMenu, SRC.koreaderImageTypes],
    verified: VERIFIED,
  },
  'kindle-linkss': {
    id: 'kindle-linkss',
    status: 'third-party',
    software: 'Kindle firmware 2.x–4.x with the Screen Saver Hack',
    communityDocumented: true,
    formats: ['png', 'jpeg'],
    recommendedFormat: 'png',
    steps: [
      { key: 'install.linkss.jailbreak' },
      { key: 'install.linkss.copy', params: { dir: 'linkss/screensavers' } },
      { key: 'install.linkss.restart' },
    ],
    limitations: [{ key: 'limit.linkss.firmware' }],
    sources: [SRC.linkss],
    verified: VERIFIED,
  },
  'kobo-cover': {
    id: 'kobo-cover',
    status: 'cover-only',
    software: 'Kobo stock firmware',
    communityDocumented: true,
    formats: [],
    steps: [{ key: 'install.koboCover.setting', params: { menu: 'Settings › Energy saving and privacy', option: 'Show book covers full screen' } }],
    limitations: [{ key: 'limit.coverOnly' }],
    sources: [SRC.koboScreensaverFolder, SRC.koboHacksWiki],
    verified: VERIFIED,
  },
  'kobo-screensaver-folder': {
    id: 'kobo-screensaver-folder',
    status: 'custom-image',
    software: 'Kobo stock firmware 4.37 (tested on Sage)',
    communityDocumented: true,
    formats: ['jpeg'],
    recommendedFormat: 'jpeg',
    steps: [
      { key: 'install.koboFolder.create', params: { dir: '.kobo/screensaver' } },
      { key: 'install.koboFolder.copy' },
      { key: 'install.koboFolder.enable', params: { menu: 'Settings › Energy saving and privacy', option: 'Show book covers full screen' } },
    ],
    limitations: [{ key: 'limit.koboFolder.untested' }],
    sources: [SRC.koboScreensaverFolder],
    verified: VERIFIED,
  },
  'koreader-kobo': {
    id: 'koreader-kobo',
    status: 'third-party',
    software: 'KOReader on Kobo',
    communityDocumented: true,
    formats: ['png', 'jpeg'],
    recommendedFormat: 'png',
    steps: [
      { key: 'install.koreader.install' },
      { key: 'install.koreader.copy' },
      { key: 'install.koreader.menu', params: { menu: 'Sleep screen › Wallpaper', option: 'Show custom image or cover on sleep screen' } },
      { key: 'install.koreader.choose', params: { menu: 'Custom images › Choose image or document cover' } },
    ],
    limitations: [{ key: 'limit.koreader.onlyInKoreader' }],
    sources: [SRC.koreaderScreensaverMenu, SRC.koreaderImageTypes],
    verified: VERIFIED,
  },
  'tolino-cover': {
    id: 'tolino-cover',
    status: 'cover-only',
    software: 'tolino firmware (2024 and later models)',
    communityDocumented: false,
    formats: [],
    steps: [
      { key: 'install.tolinoCover.setting', params: { menu: 'More › Energy Saving Pin Code › Sleep screen', option: 'View current book cover in full screen' } },
    ],
    limitations: [{ key: 'limit.coverOnly' }],
    sources: [SRC.tolinoCoverFaq],
    verified: VERIFIED,
  },
  'tolino-own-picture': {
    id: 'tolino-own-picture',
    status: 'custom-image',
    software: 'tolino firmware (previous generations)',
    communityDocumented: false,
    formats: ['png'],
    recommendedFormat: 'png',
    steps: [
      { key: 'install.tolinoOwn.copy', params: { dir: 'DCIM' } },
      { key: 'install.tolinoOwn.select', params: { menu: 'Settings › Further settings › Sleepscreen', option: 'Own picture from folder' } },
    ],
    limitations: [{ key: 'limit.tolinoOwn.size', params: { size: '1264 × 1680' } }],
    sources: [SRC.tolinoLegacyFaq],
    verified: VERIFIED,
  },
  'pocketbook-logo': {
    id: 'pocketbook-logo',
    status: 'custom-image',
    software: 'PocketBook firmware 6.9',
    communityDocumented: false,
    formats: [],
    recommendedFormat: 'png',
    steps: [{ key: 'install.pocketbook.personalize', params: { menu: 'Settings › Personalize' } }],
    limitations: [{ key: 'limit.pocketbook.logoOnly' }, { key: 'limit.formatUnspecified' }],
    sources: [SRC.pocketbookFw69],
    verified: VERIFIED,
  },
  'nook-screensavers': {
    id: 'nook-screensavers',
    status: 'custom-image',
    software: 'NOOK stock firmware',
    communityDocumented: false,
    formats: ['png', 'jpeg'],
    recommendedFormat: 'png',
    steps: [
      { key: 'install.nook.folder', params: { dir: 'Screensavers' } },
      { key: 'install.nook.copy' },
      { key: 'install.nook.select', params: { menu: 'Settings › Screen › Screensaver' } },
    ],
    limitations: [{ key: 'limit.nook.grayscale' }],
    sources: [SRC.nookSimpleTouch, SRC.nookGlowLightCustomize, SRC.nookGlowLight2013],
    verified: VERIFIED,
  },
  'supernote-screensaver': {
    id: 'supernote-screensaver',
    status: 'custom-image',
    software: 'Supernote firmware',
    communityDocumented: false,
    formats: ['png', 'jpeg'],
    recommendedFormat: 'png',
    steps: [
      { key: 'install.supernote.copy' },
      { key: 'install.supernote.menu', params: { menu: 'Settings › Display & Input › Screensaver › More' } },
      { key: 'install.supernote.adjust', params: { fit: 'Fit', fill: 'Fill', ok: 'OK' } },
    ],
    limitations: [],
    sources: [SRC.supernoteScreensaver],
    verified: VERIFIED,
  },
  'remarkable-ssh': {
    id: 'remarkable-ssh',
    status: 'third-party',
    software: 'reMarkable OS with SSH access',
    communityDocumented: true,
    formats: ['png'],
    recommendedFormat: 'png',
    fileName: 'suspended',
    steps: [
      { key: 'install.remarkable.ssh' },
      { key: 'install.remarkable.backup', params: { file: '/usr/share/remarkable/suspended.png' } },
      { key: 'install.remarkable.copy', params: { file: '/usr/share/remarkable/suspended.png' } },
      { key: 'install.remarkable.restart', params: { command: 'systemctl restart xochitl' } },
    ],
    limitations: [{ key: 'limit.remarkable.updates' }, { key: 'limit.remarkable.readOnly' }],
    sources: [SRC.remarkableGuide],
    verified: VERIFIED,
  },
};

export function getInstallMethod(id: string): InstallMethod | undefined {
  return Object.hasOwn(INSTALL_METHODS, id) ? INSTALL_METHODS[id as InstallMethodId] : undefined;
}
