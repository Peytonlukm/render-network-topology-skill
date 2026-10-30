'use strict';
// Observable standard invariants for the generated fixed-coordinate specimens.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const Scene=require('../scripts/v2/scene.js');
const root=path.join(__dirname,'..'),out=path.join(root,'outputs/Topology_V2_Design'),skill=root;
const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8'));
const models=fs.readdirSync(path.join(out,'models')).filter(n=>n.endsWith('.json')).map(n=>JSON.parse(fs.readFileSync(path.join(out,'models',n),'utf8')));
const failures=[],checks=[],fanoutCounts=new Set();
const check=(condition,message)=>{if(!condition)failures.push(message)};
const radius=n=>n.compact?32:42,dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const same=(a,b)=>dist(a,b)<.002;
function endpointError(p,id,objects){
  const n=objects.get(id);if(!n)return Infinity;
  if(n.kind==='junction')return dist(p,n);
  if(n.w!=null){const inside=p.x>=n.x-.002&&p.x<=n.x+n.w+.002&&p.y>=n.y-.002&&p.y<=n.y+n.h+.002;
    return inside?Math.min(Math.abs(p.x-n.x),Math.abs(p.x-n.x-n.w),Math.abs(p.y-n.y),Math.abs(p.y-n.y-n.h)):Infinity;}
  return Math.abs(dist(p,n)-radius(n));
}
function segments(points){const result=[];for(let i=1;i<points.length;i++)if(dist(points[i-1],points[i])>.001)result.push([points[i-1],points[i]]);return result;}
function intersection(a,b,c,d){
  const cross=(a,b)=>a.x*b.y-a.y*b.x,ab={x:b.x-a.x,y:b.y-a.y},cd={x:d.x-c.x,y:d.y-c.y},ac={x:c.x-a.x,y:c.y-a.y},den=cross(ab,cd);
  if(Math.abs(den)<1e-8){
    if(Math.abs(cross(ab,ac))>1e-6)return null;
    const axis=Math.abs(ab.x)>Math.abs(ab.y)?'x':'y',lo=Math.max(Math.min(a[axis],b[axis]),Math.min(c[axis],d[axis])),hi=Math.min(Math.max(a[axis],b[axis]),Math.max(c[axis],d[axis]));
    return hi-lo>2?{overlap:hi-lo}:null;
  }
  const t=cross(ac,cd)/den,u=cross(ac,ab)/den;
  return t>=-1e-8&&t<=1+1e-8&&u>=-1e-8&&u<=1+1e-8?{x:a.x+t*ab.x,y:a.y+t*ab.y}:null;
}
for(const model of models)for(const view of model.views?.engineering?['overview','engineering']:['overview']){
  const m=Scene.resolve(model,view),name=model.id+'/'+view,allEdges=[...model.edges,...Object.values(model.views||{}).flatMap(v=>v.edges||[]),...(model.member_edges||[])],knownEdges=new Map(allEdges.map(e=>[e.id,e]));
  const objects=new Map([...m.groups,...m.nodes,...m.junctions.map(n=>({...n,kind:'junction'})),...m.rings].map(n=>[n.id,n]));
  check(m.standards_version==='1.0'&&m.icon_revision==='sst-v4'&&m.coordinates==='curated',name+': missing version or curated boundary');
  check(JSON.stringify(m.design_tokens)===JSON.stringify(Scene.TOKENS),name+': undocumented token change');
  const fans=new Map(),routes=[];let bends=0,maxEndpointError=0;
  for(const g of m.groups)check(g.kind==='layer'||g.kind==='collection'||g.kind==='specimen'||['site','network','administrative','security','compute','capability'].includes(g.semantics),name+': decorative boundary '+g.id);
  for(const e of m.edges){
    check(['physical','logical','management','aggregate','business'].includes(e.semantics),name+': unknown semantics '+e.id);
    check(e.certainty==='actual'||['concept','pending'].includes(e.certainty),name+': missing certainty '+e.id);
    check((m.legend||[]).some(l=>l.semantics===e.semantics),name+': semantics missing from legend '+e.id);
    if(e.semantics==='physical')check(!e.direction&&!e.dash&&(!e.color||e.color==='line'||e.emphasis),name+': physical style mixes status/type '+e.id);
    const base=e.base_edge?m.edges.find(b=>b.id===e.base_edge):null;
    if(e.semantics==='business'){
      check(base&&base.source===e.source&&base.target===e.target&&base.status!=='failure',name+': invalid/failed base for business '+e.id);
      check(e.direction,name+': business direction missing '+e.id);
    }
    if(e.semantics==='aggregate'){
      check(e.members?.length>1,name+': aggregation lacks members '+e.id);
      for(const id of e.members||[])check(knownEdges.has(id),name+': unresolved member '+id);
      const count=e.members?.length,countForms=[String(count),['零','一','二','三','四','五','六','七','八','九','十'][count]].filter(Boolean);
      check(e.label&&countForms.some(value=>String(e.label).includes(value)),name+': member count absent from label '+e.id);
    }
    const geo=Scene.geometry(base||e,objects),source=geo.kind==='ellipse-arc'?geo.at(0):geo.points[0],target=geo.kind==='ellipse-arc'?geo.at(1):geo.points.at(-1);
    const error=Math.max(endpointError(source,e.source,objects),endpointError(target,e.target,objects));maxEndpointError=Math.max(maxEndpointError,error);
    check(error<.002,name+': endpoint off boundary '+e.id+' '+error);
    const seg=segments(geo.points);
    if(!['curve','ring'].includes((base||e).geometry)){
      check(seg.every(([a,b])=>Math.abs(a.x-b.x)<.002||Math.abs(a.y-b.y)<.002||(base||e).geometry==='line'),name+': non-orthogonal bend '+e.id);
      let turns=0;for(let i=1;i<seg.length;i++){const a=seg[i-1],b=seg[i];if(Math.abs((a[1].x-a[0].x)*(b[1].y-b[0].y)-(a[1].y-a[0].y)*(b[1].x-b[0].x))>.002)turns++;}
      bends=Math.max(bends,turns);check(turns<=2,name+': too many turns '+e.id+' '+turns);
    }
    if(e.port_group){const items=fans.get(e.port_group)||[];items.push({edge:e,p:source});fans.set(e.port_group,items);}
    if(e.semantics!=='business')routes.push({edge:e,segments:geo.kind==='ellipse-arc'||e.geometry==='curve'?segments(Array.from({length:97},(_,i)=>geo.at(i/96))):seg});
  }
  for(const [id,items] of fans){const n=objects.get(items[0].edge.source),ports=items.map(x=>({x:x.p.x-n.x,y:x.p.y-n.y})).sort((a,b)=>a.x-b.x);fanoutCounts.add(ports.length);
    for(let i=0;i<ports.length;i++){check(Math.abs(ports[i].x+ports.at(-1-i).x)<.002&&Math.abs(ports[i].y-ports.at(-1-i).y)<.002,name+': asymmetric axis ports '+id);if(i)check(dist(ports[i],ports[i-1])>=8,name+': crowded ports '+id);}
  }
  const crossings=[];
  for(let i=0;i<routes.length;i++)for(let j=i+1;j<routes.length;j++){
    const a=routes[i],b=routes[j],shared=[a.edge.source,a.edge.target].filter(id=>id===b.edge.source||id===b.edge.target),hits=[];
    for(const sa of a.segments)for(const sb of b.segments){const hit=intersection(...sa,...sb);if(!hit)continue;
      if(!hit.overlap&&shared.some(id=>{const n=objects.get(id);return n&&dist(hit,n)<(n.kind==='junction'?2:radius(n)+4)}))continue;
      if(!hit.overlap&&[...(a.edge.gaps||[]),...(b.edge.gaps||[])].some(p=>dist(hit,p)<6))continue;
      if(!hits.some(p=>!p.overlap&&!hit.overlap&&dist(p,hit)<3))hits.push(hit);
    }
    if(hits.length)crossings.push({a:a.edge.id,b:b.edge.id,hits});
  }
  check(!crossings.length,name+': unmarked crossing or independent overlap '+JSON.stringify(crossings));
  checks.push({scene:model.id,view,max_bends:bends,max_endpoint_error:maxEndpointError,independent_crossing_findings:crossings.length,edges:m.edges.length});
}
const luminance=hex=>{const rgb=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722};
const contrast=(a,b)=>{a=luminance(a);b=luminance(b);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
const contrasts=[];
for(const [theme,p] of Object.entries(Scene.PALETTES)){
  for(const text of ['ink','muted','soft'])for(const surface of ['paper','zone','inner','note','pipe']){const ratio=contrast(p[text],p[surface]);check(ratio>=4.5,theme+': text contrast '+text+'/'+surface+' '+ratio);contrasts.push({theme,foreground:text,background:surface,ratio});}
  for(const line of ['line','blue','cyan','pink','green','amber'])for(const surface of ['paper','zone','inner','pipe']){const ratio=contrast(p[line],p[surface]);check(ratio>=3,theme+': graphic contrast '+line+'/'+surface+' '+ratio);contrasts.push({theme,foreground:line,background:surface,ratio});}
  check(contrast(p.border,p.disc)>=3,theme+': circle outline contrast');
}
const sources=JSON.parse(fs.readFileSync(path.join(skill,'assets/fonts/sources.json'),'utf8'));
for(const entry of sources.files){const bytes=fs.readFileSync(path.join(skill,'assets/fonts',entry.file));check(crypto.createHash('sha256').update(bytes).digest('hex')===entry.sha256,'font integrity '+entry.file);}
const standard=fs.readFileSync(path.join(root,'references/topology-design-standard.md'));
for(const file of [path.join(skill,'references/topology-design-standard.md'),path.join(out,'正式设计规范_v1.0.md')])check(fs.readFileSync(file).equals(standard),'standard copy out of sync '+file);
const report={standards_version:'1.0',specimens:models.length,variants:manifest.variants.length,views:checks,fanout_counts:[...fanoutCounts].sort(),contrast_checks:contrasts,fonts_original_hashes:true,standard_copies:true,failures,passed:failures.length===0};
fs.mkdirSync(path.join(out,'verification'),{recursive:true});fs.writeFileSync(path.join(out,'verification/standard-checks.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,views:checks.length,contrast_checks:contrasts.length,fanout_counts:report.fanout_counts,failures}));
assert.equal(failures.length,0,'Standard invariants failed; see standard-checks.json');
