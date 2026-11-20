# Chess.com opening analysis

Finds which openings a player meets as Black, where their first mistakes come,
and which opponent mistakes they miss. The output feeds the site: the
personal decks, the "Your games" numbers, and the opponent moves used to pick
realistic surprise mistakes.

| Step | Script | What it does |
|---|---|---|
| 0 | `fetch_games.sh` | Downloads every monthly archive from the public chess.com API |
| 1 | `pass1_parse.py` | Replays each game: colour, result, ratings, moves, clocks |
| 2 | `pass2_engine.py` | Picks the King's Indian games (`common.is_kid`), classifies White's system, and evaluates the first 40 plies with Stockfish (300k nodes) |
| 3 | `pass3_book.py` | Where each game left the Lichess masters database, and who left first (cached, polite to Lichess) |
| 4 | `build_decks.py` | Writes `shared/personal/<user>.json` (mistake and punish positions, with every legal move evaluated), `shared/insights.json` and `course/opponent-moves.json` |

```bash
python3 -m venv .venv && .venv/bin/pip install chess
sudo apt-get install stockfish            # or STOCKFISH=/path/to/stockfish
U=ham_sandmitch; D=/tmp/cc-$U
analysis/fetch_games.sh $U $D
.venv/bin/python analysis/pass1_parse.py $D/archives $D/pass1.json $U
.venv/bin/python analysis/pass2_engine.py $D/pass1.json $D/pass2.json
.venv/bin/python analysis/pass3_book.py $D/pass1.json $D/book.json $D/masters_cache.json
.venv/bin/python analysis/build_decks.py $D/pass1.json $D/pass2.json $D/book.json $U .
npm run course:index      # so the server knows the deck ids
```

With 4 cores, pass 2 takes about 25 minutes for 269 games; `build_decks.py`
about 10 minutes for ~550 positions.

**Definitions**
* **A mistake:** a drop of at least 0.2 in winning chances, Lichess's formula
  `2/(1+e^(-0.00368·cp)) − 1`.
* **A deck answer is right** if it is within 0.05 winning chances of
  Stockfish's best move.
* **Opponent mistakes** go into the deck only if your best reply leaves you
  at least +1.00.
* **Left theory:** the first move with fewer than 5 games in the Lichess
  masters database.
