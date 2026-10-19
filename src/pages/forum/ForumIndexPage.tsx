import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/portfolio/PageHeader.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import {
  FORUM_BOARDS,
  fetchForumIndex,
  formatEntryNo,
  formatForumWhen,
  type ForumIndex,
} from '../../lib/forumClient.js';
import '../../styles/forum.css';

const boardName = (id: string) => FORUM_BOARDS.find(b => b.id === id)?.name ?? id;
const FILTERS = [{ id: 'all', name: 'All' }, ...FORUM_BOARDS];

function onlineLine(o: ForumIndex['online']): string {
  const names = o.handles.map(h => '@' + h).join(', ');
  if (!names) return o.lurkers > 0 ? `${o.lurkers} lurker${o.lurkers === 1 ? '' : 's'}` : 'nobody yet';
  if (o.lurkers <= 0) return names;
  return `${names} and ${o.lurkers} lurker${o.lurkers === 1 ? '' : 's'}`;
}

export function ForumIndexPage() {
  useDocumentTitle('Forum · Bilko');
  const [board, setBoard] = useState('all');
  const [data, setData] = useState<ForumIndex | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setError(null);
    fetchForumIndex(board === 'all' ? undefined : board).then(res => {
      if (!live) return;
      if (res.ok) setData(res);
      else setError(res.error);
    });
    return () => { live = false; };
  }, [board]);

  const log = data?.logbook;
  const brought = data?.brought;
  const broughtTotal = brought ? brought.tally.reduce((a, c) => a + c.count, 0) : 0;

  return (
    <div className="pf-page fm">
      <PageHeader
        eyebrow="Section 09 · Forum"
        title="Forum."
        lede="Like the old internet. Threads, hellos, and people who stick around."
        what="Anyone can read. To post, sign in and pick a handle once — it stays on every post you write."
      />

      {!data && (
        <p className="fm-status" role="status">
          {error ? 'The forum is unreachable right now. Try again in a moment.' : 'Loading the forum…'}
        </p>
      )}

      {data && log && brought && (
        <>
          <div className="fm-pinned">
            <Link to="/forum/t/log" className="fm-card fm-card-log">
              <div className="fm-card-top">
                <div className="fm-meta">
                  <span><span className="fm-accent">Pinned</span> · The log-book</span>
                  <span>{log.count} signatures</span>
                </div>
                <h2 className="fm-big">I WAS HERE!</h2>
                <p className="fm-card-p">One line, no reply needed. Sign it once or every visit.</p>
              </div>
              <div className="fm-log">
                {log.preview.length === 0 ? (
                  <div className="fm-log-row fm-log-empty">
                    <span className="fm-log-no fm-accent">{formatEntryNo(1)}</span>
                    <span className="fm-log-blank">The page is blank. Be the first name in it.</span>
                  </div>
                ) : (
                  log.preview.slice(0, 3).map(e => (
                    <div className="fm-log-row" key={e.id}>
                      <span className="fm-log-no">{formatEntryNo(e.no)}</span>
                      <span className="fm-log-handle">@{e.handle}</span>
                      <span className="fm-log-msg">{e.msg}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="fm-card-foot">
                <span className="fm-dim">{log.lastAt ? `Last signed ${formatForumWhen(log.lastAt)}` : 'Nobody yet'}</span>
                <span className="fm-accent">Sign the book →</span>
              </div>
            </Link>

            <Link to="/forum/t/brought" className="fm-card fm-card-brought">
              <div className="fm-card-top fm-grow">
                <div className="fm-meta">
                  <span><span className="fm-accent">Pinned</span> · Roll call</span>
                  <span>{brought.replies} replies</span>
                </div>
                <h2 className="fm-big">What brought you <em>here?</em></h2>
                <p className="fm-card-p fm-card-p-gap">A link, a friend, a wrong turn. Tag where you came from and say a bit more.</p>
                <div className="fm-tally">
                  {brought.tally.map(c => (
                    <span className="fm-chip-tally" key={c.label}>{c.label}<span className="fm-accent">{c.count}</span></span>
                  ))}
                </div>
              </div>
              <div className="fm-card-foot fm-card-foot-ruled">
                <span className="fm-dim">
                  {brought.lastAt ? `Last reply ${formatForumWhen(brought.lastAt)}` : broughtTotal ? 'Last reply recently' : 'Waiting on the first reply'}
                </span>
                <span className="fm-accent">Tell us →</span>
              </div>
            </Link>
          </div>

          <div className="fm-threads-head">
            <div className="fm-threads-title">
              <h3>Threads</h3>
              <Link to="/forum/new" className="fm-start">+ Start a thread</Link>
            </div>
            <div className="fm-filters" role="group" aria-label="Filter by board">
              {FILTERS.map(f => (
                <button
                  type="button"
                  key={f.id}
                  className={'fm-filter' + (board === f.id ? ' on' : '')}
                  aria-pressed={board === f.id}
                  onClick={() => setBoard(f.id)}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="fm-status" role="status">Couldn’t refresh this board. Showing the last list.</p>}

          <div className="fm-table">
            <div className="fm-th">
              <span className="fm-c-topic">Topic</span>
              <span className="fm-c-num">Replies</span>
              <span className="fm-c-num">Views</span>
              <span className="fm-c-last">Last post</span>
            </div>
            {data.threads.map(t => (
              <Link to={`/forum/t/${t.id}`} className="fm-row" key={t.id}>
                <div className="fm-row-topic">
                  <span
                    className={'fm-dot' + (t.isNew ? ' new' : '')}
                    title={t.isNew ? 'New posts' : 'No new posts'}
                  />
                  <div className="fm-row-main">
                    <div className="fm-row-title">{t.title}</div>
                    <div className="fm-row-sub">
                      {t.isStarter && <span className="fm-starter">Starter</span>}
                      in <span className="fm-row-board">{boardName(t.board)}</span> · started by @{t.starterHandle}
                    </div>
                  </div>
                </div>
                <span className="fm-c-num fm-mono">{t.replies}</span>
                <span className="fm-c-num fm-mono fm-dim">{t.views}</span>
                <span className="fm-c-last fm-last">
                  <span className="fm-last-by">@{t.lastByHandle}</span>
                  <br />
                  {formatForumWhen(t.lastAt)}
                </span>
              </Link>
            ))}
            {data.threads.length === 0 && (
              <div className="fm-empty">
                <span>Nothing on this board yet.</span>
                <Link to="/forum/new" className="fm-empty-link">Start the first thread →</Link>
              </div>
            )}
          </div>

          <div className="fm-foot">
            <span><span className="fm-online-dot">●</span> Online now — {onlineLine(data.online)}</span>
            {data.newestMember && <span>Newest member: @{data.newestMember}</span>}
          </div>
        </>
      )}
    </div>
  );
}
