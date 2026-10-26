import { build,createServer,defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { cp,readFile,writeFile,mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { websitePrerenderPlugin } from './prerender.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const args=process.argv.slice(2),output=args[0]||join(root,'azure-migration/website/dist');
const catalogDir=args[1]||join(root,'scripts/website/catalog');
const config={root,configFile:false,plugins:[react()],publicDir:false,json:{stringify:true,namedExports:false},resolve:{alias:{'@':join(root,'src')}}};
const server=await createServer({...config,logLevel:'error',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,watch:null,hmr:false},appType:'custom'});
try{
  await build(defineConfig({...config,plugins:[react(),websitePrerenderPlugin({root,catalogDir,standalone:true,server})],logLevel:'error',build:{outDir:output,emptyOutDir:true,target:'es2020',reportCompressedSize:false,rollupOptions:{input:join(root,'src/website/index.html')}}}));
  // Assets are already public and contain no configuration or native resources.
  for(const name of ['brand-mark.png','favicon.png','icon-192.png','blog-covers','website'])await cp(join(root,'public',name),join(output,name),{recursive:true});
  await cp(join(root,'public/fonts/NotoNaskhArabic-Regular.ttf'),join(output,'website/fonts/NotoNaskhArabic-Regular.ttf'));
  const redirectMap=JSON.parse(await readFile(join(output,'website-redirects.json'),'utf8')).redirects;
  const lines=Object.entries(redirectMap).map(([from,to])=>`${from} ${to} 301`);
  await writeFile(join(output,'_redirects'),lines.join('\n')+'\n');
  console.log(JSON.stringify({website:true,outDir:output,redirects:lines.length}));
}catch(error){console.error(JSON.stringify({error:error.message,plugin:error.plugin}));process.exitCode=1;}finally{await server.close();}
