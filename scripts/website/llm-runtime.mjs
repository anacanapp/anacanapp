import {createReadStream} from 'node:fs';
import {open,stat,mkdtemp,rename,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {pipeline} from 'node:stream/promises';
import {Readable} from 'node:stream';

const sha=value=>createHash('sha256').update(value).digest('hex');
export const catalogSignature=data=>sha(JSON.stringify(data.articles.map(article=>[article.id,article.slug,article.title,article.excerpt,article.updatedAt]))+JSON.stringify(data.legal));
export const matchesContentEtag=(header,etag)=>String(header||'').split(',').some(value=>value.trim()==='*'||value.trim().replace(/^W\//,'')===etag.replace(/^W\//,''));

/** Locale corpora are written one at a time, with at most 12 public bodies in
 * memory. Global full text streams the 21 files; it never concatenates them in
 * the SSR process. Metadata signatures invalidate only changed corpora. */
export async function createLlmRuntime({root,languages,renderer,catalog,copies,details,fallback,readBodies}) {
  const directory=await mkdtemp(join(tmpdir(),'anacan-public-llm-'));
  const entries=new Map(),pending=new Map();let queue=Promise.resolve();
  const retire=entry=>{entry.retired=true;if(entry.temporary&&!entry.readers)void unlink(entry.file).catch(()=>{});};
  const retain=entry=>{entry.readers=(entry.readers||0)+1;return entry;};
  const release=entry=>{entry.readers--;if(entry.retired&&entry.temporary&&!entry.readers)void unlink(entry.file).catch(()=>{});};
  for(const language of languages) {
    const file=join(root,language,'llms-full.txt');
    try{const info=await stat(file);entries.set(language,{file,size:info.size,signature:catalogSignature(fallback[language]),temporary:false});}catch{/* A raw fallback can still be generated. */}
  }
  async function generate(language,data,signature) {
    const file=join(directory,language+'-'+signature+'.txt'),temp=file+'.pending';
    const handle=await open(temp,'w',0o600);let bytes=0;
    async function append(text) {
      const value=Buffer.from(text);bytes+=value.length;
      if(bytes>16*1024*1024)throw new Error('LLM_LOCALE_CORPUS_LIMIT');
      for(let offset=0;offset<value.length;){const result=await handle.write(value,offset,value.length-offset);offset+=result.bytesWritten;}
    }
    try{
      await append(renderer.renderLlmFullHeader(language));
      for(const kind of renderer.LLM_PAGE_KINDS)await append('\n\n---\n\n'+(kind==='journal'?renderer.renderLlmJournal(data,copies[language]):renderer.renderLlmDocument({schema:'anacan-website-boot-v1',route:{language,kind},copy:copies[language],details:details[language],articles:[],
        legalContent:data.legal[kind]?.content,legalUpdated:data.legal[kind]?.updatedAt,generatedAt:data.generatedAt,basePath:''})));
      for(let offset=0;offset<data.articles.length;offset+=12) {
        const batch=data.articles.slice(offset,offset+12),bodies=await readBodies(language,batch);
        for(const summary of batch) {
          const body=bodies.find(item=>item.id===summary.id)?.content;
          if(typeof body!=='string'||!body.trim())throw new Error('LLM_PUBLISHED_BODY_UNAVAILABLE');
          if(Buffer.byteLength(body)>1024*1024)throw new Error('LLM_ARTICLE_BODY_LIMIT');
          const article={...summary,...renderer.renderArticleContent(body,{footnotesLabel:copies[language].references})};
          await append('\n\n---\n\n'+renderer.renderLlmDocument({schema:'anacan-website-boot-v1',route:{language,kind:'article',slug:summary.slug,articleId:summary.id},copy:copies[language],details:details[language],articles:[],article,generatedAt:data.generatedAt,basePath:''}));
        }
      }
      await handle.close();await rename(temp,file);
      const previous=entries.get(language),entry={file,size:bytes,signature,temporary:true};entries.set(language,entry);
      if(previous?.temporary&&previous.file!==file)retire(previous);
      return entry;
    }catch(error){await handle.close().catch(()=>{});await unlink(temp).catch(()=>{});throw error;}
  }
  async function full(language,{pin=false}={}) {
    const data=await catalog(language),signature=catalogSignature(data),entry=entries.get(language);
    if(entry?.signature===signature)return pin?retain(entry):entry;
    const key=language+':'+signature;
    if(pending.has(key)){const entry=await pending.get(key);return pin?retain(entry):entry;}
    const job=queue.then(()=>generate(language,data,signature));queue=job.catch(()=>{});pending.set(key,job);
    try{const entry=await job;return pin?retain(entry):entry;}finally{pending.delete(key);}
  }
  async function serveFull(request,response,language) {
    const selected=language?[language]:languages,files=[];
    try{
    for(const code of selected)files.push(await full(code,{pin:true}));
    const prefix=language?'':renderer.renderLlmFullHeader(),separator='\n\n---\n\n';
    const length=Buffer.byteLength(prefix)+files.reduce((sum,file)=>sum+file.size,0)+(language?0:Buffer.byteLength(separator)*(files.length-1));
    const etag='"'+sha(files.map(file=>file.signature).join(':'))+'"';
    const headers={'Content-Type':'text/plain; charset=utf-8','Content-Language':language||languages.join(', '),'Cache-Control':'public, max-age=60, must-revalidate',
      'Content-Length':String(length),'ETag':etag,'Link':`<https://anacan.az/${language?language+'/':''}llms.txt>; rel="describedby"; type="text/plain"`};
    if(matchesContentEtag(request.headers['if-none-match'],etag)){delete headers['Content-Length'];response.writeHead(304,headers);response.end();return;}
    response.writeHead(200,headers);if(request.method==='HEAD'){response.end();return;}
    async function* chunks(){
      if(prefix)yield Buffer.from(prefix);
      for(let index=0;index<files.length;index++){
        if(response.destroyed)return;
        if(index)yield Buffer.from(separator);
        for await(const chunk of createReadStream(files[index].file))yield chunk;
      }
    }
    await pipeline(Readable.from(chunks()),response);
    }finally{for(const file of files)release(file);}
  }
  return {full,serveFull};
}
