#!/usr/bin/env python3
"""Builds the bundled Rossmann catalog for the partner shop (Admin › Partnyor mağazaları › Kataloqu yüklə).

Source: the public rossmann.az product API, mother/baby/hygiene brands only. Writes
  src/data/rossmann-products.json  (same shape as olivia-products.json)
  public/rossmann/<code>.webp      (white background, 400 px)
Run again to refresh prices: python3 scripts/partners/rossmann-catalog.py
"""
import io, json, re, time, urllib.request, datetime, pathlib
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
API = 'https://api.rossmann.az/api/products?brand_code={code}&page={page}'
BRANDS = {'BABYDREAM': '0040', 'LANSINOH': '0065', 'BUBCHEN': '0525', 'PENATEN': '0637', 'JOHNSON': '0818',
          'DOVE BABY': '0968', 'CHICCO': '1032', 'NUK': '0021', 'ALWAYS': '0271'}
UA = {'User-Agent': 'Mozilla/5.0 (Anacan partner catalog)', 'Accept-Language': 'az'}

WORDS = {'USAQ': 'uşaq', 'UCUN': 'üçün', 'KORPE': 'körpə', 'YUYUCU': 'yuyucu', 'DERI': 'dəri', 'VE': 'və', 'SAC': 'saç',
 'TORBASI': 'torbası', 'EDED': 'ədəd', 'ED': 'ədəd', 'BUTULKASI': 'butulkası', 'ANA': 'ana', 'SINE': 'sinə', 'KOMPRESS': 'kompresi',
 'PASLANMAZ': 'paslanmaz', 'POLAD': 'polad', 'AYAQ': 'ayaq', 'SPREYI': 'spreyi', 'EMZIK': 'əmzik', 'SIMMETRIK': 'simmetrik',
 'NEM': 'nəm', 'QENAET': 'qənaət', 'ORQANIK': 'orqanik', 'SAMPUN': 'şampun', 'SHAMPUN': 'şampun', 'HESSAS': 'həssas',
 'UCU': 'ucu', 'KREMI': 'kremi', 'ASPIRATORU': 'aspiratoru', 'DAYAZ': 'dayaz', 'DUS': 'duş', 'GELI': 'geli', 'EKSTRA': 'ekstra',
 'EKTRA': 'ekstra', 'PUDRASI': 'pudrası', 'BUSTQALTER': 'büstqalter', 'ICLIK': 'içlik', 'INCE': 'incə', 'BAXIM': 'baxım',
 'LOSYONU': 'losyonu', 'TEBII': 'təbii', 'UZ': 'üz', 'PURE': 'püre', 'SUDU': 'südü', 'ILE': 'ilə', 'MEYVE': 'meyvə',
 'SIRESI': 'şirəsi', 'SUXARI': 'suxarı', 'YAGLI': 'yağlı', 'KAGIZ': 'kağız', 'PAMBIQ': 'pambıq', 'DISKLER': 'disklər',
 'DEYISDIRMEK': 'dəyişmək', 'ALTLIQ': 'altlığı', 'QASIQLAR': 'qaşıqlar', 'QASIQ': 'qaşıq', 'DIS': 'diş', 'FIRCALAMA': 'fırçalama',
 'OYRENME': 'öyrənmə', 'SETI': 'dəsti', 'ARABASI': 'arabası', 'YAGISLIQ': 'yağışlıq', 'CENGEL': 'çəngəl', 'BARMAGA': 'barmağa',
 'TAXILAN': 'taxılan', 'FIRCASI': 'fırçası', 'BASLIQLI': 'başlıqlı', 'DESMAL': 'dəsmal', 'DERIN': 'dərin', 'COBANYASTIGI': 'çobanyastığı',
 'QOVUCU': 'keçirməyən', 'ONLUK': 'önlük', 'KULEK': 'külək', 'SOYUGA': 'soyuğa', 'QARSI': 'qarşı', 'ORTUK': 'örtük',
 'OYUNCAQLARI': 'oyuncaqları', 'SERIN': 'sərin', 'QASIMA': 'qaşıma', 'COPLER': 'çöplər', 'KOPUK': 'köpük', 'SUSE': 'şüşə',
 'ISIQLI': 'işıqlı', 'QABLARI': 'qabları', 'SUD': 'süd', 'AYIRICI': 'ayırıcı', 'ASILQAN': 'asılqan', 'YAGI': 'yağı',
 'QORUYUCU': 'qoruyucu', 'BEDEN': 'bədən', 'GECE': 'gecə', 'EL': 'əl', 'ASILAN': 'asılan', 'QOYUNCAQ': 'oyuncaq', 'GUNES': 'günəş',
 'GUNESH': 'günəş', 'REFILL': 'ehtiyat paket', 'UZMEK': 'üzmək', 'LATEX': 'lateks', 'PECENYE': 'peçenye', 'DIRNAQ': 'dırnaq',
 'PILKASI': 'pilkası', 'BALZAMI': 'balzamı', 'INTENSIV': 'intensiv', 'AYAQQABI': 'ayaqqabı', 'CORAB': 'corab', 'TERKIBLI': 'tərkibli',
 'PAKETI': 'paketi', 'OL': 'yağı', 'DENIZ': 'dəniz', 'SEHRI': 'sehri', 'PELENG': 'pələng', 'KOPUYU': 'köpüyü', 'POKEMIN': 'Pokemon',
 'ZERIF': 'zərif', 'SEVIMLILER': 'sevimlilər', 'IDMAN': 'idman', '2IN1': '2-si 1-də', '2SI-1DE': '2-si 1-də', 'LASYONU': 'losyonu',
 'ASAN': 'asan', 'DARAMA': 'darama', 'BEBEK': 'körpə', 'YOGUN': 'intensiv', 'NEMLENDIRICI': 'nəmləndirici', 'BM': '',
 'COPU': 'çöpü', 'YAS': 'yaş', 'CIELEK': 'çiyələk', 'SUNGER': 'süngəri', 'LEKEAPARAN': 'ləkə təmizləyən', 'SPRAY': 'sprey',
 'YUMUSALDICI': 'yumşaldıcı', 'QIDALANDIRICI': 'qidalandırıcı', 'QAYCI': 'qayçı', 'CEHRAI': 'çəhrayı', 'BEZALTI': 'bezaltı',
 'GECE0-6': 'gecə 0-6', 'SALFETLER': 'salfetlər', 'QABI': 'qabı', 'QORUMALI': 'qorumalı', 'HALQASI': 'halqası'}
BRAND = {'BABYDREAM': 'Babydream', 'BUBCHEN': 'Bübchen', 'CHICCO': 'Chicco', 'ALWAYS': 'Always', 'LANSINOH': 'Lansinoh',
         'PENATEN': 'Penaten', 'JOHNSONS': "Johnson's", 'JOHNSON': "Johnson's", 'DOVE': 'Dove', 'BABY': 'Baby', 'NUK': 'NUK',
         'PREMIUM': 'Premium', 'JUNIOR': 'Junior', 'JUMBO': 'Jumbo', 'MAXI': 'Maxi', 'MED': 'Med', 'KIDS': 'Kids', 'PLATINUM': 'Platinum', 'BIBI&TINA': 'Bibi&Tina',
         'PIKACHU': 'Pikachu', 'POKEMON': 'Pokemon', 'POKEMIN': 'Pokemon', 'MONSTER': 'Monster', 'FUN': 'Fun', 'ROSALEA': 'Rosalea', 'KINDER': 'Kinder',
         'BAD': 'Bad', 'SENSITIVE': 'Sensitive'}
UNIT = {'ML': ' ml', 'QR': ' q', 'GR': ' q', 'Q': ' q', 'L': ' l', 'ED': ' ədəd', 'EDED': ' ədəd', 'SM': ' sm', 'AY': ' ay'}
# Hand-checked names where the shop title is too terse (Mamas Babydream is Rossmann's mother line).
NAMES = {
 '019915': 'Mamas Babydream isti-soyuq sinə kompresi', '019920': 'Mamas Babydream sərinləşdirici ayaq spreyi',
 '003967': 'Mamas Babydream süd içliyi, ultra incə, 30 ədəd', '002715': 'Mamas Babydream sinə ucu kremi, 30 ml',
 '019951': 'Mamas Babydream vegan sinə ucu kremi', '019923': 'Mamas Babydream gecə yağı, natural',
 '002712': 'Babydream bez dəyişmə altlığı 60×60 sm, 10 ədəd', '003650': 'Babydream klassik butulka, 300 ml, 0+',
 '002750': 'Babydream uşaq corabı 0-6 ay, 3 cüt', '002723': 'Babydream diş fırçalamağı öyrənmə dəsti, 2 ədəd',
 '002679': 'Babydream mini suxarı 7 ay+, 100 q', '002675': 'Babydream alma şirəsi 4 ay+, 500 ml',
 '019933': 'Babydream orqanik armud peçenyesi, 125 q', '019973': 'Babydream orqanik banan püresi, kokos südü ilə, 190 q',
 '018971': 'Babydream uşaq günəş spreyi SPF 50, 200 ml', '029072': 'Chicco körpə günəş spreyi SPF 50, 150 ml',
 '029065': 'Chicco körpə diş pastası, alma, 6-24 ay, 50 ml', '029064': 'Chicco körpə diş pastası, çiyələk, 12 ay+, 50 ml',
 '029062': 'Chicco körpə bədən süngəri', '029057': 'Chicco körpə burun aspiratoru', '003654': 'Babydream qida qabı üçün əmzik M, 0+',
 '019912': 'Babydream üzmək üçün uşaq bezi S, 12 ədəd', '019914': 'Babydream uşaq tuman bezi Premium 7 XXL, 16 ədəd',
 '019918': 'Babydream uşaq bezi Premium 4+ Maxi Jumbo, 72 ədəd', '004269': 'Babydream gecə uşaq bezi M, 10 ədəd',
 '004270': 'Babydream gecə uşaq bezi L, 10 ədəd', '019965': 'Babydream baxım salfeti XXL, 180 ədəd',
 '013625': 'Bübchen uşaq bədən südü, 400 ml', '029841': 'Bübchen Kids Bluey şampun və duş geli, 250 ml',
 '032086': 'NUK klassik əmzik gecə-gündüz 0-6 ay, 2 ədəd', '002744': 'Babydream yun uşaq ayaqqabısı 18/19',
 '002745': 'Babydream yun uşaq ayaqqabısı 20/22', '005534': 'Lansinoh ana südü saxlama paketi, 25 ədəd',
}

def nice(raw):
    out = []
    for w in raw.split():
        u = w.upper()
        if u in BRAND: out.append(BRAND[u]); continue
        m = re.fullmatch(r'(\d+(?:[.,]\d+)?)(ML|QR|GR|Q|L|ED|EDED|SM|AY)?', u)
        if m: out.append(m.group(1) + UNIT.get(m.group(2) or '', '')); continue
        if u in WORDS:
            if WORDS[u]: out.append(WORDS[u])
            continue
        out.append(w.lower() if w.isupper() else w)
    t = re.sub(r'\s+', ' ', ' '.join(out)).strip()
    t = re.sub(r'\s(\d+(?:[.,]\d+)?\s(?:ml|q|l|ədəd))', r', \1', t, count=1)  # "Name, 250 ml"
    return t

def always_name(raw):
    u = raw.upper()
    line = 'Platinum' if 'PLATINUM' in u else ('gündəlik' if 'GUN.' in u else 'Ultra')
    kind = 'gecə' if 'GECE' in u else 'Super+' if 'SUPER+' in u else 'Super' if 'SUPER' in u else 'Large' if 'LARGE' in u else 'Normal'
    eco = ' Eko' if 'EKO' in u or 'ECO' in u else ''
    n = re.findall(r'(\d+)\s*(?:EDED|ED)\b', u)
    size = re.search(r'N(\d)', u)
    return f"Always {line}{eco} gigiyenik bez, {kind}{' N' + size.group(1) if size else ''}, {n[-1] if n else ''} ədəd".replace(', , ', ', ').replace(',  ədəd', '')

KIDS = re.compile(r'kids|pokemon|pikachu|monster|pələng|bibi|rosalea|moruq|idman|zərif|dəniz|3-6 yaş|tuman bezi|xxl|junior|asan darama|ayaqqabı|su butulkası|termos|günəş')
def classify(name, brand):
    n = name.lower()
    if brand == 'ALWAYS':
        if 'gecə' in n: return {'cycle': 'Ağır günlər və gecə üçün etibarlı qoruma', 'newmom': 'Doğuşdan sonrakı ilk həftələr üçün gecə bezi'}
        return {'cycle': 'Aybaşı günlərində gündəlik rahatlıq'}
    if 'kompres' in n: return {'newmom': 'Əmizdirmədə sinə ağrısı və şişkinlik üçün isti-soyuq kompres'}
    if 'içli' in n: return {'bag': 'Doğum çantasına: süd sızmasına qarşı', 'newmom': 'Əmizdirmə dövründə gündəlik rahatlıq'}
    if 'sinə ucu' in n: return {'bag': 'Doğum çantasına: əmizdirmənin ilk günləri üçün', 'newmom': 'Sinə ucunda çatlara qarşı yumşaq baxım'}
    if re.search(r'südü? saxlama', n): return {'newmom': 'Ana südünü təhlükəsiz saxlamaq üçün', 'bag': 'Doğum çantasına'}
    if 'ayaq spreyi' in n: return {'pregnant': 'Hamiləlikdə yorğun və şişkin ayaqlar üçün sərinlik'}
    if 'gecə yağı' in n: return {'pregnant': 'Axşam rahatlaması üçün təbii baxım yağı'}
    if 'badam' in n: return {'pregnant': 'Dəri dartıldıqca təbii nəmləndirmə', 'baby': 'Körpə masajı üçün təbii yağ'}
    if re.search(r'salfet', n) and 'kağız' not in n: return {'bag': 'Doğum çantasına: həssas dəri üçün salfetlər', 'baby': 'Hər bez dəyişməsində'}
    if 'altlığı' in n or 'örtük' in n: return {'bag': 'Xəstəxanada və evdə bez dəyişmək üçün', 'baby': 'Gündəlik bez dəyişmə üçün'}
    if 'pambıq' in n or 'qulaq çöpü' in n: return {'bag': 'Körpənin ilk gigiyenası üçün', 'baby': 'Göz, qulaq və burun baxımı üçün'}
    if 'yara qoruyucu' in n or 'bezaltı' in n: return {'baby': 'Bez altında qızartıya qarşı qoruma', 'bag': 'Doğum çantasına'}
    if 'bez torbası' in n: return {'baby': 'İstifadə olunmuş bezlər üçün gigiyenik torba'}
    if KIDS.search(n):
        if 'termos' in n or 'su butulkası' in n: return {'kid': 'Gəzintidə və bağçada', 'gift': 'Faydalı hədiyyə'}
        if 'ayaqqabı' in n: return {'gift': 'İlk addımlar üçün isti hədiyyə', 'kid': 'İlk addımlar üçün'}
        if 'günəş' in n: return {'kid': 'Günəşdə uşaq dərisini qoruyur', 'baby': 'Yay gəzintiləri üçün'}
        if 'diş' in n: return {'kid': 'Uşağın gündəlik diş baxımı üçün'}
        if 'bez' in n: return {'kid': 'Böyüyən uşaq üçün quru və rahat'}
        return {'kid': 'Uşaqların sevdiyi əyləncəli çimmə'}
    if 'diş' in n: return {'baby': 'İlk dişlər çıxanda'}
    if 'bez' in n: return {'baby': 'Gecə-gündüz quru və rahat'}
    if 'əmzik' in n: return {'baby': 'Körpənin yaşına uyğun ölçüdə'}
    if re.search(r'butulka|süd tozu|qida qabı', n): return {'baby': 'Qidalandırma üçün rahat və təhlükəsiz'}
    if re.search(r'aspirator|termometr', n): return {'baby': 'Soyuqdəymə və qızdırma vaxtı lazım olur', 'bag': 'Doğum çantasına'}
    if re.search(r'qab|qaşıq|çəngəl|önlük|\bmat\b', n): return {'baby': 'Əlavə qidaya keçid üçün, 6 aydan'}
    if re.search(r'püre|şirə|suxarı|peçenye', n): return {'baby': 'Yaşa uyğun əlavə qida'}
    if re.search(r'oyuncaq|kitab|kub', n): return {'gift': 'Körpənin inkişafı üçün oyun', 'baby': 'Oyunla inkişaf'}
    if re.search(r'dəsmal|corab', n): return {'gift': 'Yeni doğulan üçün yumşaq hədiyyə', 'baby': 'Çimmədən sonra isti saxlayır'}
    if re.search(r'araba', n): return {'gift': 'Gəzinti üçün faydalı hədiyyə', 'baby': 'Gəzintilər üçün'}
    if re.search(r'daraq|qayçı|dırnaq', n): return {'baby': 'Körpənin saç və dırnaq baxımı', 'bag': 'Doğum çantasına'}
    if re.search(r'paltar|ləkə', n): return {'baby': 'Körpə paltarı üçün yumşaq yuma'}
    if re.search(r'külək', n): return {'baby': 'Gəzintidə külək və soyuqdan qoruma'}
    return {'baby': 'Həssas körpə dərisi üçün yumşaq baxım'}

def fetch():
    out, seen = [], set()
    for brand, code in BRANDS.items():
        page = 1
        while True:
            d = json.load(urllib.request.urlopen(urllib.request.Request(API.format(code=code, page=page), headers=UA), timeout=30))
            for p in d['products']:
                if p['code'] not in seen and p.get('active', 1) and p.get('images'):
                    seen.add(p['code']); p['_brand'] = brand; out.append(p)
            if d['pagination']['current_page'] >= d['pagination']['last_page']: break
            page += 1; time.sleep(0.3)
    return out

def main():
    raw = fetch()
    imgdir = ROOT / 'public' / 'rossmann'; imgdir.mkdir(parents=True, exist_ok=True)
    order = ['bag', 'pregnant', 'newmom', 'baby', 'kid', 'cycle', 'gift']
    products = []
    for p in raw:
        name = NAMES.get(p['code']) or (always_name(p['name']) if p['_brand'] == 'ALWAYS' else nice(p['name']))
        why = classify(name, p['_brand'])
        price, listed = float(p['salePrice']), float(p['listPrice'])
        img = imgdir / f"{p['code']}.webp"
        if not img.exists():
            b = urllib.request.urlopen(urllib.request.Request(p['images'][0], headers=UA), timeout=30).read()
            im = Image.open(io.BytesIO(b)).convert('RGBA'); bg = Image.new('RGBA', im.size, 'white'); bg.alpha_composite(im)
            im = bg.convert('RGB'); im.thumbnail((400, 400)); im.save(img, 'WEBP', quality=78)
        products.append({'sku': p['code'], 'name': name[:160], 'full_name': p['name'], 'price': price,
                         'original_price': listed if listed > price else None,
                         'url': f"https://rossmann.az/mehsullar/mehsul-{p['category_id']}/{p['slug']}",
                         'collections': list(why), 'why': why, 'image': f"/rossmann/{p['code']}.webp",
                         '_rank': (order.index(list(why)[0]), 0 if p.get('is_popular') else 1, -(p.get('discount_percent') or 0))})
    products.sort(key=lambda x: x.pop('_rank'))
    for i, p in enumerate(products): p['sort'] = i
    colls = {c: [p['sku'] for p in products if c in p['collections']] for c in order}
    data = {'source': 'rossmann.az', 'captured': datetime.date.today().isoformat(), 'collections': colls, 'products': products}
    (ROOT / 'src' / 'data' / 'rossmann-products.json').write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n')
    print(len(products), {c: len(v) for c, v in colls.items()})

if __name__ == '__main__':
    main()
