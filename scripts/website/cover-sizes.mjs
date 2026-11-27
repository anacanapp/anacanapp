// Writes src/website/cover-sizes.json: pixel size of every self-hosted article cover (WebP/JPEG/PNG
// under public/blog-covers and public/website/images). seo.ts uses it for BlogPosting image width/height;
// covers that are not listed (new CMS uploads) are published without a size. Run after adding covers:
//   node scripts/website/cover-sizes.mjs
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
export function imageSize(bytes) {
  if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'){
    const chunk=bytes.toString('ascii',12,16);
    if(chunk==='VP8 ')return [bytes.readUInt16LE(26)&0x3fff,bytes.readUInt16LE(28)&0x3fff];
    if(chunk==='VP8L'){const value=bytes.readUInt32LE(21);return [(value&0x3fff)+1,((value>>14)&0x3fff)+1];}
    if(chunk==='VP8X')return [bytes.readUIntLE(24,3)+1,bytes.readUIntLE(27,3)+1];
  }
  if(bytes.readUInt32BE(0)===0x89504e47)return [bytes.readUInt32BE(16),bytes.readUInt32BE(20)];
  if(bytes[0]===0xff&&bytes[1]===0xd8){
    for(let offset=2;offset<bytes.length;){
      const marker=bytes[offset+1],size=bytes.readUInt16BE(offset+2);
      if(marker>=0xc0&&marker<=0xcf&&![0xc4,0xc8,0xcc].includes(marker))return [bytes.readUInt16BE(offset+7),bytes.readUInt16BE(offset+5)];
      offset+=2+size;
    }
  }
  return null;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const sizes={};
  for(const folder of ['blog-covers','website/images']){
    for(const name of (await readdir(join(root,'public',folder))).sort()){
      if(!/\.(?:webp|jpe?g|png)$/i.test(name))continue;
      const size=imageSize(await readFile(join(root,'public',folder,name)));
      if(size)sizes[`/${folder}/${name}`]=size;
    }
  }
  await writeFile(join(root,'src/website/cover-sizes.json'),JSON.stringify(sizes,null,0).replace(/\],"/g,'],\n"').replace(/^\{/,'{\n').replace(/\}$/,'\n}\n'));
  console.log(JSON.stringify({coverSizes:Object.keys(sizes).length}));
}
