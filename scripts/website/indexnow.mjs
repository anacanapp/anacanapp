import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';

export const INDEXNOW_ENDPOINT='https://api.indexnow.org/indexnow';
export const INDEXNOW_KEY_PATH='/indexnow-key.txt';
export function validateIndexNowKey(key){
  if(typeof key!=='string'||!/^[a-zA-Z0-9-]{8,128}$/.test(key))throw new Error('INDEXNOW_KEY_INVALID');
  return key;
}
export async function prepareIndexNowKey(root){
  const path=join(root,'azure-migration/provider-inputs/google-cloud/website-indexnow.json');
  let value;
  try{value=JSON.parse(await readFile(path,'utf8'));}catch(error){
    if(error.code!=='ENOENT')throw error;
    value={schema:'anacan-indexnow-v1',host:'anacan.az',key:randomBytes(32).toString('hex'),keyLocation:'https://anacan.az'+INDEXNOW_KEY_PATH};
    await writeFile(path,JSON.stringify(value)+'\n',{mode:0o600,flag:'wx'});
  }
  if(value.schema!=='anacan-indexnow-v1'||value.host!=='anacan.az'||value.keyLocation!=='https://anacan.az'+INDEXNOW_KEY_PATH)throw new Error('INDEXNOW_IDENTITY_INVALID');
  validateIndexNowKey(value.key);return value;
}
export function canonicalIndexNowUrls(urls){
  const result=new Set();
  for(const value of urls){
    const url=new URL(value,'https://anacan.az');
    if(url.origin!=='https://anacan.az'||url.username||url.password||url.search||url.hash||/^\/(?:auth|rest|functions|admin|brands|website\/data)(?:\/|$)/.test(url.pathname))throw new Error('INDEXNOW_PRIVATE_OR_FOREIGN_URL');
    result.add(url.href);
  }
  return [...result];
}
export async function submitIndexNow(key,urls,fetcher=fetch){
  validateIndexNowKey(key);const urlList=canonicalIndexNowUrls(urls);
  if(!urlList.length||urlList.length>10000)throw new Error('INDEXNOW_BATCH_LIMIT');
  const response=await fetcher(INDEXNOW_ENDPOINT,{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/json; charset=utf-8'},
    body:JSON.stringify({host:'anacan.az',key,keyLocation:'https://anacan.az'+INDEXNOW_KEY_PATH,urlList})});
  await response.arrayBuffer();
  return {status:response.status,accepted:response.status===200||response.status===202,urls:urlList.length,indexingConfirmed:false};
}
/** Google publish/edit/delete discovery shares the 60s public metadata refresh.
 * No extra cron or database writer: only canonical public URLs leave the server. */
export function createIndexNowPublisher({key,languages,initial=[],fetcher=fetch,delay=5000,onResult=()=>{}}){
  validateIndexNowKey(key);
  let previous=new Map(initial.map(article=>[article.id,article])),timer,running=false,retry=0,closed=false;
  const queue=new Set();
  const digest=article=>JSON.stringify([article.updatedAt,article.title,article.excerpt,article.slugs]);
  const urlsFor=article=>languages.flatMap(code=>article.slugs?.[code]?[`https://anacan.az/${code}/${encodeURIComponent(article.slugs[code])}/`]:[]);
  function schedule(){if(!closed&&!timer&&!running&&queue.size){timer=setTimeout(()=>{timer=undefined;void flush();},retry||delay);timer.unref?.();}}
  async function flush(){
    if(closed||running||!queue.size)return;
    running=true;const urls=[...queue].slice(0,10000);for(const url of urls)queue.delete(url);
    try{const result=await submitIndexNow(key,urls,fetcher);onResult(result);if(!result.accepted){retry=Math.min(retry?retry*2:15*60*1000,60*60*1000);for(const url of urls)queue.add(url);}else retry=0;}
    catch{onResult({accepted:false,urls:urls.length,indexingConfirmed:false});retry=Math.min(retry?retry*2:15*60*1000,60*60*1000);for(const url of urls)queue.add(url);}
    finally{running=false;schedule();}
  }
  function observe(articles){
    const current=new Map(articles.map(article=>[article.id,article])),changed=[];
    for(const[id,article]of current){const old=previous.get(id);if(!old||digest(old)!==digest(article))changed.push(...urlsFor(article),...(old?urlsFor(old):[]));}
    for(const[id,article]of previous)if(!current.has(id))changed.push(...urlsFor(article));
    previous=current;
    if(changed.length){
      for(const url of changed)queue.add(url);
      for(const code of languages)for(const path of [`/${code}/llms.txt`,`/${code}/llms-full.txt`,`/sitemap-${code}.xml`])queue.add('https://anacan.az'+path);
      for(const path of ['/llms.txt','/llms-full.txt','/llms-manifest.json','/sitemap.xml'])queue.add('https://anacan.az'+path);
      schedule();
    }
  }
  return {observe,flush,close(){closed=true;if(timer)clearTimeout(timer);timer=undefined;queue.clear();},get pending(){return queue.size;}};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  process.umask(0o077);
  const root=fileURLToPath(new URL('../../',import.meta.url)),value=await prepareIndexNowKey(root);
  if(process.argv[2]==='prepare'){console.log(JSON.stringify({prepared:true,keyLocation:value.keyLocation}));}
  else if(process.argv[2]==='submit'){
    const manifest=JSON.parse(await readFile(process.argv[3],'utf8'));
    const urls=[...manifest.documents.map(item=>item.url),...manifest.languages.flatMap(item=>[item.indexUrl,item.fullContentUrl]),manifest.indexUrl,manifest.fullContentUrl,'https://anacan.az/llms-manifest.json'];
    for(const language of manifest.languages){
      const response=await fetch(language.sitemapUrl,{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error('INDEXNOW_SITEMAP_UNAVAILABLE');
      const text=await response.text();urls.push(...[...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>match[1]));
    }
    const result=await submitIndexNow(value.key,urls);await writeFile(process.argv[4],JSON.stringify({at:new Date().toISOString(),...result},null,2)+'\n');console.log(JSON.stringify(result));
    if(!result.accepted)process.exitCode=1;
  }else throw new Error('INDEXNOW_MODE_REQUIRED');
}
