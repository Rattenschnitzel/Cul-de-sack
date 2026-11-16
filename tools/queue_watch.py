# Copied from MandelbulbGame for Cul-de-sack's art, with its own server list and port.
# A live page of what every ComfyUI server is doing, on both PCs: what runs now, how far along (from the server's own log),
# what waits, and what finished lately. ComfyUI sends no CORS headers, so this small server asks them and the page asks it.
#   python tools/queue_watch.py          then open http://localhost:8521   (PORT changes the port)
# Any Python 3 works; it uses only the standard library. Servers to ask are in SERVERS; one that doesn't answer shows as off.
import json, os, re, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# The last field is the folder the Location button opens, relative to the project. Our scripts fetch every picture into
# art/style-test, whichever PC painted it, so both buttons open that.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVERS = [
    ('Main PC', 'FLUX.3 Klein (8188)', 'http://127.0.0.1:8188', 'art/style-test'),
    ('Second PC', 'FLUX.3 Klein (8189)', 'http://192.168.2.37:8189', 'art/style-test'),
]
FOLDERS = {}   # server index -> folder last found, for /open
PORT = int(os.environ.get('PORT', 8521))   # 8520 is MandelbulbGame's copy
STEP = re.compile(r'(\d+)%\|.*?\|\s*(\d+)/(\d+)\s*\[([\d:]+)<([\d:?]+)')

def get(url, t=4):
    return json.loads(urllib.request.urlopen(url, timeout=t).read())

def label(graph):
    """A job's name: its output prefix (3d/char_..., hearth_music/m, hearth_ui) and the kind of work, from its nodes."""
    nodes = graph.values() if isinstance(graph, dict) else []
    kinds = {n.get('class_type', '') for n in nodes}
    pre = [n['inputs']['filename_prefix'] for n in nodes if isinstance(n.get('inputs', {}).get('filename_prefix'), str)]
    kind = 'TRELLIS.2 model' if any('Trellis' in k for k in kinds) else 'music' if any('AceStep' in k for k in kinds) else \
           'sound' if any('Audio' in k for k in kinds) else 'Hunyuan model' if any('Hunyuan' in k for k in kinds) else \
           'image' if 'SaveImage' in kinds else 'job'
    return {'name': (pre[0].split('/')[-1] if pre else '(no name)'), 'kind': kind}

def ask(i):
    pc, what, url, folder = SERVERS[i]
    out = {'pc': pc, 'what': what, 'url': url, 'up': False, 'i': i}
    if folder: FOLDERS[i] = os.path.normpath(os.path.join(ROOT, folder))
    try:
        q = get(url + '/queue')
    except Exception:
        if i in FOLDERS: out['folder'] = FOLDERS[i]
        return out
    out['up'] = True
    if not folder:
        try:
            argv = get(url + '/system_stats')['system']['argv']
            if '--output-directory' in argv:
                d = argv[argv.index('--output-directory') + 1]
                if os.path.isdir(os.path.dirname(os.path.normpath(d))): FOLDERS[i] = os.path.normpath(d)
        except Exception: pass
    if i in FOLDERS: out['folder'] = FOLDERS[i]
    out['running'] = [dict(label(j[2]), id=j[1]) for j in q.get('queue_running', [])]
    out['pending'] = [dict(label(j[2]), id=j[1]) for j in sorted(q.get('queue_pending', []), key=lambda j: j[0])]
    try:
        s = get(url + '/system_stats'); d = s['devices'][0]
        out['gpu'] = {'name': d['name'].split(' : ')[0].replace('cuda:0', '').strip(), 'free': round(d['vram_free']/2**30, 1), 'total': round(d['vram_total']/2**30, 1)}
    except Exception: pass
    try:   # progress bar lines from the log: the last one belongs to the running job's current stage
        lines = [e['m'] for e in get(url + '/internal/logs/raw')['entries'][-40:]]
        last = next((l for l in reversed(lines) if STEP.search(l)), None)
        started = next((e for e in reversed(lines) if 'got prompt' in e or 'Prompt executed' in e), '')
        if last and out['running'] and 'Prompt executed' not in started:
            m = STEP.search(last); out['step'] = {'pct': int(m[1]), 'at': f'{m[2]}/{m[3]}', 'spent': m[4], 'left': m[5]}
    except Exception: pass
    try:
        h = get(url + '/history?max_items=6')
        done = []
        for pid, v in h.items():
            st = v.get('status', {}); msgs = st.get('messages', [])
            t0 = next((m[1].get('timestamp') for m in msgs if m[0] == 'execution_start'), None)
            t1 = next((m[1].get('timestamp') for m in msgs if m[0] in ('execution_success', 'execution_error', 'execution_interrupted')), None)
            done.append(dict(label(v.get('prompt', [0, 0, {}])[2]), ok=st.get('status_str'), end=t1, mins=round((t1 - t0)/60000, 1) if t0 and t1 else None))
        out['done'] = sorted(done, key=lambda d: d['end'] or 0, reverse=True)[:6]
    except Exception: pass
    return out

# The painting scripts (tools/flux3.py) send each PC one job at a time, so ComfyUI's own queue never shows what's still
# to come. Those scripts write their list here instead, and the page shows it as "Lined up".
BATCH_FILE = os.path.join(ROOT, 'art', 'style-test', 'batch_status.json')

def batch():
    try:
        with open(BATCH_FILE, encoding='utf-8') as f: return json.load(f)
    except Exception: return None

# Shared by both pages: the look, and the full view that opens when you click a preview.
HEAD = r'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TITLE</title><style>
:root{color-scheme:dark;--bg:#1e1c21;--card:#2a272e;--line:#433e48;--text:#ece7dc;--dim:#a39c92;--gold:#ffe182;--ok:#8fd18a;--bad:#ff8f73;--bar:#e0b85a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.45 system-ui,sans-serif;padding:16px}
h1{font-size:19px;margin:0 0 4px;color:var(--gold)}#when{color:var(--dim);font-size:13px;margin-bottom:14px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px}.card.off{opacity:.5}
.top{display:flex;justify-content:space-between;gap:8px;align-items:baseline}
.loc{font:inherit;font-size:13px;color:var(--text);background:#3a3640;border:1px solid var(--line);border-radius:6px;padding:3px 10px;cursor:pointer;margin-top:8px}.loc:hover{border-color:var(--gold)}.pc{font-weight:700}.what{color:var(--dim);font-size:13px}
.big{font-size:26px;font-weight:700;margin:6px 0 2px}.small{color:var(--dim);font-size:13px}h3{font-size:13px;color:var(--gold);margin:12px 0 4px;font-weight:600}
.run{margin-top:6px}.bar{height:8px;background:#3a3640;border-radius:4px;overflow:hidden;margin:5px 0 2px}.bar i{display:block;height:100%;background:var(--bar)}
ol,ul{margin:0;padding-left:20px}li{margin:1px 0;word-break:break-all}.kind{color:var(--dim);font-size:12px}.ok{color:var(--ok)}.bad{color:var(--bad)}
#b{margin-bottom:14px}.cols{display:grid;grid-template-columns:minmax(220px,1fr) 3fr;gap:16px}
.wait{max-height:260px;overflow:auto;columns:2 160px}.wait li{break-inside:avoid}
.thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.thumbs a{display:block;color:var(--text);text-decoration:none;font-size:12px}.thumbs img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:6px;border:1px solid var(--line);background:#111;display:block}
.thumbs a:hover img{border-color:var(--gold)}
@media (max-width:700px){.cols{grid-template-columns:1fr}}
nav{float:right;font-size:14px}nav a{color:var(--gold);margin-left:14px}nav a.here{color:var(--text);text-decoration:none;font-weight:700}
#lb{position:fixed;inset:0;background:rgba(8,8,10,.92);display:none;z-index:9;padding:14px;flex-direction:column;align-items:center;gap:10px}
#lb.on{display:flex}#lb img{max-width:100%;max-height:calc(100vh - 190px);object-fit:contain;border-radius:6px;cursor:zoom-out}
#lb .info{max-width:1100px;width:100%;font-size:13px;color:var(--dim)}#lb .info b{color:var(--text);font-size:15px}
#lb .prompt{color:var(--text);margin-top:4px;max-height:72px;overflow:auto;user-select:text}
#lb .btns{position:fixed;top:12px;right:14px;display:flex;gap:6px}#lb button,#lb .btns a{font:inherit;font-size:13px;color:var(--text);background:#3a3640;border:1px solid var(--line);border-radius:6px;padding:4px 10px;cursor:pointer;text-decoration:none}
</style></head><body>
<div id="lb"><div class="btns"><button data-go="-1" title="Left arrow">&#8592; Previous</button><button data-go="1" title="Right arrow">Next &#8594;</button><a id="lbfull" target="_blank">Full size</a><button data-go="x" title="Esc">Close</button></div>
<img id="lbimg" alt=""><div class="info"><div id="lbtitle"></div><div class="prompt" id="lbprompt"></div></div></div>
<script>
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pic=p=>'pic?p='+encodeURIComponent(p);
// The full view: click a preview (any element with data-n, an index into window.items) to see the whole picture
// and how it was made. Left/right arrows step through, Esc or a click on the picture closes it.
let lbAt=-1;
function lbShow(n){const it=window.items||[];if(!it.length)return;lbAt=(n+it.length)%it.length;const r=it[lbAt];
  document.getElementById('lbimg').src=pic(r.path);document.getElementById('lbfull').href=pic(r.path);
  const when=r.at?new Date(r.at*1000).toLocaleString([], {dateStyle:'medium',timeStyle:'short'}):'';
  const parts=[r.batch, r.server, r.seconds!=null&&r.seconds+' s', 'seed '+(r.seed??'?'), (r.width||'?')+'×'+(r.height||'?'),
    r.refs&&r.refs.length&&'references: '+r.refs.join(', '), when].filter(Boolean).map(esc).join(' · ');
  document.getElementById('lbtitle').innerHTML=`<b>${esc(r.name)}</b> &nbsp; ${parts} &nbsp; (${lbAt+1} of ${it.length})`;
  document.getElementById('lbprompt').textContent=r.prompt||'';document.getElementById('lb').classList.add('on');}
function lbClose(){document.getElementById('lb').classList.remove('on');lbAt=-1;}
document.addEventListener('click',e=>{const t=e.target.closest('[data-n]');if(t){e.preventDefault();lbShow(+t.dataset.n);return;}
  const g=e.target.closest('[data-go]');if(g){g.dataset.go==='x'?lbClose():lbShow(lbAt+ +g.dataset.go);return;}
  if(e.target.id==='lbimg'||e.target.id==='lb')lbClose();});
document.addEventListener('keydown',e=>{if(lbAt<0)return;if(e.key==='Escape')lbClose();if(e.key==='ArrowRight')lbShow(lbAt+1);if(e.key==='ArrowLeft')lbShow(lbAt-1);});
const shot=(r,n)=>`<a href="${pic(r.path)}" data-n="${n}" title="${esc(r.name)}"><img loading="lazy" src="${pic(r.thumb||r.path)}" alt="${esc(r.name)}">${esc(r.name)} <span class="kind">${esc(r.server||'')}</span></a>`;
</script>'''

PAGE = HEAD.replace('TITLE', 'ComfyUI Queues') + r'''
<nav><a class="here">Queues</a><a href="history">History</a></nav><h1>ComfyUI queues</h1><div id="when">Loading...</div><div id="b"></div><div class="grid" id="g"></div>
<script>
const job=j=>`${esc(j.name)} <span class="kind">${esc(j.kind)}</span>`;
const loc=s=>s.folder?`<button class="loc" data-i="${s.i}" title="${esc(s.folder)}">Location</button>`:'';
document.addEventListener('click',async e=>{const b=e.target.closest('.loc');if(!b)return;b.textContent='Opening...';
  try{await fetch('open?i='+b.dataset.i)}catch(x){}setTimeout(()=>b.textContent='Location',1200)});
function card(s){
  if(!s.up) return `<div class="card off"><div class="top"><span class="pc">${esc(s.pc)}</span><span class="what">${esc(s.what)}</span></div><div class="big">Off</div><div class="small">not answering at ${esc(s.url)}</div>${loc(s)}</div>`;
  const n=s.running.length+s.pending.length, r=s.running[0], st=s.step;
  let h=`<div class="card"><div class="top"><span class="pc">${esc(s.pc)}</span><span class="what">${esc(s.what)}</span></div>`;
  // a rough time left: the average of the finished jobs of the same kind as the running one, times the jobs left
  const same=(s.done||[]).filter(d=>d.mins!=null&&r&&d.kind===r.kind), avg=same.length?same.reduce((a,d)=>a+d.mins,0)/same.length:null;
  const left=avg&&n?avg*n:null, fmt=m=>m>=90?(m/60).toFixed(1)+' hours':Math.round(m)+' min';
  h+=`<div class="big">${n?n+' job'+(n>1?'s':''):'Idle'}</div>${left?`<div class="small">about ${fmt(left)} left, at ${avg.toFixed(0)} min a job lately</div>`:''}<div class="small">${s.gpu?esc(s.gpu.name)+', '+s.gpu.free+' of '+s.gpu.total+' GB free':''}</div>${loc(s)}`;
  if(r){h+=`<h3>Running</h3><div class="run">${job(r)}</div>`;
    if(st) h+=`<div class="bar"><i style="width:${st.pct}%"></i></div><div class="small">this stage ${st.at} steps, ${esc(st.spent)} spent, about ${esc(st.left)} left</div>`;}
  if(s.pending.length) h+=`<h3>Waiting (${s.pending.length})</h3><ol>${s.pending.map(j=>`<li>${job(j)}</li>`).join('')}</ol>`;
  if(s.done&&s.done.length) h+=`<h3>Finished lately</h3><ul>${s.done.map(d=>`<li>${job(d)} <span class="${d.ok==='success'?'ok':'bad'}">${esc(d.ok||'')}</span>${d.mins!=null?' <span class="kind">'+d.mins+' min</span>':''}${d.end?' <span class="kind">at '+new Date(d.end).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})+'</span>':''}</li>`).join('')}</ul>`;
  return h+'</div>';}
// The painting script's own list: what's lined up, what each PC is on, and previews of what's finished.
function batchCard(b){
  if(!b) return '';
  const stale=!b.finished&&(Date.now()/1000-b.updated>600), avg=b.seconds.length?b.seconds.reduce((a,s)=>a+s,0)/b.seconds.length:null;
  const pcs=Math.max(1,Object.keys(b.running).length), left=avg&&!b.finished?avg*(b.waiting.length+Object.keys(b.running).length)/pcs/60:null;
  const pct=b.total?Math.round(100*b.done/b.total):100, at=t=>new Date(t*1000).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  let h=`<div class="card"><div class="top"><span class="pc">Batch: ${esc(b.batch)}</span><span class="what">started ${at(b.started)}</span></div>`;
  h+=`<div class="big">${b.done} of ${b.total} done</div><div class="bar"><i style="width:${pct}%"></i></div>`;
  h+=`<div class="small">${b.finished?'Finished at '+at(b.updated):stale?'No news for 10 minutes: has the script stopped?':(left?'about '+Math.max(1,Math.round(left))+' min left':'working...')}${b.failed.length?' · <span class="bad">'+b.failed.length+' failed</span>':''}</div>`;
  h+=`<div class="cols"><div>`;
  const run=Object.entries(b.running);
  if(run.length) h+=`<h3>Painting now</h3><ul>${run.map(([pc,n])=>`<li>${esc(n)} <span class="kind">on ${esc(pc)}</span></li>`).join('')}</ul>`;
  h+=`<h3>Lined up (${b.waiting.length})</h3>${b.waiting.length?`<ol class="wait">${b.waiting.map(n=>`<li>${esc(n)}</li>`).join('')}</ol>`:'<div class="small">nothing left</div>'}`;
  if(b.failed.length) h+=`<h3>Failed</h3><ul>${b.failed.map(n=>`<li class="bad">${esc(n)}</li>`).join('')}</ul>`;
  window.items=b.recent||[];
  h+=`</div><div><h3>Finished lately <span class="kind">(click one to see it whole; older ones are under History)</span></h3>${window.items.length?`<div class="thumbs">${window.items.map(shot).join('')}</div>`:'<div class="small">nothing yet</div>'}</div></div>`;
  return h+'</div>';}
async function tick(){try{const d=await (await fetch('api')).json();document.getElementById('g').innerHTML=d.servers.map(card).join('');
  const bh=batchCard(d.batch), bEl=document.getElementById('b'); if(bEl.dataset.h!==bh){bEl.innerHTML=bh;bEl.dataset.h=bh;}
  document.getElementById('when').textContent='Updated '+new Date().toLocaleTimeString()+', every 5 seconds';}catch(e){document.getElementById('when').textContent='The watcher itself is not answering: is queue_watch.py still running?'}}
tick();setInterval(tick,5000);
</script></body></html>'''

# Every picture ever finished, saved by tools/flux3.py in history.jsonl (one line each), grouped by batch, newest first.
HISTORY_FILE = os.path.join(ROOT, 'art', 'style-test', 'history.jsonl')

def history():
    out = []
    try:
        with open(HISTORY_FILE, encoding='utf-8') as f:
            for line in f:
                try: out.append(json.loads(line))
                except ValueError: pass
    except OSError: pass
    return sorted(out, key=lambda e: e.get('at') or 0, reverse=True)

HISTORY_PAGE = HEAD.replace('TITLE', 'Picture History') + r'''
<nav><a href="./">Queues</a><a class="here">History</a></nav><h1>Picture history</h1>
<div id="when">Loading...</div>
<input id="q" placeholder="Filter by name, batch or prompt words..." style="font:inherit;width:min(480px,100%);padding:6px 10px;border-radius:6px;border:1px solid var(--line);background:#2a272e;color:var(--text);margin-bottom:12px">
<div id="h"></div>
<script>
let all=[];
function draw(){const q=document.getElementById('q').value.toLowerCase().trim();
  const words=q.split(/\s+/).filter(Boolean);
  const list=all.filter(e=>{const s=(e.name+' '+e.batch+' '+(e.prompt||'')).toLowerCase();return words.every(w=>s.includes(w));});
  window.items=list;
  // group by batch, in order of each batch's newest picture
  const groups=new Map();list.forEach((e,n)=>{if(!groups.has(e.batch))groups.set(e.batch,[]);groups.get(e.batch).push([e,n]);});
  let h='';for(const [b,es] of groups){const t=new Date(es[0][0].at*1000).toLocaleString([], {dateStyle:'medium',timeStyle:'short'});
    h+=`<div class="card" style="margin-bottom:14px"><div class="top"><span class="pc">${esc(b)}</span><span class="what">${es.length} picture${es.length>1?'s':''}, newest ${esc(t)}</span></div><div class="thumbs" style="margin-top:8px">${es.map(([e,n])=>shot(e,n)).join('')}</div></div>`;}
  document.getElementById('h').innerHTML=h||'<div class="small">No pictures match.</div>';
  document.getElementById('when').textContent=`${all.length} pictures saved${q?', '+list.length+' match':''}. Click one to see it whole.`;}
fetch('history.json').then(r=>r.json()).then(d=>{all=d;draw();}).catch(()=>{document.getElementById('when').textContent='Could not load the history.';});
document.getElementById('q').addEventListener('input',draw);
</script></body></html>'''

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        if self.path.startswith('/open'):   # opens only a folder this page found itself, never one named in the request
            try: i = int(self.path.split('=')[-1])
            except ValueError: i = -1
            f = FOLDERS.get(i)
            if f:
                os.makedirs(f, exist_ok=True)
                os.startfile(f) if hasattr(os, 'startfile') else os.system(f'xdg-open "{f}"')
            body, ct = json.dumps({'opened': f}).encode(), 'application/json'
        elif self.path.startswith('/api'):
            with ThreadPoolExecutor(len(SERVERS)) as ex: data = list(ex.map(ask, range(len(SERVERS))))
            body, ct = json.dumps({'servers': data, 'batch': batch(), 't': time.time()}).encode(), 'application/json'
        elif self.path.startswith('/pic?'):   # a finished picture, for the previews: only pictures inside art/
            rel = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query).get('p', [''])[0]
            f = os.path.realpath(os.path.join(ROOT, rel))
            art = os.path.realpath(os.path.join(ROOT, 'art')) + os.sep
            if f.startswith(art) and f.lower().endswith(('.png', '.jpg', '.jpeg')) and os.path.isfile(f):
                body, ct = open(f, 'rb').read(), 'image/jpeg' if f.lower().endswith(('.jpg', '.jpeg')) else 'image/png'
            else:
                self.send_response(404); self.end_headers(); return
        elif self.path.startswith('/history.json'):
            body, ct = json.dumps(history()).encode(), 'application/json'
        elif self.path.startswith('/history'):
            body, ct = HISTORY_PAGE.encode(), 'text/html; charset=utf-8'
        else:
            body, ct = PAGE.encode(), 'text/html; charset=utf-8'
        self.send_response(200); self.send_header('Content-Type', ct); self.send_header('Cache-Control', 'no-store'); self.end_headers(); self.wfile.write(body)

if __name__ == '__main__':
    print(f'ComfyUI queues: http://localhost:{PORT}', flush=True)
    ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
