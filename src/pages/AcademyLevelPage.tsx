import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LESSONS, getLesson, StubLessonBody, type Lesson } from '../data/academy/lessons.js';

function findNeighbors(current: Lesson) {
  const idx = LESSONS.findIndex(l => l.slug === current.slug);
  return {
    prev: idx > 0 ? LESSONS[idx - 1] : null,
    next: idx < LESSONS.length - 1 ? LESSONS[idx + 1] : null,
  };
}

export function AcademyLevelPage() {
  const { level } = useParams<{ level: string }>();
  const lesson = level ? getLesson(level) : undefined;

  useEffect(() => {
    if (lesson) document.title = `${lesson.name} — Bilko Academy`;
    else document.title = 'Lesson not found — Bilko Academy';
  }, [lesson]);

  if (!lesson) {
    return (
      <div className="pf-page pf-lesson">
        <div className="pf-lesson-eyebrow">Bilko Academy</div>
        <h1>Lesson not found.</h1>
        <p className="pf-lede">That level number doesn't exist yet. The Academy has five.</p>
        <Link to="/academy" className="pf-btn">← Back to Academy</Link>
      </div>
    );
  }

  const { prev, next } = findNeighbors(lesson);

  return (
    <div className="pf-page pf-lesson">
      <div className="pf-lesson-eyebrow">
        <Link to="/academy" style={{ color: 'inherit' }}>Bilko Academy</Link>
        {' · '}Level 0{lesson.n}
      </div>
      <h1>{lesson.name}.</h1>
      <div className="pf-lesson-meta">
        <span><strong>{lesson.readMinutes} min read</strong></span>
        <span>Status<strong style={{ color: lesson.status === 'live' ? 'var(--pf-green)' : 'var(--pf-accent)' }}>
          {lesson.status === 'live' ? 'Live' : 'Cooking'}
        </strong></span>
        <span>Topics<strong>{lesson.tags.join(' · ')}</strong></span>
      </div>

      {lesson.status === 'live' ? lesson.render() : <StubLessonBody lesson={lesson} />}

      <nav className="pf-lesson-nav">
        {prev ? (
          <Link to={`/academy/${prev.slug}`}>
            <span className="pf-lesson-nav-label">← Previous · Level 0{prev.n}</span>
            <span className="pf-lesson-nav-title">{prev.name}</span>
          </Link>
        ) : (
          <Link to="/academy">
            <span className="pf-lesson-nav-label">↑ Index</span>
            <span className="pf-lesson-nav-title">Academy home</span>
          </Link>
        )}
        {next ? (
          <Link to={`/academy/${next.slug}`} className="next">
            <span className="pf-lesson-nav-label">Next · Level 0{next.n} →</span>
            <span className="pf-lesson-nav-title">{next.name}</span>
          </Link>
        ) : (
          <Link to="/academy" className="next">
            <span className="pf-lesson-nav-label">↑ Index</span>
            <span className="pf-lesson-nav-title">Academy home</span>
          </Link>
        )}
      </nav>
    </div>
  );
}
