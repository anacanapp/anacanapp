import { createServer,request as upstreamRequest } from 'node:http';
import { projectBlogResponseAsync } from './response.mjs';
import { keepLanguages, trimRow, createLanguageLookup } from './language-trim.mjs';
// Small JSON GET against PostgREST with the caller's own token (used for user_preferences.language).
const fetchJsonFrom=target=>(path,{authorization,apikey})=>new Promise((resolve,reject)=>{
 const req=upstreamRequest({hostname:target.hostname,port:target.port,path,method:'GET',headers:{host:target.host,accept:'application/json',...(authorization?{authorization}:{}),...(apikey?{apikey}:{})}},res=>{
  if(res.statusCode!==200){res.resume();reject(new Error('status '+res.statusCode));return;}
  let size=0;const parts=[];res.on('data',c=>{size+=c.length;if(size>65536){req.destroy();reject(new Error('too large'));}else parts.push(c);});
  res.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(parts).toString()));}catch(e){reject(e);}});});
 req.setTimeout(3000,()=>req.destroy(new Error('timeout')));req.on('error',reject);req.end();});
const hop=new Set(['connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailer','transfer-encoding','upgrade']);
const filtered=headers=>Object.fromEntries(Object.entries(headers).filter(([key])=>!hop.has(key)));
export function createBlogProjectionServer({target,format,maxBytes=64*1024*1024,maxProjectedRequests=1,lookupLanguage=createLanguageLookup({fetchJson:fetchJsonFrom(target)})}){
 let active=0;const waiting=[];
 const acquire=()=>active<maxProjectedRequests?(active++,Promise.resolve()):new Promise(resolve=>waiting.push(resolve));
 const release=()=>waiting.length?waiting.shift()():active--;
 const server=createServer((request,response)=>{
  const url=new URL(request.url,'http://blog.internal');
  if(url.pathname==='/healthz'){response.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});response.end('{"status":"ok","service":"anacan-blog-projection"}');return;}
  if(!/^\/blog_posts\/?$/u.test(url.pathname)){response.writeHead(404);response.end();return;}
  const headers={...filtered(request.headers),host:target.host,'accept-encoding':''},projecting=request.method==='GET'&&request.headers['x-anacan-blog-format']!=='source-v1'&&(!request.headers['accept-profile']||request.headers['accept-profile']==='public');
  if(projecting){delete headers['if-none-match'];delete headers['if-modified-since'];}delete headers['x-anacan-blog-format'];
  let upstream,released=false,formatting=false;
  // The caller's app language (null when unknown); looked up in parallel with the blog read.
  const languagePromise=projecting?Promise.resolve().then(()=>lookupLanguage(request.headers)).catch(()=>null):Promise.resolve(null);
  const complete=()=>{if(projecting&&!released){released=true;release();}};
  const start=()=>{
   if(response.destroyed){complete();return;}
   upstream=upstreamRequest({hostname:target.hostname,port:target.port,path:request.url,method:request.method,headers},res=>{
    const outputHeaders=filtered(res.headers),type=String(res.headers['content-type']||'');
    if(!projecting||![200,206].includes(res.statusCode)||!/^application\/(?:json|vnd\.pgrst\.(?:object|array)\+json)/iu.test(type)){response.writeHead(res.statusCode,outputHeaders);res.pipe(response);return;}
    let total=0;const chunks=[];
    res.on('data',chunk=>{total+=chunk.length;if(total>maxBytes){chunks.length=0;upstream.destroy();if(!response.headersSent){response.writeHead(502,{'Cache-Control':'no-store'});response.end();}}else chunks.push(chunk);});
    res.on('end',async()=>{
     if(response.writableEnded||response.destroyed){chunks.length=0;complete();return;}
     formatting=true;
     try{
      const original=Buffer.concat(chunks);chunks.length=0;
      const projected=await projectBlogResponseAsync({method:request.method,path:url.pathname,status:res.statusCode,contentType:type,headers:request.headers,value:JSON.parse(original.toString()),format:async content=>{if(response.destroyed)throw new Error('BLOG_CALLER_CLOSED');return format(content);}});
      if(response.destroyed)return;
      const language=await languagePromise,keep=keepLanguages(language);
      let value=projected.value,changed=projected.changed;
      if(keep){value=Array.isArray(value)?value.map(row=>trimRow(row,keep,language)):trimRow(value,keep,language);changed=true;}
      if(response.destroyed)return;
      const body=changed?Buffer.from(JSON.stringify(value)):original;
      if(changed){delete outputHeaders['content-encoding'];delete outputHeaders.etag;delete outputHeaders['content-length'];Object.assign(outputHeaders,{'content-length':String(body.length),'cache-control':'no-store',vary:outputHeaders.vary?outputHeaders.vary+', X-Anacan-Blog-Format':'X-Anacan-Blog-Format','x-anacan-blog-format':'native-html-v1'});}
      response.writeHead(res.statusCode,outputHeaders);response.end(body);
     }catch{if(!response.destroyed&&!response.headersSent){response.writeHead(502,{'Content-Type':'application/json','Cache-Control':'no-store'});response.end('{"error":"blog_projection_failed"}');}}
     finally{formatting=false;complete();}
    });
    res.on('error',()=>{chunks.length=0;if(!response.headersSent){response.writeHead(502);response.end();}else response.destroy();if(!formatting)complete();});
   });
   upstream.setTimeout(60000,()=>upstream.destroy());upstream.on('error',()=>{if(!response.headersSent&&!response.destroyed){response.writeHead(502,{'Content-Type':'application/json','Cache-Control':'no-store'});response.end('{"error":"blog_projection_unavailable"}');}else response.destroy();if(!formatting)complete();});
   request.on('aborted',()=>upstream.destroy());response.on('close',()=>{if(!response.writableFinished)upstream.destroy();if(!formatting)complete();});request.pipe(upstream);
  };
  if(projecting){response.once('finish',()=>{if(!formatting)complete();});acquire().then(start);}else start();
 });server.requestTimeout=65000;return server;
}
