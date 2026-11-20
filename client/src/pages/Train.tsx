import { useApp, go } from '../App';
import { localDay } from '../api';
import { useCourse, useDeck } from '../course';
import { curriculumFor, deckDueFor, nextExerciseRoute, surpriseLines } from '../school';
import { StatusPill, niceDay } from '../components/ui';
import { GRADUATE_DAYS, REVIEW_DAYS, MAX_REVIEWS_PER_DAY } from '@shared/curriculum.js';
import { plural } from './Home';

export default function TrainPage() {
  const { me } = useApp();
  const course = useCourse();
  const deck = useDeck(me.user.settings.chesscom);
  if (!course || deck === undefined) return <div className="page">Loading…</div>;
  const today = localDay();
  const cur = curriculumFor(me, course);
  const due = deckDueFor(me, deck);
  const start = () => go(nextExerciseRoute(me, course, deck) ?? '/lines');
  const deckStats = deck
    ? {
        mistakes: deck.items.filter((i) => i.kind === 'mistake').length,
        punish: deck.items.filter((i) => i.kind === 'punish').length,
        mastered: deck.items.filter((i) => me.progress.deck[i.id]?.status === 'mastered').length,
        seen: deck.items.filter((i) => me.progress.deck[i.id]).length,
      }
    : null;
  const surprise = () => {
    const pool = surpriseLines(course);
    const known = pool.filter((l) => me.progress.lines[l.id]);
    const pickFrom = known.length ? known : pool;
    const l = pickFrom[Math.floor(Math.random() * pickFrom.length)];
    if (l) go(`/line/${l.id}?mode=free&surprise=1`);
  };
  const randomDeck = (kind: 'mistake' | 'punish') => {
    if (!deck) return;
    const items = deck.items.filter((i) => i.kind === kind);
    const fresh = items.filter((i) => !me.progress.deck[i.id]);
    const pool = fresh.length ? fresh : items;
    const it = pool[Math.floor(Math.random() * pool.length)];
    if (it) go(`/deck/${it.id}`);
  };

  return (
    <div className="page train">
      <section className="card hero-train">
        <div>
          <div className="eyebrow">Opening School</div>
          <h1>Spaced repetition for your repertoire</h1>
          <p className="muted small">
            Learn {cur.active.length > 1 ? 'three lines at a time' : 'one line at a time'}. The first run of a line each day is the test: get every move right on {GRADUATE_DAYS}{' '}
            different days and it graduates. Graduated lines come back for timed check-ups after {REVIEW_DAYS.join(', ')} days. Positions from your own games are mixed
            in between lines.
          </p>
        </div>
        <button className="btn primary big" onClick={start}>
          ▶ Start
        </button>
      </section>

      <section>
        <h3 className="section-title">🩺 Check-ups due ({cur.due.length})</h3>
        {cur.due.length === 0 ? (
          <p className="muted small">None today. Graduated lines come back here on their check-up day (up to {MAX_REVIEWS_PER_DAY} a day).</p>
        ) : (
          <div className="line-list">
            {cur.due.map((i) => (
              <LineRow key={i.id} id={i.id} name={i.line.name} chapter={course.chapterById[i.line.chapter]?.name} p={me.progress.lines[i.id]} today={today} mode="review" />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="section-title">🎓 Now learning</h3>
        <div className="line-list">
          {cur.active.map((i) => (
            <LineRow key={i.id} id={i.id} name={i.line.name} chapter={course.chapterById[i.line.chapter]?.name} p={me.progress.lines[i.id]} today={today} mode="learn" done={i.testedToday} />
          ))}
        </div>
        {cur.todo.length === 0 && cur.active.length > 0 && (
          <p className="small muted">Today’s tests are done. Extra practice still fills half a clove, and new lines move in as these graduate.</p>
        )}
      </section>

      <section className="card">
        <h3>⚡ Punish practice</h3>
        <p className="small muted">
          In practice runs, White sometimes leaves the script with a realistic mistake (from your own opponents where possible). You don’t get a warning, just like in a game:
          spot it and cash in. You can also ask for one now.
        </p>
        <div className="row gap wrap">
          <button className="btn" onClick={surprise}>
            ⚡ A line with a surprise
          </button>
          {deck && (
            <>
              <button className="btn" onClick={() => randomDeck('punish')}>
                🎯 An opponent’s mistake from your games
              </button>
              <button className="btn" onClick={() => randomDeck('mistake')}>
                🩹 One of your own mistakes
              </button>
            </>
          )}
        </div>
        {deckStats && (
          <p className="small muted">
            Your decks: {plural(deckStats.mistakes, 'position')} where you went wrong and {plural(deckStats.punish, 'opponent mistake')} to punish, built from{' '}
            {me.user.settings.chesscom}’s games. {deckStats.seen} seen, {deckStats.mastered} mastered, {due.length} due today.
          </p>
        )}
        {!deck && (
          <p className="small muted">
            Personal decks are built from your chess.com games. Right now there is one for ham_sandmitch; add your chess.com username in <a href="#/settings">Settings</a>.
          </p>
        )}
      </section>

      <section>
        <h3 className="section-title">🎓 Graduated ({cur.graduated.length})</h3>
        {cur.graduated.length === 0 ? (
          <p className="muted small">No graduated lines yet.</p>
        ) : (
          <div className="line-list">
            {cur.graduated.map((i) => (
              <LineRow key={i.id} id={i.id} name={i.line.name} chapter={course.chapterById[i.line.chapter]?.name} p={me.progress.lines[i.id]} today={today} mode="free" extra={`next check-up ${niceDay(i.reviewDue)}`} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="section-title">Up next</h3>
        <div className="line-list">
          {cur.upcoming.slice(0, 5).map((i) => (
            <LineRow key={i.id} id={i.id} name={i.line.name} chapter={course.chapterById[i.line.chapter]?.name} p={me.progress.lines[i.id]} today={today} mode="learn" />
          ))}
        </div>
        <p className="small muted">
          Lines come in course order: the systems you meet most in your games first. Want a different one? Start any line from <a href="#/lines">Lines</a>.
        </p>
      </section>
    </div>
  );
}

function LineRow({ id, name, chapter, p, today, mode, done, extra }: { id: string; name: string; chapter?: string; p: any; today: string; mode: string; done?: boolean; extra?: string }) {
  return (
    <div className="line-row card">
      <div className="grow">
        <div className="small muted">{chapter}</div>
        <b>{name}</b>
        <div className="row gap small">
          <StatusPill p={p} today={today} />
          {done && <span className="small muted">today ✓</span>}
          {extra && <span className="small muted">{extra}</span>}
        </div>
      </div>
      <div className="row gap">
        <a className="btn ghost" href={`#/lesson/${id}`} title="Step through the line with explanations">
          📖
        </a>
        <a className="btn" href={`#/line/${id}?mode=${mode}`}>
          ▶
        </a>
      </div>
    </div>
  );
}
