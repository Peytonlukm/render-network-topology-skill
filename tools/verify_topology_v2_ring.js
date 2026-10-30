'use strict';
// Exact-ellipse geometry, seam continuity, direction, and semantic closure.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Scene=require('../scripts/v2/scene.js');
const out=path.join(__dirname,'../outputs/Topology_V2_Design/verification');
const near=(a,b,message,epsilon=1e-8)=>assert.ok(Math.abs(a-b)<epsilon,`${message}: ${a} != ${b}`);
const same=(a,b,message)=>{near(a.x,b.x,message+' x');near(a.y,b.y,message+' y')};
const unit=v=>{const length=Math.hypot(v.x,v.y);return {x:v.x/length,y:v.y/length}};
function model(count=8,extra={}) {
  const ring={id:'cycle',cx:800,cy:495,rx:500,ry:260,...extra};
  const nodes=Scene.ringPositions(ring,count).map((p,i)=>({id:'node-'+i,label:'Node '+i,type:'router',...p}));
  ring.members=nodes.map(n=>n.id);
  const edges=nodes.map((n,i)=>({id:'edge-'+i,source:n.id,target:nodes[(i+1)%count].id,geometry:'ring',ring:ring.id}));
  return {id:'ring-test',title:'Ring verification',nodes,edges,rings:[ring]};
}
const objects=m=>new Map([...m.nodes,...m.rings].map(n=>[n.id,n]));
let cases=0,arcs=0,samples=0;
for(const count of [3,4,6,8,12,20,40])for(const [baseRx,baseRy] of [[360,360],[500,170],[190,460]])
for(const clockwise of [true,false])for(const startAngle of [-Math.PI/2,.37,4.8]) {
  const factor=Math.max(1,count/8),rx=baseRx*factor,ry=baseRy*factor;
  const m=model(count,{rx,ry,clockwise,startAngle}),map=objects(m),ring=m.rings[0];
  const geos=m.edges.map(e=>Scene.geometry(e,map));
  geos.forEach((g,i)=>{
    assert.equal(g.kind,'ellipse-arc');assert.match(g.d,/^M [-\d.]+ [-\d.]+ A /);
    near(Math.hypot(g.at(0).x-m.nodes[i].x,g.at(0).y-m.nodes[i].y),42,'source on circumference');
    near(Math.hypot(g.at(1).x-m.nodes[(i+1)%count].x,g.at(1).y-m.nodes[(i+1)%count].y),42,'target on circumference');
    same(g.skeletonAt(1),geos[(i+1)%count].skeletonAt(0),'closed skeleton seam');
    same(unit(g.skeletonTangent(1)),unit(geos[(i+1)%count].skeletonTangent(0)),'continuous skeleton tangent');
    const reverse=Scene.geometry({...m.edges[i],source:m.edges[i].target,target:m.edges[i].source},map);
    for(let j=0;j<=16;j++) {
      const u=j/16,p=g.at(u);
      near(((p.x-ring.cx)/rx)**2+((p.y-ring.cy)/ry)**2,1,'ellipse equation');
      same(p,reverse.at(1-u),'reversed arc uses the same short segment');samples++;
    }
    arcs++;
  });
  const lengths=geos.map(g=>{let length=0,prev=g.skeletonAt(0);for(let j=1;j<=1024;j++){const p=g.skeletonAt(j/1024);length+=Math.hypot(p.x-prev.x,p.y-prev.y);prev=p;}return length;});
  assert.ok(Math.max(...lengths)/Math.min(...lengths)<1.00005,'ellipse members must be spaced by arc length');
  cases++;
}

for(const extra of [{rx:0},{ry:-3},{cx:NaN},{startAngle:Infinity}])assert.throws(()=>Scene.ringPositions({...model().rings[0],...extra},8));
for(const count of [0,2,3.5])assert.throws(()=>Scene.ringPositions(model().rings[0],count));
{
  const m=model(),map=objects(m),edge=m.edges[0];
  assert.throws(()=>Scene.geometry({...edge,ring:'missing'},map));
  assert.throws(()=>Scene.geometry({...edge,target:'missing'},map));
  assert.throws(()=>Scene.geometry({...edge,target:m.nodes[2].id},map));
  m.nodes[1].x+=4;assert.throws(()=>Scene.geometry(edge,map));
}
{
  const m=model();m.rings[0].members[1]=m.rings[0].members[0];
  assert.throws(()=>Scene.geometry(m.edges[0],objects(m)));
}
{
  const m=model();Object.assign(m.nodes[1],{x:m.nodes[0].x,y:m.nodes[0].y});
  assert.throws(()=>Scene.geometry(m.edges[0],objects(m)));
}
const guideCount=svg=>(svg.match(/class="ring-guide"/g)||[]).length;
for(const theme of ['light','dark']) {
  const m=model();assert.equal(guideCount(Scene.render(m,{theme,motion:false})),1);
  const incomplete={...m,edges:m.edges.slice(0,-1)};
  assert.equal(guideCount(Scene.render(incomplete,{theme,motion:false})),0,'missing link must stay open');
  const filtered={...m,edges:m.edges.map((e,i)=>({...e,flow:i===0?'hidden':undefined}))};
  assert.equal(guideCount(Scene.render(filtered,{theme,flow:'shown',motion:false})),0,'filtered link must stay open');
  const reversed={...m,edges:m.edges.map(e=>({...e,source:e.target,target:e.source}))};
  assert.equal(guideCount(Scene.render(reversed,{theme,motion:false})),1);
  for(const presentation of ['pipe','bands','dual']) {
    const svg=Scene.render({...m,edges:m.edges.map(e=>({...e,presentation}))},{theme,motion:false});
    const connections=svg.match(/<g class="connections">([\s\S]*?)<\/g><g class="edge-labels">/)[1];
    const paths=[...connections.matchAll(/<path\b[^>]*\bd="([^"]+)"[^>]*>/g)].map(m=>m[1]);
    assert.ok(paths.length>=16);assert.ok(paths.every(d=>d.includes(' A ')),'parallel ring lines must retain arcs');
  }
}
const report={geometry_cases:cases,arcs,sampled_points:samples,node_counts:[3,4,6,8,12,20,40],
  shapes:['circle','wide-ellipse','tall-ellipse'],directions:['clockwise','counterclockwise'],
  equal_arc_length:true,exact_circumference_endpoints:true,shared_ellipse:true,closed_seams:true,tangent_continuity:true,reversed_arcs:true,
  invalid_geometry_rejected:true,missing_or_filtered_link_stays_open:true,parallel_channels_preserve_arcs:true};
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'ring-checks.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
