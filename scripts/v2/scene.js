/* Topology V2 design primitives. Shared by the Node builder and offline viewer.
 * Coordinates in this first-stage specimen are curated, not auto-layout results.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TopologyScene = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const PALETTES = {
    light: {paper:'#FFFFFF',ink:'#00296D',muted:'#526B86',soft:'#566D87',rule:'#D7E2EE',zone:'#F5F8FC',inner:'#FFFFFF',note:'#F4F7FB',disc:'#F0F5FC',border:'#6C87A6',line:'#62778D',blue:'#007FB9',cyan:'#007E9E',pink:'#CF327F',green:'#188771',amber:'#946000',failure:'#BB3546',pipe:'#E9F0F7',standby:'#667589'},
    dark: {paper:'#0B182A',ink:'#E8F1FF',muted:'#A0B4CE',soft:'#8CA4C1',rule:'#2C425D',zone:'#102139',inner:'#142A45',note:'#14263D',disc:'#10294D',border:'#6F8AAB',line:'#8298B3',blue:'#65C6F4',cyan:'#56D4EE',pink:'#F283B7',green:'#63C9AE',amber:'#F2BA55',failure:'#FF8494',pipe:'#1D3652',standby:'#A0B0C8'}
  };
  // One pixel below the first visual-review batch, applied to every diagram role.
  const TYPE = Object.freeze({title:27,subtitle:13,eyebrow:10,region:17,regionNote:11,
    node:13,meta:10,edge:11,noteTitle:14,noteBody:11,legend:11,footer:9});
  const TOKENS=Object.freeze({diameter:84,compactDiameter:64,frameWidth:2.4,glyphRatio:(Math.sqrt(5)-1)/2,
    radius:12,compactRadius:8,parallelSpacing:12,compactParallelSpacing:8,maxBends:2,
    primaryWidth:2.6,normalWidth:1.8,auxiliaryWidth:1.5,minNodeFont:13});
  const CATEGORIES = {'router':'network','core-switch':'network','virtual-switch':'network','wireless-ap':'network','firewall':'security','zero-trust-gateway':'security','server':'compute','virtual-machine':'compute','kubernetes':'compute','storage':'storage','rack':'storage','ups':'storage','internet':'network','cloud':'compute','laptop':'endpoint'};
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const f = n => String(Math.round(Number(n)*1000)/1000);
  const pt = p => `${f(p.x)} ${f(p.y)}`;
  const distance = (a,b) => Math.hypot(b.x-a.x,b.y-a.y);
  const lerp = (a,b,t) => ({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});

  function resolve(scene, view) {
    const selected = scene.views?.[view] || scene.views?.overview || {};
    return {...scene,...selected,groups:selected.groups||scene.groups||[],nodes:selected.nodes||scene.nodes||[],edges:selected.edges||scene.edges||[],junctions:selected.junctions||scene.junctions||[],rings:selected.rings||scene.rings||[],annotations:selected.annotations||scene.annotations||[]};
  }

  function validateRing(ring) {
    if(!ring || !['cx','cy','rx','ry'].every(k=>Number.isFinite(ring[k])) || ring.rx<=0 || ring.ry<=0 ||
       (ring.startAngle!=null&&!Number.isFinite(ring.startAngle)) || (ring.phase!=null&&!Number.isFinite(ring.phase)))
      throw Error('Ring requires a finite center and positive ellipse radii.');
  }

  function ringPositions(ring,count=ring.members?.length) {
    validateRing(ring);
    if(!Number.isInteger(count)||count<3)throw Error('A ring requires at least three members.');
    const direction=ring.clockwise===false?-1:1,start=ring.startAngle??-Math.PI/2;
    const steps=8192,angles=[start],lengths=[0];let previous={x:ring.rx*Math.cos(start),y:ring.ry*Math.sin(start)};
    for(let i=1;i<=steps;i++){
      const a=start+direction*2*Math.PI*i/steps,p={x:ring.rx*Math.cos(a),y:ring.ry*Math.sin(a)};
      angles.push(a);lengths.push(lengths.at(-1)+distance(previous,p));previous=p;
    }
    const total=lengths.at(-1),phase=ring.phase||0;
    return Array.from({length:count},(_,i)=>{
      const target=(((i+phase)/count)%1+1)%1*total;
      let lo=0,hi=steps;while(hi-lo>1){const mid=(lo+hi)>>1;if(lengths[mid]<target)lo=mid;else hi=mid;}
      const u=(target-lengths[lo])/(lengths[hi]-lengths[lo]),angle=angles[lo]+(angles[hi]-angles[lo])*u;
      return {x:ring.cx+ring.rx*Math.cos(angle),y:ring.cy+ring.ry*Math.sin(angle)};
    });
  }

  function ringGeometry(edge,objects) {
    const ring=objects.get(edge.ring);validateRing(ring);
    const members=ring.members||[],i=members.indexOf(edge.source),j=members.indexOf(edge.target),n=members.length;
    if(n<3||i<0||j<0||new Set(members).size!==n)throw Error('Ring endpoints must belong to one ordered cycle.');
    const forward=(i+1)%n===j,backward=(j+1)%n===i;
    if(!forward&&!backward)throw Error('Ring arcs must connect adjacent cycle members.');
    const s=center(edge.source,objects),t=center(edge.target,objects);
    for(const p of [s,t])if(Math.abs(((p.x-ring.cx)/ring.rx)**2+((p.y-ring.cy)/ring.ry)**2-1)>1e-6)
      throw Error('Ring member is outside its shared ellipse; update the ring layout first.');
    const a=Math.atan2((s.y-ring.cy)/ring.ry,(s.x-ring.cx)/ring.rx);
    const b=Math.atan2((t.y-ring.cy)/ring.ry,(t.x-ring.cx)/ring.rx);
    const direction=(ring.clockwise===false?-1:1)*(forward?1:-1),tau=2*Math.PI;
    const span=((direction*(b-a))%tau+tau)%tau,delta=direction*span;
    if(span<1e-9)throw Error('Adjacent ring members must occupy distinct positions.');
    const skeletonAt=u=>{const angle=a+delta*u;return {x:ring.cx+ring.rx*Math.cos(angle),y:ring.cy+ring.ry*Math.sin(angle)}};
    function arc(offset=0) {
      const rx=ring.rx-direction*offset,ry=ring.ry-direction*offset;
      if(!Number.isFinite(offset)||rx<=0||ry<=0)throw Error('Ring channel offset exceeds its ellipse radius.');
      const point=angle=>({x:ring.cx+rx*Math.cos(angle),y:ring.cy+ry*Math.sin(angle)});
      function clip(node,reverse) {
        const radius=node.compact?32:42,c={x:node.x,y:node.y};
        const from=u=>point(a+delta*(reverse?1-u:u));
        let lo=0,hi=0;
        for(let k=1;k<=128;k++){hi=k/128;if(distance(from(hi),c)>=radius)break;lo=hi;}
        if(hi===lo)throw Error('Ring arc has no visible clearance between devices.');
        for(let k=0;k<40;k++){const mid=(lo+hi)/2;if(distance(from(mid),c)<radius)lo=mid;else hi=mid;}
        return reverse?1-(lo+hi)/2:(lo+hi)/2;
      }
      const u0=clip(objects.get(edge.source),false),u1=clip(objects.get(edge.target),true);
      if(u1<=u0)throw Error('Ring members overlap; enlarge the ring or split the view.');
      const angle0=a+delta*u0,angle1=a+delta*u1;
      const at=u=>point(angle0+(angle1-angle0)*u);
      return {d:`M ${pt(at(0))} A ${f(rx)} ${f(ry)} 0 ${Math.abs(angle1-angle0)>Math.PI?1:0} ${direction>0?1:0} ${pt(at(1))}`,
        at,tangent:u=>{const angle=angle0+(angle1-angle0)*u;return {x:-rx*Math.sin(angle)*(angle1-angle0),y:ry*Math.cos(angle)*(angle1-angle0)}}};
    }
    const visible=arc();
    return {...visible,points:[visible.at(0),visible.at(1)],skeletonAt,
      skeletonTangent:u=>{const angle=a+delta*u;return {x:-ring.rx*Math.sin(angle)*delta,y:ring.ry*Math.cos(angle)*delta}},
      parallel:offset=>arc(offset).d,kind:'ellipse-arc',ringId:ring.id};
  }

  function closedRing(ring,edges) {
    const members=ring.members||[];
    return members.length>=3 && new Set(members).size===members.length && members.every((id,i)=>{
      const next=members[(i+1)%members.length];
      return edges.some(e=>e.geometry==='ring'&&e.ring===ring.id&&
        ((e.source===id&&e.target===next)||(e.source===next&&e.target===id)));
    });
  }

  function roundPath(raw, radius=12) {
    const points=raw.filter((p,i)=>!i||distance(p,raw[i-1])>0.01);
    if (!points.length) return '';
    let d=`M ${pt(points[0])}`;
    for(let i=1;i<points.length-1;i++) {
      const a=points[i-1],b=points[i],c=points[i+1];
      const ab=distance(a,b),bc=distance(b,c),r=Math.min(radius,ab/2,bc/2);
      const p=lerp(b,a,r/ab),q=lerp(b,c,r/bc);
      if(Math.abs((b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x))<0.01) d+=` L ${pt(b)}`;
      else d+=` L ${pt(p)} Q ${pt(b)} ${pt(q)}`;
    }
    if(points.length>1)d+=` L ${pt(points.at(-1))}`;
    return d;
  }

  function endpoint(id, anchor, other, objects) {
    if(typeof id==='object')return {x:id.x,y:id.y};
    const n=objects.get(id);
    if(!n)throw Error(`Unknown relation endpoint: ${id}`);
    if(n.kind==='junction')return {x:n.x,y:n.y};
    const cx=n.w!=null?n.x+n.w/2:n.x,cy=n.h!=null?n.y+n.h/2:n.y;
    const vectors={right:[1,0],left:[-1,0],top:[0,-1],bottom:[0,1],'top-right':[Math.SQRT1_2,-Math.SQRT1_2],'bottom-right':[Math.SQRT1_2,Math.SQRT1_2],'top-left':[-Math.SQRT1_2,-Math.SQRT1_2],'bottom-left':[-Math.SQRT1_2,Math.SQRT1_2]};
    const v=typeof anchor==='object'&&Number.isFinite(anchor.angle)?[Math.cos(anchor.angle*Math.PI/180),Math.sin(anchor.angle*Math.PI/180)]:vectors[anchor];
    const dx=other.x-cx,dy=other.y-cy,len=Math.hypot(dx,dy)||1;
    const vector=v||[dx/len,dy/len];
    if(n.w!=null)return {x:cx+vector[0]*n.w/2,y:cy+vector[1]*n.h/2};
    const r=n.compact?32:42;
    return {x:cx+vector[0]*r,y:cy+vector[1]*r};
  }

  function center(id,objects) {
    if(typeof id==='object')return id;
    const n=objects.get(id); if(!n)throw Error(`Missing object ${id}`);
    return {x:n.x+(n.w||0)/2,y:n.y+(n.h||0)/2};
  }

  function geometry(edge, objects) {
    if(edge.geometry==='ring')return ringGeometry(edge,objects);
    const s=edge.source_point?{...edge.source_point}:endpoint(edge.source,edge.source_anchor,center(edge.target,objects),objects);
    const t=edge.target_point?{...edge.target_point}:endpoint(edge.target,edge.target_anchor,center(edge.source,objects),objects);
    if(edge.source_offset){s.x+=edge.source_offset[0];s.y+=edge.source_offset[1];}
    if(edge.target_offset){t.x+=edge.target_offset[0];t.y+=edge.target_offset[1];}
    if(edge.geometry==='line'&&edge.via?.length)throw Error('An explicit straight line cannot contain bends.');
    const points=[s,...(edge.via||[]).map(p=>({x:p[0],y:p[1]})),t];
    if(edge.geometry==='curve') {
      const c=edge.controls||[[s.x+(t.x-s.x)*.45,s.y],[t.x-(t.x-s.x)*.45,t.y]];
      const a={x:c[0][0],y:c[0][1]},b={x:c[1][0],y:c[1][1]};
      const at=u=>{const v=1-u;return {x:v*v*v*s.x+3*v*v*u*a.x+3*v*u*u*b.x+u*u*u*t.x,y:v*v*v*s.y+3*v*v*u*a.y+3*v*u*u*b.y+u*u*u*t.y}};
      return {d:`M ${pt(s)} C ${pt(a)} ${pt(b)} ${pt(t)}`,points:[s,a,b,t],at};
    }
    if(points.length===2 && edge.geometry!=='line' && Math.abs(s.x-t.x)>1 && Math.abs(s.y-t.y)>1) {
      const x=(s.x+t.x)/2;points.splice(1,0,{x,y:s.y},{x,y:t.y});
    }
    const lengths=points.slice(1).map((p,i)=>distance(points[i],p)),total=lengths.reduce((a,b)=>a+b,0);
    const at=u=>{let left=total*u;for(let i=0;i<lengths.length;i++){if(left<=lengths[i])return lerp(points[i],points[i+1],left/(lengths[i]||1));left-=lengths[i]}return t};
    const compact=[edge.source,edge.target].some(id=>objects.get(id)?.compact);
    return {d:roundPath(points,edge.radius??(compact?TOKENS.compactRadius:TOKENS.radius)),points,at};
  }

  function offsetPoints(points, offset) {
    return points.map((p,i)=>{
      const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
      const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
      return {x:p.x-dy/len*offset,y:p.y+dx/len*offset};
    });
  }

  function textWidth(text,size=TYPE.node) {return [...String(text)].reduce((n,c)=>n+(c.charCodeAt(0)>255?1:.58),0)*size;}
  function text(x,y,value,cls,extra='') {return `<text x="${f(x)}" y="${f(y)}" class="${cls}" ${extra}>${esc(value)}</text>`;}

  function noteTextWidth(value,size) {
    return [...String(value)].reduce((width,char)=>width+size*(char.charCodeAt(0)>255?1:
      /\s/.test(char)?.34:/[MWmw@%#&]/.test(char)?.95:/[ilIjft.,:;'!|]/.test(char)?.34:
      /[A-Z]/.test(char)?.74:.64),0);
  }

  function wrapNote(value, maxWidth, size) {
    const lines=[];
    for(const paragraph of String(value).split('\n')) {
      let line='';
      for(const char of paragraph) {
        if(line && noteTextWidth(line+char,size)>maxWidth){lines.push(line.trimEnd());line='';}
        if(line||char.trim())line+=char;
      }
      lines.push(line.trimEnd());
    }
    return lines;
  }

  // Shared quiet tag treatment for captions, explanatory notes and disclaimers.
  function noteBox(x,y,entries,options={}) {
    const padX=options.padX??12,padY=options.padY??7;
    const natural=Math.max(...entries.map(e=>noteTextWidth(e.value,e.size)))+2*padX;
    const width=options.width??Math.min(options.maxWidth??1472,natural);
    const rows=entries.flatMap((e,i)=>wrapNote(e.value,Math.max(1,width-2*padX),e.size)
      .map((value,j)=>({...e,value,gap:i&&j===0?4:0,leading:Math.ceil(e.size*1.45)})));
    const height=2*padY+rows.reduce((h,row)=>h+row.leading+row.gap,0);
    let baseline=y+padY,content='';
    rows.forEach(row=>{
      baseline+=row.gap;
      content+=text(options.align==='center'?x+width/2:x+padX,baseline+row.size,row.value,row.cls,
        options.align==='center'?'text-anchor="middle"':'');
      baseline+=row.leading;
    });
    return `<g class="note-box ${options.className||''}" data-note-kind="${esc(options.kind||'annotation')}" data-bounds="${f(x)} ${f(y)} ${f(width)} ${f(height)}"><rect class="note-frame" x="${f(x)}" y="${f(y)}" width="${f(width)}" height="${f(height)}" rx="4"/>${content}</g>`;
  }

  function label(x,y,value,id) {
    const w=noteTextWidth(value,TYPE.edge)+20;
    return `<g data-edge-label="${esc(id)}">`+noteBox(x-w/2,y-12,[{value,cls:'edge-caption',size:TYPE.edge}],
      {width:w,padX:10,padY:4,align:'center',className:'edge-label',kind:'connection'})+'</g>';
  }

  function deploymentMarkup(n,r,assets,p) {
    if(!n.deployment)return '';
    const tag=assets.iconSystem?.deployments[n.deployment],metrics=assets.tagMetrics;
    if(!tag||!metrics)throw Error('Deployment tags require the current SST catalog and measured font metrics.');
    const layout=assets.iconSystem.layout,h=n.compact?layout.compactTagHeight:layout.tagHeight,
      size=n.compact?layout.compactTagFontSize:layout.tagFontSize,scale=size/metrics.em,m=metrics.labels[tag.label],
      [sx,sy,sw,sh]=metrics.symbols[n.deployment],symbolScale=.8,symbolWidth=sw*symbolScale,
      contentWidth=symbolWidth+6+(m.xMax-m.xMin)*scale,
      w=Math.max(n.compact?56:64,Math.ceil((contentWidth+(n.compact?18:22))/2)*2),
      x=-w/2,y=r-layout.tagBottomInset-h,tx=symbolWidth+6-m.xMin*scale,ty=h/2+(m.yMax+m.yMin)*scale/2;
    return `<g class="node-deployment" data-deployment="${esc(n.deployment)}" data-position="bottom" transform="translate(${f(x)} ${f(y)})"><title>${esc(tag.label+' · '+tag.description)}</title><rect class="deployment-shape" width="${w}" height="${h}" rx="${h/2}" fill="${p.ink}"/><g class="deployment-content" transform="translate(${f((w-contentWidth)/2)} 0)"><path class="deployment-symbol" d="${tag.path}" transform="translate(${f(-sx*symbolScale)} ${f(h/2-(sy+sh/2)*symbolScale)}) scale(${symbolScale})" fill="none" stroke="${p.paper}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><text class="deployment-text" x="${f(tx)}" y="${f(ty)}" font-size="${size}" font-family="IBM Plex Sans" font-weight="600" style="fill:${p.paper};font-kerning:none;font-variant-ligatures:none">${esc(tag.label)}</text></g></g>`;
  }

  function statusMarkup(n,r,p) {
    const status=n.status||(n.standby?'standby':n.focus?'highlight':'normal');if(status==='normal')return '';
    const shapes={warning:['M0-10 10 0 0 10-10 0Z','M0-4v5m0 4v.1'],
      alert:['M-5-9H5L10-4V4L5 9H-5L-10 4V-4Z','M0-4v5m0 4v.1'],
      failure:['M-5-9H5L10-4V4L5 9H-5L-10 4V-4Z','m-3-3 6 6m0-6-6 6'],
      standby:['M0-10A10 10 0 1 1 0 10A10 10 0 1 1 0-10Z','M-3-4v8m6-8v8'],
      highlight:['M0-10A10 10 0 1 1 0 10A10 10 0 1 1 0-10Z','m-4 0 3 3 5-6']};
    const [shape,mark]=shapes[status]||shapes.highlight,c=status==='warning'?p.amber:['alert','failure'].includes(status)?p.failure:status==='standby'?p.standby:p.blue,
      angle=(n.deployment?22.5:67.5)*Math.PI/180,d=r+7;
    return `<g class="node-state" data-status="${esc(status)}" transform="translate(${f(d*Math.cos(angle))} ${f(-d*Math.sin(angle))}) scale(${n.compact?.85:1})"><title>${esc(status)}</title><path class="state-shape" d="${shape}" fill="${c}" stroke="${p.disc}" stroke-width="2"/><path class="state-mark" d="${mark}" fill="none" stroke="${p.paper}" stroke-width="2.2" stroke-linecap="round"/></g>`;
  }

  function css(theme, prefix) {
    const p=PALETTES[theme];
    const rules = `.topology-v2{font-size:${TYPE.node}px;font-family:"Source Han Sans SC","Microsoft YaHei",Arial,sans-serif;color:${p.ink};text-rendering:geometricPrecision}.topology-v2 text{fill:${p.ink}}.topology-v2 .diagram-title{font-size:${TYPE.title}px;font-weight:650}.topology-v2 .diagram-subtitle{font-size:${TYPE.subtitle}px;fill:${p.muted}}.topology-v2 .eyebrow{font:${TYPE.eyebrow}px Consolas,monospace;letter-spacing:1.8px;fill:${p.soft}}.topology-v2 .region-title{font-size:${TYPE.region}px;font-weight:650}.topology-v2 .region-note{font-size:${TYPE.regionNote}px;fill:${p.muted}}.topology-v2 .node-name{font-size:${TYPE.node}px;font-weight:600}.topology-v2 .node-meta{font:${TYPE.meta}px Consolas,"Microsoft YaHei",monospace;fill:${p.muted}}.topology-v2 .edge-caption{font-size:${TYPE.edge}px;fill:${p.muted}}.topology-v2 .annotation-title{font-size:${TYPE.noteTitle}px;font-weight:600;fill:${p.muted}}.topology-v2 .annotation-body{font-size:${TYPE.noteBody}px;fill:${p.muted}}.topology-v2 .legend-text{font-size:${TYPE.legend}px;fill:${p.muted}}.topology-v2 .footer-note{font-size:${TYPE.footer}px;fill:${p.soft}}.topology-v2 .note-frame{fill:${p.note};stroke:${p.rule};stroke-width:1}.sst-solid{fill:var(--sst-ink);stroke:none}.sst-muted{fill:var(--sst-muted);stroke:none}.sst-accent{fill:var(--sst-accent);stroke:none}.sst-cutout{fill:var(--sst-cut);stroke:none}.sst-line,.sst-cut-line,.sst-accent-line{fill:none;stroke-width:3.5;stroke-linecap:round;stroke-linejoin:round}.sst-line{stroke:var(--sst-ink)}.sst-cut-line{stroke:var(--sst-cut)}.sst-accent-line{stroke:var(--sst-accent)}.topology-v2 .packet-moving{visibility:hidden}.topology-v2 .packet-static{visibility:visible}.topology-v2.is-playing .packet-moving{visibility:visible}.topology-v2.is-playing .packet-static{visibility:hidden}@media(prefers-reduced-motion:reduce){.topology-v2 .packet-moving{visibility:hidden!important}.topology-v2 .packet-static{visibility:visible!important}}`;
    // Each comparison pane owns its theme; <use> glyph classes inherit variables.
    return rules.replaceAll('"Source Han Sans SC","Microsoft YaHei",Arial,sans-serif','"IBM Plex Sans","Source Han Sans SC","Microsoft YaHei",sans-serif')
      .replaceAll('Consolas,"Microsoft YaHei",monospace','"IBM Plex Sans","Source Han Sans SC",sans-serif')
      .replaceAll('Consolas,monospace','"IBM Plex Sans",sans-serif').replaceAll('.topology-v2', `[id="${prefix}-root"]`);
  }

  function render(scene, options={}) {
    const theme=options.theme||'light',p=PALETTES[theme],view=options.view||'overview';
    const m=resolve(scene,view),prefix=(options.prefix||`${scene.id}-${view}-${theme}`).replace(/[^a-zA-Z0-9_-]/g,'-');
    const assets=options.assets||{},width=m.width||1600,height=m.height||1000;
    const objects=new Map([...m.groups,...m.nodes,...m.junctions.map(j=>({...j,kind:'junction'})),...m.rings].map(n=>[n.id,n]));
    const color=k=>p[k]||k||p.line;
    const visibleEdges=m.edges.filter(e=>!e.flow||!options.flow||options.flow==='all'||e.flow===options.flow);
    let definitions=(assets.defs||'').replace(/id="([^"]+)"/g,(_,id)=>`id="${prefix}-${id}"`).replace(/href="#([^"]+)"/g,(_,id)=>`href="#${prefix}-${id}"`);
    let regions='',links='',labels='',nodes='',annotations='',legend='',markers='',ringGuides='';
    m.rings.forEach(ring=>{
      validateRing(ring);
      // A guide is only valid when real adjacency edges cover the closed cycle.
      if(closedRing(ring,visibleEdges))ringGuides+=`<ellipse class="ring-guide" data-ring-id="${esc(ring.id)}" cx="${f(ring.cx)}" cy="${f(ring.cy)}" rx="${f(ring.rx)}" ry="${f(ring.ry)}" fill="none" stroke="${p.line}" stroke-width="${ring.width||2.6}" opacity="0.32"/>`;
    });
    m.groups.forEach((g,i)=>{
      const fill=g.fill==='none'?'none':g.kind==='band'?p.pipe:g.parent?p.inner:p.zone;
      const border=g.accent?color(g.accent):p.rule;
      const framed=!['layer','collection','specimen'].includes(g.kind);
      regions+=`<g class="region" data-region-id="${esc(g.id)}" data-boundary="${framed?'semantic':'none'}" ${g.parent?`data-parent="${esc(g.parent)}"`:''}>`;
      if(framed)regions+=`<rect data-role="bounds" x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="${g.kind==='band'?6:10}" fill="${fill}" stroke="${border}" stroke-width="${g.accent?1.5:1}" ${g.dashed?'stroke-dasharray="7 6"':''}/>`;
      if(g.label)regions+=text(g.labelAt?.[0]??g.x+24,g.labelAt?.[1]??g.y+34,g.label,'region-title');
      if(g.note)regions+=noteBox(g.x+24,g.y+44,[{value:g.note,cls:'region-note',size:TYPE.regionNote}],
        {maxWidth:g.w-48,padX:9,padY:4,kind:'region'});
      if(g.tag)regions+=text(g.x+g.w-24,g.y+33,g.tag,'eyebrow','text-anchor="end"');
      regions+='</g>';
    });
    visibleEdges.forEach((e,i)=>{
      const base=e.base_edge?m.edges.find(b=>b.id===e.base_edge):null;
      if(e.base_edge&&!base)throw Error('Business overlay requires an existing base edge.');
      const geo=geometry(base||e,objects),stroke=e.status==='failure'?p.failure:color(e.color||'line'),
        weight=e.width||(e.role==='primary'?2.6:e.role==='redundant'?1.5:1.8),
        dash=e.dash||(e.semantics==='logical'?'7 6':e.semantics==='management'?'1 6':'');
      const marker=`${prefix}-arrow-${i}`;
      markers+=`<marker id="${marker}" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="10" orient="auto"><path d="M1 1 9 5 1 9" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker>`;
      const arrow=e.direction?` marker-end="url(#${marker})"`:'';
      const common=`fill="none" stroke-linecap="round" stroke-linejoin="round"`;
      links+=`<g class="connection" data-edge-id="${esc(e.id)}" data-source="${esc(typeof e.source==='string'?e.source:'point')}" data-target="${esc(typeof e.target==='string'?e.target:'point')}" data-semantics="${esc(e.semantics||'physical')}" data-role="${esc(e.role||'')}" data-base-edge="${esc(e.base_edge||'')}" data-presentation="${esc(e.presentation||'single')}">`;
      if(e.presentation==='pipe'||e.presentation==='bands') {
        const channels=e.channels||[{name:'承载',color:'blue'},{name:'业务',color:'cyan'},{name:'控制',color:'pink'}];
        const spacing=e.channel_spacing||([e.source,e.target].some(id=>objects.get(id)?.compact)?TOKENS.compactParallelSpacing:TOKENS.parallelSpacing),total=(channels.length-1)*spacing+10;
        links+=`<path class="connection-main pipe-casing" d="${geo.d}" stroke="${p.border}" stroke-width="${total+3}" ${common}/><path d="${geo.d}" stroke="${p.paper}" stroke-width="${total}" ${common}/>`;
        channels.forEach((c,k)=>{
          const offset=(k-(channels.length-1)/2)*spacing;
          const d=geo.parallel?geo.parallel(offset):e.geometry==='curve'?geo.d:roundPath(offsetPoints(geo.points,offset),12);
          links+=`<path class="channel" data-channel="${esc(c.name)}" d="${d}" stroke="${color(c.color)}" stroke-width="2.2" ${e.geometry==='curve'?`transform="translate(0 ${offset})"`:''} ${common}/>`;
        });
      }else if(e.presentation==='dual') {
        const spacing=[e.source,e.target].some(id=>objects.get(id)?.compact)?TOKENS.compactParallelSpacing:TOKENS.parallelSpacing;
        [-spacing/2,spacing/2].forEach((offset,k)=>links+=`<path ${k===0?'class="connection-main"':''} d="${geo.parallel?geo.parallel(offset):roundPath(offsetPoints(geo.points,offset),12)}" stroke="${k?color('standby'):stroke}" stroke-width="${weight}" ${common}/>`);
      }else {
        if(e.presentation==='overlay'||e.presentation==='packets')links+=`<path class="connection-base" d="${geo.d}" stroke="${p.line}" stroke-width="${weight+4}" ${common}/>`;
        links+=`<path class="connection-main" d="${geo.d}" stroke="${stroke}" stroke-width="${weight}" ${dash?`stroke-dasharray="${dash}"`:''} ${common}${arrow}/>`;
      }
      if(e.hop) {
        const [x,y]=e.hop;
        links+=`<path d="M ${x-9} ${y} H ${x+9}" fill="none" stroke="${p.paper}" stroke-width="${weight+5}"/><path d="M ${x-9} ${y} A 9 9 0 0 1 ${x+9} ${y}" fill="none" stroke="${stroke}" stroke-width="${weight}"/>`;
      }
      if(e.presentation==='packets'||e.presentation==='overlay') {
        [.22,.47,.73].forEach((u,k)=>{
          const pos=geo.at(u),packetColor=color((e.channels||[])[k]?.color||e.color||'blue');
          const before=geo.at(Math.max(0,u-.002)),after=geo.at(Math.min(1,u+.002));
          const angle=Math.atan2(after.y-before.y,after.x-before.x)*180/Math.PI;
          const box=`<rect x="-7" y="-4" width="14" height="8" rx="2" fill="${packetColor}" stroke="${p.paper}" stroke-width="1.5"/>`;
          links+=`<g class="packet-static" transform="translate(${pt(pos)}) rotate(${f(angle)})">${box}</g>`;
          if(options.motion!==false)links+=`<g class="packet-moving">${box}<animateMotion dur="${6-k*.7}s" begin="indefinite" repeatCount="indefinite" rotate="auto" path="${geo.d}"/></g>`;
        });
      }
      links+='</g>';
      if(e.state_label){
        const pos=geo.at(e.state_at??.5),c=e.status==='failure'?p.failure:p.amber;
        labels+=`<g class="edge-state" data-edge-state="${esc(e.status||'protection')}"><circle cx="${f(pos.x)}" cy="${f(pos.y)}" r="8" fill="${p.paper}" stroke="${c}" stroke-width="2"/><path d="M${f(pos.x-3)} ${f(pos.y-3)} l6 6 m0 -6 l-6 6" stroke="${c}" stroke-width="1.8"/></g>`;
      }
      if(e.label) {
        const pos=e.labelAt?{x:e.labelAt[0],y:e.labelAt[1]}:geo.at(.5);
        labels+=label(pos.x,pos.y-(e.labelAt?0:23),e.label,e.id);
      }
    });
    m.junctions.forEach(j=>links+=`<circle class="junction" data-junction-id="${esc(j.id)}" cx="${j.x}" cy="${j.y}" r="4.5" fill="${color(j.color||'blue')}" stroke="${p.paper}" stroke-width="2"/>`);

    m.nodes.forEach(n=>{
      const r=n.compact?32:42,bounds=assets.bounds?.[n.type],category=assets.iconSystem?.categories[n.type]||CATEGORIES[n.type]||'network',
        palette=assets.iconThemes?.[theme]||{},categoryKey=category==='security'?'security':['compute','storage'].includes(category)?'compute':['network','endpoint'].includes(category)?'network':'neutral',
        accent=n.accent?color(n.accent):palette['--sst-'+categoryKey]||p.blue;
      const group=m.groups.find(g=>g.id===n.group),framed=group&&!['layer','collection','specimen'].includes(group.kind),
        labelFill=group?.kind==='band'?p.pipe:framed?(group?.parent?p.inner:p.zone):p.paper;
      const stroke=n.focus?p.blue:p.border;
      nodes+=`<g class="node" data-node-id="${esc(n.id)}" data-icon-type="${esc(n.type)}" data-radius="${r}" transform="translate(${n.x} ${n.y})" style="--sst-accent:${accent}"><title>${esc(n.full_label||n.label)}${n.meta?' · '+esc(n.meta):''}</title><circle class="node-disc" r="${r}" fill="${p.disc}" stroke="${stroke}" stroke-width="${n.focus?3:2.4}"/>`;
      if(bounds) {
        const [x,y,w,h]=bounds,side=Math.max(w,h),size=n.deployment?(n.compact?26:41.5):2*r*TOKENS.glyphRatio,
          centerY=n.deployment?-14:0,vx=x+(w-side)/2,vy=y+(h-side)/2;
        nodes+=`<svg class="node-glyph" x="${-size/2}" y="${centerY-size/2}" width="${size}" height="${size}" viewBox="${vx} ${vy} ${side} ${side}"><use href="#${prefix}-sst-icon-${esc(n.type)}" width="64" height="64"/></svg>`;
      }else nodes+=`<svg class="node-glyph neutral" x="-23" y="-23" width="46" height="46" viewBox="0 0 64 64" fill="none" stroke="${p.ink}" stroke-width="2.6"><use href="#${prefix}-icon-${esc(n.type)}"/></svg>`;
      const lines=Array.isArray(n.label)?n.label:[n.label],nameWidth=Math.max(...lines.map(l=>textWidth(l,TYPE.node)),n.meta?textWidth(n.meta,TYPE.meta):0)+14;
      nodes+=`<g class="node-label" transform="translate(${n.labelOffset?.[0]||0} ${n.labelOffset?.[1]||0})"><rect x="${-nameWidth/2}" y="${r+9}" width="${nameWidth}" height="${lines.length*19+(n.meta?16:0)}" rx="3" fill="${labelFill}"/>`;
      lines.forEach((line,i)=>nodes+=text(0,r+24+i*19,line,'node-name','text-anchor="middle"'));
      if(n.meta)nodes+=text(0,r+42+(lines.length-1)*19,n.meta,'node-meta','text-anchor="middle"');
      nodes+='</g>';
      if(n.count)nodes+=`<g class="count-badge"><rect x="24" y="-53" width="45" height="23" rx="5" fill="${p.paper}" stroke="${p.rule}"/>${text(46,-37,'×'+n.count,'edge-caption','text-anchor="middle"')}</g>`;
      nodes+=deploymentMarkup(n,r,assets,p)+statusMarkup(n,r,p);
      nodes+='</g>';
    });
    m.annotations.forEach((a,index)=>{
      const entries=[{value:a.title,cls:'annotation-title',size:TYPE.noteTitle},
        ...(a.lines||[]).map(value=>({value,cls:'annotation-body',size:TYPE.noteBody}))];
      annotations+=`<g data-annotation-index="${index}">`+noteBox(a.x,a.y,entries,{width:a.w,maxWidth:width-a.x-64,
        className:'annotation',kind:'annotation',align:a.align})+'</g>';
    });
    const ly=height-58;
    let lx=64;
    (m.legend||[]).forEach(item=>{
      const c=color(item.color||'line');
      if(item.type==='area')legend+=`<rect x="${lx}" y="${ly-10}" width="26" height="15" rx="3" fill="${p.zone}" stroke="${c}"/>`;
      else if(item.type==='junction')legend+=`<circle cx="${lx+14}" cy="${ly-2}" r="4" fill="${c}"/>`;
      else if(item.type==='state')legend+=`<circle cx="${lx+16}" cy="${ly-2}" r="6" fill="${p.paper}" stroke="${c}" stroke-width="2"/>`;
      else legend+=`<path d="M ${lx} ${ly-2} H ${lx+32}" fill="none" stroke="${c}" stroke-width="${item.type==='pipe'?7:2}" ${item.dash?`stroke-dasharray="${item.semantics==='management'?'1 6':'7 6'}"`:''}/>`;
      legend+=text(lx+42,ly+2,item.label,'legend-text');lx+=textWidth(item.label,TYPE.legend)+91;
    });
    const meta=options.includeHeader===false?'':text(64,56,m.title,'diagram-title')+
      (m.subtitle?noteBox(64,70,[{value:m.subtitle,cls:'diagram-subtitle',size:TYPE.subtitle}],{maxWidth:width-128,padY:5,kind:'subtitle'}):'')+
      text(width-64,54,`${scene.number||'00'} / ${view==='engineering'?'DETAIL':'OVERVIEW'}${m.edit_validation?.status==='draft'?' / 编辑待修':''}`,'eyebrow','text-anchor="end"');
    const footer=noteBox(64,height-35,[{value:'SST TOPOLOGY / 合成设计场景 · '+(m.viewNote||'颜色与线宽表达类别，不代表测量值'),cls:'footer-note',size:TYPE.footer}],
      {maxWidth:width-128,padY:4,kind:'footer'});
    return `<svg xmlns="http://www.w3.org/2000/svg" id="${prefix}-root" class="topology-v2" style="--sst-ink:${p.ink};--sst-muted:${theme==='light'?'#A7BCDA':'#536E96'};--sst-cut:${p.disc}" data-scene="${esc(scene.id)}" data-view="${view}" data-theme="${theme}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="${prefix}-title ${prefix}-desc"><title id="${prefix}-title">${esc(m.title)}</title><desc id="${prefix}-desc">${esc(scene.description||m.subtitle||m.title)}</desc><defs><style>${esc((options.embedFonts===false?'':assets.fontCss||'')+css(theme,prefix))}</style>${definitions}${markers}</defs><rect class="paper" width="${width}" height="${height}" fill="${p.paper}"/>${meta}<g class="regions">${regions}</g><g class="ring-guides">${ringGuides}</g><g class="connections">${links}</g><g class="edge-labels">${labels}</g><g class="nodes">${nodes}</g><g class="annotations">${annotations}</g><path d="M64 ${height-95} H${width-64}" stroke="${p.rule}" stroke-width="1"/><g class="legend">${legend}</g>${footer}</svg>`;
  }
  return {PALETTES,TYPE,TOKENS,resolve,render,geometry,ringPositions,roundPath,endpoint,textWidth};
});
