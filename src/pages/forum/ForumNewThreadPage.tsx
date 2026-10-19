import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { SignInButton, useAuth } from '@clerk/clerk-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import {
  FORUM_BOARDS,
  FORUM_LIMITS,
  createThread,
  fetchMe,
  type ForumMe,
  type ForumMember,
} from '../../lib/forumClient.js';
import { isForumBoardId } from '../../../shared/forum.js';
import { HandleModal } from './HandleModal.js';
import '../../styles/forum.css';

export function ForumNewThreadPage() {
  useDocumentTitle('Start a thread · Forum · Bilko');
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const preset = params.get('board');
  const [board, setBoard] = useState<string | null>(isForumBoardId(preset) ? preset : null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [me, setMe] = useState<ForumMe | null>(null);
  const [modal, setModal] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setMe(null); return; }
    let live = true;
    fetchMe(getToken).then(res => { if (live && res.ok) setMe(res); });
    return () => { live = false; };
  }, [isLoaded, isSignedIn, getToken]);

  const handle = me?.member?.handle ?? null;

  async function submit(h: string | null = handle) {
    if (busy) return;
    const t = title.trim();
    const body = text.trim();
    if (!board) { setErr('Pick a board.'); return; }
    if (t.length < FORUM_LIMITS.titleMin) { setErr('Give it a title people can scan.'); return; }
    if (!body) { setErr('Say the first thing.'); return; }
    if (body.length > FORUM_LIMITS.bodyMax) { setErr(`Keep it under ${FORUM_LIMITS.bodyMax} characters.`); return; }
    if (!h) { setErr(''); setModal(true); return; }
    setBusy(true);
    setErr('');
    const res = await createThread(getToken, { board, title: t, body });
    setBusy(false);
    if (!res.ok) {
      if (res.code === 'needs_handle') { setModal(true); return; }
      setErr(res.error);
      return;
    }
    const name = FORUM_BOARDS.find(b => b.id === board)?.name ?? board;
    navigate(`/forum/t/${res.id}`, { state: { flash: `Thread started in ${name}.` } });
    window.scrollTo(0, 0);
  }

  function onHandleSaved(member: ForumMember) {
    setModal(false);
    setMe(m => ({ signedIn: true, isHost: m?.isHost, member }));
    void submit(member.handle);
  }

  return (
    <div className="pf-page fm">
      <section className="fm-thread-head">
        <div className="fm-crumbs">
          <Link to="/forum" className="fm-accent">← Forum</Link>
          <span>/</span>
          <span>New thread</span>
        </div>
        <h1 className="fm-title">Start a thread.</h1>
        <p className="fm-lede">Pick a board, write a title people can scan, then say the first thing.</p>
      </section>

      {!isSignedIn ? (
        <div className="fm-signin">
          <div>
            <div className="fm-signin-title">Sign in to start a thread.</div>
            <div className="fm-signin-text">You'll pick a handle right before it goes up.</div>
          </div>
          <SignInButton mode="modal" forceRedirectUrl={window.location.pathname + window.location.search}>
            <button type="button" className="fm-btn">Sign in</button>
          </SignInButton>
        </div>
      ) : (
        <div className="fm-new">
          <div>
            <div className="fm-new-label">Board</div>
            <div className="fm-new-boards" role="group" aria-label="Board">
              {FORUM_BOARDS.map(b => (
                <button
                  type="button"
                  key={b.id}
                  className={'fm-filter fm-filter-lg' + (board === b.id ? ' on' : '')}
                  aria-pressed={board === b.id}
                  onClick={() => { setBoard(b.id); setErr(''); }}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="fm-new-label" htmlFor="fm-new-title">Title</label>
            <input
              id="fm-new-title"
              className="fm-new-title"
              value={title}
              maxLength={FORUM_LIMITS.titleMax}
              onChange={e => { setTitle(e.target.value); setErr(''); }}
              placeholder="e.g. Session Manager on a 13-inch laptop?"
            />
          </div>
          <div>
            <label className="fm-new-label" htmlFor="fm-new-body">First post</label>
            <textarea
              id="fm-new-body"
              className="fm-textarea"
              rows={7}
              value={text}
              maxLength={FORUM_LIMITS.bodyMax}
              onChange={e => { setText(e.target.value); setErr(''); }}
              placeholder="Set it up so the second person knows how to answer."
            />
          </div>
          <div className="fm-new-foot">
            <span className="fm-new-as">
              <span className="fm-err" role="alert">{err}</span>{' '}
              {handle ? `Posting as @${handle}` : "You'll pick a handle before it goes up."}
            </span>
            <div className="fm-new-actions">
              <Link to="/forum" className="fm-btn fm-btn-ghost">Cancel</Link>
              <button type="button" className="fm-btn" disabled={busy} onClick={() => void submit()}>
                {handle ? 'Post thread' : 'Pick handle & post'}
              </button>
            </div>
          </div>
        </div>
      )}

      <HandleModal
        open={modal}
        currentHandle={handle}
        pending
        onClose={() => setModal(false)}
        onSaved={onHandleSaved}
      />
    </div>
  );
}
