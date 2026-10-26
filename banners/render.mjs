// Renders banners/anacan-kk-banner.html to PNG (2x for sharp text) with the system Chrome,
// once per text language. Screenshots stay Kazakh; only the banner copy changes.
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';

const copy = {
  kk: {
    h1: 'Етеккірден<br><em>ана болуға</em> дейін<br>бір қолданбада',
    sub: 'Цикл күнтізбесі, жүктілік апталары және баланың күнделікті дамуы. Anacan.AI көмекшісімен, қазақ тілінде.',
    btn: 'Тегін жүктеп алыңыз',
    labels: ['Етеккір күнтізбесі', 'Жүктімін', 'Анамын'],
  },
  en: {
    h1: 'From period<br>to <em>motherhood</em><br>in one app',
    sub: 'Cycle calendar, pregnancy weeks and your baby’s daily development. With the Anacan.AI assistant, in Kazakh.',
    btn: 'Download for free',
    labels: ['Period Calendar', 'I’m pregnant', 'I’m a mom'],
  },
  ru: {
    h1: 'От цикла<br>до <em>материнства</em><br>в одном приложении',
    h1Size: '50px',
    sub: 'Календарь цикла, недели беременности и ежедневное развитие малыша. С помощником Anacan.AI, на казахском языке.',
    btn: 'Скачайте бесплатно',
    labels: ['Календарь менструации', 'Я беременна', 'Я мама'],
  },
};

const html = pathToFileURL(fileURLToPath(new URL('./anacan-kk-banner.html', import.meta.url))).href;
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
for (const [lang, c] of Object.entries(copy)) {
  await page.goto(html, { waitUntil: 'networkidle' });
  await page.evaluate(({ lang, c }) => {
    document.documentElement.lang = lang;
    const h1 = document.querySelector('h1');
    h1.innerHTML = c.h1;
    if (c.h1Size) h1.style.fontSize = c.h1Size;
    document.querySelector('.sub').textContent = c.sub;
    document.querySelector('.btn').textContent = c.btn;
    document.querySelectorAll('.phone .label').forEach((el, i) => { el.lastChild.textContent = c.labels[i]; });
    return document.fonts.ready;
  }, { lang, c });
  const out = fileURLToPath(new URL(`./anacan-banner-${lang}.png`, import.meta.url));
  await page.screenshot({ path: out });
  console.log('Saved', out);
}
await browser.close();
