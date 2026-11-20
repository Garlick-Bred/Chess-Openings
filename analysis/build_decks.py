"""Turn the King's Indian analysis into data for the site.

  build_decks.py <pass1.json> <pass2.json> <book.json> <username> <repo_root>

Writes
  course/opponent-moves.json        White's moves per position in your games
                                    (used to pick realistic surprises)
  shared/personal/<username>.json   your two personal decks:
                                      mistakes - positions where you went wrong
                                      punish   - your opponents' mistakes, to cash in
                                    with Stockfish evaluations of every legal move
  shared/insights.json              the numbers behind the "Your games" page
"""
import collections, json, os, sys, statistics
from multiprocessing import Pool
import chess, chess.engine
sys.path.insert(0, os.path.dirname(__file__))
from common import is_kid, key, win_chance, points, CHAPTER

P1, P2, BOOK, USER, ROOT = sys.argv[1:6]
STOCKFISH = os.environ.get("STOCKFISH", "/usr/games/stockfish")
MISTAKE = 0.2      # Lichess "mistake": a 20% drop in winning chances
DEPTH_ALL, DEPTH = 12, 18
ACCEPT_WC = 0.05   # deck answers within this of the best move's winning chances count as right
PV_LOSS = 50

rows = json.load(open(P1))
ev = json.load(open(P2))
book = {b["url"]: b["left"] for b in json.load(open(BOOK))} if os.path.exists(BOOK) else {}

# --- opponent moves per position (White, first 20 plies of King's Indian games)
opp = collections.defaultdict(collections.Counter)
for r in rows:
    if not is_kid(r):
        continue
    b = chess.Board()
    for j, s in enumerate(r["sans"][:20]):
        if j % 2 == 0:
            opp[key(b.fen())][s] += 1
        b.push_san(s)
json.dump({k: dict(v) for k, v in opp.items() if sum(v.values()) >= 1}, open(os.path.join(ROOT, "course/opponent-moves.json"), "w"), sort_keys=True)

# --- deck items
items = []
for g in ev:
    e = g["evals"]
    n = len(e) - 1
    meta = {"url": g["url"], "end": g["end"], "tc": g["tc"], "oppRating": g.get("oppr"), "rating": g.get("myr"), "result": g["res"], "system": g["system"]}
    mistakes = 0
    for j in range(n):
        if j % 2 == 1:  # Black (you) moved
            drop = (-win_chance(e[j])) - (-win_chance(e[j + 1]))
            if drop >= MISTAKE and mistakes < 2:
                mistakes += 1
                items.append({"kind": "mistake", "ply": j, "fen": g["fens"][j], "moves": g["sans"][:j], "played": g["sans"][j],
                              "drop": round(drop, 3), "game": meta})
        else:  # White moved: an opponent mistake, if it handed you a real advantage
            drop = win_chance(e[j]) - win_chance(e[j + 1])
            if drop >= MISTAKE and j + 1 < n and -e[j + 1] >= 100 and j < 30:
                items.append({"kind": "punish", "ply": j + 1, "fen": g["fens"][j + 1], "moves": g["sans"][:j + 1], "played": g["sans"][j + 1],
                              "theirs": g["sans"][j], "drop": round(drop, 3), "game": meta})
# One item per position (the first game that reached it), most recent games first.
items.sort(key=lambda it: -it["game"]["end"])
seen = set(); uniq = []
for it in items:
    k = (it["kind"], key(it["fen"]))
    if k in seen:
        continue
    seen.add(k); uniq.append(it)
items = uniq


def evaluate(fen):
    eng = chess.engine.SimpleEngine.popen_uci(STOCKFISH)
    eng.configure({"Threads": 1, "Hash": 128})
    b = chess.Board(fen)
    legal = list(b.legal_moves)
    res = {}
    pvs = {}
    for info in eng.analyse(b, chess.engine.Limit(depth=DEPTH_ALL), multipv=len(legal)):
        s = b.san(info["pv"][0]); res[s] = info["score"].relative.score(mate_score=10000); pvs[s] = info["pv"][:7]
    for info in eng.analyse(b, chess.engine.Limit(depth=DEPTH), multipv=3):
        s = b.san(info["pv"][0]); res[s] = info["score"].relative.score(mate_score=10000); pvs[s] = info["pv"][:7]
    eng.quit()
    best = max(res, key=res.get)
    pv = {}
    for s, cp in res.items():
        if s == best or res[best] - cp >= PV_LOSS:
            bb = b.copy(); line = []
            for m in pvs[s]:
                if m not in bb.legal_moves:
                    break
                line.append(bb.san(m)); bb.push(m)
            pv[s] = line
    return fen, {"e": res, "pv": pv, "best": best}


with Pool(int(os.environ.get("WORKERS", 4))) as p:
    evals = dict(p.map(evaluate, sorted({it["fen"] for it in items}), chunksize=2))

positions = {}
deck = []
for it in items:
    r = evals[it["fen"]]
    e = r["e"]
    best = r["best"]
    bw = win_chance(e[best])
    accept = [s for s, cp in e.items() if bw - win_chance(cp) <= ACCEPT_WC]
    if it["kind"] == "mistake":
        # Skip positions where the game move was actually fine at full depth.
        if it["played"] in accept or bw - win_chance(e.get(it["played"], -10000)) < 0.12:
            continue
    else:
        # Keep only clear chances: the best reply must leave you clearly better.
        if e[best] < 100:
            continue
    k = key(it["fen"])
    # Keep what grading needs: the top moves, the move you played and the
    # accepted answers (anything else counts as missing the chance), with
    # Stockfish lines for the best, accepted and played moves only.
    keep = set(sorted(e, key=lambda s: -e[s])[:12]) | {it["played"]} | set(accept)
    pv_keep = {best, it["played"], *accept[:3]}
    positions[k] = {"fen": it["fen"], "e": {s: cp for s, cp in e.items() if s in keep},
                    "pv": {s: line for s, line in r["pv"].items() if s in pv_keep}}
    found = it["played"] in accept
    deck.append({
        "id": f"{it['kind'][0]}{it['game']['url'].rsplit('/', 1)[-1]}-{it['ply']}",
        "kind": it["kind"], "key": k, "moves": it["moves"], "played": it["played"], "theirs": it.get("theirs"),
        "best": best, "accept": accept, "found": found,
        "chapter": CHAPTER.get(it["game"]["system"], "mainline" if it["game"]["system"].startswith("KID main") else "flank"),
        "game": it["game"],
    })

os.makedirs(os.path.join(ROOT, "shared/personal"), exist_ok=True)
json.dump({"user": USER, "items": deck, "positions": positions}, open(os.path.join(ROOT, f"shared/personal/{USER}.json"), "w"))
print("deck", collections.Counter(d["kind"] for d in deck), "found in game:", sum(1 for d in deck if d["kind"] == "punish" and d["found"]))

# --- insights for the site
kid = [r for r in rows if is_kid(r)]
evu = {g["url"]: g for g in ev}
def first_mistake(g):
    e = g["evals"]
    for j in range(1, len(e) - 1, 2):
        if (-win_chance(e[j])) - (-win_chance(e[j + 1])) >= MISTAKE:
            return j
    return None
by = collections.defaultdict(list)
for r in kid:
    g = evu.get(r["url"])
    if g:
        by[g["system"]].append((r, g))
systems = []
for name, L in sorted(by.items(), key=lambda x: -len(x[1])):
    fm = [first_mistake(g) for _, g in L]
    fmn = sorted(j // 2 + 1 for j in fm if j is not None)
    e10 = [-g["evals"][20] for _, g in L if len(g["evals"]) > 20]
    systems.append({"name": name, "chapter": CHAPTER.get(name, "mainline" if name.startswith("KID main") else "flank"), "games": len(L),
                    "score": round(sum(points(r["res"]) for r, _ in L) / len(L), 3),
                    "mistakeBy10": round(sum(1 for x in fmn if x <= 10) / len(L), 3),
                    "medianFirstMistake": fmn[len(fmn) // 2] if fmn else None,
                    "evalAfter10": round(statistics.mean(e10) / 100, 2) if e10 else None})
allfm = sorted(j // 2 + 1 for j in (first_mistake(g) for g in ev) if j is not None)
lefts = [book.get(g["url"]) for g in ev]
opp_mist = [it for it in items if it["kind"] == "punish"]
ins = {
    "user": USER, "games": len(kid), "score": round(sum(points(r["res"]) for r in kid) / len(kid), 3),
    "firstMistakeMedian": allfm[len(allfm) // 2], "mistakeBy10": round(sum(1 for x in allfm if x <= 10) / len(ev), 3),
    "mistakeBy20": round(len(allfm) / len(ev), 3),
    "opponentLeftFirst": round(sum(1 for l in lefts if l and l["by"] == "white") / max(1, sum(1 for l in lefts if l)), 3),
    "systems": systems,
    "generated": max(r["end"] for r in kid),
}
json.dump(ins, open(os.path.join(ROOT, "shared/insights.json"), "w"), indent=1)
print("insights written")
