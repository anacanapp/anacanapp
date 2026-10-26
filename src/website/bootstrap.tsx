import { createRoot, hydrateRoot } from 'react-dom/client';
import Website from './Website';
import type { WebsiteBoot, WebsiteCopy } from './model';
import { previewPrefix, resolveWebsiteRoute } from './routes';
import { readWebsiteArticle, readWebsiteCatalog } from './api';
import { updateWebsiteHead } from './seo';
import './website.css';

const copies=import.meta.glob('./copy/*.json',{import:'default'});
const detailCopies=import.meta.glob('./details/*.json',{import:'default'});
export async function startWebsite() {
  document.documentElement.classList.add('anacan-public-website');
  document.querySelector('meta[name="viewport"]')?.setAttribute('content','width=device-width, initial-scale=1');
  const container=document.getElementById('root')!;
  let boot:WebsiteBoot|undefined;
  try{const parsed=JSON.parse(document.getElementById('anacan-website-boot')?.textContent||'null');if(parsed?.schema==='anacan-website-boot-v1')boot=parsed;}catch{/* The public fallback below reads only published data. */}
  const knownArticles=boot?.article?[boot.article]:boot?[]:(await import('./article-routes.json')).default;
  const resolved=resolveWebsiteRoute(window.location.pathname,knownArticles);
  if(resolved.redirect){window.location.replace(previewPrefix(window.location.pathname)+resolved.redirect+window.location.search+window.location.hash);return;}
  if(!boot||boot.route.language!==resolved.route.language||boot.route.kind!==resolved.route.kind||boot.route.slug!==resolved.route.slug){
    const {language}=resolved.route;
    const copy=await copies[`./copy/${language}.json`]() as WebsiteCopy;
    const details=await detailCopies[`./details/${language}.json`]() as WebsiteBoot['details'];
    let catalog,article;
    try{catalog=await readWebsiteCatalog(language);if(resolved.route.kind==='article')article=await readWebsiteArticle(language,resolved.route.slug!);}catch{if(resolved.route.kind==='article')resolved.route.kind='notFound';}
    boot={schema:'anacan-website-boot-v1',route:resolved.route,copy,details,articles:catalog?.articles||[],article,
      legalContent:resolved.route.kind==='privacy'||resolved.route.kind==='terms'?catalog?.legal[resolved.route.kind]?.content:undefined,
      legalUpdated:resolved.route.kind==='privacy'||resolved.route.kind==='terms'?catalog?.legal[resolved.route.kind]?.updatedAt:undefined,
      generatedAt:catalog?.generatedAt||new Date().toISOString(),basePath:previewPrefix(window.location.pathname)};
    updateWebsiteHead(boot);
    createRoot(container).render(<Website boot={boot}/>);
  }else{
    boot.basePath=previewPrefix(window.location.pathname);
    updateWebsiteHead(boot);
    hydrateRoot(container,<Website boot={boot}/>);
  }
}
