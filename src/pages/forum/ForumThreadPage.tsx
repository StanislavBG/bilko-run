import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SignInButton, useAuth } from '@clerk/clerk-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import {
  FORUM_BOARDS,
  FORUM_CAME_VIA,
  FORUM_LIMITS,
  addPost,
  fetchMe,
  fetchThread,
  forumAvatarColor,
  formatForumWhen,
  moderate,
  type ForumMe,
  type ForumMember,
  type ForumPost,
  type ForumThread,
} from '../../lib/forumClient.js';
import { HandleModal } from './HandleModal.js';
import { LogbookView } from './LogbookView.js';
import '../../styles/forum.css';

const boardName = (id: string) => FORUM_BOARDS.find(b => b.id === id)?.name ?? id;
const HOST_HANDLE = 'bilko';
const joinedLabel = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

function SignInPrompt({ title, text }: { title: string; text: string }) {
  return (
    <div className="fm-signin">
      <div>
        <div className="fm-signin-title">{title}</div>
        <div className="fm-signin-text">{text}</div>
      </div>
      <SignInButton mode="modal" forceRedirectUrl={window.location.pathname}>
        <button type="button" className="fm-btn">Sign in</button>
      </SignInButton>
    </div>
  );
}

export function ForumThreadPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [thread, setThread] = useState<ForumThread | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading');
  const [me, setMe] = useState<ForumMe | null>(null);
  const [text, setText] = useState('');
  const [came, setCame] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<{ pending: boolean } | null>(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const [loadingEarlier, setLoadingEarlier] = useState(false);

  const isLog = id === 'log';
  useDocumentTitle(thread ? `${thread.title} · Forum · Bilko` : 'Forum · Bilko');

  const flash = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  useEffect(() => {
    if (isLog) { setState('ok'); return; }
    let live = true;
    setState('loading');
    setThread(null);
    fetchThread(id).then(res => {
      if (!live) return;
      if (res.ok) { setThread(res); setState('ok'); }
      else setState(res.status === 404 ? 'missing' : 'error');
    });
    return () => { live = false; };
  }, [id, isLog]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setMe(null); return; }
    let live = true;
    fetchMe(getToken).then(res => { if (live && res.ok) setMe(res); });
    return () => { live = false; };
  }, [isLoaded, isSignedIn, getToken]);

  const handle = me?.member?.handle ?? null;
  const isHost = !!me?.isHost;

  async function loadEarlier() {
    if (!thread || thread.posts.length === 0 || loadingEarlier) return;
    setLoadingEarlier(true);
    const res = await fetchThread(id, thread.posts[0].at);
    setLoadingEarlier(false);
    if (res.ok) setThread(t => (t ? { ...t, posts: [...res.posts, ...t.posts], earlier: res.earlier } : t));
  }

  function quote(p: ForumPost) {
    if (!isSignedIn) return;
    const snippet = p.body.length > 120 ? p.body.slice(0, 120) + '…' : p.body;
    setText(t => `> @${p.author.handle}: ${snippet}\n\n` + t);
  }

  async function submit(h: string | null = handle) {
    if (!thread) return;
    const body = text.trim();
    if (!body) { setErr('Write something first.'); return; }
    if (body.length > FORUM_LIMITS.bodyMax) { setErr(`Keep it under ${FORUM_LIMITS.bodyMax} characters.`); return; }
    if (thread.kind === 'brought' && !came) { setErr('Pick where you came from.'); return; }
    if (!h) { setErr(''); setModal({ pending: true }); return; }
    setBusy(true);
    setErr('');
    const res = await addPost(getToken, thread.id, { body, came: thread.kind === 'brought' ? came : null });
    if (!res.ok) {
      setBusy(false);
      if (res.code === 'needs_handle') { setModal({ pending: true }); return; }
      setErr(res.error);
      return;
    }
    const fresh = await fetchThread(thread.id);
    setBusy(false);
    if (fresh.ok) {
      setThread(t => {
        if (!t) return fresh;
        const known = new Set(t.posts.map(p => p.id));
        const added = fresh.posts.filter(p => !known.has(p.id));
        return { ...fresh, posts: [...t.posts, ...added], earlier: t.earlier };
      });
    }
    setText('');
    setCame(null);
    flash(`Posted as @${h}.`);
  }

  async function onHandleSaved(member: ForumMember) {
    const pending = modal?.pending;
    setModal(null);
    setMe(m => ({ signedIn: true, isHost: m?.isHost, member }));
    if (pending) await submit(member.handle);
    else flash(`You're @${member.handle}.`);
  }

  async function hide(p: ForumPost) {
    const res = await moderate(getToken, { kind: 'post', id: p.id, hidden: true });
    if (res.ok) setThread(t => (t ? { ...t, posts: t.posts.filter(x => x.id !== p.id) } : t));
    else flash(res.error);
  }

  if (state !== 'ok' || (!thread && !isLog)) {
    return (
      <div className="pf-page fm">
        {state === 'missing' ? (
          <section className="fm-notfound">
            <h1 className="fm-title">Thread not found</h1>
            <p className="fm-lede">That thread doesn't exist, or it was taken down.</p>
            <Link to="/forum" className="fm-accent fm-crumb-link">← Back to the forum</Link>
          </section>
        ) : (
          <p className="fm-status" role="status">
            {state === 'error' ? 'The forum is unreachable right now. Try again in a moment.' : 'Loading the thread…'}
          </p>
        )}
      </div>
    );
  }

  const title = isLog ? 'I WAS HERE!' : thread!.title;
  const pinned = isLog || !!thread?.pinned;
  const board = isLog ? 'The log-book' : boardName(thread!.board);
  const lede = isLog
    ? 'One line, no reply needed. Sign it once or every visit.'
    : thread!.lede || `Started by @${thread!.starterHandle} in ${board}.`;
  const brought = thread?.kind === 'brought';

  return (
    <div className="pf-page fm">
      <section className="fm-thread-head">
        <div className="fm-crumbs">
          <Link to="/forum" className="fm-accent">← Forum</Link>
          <span>/</span>
          <span>{board}</span>
          {pinned && (<><span>·</span><span className="fm-accent">Pinned</span></>)}
        </div>
        <h1 className="fm-title">{title}</h1>
        <p className="fm-lede">{lede}</p>
      </section>

      {isLog && (
        <LogbookView
          handle={handle}
          flash={flash}
          onHandleSaved={member => setMe(m => ({ signedIn: true, isHost: m?.isHost, member }))}
        />
      )}

      {thread && !isLog && (
        <>
          {thread.earlier > 0 && (
            <button type="button" className="fm-earlier" onClick={() => void loadEarlier()} disabled={loadingEarlier}>
              ↑ {thread.earlier} earlier repl{thread.earlier === 1 ? 'y' : 'ies'}
            </button>
          )}
          <div className="fm-posts">
            {thread.posts.map((p, i) => {
              const mine = !!handle && p.author.handle.toLowerCase() === handle.toLowerCase();
              return (
                <article className={'fm-post' + (mine ? ' mine' : '')} key={p.id}>
                  <aside className="fm-post-side">
                    <span className="fm-avatar" style={{ background: forumAvatarColor(p.author.handle) }}>
                      {p.author.handle[0].toUpperCase()}
                    </span>
                    <span className="fm-post-handle">@{p.author.handle}</span>
                    {p.author.handle.toLowerCase() === HOST_HANDLE && <span className="fm-badge">Host</span>}
                    {mine && <span className="fm-badge fm-badge-you">You</span>}
                    <span className="fm-post-stats">
                      Member #{p.author.no}<br />
                      Joined {joinedLabel(p.author.joinedAt)}<br />
                      {p.author.posts} post{p.author.posts === 1 ? '' : 's'}
                    </span>
                  </aside>
                  <div className="fm-post-main">
                    <div className="fm-post-meta">
                      <span className="fm-post-when">
                        <span>{formatForumWhen(p.at)}</span>
                        {p.came && <span className="fm-came">Came via {p.came}</span>}
                      </span>
                      <span>#{thread.earlier + i + 1}</span>
                    </div>
                    <div className="fm-post-body">{p.body}</div>
                    <div className="fm-post-actions">
                      {isSignedIn ? (
                        <button type="button" className="fm-link-btn" onClick={() => quote(p)}>❝ Quote</button>
                      ) : (
                        <SignInButton mode="modal" forceRedirectUrl={window.location.pathname}>
                          <button type="button" className="fm-link-btn">❝ Quote</button>
                        </SignInButton>
                      )}
                      {isHost && (
                        <button type="button" className="fm-link-btn" onClick={() => void hide(p)}>Hide</button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="fm-compose">
            {!isSignedIn ? (
              <SignInPrompt
                title="Sign in to reply."
                text="Reading is open to everyone. Posting needs an account and a handle."
              />
            ) : (
              <>
                <div className="fm-compose-head">
                  <h3>{brought ? 'Your turn.' : 'Reply'}</h3>
                  <span className="fm-compose-as">
                    {handle ? `Posting as @${handle}` : "You'll pick a handle before your first post."}
                  </span>
                </div>
                {brought && (
                  <div className="fm-came-row">
                    <span className="fm-came-label">I came via</span>
                    {FORUM_CAME_VIA.map(c => (
                      <button
                        type="button"
                        key={c}
                        className={'fm-filter' + (came === c ? ' on' : '')}
                        aria-pressed={came === c}
                        onClick={() => { setCame(came === c ? null : c); setErr(''); }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
                <textarea
                  className="fm-textarea"
                  rows={5}
                  value={text}
                  maxLength={FORUM_LIMITS.bodyMax}
                  onChange={e => { setText(e.target.value); setErr(''); }}
                  placeholder={brought ? 'How did you find the place?' : 'Say something useful, or at least kind.'}
                  aria-label="Your reply"
                />
                <div className="fm-compose-foot">
                  <span className="fm-err" role="alert">{err}</span>
                  <button type="button" className="fm-btn" disabled={busy} onClick={() => void submit()}>
                    {handle ? 'Post reply' : 'Pick handle & post'}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <HandleModal
        open={!!modal}
        currentHandle={handle}
        pending={!!modal?.pending}
        onClose={() => setModal(null)}
        onSaved={m => void onHandleSaved(m)}
      />
      {toast && <div className="fm-toast" role="status">{toast}</div>}
    </div>
  );
}
