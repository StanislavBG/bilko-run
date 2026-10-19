import { useEffect, useState } from 'react';
import { SignInButton, useAuth } from '@clerk/clerk-react';
import {
  fetchForumIndex,
  fetchLogbook,
  formatEntryNo,
  formatLogWhen,
  signLogbook,
  type ForumLogEntry,
  type ForumMember,
} from '../../lib/forumClient.js';
import { HandleModal } from './HandleModal.js';

const MSG_MAX = 140;
const FROM_MAX = 32;
const PAGE = 50;

interface Props {
  handle: string | null;
  onHandleSaved: (member: ForumMember) => void;
  flash: (msg: string) => void;
}

export function LogbookView({ handle, onHandleSaved, flash }: Props) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [entries, setEntries] = useState<ForumLogEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [msg, setMsg] = useState('');
  const [from, setFrom] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([fetchLogbook(), fetchForumIndex()]).then(([book, idx]) => {
      if (!live) return;
      if (book.ok) {
        setEntries(book.entries);
        setMore(book.entries.length >= PAGE);
      }
      if (idx.ok) setTotal(idx.logbook.count);
    });
    return () => { live = false; };
  }, []);

  const list = entries ?? [];
  const nextNo = formatEntryNo(Math.max(total, list[0]?.no ?? 0) + 1);

  async function loadOlder() {
    if (loadingMore || list.length === 0) return;
    setLoadingMore(true);
    const res = await fetchLogbook(list[list.length - 1].id);
    setLoadingMore(false);
    if (!res.ok) return;
    setEntries(cur => [...(cur ?? []), ...res.entries]);
    setMore(res.entries.length >= PAGE);
  }

  async function sign(h: string | null = handle) {
    if (busy) return;
    if (!msg.trim()) { setErr('One line, at least.'); return; }
    if (!h) { setErr(''); setModal(true); return; }
    setBusy(true);
    setErr('');
    const res = await signLogbook(getToken, { msg: msg.trim(), from: from.trim() });
    if (!res.ok) {
      setBusy(false);
      if (res.code === 'needs_handle') { setModal(true); return; }
      setErr(res.error);
      return;
    }
    const fresh = await fetchLogbook();
    setBusy(false);
    let mine: ForumLogEntry | undefined;
    if (fresh.ok) {
      mine = fresh.entries.find(e => e.id === res.id);
      setEntries(cur => {
        const known = new Set((cur ?? []).map(e => e.id));
        return [...fresh.entries.filter(e => !known.has(e.id)), ...(cur ?? [])];
      });
    }
    setTotal(t => t + 1);
    setMsg('');
    setFrom('');
    flash(`Signed. You're ${mine ? formatEntryNo(mine.no) : nextNo} in the book.`);
  }

  async function handleSaved(member: ForumMember) {
    setModal(false);
    onHandleSaved(member);
    await sign(member.handle);
  }

  const isMine = (e: ForumLogEntry) => !!handle && e.handle.toLowerCase() === handle.toLowerCase();

  return (
    <div className="fm-logbook">
      <div className="fm-log-sign">
        {!isLoaded || !isSignedIn ? (
          <div className="fm-log-out">
            <div>
              <div className="fm-signin-title">Sign in to sign the book.</div>
              <div className="fm-signin-text">Reading is open. Signing needs an account so your name stays yours.</div>
            </div>
            <SignInButton mode="modal" forceRedirectUrl={window.location.pathname}>
              <button type="button" className="fm-btn">Sign in</button>
            </SignInButton>
          </div>
        ) : (
          <>
            <div className="fm-log-form">
              <div className="fm-log-who">
                <span className="fm-log-nextno">{nextNo}</span>
                <span className="fm-log-name">{handle ? `@${handle}` : '@…'}</span>
              </div>
              <input
                className="fm-log-input fm-log-msg-in"
                value={msg}
                maxLength={MSG_MAX}
                placeholder="Leave a hello…"
                aria-label="Your line"
                onChange={e => { setMsg(e.target.value); setErr(''); }}
                onKeyDown={e => { if (e.key === 'Enter') void sign(); }}
              />
              <input
                className="fm-log-input fm-log-from-in"
                value={from}
                maxLength={FROM_MAX}
                placeholder="From (optional)"
                aria-label="From"
                onChange={e => setFrom(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void sign(); }}
              />
              <button type="button" className="fm-btn" disabled={busy} onClick={() => void sign()}>
                {handle ? 'Sign the book' : 'Pick handle & sign'}
              </button>
            </div>
            <div className="fm-log-meta">
              <span><span className="fm-err" role="alert">{err}</span>{handle ? ` Signing as @${handle}` : ''}</span>
              <span>{MSG_MAX - msg.length} left</span>
            </div>
          </>
        )}
      </div>

      <div className="fm-log-head">
        <span className="fm-lh-no">No.</span>
        <span className="fm-lh-name">Name</span>
        <span className="fm-lh-msg">Message</span>
        <span className="fm-lh-when">From · When</span>
      </div>

      {entries === null && <p className="fm-status" role="status">Loading the log-book…</p>}

      {list.map(e => {
        const mine = isMine(e);
        return (
          <div className={'fm-logbook-row' + (mine ? ' mine' : '')} key={e.id}>
            <span className="fm-log-no">{formatEntryNo(e.no)}</span>
            <span className="fm-logbook-name">
              @{e.handle}
              {mine && <span className="fm-badge fm-badge-you fm-log-you">You</span>}
            </span>
            <span className="fm-logbook-msg">{e.msg}</span>
            <span className="fm-logbook-when">{e.from || '—'} · {formatLogWhen(e.at)}</span>
          </div>
        );
      })}

      {entries !== null && list.length === 0 && (
        <div className="fm-log-blank">
          <div className="fm-log-blank-title">The book is blank.</div>
          <div className="fm-log-blank-sub">No. 0001 is still open</div>
        </div>
      )}

      <div className="fm-log-foot">
        <span>Showing newest {list.length} of {Math.max(total, list.length)}</span>
        {more && (
          <button type="button" className="fm-link-btn fm-accent" disabled={loadingMore} onClick={() => void loadOlder()}>
            Older pages ↓
          </button>
        )}
      </div>

      <HandleModal
        open={modal}
        currentHandle={handle}
        pending
        pendingLabel="Save & sign"
        onClose={() => setModal(false)}
        onSaved={m => void handleSaved(m)}
      />
    </div>
  );
}
