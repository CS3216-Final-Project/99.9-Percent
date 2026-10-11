import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { FEEDBACK_MAX_LENGTH, type FeedbackRequest } from '../../../shared/feedback.ts';
import { useGame } from '@/game/store';
import { sendFeedback } from '@/lib/feedback';
import { Modal } from './ui';
import './FeedbackButton.css';

export function FeedbackButton({ inline = false }: { inline?: boolean }) {
  const mode = useGame(s => s.mode);
  const label = useId();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [sent, setSent] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const draft = useRef<FeedbackRequest | null>(null);

  useEffect(() => () => { controller.current?.abort(); }, []);

  const close = () => {
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    setOpen(false);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = message.trim();
    if (controller.current || !text || text.length > FEEDBACK_MAX_LENGTH) return;
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setError(false);
    try {
      if (!draft.current || draft.current.message !== text || draft.current.mode !== mode) {
        draft.current = { id: crypto.randomUUID(), message: text, mode };
      }
      await sendFeedback(draft.current, request.signal);
      if (request.signal.aborted) return;
      setSent(true);
      setMessage('');
      draft.current = null;
    } catch {
      if (!request.signal.aborted) setError(true);
    } finally {
      if (controller.current === request) {
        controller.current = null;
        if (!request.signal.aborted) setBusy(false);
      }
    }
  };

  const content = sent ? <div className="feedback-form">
    <p role="status">Thanks! Your feedback has been saved.</p>
    <div className="btn-row"><button type="button" className="btn btn-primary" onClick={close}>Done</button></div>
  </div> : <form className="feedback-form" onSubmit={submit} aria-busy={busy}>
    <p>What worked, what was confusing, or what would you change?</p>
    <label className="field" htmlFor={label}>Your feedback</label>
    <textarea id={label} rows={6} autoFocus={inline} required maxLength={FEEDBACK_MAX_LENGTH} disabled={busy}
      aria-describedby={label + '-hint'} value={message} onChange={e => setMessage(e.target.value)} />
    <p id={label + '-hint'} className="muted">Up to 2,000 characters. No sign-in needed. Please leave out personal details.</p>
    {error && <p role="alert">Could not send feedback. Your text is still here; please try again.</p>}
    <div className="btn-row">
      <button type="submit" className="btn btn-primary" disabled={busy || !message.trim()}>{busy ? 'Sending…' : 'Send feedback'}</button>
      <button type="button" className="btn" onClick={close}>Cancel</button>
    </div>
  </form>;

  return <>
    {(!inline || !open) && <button type="button" className="btn" onClick={() => {
      setSent(false);
      setError(false);
      setOpen(true);
    }}>Give feedback</button>}
    {open && (inline
      ? <section className="feedback-inline" aria-label="Give feedback"><h4>Give feedback</h4>{content}</section>
      : createPortal(<Modal title="Give feedback" onClose={close}>{content}</Modal>, document.body))}
  </>;
}
