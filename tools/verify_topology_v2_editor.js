'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),Edit=require('../scripts/v2/editor-model.js'),Scene=require('../scripts/v2/scene.js');
const scenes=require('./topology_v2_scenes.js'),by=id=>scenes.find(s=>s.id===id),checks=[];
function test(name,fn){try{fn();checks.push(name);}catch(error){console.error(name+': '+error.message.slice(0,1800));process.exit(1);}}
function model(s,view='overview'){return Scene.resolve(s,view);}
function invariant(s,view='overview'){
  const m=model(s,view),objects=Edit.objects(m);
  for(const e of m.edges){const g=Edit.edgeGeometry(e,m);
    if(e.geometry==='orthogonal'&&!e.base_edge){assert.ok(g.points.length<=4);for(let i=1;i<g.points.length;i++)assert.ok(Math.abs(g.points[i].x-g.points[i-1].x)<.002||Math.abs(g.points[i].y-g.points[i-1].y)<.002);}
    if(e.geometry==='ring')for(const [i,id] of [[0,e.source],[1,e.target]]){const n=objects.get(id),p=g.at(i);assert.ok(Math.abs(Math.hypot(p.x-n.x,p.y-n.y)-(n.compact?32:42))<.002);}
  }
}
test('Every current scene can be reimported without losing topology',()=>{for(const s of scenes)assert.deepEqual(Edit.validateImport(s),Edit.clone(s));});
test('Curated base paths produce no false crossing warnings',()=>{for(const s of scenes)for(const view of s.views?.engineering?['overview','engineering']:['overview'])assert.deepEqual(Edit.crossings(model(s,view)),[]);});
test('Moving a node reroutes orthogonal links and preserves facts and the other view',()=>{
  const input=by('layered'),s=Edit.apply(input,'engineering',{kind:'node',id:'dist-0',dx:32,dy:24}),m=model(s,'engineering');
  assert.equal(m.nodes.find(n=>n.id==='dist-0').x,model(input,'engineering').nodes.find(n=>n.id==='dist-0').x+32);
  assert.deepEqual(model(s).nodes,model(input).nodes);assert.deepEqual(m.edges.map(e=>[e.id,e.source,e.target]),model(input,'engineering').edges.map(e=>[e.id,e.source,e.target]));invariant(s,'engineering');
});
test('Nested area movement carries descendants, internal routes, labels and metadata',()=>{
  const input=by('nested'),g=input.groups.find(g=>input.groups.some(x=>x.parent===g.id)),s=Edit.apply(input,'overview',{kind:'group',id:g.id,dx:16,dy:8});invariant(s);
  for(const n of model(input).nodes){const moved=model(s).nodes.find(x=>x.id===n.id);assert.equal(moved.x,n.x+16);assert.equal(moved.y,n.y+8);}
});
test('Ring node remains on ellipse with exact clipped endpoints and stable neighbor order',()=>{
  const input=by('ring'),s=Edit.apply(input,'overview',{kind:'node',id:'ring-0',dx:18,dy:10}),m=model(s),r=m.rings[0],n=m.nodes[0];
  assert.ok(Math.abs(((n.x-r.cx)/r.rx)**2+((n.y-r.cy)/r.ry)**2-1)<1e-9);assert.deepEqual(r.members,input.rings[0].members);invariant(s);
  assert.throws(()=>Edit.apply(input,'overview',{kind:'node',id:'ring-0',dx:input.nodes[4].x-input.nodes[0].x,dy:input.nodes[4].y-input.nodes[0].y}),/越过/);
});
test('Whole mixed ring movement carries interior objects and retargets external station branches',()=>{
  const input=by('mixed-ring'),r=input.rings[0],s=Edit.apply(input,'overview',{kind:'ring',id:r.id,dx:24,dy:16}),m=model(s);
  for(const id of r.members){const a=input.nodes.find(n=>n.id===id),b=m.nodes.find(n=>n.id===id);assert.equal(b.x,a.x+24);assert.equal(b.y,a.y+16);}
  const outside=input.nodes.find(n=>n.group);assert.deepEqual(m.nodes.find(n=>n.id===outside.id),outside);invariant(s);
});
test('Ring resize preserves member angles, cycles and precision',()=>{const input=by('ring'),s=Edit.apply(input,'overview',{kind:'ring-size',id:input.rings[0].id,dx:32,dy:16});invariant(s);assert.equal(model(s).rings[0].rx,input.rings[0].rx+32);});
test('Device and edge labels move independently',()=>{
  let s=Edit.apply(by('layered'),'overview',{kind:'node-label',id:'core-a',dx:8,dy:16});assert.deepEqual(model(s).nodes.find(n=>n.id==='core-a').labelOffset,[by('layered').nodes.find(n=>n.id==='core-a').labelOffset[0]+8,16]);
  const e=model(s).edges.find(e=>e.labelAt),old=[...e.labelAt];s=Edit.apply(s,'overview',{kind:'edge-label',id:e.id,dx:16,dy:-8});assert.deepEqual(model(s).edges.find(x=>x.id===e.id).labelAt,[old[0]+16,old[1]-8]);
});
test('Endpoint drag stays attached to the device circumference',()=>{
  const input=by('layered'),edge=input.edges.find(e=>e.source==='core-a'&&e.semantics==='physical'),s=Edit.apply(input,'overview',{kind:'anchor',id:edge.id,end:'source',angle:95}),m=model(s),e=m.edges.find(e=>e.id===edge.id),p=Edit.edgeGeometry(e,m).points[0],n=m.nodes.find(n=>n.id===e.source);
  assert.ok(Math.abs(Math.hypot(p.x-n.x,p.y-n.y)-42)<.002);invariant(s);
});
test('Straight, two-turn orthogonal and cubic control edits are explicit and reversible snapshots',()=>{
  const input=by('layered'),edge=input.edges.find(e=>e.semantics==='physical'),original=JSON.stringify(input);
  let s=Edit.apply(input,'overview',{kind:'geometry',id:edge.id,geometry:'curve'});s=Edit.apply(s,'overview',{kind:'control',id:edge.id,index:0,x:600,y:350});assert.deepEqual(model(s).edges.find(e=>e.id===edge.id).controls[0],[600,350]);
  s=Edit.apply(s,'overview',{kind:'geometry',id:edge.id,geometry:'orthogonal'});s=Edit.apply(s,'overview',{kind:'route',id:edge.id,axis:'y',x:600,y:360});invariant(s);
  s=Edit.apply(s,'overview',{kind:'geometry',id:edge.id,geometry:'line'});assert.ok(!model(s).edges.find(e=>e.id===edge.id).via);assert.throws(()=>Edit.apply(s,'overview',{kind:'route',id:edge.id,x:500,y:400}),/直线/);assert.equal(JSON.stringify(input),original);
});
test('Business overlays modify their real base geometry and keep IDs and semantics',()=>{
  const input=by('swimlane'),business=input.edges.find(e=>e.base_edge),s=Edit.apply(input,'overview',{kind:'geometry',id:business.id,geometry:'curve'}),m=model(s);
  assert.equal(m.edges.find(e=>e.id===business.base_edge).geometry,'curve');assert.deepEqual(m.edges.find(e=>e.id===business.id),business);assert.equal(Edit.edgeGeometry(m.edges.find(e=>e.id===business.id),m).d,Edit.edgeGeometry(m.edges.find(e=>e.id===business.base_edge),m).d);
});
test('Locked descendants, rings, invalid JSON and injected styles are rejected without mutation',()=>{
  const s=Edit.clone(by('ring'));s.nodes[0].locked=true;assert.throws(()=>Edit.apply(s,'overview',{kind:'ring',id:s.rings[0].id,dx:10,dy:10}),/锁定/);
  for(const mutate of [s=>s.edges[0].target='missing',s=>s.edges[0].width='2\" onload=\"x',s=>s.edges[0].color='url(https://example.com)',s=>s.nodes[0].x='1',s=>s.groups.push({id:'bad',x:0,y:0,w:100,h:100,parent:'bad'})]){const copy=Edit.clone(by('layered'));mutate(copy);assert.throws(()=>Edit.validateImport(copy));}
  assert.throws(()=>Edit.validateImport({canvas:{},nodes:[],edges:[]}),/V2/);
});
const report={passed:true,checks,scope:'Geometry and model invariants; actual pointer gestures, history and file reopen are verified separately.'};
fs.writeFileSync(path.join(root,'outputs/Topology_V2_Design/verification/editor-model-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,checks:checks.length}));
