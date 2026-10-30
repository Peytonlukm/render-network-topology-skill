(function(){
  'use strict';
  const data=JSON.parse(document.querySelector('#design-data').textContent), scenes=data.scenes, assets=data.assets;
  const q=s=>document.querySelector(s), drawing=q('#drawing'), reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const params=new URLSearchParams(location.hash.slice(1)||new URLSearchParams(data.viewState||{}).toString()),initial=new Map(scenes.map(s=>[s.id,TopologyEdit.clone(s)]));
  let editor=null;
  const state={scene:scenes.find(s=>s.id===params.get('scene'))||scenes[0],theme:params.get('theme')==='dark'?'dark':'light',view:params.get('view')==='engineering'?'engineering':'overview',compare:false,flow:(scenes.find(s=>s.id===params.get('scene'))||scenes[0]).default_flow||'all',playing:false,zoom:1};
  const notify=message=>{q('#toast').textContent=message;clearTimeout(notify.timer);notify.timer=setTimeout(()=>q('#toast').textContent='',3500)};
  function stopMotion(){drawing.querySelectorAll('svg.topology-v2').forEach(svg=>{svg.pauseAnimations?.();svg.classList.remove('is-playing')});state.playing=false;q('#play').textContent='播放业务流';q('#motion-status').textContent='静态呈现';}
  function staticSvg(){return TopologyScene.render(state.scene,{assets,theme:state.theme,view:state.view,flow:state.flow,motion:false,prefix:'export-'+state.scene.id+'-'+state.view+'-'+state.theme})}
  function download(name,type,content){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  function updateHash(){const p=new URLSearchParams({scene:state.scene.id,view:state.view,theme:state.theme});history.replaceState(null,'','#'+p)}
  function render(options={}){
    stopMotion();
    document.body.dataset.theme=state.theme;
    if(!state.scene.views?.[state.view])state.view='overview';
    q('#scene-name').textContent=state.scene.name;q('#scene-description').textContent=state.scene.subtitle;
    q('#scene-counter').textContent=state.scene.number+' / '+(state.scene.id==='connections'?'CONNECTIONS':state.scene.composition_example?'MIXED STUDY':'08 COMPOSITIONS');
    q('#scene-eyebrow').textContent=state.scene.id==='connections'?'LINE LANGUAGE / SIX EXPRESSIONS':'COMPOSITION STUDY / '+state.scene.family;
    document.querySelectorAll('.scene-tab').forEach(b=>{b.classList.toggle('active',b.dataset.scene===state.scene.id);b.setAttribute('aria-current',b.dataset.scene===state.scene.id?'page':'false')});
    q('#view-controls').hidden=!state.scene.views?.engineering;
    document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(state.view===b.dataset.view)));
    const select=q('#flow-filter');select.hidden=!state.scene.flows;
    select.replaceChildren(new Option('所有业务（比较）','all'),...(state.scene.flows||[]).map(f=>new Option(f.label,f.id)));select.value=state.flow;
    const themes=state.compare?['light','dark']:[state.theme];
    drawing.classList.toggle('compare',state.compare);
    drawing.innerHTML=themes.map(theme=>(state.compare?`<div class="compare-frame" style="--diagram:${TopologyScene.PALETTES[theme].paper};--muted:${TopologyScene.PALETTES[theme].muted}"><div class="frame-label">${theme==='light'?'LIGHT / 浅色':'DARK / 深色'}</div>`:'')+TopologyScene.render(state.scene,{assets,theme,view:state.view,flow:state.flow,embedFonts:false,prefix:'book-'+state.scene.id+'-'+state.view+'-'+theme})+(state.compare?'</div>':'')).join('');
    q('#theme').textContent=state.theme==='light'?'深色主题':'浅色主题';q('#compare').setAttribute('aria-pressed',String(state.compare));
    q('#read').textContent=state.scene.read;q('#meaning').textContent=state.scene.meaning;q('#focus').textContent=state.scene.focus;
    const current=TopologyScene.resolve(state.scene,state.view);
    q('#counts').textContent=`${current.nodes.length} 个显示对象 · ${current.edges.filter(e=>!e.flow).length} 个基础关系`;
    q('#play').disabled=!drawing.querySelector('animateMotion')||reduced.matches;
    q('#motion-note').textContent=reduced.matches?'系统已启用减少动态效果':'';
    if(!options.preserveZoom)state.zoom=1;applyZoom();updateHash();editor?.afterRender();
  }
  function applyZoom(){drawing.classList.toggle('zoomed',state.zoom>1);drawing.querySelectorAll('svg.topology-v2').forEach(svg=>{svg.style.width=state.zoom>1?Math.round(svg.viewBox.baseVal.width*state.zoom)+'px':''});q('#zoom-label').textContent=state.zoom===1?'适应画布':Math.round(state.zoom*100)+'%';}
  function selectScene(id){state.scene=scenes.find(s=>s.id===id)||scenes[0];state.flow=state.scene.default_flow||'all';state.view='overview';render();}
  q('#scene-nav').addEventListener('click',event=>{const button=event.target.closest('[data-scene]');if(button)selectScene(button.dataset.scene)});
  q('#theme').addEventListener('click',()=>{state.theme=state.theme==='light'?'dark':'light';render()});
  q('#compare').addEventListener('click',()=>{state.compare=!state.compare;render()});
  q('#view-controls').addEventListener('click',event=>{const button=event.target.closest('[data-view]');if(button){state.view=button.dataset.view;render()}});
  q('#flow-filter').addEventListener('change',event=>{state.flow=event.target.value;render()});
  q('#zoom-in').addEventListener('click',()=>{state.zoom=Math.min(1.75,state.zoom===1?1.1:state.zoom+.15);applyZoom()});
  q('#zoom-fit').addEventListener('click',()=>{state.zoom=1;applyZoom()});
  q('#fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await drawing.requestFullscreen()}catch{notify('可以使用“放大”查看线路细节。')}});
  q('#play').addEventListener('click',()=>{
    if(state.playing){stopMotion();return}if(reduced.matches)return;
    drawing.querySelectorAll('svg.topology-v2').forEach(svg=>{svg.classList.add('is-playing');svg.unpauseAnimations?.();svg.querySelectorAll('animateMotion').forEach(a=>a.beginElement?.())});
    state.playing=true;q('#play').textContent='暂停 / 静态';q('#motion-status').textContent='演示播放 · 速度不代表实际流量';
  });
  q('#export-svg').addEventListener('click',()=>{download(state.scene.id+'-'+state.view+'-'+state.theme+'.svg','image/svg+xml;charset=utf-8',staticSvg());notify('已生成当前视图的静态 SVG。')});
  q('#export-json').addEventListener('click',()=>{editor.check();download(state.scene.id+'-model.json','application/json;charset=utf-8',JSON.stringify(state.scene,null,2));notify('已生成含当前修改的模型 JSON。')});
  q('#save-html').addEventListener('click',()=>{
    editor.cancelGesture();editor.check();
    const copy=document.documentElement.cloneNode(true),viewState={scene:state.scene.id,view:state.view,theme:state.theme};
    const bundle=JSON.stringify({scenes,assets,viewState}).replace(/[<>&]/g,c=>({'<':'\\u003c','>':'\\u003e','&':'\\u0026'}[c]));
    copy.querySelector('#design-data').textContent=bundle;copy.querySelector('#drawing').replaceChildren();copy.querySelector('#toast').textContent='';
    copy.querySelector('#import-json').removeAttribute('value');
    download(state.scene.id+'-editable.html','text/html;charset=utf-8','<!doctype html>\n'+copy.outerHTML);
    notify('已生成可编辑 HTML；保存文件后，重新打开可继续编辑。');
  });
  q('#import-model').addEventListener('click',()=>q('#import-json').click());
  q('#import-json').addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file)return;
    try{
      if(file.size>5*1024*1024)throw Error('模型文件超过 5MB，请选择较小的 V2 场景 JSON。');
      const model=TopologyEdit.validateImport(JSON.parse(await file.text())),index=scenes.findIndex(s=>s.id===model.id);
      editor.cancelGesture();
      if(index<0){scenes.push(model);initial.set(model.id,TopologyEdit.clone(model));
        const button=document.createElement('button');button.className='scene-tab';button.dataset.scene=model.id;
        const label=document.createElement('span');label.className='nav-title';label.textContent=model.family||model.name||model.id;button.append(label);q('#scene-nav').append(button);
      }else scenes[index]=model;
      state.scene=model;state.view='overview';state.flow=model.default_flow||'all';initial.set(model.id,TopologyEdit.clone(model));editor.loaded();render();notify('已导入模型，可点击“编辑”继续修改。');
    }catch(error){notify('导入失败：'+error.message)}finally{event.target.value='';}
  });
  q('#export-png').addEventListener('click',async()=>{
    await document.fonts.ready;
    const svg=staticSvg(),image=new Image(),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'})),current=TopologyScene.resolve(state.scene,state.view);
    image.onload=()=>{try{const c=document.createElement('canvas');c.width=current.width||1600;c.height=current.height||1000;c.getContext('2d').drawImage(image,0,0,c.width,c.height);c.toBlob(blob=>{if(blob){download(state.scene.id+'-'+state.view+'-'+state.theme+'.png','image/png',blob);notify('已生成当前视图的静态 PNG。')}else notify('PNG 生成失败，请先导出 SVG。')},'image/png')}catch(error){notify('PNG 生成失败：'+error.message)}finally{URL.revokeObjectURL(url)}};
    image.onerror=()=>{URL.revokeObjectURL(url);notify('PNG 图形加载失败，请导出 SVG。')};image.src=url;
  });
  reduced.addEventListener?.('change',render);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopMotion()});
  editor=TopologyEditor.create({drawing,scene:()=>state.scene,view:()=>state.view,
    replace:scene=>{const index=scenes.findIndex(s=>s.id===scene.id);scenes[index]=scene;state.scene=scene;},
    setView:view=>{state.view=view;},singleView:()=>{state.compare=false;},
    restoreInitial:()=>{const scene=TopologyEdit.clone(initial.get(state.scene.id));scenes[scenes.findIndex(s=>s.id===scene.id)]=scene;state.scene=scene;},
    render:()=>render({preserveZoom:true}),notify});
  window.sampleBook={state,scenes,assets,render,selectScene,staticSvg,editor};
  render();
})();
