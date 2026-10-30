"""Regress the real lower-row circle alignment bug with below-disc labels."""
import hashlib
import json
import subprocess
import verify_topology_v2_browser as b

OUT=b.OUT
FILES=OUT/'verification/icon-alignment'
FILES.mkdir(parents=True, exist_ok=True)
js,command,require=b.js,b.command,b.require
checks=[]
cases=[]

def record(name,condition=True):
    require(condition,name);checks.append(name);print('Passed: '+name,flush=True)

def node(id='access-5'):
    return js(f"TopologyScene.resolve(sampleBook.state.scene,'overview').nodes.find(n=>n.id==={json.dumps(id)})")

def read():
    return js("""(()=>{const d=document.querySelector('#drawing'),s=d.querySelector('svg'),m=s.getScreenCTM(),n=TopologyScene.resolve(sampleBook.state.scene,'overview').nodes.find(n=>n.id==='access-5');return {node:{x:n.x,y:n.y},left:d.scrollLeft,top:d.scrollTop,pageY:scrollY,snap:s.querySelector('.editor-overlay')?.dataset.snapActive||'',guides:s.querySelectorAll('.edit-snap-guide,.edit-snap-point').length,matrixY:m.f}})()""")

def begin(selector='[data-node-id="access-5"] .node-disc'):
    # Start on the actual disc, never at the center of a box including its name.
    data=js(f"""(()=>{{const el=document.querySelector({json.dumps(selector)});el.scrollIntoView({{block:'center',inline:'center'}});const b=el.getBoundingClientRect(),m=document.querySelector('#drawing svg').getScreenCTM();return {{x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2),sx:Math.hypot(m.a,m.b),sy:Math.hypot(m.c,m.d)}}}})()""")
    command('mouse','move',str(data['x']),str(data['y']));command('mouse','down','left');return data

def move(start,dx,dy):
    command('mouse','move',str(round(start['x']+dx*start['sx'])),str(round(start['y']+dy*start['sy'])))

def end():command('mouse','up','left')

def main():
    subprocess.run([str(b.BROWSER),'--session',b.SESSION,'open',(OUT/'index.html').as_uri()],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=True,timeout=45)
    command('set','viewport','1680','1000');command('open',(OUT/'index.html').as_uri());js('(async()=>{await document.fonts.ready})()');b.instrument()
    command('click','#edit')
    for zoom in ['fit','110%','175%']:
        command('click','#zoom-fit')
        if zoom!='fit':command('click','#zoom-in')
        if zoom=='175%':
            for _ in range(5):command('click','#zoom-in')
        command('select','#editor-selection','node|access-5');start=begin();before=read()
        # First engage the quarter guide outside the center's 5px acquisition range.
        move(start,12,9/start['sy']*1.1)
        weak=read()
        # Then return to exact peer-center intent while still inside the old latch's 8px range.
        move(start,12,0);center=read()
        require(abs(center['node']['y']-node('access-4')['y'])<1e-8,zoom+' remained trapped on the weak region guide')
        require('设备中心对齐' in center['snap'],zoom+' center guide feedback missing')
        require(abs(center['top']-before['top'])<.01 and abs(center['left']-before['left'])<.01,'Scroll position changed during drag')
        move(start,12,3/start['sy']);near=read();require(abs(near['node']['y']-760)<1e-8,'Near-center intent was pulled to a region edge')
        end();require(read()['guides']==0,'Released guides persisted')
        cases.append({'zoom':zoom,'scale':start['sy'],'before':before,'weak':weak,'center':center,'near':near})
        record('Below-name bottom icon aligns to peer centers at '+zoom)
        command('click','#editor-undo')
    record('Formerly held region guides no longer block icon-center alignment',any(abs(case['weak']['node']['y']-760)>1 for case in cases))

    # Import a deliberate label-height and circle-size mismatch through the real data-only UI.
    fixture=js('TopologyEdit.clone(sampleBook.state.scene)')
    fixture.pop('editor_version',None);fixture['views'].pop('overview',None)
    for n in fixture['nodes']:
        if n['id']=='access-5':n.update(label=['Bottom device with long name','Second line'],meta='Gi0/1 - 10G',labelOffset=[0,0],compact=True)
        if n['id']=='access-4':n.update(label='Short peer',labelOffset=[0,0])
    (FILES/'label-height-fixture.json').write_text(json.dumps(fixture,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    command('upload','#import-json',str(FILES/'label-height-fixture.json'));command('click','#zoom-fit')
    require(node()['compact'],'Fixture import failed')
    command('select','#editor-selection','node|access-5');start=begin();move(start,16,3/start['sy']);label_case=read()
    record('Different circle diameters and multi-line metadata align by disc center',abs(label_case['node']['y']-node('access-4')['y'])<1e-8 and js("(()=>{const a=document.querySelector('[data-node-id=\"access-5\"] .node-label').getBBox(),b=document.querySelector('[data-node-id=\"access-4\"] .node-label').getBBox();return a.height>b.height})()"))
    command('screenshot',str(OUT/'previews/book-icon-alignment-light.png'));end();command('click','#editor-undo')
    command('click','#theme');command('select','#editor-selection','node|access-5');start=begin();move(start,16,-3/start['sy'])
    record('Dark theme retains precise lower-row center alignment',abs(node()['y']-760)<1e-8)
    command('screenshot',str(OUT/'previews/book-icon-alignment-dark.png'));end();command('click','#editor-undo')

    before=node();start=begin('[data-node-id="access-5"] .node-label');move(start,24,16);end();after=node()
    record('Independent label dragging still changes only its offset',after['x']==before['x'] and after['y']==before['y'] and after['labelOffset']!=before['labelOffset'] and js("sampleBook.editor.selection.kind==='node-label'"))
    command('click','#editor-undo')

    # Persist the corrected placement and repeat it in a reopened standalone file.
    command('select','#editor-selection','node|access-5');start=begin();move(start,16,3/start['sy']);end();expected=node()
    exports=[b.export_blob('#save-html',FILES/'aligned-book.html'),b.export_blob('#export-json',FILES/'aligned-model.json')]
    command('open',(FILES/'aligned-book.html').as_uri());js('(async()=>{await document.fonts.ready})()')
    record('Saved standalone HTML preserves lower-row aligned circles and their labels',not js('sampleBook.editor.enabled') and node()==expected)
    command('click','#edit');command('select','#editor-selection','node|access-5');start=begin();move(start,8,-3/start['sy']);require(abs(node()['y']-760)<1e-8,'Reopened alignment failed');end()
    record('The saved HTML can continue accurate icon alignment')
    report={'passed':True,'html_sha256':hashlib.sha256((OUT/'index.html').read_bytes()).hexdigest(),'checks':checks,'cases':cases,'different_labels':label_case,'exports':exports,'export_validation':'Actual button-produced bytes and standalone reopen; OS save dialog not claimed.'}
    (OUT/'verification/icon-alignment-browser-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'passed':True,'checks':len(checks),'cases':len(cases)}))

if __name__=='__main__':
    try:
        main()
    finally:
        subprocess.run([str(b.BROWSER), '--session', b.SESSION, 'close'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=20, check=False)
