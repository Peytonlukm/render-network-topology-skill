"use strict";
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),skill=fs.existsSync(path.join(root,'SKILL.md'))?root:path.join(root,'render-network-topology');
const Scene=require(path.join(skill,'scripts/v2/scene.js')),Edit=require(path.join(skill,'scripts/v2/editor-model.js'));
const source=require('./topology_v2_scenes.js').find(s=>s.id==='layered'),before=JSON.stringify(source),checks=[];
function test(name,fn){fn();checks.push(name);}
const luminance=hex=>{const rgb=hex.match(/[a-f0-9]{2}/gi).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
const contrast=(a,b)=>{a=luminance(a);b=luminance(b);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
const ratios=[];
test('Six distinct complete palettes with accessible primary ink and accent in both themes',()=>{
 assert.deepEqual(Scene.paletteIds,['ocean','forest','violet','copper','graphite','categories']);
 for(const theme of ['light','dark']){
  assert.equal(new Set(Scene.paletteIds.map(id=>Scene.iconPalette(id,theme).ink)).size,6);
  for(const id of Scene.paletteIds){const p=Scene.iconPalette(id,theme);for(const color of [p.ink,p.accent,...Object.values(p.categories||{})]){
   const ratio=contrast(color,p.disc);assert.ok(ratio>=3,`${id}/${theme}: ${color} contrast ${ratio}`);ratios.push({id,theme,color,ratio});
  }const pill=contrast(p.ink,theme==='light'?'#FFFFFF':Scene.PALETTES.dark.paper);assert.ok(pill>=4.5,`${id}/${theme} pill text ${pill}`);}
 }
});
test('Whole-diagram palette changes only the palette and preserves every view and topology fact',()=>{
 for(const palette of Scene.paletteIds){const output=Edit.apply(source,'engineering',{kind:'palette',palette});assert.equal(output.icon_palette,palette);delete output.icon_palette;const expected=Edit.clone(source);delete expected.icon_palette;assert.deepEqual(output,expected);Edit.validateImport(Edit.apply(source,'overview',{kind:'palette',palette}));}
 assert.equal(JSON.stringify(source),before);
});
test('Node palette overrides materialize only the current view, inherit correctly, and respect locks',()=>{
 const s=Edit.clone(source),id=s.nodes[0].id;const modified=Edit.apply(s,'overview',{kind:'node-palette',id,palette:'forest'});
 assert.equal(Scene.resolve(modified,'overview').nodes.find(n=>n.id===id).icon_palette,'forest');
 assert.equal(Scene.resolve(modified,'engineering').nodes.find(n=>n.id===id).icon_palette,undefined);
 assert.deepEqual(Scene.resolve(modified,'overview').nodes.map(n=>[n.id,n.x,n.y]),Scene.resolve(s,'overview').nodes.map(n=>[n.id,n.x,n.y]));
 const inherited=Edit.apply(modified,'overview',{kind:'node-palette',id,palette:'inherit'});assert.equal(Scene.resolve(inherited,'overview').nodes.find(n=>n.id===id).icon_palette,undefined);
 s.nodes[0].locked=true;assert.throws(()=>Edit.apply(s,'overview',{kind:'node-palette',id,palette:'violet'}),/锁定/);
});
test('Invalid palette imports and mutations are rejected, including markup-like values',()=>{
 for(const palette of ['unknown','inherit','"><script>','url(https://example.com)']){
  assert.throws(()=>Edit.validateImport({...source,icon_palette:palette}),/配色/);assert.throws(()=>Edit.apply(source,'overview',{kind:'palette',palette}),/配色/);
 }
 const s=Edit.clone(source);s.nodes[0].icon_palette='unknown';assert.throws(()=>Edit.validateImport(s),/配色/);
});
test('Unspecified legacy V2 palette remains importable without changing its facts',()=>{
 const s=Edit.clone(source);delete s.icon_palette;assert.deepEqual(Edit.validateImport(s),s);assert.equal(Scene.iconPalette(undefined).id,'ocean');
});
const report={passed:true,checks,contrast_checks:ratios};const out=path.join(root,'outputs/Topology_V2_Design/verification');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'palette-model-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,checks:checks.length,contrast_checks:ratios.length}));
