# Research notes

What the research says about learning openings, and how it shaped the site.
Searches ran in November 2026. Most opening-specific advice comes from coaches
and practitioners, not controlled studies; where the evidence is from other
fields, that is said.

## 1. What practice works, and what the site does with it

| Finding | Strength of evidence | In the site |
|---|---|---|
| **Retrieval practice** (recalling beats re-reading). Roediger & Karpicke (2006); meta-analyses put the effect around g = 0.5 | Strong, many fields | You play Black's moves from memory; the site never just shows them, except in lessons |
| **Spaced repetition** | Strong in other fields; no peer-reviewed chess study found | Lines graduate after 3 clean days, then check-ups at 3/7/14/30/60 days |
| **Interleaving** (mixing topics) helps transfer: Brunmair & Richter (2019) meta-analysis, g ≈ 0.42, strongly dependent on the material | Moderate | Sessions rotate lines from different systems and mix in deck positions |
| **Errors help when followed by corrective feedback that explains the reasoning**: Metcalfe (2017), *Annual Review of Psychology* | Strong | Every miss gets the concrete reason and the principle; the answer comes on the second try |
| **Self-explanation prompts**: Bisra et al. (2018), 64 studies, g = 0.55. A later study found no effect for plain factual knowledge | Moderate | Each line ends with a plan question ("where do you attack?") |
| **Learn first, remember later**: understand a line before drilling it; memorisation without ideas is fragile | Practitioner consensus | New lines open as a lesson with one explanation per move |
| **Principles and structures over deep theory below about 1400**; group lines by pawn structure and plan | Coaching consensus | Lines are 8-12 moves, each chapter has a plan card, and 12 principles are linked from every note |
| **Prepare for what your opponents actually play** | Practitioner (e.g. Chessreps) | Chapters are ordered by your opponents' systems; surprises prefer moves they played |
| **Learn from your own games**, checking deviations against your repertoire and masters (Lichess's "learn from your mistakes" won't call a master move a mistake) | Practitioner | Personal decks from your games; the Games page; master moves aren't called mistakes |
| **Deliberate practice beats only playing**: a 2026 *Psychological Science* study of 44,213 chess.com players | Observational | The whole site |

Lichess's thresholds for inaccuracy, mistake and blunder (a drop of 0.1, 0.2
and 0.3 in winning chances) are used for grading.

## 2. Why no engine or AI on the site

Language models invent chess moves and evaluations; this is the same evidence
as in the endgame site's research notes (SPIN-Bench, LLM CHESS,
*Hallucinations on the Board*). What works is "the engine supplies the facts,
words come from rules, then verify". So:

* every evaluation comes from Stockfish, computed when the course is built;
* every concrete statement (wins a pawn, allows mate, kicks the knight) is
  derived from Stockfish's own line by code, not written freehand;
* the principle notes were written by hand (by Claude, for this course), and
  every repertoire move they explain was checked against Stockfish and the
  masters database.

## 3. What the analysis of your games added

See [the report](reports/ham_sandmitch-kings-indian.md). In short:

* most opponents never play the main-line King's Indian;
* the opening itself is level, and the mistakes cluster at moves 8-12;
* a third of first mistakes were missed captures;
* you use much more clock than your opponents in the opening.

That's why:

* the course starts with the London and Colle, not the Classical;
* every line ends with the plan;
* the surprise mode exists;
* graduated lines come back on a clock.

## Sources

* Retrieval practice: [Roediger & Karpicke 2006 and later reviews](https://pmc.ncbi.nlm.nih.gov/articles/PMC10409703); [overview (Springer)](https://link.springer.com/content/pdf/10.1186%2Fs41235-023-00508-8.pdf)
* Interleaving: [Brunmair & Richter 2019, summary](https://doi.org/10.1007/s42087-023-00383-1)
* Errors and feedback: [Metcalfe 2017, "Learning from Errors"](https://wesleyan.edu/ofcd/resources/OFCD%20Resource%20Docs/Learning%20from%20Errors.pdf)
* Self-explanation: [Bisra et al. 2018 (BPS summary)](https://www.bps.org.uk/research-digest/self-explanation-powerful-learning-technique-according-meta-analysis-64-studies)
* Spaced repetition for openings: [Listudy](https://listudy.org/en/blog/spaced-repetition-for-chess), [Zwischenzug](https://zwischenzug.substack.com/p/spaced-repetition), [Learn first, remember later](https://chessimprovementlab.substack.com/p/learn-first-remember-later), [Andy Matuschak on Chessable's MoveTrainer](https://notes.andymatuschak.org/zDr94hP6bG3jJYrdYy8B5hx)
* Principles vs memorisation: [chess.com, OnlineChessTeacher](https://www.chess.com/blog/OnlineChessTeacher/memorizing-chess-openings-vs-understanding-principles), [chess.com, chesscoachdiego](https://www.chess.com/blog/chesscoachdiego/the-opening-playbook-less-memorization-more-understanding)
* Opponent-focused training and learning from your games: [Chessreps](https://www.chessreps.com/about), [Lichess "Learn from your mistakes"](https://lichess.org/blog/WFvLpiQAACMA8e9D/learn-from-your-mistakes)
* Chess expertise and templates: [Chassy & Gobet 2011](https://pmc.ncbi.nlm.nih.gov/articles/PMC3217924)
* King's Indian against the London: [Kamsky vs the KID (TheChessWorld)](https://thechessworld.com/articles/openings/kamsky-vs-the-kid-london-system/), [Lichess blog](https://lichess.org/@/ALEEQAP/blog/london-system-vs-kings-indian-setup/DcGiQ3iC)
* The Lichess explorer API now needs a token for its club-player database: [Lichess blog](https://lichess.org/@/thibault/blog/the-opening-explorer-now-requires-authentication/FSWh9Zg3) (the masters database still answered without one in November 2026)
* Deliberate practice in chess: [Psychological Science 2026](https://www.psychologicalscience.org/journals/psychological-science/09567976261452568/)
