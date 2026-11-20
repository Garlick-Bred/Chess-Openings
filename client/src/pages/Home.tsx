import { BULB_BONUS, addDays } from '@shared/scoring.js';
import { formatCloves } from '@shared/cloves.js';
import insights from '@shared/insights.json';
import { localDay, type Me } from '../api';
import { go, isDoneToday, useApp } from '../App';
import GarlickBulb from '../components/GarlickBulb';
import { useCourse, useDeck } from '../course';
import { curriculumFor, deckDueFor, myRating, nextExerciseRoute } from '../school';
import { pct } from '../components/ui';

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Late night grind' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

const shieldIcons = (n: number) => (n > 0 ? ` · ${'🛡️'.repeat(n)}` : '');

/** A broken streak that a double bulb can still repair, or a shield that just saved one. */
function StreakNotice({ me, onTrain }: { me: Me; onTrain: () => void }) {
  const t = me.totals;
  if (t.repair) {
    return (
      <section className="streak-notice repair">
        <span aria-hidden="true">💨</span>
        <span className="grow">
          Your <b>🔥 {t.repair.streak}-day streak</b> broke yesterday. Fill a <b>double bulb</b> today to repair it:{' '}
          <b>
            {formatCloves(Math.min(t.repair.cloves, me.today.cloves))}/{t.repair.cloves}
          </b>{' '}
          cloves.
        </span>
        <button className="btn primary" onClick={onTrain}>
          Repair ▸
        </button>
      </section>
    );
  }
  if (t.shieldUsedOn) {
    const when = t.shieldUsedOn === addDays(localDay(), -1) ? 'yesterday' : t.shieldUsedOn;
    return (
      <section className="streak-notice used">
        <span aria-hidden="true">🛡️</span>
        <span className="grow">
          A streak shield covered {when}, so your <b>🔥 {t.streak}-day streak</b> is safe.{' '}
          {t.shields ? `${t.shields} shield${t.shields === 1 ? '' : 's'} left.` : 'Weave a new one with cloves beyond a full bulb.'}
        </span>
      </section>
    );
  }
  return null;
}

export default function HomePage() {
  const { me } = useApp();
  const course = useCourse();
  const deck = useDeck(me.user.settings.chesscom);
  const left = Math.max(0, 5 - me.today.cloves);
  const r = me.totals.rank;
  const doneToday = isDoneToday(me.user.username);
  const cur = course ? curriculumFor(me, course) : null;
  const deckDue = deckDueFor(me, deck);
  const train = () => {
    if (!course) return;
    go(nextExerciseRoute(me, course, deck) ?? '/train');
  };
  const ins = insights as any;
  const mine = me.user.settings.chesscom?.toLowerCase() === ins.user;

  return (
    <div className="page home">
      <section className="hero card">
        <div className="hero-text">
          <div className="eyebrow">
            {greeting()}, {me.user.displayName}
          </div>
          <h1>
            {doneToday
              ? 'Done for today ✓'
              : me.today.bulbDone
                ? 'Bulb complete. Nice work!'
                : left >= 5
                  ? "Let's fill today's bulb"
                  : `${formatCloves(left)} clove${left === 1 ? '' : 's'} to go today`}
          </h1>
          {doneToday ? (
            <p className="muted">
              {me.today.bulbDone ? 'Your bulb is full' : 'You called it a day'}
              {me.totals.streak > 0 ? (
                <>
                  {' '}
                  and your <b className="flame">🔥 {me.totals.streak}-day streak</b>
                  <span className="shields">{shieldIcons(me.totals.shields)}</span> is safe
                </>
              ) : null}
              . A fresh bulb starts at midnight.
            </p>
          ) : (
            <p className="muted">
              Each line you play from memory, each check-up and each position from your games fills a clove. Fill all five for <b>+{BULB_BONUS}</b> bonus points
              {me.totals.streak > 0 ? (
                <>
                  {' '}
                  and keep your <b className="flame">🔥 {me.totals.streak}-day streak</b>
                  <span className="shields">{shieldIcons(me.totals.shields)}</span> alive
                </>
              ) : null}
              .
            </p>
          )}
          <div className="row gap wrap">
            {doneToday ? (
              <>
                <button className="btn big" onClick={() => go('/done')}>
                  Today's summary
                </button>
                <button className="btn ghost" onClick={train}>
                  Train anyway ▸
                </button>
              </>
            ) : (
              <>
                <button className="btn primary big" onClick={train} disabled={!course}>
                  🎯 Start training
                </button>
                <button className="btn big" onClick={() => go('/lines')}>
                  📖 My repertoire
                </button>
              </>
            )}
          </div>
        </div>
        <div className="hero-bulb">
          <GarlickBulb filled={me.today.cloves} size={170} />
          <div className="bulb-count">
            <b>{formatCloves(Math.min(5, me.today.cloves))}</b>/5 cloves
          </div>
        </div>
      </section>

      <StreakNotice me={me} onTrain={train} />

      {cur && (
        <section className="card today-plan">
          <div className="row between wrap">
            <h3>Today in Opening School</h3>
            <a href="#/train" className="small">
              See everything ▸
            </a>
          </div>
          <ul className="plan-list">
            <li>
              <span className="plan-ico">🩺</span>
              <span className="grow">
                <b>{cur.due.length ? plural(cur.due.length, 'check-up') : 'No check-ups'}</b> due
                {cur.due.length ? ': graduated lines, timed like blitz' : ''}
              </span>
            </li>
            <li>
              <span className="plan-ico">🎓</span>
              <span className="grow">
                <b>{plural(cur.todo.length, 'line')}</b> to play from memory today
                {cur.todo.length ? `: ${cur.todo.map((i) => i.line.name.split(':')[0]).slice(0, 3).join(' · ')}` : ' (done ✓)'}
              </span>
            </li>
            {deck && (
              <li>
                <span className="plan-ico">🎯</span>
                <span className="grow">
                  <b>{Math.min(deckDue.length, Math.max(0, 6 - me.today.deck))}</b> positions from your own games (your mistakes, and your opponents’ to punish)
                </span>
              </li>
            )}
          </ul>
          {!deck && (
            <p className="small muted">
              Add your chess.com username in <a href="#/settings">Settings</a> to see where your games leave the repertoire.
            </p>
          )}
        </section>
      )}

      <section className="rank card">
        <div className="row between">
          <div>
            <div className="eyebrow">Rank</div>
            <div className="rank-name">{r.name}</div>
          </div>
          <div className="right">
            <div className="rank-points">{me.totals.points.toLocaleString()} pts</div>
            {r.next && (
              <div className="small muted">
                {r.toNext.toLocaleString()} to {r.next}
              </div>
            )}
          </div>
        </div>
        <div className="bar">
          <div style={{ width: `${Math.round(r.progress * 100)}%` }} />
        </div>
        <div className="row gap small muted wrap">
          <span>
            {me.totals.graduated}/{me.totals.lineCount} lines graduated
          </span>
          <span>{plural(me.totals.cleanRuns, 'clean run')}</span>
          <span>{me.totals.punished} punished</span>
          <span>opening rating {myRating(me)}</span>
        </div>
      </section>

      {mine && (
        <section className="card insight">
          <div className="eyebrow">From your chess.com games · {ins.games} King’s Indian games analysed with Stockfish</div>
          <b className="insight-headline">Your first mistake usually comes around move {ins.firstMistakeMedian}, when the opening turns into a middlegame.</b>
          <ul>
            <li>
              The opening itself is fine: your opponents leave theory first in {pct(ins.opponentLeftFirst)} of games, and the position after move 10 is level on
              average.
            </li>
            <li>
              {pct(ins.mistakeBy10)} of games had a mistake by move 10 and {pct(ins.mistakeBy20)} by move 20. That’s why every line ends with the plan, not just moves.
            </li>
            <li>The most common causes: missed captures, slow moves when a pawn break was ready, and loosening your king with ...h6 or ...Kh7.</li>
          </ul>
          <a href="#/games" className="small">
            Your games, system by system ▸
          </a>
        </section>
      )}
    </div>
  );
}
