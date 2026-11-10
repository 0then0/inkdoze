import { brand } from './define.ts';
import { mobileread } from './sources.ts';
import type { Device } from './types.ts';

/**
 * Brands outside the main catalog sections, mostly discontinued readers. Resolutions
 * come from the MobileRead Wiki device pages, maintained by owners of the devices.
 * None of these models has a documented way to install a custom sleep screen.
 */
export const OTHER_BRANDS: readonly Device[] = [
  ...brand('Sony', [
    { id: 'sony-librie', model: 'Librie', generation: 'Librie EBR-1000EP (2004)', year: 2004, w: 600, h: 800, aliases: ['ebr-1000ep', 'librie'], sources: [mobileread('Sony_Librie', 'Sony Librie')], install: [] },
    { id: 'sony-prs-500', model: 'PRS-500', generation: 'Reader PRS-500 (2006)', year: 2006, w: 600, h: 800, aliases: ['prs500', 'sony reader 500'], sources: [mobileread('PRS500', 'Sony Reader PRS-500')], install: [] },
    { id: 'sony-prs-505', model: 'PRS-505', generation: 'Reader PRS-505 (2007)', year: 2007, w: 600, h: 800, aliases: ['prs505'], sources: [mobileread('PRS505', 'Sony Reader PRS-505')], install: [] },
    { id: 'sony-prs-700', model: 'PRS-700', generation: 'Reader PRS-700 (2008)', year: 2008, w: 600, h: 800, aliases: ['prs700'], sources: [mobileread('PRS700', 'Sony Reader PRS-700')], install: [] },
    { id: 'sony-prs-300', model: 'PRS-300', generation: 'Pocket Edition PRS-300 (5", 2009)', year: 2009, w: 600, h: 800, aliases: ['prs300', 'pocket edition 2009'], sources: [mobileread('PRS300', 'Sony Reader PRS-300')], install: [] },
    { id: 'sony-prs-600', model: 'PRS-600', generation: 'Touch Edition PRS-600 (2009)', year: 2009, w: 600, h: 800, aliases: ['prs600', 'touch edition 2009'], sources: [mobileread('PRS600', 'Sony Reader PRS-600')], install: [] },
    { id: 'sony-prs-900', model: 'PRS-900', generation: 'Daily Edition PRS-900 (7", 2009)', year: 2009, w: 600, h: 1024, aliases: ['prs900', 'daily edition'], sources: [mobileread('Daily_Edition', 'Sony Daily Edition')], install: [] },
    { id: 'sony-prs-350', model: 'PRS-350', generation: 'Pocket Edition PRS-350 (5", 2010)', year: 2010, w: 600, h: 800, aliases: ['prs350', 'pocket edition 2010'], sources: [mobileread('PRS350', 'Sony Reader PRS-350')], install: [] },
    { id: 'sony-prs-650', model: 'PRS-650', generation: 'Touch Edition PRS-650 (2010)', year: 2010, w: 600, h: 800, aliases: ['prs650', 'touch edition 2010'], sources: [mobileread('PRS650', 'Sony Reader PRS-650')], install: [] },
    { id: 'sony-prs-t1', model: 'PRS-T1', generation: 'Reader PRS-T1 (2011)', year: 2011, w: 600, h: 800, aliases: ['prst1', 'prs t1'], sources: [mobileread('PRST1', 'Sony Reader PRS-T1')], install: [] },
    { id: 'sony-prs-t2', model: 'PRS-T2', generation: 'Reader PRS-T2 (2012)', year: 2012, w: 600, h: 800, aliases: ['prst2', 'prs t2'], sources: [mobileread('PRST2', 'Sony Reader PRS-T2')], install: [] },
    { id: 'sony-prs-t3', model: 'PRS-T3', generation: 'Reader PRS-T3 (2013)', year: 2013, w: 758, h: 1024, aliases: ['prst3', 'prs t3', 'prs-t3s'], sources: [mobileread('PRST3', 'Sony Reader PRS-T3')], install: [] },
    { id: 'sony-dpt-s1', model: 'DPT-S1', generation: 'Digital Paper DPT-S1 (13.3", 2013)', year: 2013, w: 1200, h: 1600, aliases: ['dpts1'], sources: [mobileread('Sony_DPT-S1', 'Sony DPT-S1')], install: [] },
    { id: 'sony-dpt-rp1', model: 'DPT-RP1', generation: 'Digital Paper DPT-RP1 (13.3", 2017)', year: 2017, w: 1650, h: 2200, aliases: ['dptrp1'], sources: [mobileread('Sony_DPT-RP1', 'Sony DPT-RP1 and DPT-CP1')], install: [] },
    { id: 'sony-dpt-cp1', model: 'DPT-CP1', generation: 'Digital Paper DPT-CP1 (10.3", 2018)', year: 2018, w: 1404, h: 1872, aliases: ['dptcp1'], sources: [mobileread('Sony_DPT-RP1', 'Sony DPT-RP1 and DPT-CP1')], install: [] },
  ]),
  ...brand('Bookeen', [
    { id: 'bookeen-cybook-gen1', model: 'Cybook Gen1', generation: 'Cybook Gen1 (2004)', year: 2004, w: 600, h: 800, aliases: ['cybook 1', 'cytale cybook'], sources: [mobileread('Bookeen_Cybook_Gen1', 'Bookeen Cybook Gen1')], install: [] },
    { id: 'bookeen-cybook-gen3', model: 'Cybook Gen3', generation: 'Cybook Gen3 (2007)', year: 2007, w: 600, h: 800, aliases: ['cybook 3'], sources: [mobileread('Bookeen_Cybook_Gen3', 'Bookeen Cybook Gen3')], install: [] },
    { id: 'bookeen-cybook-gold', model: 'Cybook Gold Edition', generation: 'Cybook Gen3 Gold Edition (2009)', year: 2009, w: 600, h: 800, aliases: ['cybook gold'], sources: [mobileread('Bookeen_Cybook_Gold_Edition', 'Bookeen Cybook Gold Edition')], install: [] },
    { id: 'bookeen-cybook-opus', model: 'Cybook Opus', generation: 'Cybook Opus (5", 2009)', year: 2009, w: 600, h: 800, aliases: ['opus'], sources: [mobileread('Bookeen_Cybook_Opus', 'Bookeen Cybook Opus')], install: [] },
    { id: 'bookeen-cybook-orizon', model: 'Cybook Orizon', generation: 'Cybook Orizon (2010)', year: 2010, w: 600, h: 800, aliases: ['orizon'], sources: [mobileread('Cybook_Orizon', 'Cybook Orizon')], install: [] },
    { id: 'bookeen-cybook-odyssey', model: 'Cybook Odyssey', generation: 'Cybook Odyssey (2011)', year: 2011, w: 600, h: 800, aliases: ['odyssey'], sources: [mobileread('Cybook_Odyssey', 'Cybook Odyssey')], install: [] },
    { id: 'bookeen-cybook-odyssey-hd', model: 'Cybook Odyssey HD FrontLight', generation: 'Cybook Odyssey HD FrontLight (2012)', year: 2012, w: 758, h: 1024, aliases: ['odyssey hd', 'odyssey frontlight'], sources: [mobileread('Cybook_Odyssey_HD_FrontLight', 'Cybook Odyssey HD FrontLight')], install: [] },
    { id: 'bookeen-cybook-ocean', model: 'Cybook Ocean', generation: 'Cybook Ocean (8", 2014)', year: 2014, w: 768, h: 1024, aliases: ['ocean'], sources: [mobileread('Cybook_Ocean', 'Cybook Ocean')], install: [] },
  ]),
  ...brand('Likebook', [
    { id: 'likebook-note', model: 'Note', generation: 'Likebook Note (10.3", 2018)', year: 2018, w: 1404, h: 1872, aliases: ['likebook note'], sources: [mobileread('BOYUE_Likebook_Note', 'Boyue Likebook Note')], install: [] },
    { id: 'likebook-mimas', model: 'Mimas', generation: 'Likebook Mimas (10.3", 2019)', year: 2019, w: 1404, h: 1872, aliases: ['likebook mimas'], sources: [mobileread('BOYUE_Likebook_Mimas', 'Boyue Likebook Mimas')], install: [] },
    { id: 'likebook-alita', model: 'Alita', generation: 'Likebook Alita (10.3", 2019)', year: 2019, w: 1404, h: 1872, aliases: ['likebook alita'], sources: [mobileread('BOYUE_Likebook_Alita', 'Boyue Likebook Alita')], install: [] },
  ]),
  ...brand('Boyue', [
    { id: 'boyue-t62-plus', model: 'T62+', generation: 'T62+ (2015)', year: 2015, w: 758, h: 1024, aliases: ['t62 plus', 't62'], sources: [mobileread('Boyue_T62+', 'Boyue T62+')], install: [] },
    { id: 'boyue-t63', model: 'T63', generation: 'T63 (2015)', year: 2015, w: 1072, h: 1448, aliases: ['ridibooks paper', 'jdread', 't63hd'], sources: [mobileread('Boyue_T63', 'Boyue T63')], install: [] },
    { id: 'boyue-t80', model: 'T80', generation: 'T80 (8", 2016)', year: 2016, w: 758, h: 1024, aliases: ['t80s'], sources: [mobileread('Boyue_T80', 'Boyue T80')], install: [] },
  ]),
  ...brand('BQ', [
    { id: 'bq-cervantes', model: 'Cervantes', generation: 'Cervantes (2015)', year: 2015, w: 758, h: 1024, aliases: ['bq cervantes'], sources: [mobileread('Bq_Cervantes', 'BQ Cervantes')], install: [] },
  ]),
  ...brand('Icarus', [
    { id: 'icarus-illumina-xl', model: 'Illumina XL', generation: 'Illumina XL (8", 2015)', year: 2015, w: 768, h: 1024, aliases: ['illumina xl'], sources: [mobileread('ICARUS_Illumina_XL', 'Icarus Illumina XL')], install: [] },
    { id: 'icarus-illumina-pro', model: 'Illumina Pro', generation: 'Illumina Pro (9.7", 2017)', year: 2017, w: 825, h: 1200, aliases: ['illumina pro'], sources: [mobileread('ICARUS_Illumina_Pro', 'Icarus Illumina Pro')], install: [] },
    { id: 'icarus-illumina-xl-hd', model: 'Illumina XL HD', generation: 'Illumina XL HD (7.8", 2017)', year: 2017, w: 1404, h: 1872, aliases: ['illumina xl hd'], sources: [mobileread('Icarus_Illumina_XL_HD', 'Icarus Illumina XL HD')], install: [] },
  ]),
  ...brand('iRex', [
    { id: 'irex-dr1000', model: 'Digital Reader 1000', generation: 'Digital Reader 1000 (10.2", 2008)', year: 2008, w: 1024, h: 1280, aliases: ['dr1000', 'dr1000s', 'dr1000sw'], sources: [mobileread('IRex_Digital_Reader', 'iRex Digital Reader')], install: [] },
    { id: 'irex-dr800sg', model: 'DR800SG', generation: 'DR800SG (8", 2010)', year: 2010, w: 768, h: 1024, aliases: ['dr800'], sources: [mobileread('DR800SG', 'iRex DR800SG')], install: [] },
  ]),
  ...brand('iriver', [
    { id: 'iriver-story-hd', model: 'Story HD', generation: 'Story HD (2011)', year: 2011, w: 768, h: 1024, aliases: ['iriver story hd'], sources: [mobileread('Iriver_Story_HD', 'iriver Story HD')], install: [] },
  ]),
  ...brand('Hanlin', [
    { id: 'hanlin-v2', model: 'V2', generation: 'V2 (2006)', year: 2006, w: 600, h: 800, aliases: ['jinke v2'], sources: [mobileread('Hanlin_V2', 'Hanlin V2')], install: [] },
    { id: 'hanlin-a6', model: 'A6', generation: 'A6 (2010)', year: 2010, w: 600, h: 800, aliases: ['jinke a6'], sources: [mobileread('Hanlin_A6', 'Hanlin A6')], install: [] },
    { id: 'hanlin-v90', model: 'V90', generation: 'V90 (9.7", 2010)', year: 2010, w: 825, h: 1200, aliases: ['jinke v90'], sources: [mobileread('Hanlin_V90', 'Hanlin V90')], install: [] },
    { id: 'hanlin-a9', model: 'A9', generation: 'A9 (9", 2011)', year: 2011, w: 768, h: 1024, aliases: ['jinke a9'], sources: [mobileread('Hanlin_A9', 'Hanlin A9')], install: [] },
    { id: 'hanlin-v61', model: 'V61', generation: 'V61 (2011)', year: 2011, w: 600, h: 800, aliases: ['jinke v61'], sources: [mobileread('Hanlin_V61', 'Hanlin V61')], install: [] },
  ]),
  ...brand('Hanvon', [
    { id: 'hanvon-wisereader-b630', model: 'WISEreader B630', generation: 'WISEreader B630 (2010)', year: 2010, w: 600, h: 800, aliases: ['b630'], sources: [mobileread('Wisereader_B630', 'Hanvon WISEreader B630')], install: [] },
    { id: 'hanvon-wisereader-e920', model: 'WISEreader E920', generation: 'WISEreader E920 (9.7", 2011)', year: 2011, w: 1200, h: 1600, aliases: ['e920'], sources: [mobileread('WISEreader_E920', 'Hanvon WISEreader E920')], install: [] },
    { id: 'hanvon-wisereader-color', model: 'WISEreader Color', generation: 'WISEreader Color (9.7" Triton, 2011)', year: 2011, w: 600, h: 800, color: true, aliases: ['wisereader color'], sources: [mobileread('Wisereader_color', 'Hanvon WISEreader Color')], install: [] },
  ]),
  ...brand('Ectaco', [
    { id: 'ectaco-jetbook-color', model: 'jetBook Color', generation: 'jetBook Color (9.7" Triton, 2011)', year: 2011, w: 600, h: 800, color: true, aliases: ['jetbook color 2'], sources: [mobileread('JetBook_Color', 'Ectaco jetBook Color')], install: [] },
  ]),
  ...brand('MobiScribe', [
    { id: 'mobiscribe', model: 'MobiScribe', generation: 'MobiScribe (6.8", 2019)', year: 2019, w: 1080, h: 1440, aliases: ['mobiscribe origin'], sources: [mobileread('MobiScribe', 'MobiScribe')], install: [] },
  ]),
  ...brand('NUUT', [
    { id: 'nuut-1', model: 'NUUT', generation: 'NUUT (2007)', year: 2007, w: 600, h: 800, aliases: ['nuut 1'], sources: [mobileread('NUUT', 'NUUT')], install: [] },
    { id: 'nuut-2', model: 'NUUT2', generation: 'NUUT2 (2009)', year: 2009, w: 600, h: 800, aliases: ['nuut 2'], sources: [mobileread('NUUT2', 'NUUT2')], install: [] },
    { id: 'nuut-3', model: 'NUUT3', generation: 'NUUT3 (2010)', year: 2010, w: 600, h: 800, aliases: ['nuut 3'], sources: [mobileread('Nuut3', 'NUUT3')], install: [] },
  ]),
  ...brand('Oaxis', [
    { id: 'oaxis-eb-601', model: 'EB-601', generation: 'myFirst EB-601 (2009)', year: 2009, w: 600, h: 800, aliases: ['eb601'], sources: [mobileread('OAXIS_EB-601', 'Oaxis EB-601')], install: [] },
    { id: 'oaxis-w960', model: 'W960', generation: 'W960 (2010)', year: 2010, w: 600, h: 800, aliases: ['oaxis w960'], sources: [mobileread('OAXIS_W960', 'Oaxis W960')], install: [] },
  ]),
  ...brand('txtr', [
    { id: 'txtr-beagle', model: 'beagle', generation: 'beagle (5", 2012)', year: 2012, w: 600, h: 800, aliases: ['txtr beagle'], sources: [mobileread('Txtr_beagle', 'txtr beagle')], install: [] },
  ]),
  ...brand('Foxit', [
    { id: 'foxit-eslick', model: 'eSlick', generation: 'eSlick (2009)', year: 2009, w: 600, h: 800, aliases: ['eslick'], sources: [mobileread('ESlick', 'Foxit eSlick')], install: [] },
  ]),
  ...brand('Spring Design', [
    { id: 'spring-design-alex', model: 'Alex', generation: 'Alex (2010)', year: 2010, w: 600, h: 800, aliases: ['alex ereader'], sources: [mobileread('Alex', 'Spring Design Alex')], install: [] },
  ]),
  ...brand('Asus', [
    { id: 'asus-dr900', model: 'DR900', generation: 'Eee Reader DR900 (9", 2011)', year: 2011, w: 768, h: 1024, aliases: ['eee reader dr900'], sources: [mobileread('Asus_DR900', 'Asus DR900')], install: [] },
  ]),
  ...brand('COOL-ER', [
    { id: 'cool-er-classic', model: 'COOL-ER', generation: 'COOL-ER Classic (2009)', year: 2009, w: 600, h: 800, aliases: ['cooler', 'interead cool-er'], sources: [mobileread('COOL-ER', 'COOL-ER')], install: [] },
  ]),
  ...brand('Booq', [
    { id: 'booq-avant', model: 'Avant', generation: 'booq Avant (2010)', year: 2010, w: 600, h: 800, aliases: ['booq'], sources: [mobileread('Booq', 'Booq')], install: [] },
  ]),
  ...brand('EGriver', [
    { id: 'egriver-touch', model: 'Touch', generation: 'EGriver Touch (2010)', year: 2010, w: 600, h: 800, aliases: ['egriver touch', 'positivo alfa'], sources: [mobileread('EGriver_Touch', 'EGriver Touch')], install: [] },
  ]),
  ...brand('Imcosys', [
    { id: 'imcosys-imcov6l', model: 'ImcoV6L', generation: 'ImcoV6L (2013)', year: 2013, w: 758, h: 1024, aliases: ['imcov6l'], sources: [mobileread('ImcoV6L', 'ImcoV6L')], install: [] },
  ]),
];
