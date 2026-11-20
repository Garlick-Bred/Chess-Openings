import { useApp } from '../App';
import { localDay } from '../api';
import { useCourse } from '../course';
import { ChapterPlan, StatusPill } from '../components/ui';
import insights from '@shared/insights.json';

export default function LinesPage({ open }: { open?: string }) {
  const { me } = useApp();
  const course = useCourse();
  if (!course) return <div className="page">Loading…</div>;
  const today = localDay();
  const ins = insights as any;
  const sys = (chapterId: string) => ins.systems.filter((s: any) => s.chapter === chapterId);

  return (
    <div className="page lines">
      <section className="card">
        <div className="eyebrow">Your repertoire · Black</div>
        <h1>{course.course.name}</h1>
        <p className="muted small">{course.course.intro}</p>
        <div className="row gap wrap small">
          <a href="#/principles">🧭 The {course.principles.length} principles behind every move ▸</a>
        </div>
      </section>

      {course.chapters.map((ch) => {
        const lines = ch.lines.map((id) => course.lineById[id]);
        const grads = lines.filter((l) => me.progress.lines[l.id]?.status === 'graduated').length;
        const started = lines.filter((l) => me.progress.lines[l.id]).length;
        const isOpen = open === ch.id;
        const stats = sys(ch.id);
        return (
          <section key={ch.id} className={`card chapter ${isOpen ? 'open' : ''}`} id={`ch-${ch.id}`}>
            <a className="chapter-head" href={isOpen ? '#/lines' : `#/lines/${ch.id}`}>
              <div className="grow">
                <b>{ch.name}</b>
                <div className="small muted">{ch.white}</div>
              </div>
              <div className="right small">
                <div>
                  {grads}/{lines.length} graduated
                </div>
                <div className="muted">{ch.games} of your games</div>
              </div>
              <span className="chev">{isOpen ? '▾' : '▸'}</span>
            </a>
            <div className="bar thin">
              <div style={{ width: `${(grads / lines.length) * 100}%` }} />
              <div className="started" style={{ width: `${((started - grads) / lines.length) * 100}%` }} />
            </div>
            {isOpen && (
              <>
                <ChapterPlan chapter={ch} />
                {stats.length > 0 && (
                  <div className="small muted sys-stats">
                    {stats.map((s: any) => (
                      <div key={s.name}>
                        {s.name}: {s.games} games, you scored {Math.round(s.score * 100)}%, first mistake around move {s.medianFirstMistake ?? '–'}.
                      </div>
                    ))}
                  </div>
                )}
                <div className="line-list">
                  {lines.map((l) => (
                    <div key={l.id} className="line-row">
                      <div className="grow">
                        <b>{l.name}</b>
                        <div className="small muted line-moves">{movetext(l.sans)}</div>
                        <StatusPill p={me.progress.lines[l.id]} today={today} />
                      </div>
                      <div className="row gap">
                        <a className="btn ghost" href={`#/lesson/${l.id}`}>
                          📖 Learn
                        </a>
                        <a className="btn" href={`#/line/${l.id}?mode=${me.progress.lines[l.id]?.status === 'graduated' ? 'free' : 'learn'}`}>
                          ▶ Play
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function movetext(sans: string[], from = 0) {
  return sans
    .map((s, i) => {
      const ply = from + i;
      return ply % 2 === 0 ? `${ply / 2 + 1}.${s}` : i === 0 ? `${Math.floor(ply / 2) + 1}...${s}` : s;
    })
    .join(' ');
}
