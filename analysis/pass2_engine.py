"""Pass 2: Stockfish evaluation of the first 40 plies of every King's Indian game.

  pass2_engine.py <pass1.json> <out.json> [nodes=300000]
"""
import io, json, os, sys
from multiprocessing import Pool
import chess, chess.engine, chess.pgn
sys.path.insert(0, os.path.dirname(__file__))
from common import is_kid, classify

PLIES = 40
STOCKFISH = os.environ.get("STOCKFISH", "/usr/games/stockfish")


def work(args):
    r, nodes = args
    eng = chess.engine.SimpleEngine.popen_uci(STOCKFISH)
    eng.configure({"Threads": 1, "Hash": 64})
    game = chess.pgn.read_game(io.StringIO(r["pgn"]))
    b = game.board(); evals = []; bests = []; fens = []
    moves = list(game.mainline_moves())
    for i in range(min(PLIES, len(moves)) + 1):
        info = eng.analyse(b, chess.engine.Limit(nodes=nodes))
        evals.append(info["score"].white().score(mate_score=10000))
        bests.append(b.san(info["pv"][0]) if info.get("pv") else None)
        fens.append(b.fen())
        if i < len(moves) and i < PLIES:
            b.push(moves[i])
    eng.quit()
    out = {k: v for k, v in r.items() if k != "pgn"}
    out.update(evals=evals, bests=bests, fens=fens, system=classify(r["sans"]))
    return out


if __name__ == "__main__":
    rows = json.load(open(sys.argv[1]))
    nodes = int(sys.argv[3]) if len(sys.argv) > 3 else 300000
    k = [r for r in rows if is_kid(r)]
    with Pool(int(os.environ.get("WORKERS", 4))) as p:
        out = p.map(work, [(r, nodes) for r in k], chunksize=2)
    json.dump(out, open(sys.argv[2], "w"))
    print("analysed", len(out))
