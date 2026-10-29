const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const sharp=require(process.env.KUPIORA_SHARP||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
(async()=>{let checks=0;for(const id of ['A','B','C']){
 const dir=path.join(__dirname,id);
 for(const theme of ['light','dark'])for(const size of [32,48,64,192,512,1024]){const m=await sharp(path.join(dir,`icon-${theme}-${size}.png`)).metadata();assert.equal(m.width,size);assert.equal(m.height,size);const stats=await sharp(path.join(dir,`icon-${theme}-${size}.png`)).stats();assert.equal(stats.isOpaque,true);checks++;}
 const play=path.join(dir,'google-play-512.png'),pm=await sharp(play).metadata();assert.equal(pm.width,512);assert.equal(pm.height,512);assert.equal(pm.channels,4);assert.ok((await fs.stat(play)).size<1024*1024);checks++;
 const apple=await sharp(path.join(dir,'apple-app-store-1024.png')).metadata();assert.equal(apple.width,1024);assert.equal(apple.height,1024);assert.equal(apple.hasAlpha,false);checks++;
 const {data,info}=await sharp(path.join(dir,'android-foreground-432.png')).raw().toBuffer({resolveWithObject:true});let visible=0;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){if(data[(y*info.width+x)*info.channels+3]>20){visible++;assert.ok(Math.hypot(x-216,y-216)<=132,'foreground exceeds 66dp safe circle');}}assert.ok(visible>1000);checks++;
 const ico=await fs.readFile(path.join(dir,'favicon.ico'));assert.equal(ico.readUInt16LE(2),1);assert.equal(ico.readUInt16LE(4),3);checks++;
 for(const name of ['mark.svg','horizontal-light.svg','horizontal-dark.svg','icon-light.svg','icon-dark.svg','android-monochrome.svg']){const svg=await fs.readFile(path.join(dir,name),'utf8');assert.match(svg,/<svg/);assert.doesNotMatch(svg,/<script|<image|href=|http[s]?:\/\/(?!www.w3.org)/);if(name==='mark.svg')assert.doesNotMatch(svg,/<text/);checks++;}
 }console.log(`${checks} asset checks passed; store dimensions, opacity, ICO and adaptive safe zones verified.`);})().catch(e=>{console.error(e);process.exitCode=1;});
