/* Original Kupiora geometry. Deterministic SVG sources and PNG/ICO exports. */
const fs=require('node:fs/promises'),path=require('node:path');
const sharp=require(process.env.KUPIORA_SHARP||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
const root=__dirname;
const defs=`<defs><linearGradient id="teal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#43e4cf"/><stop offset=".55" stop-color="#11bcb9"/><stop offset="1" stop-color="#0875ff"/></linearGradient><linearGradient id="orange" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffc35b"/><stop offset=".5" stop-color="#ff8c35"/><stop offset="1" stop-color="#f35c43"/></linearGradient><linearGradient id="tech" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#18c8c8"/><stop offset=".47" stop-color="#0875ff"/><stop offset="1" stop-color="#a958ed"/></linearGradient></defs>`;
const shapes={
 A:`<path d="M43 43v-8c0-28 42-28 42 0v8" fill="none" stroke="#0875ff" stroke-width="8" stroke-linecap="round"/><path d="M29 42Q64 36 99 42l7 52q1 13-13 14H35q-14-1-13-14Z" fill="url(#teal)"/><path d="M33 45Q64 40 94 45" fill="none" stroke="#a7fff0" stroke-width="3" stroke-linecap="round"/><circle cx="48" cy="66" r="4" fill="#103d57"/><circle cx="79" cy="66" r="4" fill="#103d57"/><path d="M47 81q17 18 34 0" fill="none" stroke="#103d57" stroke-width="5" stroke-linecap="round"/><path d="m91 37 17 5 5 17-17 5-8-14Z" fill="url(#orange)"/><circle cx="98" cy="45" r="3" fill="#fff6df"/>`,
 B:`<path d="M30 22q0-5 5-5h15q5 0 5 5v34L88 20q3-3 7-3h14L72 61l39 45H91q-4 0-7-4L55 69v32q0 5-5 5H35q-5 0-5-5Z" fill="url(#tech)"/><path d="m56 55 32-35q3-3 7-3h14L72 61Z" fill="#b7baff" opacity=".25"/><path d="M35 23v76" stroke="#a7fff0" stroke-width="3" stroke-linecap="round" opacity=".5"/>`,
 C:`<path d="M15 29h13l10 51h58" fill="none" stroke="#0ebdbb" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 39h77L98 74q-2 7-11 7H43Z" fill="url(#orange)"/><path d="M39 43h63" stroke="#ffe7aa" stroke-width="3" stroke-linecap="round"/><circle cx="55" cy="53" r="3.5" fill="#66311d"/><circle cx="84" cy="53" r="3.5" fill="#66311d"/><path d="M54 64q16 14 31-1" fill="none" stroke="#66311d" stroke-width="4.5" stroke-linecap="round"/><circle cx="47" cy="100" r="9" fill="#0875ff"/><circle cx="89" cy="100" r="9" fill="#0875ff"/><circle cx="47" cy="100" r="3.5" fill="#6df0dc"/><circle cx="89" cy="100" r="3.5" fill="#6df0dc"/>`
};
const svg=(body,box='0 0 128 128',size='')=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" ${size}>${defs}${body}</svg>\n`;
const icon=(id,theme)=>svg(`<rect width="128" height="128" fill="${theme==='dark'?'#10172b':'#f8fbff'}"/><g transform="translate(11.52 11.52) scale(.82)">${shapes[id]}</g>`);
const mark=id=>svg(shapes[id]);
const horizontal=(id,theme)=>svg(`<g transform="translate(0 -1) scale(.74)">${shapes[id]}</g><text x="108" y="53" font-family="Segoe UI,Arial,sans-serif" font-size="43" font-weight="700" letter-spacing="-1" fill="${theme==='dark'?'#f8fbff':'#10172b'}">Купиора</text><text x="110" y="79" font-family="Segoe UI,Arial,sans-serif" font-size="14" fill="${theme==='dark'?'#b3c6df':'#526781'}">Умные покупки. Реальная выгода</text>`,'0 0 400 96','width="400" height="96"');
function ico(pngs){let offset=6+16*pngs.length;const header=Buffer.alloc(offset);header.writeUInt16LE(1,2);header.writeUInt16LE(pngs.length,4);pngs.forEach(({size,data},i)=>{const o=6+i*16;header[o]=size;header[o+1]=size;header.writeUInt16LE(1,o+4);header.writeUInt16LE(32,o+6);header.writeUInt32LE(data.length,o+8);header.writeUInt32LE(offset,o+12);offset+=data.length;});return Buffer.concat([header,...pngs.map(x=>x.data)]);}
async function png(source,size,out,{opaque=false,alpha=true}={}){let p=sharp(Buffer.from(source)).resize(size,size).toColourspace('srgb');if(opaque)p=p.flatten({background:'#f8fbff'});if(alpha)p=p.ensureAlpha();await p.png().toFile(out);}
(async()=>{
 for(const id of ['A','B','C']){
  const dir=path.join(root,id);await fs.mkdir(dir,{recursive:true});
  await fs.writeFile(path.join(dir,'mark.svg'),mark(id));
  for(const theme of ['light','dark']){
   await fs.writeFile(path.join(dir,`horizontal-${theme}.svg`),horizontal(id,theme));
   await fs.writeFile(path.join(dir,`icon-${theme}.svg`),icon(id,theme));
   for(const size of [32,48,64,192,512,1024])await png(icon(id,theme),size,path.join(dir,`icon-${theme}-${size}.png`));
  }
  await fs.writeFile(path.join(dir,'favicon.svg'),icon(id,'light'));
  const frames=[];for(const size of [16,32,48]){const data=await sharp(Buffer.from(icon(id,'light'))).resize(size,size).ensureAlpha().png().toBuffer();frames.push({size,data});await fs.writeFile(path.join(dir,`favicon-${size}.png`),data);}
  await fs.writeFile(path.join(dir,'favicon.ico'),ico(frames));
  await png(icon(id,'light'),512,path.join(dir,'google-play-512.png'),{opaque:true,alpha:true});
  await png(icon(id,'light'),1024,path.join(dir,'apple-app-store-1024.png'),{opaque:true,alpha:false});
  const fg=svg(`<g transform="translate(21.6 21.6) scale(.50625)">${shapes[id]}</g>`,'0 0 108 108');
  const bg=svg('<rect width="108" height="108" fill="#f8fbff"/>','0 0 108 108');
  await fs.writeFile(path.join(dir,'android-foreground.svg'),fg);await fs.writeFile(path.join(dir,'android-background.svg'),bg);
  await png(fg,432,path.join(dir,'android-foreground-432.png'));await png(bg,432,path.join(dir,'android-background-432.png'),{opaque:true});
  const silhouette=shapes[id].replace(/url\(#[^)]+\)/g,'#ffffff').replace(/#103d57|#66311d/g,'#000000').replace(/#(?!000000)[a-f0-9]{6}/gi,'#ffffff');
  const mono=svg(`<mask id="cut"><g transform="translate(21.6 21.6) scale(.50625)">${silhouette}</g></mask><rect width="108" height="108" fill="white" mask="url(#cut)"/>`,'0 0 108 108');
  await fs.writeFile(path.join(dir,'android-monochrome.svg'),mono);await png(mono,432,path.join(dir,'android-monochrome-432.png'));
 }
 console.log('Generated A/B/C SVG, light/dark PNG, ICO and store masters in assets/brand.');
})().catch(e=>{console.error(e);process.exitCode=1;});
