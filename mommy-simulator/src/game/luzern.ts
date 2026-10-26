import { copy as c } from './copy';
import type { Activity, ActivityId, Copy, GameState, Household, Location, Room } from './types';

export const LIFE_LOCATIONS: { id: Location; title: Copy; subtitle: Copy; image: string; minutes: number; icon: string }[] = [
  { id: 'home', title: c('Göl kənarında evimiz', 'Our lakeside home', 'Göl kenarındaki evimiz'), subtitle: c('Luzern · İsveçrə', 'Lucerne · Switzerland', 'Luzern · İsviçre'), image: 'living', minutes: 0, icon: 'home' },
  { id: 'lakeside', title: c('Luzern göl kənarı', 'Lucerne lakeside', 'Luzern göl kıyısı'), subtitle: c('Kapellbrücke · ailə gəzintisi', 'Chapel Bridge · family stroll', 'Kapellbrücke · aile yürüyüşü'), image: 'lakeside-wide', minutes: 15, icon: 'waves' },
  { id: 'market', title: c('Məhəlləmizin marketi', 'Our neighbourhood market', 'Mahallemizin marketi'), subtitle: c('Təzə ərzaq və çörək', 'Fresh groceries and bread', 'Taze gıda ve ekmek'), image: 'market', minutes: 12, icon: 'bag' },
  { id: 'cafe', title: c('Gölə baxan kafe', 'The lakeside café', 'Göle bakan kafe'), subtitle: c('Bir fincan, özünə bir an', 'A cup, a moment for yourself', 'Bir fincan, kendine bir an'), image: 'cafe-real', minutes: 18, icon: 'coffee' },
  { id: 'clinic', title: c('Anacan ailə klinikası', 'Anacan family clinic', 'Anacan aile kliniği'), subtitle: c('Müayinə və ailə qayğısı', 'Appointments and family care', 'Muayene ve aile bakımı'), image: 'clinic', minutes: 25, icon: 'doctor' },
];
export const LIFE_ROOMS: { id: Room; title: Copy; image: string; icon: string; caption: Copy }[] = [
  { id: 'living', title: c('Qonaq otağı', 'Living room', 'Oturma odası'), image: 'living', icon: 'sofa', caption: c('Bir fincan çay. Bir az söhbət. Öz evinin rahatlığı.', 'A cup of tea. A little conversation. The comfort of home.', 'Bir fincan çay. Biraz sohbet. Evinin rahatlığı.') },
  { id: 'kitchen', title: c('Mətbəximiz', 'Our kitchen', 'Mutfağımız'), image: 'kitchen', icon: 'cooking', caption: c('Pəncərədən göl, mətbəxdən təzə çörək qoxusu.', 'A lake outside the window, fresh bread inside.', 'Pencereden göl, mutfaktan taze ekmek kokusu.') },
  { id: 'nursery', title: c('Körpə otağı', 'Nursery', 'Bebek odası'), image: 'nursery', icon: 'baby', caption: c('Ən balaca anlar burada ən böyük xatirə olur.', 'The littlest moments become the biggest memories here.', 'En küçük anlar burada en büyük anıya dönüşür.') },
  { id: 'bedroom', title: c('Sakit guşəmiz', 'Our quiet corner', 'Sakin köşemiz'), image: 'bedroom', icon: 'bed', caption: c('Sənə aid bir fasilə. Yavaşla, nəfəs al.', 'A pause just for you. Slow down and breathe.', 'Sana ait bir mola. Yavaşla, nefes al.') },
  { id: 'bathroom', title: c('Hamam', 'Bathroom', 'Banyo'), image: 'bathroom', icon: 'bath', caption: c('Günün qayğısından sonra isti bir rahatlıq.', 'Warm comfort after the day’s care.', 'Günün bakımından sonra sıcak bir rahatlık.') },
  { id: 'garden', title: c('Gölə baxan terras', 'The lakeview terrace', 'Göl manzaralı teras'), image: 'terrace', icon: 'leaf', caption: c('Luzern gölü, Alp havası və ailəmiz.', 'Lake Lucerne, Alpine air, and our family.', 'Luzern Gölü, Alp havası ve ailemiz.') },
];
export const GROCERY_PRODUCTS = [
  { id: 'vegetables', title: c('Mövsüm tərəvəzləri', 'Seasonal vegetables', 'Mevsim sebzeleri'), price: 480, icon: 'carrot', colour: '#8b9a68' },
  { id: 'fruit', title: c('Alma və armud', 'Apples and pears', 'Elma ve armut'), price: 360, icon: 'apple', colour: '#cda17d' },
  { id: 'milk', title: c('Süd və qatıq', 'Milk and yoghurt', 'Süt ve yoğurt'), price: 290, icon: 'bottle', colour: '#bdc7b0' },
  { id: 'bread', title: c('Təzə çörək', 'Fresh bread', 'Taze ekmek'), price: 420, icon: 'bread', colour: '#c8ad81' },
  { id: 'oats', title: c('Yulaf və taxıl', 'Oats and grains', 'Yulaf ve tahıl'), price: 310, icon: 'leaf', colour: '#bfb68f' },
] as const;
export type GroceryId = typeof GROCERY_PRODUCTS[number]['id'];
export const MEAL_INGREDIENTS: readonly GroceryId[] = ['vegetables', 'milk', 'bread'];
export const PANTRY_CAPACITY = 40;
export const groceryTotal = (basket: Partial<Household['groceries']>) => GROCERY_PRODUCTS.reduce((sum, p) => sum + p.price * (basket[p.id] ?? 0), 0);

export function groceryCheckout(household: Household, basket: unknown) {
  if (!basket || typeof basket !== 'object' || Array.isArray(basket)) return null;
  const entries = Object.entries(basket);
  if (!entries.length || entries.some(([id, quantity]) => !GROCERY_PRODUCTS.some(p => p.id === id) ||
    !Number.isInteger(quantity) || quantity < 0 || quantity > 6)) return null;
  const quantities = basket as Partial<Household['groceries']>, cost = groceryTotal(quantities);
  if (cost <= 0 || cost > household.cash || GROCERY_PRODUCTS.some(p => household.groceries[p.id] + (quantities[p.id] ?? 0) > PANTRY_CAPACITY)) return null;
  return { cost, groceries: Object.fromEntries(GROCERY_PRODUCTS.map(p => [p.id, household.groceries[p.id] + (quantities[p.id] ?? 0)])) as Household['groceries'] };
}

export function laundryLoad(household: Household) {
  const clean = Math.min(6, household.laundry.clean), dirty = Math.min(6 - clean, household.laundry.dirty);
  return { clean, dirty, count: clean + dirty };
}

export function householdActivityIssue(state: GameState, id: ActivityId): 'stockLow' | 'laundryEmpty' | null {
  if (id === 'cook' && MEAL_INGREDIENTS.some(p => state.household.groceries[p] < 1)) return 'stockLow';
  if (id === 'laundry' && laundryLoad(state.household).count === 0) return 'laundryEmpty';
  return null;
}

export const money = (cents: number, lang = 'az') => new Intl.NumberFormat(lang === 'az' ? 'de-CH' : lang === 'tr' ? 'tr-TR' : 'en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
export const art = (id: string) => `/assets/luzern/${id}.webp`;

export function newHousehold(): Household {
  return { cash: 148000, groceries: { vegetables: 3, fruit: 4, milk: 3, bread: 3, oats: 2 }, cleanliness: 86,
    laundry: { dirty: 6, clean: 0, folded: 0 }, relationship: 78, meals: 0, purchases: 0,
    dailyRewardDay: 0, chores: [], weather: 'sunny', moodlet: 'home' };
}
export const lifeWeather = (day: number): Household['weather'] => ['sunny', 'cloudy', 'sunny', 'rain', 'sunny', 'cloudy', 'sunny'][Math.max(0, day - 1) % 7] as Household['weather'];
export function lifeDate(day: number, language: string) {
  const date = new Date(Date.UTC(2026, 9, 4 + day - 1, 10));
  if (language === 'az') {
    const weekdays = ['Bazar', 'Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə'];
    const months = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
    return `${weekdays[date.getUTCDay()]}, ${date.getUTCDate()} ${months[date.getUTCMonth()]}`;
  }
  return new Intl.DateTimeFormat(language === 'tr' ? 'tr-TR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Zurich' }).format(date);
}

export const DAILY_LIFE_ACTIVITIES: Activity[] = [
  { id: 'laundry', title: c('Paltarların qayğısı', 'Care for the laundry', 'Çamaşırların bakımı'), description: c('Rəngləri ayır, yuma proqramını seç, sonra təmiz paltarları qatla.', 'Sort the colours, choose the wash, then fold the fresh laundry.', 'Renkleri ayır, yıkamayı seç, sonra temiz çamaşırları katla.'), result: c('Təmiz paltar, səliqəli səbət. Bir iş də paylaşıldı.', 'Fresh clothes, a tidy basket. One more task shared.', 'Temiz giysiler, düzenli sepet. Bir iş daha paylaşıldı.'), icon: 'laundry', room: 'bedroom', target: 'desk', seconds: 5, minutes: 45, effect: { energy: -9, mood: 9 }, skill: 'balance', xp: 22, coins: 14, mini: 'laundry' },
  { id: 'clean', title: c('Evimizi təzələyək', 'Freshen our home', 'Evimizi tazeleyelim'), description: c('Səthləri sil, oyuncaqları yerinə qoy, rahat guşəni yenilə.', 'Wipe surfaces, put away toys, and refresh your cosy corner.', 'Yüzeyleri sil, oyuncakları yerlerine koy, rahat köşeyi yenile.'), result: c('Günəş indi daha səliqəli evə düşür.', 'The sun falls on a fresher home.', 'Güneş artık daha düzenli bir eve düşüyor.'), icon: 'clean', room: 'living', target: 'sofa', seconds: 5, minutes: 30, effect: { energy: -7, mood: 12 }, skill: 'balance', xp: 20, coins: 14, mini: 'cleaning' },
  { id: 'groceries', title: c('Təzə ərzaq alaq', 'Shop for fresh groceries', 'Taze gıda alalım'), description: c('Məhəllə marketində siyahını tamamla. CHF büdcənə və evdəki ehtiyata bax.', 'Complete your list at the local market. Watch the CHF budget and your pantry.', 'Mahalle marketinde listeni tamamla. CHF bütçene ve evdeki stoğa bak.'), result: c('Alış-veriş tamam, mətbəximiz doludur.', 'Shopping done, the kitchen is stocked.', 'Alışveriş tamam, mutfağımız dolu.'), icon: 'bag', room: 'market', target: 'shelves', seconds: 3, minutes: 35, effect: { energy: -5, mood: 10 }, skill: 'balance', xp: 22, coins: 12, mini: 'groceries', location: 'market' },
  { id: 'coffee', title: c('Bir fincan özümə vaxt', 'A cup of time for myself', 'Bir fincan kendime zaman'), description: c('Kafedə kiçik bir fasilə. Öz qəhvə ritualını hazırla.', 'A little café pause. Make your own coffee ritual.', 'Kafede küçük bir mola. Kendi kahve ritüelini hazırla.'), result: c('Bu kiçik fasilə sənindir.', 'This little pause belongs to you.', 'Bu küçük mola senin.'), icon: 'coffee', room: 'cafe', target: 'coffee', seconds: 4, minutes: 25, effect: { mood: 18, energy: 12 }, skill: 'balance', xp: 18, coins: 10, mini: 'coffeeRitual', location: 'cafe' },
  { id: 'lakesideWalk', title: c('Luzerndə bir gəzinti', 'A Lucerne lakeside walk', 'Luzern’de bir yürüyüş'), description: c('Gölün kənarı ilə gəz, kiçik mənzərə anlarını yadda saxla.', 'Walk beside the lake and notice the little scenic moments.', 'Göl kıyısında yürü, küçük manzara anlarını fark et.'), result: c('Göl havası, yeni bir ailə xatirəsi.', 'Lake air, another family memory.', 'Göl havası, yeni bir aile anısı.'), icon: 'waves', room: 'lakeside', target: 'promenade', seconds: 8, minutes: 40, effect: { mood: 20, energy: -6, bond: 8 }, skill: 'balance', xp: 22, coins: 14, mini: 'lakeDiscovery', location: 'lakeside' },
];

export function dailyLifeGoals(state: GameState): ActivityId[] {
  const laundry = state.day % 2 && (laundryLoad(state.household).count > 0 || state.household.chores.includes('laundry'));
  return ['cook', laundry ? 'laundry' : 'clean', state.household.weather === 'rain' ? 'coffee' : 'lakesideWalk', 'help'];
}
export const dailyLifeComplete = (state: GameState) => dailyLifeGoals(state).every(id => state.household.chores.includes(id));

export function householdAfterActivity(household: Household, id: ActivityId): Household {
  const next = { ...household, chores: [...new Set([...household.chores, id])] };
  if (id === 'laundry') {
    const load = laundryLoad(household);
    next.laundry = { dirty: household.laundry.dirty - load.dirty, clean: household.laundry.clean - load.clean, folded: household.laundry.folded + load.count };
  }
  if (['clean', 'tidy'].includes(id)) next.cleanliness = Math.min(100, household.cleanliness + 23);
  if (['talk', 'help'].includes(id)) next.relationship = Math.min(100, household.relationship + 6);
  if (id === 'help') next.cleanliness = Math.min(100, household.cleanliness + 5);
  if (id === 'diaper') next.laundry = { ...household.laundry, dirty: Math.min(36, household.laundry.dirty + 1) };
  if (id === 'cook') {
    next.groceries = { ...household.groceries };
    for (const product of MEAL_INGREDIENTS) next.groceries[product]--;
    next.cleanliness = Math.max(10, household.cleanliness - 3);
    next.meals++; next.moodlet = 'nourished';
  } else if (id === 'lakesideWalk') next.moodlet = 'inspired';
  else if (['rest', 'coffee'].includes(id)) next.moodlet = 'rested';
  else if (['feed', 'skin', 'help'].includes(id)) next.moodlet = 'connected';
  return next;
}
