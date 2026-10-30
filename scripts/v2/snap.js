(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./scene.js'));
  else root.TopologySnap=factory(root.TopologyScene);
})(typeof globalThis!=='undefined'?globalThis:this,function(Scene){
  'use strict';
  // Distances are CSS screen pixels, independent of the SVG viewBox and zoom.
  const ENTER=5,LEAVE=8,TAU=2*Math.PI;
  const mod=a=>(a%TAU+TAU)%TAU;
  const radius=n=>n.compact?32:42;
  const portNames=['东 0°','东南 45°','南 90°','西南 135°','西 180°','西北 225°','北 270°','东北 315°'];
  function ports(n){return Array.from({length:8},(_,i)=>({x:n.x+radius(n)*Math.cos(i*Math.PI/4),y:n.y+radius(n)*Math.sin(i*Math.PI/4),angle:i*45,label:portNames[i],key:'port:'+n.id+':'+i}));}
  function ringPoints(r){
    const points=Array.from({length:8},(_,i)=>({x:r.cx+r.rx*Math.cos(i*Math.PI/4),y:r.cy+r.ry*Math.sin(i*Math.PI/4),key:'ring:'+r.id+':octant:'+i,label:i%2?'环网八分位':'环网轴点'}));
    Scene.ringPositions({...r,phase:0},8).forEach((p,i)=>points.push({...p,key:'ring:'+r.id+':arc:'+i,label:'环网等弧长八分位'}));
    return points;
  }
  function descendants(m,id){
    const ids=new Set([id]);let changed=true;
    while(changed){changed=false;for(const g of m.groups)if(ids.has(g.parent)&&!ids.has(g.id)){ids.add(g.id);changed=true;}}
    return ids;
  }
  function ringMemberValid(m,r,n,p){
    const idx=r.members.indexOf(n.id),byId=id=>m.nodes.find(n=>n.id===id),prev=byId(r.members[(idx+r.members.length-1)%r.members.length]),next=byId(r.members[(idx+1)%r.members.length]);
    if(!prev||!next)return false;
    const angle=p=>Math.atan2((p.y-r.cy)/r.ry,(p.x-r.cx)/r.rx),dir=r.clockwise===false?-1:1;
    return mod(dir*(angle(p)-angle(prev)))<mod(dir*(angle(next)-angle(prev)))&&
      !m.nodes.some(other=>other.id!==n.id&&r.members.includes(other.id)&&Math.hypot(p.x-other.x,p.y-other.y)<radius(n)+radius(other)+12);
  }
  function create(m,g){
    const ctx={kind:g.kind,id:g.id,end:g.end,axis:g.axis,model:m,x:[],y:[],points:[],latch:{},box:g.box};
    const moving=new Set(),movingGroups=g.kind==='group'?descendants(m,g.id):new Set(),n=m.nodes.find(n=>n.id===g.id),r=m.rings.find(r=>r.id===g.id);
    if(g.kind==='anchor'){
      const edge=m.edges.find(e=>e.id===g.id);ctx.owner=m.nodes.find(n=>n.id===edge?.[g.end]);
      ctx.points=ctx.owner?ports(ctx.owner):[];return ctx;
    }
    if(g.kind==='node'&&n){
      ctx.node=n;ctx.box={x:n.x-radius(n),y:n.y-radius(n),w:2*radius(n),h:2*radius(n)};moving.add(n.id);
      ctx.ring=m.rings.find(r=>r.members.includes(n.id));
      if(ctx.ring){
        ctx.points=ringPoints(ctx.ring);ctx.points.push({x:n.x,y:n.y,key:'ring:original',label:'环网原位置'});
        // Neighbor mid-gap gives a useful local symmetry target on irregular rings.
        const ring=ctx.ring,idx=ring.members.indexOf(n.id),prev=m.nodes.find(n=>n.id===ring.members[(idx+ring.members.length-1)%ring.members.length]),next=m.nodes.find(n=>n.id===ring.members[(idx+1)%ring.members.length]);
        if(prev&&next){
          const dir=ring.clockwise===false?-1:1,a=Math.atan2((prev.y-ring.cy)/ring.ry,(prev.x-ring.cx)/ring.rx),b=Math.atan2((next.y-ring.cy)/ring.ry,(next.x-ring.cx)/ring.rx),span=mod(dir*(b-a));
          let total=0,last=prev;const samples=[{...prev,length:0}];
          for(let i=1;i<=512;i++){const t=a+dir*span*i/512,p={x:ring.cx+ring.rx*Math.cos(t),y:ring.cy+ring.ry*Math.sin(t)};total+=Math.hypot(p.x-last.x,p.y-last.y);samples.push({...p,length:total});last=p;}
          const j=samples.findIndex(p=>p.length>=total/2),lo=samples[Math.max(0,j-1)],hi=samples[Math.max(0,j)],u=(total/2-lo.length)/(hi.length-lo.length||1),t=a+dir*span*(Math.max(0,j-1)+u)/512;
          ctx.points.push({x:ring.cx+ring.rx*Math.cos(t),y:ring.cy+ring.ry*Math.sin(t),key:'ring:midgap',label:'相邻设备等弧长中分'});
        }
        ctx.points=ctx.points.filter(p=>ringMemberValid(m,ctx.ring,n,p));return ctx;
      }
    }
    if(g.kind==='group'){
      const group=m.groups.find(x=>x.id===g.id);if(group)ctx.box={x:group.x,y:group.y,w:group.w,h:group.h};
      m.nodes.filter(n=>movingGroups.has(n.group)).forEach(n=>moving.add(n.id));
    }
    if((g.kind==='ring'||g.kind==='ring-size')&&r){
      ctx.box=g.kind==='ring-size'?{x:r.cx+r.rx,y:r.cy+r.ry,w:0,h:0}:{x:r.cx-r.rx,y:r.cy-r.ry,w:2*r.rx,h:2*r.ry};
      m.nodes.filter(n=>r.members.includes(n.id)||(g.kind==='ring'&&!n.group&&((n.x-r.cx)/r.rx)**2+((n.y-r.cy)/r.ry)**2<.98)).forEach(n=>moving.add(n.id));
    }
    if(g.kind==='junction'){
      const j=m.junctions.find(j=>j.id===g.id);if(j)ctx.box={x:j.x,y:j.y,w:0,h:0};
    }
    function axis(axis,value,from,to,key,label,priority,extra={}){ctx[axis].push({value,from,to,key:axis+':'+key,label,priority,family:key.split(':')[0],...extra});}
    function point(p,key,label,priority=1){ctx.points.push({...p,key,label,priority});}
    function box(b,key,label,priority=1,quarters=false){
      const fractions=quarters?[0,.25,.5,.75,1]:[0,.5,1];
      for(const f of fractions){
        const role=f===.5?'中线':f===.25||f===.75?'四分位':'边缘';
        axis('x',b.x+b.w*f,b.y,b.y+b.h,key+':'+f,label+role,priority,{referenceFeature:f});
        axis('y',b.y+b.h*f,b.x,b.x+b.w,key+':'+f,label+role,priority,{referenceFeature:f});
      }
      for(const a of fractions)for(const bfrac of fractions)point({x:b.x+b.w*a,y:b.y+b.h*bfrac},key+':'+a+':'+bfrac,label+'关键点',priority);
    }
    box({x:0,y:0,w:m.width,h:m.height},'canvas','画布',4,true);
    for(const group of m.groups)if(!movingGroups.has(group.id))box(group,'group:'+group.id,'区域',group.id===n?.group?0:1,true);
    for(const node of m.nodes)if(!moving.has(node.id)){
      const rad=radius(node);box({x:node.x-rad,y:node.y-rad,w:rad*2,h:rad*2},'node:'+node.id,'设备',2);
      ports(node).forEach(p=>point(p,p.key,'设备 '+p.label,1));
    }
    for(const ring of m.rings){
      if(ring.id===r?.id||ring.members.some(id=>moving.has(id)))continue;
      axis('x',ring.cx,ring.cy-ring.ry,ring.cy+ring.ry,'ring:'+ring.id,'环网中心线',1);
      axis('y',ring.cy,ring.cx-ring.rx,ring.cx+ring.rx,'ring:'+ring.id,'环网中心线',1);
      point({x:ring.cx,y:ring.cy},'ring:'+ring.id+':center','环网中心',0);
      for(const p of ringPoints(ring)){
        point(p,p.key,p.label,1);
        axis('x',p.x,p.y,p.y,p.key,p.label,2);axis('y',p.y,p.x,p.x,p.key,p.label,2);
      }
    }
    const movedGroup=m.groups.find(group=>g.kind==='group'&&group.id===g.id);
    for(const j of m.junctions)if(j.id!==g.id&&!movingGroups.has(j.group)&&!(movedGroup&&j.x>=movedGroup.x&&j.x<=movedGroup.x+movedGroup.w&&j.y>=movedGroup.y&&j.y<=movedGroup.y+movedGroup.h)&&!(g.kind==='ring'&&r&&((j.x-r.cx)/r.rx)**2+((j.y-r.cy)/r.ry)**2<.98)){
      point(j,'junction:'+j.id,'真实接点',1);axis('x',j.x,j.y,j.y,'junction:'+j.id,'真实接点',2);axis('y',j.y,j.x,j.x,'junction:'+j.id,'真实接点',2);
    }
    return ctx;
  }
  const distance=(a,b,s)=>Math.hypot((a.x-b.x)*s.x,(a.y-b.y)*s.y);
  function nearest(ctx,key,candidates,metric){
    const held=candidates.find(c=>c.key===ctx.latch[key]);
    let best=null,bestDistance=Infinity;
    for(const c of candidates){const d=metric(c),rank=c.rank??0,bestRank=best?.rank??0;
      if(d<=ENTER&&(!best||rank<bestRank||(rank===bestRank&&(d<bestDistance-1e-7||(Math.abs(d-bestDistance)<1e-7&&(c.priority??1)<(best.priority??1)))))){best=c;bestDistance=d;}
    }
    // A weak edge/region latch must not block deliberate icon-center alignment.
    const winner=held&&metric(held)<=LEAVE&&(!best||(held.rank??0)<=(best.rank??0))?held:best;
    if(winner)ctx.latch[key]=winner.key;else delete ctx.latch[key];return winner;
  }
  function update(ctx,raw,{scale={x:1,y:1},enabled=true,step=8}={}){
    const op={...raw},guides=[],labels=[];
    const round=n=>Math.round(n/step)*step;
    for(const k of ['dx','dy','x','y'])if(Number.isFinite(op[k]))op[k]=round(op[k]);
    if(!enabled){ctx.latch={};return {op,guides,label:''};}
    const activePoint=p=>{guides.push({type:'point',x:p.x,y:p.y});labels.push(p.label);};
    if(ctx.kind==='anchor'&&ctx.owner){
      const a=raw.angle*Math.PI/180,p={x:ctx.owner.x+radius(ctx.owner)*Math.cos(a),y:ctx.owner.y+radius(ctx.owner)*Math.sin(a)},target=nearest(ctx,'point',ctx.points,c=>distance(c,p,scale));
      if(target){op.angle=target.angle;activePoint(target);guides.push({type:'line',x1:ctx.owner.x,y1:ctx.owner.y,x2:target.x,y2:target.y});}
      return {op,guides,label:labels.join(' · ')};
    }
    if(ctx.ring&&ctx.node){
      const n=ctx.node,r=ctx.ring,a=Math.atan2((n.y+raw.dy-r.cy)/r.ry,(n.x+raw.dx-r.cx)/r.rx),p={x:r.cx+r.rx*Math.cos(a),y:r.cy+r.ry*Math.sin(a)},target=nearest(ctx,'point',ctx.points,c=>distance(c,p,scale));
      if(target){op.dx=target.x-n.x;op.dy=target.y-n.y;activePoint(target);}
      return {op,guides,label:labels.join(' · ')};
    }
    const direct=ctx.kind==='route'||ctx.kind==='control',box=direct?{x:raw.x,y:raw.y,w:0,h:0}:ctx.box?{x:ctx.box.x+raw.dx,y:ctx.box.y+raw.dy,w:ctx.box.w,h:ctx.box.h}:null;
    if(!box)return {op,guides,label:''};
    if(ctx.kind==='control'||ctx.kind==='junction'){
      const p={x:box.x,y:box.y},target=nearest(ctx,'point',ctx.points,c=>distance(c,p,scale));
      if(target){
        if(direct){op.x=target.x;op.y=target.y;}else{op.dx=target.x-ctx.box.x;op.dy=target.y-ctx.box.y;}
        ctx.latch.x=null;ctx.latch.y=null;activePoint(target);return {op,guides,label:labels.join(' · ')};
      }
    }
    for(const axis of ['x','y']){
      if(ctx.kind==='route'&&axis!==ctx.axis)continue;
      const size=axis==='x'?'w':'h',other=axis==='x'?'y':'x',otherSize=axis==='x'?'h':'w',fractions=box[size]?[0,.5,1]:[0],candidates=[];
      for(const target of ctx[axis])for(const f of fractions){
        let rank=0,label=target.label;
        if(ctx.kind==='node'){
          const peer=target.family==='node';
          rank=peer&&target.referenceFeature===.5&&f===.5?0:(peer&&target.referenceFeature===f)||(!peer&&f===.5)?1:2;
          if(rank===0)label='设备中心对齐';
        }
        candidates.push({...target,key:target.key+':feature:'+f,feature:f,rank,label,delta:target.value-(box[axis]+box[size]*f)});
      }
      const target=nearest(ctx,axis,candidates,c=>Math.abs(c.delta)*scale[axis]);
      if(target){
        if(direct)op[axis]=raw[axis]+target.delta;else op[axis==='x'?'dx':'dy']=raw[axis==='x'?'dx':'dy']+target.delta;
        const from=Math.min(target.from,box[other])-16,to=Math.max(target.to,box[other]+box[otherSize])+16;
        guides.push(axis==='x'?{type:'line',x1:target.value,y1:from,x2:target.value,y2:to}:{type:'line',x1:from,y1:target.value,x2:to,y2:target.value});labels.push(target.label);
      }
    }
    return {op,guides,label:[...new Set(labels)].join(' · ')};
  }
  return {create,update,ports,ringPoints,ringMemberValid,ENTER,LEAVE};
});
