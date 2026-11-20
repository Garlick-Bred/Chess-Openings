"""Pass 1: replay every chess.com game and keep what the opening analysis needs.

  pass1_parse.py <archives_dir> <out.json> <username>

Writes one row per game: colour, time class, result, ratings, SAN moves,
clock readings and the PGN (for later passes).
"""
import glob, io, json, sys
import chess, chess.pgn

ARCH, OUT = sys.argv[1], sys.argv[2]
USER = (sys.argv[3] if len(sys.argv) > 3 else "ham_sandmitch").lower()
rows = []
for f in sorted(glob.glob(f"{ARCH}/*.json")):
    for g in json.load(open(f)).get("games", []):
        if g.get("rules") != "chess" or "pgn" not in g:
            continue
        white_is_user = g["white"]["username"].lower() == USER
        me = g["white"] if white_is_user else g["black"]
        opp = g["black"] if white_is_user else g["white"]
        game = chess.pgn.read_game(io.StringIO(g["pgn"]))
        if game is None:
            continue
        b = game.board(); sans = []; clocks = []
        for node in game.mainline():
            sans.append(b.san(node.move)); b.push(node.move); clocks.append(node.clock())
        rows.append(dict(url=g["url"], end=g["end_time"], tc=g["time_class"], time_control=g.get("time_control"),
                         color="w" if white_is_user else "b", res=me["result"], opp_res=opp["result"],
                         myr=me.get("rating"), oppr=opp.get("rating"), eco=game.headers.get("ECOUrl", ""),
                         sans=sans, clocks=clocks, pgn=g["pgn"]))
json.dump(rows, open(OUT, "w"))
print("games", len(rows))
