"""Check a distributable topology skill without relying on a parent workspace."""
from __future__ import annotations
import argparse, hashlib, importlib.util, json, re, sys, xml.etree.ElementTree as ET
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
p=argparse.ArgumentParser();p.add_argument('--forbid-token',action='append',default=[]);args=p.parse_args()
root=Path(__file__).resolve().parent.parent
skill=root if (root/'SKILL.md').is_file() else root/'render-network-topology'
checks=[]
def require(ok,name):
    if not ok:raise AssertionError(name)
    checks.append(name)
front=(skill/'SKILL.md').read_text(encoding='utf-8').split('---',2)
require(len(front)==3 and not front[0].strip(),'Skill has delimited frontmatter')
metadata=dict(line.split(':',1) for line in front[1].strip().splitlines())
require(set(metadata)=={'name','description'} and metadata['name'].strip()=='render-network-topology','Portable skill metadata has canonical name and description')
require(20<len(metadata['description'].strip())<1024,'Skill description length is valid')
interface={}
for line in (skill/'agents/openai.yaml').read_text(encoding='utf-8').splitlines()[1:]:
    key,value=line.strip().split(':',1);interface[key]=json.loads(value.strip())
require(25<=len(interface['short_description'])<=64 and '$render-network-topology' in interface['default_prompt'],'Optional agent UI metadata has valid quoted scalars')
for file in ['SKILL.md','README.md','LICENSE','VERSION','assets/icon-system.json','assets/icon-palettes.json','assets/topology-icons.svg','assets/tag-metrics.json','assets/device-icons.svg','scripts/v2/scene.js','scripts/v2/editor-model.js','scripts/v2/snap.js','tools/build_topology_v2_design.js','examples/v2-minimal.json']:
    require((skill/file).is_file(),f'Bundled resource exists: {file}')
cat=json.loads((skill/'assets/icon-system.json').read_text(encoding='utf-8'))
pal=json.loads((skill/'assets/icon-palettes.json').read_text(encoding='utf-8'))
require(len(pal['palettes'])==6 and pal['default'] in pal['palettes'],'Six complete palette definitions')
for palette in pal['palettes'].values():
    require(all(all(re.fullmatch(r'#[0-9a-fA-F]{6}',palette[t][v]) for v in ['ink','accent','muted','disc','border']) for t in ['light','dark']),'Both themes have valid local colors')
ids={e.attrib.get('id') for e in ET.parse(skill/'assets/topology-icons.svg').iter()}
require(all('glyph-icon-'+role in ids for role in cat['categories']),'All catalog roles have bundled detailed symbols')
font=json.loads((skill/'assets/fonts/sources.json').read_text(encoding='utf-8'))
require(all(hashlib.sha256((skill/'assets/fonts'/f['file']).read_bytes()).hexdigest()==f['sha256'] for f in font['files']),'Original font bytes and OFL notice preserved')
require((skill/'assets/fonts/IBMPlexSans-LICENSE.txt').is_file(),'Bundled font license')
license_text=(skill/'LICENSE').read_text(encoding='utf-8')
require('不得向第三方有偿分发原版或修改版技能' in license_text and '免费分享原版或修改版' in license_text and '拓扑成品' in license_text and '收费的在线托管服务' in license_text,'Original and modified skill resale restricted; sharing and output rights retained')
# Import the actual legacy renderer: exercise canonical and older family names, all themes and palettes.
spec=importlib.util.spec_from_file_location('topology_legacy',skill/'scripts/render_topology.py');legacy=importlib.util.module_from_spec(spec);spec.loader.exec_module(legacy)
base={'title':'Portable check','canvas':{},'nodes':[{'id':'a','type':'router','label':'A'},{'id':'b','type':'server','label':'B'}],'edges':[],'groups':[]}
for theme in ['light','dark']:
    for palette in pal['palettes']:
        model=json.loads(json.dumps(base));model['canvas']={'theme':theme,'icon_palette':palette};model=legacy.normalize_model(model,None);legacy.apply_enterprise_layout(model);html=legacy.render_html(model)
        require(f'data-icon-palette="{palette}"' in html and 'id="icon-palette"' in html,'Legacy palette builds: '+theme+'/'+palette)
        require(not re.search(r'(?:src|href)=[\"\']https?://',html),'Legacy rendering is offline: '+theme+'/'+palette)
for icon_set,expected in [('neutral','neutral'),('outline','neutral'),('detailed','detailed'),('older-family','detailed')]:
    model=json.loads(json.dumps(base));model['canvas']['icon_set']=icon_set;require(legacy.normalize_model(model,None)['canvas']['icon_set']==expected,'Legacy icon family normalizes: '+icon_set)
try:
    model=json.loads(json.dumps(base));model['canvas']['icon_palette']='unknown';legacy.normalize_model(model,None);raise AssertionError('Unknown legacy palette accepted')
except ValueError:checks.append('Unknown legacy palette rejected')
text_extensions={'.md','.py','.js','.json','.css','.svg','.yaml'}
findings=[]
for file in skill.rglob('*'):
    if not file.is_file() or any(d in file.parts for d in ['.git','__pycache__','outputs']):continue
    if file.suffix not in text_extensions:continue
    text=file.read_text(encoding='utf-8')
    for token in args.forbid_token:
        # Remove embedded font bytes before semantic-token checking.
        plain=re.sub(r'data:[^,\s]+;base64,[A-Za-z0-9+/=]+','',text)
        if re.search(r'(?i)(?<![a-z])'+re.escape(token)+r'(?![a-z])',plain) or token.casefold() in file.name.casefold():findings.append(str(file.relative_to(skill)))
require(not findings,'No caller-specified legacy token: '+', '.join(findings))
print(json.dumps({'passed':True,'checks':len(checks),'skill':str(skill),'forbidden_token_matches':findings},ensure_ascii=False))
