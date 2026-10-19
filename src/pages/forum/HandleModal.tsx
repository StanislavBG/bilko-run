import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  checkHandle,
  forumAvatarColor,
  saveHandle,
  validateHandle,
  type ForumMember,
} from '../../lib/forumClient.js';
import { FORUM_LIMITS } from '../../../shared/forum.js';

interface Props {
  open: boolean;
  /** The viewer's current handle, or null when they have none yet. */
  currentHandle: string | null;
  /** True when a post is waiting on the handle: the save button reads 'Save & post'. */
  pending: boolean;
  /** Label for the pending action; defaults to 'Save & post'. */
  pendingLabel?: string;
  onClose: () => void;
  onSaved: (member: ForumMember) => void;
}

type Tone = 'n' | 'bad' | 'good';

export function HandleModal({ open, currentHandle, pending, pendingLabel, onClose, onSaved }: Props) {
  const { getToken } = useAuth();
  const [value, setValue] = useState('');
  const [remote, setRemote] = useState<{ value: string; ok: boolean; msg: string; tone: Tone } | null>(null);
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setValue('');
    setRemote(null);
    setServerError('');
    setSaving(false);
    inputRef.current?.focus();
  }, [open]);

  const trimmed = value.trim();
  const local = validateHandle(value, currentHandle);

  useEffect(() => {
    if (!open || !local.ok || local.reason === 'same') return;
    let live = true;
    const t = setTimeout(() => {
      checkHandle(trimmed).then(res => {
        if (live && res.ok) setRemote({ value: trimmed, ok: res.ok, msg: res.msg, tone: res.tone });
      });
    }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [open, trimmed, local.ok, local.reason]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const fromServer = local.ok && local.reason !== 'same' && remote && remote.value === trimmed ? remote : null;
  const shown = serverError ? { msg: serverError, tone: 'bad' as Tone } : fromServer ?? local;
  const valid = local.ok && (!fromServer || fromServer.tone !== 'bad');

  async function save() {
    if (!valid || saving) return;
    if (local.reason === 'same') { onClose(); return; }
    setSaving(true);
    setServerError('');
    const res = await saveHandle(getToken, trimmed);
    setSaving(false);
    if (res.ok) onSaved(res.member);
    else setServerError(res.error);
  }

  const title = currentHandle ? 'Change your handle.' : 'Pick your handle.';
  const eyebrow = currentHandle ? 'Your handle' : pending ? 'One step before you post' : 'Your handle';
  const saveLabel = pending ? pendingLabel ?? 'Save & post' : 'Save handle';
  const preview = trimmed || 'yourname';

  return (
    <div className="fm-modal-back" onClick={onClose}>
      <div className="fm-modal" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="fm-modal-body">
          <div className="fm-modal-eyebrow">{eyebrow}</div>
          <h3 className="fm-modal-title">{title}</h3>
          <p className="fm-modal-p">
            This is how you'll show up on every post and log-book line. Change it later and your old posts update with it.
          </p>
          <label className="fm-handle-field">
            <span className="fm-handle-at">@</span>
            <input
              ref={inputRef}
              value={value}
              onChange={e => { setValue(e.target.value.replace(/\s/g, '')); setServerError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') void save(); }}
              maxLength={FORUM_LIMITS.handleMax}
              placeholder="yourname"
              spellCheck={false}
              aria-label="Handle"
            />
          </label>
          <div className={'fm-handle-msg ' + shown.tone} role="status">{shown.msg}</div>
        </div>
        <div className="fm-modal-preview">
          <div className="fm-modal-eyebrow">Preview</div>
          <div className="fm-preview-row">
            <span className="fm-avatar fm-avatar-sm" style={{ background: forumAvatarColor(preview) }}>
              {preview[0].toUpperCase()}
            </span>
            <div className="fm-preview-name">
              <div className="fm-preview-handle">@{preview}</div>
              <div className="fm-preview-sub">Your member number and join date are set when you save.</div>
            </div>
          </div>
        </div>
        <div className="fm-modal-actions">
          <button type="button" className="fm-btn fm-btn-ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="fm-btn"
            style={{ opacity: valid && !saving ? 1 : 0.35 }}
            aria-disabled={!valid || saving}
            onClick={() => void save()}
          >
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
