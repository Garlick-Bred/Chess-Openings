"""Pass 3: where each King's Indian game left master theory (Lichess masters
database, fewer than 5 master games with the move), and who left first.

  pass3_book.py <pass1.json> <out.json> <cache.json>
"""
import json, os, sys, time, urllib.parse, urllib.request
import chess
sys.path.insert(0, os.path.dirname(__file__))
from common import is_kid, key

ALL, OUT, CACHE = sys.argv[1:4]
MIN = 5
cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}


def fetch(b):
    k = key(b.fen())
    if k in cache:
        return cache[k]
    url = "https://explorer.lichess.ovh/masters?" + urllib.parse.urlencode({"fen": b.fen(), "moves": 30, "topGames": 0})
    for _ in range(5):
        try:
            d = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "garlick-openings-analysis/0.1"}), timeout=30))
            break
        except Exception as e:
            time.sleep(60 if "429" in str(e) else 5)
    else:
        raise SystemExit("explorer not answering")
    cache[k] = {m["san"]: m["white"] + m["draws"] + m["black"] for m in d["moves"]}
    time.sleep(1.1)
    return cache[k]


out = []
for n, r in enumerate([r for r in json.load(open(ALL)) if is_kid(r)]):
    b = chess.Board(); left = None
    for j, s in enumerate(r["sans"][:30]):
        moves = fetch(b)
        if moves.get(s, 0) < MIN:
            left = {"ply": j, "by": "white" if j % 2 == 0 else "black", "san": s,
                    "book": sorted(moves, key=lambda m: -moves[m])[:3]}
            break
        b.push_san(s)
    out.append({"url": r["url"], "left": left})
    if n % 20 == 0:
        json.dump(cache, open(CACHE, "w"))
json.dump(cache, open(CACHE, "w")); json.dump(out, open(OUT, "w"))
print("done", len(out))
