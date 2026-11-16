"""Paint pictures with FLUX.3 Image Klein on both computers at once.

This PC (ComfyUI on port 8188, start it with tools/start_comfy_main.bat) and the second PC
(ComfyUI on 192.168.2.37:8189, kept running there by its own watcher) each take the next job
from one shared list, so a batch finishes about twice as fast. A computer that doesn't answer is
skipped. Pictures that already exist are not painted again.

Used by the other scripts (look_study.py, ...); not run by itself.
"""

import json
import os
import sys
import threading
import time
import urllib.parse
import urllib.request
import uuid

from PIL import Image, ImageDraw, ImageFont

SERVERS = {
    "this PC": os.environ.get("COMFY_MAIN", "http://127.0.0.1:8188"),
    "second PC": os.environ.get("COMFY_SECOND", "http://192.168.2.37:8189"),
}


def graph(prompt, seed, width=1024, height=1024, prefix="cds", refs=()):
    """The ComfyUI recipe for one picture: FLUX.3 Klein distilled (16 steps, no guidance),
    the Qwen3-VL 4B text model and the FLUX.2 VAE (the part that turns the result into pixels).
    refs: names of pictures already uploaded to the server. Each one is shown to the model as a
    reference (it looks at them while painting); the prompt can call them "image 1", "image 2"."""
    g = {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": "flux3-image-klein-int8-convrot.safetensors", "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen3vl_4b_int8_convrot.safetensors", "type": "flux3", "device": "default"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": "flux2-vae.safetensors"}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["2", 0]}},
        "5": {"class_type": "ConditioningZeroOut", "inputs": {"conditioning": ["4", 0]}},
        "6": {"class_type": "CFGGuider", "inputs": {"model": ["1", 0], "positive": ["4", 0], "negative": ["5", 0], "cfg": 1.0}},
        "7": {"class_type": "KSamplerSelect", "inputs": {"sampler_name": "euler"}},
        "8": {"class_type": "Flux2Scheduler", "inputs": {"steps": 16, "width": width, "height": height}},
        "9": {"class_type": "RandomNoise", "inputs": {"noise_seed": seed}},
        "10": {"class_type": "EmptyFlux2LatentImage", "inputs": {"width": width, "height": height, "batch_size": 1}},
        "11": {"class_type": "SamplerCustomAdvanced", "inputs": {"noise": ["9", 0], "guider": ["6", 0], "sampler": ["7", 0], "sigmas": ["8", 0], "latent_image": ["10", 0]}},
        "12": {"class_type": "VAEDecode", "inputs": {"samples": ["11", 0], "vae": ["3", 0]}},
        "13": {"class_type": "SaveImage", "inputs": {"images": ["12", 0], "filename_prefix": prefix}},
    }
    # Each reference: load it, shrink it to about 1 megapixel, turn it into the model's own format,
    # and attach it to the prompt. Several are chained one after another.
    last = ["4", 0]
    for i, name in enumerate(refs):
        n = 20 + i * 4
        g[str(n)] = {"class_type": "LoadImage", "inputs": {"image": name}}
        g[str(n + 1)] = {"class_type": "ImageScaleToTotalPixels", "inputs": {"image": [str(n), 0], "upscale_method": "lanczos", "megapixels": 1.0, "resolution_steps": 1}}
        g[str(n + 2)] = {"class_type": "VAEEncode", "inputs": {"pixels": [str(n + 1), 0], "vae": ["3", 0]}}
        g[str(n + 3)] = {"class_type": "ReferenceLatent", "inputs": {"conditioning": last, "latent": [str(n + 2), 0]}}
        last = [str(n + 3), 0]
    g["6"]["inputs"]["positive"] = last
    return g


_uploaded = {}   # (server url, local path) -> the name the server gave it


def upload(url, path):
    """Copy a reference picture to a ComfyUI server (once per server)."""
    key = (url, os.path.abspath(path))
    if key not in _uploaded:
        boundary = uuid.uuid4().hex
        name = "cds_" + os.path.basename(path)
        with open(path, "rb") as f:
            data = f.read()
        body = (f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="{name}"\r\n'
                f'Content-Type: image/png\r\n\r\n').encode() + data + \
               (f'\r\n--{boundary}\r\nContent-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n--{boundary}--\r\n').encode()
        req = urllib.request.Request(url + "/upload/image", body, {"Content-Type": f"multipart/form-data; boundary={boundary}"})
        _uploaded[key] = json.loads(urllib.request.urlopen(req, timeout=60).read())["name"]
    return _uploaded[key]


def answers(url):
    try:
        urllib.request.urlopen(url + "/queue", timeout=4).read()
        return True
    except OSError:
        return False


PAINT_LIMIT = 420   # seconds; a painting that takes longer than this is stuck and gets stopped


def paint(url, g, path):
    """Send one recipe to a ComfyUI server, wait for it, and save the picture."""
    started = time.time()
    req = urllib.request.Request(url + "/prompt", json.dumps({"prompt": g}).encode(), {"Content-Type": "application/json"})
    r = json.loads(urllib.request.urlopen(req, timeout=30).read())
    if r.get("node_errors"):
        raise RuntimeError("recipe refused: " + json.dumps(r["node_errors"])[:800])
    pid = r["prompt_id"]
    while True:
        h = json.loads(urllib.request.urlopen(url + "/history/" + pid, timeout=30).read())
        if pid in h:
            if h[pid].get("outputs", {}).get("13"):
                break
            if h[pid].get("status", {}).get("status_str") == "error":
                raise RuntimeError("painting failed: " + json.dumps(h[pid]["status"])[:800])
        if time.time() - started > PAINT_LIMIT:
            # Stuck (it happens now and then): stop it on the server so the next job can start.
            urllib.request.urlopen(urllib.request.Request(url + "/interrupt", b"", method="POST"), timeout=10).read()
            raise RuntimeError(f"stuck for over {PAINT_LIMIT} s, stopped")
        time.sleep(1)
    im = h[pid]["outputs"]["13"]["images"][0]
    data = urllib.request.urlopen(url + "/view?" + urllib.parse.urlencode(im), timeout=60).read()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)


def run_jobs(jobs):
    """jobs: a list of dicts with prompt, seed, path and optionally width and height.
    Shares them out between the computers that answer."""
    todo = [j for j in jobs if not os.path.exists(j["path"])]
    live = {name: url for name, url in SERVERS.items() if answers(url)}
    for name in SERVERS:
        print(f"{name}: {'ready' if name in live else 'not answering, skipped'}", flush=True)
    if not live:
        raise SystemExit("No ComfyUI answers. Start tools/start_comfy_main.bat on this PC.")
    print(f"{len(todo)} to paint ({len(jobs) - len(todo)} already there)", flush=True)
    lock = threading.Lock()
    failures = []
    retried = set()   # paths that failed once and went back to the end of the list
    # What the queue page (queue_watch.py) shows as "lined up": the jobs still waiting in this
    # script, which ComfyUI itself never sees until each one's turn comes.
    status = {"batch": os.path.basename(sys.argv[0]), "started": time.time(), "total": len(todo),
              "done": 0, "waiting": [pic_name(j) for j in todo], "running": {}, "failed": [],
              "seconds": [], "recent": [], "finished": False}
    save_status(status)

    def worker(server, url):
        while True:
            with lock:
                if not todo:
                    return
                job = todo.pop(0)
                pic = pic_name(job)
                status["waiting"].remove(pic)
                status["running"][server] = pic
                save_status(status)
            t = time.time()
            try:
                refs = [upload(url, p) for p in job.get("refs", [])]
                paint(url, graph(job["prompt"], job["seed"], job.get("width", 1024), job.get("height", 1024),
                                 prefix=f"cds/{pic}", refs=refs), job["path"])
                print(f"  {pic}  {round(time.time() - t)} s on {server}", flush=True)
                ok = True
            except Exception as e:   # keep going with the rest; report at the end
                err = f"{server}: {e}"
                print(f"  {pic} FAILED on {err}", flush=True)
                ok = False
            with lock:
                status["running"].pop(server, None)
                if not ok and job["path"] not in retried:
                    # Failures happen now and then (mostly on the second PC): try once more, last in line.
                    retried.add(job["path"])
                    todo.append(job)
                    status["waiting"].append(pic)
                    print(f"  {pic} goes back in line for one more try", flush=True)
                    save_status(status)
                    continue
                if not ok:
                    failures.append((job["path"], err))
                if ok:
                    status["done"] += 1
                    status["seconds"].append(round(time.time() - t, 1))
                    entry = record(job, server, time.time() - t, status["batch"])
                    # Newest first, for the queue page's preview pictures.
                    status["recent"].insert(0, entry)
                    del status["recent"][24:]
                else:
                    status["failed"].append(pic)
                save_status(status)

    threads = [threading.Thread(target=worker, args=item) for item in live.items()]
    for th in threads:
        th.start()
    for th in threads:
        th.join()
    status["finished"] = True
    save_status(status)
    for path, why in failures:
        print("failed:", path, why)


PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATUS_FILE = os.path.join(PROJECT, "art", "style-test", "batch_status.json")


HISTORY_FILE = os.path.join(PROJECT, "art", "style-test", "history.jsonl")


def pic_name(job):
    return os.path.splitext(os.path.basename(job["path"]))[0]


def rel(path):
    """A path relative to the project, with forward slashes (what the queue page asks for)."""
    return os.path.relpath(path, PROJECT).replace("\\", "/")


def make_thumb(path, width=360):
    """A small JPEG copy in a thumbs/ folder beside the picture, so the history page loads fast."""
    thumb = os.path.join(os.path.dirname(path), "thumbs", pic_name({"path": path}) + ".jpg")
    if not os.path.exists(thumb) or os.path.getmtime(thumb) < os.path.getmtime(path):
        os.makedirs(os.path.dirname(thumb), exist_ok=True)
        im = Image.open(path).convert("RGB")
        im.thumbnail((width, width * 2), Image.LANCZOS)
        im.save(thumb, quality=85)
    return thumb


def record(job, server, seconds, batch, at=None):
    """Add a finished picture to the saved history (one line of JSON per picture in history.jsonl),
    with everything needed to paint it again: prompt, seed, size and references."""
    entry = {
        "name": pic_name(job), "batch": batch, "server": server, "at": at or time.time(),
        "seconds": round(seconds, 1) if seconds is not None else None,
        "path": rel(job["path"]), "thumb": rel(make_thumb(job["path"])),
        "prompt": job["prompt"], "seed": job["seed"],
        "width": job.get("width", 1024), "height": job.get("height", 1024),
        "refs": [rel(p) for p in job.get("refs", [])],
    }
    os.makedirs(os.path.dirname(HISTORY_FILE), exist_ok=True)
    with open(HISTORY_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")
    return entry


def save_status(status):
    """Write the batch's state where queue_watch.py reads it (via a temporary file, so the page
    never reads a half-written one)."""
    status["updated"] = time.time()
    os.makedirs(os.path.dirname(STATUS_FILE), exist_ok=True)
    tmp = STATUS_FILE + ".tmp"
    # Windows refuses the swap while the queue page is reading the file: try a few times, and if it
    # still won't go, skip this update (the next one will catch up) instead of stopping the painting.
    for attempt in range(5):
        try:
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(status, f)
            os.replace(tmp, STATUS_FILE)
            return
        except OSError:
            time.sleep(0.2)


def contact_sheet(rows, out_path, thumb=300, thumb_h=None):
    """rows: a list of (label, [picture paths]). One labelled row per entry, missing pictures left grey.
    thumb is the width of each small picture, thumb_h its height (square if not given)."""
    th = thumb_h or thumb
    try:
        font = ImageFont.truetype("arialbd.ttf", 18)
    except OSError:
        font = ImageFont.load_default()
    cols = max(len(paths) for _, paths in rows)
    head, gap = 30, 6
    sheet = Image.new("RGB", (cols * (thumb + gap) + gap, len(rows) * (th + head + gap)), (30, 32, 30))
    d = ImageDraw.Draw(sheet)
    for r, (label, paths) in enumerate(rows):
        y = r * (th + head + gap)
        d.text((gap + 2, y + 6), label, fill=(255, 220, 120), font=font)
        for c, p in enumerate(paths):
            x = gap + c * (thumb + gap)
            if os.path.exists(p):
                sheet.paste(Image.open(p).convert("RGB").resize((thumb, th), Image.LANCZOS), (x, y + head))
            else:
                d.rectangle([x, y + head, x + thumb, y + head + th], fill=(60, 60, 60))
    sheet.save(out_path)
    print("sheet:", out_path)
