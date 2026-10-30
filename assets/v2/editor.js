(function(root){
  'use strict';
  const S=root.TopologyScene,M=root.TopologyEdit,P=root.TopologySnap,NS='http://www.w3.org/2000/svg';
  function create(api){
    const q=s=>document.querySelector(s),drawing=api.drawing,histories=new Map();
    let enabled=false,selection=null,gesture=null,snapFeedback=null,heldAlt=false,heldShift=false,context='',lastError='',checkedFindings=[];
    const current=()=>S.resolve(api.scene(),api.view());
    const svg=()=>drawing.querySelector('svg.topology-v2');
    const history=()=>{const id=api.scene().id;if(!histories.has(id))histories.set(id,{undo:[],redo:[]});return histories.get(id);};
    function replace(scene){api.replace(scene);api.render();}
    function commit(before,view){
      if(JSON.stringify(api.scene())===JSON.stringify(before))return;
      const h=history();h.undo.push({scene:before,view});if(h.undo.length>80)h.undo.shift();h.redo=[];
      check();refresh();
    }
    function change(op){try{const before=M.clone(api.scene()),next=M.apply(before,api.view(),op);replace(next);commit(before,api.view());}catch(error){api.notify(error.message);}}
    function undo(redo=false){
      cancelGesture();const h=history(),from=redo?h.redo:h.undo,to=redo?h.undo:h.redo;if(!from.length)return;
      const entry=from.pop();to.push({scene:M.clone(api.scene()),view:api.view()});api.setView(entry.view);selection=null;replace(entry.scene);api.notify(redo?'已重做。':'已撤销。');
    }
    function point(event){const matrix=svg()?.getScreenCTM();return matrix?new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse()):null;}
    function bounds(el){
      if(!el)return null;const b=el.getBBox(),matrix=svg().getScreenCTM().inverse().multiply(el.getScreenCTM()),a=new DOMPoint(b.x,b.y).matrixTransform(matrix),z=new DOMPoint(b.x+b.width,b.y+b.height).matrixTransform(matrix);
      return {x:a.x,y:a.y,w:z.x-a.x,h:z.y-a.y};
    }
    function element(name,attrs){const e=document.createElementNS(NS,name);for(const [key,value] of Object.entries(attrs))e.setAttribute(key,String(value));return e;}
    function handle(parent,kind,id,x,y,extra={}){
      const e=element('circle',{cx:x,cy:y,r:7,class:'edit-handle','data-edit-kind':kind,'data-edit-id':id,...extra});parent.append(e);return e;
    }
    function choose(kind,id,index){
      if(kind==='edge'){
        const e=current().edges.find(e=>e.id===id);if(e?.base_edge){id=e.base_edge;api.notify('业务高亮跟随基础线路，已选中基础线。');}
      }
      selection={kind,id,index};refresh();
    }
    function refresh(){
      const root=svg();if(!root)return;
      drawing.classList.toggle('is-editing',enabled);q('#edit').setAttribute('aria-pressed',String(enabled));q('#edit').textContent=enabled?'完成编辑':'编辑';
      q('#editor-tools').hidden=!enabled;q('#editor-hint').hidden=!enabled;
      const snapStatus=q('#editor-snap-status');snapStatus.textContent=snapFeedback?.label?'吸附 · '+snapFeedback.label:q('#editor-snap').checked?(gesture&&(heldAlt||gesture.last?.altKey)?'吸附已暂停':'靠近吸附 · Alt 暂停'):'自由定位';snapStatus.dataset.active=String(!!snapFeedback?.label);
      q('#editor-undo').disabled=!history().undo.length;q('#editor-redo').disabled=!history().redo.length;
      q('#compare').disabled=enabled;q('#play').disabled=enabled||!drawing.querySelector('animateMotion')||matchMedia('(prefers-reduced-motion:reduce)').matches;
      root.querySelectorAll('.editor-overlay,.connection-hit').forEach(n=>n.remove());root.querySelectorAll('.editor-selected').forEach(n=>n.classList.remove('editor-selected'));
      if(!enabled)return;
      root.setAttribute('tabindex','0');root.setAttribute('aria-label','可编辑拓扑，选择对象后可用方向键微调');
      const m=current(),sel=q('#editor-selection');
      if(!gesture){sel.replaceChildren(new Option('点击图上对象，或从这里选择',''));
      for(const [kind,label,items] of [['node','设备',m.nodes],['group','区域',m.groups],['ring','环网',m.rings],['edge','线路',m.edges],['junction','接点',m.junctions],['annotation','说明',m.annotations]]){
        if(!items.length)continue;const group=document.createElement('optgroup');group.label=label;
        items.forEach((n,i)=>group.append(new Option(n.label||n.title||n.id||'说明 '+(i+1),kind+'|'+(n.id||i))));sel.append(group);
      }
      sel.value=selection?selection.kind+'|'+(selection.kind==='annotation'?selection.index:selection.id):'';}
      root.querySelectorAll('.connection').forEach(g=>{const p=g.querySelector('.connection-main');if(p)g.prepend(element('path',{d:p.getAttribute('d'),class:'connection-hit'}));});
      const overlay=element('g',{class:'editor-overlay','aria-hidden':'true'});root.append(overlay);
      for(const r of m.rings){
        handle(overlay,'ring',r.id,r.cx,r.cy-r.ry-26,{'data-selection-kind':'ring',class:'edit-handle ring-move-handle'});
        const label=element('text',{x:r.cx+15,y:r.cy-r.ry-22,class:'edit-ring-caption'});label.textContent='移动环网';overlay.append(label);
      }
      let selected,edge=null;
      if(selection){
        const escaped=CSS.escape(selection.id||'');
        selected=selection.kind==='node'?root.querySelector('[data-node-id="'+escaped+'"]'):selection.kind==='node-label'?root.querySelector('[data-node-id="'+escaped+'"] .node-label'):selection.kind==='group'?root.querySelector('[data-region-id="'+escaped+'"]'):selection.kind==='edge'?root.querySelector('[data-edge-id="'+escaped+'"]'):selection.kind==='edge-label'?root.querySelector('[data-edge-label="'+escaped+'"]'):selection.kind==='annotation'?root.querySelector('[data-annotation-index="'+selection.index+'"]'):null;
        selected?.classList.add('editor-selected');
        if(selection.kind==='group'){
          const g=m.groups.find(g=>g.id===selection.id);if(g)overlay.append(element('rect',{x:g.x,y:g.y,width:g.w,height:g.h,rx:4,class:'edit-selection-bounds'}));
        }
        if(selection.kind==='ring'){
          const r=m.rings.find(r=>r.id===selection.id);if(r){overlay.append(element('ellipse',{cx:r.cx,cy:r.cy,rx:r.rx+8,ry:r.ry+8,class:'edit-selection-bounds'}));handle(overlay,'ring-size',r.id,r.cx+r.rx,r.cy+r.ry);}
        }
        if(selection.kind==='edge'){
          edge=m.edges.find(e=>e.id===selection.id);
          if(edge&&edge.geometry!=='ring'&&!edge.locked){
            const geo=M.edgeGeometry(edge,m),map=M.objects(m);
            for(const [end,p] of [['source',geo.points[0]],['target',geo.points.at(-1)]]){
              const owner=map.get(edge[end]);if(owner&&owner.w==null&&owner.kind!=='junction')handle(overlay,'anchor',edge.id,p.x,p.y,{'data-end':end});
            }
            if(edge.geometry==='curve'){
              for(const [i,p] of geo.points.slice(1,3).entries()){
                const from=i?geo.points.at(-1):geo.points[0];overlay.append(element('path',{d:`M ${from.x} ${from.y} L ${p.x} ${p.y}`,class:'edit-control-guide'}));handle(overlay,'control',edge.id,p.x,p.y,{'data-index':i});
              }
            }else if(edge.geometry!=='line'){
              const p=geo.points.length>=4?{x:(geo.points[1].x+geo.points[2].x)/2,y:(geo.points[1].y+geo.points[2].y)/2}:geo.at(.5);
              handle(overlay,'route',edge.id,p.x,p.y,{'data-axis':geo.points.length>2&&Math.abs(geo.points[1].x-geo.points[0].x)<.01?'y':'x'});
            }
          }
        }
      }
      const matrix=root.getScreenCTM(),scale=Math.max(.01,Math.hypot(matrix.a,matrix.b));
      if(q('#editor-snap').checked){
        const ids=selection?.kind==='node'?[selection.id]:edge&&edge.geometry!=='ring'?[edge.source,edge.target]:[];
        for(const id of new Set(ids)){
          const n=m.nodes.find(n=>n.id===id);if(!n)continue;
          for(const p of P.ports(n))overlay.append(element('circle',{cx:p.x,cy:p.y,r:2.6/scale,class:'edit-snap-port','data-port-angle':p.angle}));
        }
      }
      if(snapFeedback?.label){
        overlay.setAttribute('data-snap-active',snapFeedback.label);
        for(const g of snapFeedback.guides)overlay.append(g.type==='point'?element('circle',{cx:g.x,cy:g.y,r:4/scale,class:'edit-snap-point'}):element('line',{x1:g.x1,y1:g.y1,x2:g.x2,y2:g.y2,class:'edit-snap-guide'}));
      }
      if(!gesture){q('#route-controls').hidden=!edge;q('#route-geometry').disabled=!edge||edge.locked||edge.geometry==='ring';q('#route-reset').disabled=!edge||edge.locked||edge.geometry==='ring';
      if(edge)q('#route-geometry').value=edge.geometry;
      q('#editor-context').textContent=edge?.geometry==='ring'?'环段沿共同骨架；可拖动节点、环网和线旁标签。':selection?'方向键移动，Shift 精调；靠近参考位置轻吸附，Alt 暂停吸附。':'拖动设备、区域或说明；名称和线旁标签可单独定位，Alt 暂停吸附。';
      const validation=m.edit_validation;
      q('#editor-validation').textContent=validation?.status==='draft'?'编辑待修 · '+(validation.findings?.length||0)+' 项':validation?.status==='checked'?'当前布局检查通过':'修改按当前视图保存';
      q('#editor-validation').dataset.state=validation?.status||'initial';
      const findings=q('#editor-findings');findings.replaceChildren();
      if(validation?.status==='draft')for(const message of (validation.findings||[]).slice(0,5)){const li=document.createElement('li');li.textContent=message;findings.append(li);}
      findings.hidden=!findings.children.length;}
    }
    function afterRender(){
      const next=api.scene().id+'|'+api.view();if(next!==context){context=next;selection=null;checkedFindings=[];}
      refresh();
    }
    function toggle(){cancelGesture();enabled=!enabled;selection=null;if(enabled)api.singleView();api.render();if(enabled)api.notify('已进入编辑。修改后请保存可编辑 HTML 或模型 JSON。');}
    function cancelGesture(){if(!gesture)return;const old=gesture.before;gesture=null;snapFeedback=null;replace(old);}
    function opFor(g,p,event){
      const step=event.shiftKey||heldShift?1:Number(q('#editor-grid').value),dx=p.x-g.start.x,dy=p.y-g.start.y;
      const op={kind:g.kind,id:g.id,index:g.index,dx,dy,axis:g.axis};
      if(g.kind==='anchor'){
        const m=S.resolve(g.before,g.view),e=m.edges.find(e=>e.id===g.id),n=m.nodes.find(n=>n.id===e[g.end]);
        op.end=g.end;op.angle=Math.atan2(p.y-n.y,p.x-n.x)*180/Math.PI;
      }else if(g.kind==='route'||g.kind==='control'){op.x=p.x;op.y=p.y;}
      const matrix=svg().getScreenCTM(),scale={x:Math.hypot(matrix.a,matrix.b),y:Math.hypot(matrix.c,matrix.d)};
      snapFeedback=P.update(g.snap,op,{scale,step,enabled:q('#editor-snap').checked&&!event.altKey&&!heldAlt});return snapFeedback.op;
    }
    drawing.addEventListener('pointerdown',event=>{
      if(!enabled||event.button!==0)return;
      const target=event.target,handle=target.closest?.('[data-edit-kind]');let kind,id,index,end,axis;
      if(handle){kind=handle.dataset.editKind;id=handle.dataset.editId;index=Number(handle.dataset.index);end=handle.dataset.end;axis=handle.dataset.axis;}
      else if(target.closest?.('[data-edge-label]')){kind='edge-label';id=target.closest('[data-edge-label]').dataset.edgeLabel;}
      else if(target.closest?.('.node-label')){kind='node-label';id=target.closest('.node').dataset.nodeId;}
      else if(target.closest?.('.node')){kind='node';id=target.closest('.node').dataset.nodeId;}
      else if(target.closest?.('[data-junction-id]')){kind='junction';id=target.closest('[data-junction-id]').dataset.junctionId;}
      else if(target.closest?.('[data-annotation-index]')){kind='annotation';index=Number(target.closest('[data-annotation-index]').dataset.annotationIndex);}
      else if(target.closest?.('.connection')){choose('edge',target.closest('.connection').dataset.edgeId);event.preventDefault();return;}
      else if(target.closest?.('.region')){kind='group';id=target.closest('.region').dataset.regionId;}
      else{selection=null;refresh();return;}
      choose(['anchor','route','control'].includes(kind)?'edge':kind==='ring-size'?'ring':kind,id,index);
      const p=point(event);if(!p)return;
      const selector=kind==='node-label'?'[data-node-id="'+CSS.escape(id)+'"] .node-label':kind==='edge-label'?'[data-edge-label="'+CSS.escape(id)+'"]':kind==='annotation'?'[data-annotation-index="'+index+'"]':null;
      gesture={kind,id,index,end,axis,start:p,before:M.clone(api.scene()),view:api.view(),pointer:event.pointerId,changed:false};
      gesture.snap=P.create(current(),{...gesture,box:selector?bounds(svg().querySelector(selector)):null});snapFeedback=null;
      drawing.setPointerCapture?.(event.pointerId);event.preventDefault();
    });
    function moveGesture(event){
      if(!gesture)return;const p=point(event);if(!p)return;gesture.last={clientX:event.clientX,clientY:event.clientY,shiftKey:event.shiftKey,altKey:event.altKey};
      try{
        if(!gesture.changed&&Math.hypot(p.x-gesture.start.x,p.y-gesture.start.y)<1)return;
        const op=opFor(gesture,p,event);
        const next=M.apply(gesture.before,gesture.view,op);api.replace(next);api.render();gesture.changed=true;lastError='';
      }catch(error){snapFeedback=null;gesture.snap.latch={};refresh();if(error.message!==lastError){lastError=error.message;api.notify(error.message);}}
    }
    document.addEventListener('pointermove',event=>{
      if(!gesture||event.pointerId!==gesture.pointer)return;moveGesture(event);
      event.preventDefault();
    },{passive:false});
    document.addEventListener('pointerup',event=>{if(!gesture||event.pointerId!==gesture.pointer)return;const g=gesture;gesture=null;snapFeedback=null;if(drawing.hasPointerCapture?.(event.pointerId))drawing.releasePointerCapture(event.pointerId);if(g.changed)commit(g.before,g.view);else refresh();});
    document.addEventListener('pointercancel',()=>cancelGesture());
    function modifier(event){
      if(!['Alt','Shift'].includes(event.key))return;
      if(event.key==='Alt')heldAlt=event.type==='keydown';else heldShift=event.type==='keydown';
      if(enabled&&gesture?.last){event.preventDefault();moveGesture({...gesture.last,altKey:heldAlt,shiftKey:heldShift});}
    }
    document.addEventListener('keyup',modifier);
    window.addEventListener('blur',()=>{heldAlt=false;heldShift=false;cancelGesture();});
    document.addEventListener('keydown',event=>{
      modifier(event);
      if(!enabled||event.target.closest('input,select,textarea,[contenteditable]'))return;
      if(event.key==='Escape'){event.preventDefault();if(gesture)cancelGesture();else{enabled=false;selection=null;api.render();}return;}
      if((event.ctrlKey||event.metaKey)&&['z','y'].includes(event.key.toLowerCase())){event.preventDefault();undo(event.key.toLowerCase()==='y'||event.shiftKey);return;}
      const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},v=directions[event.key];
      if(v&&selection&&['node','node-label','group','ring','junction','annotation','edge-label'].includes(selection.kind)){
        event.preventDefault();const step=event.shiftKey?1:Number(q('#editor-grid').value);change({...selection,dx:v[0]*step,dy:v[1]*step});
      }
    });
    function check(){
      const root=svg();if(!root)return [];
      const m=current(),findings=[],seen=new Set(),add=message=>{if(!seen.has(message)){findings.push(message);seen.add(message);}};
      const bounds=el=>{const b=el.getBBox(),matrix=root.getScreenCTM().inverse().multiply(el.getScreenCTM()),a=new DOMPoint(b.x,b.y).matrixTransform(matrix),z=new DOMPoint(b.x+b.width,b.y+b.height).matrixTransform(matrix);return {x:a.x,y:a.y,w:z.x-a.x,h:z.y-a.y};};
      const nodes=[...root.querySelectorAll('.nodes>.node')].map(el=>{const n=m.nodes.find(n=>n.id===el.dataset.nodeId);return {...n,r:n.compact?32:42,label:bounds(el.querySelector('.node-label')),pill:el.querySelector('.deployment-shape')?bounds(el.querySelector('.deployment-shape')):null};});
      const boxes=[...nodes.map(n=>({...n.label,id:'设备名称 '+n.id})),...[...root.querySelectorAll('.note-box,.region-title,.region-note')].map(el=>({...bounds(el),id:el.closest('[data-edge-label]')?'线路标签 '+el.closest('[data-edge-label]').dataset.edgeLabel:el.textContent.slice(0,18)}))];
      const inBox=(p,b,pad=2)=>p.x>b.x-pad&&p.x<b.x+b.w+pad&&p.y>b.y-pad&&p.y<b.y+b.h+pad;
      for(let i=0;i<nodes.length;i++){
        const n=nodes[i];for(const other of nodes.slice(i+1))if(Math.hypot(n.x-other.x,n.y-other.y)<n.r+other.r+8)add('设备 '+n.id+' 与 '+other.id+' 间距不足。');
        const g=m.groups.find(g=>g.id===n.group);if(g&&!['layer','collection','specimen'].includes(g.kind)&&(n.x-n.r<g.x||n.y-n.r<g.y||n.x+n.r>g.x+g.w||n.y+n.r>g.y+g.h))add('设备 '+n.id+' 超出所属区域。');
        if(n.x-n.r<0||n.y-n.r<110||n.x+n.r>m.width||n.y+n.r>m.height-100)add('设备 '+n.id+' 靠近画布标题、页脚或边缘。');
        for(const b of boxes){if(b.id==='设备名称 '+n.id)continue;const dx=Math.max(b.x-n.x,0,n.x-b.x-b.w),dy=Math.max(b.y-n.y,0,n.y-b.y-b.h);if(Math.hypot(dx,dy)<n.r+2)add(b.id+' 靠近设备 '+n.id+'。');}
      }
      root.querySelectorAll('.connection-main').forEach(path=>{
        const g=path.closest('.connection'),e=m.edges.find(e=>e.id===g.dataset.edgeId),len=path.getTotalLength();
        for(let i=0;i<=len;i+=4){const p=path.getPointAtLength(i);
          for(const n of nodes){if(n.id!==e.source&&n.id!==e.target&&Math.hypot(p.x-n.x,p.y-n.y)<n.r+2)add('线路 '+e.id+' 穿过设备 '+n.id+'。');if(n.pill&&inBox(p,n.pill,3))add('线路 '+e.id+' 靠近组合标签 '+n.id+'。');}
          for(const b of boxes)if(inBox(p,b))add('线路 '+e.id+' 穿过 '+b.id+'。');
        }
      });
      for(const ids of M.crossings(m))add('独立线路 '+ids+' 存在交叉或重叠，请调整走廊。');
      checkedFindings=findings;
      if(m.coordinates==='manual'||api.scene().editor_version){const scene=M.clone(api.scene()),target=M.materialize(scene,api.view());target.edit_validation={status:findings.length?'draft':'checked',findings};scene.views[api.view()].edit_validation=target.edit_validation;api.replace(scene);}
      api.render();return findings;
    }
    q('#edit').addEventListener('click',toggle);
    q('#editor-snap').addEventListener('change',()=>{if(gesture?.last)moveGesture(gesture.last);else{snapFeedback=null;refresh();}});
    q('#editor-undo').addEventListener('click',()=>undo());q('#editor-redo').addEventListener('click',()=>undo(true));
    q('#editor-check').addEventListener('click',()=>{const findings=check();api.render();api.notify(findings.length?'发现 '+findings.length+' 项布局问题，请按提示调整。':'当前布局的设备、名称与线路检查通过。');});
    q('#editor-selection').addEventListener('change',event=>{const [kind,id]=event.target.value.split('|');if(kind)choose(kind,kind==='annotation'?undefined:id,kind==='annotation'?Number(id):undefined);else{selection=null;refresh();}});
    q('#route-geometry').addEventListener('change',event=>{if(selection)change({kind:'geometry',id:selection.id,geometry:event.target.value});});
    q('#route-reset').addEventListener('click',()=>{if(selection)change({kind:'reset-route',id:selection.id});});
    q('#editor-reset').addEventListener('click',()=>{const before=M.clone(api.scene());selection=null;api.restoreInitial();api.render();commit(before,api.view());api.notify('已还原打开页面时的布局，可撤销。');});
    return {afterRender,cancelGesture,check,toggle,choose,undo,loaded(){histories.delete(api.scene().id);selection=null;context='';},get enabled(){return enabled;},get selection(){return selection;},get findings(){return checkedFindings;}};
  }
  root.TopologyEditor={create};
})(globalThis);
