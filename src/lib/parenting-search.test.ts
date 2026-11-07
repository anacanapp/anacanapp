import { describe, expect, it } from 'vitest';
import az from '@/data/parenting/az';
import { foldText, searchParenting } from './parenting-search';
import { matchParentingTopic } from './parenting-match';

describe('Tərbiyə search normalisation', () => {
  it('folds Azerbaijani letters and diacritics', () => {
    expect(foldText('Uşaq YATMIR, gecə qorxur!')).toBe('usaq yatmir gece qorxur');
    expect(foldText('ƏŞÇĞÖÜİI əşçğöüıi')).toBe('escgouii escgouii');
    expect(foldText('“Səni sevmirəm!” — dedi')).toBe('seni sevmirem dedi');
    expect(foldText('Éducation à l’école')).toBe('education a l ecole');
  });
});

describe('Tərbiyə search', () => {
  it('finds the same items with or without Azerbaijani letters', () => {
    const a = searchParenting(az, 'yatmaq istəmir');
    const b = searchParenting(az, 'yatmaq istemir');
    expect(a.total).toBeGreaterThan(0);
    expect(b.sos.map((h) => h.item.id)).toEqual(a.sos.map((h) => h.item.id));
    expect(a.sos[0].item.id).toBe('bedtime-refusal');
  });

  it('groups results (SOS, articles, programmes) and ranks title hits first', () => {
    const r = searchParenting(az, 'isterika');
    expect(r.articles[0].item.id).toBe('tantrum-brain');
    expect(r.sos.map((h) => h.item.id)).toContain('shop-tantrum');
    expect(r.programmes.map((h) => h.item.id)).toContain('tantrums-14');
    const y = searchParenting(az, 'yalan');
    expect(y.articles[0].item.id).toBe('lying');
    expect(y.sos[0].item.id).toBe('caught-lying');
    expect(searchParenting(az, 'ekran').articles[0].item.id).toBe('screen-time');
  });

  it('needs every query word and at least 2 characters', () => {
    expect(searchParenting(az, 'y').total).toBe(0);
    expect(searchParenting(az, '   ').total).toBe(0);
    expect(searchParenting(az, 'yalan zzzqqq').total).toBe(0);
  });

  it('includes Premium items (the list shows their lock)', () => {
    const r = searchParenting(az, 'qardaş');
    expect([...r.sos, ...r.articles].some((h) => !h.item.free)).toBe(true);
  });
});

describe('Anacan.AI → Tərbiyə matcher', () => {
  const m = (text: string) => matchParentingTopic(az, text);

  it.each([
    ['Uşağım hər gün isterika edir, nə edim?', 'article', 'tantrum-brain'],
    ['Mağazada isterika edir, yerə yıxılır', 'sos', 'shop-tantrum'],
    ['3 yaşlı oğlum axşamlar yatmaq istəmir', 'sos', 'bedtime-refusal'],
    ['usagim yatmaq istemir', 'sos', 'bedtime-refusal'],
    ['Qızım qardaşını vurur, necə dayandırım?', 'sos', 'hit-sibling'],
    ['Oğlum yeni körpəyə qısqanclıq edir', 'article', 'new-baby'],
    ['Telefonu alanda ekran üçün ağlayır', 'sos', 'screen-off'],
    ['5 yaşlı uşaq yalan danışır', 'article', 'lying'],
    ['Bağçada uşaqları dişləyir', 'sos', 'biting-daycare'],
    ['Uşağa bağırdım, özümü pis hiss edirəm', 'sos', 'i-shouted'],
    ['Gecə kabus görüb oyanır', 'sos', 'nightmare'],
    ['Uşağı vurmaq olarmı? Şillə tərbiyədir?', 'article', 'no-hitting'],
  ])('%s → %s %s', (text, kind, id) => {
    expect(m(text)).toMatchObject({ kind, id });
  });

  it.each([
    'Körpəmin qızdırması 38.5-dir, nə verim?',
    '6 aylıq körpəyə hansı vitaminlər lazımdır?',
    'Hamiləliyin 20-ci həftəsində nə baş verir?',
    'Salam',
    '',
  ])('stays silent for a non-parenting message: %s', (text) => {
    expect(m(text)).toBeNull();
  });

  it('needs content (no match before the language chunk is loaded)', () => {
    expect(matchParentingTopic(null, 'isterika')).toBeNull();
  });
});
