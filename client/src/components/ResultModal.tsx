import { useEffect, useRef, useState } from 'react';
import type { AttemptResult } from '../api';
import { sfx } from '../sound';
import GarlickBulb from './GarlickBulb';
import GoldenClove from './GoldenClove';
import { AchIcon, niceDay } from './ui';
import { formatCloves } from '@shared/cloves.js';


/** Garlic braid progress once the bulb is full, a new shield, or a repaired streak. */
function BraidNote({ result, bulbFull }: { result: AttemptResult; bulbFull: boolean }) {
  const b = result.braid;
  if (result.repaired) {
    return (
      <div className="school-note pass">
        💨 <b>Streak repaired!</b> Your double bulb saved it: 🔥 {result.repaired.streak} days and counting.
      </div>
    );
  }
  if (b?.earned) {
    return (
      <div className="school-note grad shield-note">
        🛡️ <b>Streak shield woven!</b> You hold {b.shields} of {b.max}. It's used automatically if you miss a day.
      </div>
    );
  }
  if (!bulbFull || !b || result.cloveGain <= 0 || result.day.bulbCompletedNow) return null;
  return (
    <div className="braid-note">
      <span className="braid-bar" aria-hidden="true">
        <i style={{ width: `${Math.min(100, (b.braid / b.size) * 100)}%` }} />
      </span>
      {b.shields >= b.max
        ? `🛡️ ${b.shields}/${b.max} shields held: your braid is full.`
        : `Braid ${formatCloves(b.braid)}/${b.size} toward a streak shield${b.shields ? ` · 🛡️ ${b.shields} held` : ''}`}
    </div>
  );
}

/** Opening rating change and Opening School progress for this exercise. */
function RatingAndSchool({ result, lineName }: { result: AttemptResult; lineName: string | null }) {
  const r = result.rating;
  const sc = result.school;
  const ev = sc?.events ?? {};
  const name = lineName ?? 'This line';
  let school: JSX.Element | null = null;
  if (ev.graduated) {
    school = (
      <div className="school-note grad">
        🎓 <b>Graduated!</b> {name} leaves your daily rotation and a new line moves in. First check-up on {niceDay(sc!.reviewDue)} (timed, like a blitz game).
      </div>
    );
  } else if (ev.reviewPassed) {
    school = (
      <div className="school-note pass">
        🩺 <b>Check-up passed.</b> Next one on {niceDay(sc!.reviewDue)}.
      </div>
    );
  } else if (ev.reviewSlow) {
    school = <div className="school-note">⏱️ Right moves, but slower than blitz speed: the same check-up comes back on {niceDay(sc!.reviewDue)}.</div>;
  } else if (ev.demoted) {
    school = <div className="school-note warn">↩ {name} is back in your daily rotation for a refresher.</div>;
  } else if (ev.reset) {
    school = <div className="school-note warn">↩ A miss on today’s test: the count of days from memory starts again. It comes back tomorrow.</div>;
  } else if (sc && sc.status === 'learning') {
    school = (
      <div className="school-note">
        <span className="streak-dots" aria-label={`${sc.cleanDays} of ${sc.needed} days from memory`}>
          {Array.from({ length: sc.needed }, (_, i) => (
            <i key={i} className={i < sc.cleanDays ? 'on' : ''} />
          ))}
        </span>{' '}
        {ev.learnedDay
          ? `Day ${sc.cleanDays} of ${sc.needed} from memory. See you tomorrow for the next one.`
          : ev.tested
            ? `Today’s test had a miss. Play it again for practice; tomorrow counts again (${sc.cleanDays}/${sc.needed}).`
            : `Practice run: today’s test is done or still to come (${sc.cleanDays}/${sc.needed} days from memory).`}
      </div>
    );
  } else if (sc && sc.status === 'graduated') {
    school = <div className="school-note">🎓 Graduated line. Next check-up: {niceDay(sc.reviewDue)}.</div>;
  }
  if (result.deck?.events?.mastered) school = <div className="school-note grad">🏁 Mastered: this position won’t come back.</div>;
  else if (result.deck?.due) school = <div className="school-note">🔁 This position comes back on {niceDay(result.deck.due)}.</div>;
  return (
    <>
      {r && (
        <div className={`rating-line ${r.delta > 0 ? 'up' : r.delta < 0 ? 'down' : ''}`}>
          {r.rated ? (
            <>
              Opening rating <b>{r.after}</b> <span className="rating-delta">{r.delta > 0 ? `+${r.delta}` : r.delta === 0 ? '±0' : r.delta}</span>
              <small className="muted"> · exercise rated {r.puzzle}</small>
            </>
          ) : (
            <span className="muted">Replays right after a lesson don’t change your opening rating.</span>
          )}
        </div>
      )}
      {school}
    </>
  );
}

/** ⭐⭐⭐: 1 finished, 2 clean, 3 clean and fast. */
function Stars({ n }: { n: number }) {
  return (
    <div className="result-stars" aria-label={`${n} of 3 stars`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={i <= n ? 'on' : ''} style={{ animationDelay: `${0.25 + i * 0.18}s` }}>
          ★
        </span>
      ))}
    </div>
  );
}

/** Progress along the Garlick Path, with stage-up and new-world moments. */
function PathProgress({ result }: { result: AttemptResult }) {
  const { before, after, stagesUp, newWorld } = result.path;
  const [pct, setPct] = useState(stagesUp ? 0 : before.progress);
  useEffect(() => {
    const t = setTimeout(() => setPct(after.progress), 400);
    return () => clearTimeout(t);
  }, [after.progress]);
  return (
    <div className="path-progress" style={{ ['--accent' as any]: after.info.accent }}>
      {newWorld ? (
        <div className="world-up" style={{ background: `linear-gradient(135deg, ${newWorld.bg[0]}, ${newWorld.bg[1]})` }}>
          <span className="world-up-icon">{newWorld.icon}</span>
          <div>
            <b>New world: {newWorld.name}!</b>
            <small>{newWorld.blurb}</small>
          </div>
        </div>
      ) : stagesUp > 0 ? (
        <div className="stage-up">⬆ Stage {after.label}!</div>
      ) : null}
      <div className="row between small">
        <span>
          <span aria-hidden="true">{after.info.icon}</span> Stage <b>{after.label}</b>
        </span>
        <span className="muted">
          {after.toNext} to {after.nextLabel}
        </span>
      </div>
      <div className="bar">
        <div style={{ width: `${Math.round(pct * 100)}%`, background: after.info.accent }} />
      </div>
    </div>
  );
}

function CountUp({ to, ms = 900 }: { to: number; ms?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setV(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return <>{v}</>;
}

interface Props {
  title: string;
  outcome: { success: boolean; reason: string };
  result: AttemptResult | null;
  submitError: string | null;
  prevCloves: number;
  lineName: string | null;
  surprise: { grade: string; found: boolean; san: string } | null;
  /** The plan question at the end of a line, answered. */
  plan?: { right: boolean; answer: string; why: string } | null;
  nextLabel: string;
  retryLabel?: string;
  onNext: () => void;
  onRetry: () => void;
  onLesson: (() => void) | null;
  onReview: () => void;
  onBack: () => void;
  onDone: () => void;
}

export default function ResultModal({ title, outcome, result, submitError, prevCloves, lineName, surprise, plan = null, nextLabel, retryLabel = 'Try again', onNext, onRetry, onLesson, onReview, onBack, onDone }: Props) {
  const ok = outcome.success;
  // The exercise that fills the 5th clove asks whether to keep going or stop for the day.
  const askDone = !!result?.day.bulbCompletedNow;
  const choiceRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!askDone) return;
    const t = setTimeout(() => choiceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 1600);
    return () => clearTimeout(t);
  }, [askDone]);
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => {
      if (result.golden) sfx.golden();
      if (result.braid?.earned || result.repaired) setTimeout(() => sfx.shield(), result.golden ? 500 : 0);
    }, 1300);
    return () => clearTimeout(t);
  }, [result]);
  const cloves = result?.day.cloves ?? prevCloves;
  const bulbFull = cloves >= 5 - 1e-9;
  const gotClove = ok && result && cloves > prevCloves && prevCloves < 5;

  return (
    <div className="modal-backdrop" onClick={onReview}>
      <div className={`modal result ${ok ? 'win' : 'loss'}`} onClick={(e) => e.stopPropagation()}>
        <div className="result-head">
          <div className="result-title">{title}</div>
          {result && <Stars n={result.stars} />}
          <div className="muted">{outcome.reason}</div>
          {plan && (
            <div className={`plan-result ${plan.right ? 'right' : 'wrong'}`}>
              <b>{plan.right ? '🧭 Right plan.' : `🧭 The plan: ${plan.answer}`}</b>
              <span className="small">{plan.why}</span>
            </div>
          )}
          {surprise && (
            <div className={`school-note ${surprise.found ? 'pass' : 'warn'}`}>
              {surprise.found ? '⚡ White went off script and you punished it.' : '⚡ White went off script with a mistake. Spotting those is a habit: check captures and threats after every unexpected move.'}
            </div>
          )}
        </div>

        {ok && (
          <div className="result-bulb">
            {result ? (
              <GarlickBulb
                key="final"
                filled={Math.min(5, cloves)}
                from={gotClove ? Math.min(5, prevCloves) : undefined}
                size={128}
                onClove={(n, completed) => (n >= 5 - 1e-9 ? sfx.bulb() : completed ? sfx.clove() : sfx.cloveSmall())}
              />
            ) : (
              <GarlickBulb key="pending" filled={Math.min(5, prevCloves)} size={128} celebrate={false} />
            )}
            <div className="bulb-caption">
              {result?.day.bulbCompletedNow ? (
                <span className="bulb-complete-text">Bulb complete! +{result.day.bulbBonus}</span>
              ) : bulbFull ? (
                <span>
                  {result && result.cloveGain > 0 && <b className="clove-gain">+{formatCloves(result.cloveGain)} clove · </b>}
                  Bulb full: extra cloves weave your braid
                </span>
              ) : (
                <span>
                  {result && result.cloveGain > 0 && <b className="clove-gain">+{formatCloves(result.cloveGain)} clove · </b>}
                  {formatCloves(Math.min(5, cloves))} of 5 today
                </span>
              )}
            </div>
            {result?.cloveNote && <div className="small muted clove-note">{formatCloves(result.cloveGain)} clove: {result.cloveNote}</div>}
            {result && <BraidNote result={result} bulbFull={bulbFull} />}
          </div>
        )}

        {result?.golden && (
          <div className="golden-banner" role="status">
            <GoldenClove size={40} />
            <div>
              <b>Golden clove!</b>
              <small>
                +{result.golden.points} bonus points · {result.golden.total} found so far
              </small>
            </div>
          </div>
        )}

        {result && (
          <div className="result-points">
            <div className="points-big">
              +<CountUp to={result.points + (result.day.bulbBonus ?? 0)} />
              <small> pts</small>
            </div>
            <ul className="breakdown">
              {result.breakdown.map((b, i) => (
                <li key={i} style={{ animationDelay: `${0.15 + i * 0.08}s` }}>
                  <span>{b.label}</span>
                  <b className={b.points < 0 ? 'neg' : ''}>{b.points > 0 ? `+${b.points}` : b.points}</b>
                </li>
              ))}
              {result.day.bulbCompletedNow && (
                <li className="bulb-line" style={{ animationDelay: `${0.15 + result.breakdown.length * 0.08}s` }}>
                  <span className="row gap">
                    <GarlickBulb filled={5} size={16} celebrate={false} /> Full bulb bonus
                    {result.day.streakBefore > 0 ? ` (🔥 ${result.day.streakBefore}-day streak)` : ''}
                  </span>
                  <b>+{result.day.bulbBonus}</b>
                </li>
              )}
            </ul>
          </div>
        )}
        {result && result.points + (result.day.bulbBonus ?? 0) > 0 && <PathProgress result={result} />}
        {result && result.combo >= 2 && <div className="combo-note">🎳 Combo ×{result.combo}: clean runs in a row today</div>}
        {!result && !submitError && <div className="muted small center">Saving…</div>}
        {submitError && <div className="form-error">{submitError}</div>}

        {result && <RatingAndSchool result={result} lineName={lineName} />}

        {result && result.newAchievements.length > 0 && (
          <div className="new-achievements">
            {result.newAchievements.map((a, i) => (
              <div key={a.id} className="achievement-pop" style={{ animationDelay: `${0.6 + i * 0.25}s` }}>
                <span className="ach-icon">
                  <AchIcon icon={a.icon} size={34} />
                </span>
                <div>
                  <b>{a.name}</b>
                  <small>{a.desc}</small>
                </div>
              </div>
            ))}
          </div>
        )}

        {result?.lessonReplay && result.lessonCloveCapped && (
          <div className="small muted center">Replays after a lesson already earned 2 cloves today, so this one earns points only.</div>
        )}

        <div className="result-actions">
          {!ok && onLesson && (
            <button className="btn lesson-btn big" onClick={onLesson}>
              📖 Watch the lesson <small>every move explained, then play it for a clove</small>
            </button>
          )}
          {askDone ? (
            <div className="day-choice" ref={choiceRef}>
              <b>Today's bulb is full. Keep going, or call it a day?</b>
              <div className="day-choice-btns">
                <button className="btn primary big" onClick={onNext}>
                  Keep going ▸
                </button>
                <button className="btn gold big" onClick={onDone}>
                  ✓ Done for today
                </button>
              </div>
              <small className="muted">Extra cloves weave your garlic braid: 5 make a streak shield.</small>
            </div>
          ) : (
            <button className="btn primary big result-next" onClick={onNext} autoFocus>
              {nextLabel}
            </button>
          )}
          <div className="row gap center wrap">
            <button className="btn" onClick={onRetry}>
              {retryLabel}
            </button>
            <button className="btn ghost" onClick={onReview}>
              Review board
            </button>
            <button className="btn ghost" onClick={onBack}>
              Training
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
