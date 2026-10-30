'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Snap=require('../scripts/v2/snap.js'),Scene=require('../scripts/v2/scene.js'),Edit=require('../scripts/v2/editor-model.js');
const scenes=require('./topology_v2_scenes.js'),checks=[];
function test(name,fn){try{fn();checks.push(name);}catch(error){console.error(name+': '+error.stack);process.exit(1);}}
const near=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`),empty=()=>({width:1600,height:1000,nodes:[],groups:[],rings:[],junctions:[],edges:[],annotations:[]});
function anchor(compact=false){const m=empty();m.nodes=[{id:'device',x:400,y:350,compact}];m.edges=[{id:'link',source:'device'}];return Snap.create(m,{kind:'anchor',id:'link',end:'source'});}
test('Eight canonical circle ports acquire at every direction on both chassis sizes',()=>{
  for(const compact of [false,true])for(let i=0;i<8;i++){
    const ctx=anchor(compact),out=Snap.update(ctx,{angle:i*45+2},{step:1});near(out.op.angle,i*45);assert.ok(out.label);assert.equal(out.guides.filter(g=>g.type==='point').length,1);
    near(Math.hypot(out.guides[0].x-400,out.guides[0].y-350),compact?32:42);
  }
});
test('Attraction is measured in screen pixels at fitted and enlarged scales',()=>{
  for(const scale of [.35,1,2.5]){
    const ctx=anchor(),r=42,angle=distance=>2*Math.asin(Math.min(1,distance/(2*r*scale)))*180/Math.PI;
    assert.ok(Snap.update(ctx,{angle:angle(4)},{scale:{x:scale,y:scale}}).label);
    const outside=anchor(),result=Snap.update(outside,{angle:angle(6)},{scale:{x:scale,y:scale}});
    assert.equal(result.label,'');near(result.op.angle,angle(6));
  }
});
test('Five pixel acquisition and eight pixel release prevent threshold chatter',()=>{
  const ctx=anchor(),angle=d=>2*Math.asin(d/84)*180/Math.PI;
  assert.ok(Snap.update(ctx,{angle:angle(4)}).label);
  near(Snap.update(ctx,{angle:angle(7)}).op.angle,0);
  const free=Snap.update(ctx,{angle:angle(9)});assert.equal(free.label,'');near(free.op.angle,angle(9));
});
test('Disabling magnets clears latches and preserves free continuous endpoint angles',()=>{
  const ctx=anchor();Snap.update(ctx,{angle:3});const result=Snap.update(ctx,{angle:3},{enabled:false});near(result.op.angle,3);assert.deepEqual(ctx.latch,{});assert.deepEqual(result.guides,[]);
  near(Snap.update(anchor(),{angle:23.25}).op.angle,23.25);
});
test('Regions expose centers, quarter divisions and edges with exact corrected deltas',()=>{
  const m=empty();m.nodes=[{id:'move',x:100,y:150}];m.groups=[{id:'area',x:200,y:200,w:800,h:480}];
  for(const x of [200,400,600,800,1000]){
    const c=Snap.create(m,{kind:'node',id:'move'}),out=Snap.update(c,{dx:x-100+3,dy:289},{step:8});near(out.op.dx,x-100);assert.ok(out.guides.some(g=>g.type==='line'&&g.x1===x&&g.x2===x));
  }
});
test('Axis hysteresis releases cleanly and grid is only fallback outside magnets',()=>{
  const m=empty(),ctx=Snap.create(m,{kind:'annotation',box:{x:111,y:133,w:0,h:0}});
  near(Snap.update(ctx,{dx:692,dy:100},{step:8}).op.dx,689);
  near(Snap.update(ctx,{dx:696,dy:100},{step:8}).op.dx,689);
  const out=Snap.update(ctx,{dx:699,dy:100},{step:8});near(out.op.dx,696);assert.equal(out.label,'');
  near(Snap.update(ctx,{dx:692,dy:101},{enabled:false,step:1}).op.dx,692);
});
test('Bottom-row icon centers align despite closer region quarter guides and below-disc names',()=>{
  const base=Scene.resolve(scenes.find(s=>s.id==='layered'),'overview');
  for(const scale of [.55,1.1,1.75])for(const compact of [false,true]){
    const m=Edit.clone(base),n=m.nodes.find(n=>n.id==='access-5');n.compact=compact;n.label=['A long device name','Second line'];n.meta='Below-disc metadata';n.labelOffset=[87,64];
    const ctx=Snap.create(m,{kind:'node',id:n.id,box:{x:0,y:0,w:400,h:300}}),out=Snap.update(ctx,{dx:12,dy:3/scale},{scale:{x:scale,y:scale},step:8});
    near(n.y+out.op.dy,760);assert.ok(out.guides.some(g=>g.type==='line'&&g.y1===760&&g.y2===760));
    assert.equal(ctx.box.h,compact?64:84);assert.ok(out.label.includes('设备'));
  }
});
test('A held weaker region guide yields to a nearby peer icon center',()=>{
  const m=Scene.resolve(scenes.find(s=>s.id==='layered'),'overview'),ctx=Snap.create(m,{kind:'node',id:'access-5'}),options={scale:{x:1.1,y:1.1},step:8};
  const weak=Snap.update(ctx,{dx:12,dy:9},options);assert.ok(weak.label.includes('区域'));near(weak.op.dy,5.5);
  const strong=Snap.update(ctx,{dx:12,dy:0},options);near(strong.op.dy,0);
  near(Snap.update(ctx,{dx:12,dy:6},options).op.dy,0);
  assert.equal(Snap.update(ctx,{dx:12,dy:0},{...options,enabled:false}).guides.length,0);
});
test('Matching circle edges remain available when peer centers are outside the acquisition range',()=>{
  const m=empty();m.nodes=[{id:'moving',x:112,y:323,compact:true},{id:'peer',x:520,y:621}];
  const ctx=Snap.create(m,{kind:'node',id:'moving'}),out=Snap.update(ctx,{dx:400,dy:127},{step:1});
  near(m.nodes[0].x+out.op.dx-32,m.nodes[1].x-42);
});
test('Nested group references exclude carried descendants and internal junctions',()=>{
  const m=empty();m.groups=[{id:'outer',x:200,y:200,w:600,h:400},{id:'inner',parent:'outer',x:250,y:250,w:100,h:100}];m.nodes=[{id:'inside',group:'inner',x:300,y:300},{id:'outside',x:1100,y:600}];m.junctions=[{id:'carried',x:330,y:320}];
  const c=Snap.create(m,{kind:'group',id:'outer'});
  for(const key of ['group:outer','group:inner','node:inside','junction:carried'])assert.ok(![...c.x,...c.y,...c.points].some(p=>p.key.includes(key)),key);
  assert.ok(c.x.some(p=>p.key.includes('node:outside')));
});
test('Ring member key points lie on the original ellipse and respect neighbors and spacing',()=>{
  for(const id of ['ring','mixed-ring']){
    const scene=scenes.find(s=>s.id===id),m=Scene.resolve(scene,'overview'),r=m.rings[0];
    for(const member of r.members){
      const n=m.nodes.find(n=>n.id===member),ctx=Snap.create(m,{kind:'node',id:member});assert.ok(ctx.points.length>0);
      for(const p of ctx.points){near(((p.x-r.cx)/r.rx)**2+((p.y-r.cy)/r.ry)**2,1);assert.ok(Snap.ringMemberValid(m,r,n,p));const out=Snap.update(ctx,{kind:'node',id:member,dx:p.x-n.x+1,dy:p.y-n.y+1},{step:8});assert.ok(out.label);const next=Edit.apply(scene,'overview',out.op),v=Scene.resolve(next,'overview').nodes.find(n=>n.id===member);near(v.x,p.x,.002);near(v.y,p.y,.002);assert.deepEqual(Scene.resolve(next,'overview').rings[0].members,r.members);ctx.latch={};}
    }
  }
});
test('Whole ring movement and resize exclude the carried ring and its members',()=>{
  const m=Scene.resolve(scenes.find(s=>s.id==='mixed-ring'),'overview'),r=m.rings[0];
  for(const kind of ['ring','ring-size']){const ctx=Snap.create(m,{kind,id:r.id});assert.ok(!ctx.points.some(p=>p.key.startsWith('ring:'+r.id+':')));for(const id of r.members)assert.ok(!ctx.x.some(p=>p.key.includes('node:'+id+':')));assert.ok(ctx.box);}
});
test('Curve controls use real circle ports, while corridors change only their active axis',()=>{
  const m=empty();m.nodes=[{id:'node',x:320,y:310}];const target=Snap.ports(m.nodes[0])[1],ctx=Snap.create(m,{kind:'control'}),out=Snap.update(ctx,{x:target.x+2,y:target.y-2},{step:8});near(out.op.x,target.x);near(out.op.y,target.y);assert.ok(out.label.includes('设备'));
  const corridor=Snap.create(m,{kind:'route',axis:'x'}),result=Snap.update(corridor,{x:803,y:311},{step:1});near(result.op.x,800);near(result.op.y,311);assert.equal(result.guides.length,1);assert.equal(result.guides[0].x1,result.guides[0].x2);
});
test('Input models and topology facts are never mutated by snapping',()=>{
  const scene=scenes.find(s=>s.id==='layered'),before=JSON.stringify(scene),m=Scene.resolve(scene,'overview'),ctx=Snap.create(m,{kind:'node',id:'dist-0'});Snap.update(ctx,{kind:'node',id:'dist-0',dx:123,dy:83},{step:1});assert.equal(JSON.stringify(scene),before);
});
const files=['scripts/v2/snap.js','scripts/v2/scene.js','scripts/v2/editor-model.js'];
const report={passed:true,acquire_screen_px:Snap.ENTER,release_screen_px:Snap.LEAVE,source_sha256:Object.fromEntries(files.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'..',file))).digest('hex')])),checks,scope:'Pure proximity, scale, hysteresis, exclusions and ring constraints; real gestures and exports verified separately.'};
fs.writeFileSync(path.join(__dirname,'../outputs/Topology_V2_Design/verification/snapping-model-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,checks:checks.length}));
