import { build } from 'vite';
import react from '@vitejs/plugin-react-swc';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
const outDir=process.argv[2]||join(root,'azure-migration/website/server');
await build({root,configFile:false,publicDir:false,plugins:[react()],logLevel:'error',json:{stringify:true,namedExports:false},
  ssr:{noExternal:true,external:['react','react-dom','react-dom/server','lucide-react','dompurify','qrcode.react','marked']},
  resolve:{alias:{'@':join(root,'src')}},build:{ssr:join(root,'src/website/server-render.tsx'),outDir,emptyOutDir:true,
    target:'node22',minify:false,rollupOptions:{output:{entryFileNames:'renderer.mjs'}}}});
console.log(JSON.stringify({websiteServerBuilt:true}));
