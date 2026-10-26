import { createServer } from 'node:http';
import { readFile,stat } from 'node:fs/promises';
import { join,resolve,extname } from 'node:path';
const root=resolve(process.argv[2]||'azure-migration/website/dist'),port=Number(process.argv[3]||4198);
const map=JSON.parse(await readFile(join(root,'website-redirects.json'),'utf8')).redirects;
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.ttf':'font/ttf','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8'};
createServer(async(request,response)=>{
  let url,path;
  try{url=new URL(request.url,'http://127.0.0.1');path=decodeURIComponent(url.pathname);}catch{response.writeHead(400);response.end();return;}
  const redirect=map[url.pathname]||map[path];
  if(redirect){response.writeHead(301,{Location:redirect+url.search});response.end();return;}
  const file=resolve(root,'.'+path);
  if(!file.startsWith(root+'/')){response.writeHead(404);response.end();return;}
  try{
    const info=await stat(file),target=info.isDirectory()?join(file,'index.html'):file;
    const bytes=await readFile(target);response.writeHead(200,{'Content-Type':types[extname(target)]||'application/octet-stream','Cache-Control':'no-cache'});response.end(request.method==='HEAD'?undefined:bytes);
  }catch{
    response.writeHead(404,{'Content-Type':'text/html; charset=utf-8','X-Robots-Tag':'noindex'});response.end(await readFile(join(root,'404.html')));
  }
}).listen(port,'127.0.0.1',()=>console.log(JSON.stringify({preview:true,port})));
