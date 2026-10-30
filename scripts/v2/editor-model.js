(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./scene.js'));
  else root.TopologyEdit=factory(root.TopologyScene);
})(typeof globalThis!=='undefined'?globalThis:this,function(Scene){
  'use strict';
  const clone=value=>JSON.parse(JSON.stringify(value));
  const lists=['nodes','groups','edges','rings','junctions','annotations'];
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const point=p=>({x:p[0],y:p[1]});
  const movePair=(p,d)=>[p[0]+d.x,p[1]+d.y];
  const tau=2*Math.PI,mod=a=>(a%tau+tau)%tau;
  function objects(m){return new Map([...m.groups,...m.nodes,...m.junctions.map(j=>({...j,kind:'junction'})),...m.rings].map(n=>[n.id,n]));}
  function materialize(scene,view){
    scene.views=scene.views||{};
    const current=Scene.resolve(scene,view),target=scene.views[view]||(scene.views[view]={});
    lists.forEach(key=>{if(!Object.hasOwn(target,key))target[key]=clone(current[key]||[]);});
    return Scene.resolve(scene,view);
  }
  function requireUnlocked(items){if(items.some(n=>n.locked||n.position_locked))throw Error('所选对象或成员已锁定，不能移动。');}
  function edgeGeometry(e,m){const base=e.base_edge?m.edges.find(b=>b.id===e.base_edge):e;return Scene.geometry(base,objects(m));}
  function fitOrthogonal(edge,previous,m){
    const old=Scene.geometry(previous.edge,objects(previous.model));
    const now=Scene.geometry(edge,objects(m)),s=now.points[0],t=now.points.at(-1),p=old.points;
    if(Math.abs(s.x-t.x)<.001||Math.abs(s.y-t.y)<.001){edge.via=[];return;}
    const axis=(a,b)=>Math.abs(a.x-b.x)>=Math.abs(a.y-b.y)?'h':'v';
    const first=axis(p[0],p[1]),last=axis(p.at(-2),p.at(-1));
    if(first!==last)edge.via=first==='h'?[[t.x,s.y]]:[[s.x,t.y]];
    else if(first==='h'){
      const lane=p.length>2?p[1].x:(s.x+t.x)/2;
      edge.via=[[lane,s.y],[lane,t.y]];
    }else{
      const lane=p.length>2?p[1].y:(s.y+t.y)/2;
      edge.via=[[s.x,lane],[t.x,lane]];
    }
  }
  function retarget(m,before,deltas){
    for(const e of m.edges){
      const old=before.edges.find(x=>x.id===e.id),a=deltas.get(e.source)||{x:0,y:0},b=deltas.get(e.target)||{x:0,y:0};
      if(!a.x&&!a.y&&!b.x&&!b.y)continue;
      const together=Math.abs(a.x-b.x)<.001&&Math.abs(a.y-b.y)<.001;
      if(e.labelAt)e.labelAt=movePair(old.labelAt,{x:(a.x+b.x)/2,y:(a.y+b.y)/2});
      if(e.base_edge)continue;
      for(const end of ['source','target']){const d=end==='source'?a:b;if(e[end+'_point'])e[end+'_point']={x:old[end+'_point'].x+d.x,y:old[end+'_point'].y+d.y};}
      if(e.geometry==='ring')continue;
      if(together){
        for(const key of ['via','controls'])if(e[key])e[key]=old[key].map(p=>movePair(p,a));
      }else if(e.geometry==='curve'){
        // The first control belongs to the source, the second to the target.
        if(old.controls)e.controls=[movePair(old.controls[0],a),movePair(old.controls[1],b)];
      }else if(e.geometry!=='line')fitOrthogonal(e,{edge:old,model:before},m);
    }
  }
  function descendants(m,id){
    const ids=new Set([id]);let changed=true;
    while(changed){changed=false;m.groups.forEach(g=>{if(ids.has(g.parent)&&!ids.has(g.id)){ids.add(g.id);changed=true;}});}
    return ids;
  }
  function contains(box,p){return p.x>=box.x&&p.x<=box.x+box.w&&p.y>=box.y&&p.y<=box.y+box.h;}
  function moveItems(m,items,d){
    requireUnlocked(items);const deltas=new Map();
    for(const n of items){n.x+=d.x;n.y+=d.y;if(n.labelAt)n.labelAt=movePair(n.labelAt,d);if(n.id)deltas.set(n.id,d);}
    return deltas;
  }
  function moveRing(m,ring,d){
    const members=m.nodes.filter(n=>ring.members.includes(n.id));
    const inside=n=>((n.x-ring.cx)/ring.rx)**2+((n.y-ring.cy)/ring.ry)**2<.98;
    const items=[...members,...m.nodes.filter(n=>!ring.members.includes(n.id)&&!n.group&&inside(n)),...m.junctions.filter(inside),...m.annotations.filter(inside)];
    requireUnlocked([ring,...items]);
    ring.cx+=d.x;ring.cy+=d.y;return moveItems(m,items,d);
  }
  function moveNode(m,n,p){
    const rings=m.rings.filter(r=>r.members.includes(n.id));
    if(rings.length>1)throw Error('共享多环设备需整体调整各环，当前不能单独拖动。');
    requireUnlocked([n,...rings]);
    if(rings.length){
      const r=rings[0],a=Math.atan2((p.y-r.cy)/r.ry,(p.x-r.cx)/r.rx),dir=r.clockwise===false?-1:1,
        angle=v=>Math.atan2((v.y-r.cy)/r.ry,(v.x-r.cx)/r.rx),idx=r.members.indexOf(n.id),
        prev=m.nodes.find(x=>x.id===r.members[(idx+r.members.length-1)%r.members.length]),next=m.nodes.find(x=>x.id===r.members[(idx+1)%r.members.length]);
      if(mod(dir*(a-angle(prev)))>=mod(dir*(angle(next)-angle(prev))))throw Error('环上节点不能越过相邻设备，邻接顺序保持不变。');
      p={x:r.cx+r.rx*Math.cos(a),y:r.cy+r.ry*Math.sin(a)};
      if(m.nodes.some(other=>other.id!==n.id&&r.members.includes(other.id)&&distance(p,other)<(n.compact?32:42)+(other.compact?32:42)+12))throw Error('环上设备间距不足，请沿环选择更空的位置。');
    }
    const d={x:p.x-n.x,y:p.y-n.y};n.x=p.x;n.y=p.y;return new Map([[n.id,d]]);
  }
  function apply(input,view,op){
    const scene=clone(input),m=materialize(scene,view),before=clone(m),map=objects(m);
    let deltas=new Map();
    const n=map.get(op.id),d={x:op.dx||0,y:op.dy||0};
    if(op.kind==='node'){
      if(!m.nodes.includes(n))throw Error('设备不存在。');
      deltas=moveNode(m,n,{x:n.x+d.x,y:n.y+d.y});
    }else if(op.kind==='group'){
      const group=m.groups.find(g=>g.id===op.id);if(!group)throw Error('区域不存在。');
      const ids=descendants(m,op.id),items=[...m.groups.filter(g=>ids.has(g.id)),...m.nodes.filter(n=>ids.has(n.group)),...m.junctions.filter(j=>ids.has(j.group)||contains(group,j)),...m.annotations.filter(a=>ids.has(a.group)||contains(group,a))];
      for(const r of m.rings){const members=m.nodes.filter(n=>r.members.includes(n.id));
        if(members.some(n=>items.includes(n))){if(!members.every(n=>items.includes(n)))throw Error('该区域只包含部分环成员，请移动完整环网。');requireUnlocked([r]);r.cx+=d.x;r.cy+=d.y;}}
      deltas=moveItems(m,items,d);
    }else if(op.kind==='ring'){
      const ring=m.rings.find(r=>r.id===op.id);if(!ring)throw Error('环网不存在。');deltas=moveRing(m,ring,d);
    }else if(op.kind==='ring-size'){
      const r=m.rings.find(r=>r.id===op.id);if(!r)throw Error('环网不存在。');
      const members=m.nodes.filter(n=>r.members.includes(n.id));requireUnlocked([r,...members]);
      const rx=r.rx+d.x,ry=r.ry+d.y;if(rx<100||ry<100)throw Error('环网半径过小，请保留设备间距。');
      members.forEach(n=>{const x=r.cx+(n.x-r.cx)*rx/r.rx,y=r.cy+(n.y-r.cy)*ry/r.ry;deltas.set(n.id,{x:x-n.x,y:y-n.y});n.x=x;n.y=y;});
      r.rx=rx;r.ry=ry;
      for(let i=0;i<members.length;i++)for(let j=i+1;j<members.length;j++)if(distance(members[i],members[j])<(members[i].compact?32:42)+(members[j].compact?32:42)+12)throw Error('缩放后环上设备过近，请放大环网。');
    }else if(op.kind==='junction'){
      const j=m.junctions.find(j=>j.id===op.id);if(!j)throw Error('接点不存在。');deltas=moveItems(m,[j],d);
    }else if(op.kind==='node-label'){
      if(!n)throw Error('设备不存在。');requireUnlocked([n]);n.labelOffset=movePair(n.labelOffset||[0,0],d);
    }else if(op.kind==='annotation'){
      const a=m.annotations[op.index];if(!a)throw Error('说明不存在。');moveItems(m,[a],d);
    }else{
      let e=m.edges.find(e=>e.id===op.id);if(!e)throw Error('线路不存在。');
      if(op.kind!=='edge-label'&&e.base_edge)e=m.edges.find(b=>b.id===e.base_edge);
      requireUnlocked([e]);
      if(op.kind==='edge-label'){
        const p=e.labelAt?point(e.labelAt):edgeGeometry(e,m).at(.5);e.labelAt=[p.x+d.x,p.y+d.y-(e.labelAt?0:23)];
      }else{
        if(e.geometry==='ring')throw Error('环段必须沿共同骨架；请移动环上节点或整体环网。');
        const old=clone(e),oldModel=clone(m),geo=Scene.geometry(e,map),s=geo.points[0],t=geo.points.at(-1);
        if(op.kind==='anchor'){
          const owner=map.get(e[op.end]);if(!owner||owner.w!=null||owner.kind==='junction')throw Error('此端点使用区域边界或真实接点，不能改为设备端口。');
          requireUnlocked([owner]);e[op.end+'_anchor']={angle:op.angle};delete e[op.end+'_point'];delete e[op.end+'_offset'];
          if(e.geometry==='curve'&&e.controls){const changed=Scene.geometry(e,map).points,idx=op.end==='source'?0:1,from=op.end==='source'?s:t,to=op.end==='source'?changed[0]:changed.at(-1);e.controls[idx]=movePair(e.controls[idx],{x:to.x-from.x,y:to.y-from.y});}
          else if(e.geometry!=='line')fitOrthogonal(e,{edge:old,model:oldModel},m);
        }else if(op.kind==='control'){
          if(e.geometry!=='curve')throw Error('只有曲线使用曲线控制点。');e.controls=clone(e.controls||[[geo.points[1].x,geo.points[1].y],[geo.points[2].x,geo.points[2].y]]);e.controls[op.index]=[op.x,op.y];
        }else if(op.kind==='route'){
          if(e.geometry==='line')throw Error('直线不含折点；请先选择圆角折线或曲线。');
          if(e.geometry==='curve')throw Error('请拖动曲线的两个控制点。');
          const axis=op.axis||((e.via||[]).length&&Math.abs(e.via[0][0]-s.x)<.01?'y':'x');
          e.via=axis==='x'?[[op.x,s.y],[op.x,t.y]]:[[s.x,op.y],[t.x,op.y]];
        }else if(op.kind==='geometry'){
          if(!['line','orthogonal','curve'].includes(op.geometry))throw Error('未知线路形状。');e.geometry=op.geometry;delete e.via;delete e.controls;
        }else if(op.kind==='reset-route'){
          delete e.via;delete e.controls;delete e.source_point;delete e.target_point;delete e.source_offset;delete e.target_offset;
        }else throw Error('不支持的编辑操作。');
      }
    }
    if(deltas.size)retarget(m,before,deltas);
    for(const e of m.edges)edgeGeometry(e,m);
    m.edit_validation={status:'draft',findings:['布局已修改，等待检查。']};
    scene.views[view].edit_validation=m.edit_validation;
    scene.coordinates='manual';scene.editor_version=1;
    return scene;
  }
  function validateImport(input){
    if(!input||input.schema_version!==2||!Array.isArray(input.nodes)||!Array.isArray(input.edges))throw Error('请选择 V2 场景 JSON；旧版模型请使用旧版编辑器。');
    const scene=clone(input),id=/^[A-Za-z0-9_.:-]{1,100}$/;
    let count=0;
    const visit=(v,key='',depth=0)=>{
      if(++count>100000||depth>24)throw Error('模型内容过大或嵌套过深。');
      if(typeof v==='number'&&(!Number.isFinite(v)||Math.abs(v)>100000))throw Error('模型包含无效坐标或数值。');
      if(['x','y','cx','cy','rx','ry','w','h','width','height','radius','channel_spacing','angle','phase','startAngle','state_at'].includes(key)&&typeof v!=='number')throw Error('坐标与尺寸必须是数值。');
      if(typeof v==='string'&&v.length>20000)throw Error('模型文本过长。');
      if(['labelAt','labelOffset','source_offset','target_offset','hop'].includes(key)&&(!Array.isArray(v)||v.length!==2||!v.every(Number.isFinite)))throw Error('位置偏移必须是两个数值。');
      if(['color','accent','fill'].includes(key)&&typeof v==='string'&&!/^(?:[a-zA-Z][a-zA-Z0-9-]*|#[a-fA-F0-9]{3,8})$/.test(v))throw Error('颜色必须是本地主题色名或十六进制颜色。');
      if(v&&typeof v==='object')for(const [k,value] of Object.entries(v)){
        if(['__proto__','prototype','constructor'].includes(k))throw Error('模型包含无效字段。');
        if(['dash','geometry','kind','semantics','type','status','role','presentation','source_anchor','target_anchor'].includes(k)&&typeof value==='string'&&!/^[A-Za-z0-9 _.,:-]+$/.test(value))throw Error('模型样式字段格式不正确。');
        visit(value,k,depth+1);
      }
    };visit(scene);
    if(!id.test(scene.id||''))throw Error('场景 ID 格式不正确。');
    if(scene.views&&Object.keys(scene.views).some(v=>!['overview','engineering'].includes(v)))throw Error('模型包含不支持的视图。');
    for(const view of ['overview',...(scene.views?.engineering?['engineering']:[])]){
      const m=Scene.resolve(scene,view),map=objects(m),items=[...m.nodes,...m.groups,...m.edges,...m.rings,...m.junctions];
      if(m.nodes.length>400||m.edges.length>2000||m.groups.length>100)throw Error('模型超出本地编辑器容量。');
      if(items.some(x=>!id.test(x.id||''))||new Set(items.map(x=>x.id)).size!==items.length)throw Error('模型 ID 缺失、重复或格式不正确。');
      for(const n of [...m.nodes,...m.groups,...m.junctions])if(!Number.isFinite(n.x)||!Number.isFinite(n.y))throw Error('对象位置不正确。');
      for(const g of m.groups)if(!(g.w>0&&g.h>0)||g.parent&&!m.groups.some(x=>x.id===g.parent))throw Error('区域边界或父区域不正确。');
      for(const n of m.nodes){if(n.group&&!m.groups.some(g=>g.id===n.group))throw Error('设备所属区域不存在。');if(n.deployment&&!['ha','stack','cluster','mlag'].includes(n.deployment))throw Error('未知组合标签。');}
      for(const e of m.edges){
        if(!map.has(e.source)||!map.has(e.target)||!['line','orthogonal','curve','ring'].includes(e.geometry))throw Error('线路端点或形状不正确。');
        if(e.base_edge&&!m.edges.some(b=>b.id===e.base_edge&&!b.base_edge&&b.source===e.source&&b.target===e.target))throw Error('业务流的基础线路引用不正确。');
        for(const key of ['via','controls'])if(e[key]&&(!Array.isArray(e[key])||e[key].length>2||e[key].some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))))throw Error('线路控制点不正确或超过两次转弯。');
        if(e.geometry==='curve'&&e.controls&&e.controls.length!==2)throw Error('曲线需要两个控制点。');
        const geo=edgeGeometry(e,m);
        if(e.geometry==='orthogonal')for(let i=1;i<geo.points.length;i++)if(Math.abs(geo.points[i].x-geo.points[i-1].x)>.002&&Math.abs(geo.points[i].y-geo.points[i-1].y)>.002)throw Error('圆角折线含斜向折段。');
      }
      const parents=new Map(m.groups.map(g=>[g.id,g.parent]));
      for(const g of m.groups){const seen=new Set();let p=g.id;while(p){if(seen.has(p))throw Error('区域不能循环嵌套。');seen.add(p);p=parents.get(p);}}
      if(m.width!=null&&(!(m.width>=400)||m.width>6000)||m.height!=null&&(!(m.height>=300)||m.height>6000))throw Error('画布尺寸应在本地编辑范围内。');
    }
    return scene;
  }
  function crossings(m){
    const segments=[],cells=new Map(),seen=new Set(),findings=new Set(),map=objects(m);
    for(const e of m.edges.filter(e=>!e.base_edge)){
      const geo=edgeGeometry(e,m),p=geo.kind==='ellipse-arc'||e.geometry==='curve'?Array.from({length:65},(_,i)=>geo.at(i/64)):geo.points;
      for(let i=1;i<p.length;i++)segments.push({e,a:p[i-1],b:p[i]});
    }
    const cross=(a,b)=>a.x*b.y-a.y*b.x;
    for(let i=0;i<segments.length;i++){
      const s=segments[i],{a,b}=s,loX=Math.floor(Math.min(a.x,b.x)/120),hiX=Math.floor(Math.max(a.x,b.x)/120),loY=Math.floor(Math.min(a.y,b.y)/120),hiY=Math.floor(Math.max(a.y,b.y)/120);
      for(let x=loX;x<=hiX;x++)for(let y=loY;y<=hiY;y++){
        const key=x+','+y,ids=cells.get(key)||[];
        for(const j of ids){
          if(seen.has(j+':'+i))continue;seen.add(j+':'+i);const t=segments[j];if(t.e.id===s.e.id)continue;
          const ab={x:b.x-a.x,y:b.y-a.y},cd={x:t.b.x-t.a.x,y:t.b.y-t.a.y},ac={x:t.a.x-a.x,y:t.a.y-a.y},den=cross(ab,cd);let hit=null;
          if(Math.abs(den)<1e-8){
            if(Math.abs(cross(ab,ac))>1e-6)continue;
            const axis=Math.abs(ab.x)>Math.abs(ab.y)?'x':'y',lo=Math.max(Math.min(a[axis],b[axis]),Math.min(t.a[axis],t.b[axis])),hi=Math.min(Math.max(a[axis],b[axis]),Math.max(t.a[axis],t.b[axis]));
            if(hi-lo>2)hit={overlap:true};
          }else{const u=cross(ac,cd)/den,v=cross(ac,ab)/den;if(u>=-1e-8&&u<=1+1e-8&&v>=-1e-8&&v<=1+1e-8)hit={x:a.x+u*ab.x,y:a.y+u*ab.y};}
          if(!hit)continue;
          const shared=[s.e.source,s.e.target].filter(id=>id===t.e.source||id===t.e.target);
          if(!hit.overlap&&shared.some(id=>{const n=map.get(id);return n&&distance(hit,n)<(n.kind==='junction'?2:(n.compact?32:42)+4);}))continue;
          if(!hit.overlap&&[...(s.e.gaps||[]),...(t.e.gaps||[])].some(p=>distance(hit,p)<6))continue;
          findings.add([s.e.id,t.e.id].sort().join(' / '));
        }
        ids.push(i);cells.set(key,ids);
      }
    }
    return [...findings];
  }
  return {clone,objects,materialize,apply,edgeGeometry,validateImport,crossings};
});
