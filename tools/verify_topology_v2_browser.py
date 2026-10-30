"""Verify the offline specimen in Chromium and capture real button export bytes.

The isolated browser's native save path is not assumed to work. The test captures
the button-produced Blob before the anchor save, then reopens SVG/PNG documents.
No user browser settings or installed skills are changed.
"""
from __future__ import annotations

import base64
import json
import os
import sys
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path
import shutil
import subprocess
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'outputs/Topology_V2_Design'
CHECKS = OUT / 'verification'
SESSION = f'topology-v2-test-{os.getpid()}'
BROWSER = Path(os.environ.get('APPDATA', '')) / 'npm/node_modules/agent-browser/bin/agent-browser-win32-x64.exe'
if not BROWSER.is_file():
    BROWSER = Path(shutil.which('agent-browser') or 'agent-browser')


def command(*args, script=None):
    result = subprocess.run([str(BROWSER), '--session', SESSION, '--json', *args], input=script,
                            capture_output=True, text=True, encoding='utf-8', timeout=50)
    if result.returncode:
        raise RuntimeError(result.stdout + result.stderr)
    response = json.loads(result.stdout)
    if not response.get('success'):
        raise RuntimeError(response)
    return response['data']


def js(script):
    return command('eval', '--stdin', script=script).get('result')


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def instrument():
    js('''(()=>{window.__v2Capture=[];window.__v2BlobUrls=new Map();
      const create=URL.createObjectURL.bind(URL),click=HTMLAnchorElement.prototype.click;
      URL.createObjectURL=blob=>{const url=create(blob);window.__v2BlobUrls.set(url,blob);return url};
      HTMLAnchorElement.prototype.click=function(){const blob=window.__v2BlobUrls.get(this.href);
        if(this.download&&blob){window.__v2Capture.push({name:this.download,blob});return}return click.call(this)};
    })()''')


def export_blob(selector, target):
    if selector in ('#export-png', '#export-svg'):
        parse_error = js("new DOMParser().parseFromString(sampleBook.staticSvg(),'image/svg+xml').querySelector('parsererror')?.textContent||null")
        require(not parse_error, f'Export SVG is not valid XML: {parse_error}')
    before = js('window.__v2Capture.length')
    command('click', selector)
    captured = js(f'''(async()=>{{const start=Date.now();while(window.__v2Capture.length<={before}){{
      if(Date.now()-start>12000)throw Error('Export did not produce a Blob');await new Promise(r=>setTimeout(r,30))}}
      const item=window.__v2Capture.at(-1);const data=await new Promise((resolve,reject)=>{{
        const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(item.blob)}});
      return {{name:item.name,type:item.blob.type,data}}}})()''')
    target.write_bytes(base64.b64decode(captured['data'].split(',', 1)[1]))
    return {'name': captured['name'], 'type': captured['type'], 'bytes': target.stat().st_size}


GEOMETRY = '''(()=>{
  const svg=document.querySelector('#drawing svg'),nodes=[...svg.querySelectorAll('.nodes>.node')];
  const model=TopologyScene.resolve(sampleBook.state.scene,sampleBook.state.view);
  const info=nodes.map(n=>{const item=model.nodes.find(x=>x.id===n.dataset.nodeId),disc=n.querySelector('.node-disc'),glyph=n.querySelector('.node-glyph'),use=glyph.querySelector('use'),symbol=svg.querySelector(use.getAttribute('href')),box=use.getBBox(),r=Number(disc.getAttribute('r'));
    const declared=symbol.dataset.inkBounds?.split(' ').map(Number),pad=item.type==='rack'&&declared?1.75:0;
    const actual=[box.x-pad,box.y-pad,box.width+2*pad,box.height+2*pad];
    const m=use.getScreenCTM(),d=disc.getScreenCTM(),p=new DOMPoint(actual[0]+actual[2]/2,actual[1]+actual[3]/2).matrixTransform(m),c=new DOMPoint(0,0).matrixTransform(d);
    const b=n.querySelector('.node-label').getBBox();
    return {id:item.id,type:item.type,x:item.x,y:item.y,r,label:{x:b.x+item.x+(item.labelOffset?.[0]||0),y:b.y+item.y+(item.labelOffset?.[1]||0),w:b.width,h:b.height},sst:!!declared,
      ratio:Math.max(actual[2],actual[3])*m.a/(2*r*d.a),centerError:Math.hypot(p.x-c.x,p.y-c.y-(item.deployment?-14:0)*d.d),deployment:item.deployment||null,compact:!!item.compact,focus:!!item.focus,
      outside:[...n.querySelectorAll('.node-label text')].every(t=>t.getBBox().y>r),stroke:Number(getComputedStyle(disc).strokeWidth.replace('px',''))}});
  const paths=[...svg.querySelectorAll('.connection-main')];const collisions=[];
  const titles=[...svg.querySelectorAll('.region-title,.region-note')].map(t=>{const b=t.getBBox();return {id:t.textContent,x:b.x,y:b.y,w:b.width,h:b.height}});
  const noteFrames=[...svg.querySelectorAll('.note-box')].map(n=>{const r=n.querySelector('.note-frame'),b=r.getBBox();
    const overflow=[...n.querySelectorAll('text')].filter(t=>{const a=t.getBBox();return a.x<b.x+2||a.x+a.width>b.x+b.width-2||a.y<b.y+2||a.y+a.height>b.y+b.height-2}).map(t=>t.textContent);
    const style=getComputedStyle(r);return {id:n.dataset.noteKind+':'+n.textContent.slice(0,18),x:b.x,y:b.y,w:b.width,h:b.height,overflow,
      radius:Number(r.getAttribute('rx')),strokeWidth:Number(style.strokeWidth.replace('px','')),fill:style.fill,stroke:style.stroke}});
  const expectedFonts={'diagram-title':27,'diagram-subtitle':13,eyebrow:10,'region-title':17,'region-note':11,
    'node-name':13,'node-meta':10,'edge-caption':11,'annotation-title':14,'annotation-body':11,'legend-text':11,'footer-note':9};
  const typeErrors=[...svg.querySelectorAll('text')].filter(t=>{const role=[...t.classList].find(k=>k in expectedFonts);
    return role&&parseFloat(getComputedStyle(t).fontSize)!==expectedFonts[role]}).map(t=>t.getAttribute('class'));
  const unframedNotes=[...svg.querySelectorAll('.diagram-subtitle,.region-note,.annotation-title,.annotation-body,.footer-note')]
    .filter(n=>!n.closest('.note-box')).map(n=>n.textContent);
  const inBox=(p,b,pad=3)=>p.x>b.x-pad&&p.x<b.x+b.w+pad&&p.y>b.y-pad&&p.y<b.y+b.h+pad;
  paths.forEach(path=>{const e=path.closest('.connection'),seen=new Set(),len=path.getTotalLength();
    for(let i=0;i<=len;i+=2){const p=path.getPointAtLength(i);
      info.forEach(n=>{const label='label:'+n.id,disc='disc:'+n.id;
        if(!seen.has(label)&&inBox(p,n.label)){collisions.push({edge:e.dataset.edgeId,obstacle:label});seen.add(label)}
        if(n.id!==e.dataset.source&&n.id!==e.dataset.target&&!seen.has(disc)&&Math.hypot(p.x-n.x,p.y-n.y)<n.r+3){collisions.push({edge:e.dataset.edgeId,obstacle:disc});seen.add(disc)}});
      titles.forEach(b=>{const k='region-title:'+b.id;if(!seen.has(k)&&inBox(p,b,2)){collisions.push({edge:e.dataset.edgeId,obstacle:k});seen.add(k)}});
      noteFrames.forEach(b=>{const k='note:'+b.id;if(!seen.has(k)&&inBox(p,b,2)){collisions.push({edge:e.dataset.edgeId,obstacle:k});seen.add(k)}});
    }
  });
  const overlaps=[];for(let i=0;i<info.length;i++)for(let j=i+1;j<info.length;j++){const a=info[i],b=info[j];
    if(Math.hypot(a.x-b.x,a.y-b.y)<a.r+b.r+12)overlaps.push([a.id,b.id]);}
  const noteOverlaps=[];noteFrames.forEach(b=>info.forEach(n=>{
    const dx=Math.max(b.x-n.x,0,n.x-b.x-b.w),dy=Math.max(b.y-n.y,0,n.y-b.y-b.h);
    if(Math.hypot(dx,dy)<n.r+3)noteOverlaps.push({note:b.id,node:n.id});
    if(b.x<n.label.x+n.label.w&&b.x+b.w>n.label.x&&b.y<n.label.y+n.label.h&&b.y+b.h>n.label.y)noteOverlaps.push({note:b.id,label:n.id});
  }));
  return {nodes:info,collisions,overlaps,paths:paths.length,noteFrames,typeErrors,unframedNotes,noteOverlaps};
})()'''

RING_CONTINUITY = r'''(()=>{
  const svg=document.querySelector('#drawing svg'),model=sampleBook.state.scene,ring=model.rings[0];
  const paths=[...svg.querySelectorAll('.connection-main')],guides=[...svg.querySelectorAll('.ring-guide')];
  let maxEllipseError=0,maxAttachmentError=0;
  paths.forEach(path=>{const e=model.edges.find(e=>e.id===path.closest('.connection').dataset.edgeId),length=path.getTotalLength();
    [0,1].forEach(end=>{const p=path.getPointAtLength(end*length),n=model.nodes.find(n=>n.id===e[end?'target':'source']);maxAttachmentError=Math.max(maxAttachmentError,Math.abs(Math.hypot(p.x-n.x,p.y-n.y)-(n.compact?32:42)))});
    for(let j=0;j<=64;j++){const p=path.getPointAtLength(length*j/64);maxEllipseError=Math.max(maxEllipseError,Math.abs(((p.x-ring.cx)/ring.rx)**2+((p.y-ring.cy)/ring.ry)**2-1));}
  });
  return {arcs:paths.length,exactArcPaths:paths.every(p=>/^M [\d .-]+ A /.test(p.getAttribute('d'))),guides:guides.length,
    widths:paths.map(p=>Number(p.getAttribute('stroke-width'))),physicalSolid:paths.every(p=>!p.hasAttribute('stroke-dasharray')),
    rplMarkers:svg.querySelectorAll('.edge-state').length,defaultLabels:model.nodes.every(n=>!n.labelOffset||n.labelOffset.every(v=>v===0)),maxEllipseError,maxAttachmentError};
})()'''

STANDARD_FEATURES = '''(()=>{
  const svg=document.querySelector('#drawing svg'),m=TopologyScene.resolve(sampleBook.state.scene,sampleBook.state.view),semanticErrors=[];
  const all=[...svg.querySelectorAll('.connection')];
  all.forEach(g=>{const e=m.edges.find(e=>e.id===g.dataset.edgeId),path=g.querySelector('.connection-main'),dash=path.getAttribute('stroke-dasharray');
    if(e.semantics==='physical'&&dash)semanticErrors.push(e.id+':physical dashed');
    if(e.semantics==='logical'&&dash!=='7 6')semanticErrors.push(e.id+':logical not dashed');
    if(e.semantics==='management'&&dash!=='1 6')semanticErrors.push(e.id+':management not dotted');
    if(e.semantics==='business'&&!path.hasAttribute('marker-end'))semanticErrors.push(e.id+':business direction missing');
  });
  const overlaysOnBase=all.filter(g=>g.dataset.baseEdge).every(g=>{const base=all.find(b=>b.dataset.edgeId===g.dataset.baseEdge);return !!g.querySelector('.connection-base')&&base?.querySelector('.connection-main').getAttribute('d')===g.querySelector('.connection-main').getAttribute('d')});
  const layersUnframed=m.groups.filter(g=>['layer','collection','specimen'].includes(g.kind)).every(g=>!svg.querySelector('[data-region-id="'+g.id+'"] [data-role="bounds"]'));
  return {semanticErrors,overlaysOnBase,layersUnframed,selectedFlow:sampleBook.state.flow,
    fontsLoaded:document.fonts.check('400 12px "IBM Plex Sans"')&&document.fonts.check('600 12px "IBM Plex Sans"'),
    fontFamily:getComputedStyle(svg.querySelector('.node-name')).fontFamily};
})()'''

def main():
    CHECKS.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((OUT / 'manifest.json').read_text(encoding='utf-8'))
    require(len(manifest['variants']) == 26, 'Expected 26 static variants')
    diagnose = os.environ.get('TOPO_V2_DIAGNOSE') == '1'
    # On a cold Windows launch the background browser can inherit a PIPE handle.
    # Bootstrap without captured pipes before using the JSON command channel.
    subprocess.run([str(BROWSER),'--session',SESSION,'open',(OUT / 'index.html').as_uri()],
                   stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=45,check=True)
    command('set', 'viewport', '1680', '1120')
    command('open', (OUT / 'index.html').as_uri())
    instrument()
    exports, geometry, ring_continuity, tag_checks, standard_checks = [], [], [], [], []
    for item in manifest['variants']:
        scene, view, theme = item['scene'], item['view'], item['theme']
        js(f'''(()=>{{sampleBook.selectScene({json.dumps(scene)});sampleBook.state.view={json.dumps(view)};
          sampleBook.state.theme={json.dumps(theme)};sampleBook.render()}})()''')
        js('(async()=>{await document.fonts.ready})()')
        check = js(GEOMETRY)
        check.update(scene=scene, view=view, theme=theme)
        geometry.append(check)
        if diagnose:
            print(json.dumps({'scene':scene,'view':view,'theme':theme,'collisions':check['collisions'],'overlaps':check['overlaps'],'noteOverlaps':check['noteOverlaps'],'noteOverflow':[n for n in check['noteFrames'] if n['overflow']]},ensure_ascii=False),flush=True)
            continue
        require(len(check['nodes']) == item['nodes'], f'Node count: {item}')
        require(not check['overlaps'], f'Overlapping nodes: {check}')
        require(not check['collisions'], f'Route intersects node, name, or region heading: {check["collisions"]}')
        require(not check['typeErrors'] and not check['unframedNotes'], f'Inconsistent type or unframed explanations: {check}')
        require(not check['noteOverlaps'], f'Note intersects a device or its name: {check["noteOverlaps"]}')
        for note in check['noteFrames']:
            require(not note['overflow'], f'Text outside note frame: {note}')
            require(note['radius'] == 4 and note['strokeWidth'] == 1, f'Inconsistent note treatment: {note}')
        styles = {(n['fill'], n['stroke']) for n in check['noteFrames']}
        require(len(styles) == 1, f'Mixed explanation frame colors: {styles}')
        for n in check['nodes']:
            require(n['outside'] and n['stroke'] == (3 if n['focus'] else 2.4), f'Icon frame or label: {n}')
            if n['sst']:
                require(abs(n['ratio'] - ((26 if n['compact'] else 41.5)/(64 if n['compact'] else 84) if n['deployment'] else (5**.5-1)/2)) < .0001 and n['centerError'] < .01, f'SST geometry: {n}')
        if scene == 'ring':
            ring_check = js(RING_CONTINUITY)
            ring_check['theme'] = theme
            require(ring_check['arcs'] == 8 and ring_check['guides'] == 1 and
                    ring_check['exactArcPaths'] and ring_check['physicalSolid'] and ring_check['rplMarkers'] == 1 and ring_check['defaultLabels'] and
                    all(w == 2.6 for w in ring_check['widths']) and
                    ring_check['maxEllipseError'] < 2e-5 and ring_check['maxAttachmentError'] < .002,
                    f'Discontinuous ring: {ring_check}')
            ring_continuity.append(ring_check)
        if not diagnose:
            feature = js(STANDARD_FEATURES)
            require(feature['fontsLoaded'] and not feature['semanticErrors'] and feature['overlaysOnBase'] and feature['layersUnframed'], f'V1 feature mismatch: {feature}')
            standard_checks.append(dict(feature, scene=scene, view=view, theme=theme))
            measured_tags = js((ROOT / 'tools/sst_geometry_checks.js').read_text(encoding='utf-8').replace("document.querySelectorAll('.edge')", "document.querySelectorAll('#drawing .connection-main')").replace('pill.x-4, y:pill.y-4, right:pill.right+4, bottom:pill.bottom+4','pill.x-4*scale, y:pill.y-4*scale, right:pill.right+4*scale, bottom:pill.bottom+4*scale') + "\nmeasureSstDeployment('#drawing .node-deployment')")
            for tag in measured_tags:
                require(tag['textFits'] and tag['bottomInside'] and tag['lowerHalf'] and tag['stateClear'] and tag['glyphGap'] > 1.5 and tag['sideOverhang'] <= 8 and max(tag['pillCenterError'],tag['contentCenterError'],tag['contentVerticalError']) < .15 and tag['loadedFonts'] and tag['edgeCrossings'] == 0, f'Bad v4 tag geometry: {tag}')
            tag_checks.append(dict(scene=scene, view=view, theme=theme, tags=measured_tags))
        file = f'{scene}-{view}-{theme}.png'
        exports.append(export_blob('#export-png', OUT / 'previews' / file))
        if view == 'overview' and scene in ('layered', 'connections', 'ring', 'mixed-ring'):
            exports.append(export_blob('#export-svg', CHECKS / f'{scene}-{theme}.svg'))
        print(f'Checked {scene}/{view}/{theme}: {len(check["collisions"])} route-obstacle findings', flush=True)

    (CHECKS / 'route-checks.json').write_text(json.dumps(geometry,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

    if diagnose:
        return

    # Test all four current tags at both source sizes, including independent state.
    js('''(()=>{const host=document.createElement('div');host.id='tag-probe';host.style.cssText='position:absolute;left:-10000px;top:0;width:1600px';document.body.append(host);
      const types=['firewall','core-switch','server','core-switch'],tags=['ha','stack','cluster','mlag'],nodes=[];
      for(const compact of [false,true])tags.forEach((deployment,i)=>nodes.push({id:'tag-'+compact+'-'+i,label:deployment,type:types[i],x:200+i*250,y:compact?420:220,compact,deployment,status:i===0?'warning':i===2?'standby':'normal'}));
      host.innerHTML=TopologyScene.render({id:'tag-probe',title:'SST v4',nodes,edges:[]},{assets:sampleBook.assets,embedFonts:false,motion:false});})()''')
    compact_tags = js((ROOT / 'tools/sst_geometry_checks.js').read_text(encoding='utf-8') + "\nmeasureSstDeployment('#tag-probe .node-deployment')")
    require(len(compact_tags) == 8, 'Four deployment modes at both sizes')
    for tag in compact_tags:
        require(tag['textFits'] and tag['bottomInside'] and tag['lowerHalf'] and tag['stateClear'] and
                tag['glyphGap'] > 1.5 and tag['sideOverhang'] <= 8 and tag['loadedFonts'] and
                max(tag['pillCenterError'],tag['contentCenterError'],tag['contentVerticalError']) < .15 and
                (tag['stateRatio'] is None or tag['stateRatio'] >= 1.3), f'Compact tag failed: {tag}')
    js("document.querySelector('#tag-probe').remove()")

    wrap = js('''(()=>{const host=document.createElement('div');host.style.cssText='position:absolute;left:-10000px;top:0';
      document.body.append(host);host.innerHTML=TopologyScene.render({id:'wrap-test',title:'',nodes:[],edges:[],
        annotations:[{x:100,y:200,w:150,title:'说明标签自动换行',lines:['WAN / CoS CLASS-A 多种业务共用承载，颜色表达类别，文字需要完整保留。']}]},
        {assets:sampleBook.assets,prefix:'wrap-test',motion:false});
      const note=host.querySelector('.annotation'),b=note.querySelector('rect').getBBox(),texts=[...note.querySelectorAll('text')];
      const overflow=texts.filter(t=>{const a=t.getBBox();return a.x<b.x+2||a.x+a.width>b.x+b.width-2||a.y<b.y+2||a.y+a.height>b.y+b.height-2});
      const result={rows:texts.length,overflow:overflow.length};host.remove();return result})()''')
    require(wrap['rows'] >= 4 and wrap['overflow'] == 0, f'Long note did not wrap inside its frame: {wrap}')

    # Exercise the controls using real click/change events.
    command('click', '[data-scene="layered"]')
    command('click', '[data-view="engineering"]')
    require(js('sampleBook.state.view') == 'engineering', 'Engineering switch')
    command('click', '#theme')
    require(js('sampleBook.state.theme') == 'light', 'Theme switch')
    command('click', '#compare')
    compare = js('''({roots:document.querySelectorAll('#drawing svg.topology-v2').length,
      fills:[...document.querySelectorAll('#drawing .diagram-title')].map(n=>getComputedStyle(n).fill),
      ids:[...document.querySelectorAll('#drawing [id]')].map(n=>n.id)})''')
    require(compare['roots'] == 2 and len(compare['ids']) == len(set(compare['ids'])), 'Comparison ID collision')
    require(compare['fills'] == ['rgb(0, 41, 109)', 'rgb(232, 241, 255)'], f'Comparison theme leaked: {compare["fills"]}')
    command('screenshot', str(OUT / 'previews/book-compare.png'))
    command('click', '#compare')
    command('click', '#zoom-in')
    require(js('sampleBook.state.zoom') > 1, 'Zoom')
    command('click', '#zoom-fit')
    require(js('sampleBook.state.zoom') == 1, 'Fit')
    command('click', '#fullscreen')
    require(js("document.fullscreenElement?.id") == 'drawing', 'Fullscreen')
    command('press', 'Escape')
    exports.append(export_blob('#export-json', CHECKS / 'layered-model.json'))
    model = json.loads((CHECKS / 'layered-model.json').read_text(encoding='utf-8'))
    require(len(model['views']['engineering']['nodes']) == 18, 'Export lost detailed members')

    command('click', '[data-scene="swimlane"]')
    command('select', '#flow-filter', 'video')
    require(js("document.querySelectorAll('#drawing [data-edge-id^=flow]').length") == 3, 'Flow filter')
    require(js("document.querySelectorAll('#drawing [data-edge-id^=base]').length") == 9, 'Base network removed')
    require(js("!document.querySelector('#drawing svg').classList.contains('is-playing')"), 'Should be static by default')
    command('click', '#play')
    require(js('sampleBook.state.playing'), 'Play')
    command('click', '#play')
    require(not js('sampleBook.state.playing'), 'Return to static')
    command('set', 'media', 'light', 'reduced-motion')
    require(js("document.querySelector('#play').disabled"), 'Reduced-motion preference')
    command('set', 'media', 'light')

    command('click', '[data-scene="connections"]')
    js("document.querySelector('#toast').textContent=''")
    command('screenshot', str(OUT / 'previews/book-connections.png'))
    command('set', 'viewport', '390', '1000')
    narrow = js('({width:innerWidth,scroll:document.documentElement.scrollWidth})')
    require(narrow['width'] == narrow['scroll'], f'Page overflows: {narrow}')
    command('screenshot', str(OUT / 'previews/book-mobile.png'))
    command('set', 'viewport', '1680', '1120')

    command('set', 'offline', 'on')
    command('reload')
    require(js("document.querySelectorAll('#drawing .node').length") > 0, 'Offline render')
    remote = js("performance.getEntriesByType('resource').filter(e=>/^https?:/.test(e.name)).map(e=>e.name)")
    require(not remote, f'External requests: {remote}')
    command('set', 'offline', 'off')

    svg_checks = []
    for scene, theme in ((scene,theme) for scene in ('layered','connections','ring','mixed-ring') for theme in ('light','dark')):
        target = CHECKS / f'{scene}-{theme}.svg'
        ET.parse(target)
        require('animateMotion' not in target.read_text(encoding='utf-8'), 'Static SVG includes motion')
        command('open', target.as_uri())
        js('(async()=>{await document.fonts.ready})()')
        parsed = js("({nodes:document.querySelectorAll('.node').length,errors:document.querySelector('parsererror')?.textContent||null})")
        require(parsed['nodes'] > 0 and not parsed['errors'], 'Standalone SVG reopen')
        parsed.update(scene=scene,theme=theme)
        svg_checks.append(parsed)
    command('open', (OUT / 'previews/connections-overview-dark.png').as_uri())
    png_size = js('({width:document.querySelector("img").naturalWidth,height:document.querySelector("img").naturalHeight})')
    require(png_size == {'width': 1600, 'height': 1300}, 'PNG reopen/dimensions')
    command('open', (OUT / 'index.html').as_uri())
    command('screenshot', str(OUT / 'previews/book-desktop.png'))
    report = {'stage':'visual-specimen', 'variants':len(geometry), 'geometry':geometry,
              'ring_continuity':ring_continuity,'standard_v1':standard_checks,'sst_v4_tags':tag_checks,'sst_v4_compact_probe':compact_tags,
              'typography_delta_px':-1,'explanation_frames_uniform':True,'long_note_wrap':wrap,
              'exports':exports, 'comparison_unique_ids':True, 'flow_filter':True,
              'static_by_default':True, 'play_stop':True, 'reduced_motion':True,
              'zoom_fit':True, 'fullscreen':True, 'offline_render':True, 'remote_requests':remote,
              'comparison_theme_isolation':True, 'json_members_preserved':True, 'standalone_svg':svg_checks,
              'png_reopen':png_size, 'mobile':narrow,
              'export_validation':'Captured actual button-generated Blob bytes; native file save is not claimed.'}
    (CHECKS / 'browser-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'variants':len(geometry),'exports':len(exports),'route_findings':sum(len(x['collisions']) for x in geometry)},ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    finally:
        subprocess.run([str(BROWSER), '--session', SESSION, 'close'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=20, check=False)
