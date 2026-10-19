import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useGame } from "@/game/store";
import { exportCloudCopies, localCloudCopy } from "@/game/cloud";
import { saveTextFile } from "@/lib/download";
import type { RunSummary } from "../../../shared/campaign.ts";
import { AnalyticsSettings } from "./AnalyticsSettings";
import { Icon } from "./icons";
import { Callout, Modal } from "./ui";
import "./Account.css";

/** Ask once per page whether this browser already holds an account session. */
function useAccountRestore() {
  useEffect(() => {
    if (useGame.getState().accountStatus === "unchecked") void useGame.getState().restoreAccount();
  }, []);
}

/** The landing page's account links open the game at `/?signin=1`. */
const SIGN_IN_PARAM = "signin";

/**
 * When the page was opened with `?signin`, wait for the account check, then open the account dialog for a
 * player who is not signed in. A signed-in player sees nothing. The flag leaves the address once handled,
 * so a reload does not ask again.
 */
function useSignInRequest(setOpen: (open: boolean) => void) {
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has(SIGN_IN_PARAM)) return;
    const settle = ({ accountStatus, accountSession }: ReturnType<typeof useGame.getState>) => {
      if (accountStatus === "unchecked" || accountStatus === "checking") return false;
      const url = new URL(window.location.href);
      url.searchParams.delete(SIGN_IN_PARAM);
      window.history.replaceState(window.history.state, "", url);
      if (!accountSession) setOpen(true);
      return true;
    };
    if (settle(useGame.getState())) return;
    // StrictMode runs this twice; only the subscription that survives handles the request.
    const stop = useGame.subscribe((s) => { if (settle(s)) stop(); });
    return stop;
  }, [setOpen]);
}

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "").join("") || "?";

function savedAt(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "an unknown time" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** The home screen's account control: Sign in for guests, the player's name once signed in. */
export function AccountButton() {
  useAccountRestore();
  const session = useGame((s) => s.accountSession);
  const status = useGame((s) => s.accountStatus);
  const [open, setOpen] = useState(false);
  useSignInRequest(setOpen);
  const checking = status === "unchecked" || status === "checking";
  return <>
    <button type="button" className={`account-chip${session ? " is-signed-in" : ""}`} aria-haspopup="dialog" onClick={() => setOpen(true)}>
      {session ? <>
        <span className="account-avatar" aria-hidden="true">{initials(session.account.displayName)}</span>
        <span className="account-chip-text">
          <span className="account-chip-name">{session.account.displayName}</span>
          <span className="account-chip-sub">Account and cloud saves</span>
        </span>
      </> : <>
        <Icon name="user" />
        <span className="account-chip-text">
          <span className="account-chip-name">{checking ? "Account" : "Sign in"}</span>
          <span className="account-chip-sub">{checking ? "Checking…" : "Save to the cloud"}</span>
        </span>
      </>}
    </button>
    {open && createPortal(
      <Modal title="Account" icon={{ kind: "users", name: "user" }} onClose={() => setOpen(false)} className="modal-account">
        <AccountContent onLoaded={() => setOpen(false)} />
        <AnalyticsSettings />
      </Modal>,
      document.body,
    )}
  </>;
}

/** Menu, Account: sign-in or profile controls; save management lives in Saves. */
export function AccountSection() {
  useAccountRestore();
  const session = useGame((s) => s.accountSession);
  return <section className="menu-section menu-account" aria-label="Account">
    <h4><Icon name="user" size={20} />Account</h4>
    {session ? <AccountProfile /> : <SignIn Heading="h5" />}
  </section>;
}

/** Menu, Saves: cloud save management belongs beside the browser save files. */
export function CloudSavesSection({ onOpenAccount }: { onOpenAccount: () => void }) {
  useAccountRestore();
  const session = useGame((s) => s.accountSession);
  const status = useGame((s) => s.accountStatus);
  const checking = status === "unchecked" || status === "checking";
  return <section className="menu-section menu-account" aria-label="Cloud saves">
    <h4><Icon name="cloud" size={20} />Cloud saves</h4>
    {session
      ? <CloudSaves Heading="h5" />
      : <div className="account-signin">
          <p className="account-lede" role="status">{checking ? "Checking your account…" : "Sign in from Account to save your Guided Mode company to the cloud and continue it on another device. Progress still saves in this browser."}</p>
          {!checking && <button type="button" className="btn" onClick={onOpenAccount}><Icon name="user" size={20} />Go to Account</button>}
        </div>}
  </section>;
}

function AccountContent({ onLoaded }: { onLoaded?: () => void }) {
  const session = useGame((s) => s.accountSession);
  return session ? <SignedIn onLoaded={onLoaded} Heading="h3" /> : <SignIn Heading="h3" />;
}
type HeadingTag = "h3" | "h5";

/* ------------------------------------------------------------------ */
/* Signed out                                                          */
/* ------------------------------------------------------------------ */

function SignIn({ Heading }: { Heading: HeadingTag }) {
  const status = useGame((s) => s.accountStatus);
  const cloudStatus = useGame((s) => s.cloudStatus);
  const prepareSignIn = useGame((s) => s.prepareSignIn);
  const restoreAccount = useGame((s) => s.restoreAccount);
  return <div className="account-signin">
    <p className="account-lede">Sign in to save your Guided Mode company to the cloud and continue it on another device. Without an account, progress saves in this browser.</p>
    {status === "unavailable"
      ? <Callout compact tone="warn" icon="alert" kicker="Accounts offline" live="status"
          action={<button type="button" className="btn btn-small" onClick={() => void restoreAccount()}>Try again</button>}>
          Accounts are unavailable right now. You can keep playing; progress saves in this browser.
        </Callout>
      : <p className="account-status" role="status">{status === "checking" || status === "unchecked" ? "Checking your account…" : cloudStatus}</p>}
    <a className="btn btn-google" href="/api/auth/google" onClick={(e) => { if (!prepareSignIn()) e.preventDefault(); }}>
      <GoogleMark />Continue with Google
    </a>
    <div className="account-divider" role="separator"><span>or use your email</span></div>
    <EmailForm Heading={Heading} />
  </div>;
}

function EmailForm({ Heading }: { Heading: HeadingTag }) {
  const signIn = useGame((s) => s.signInWithEmail);
  const register = useGame((s) => s.registerWithEmail);
  const busy = useGame((s) => s.cloudBusy);
  const id = useId();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shown, setShown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const mounted = useRef(true);
  // StrictMode mounts twice, so the flag is set again on every mount, not only cleared.
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const problem = creating ? await register(name.trim(), email.trim(), password) : await signIn(email.trim(), password);
    if (!mounted.current) return;
    setPending(false);
    setError(problem);
  };
  const switchForm = () => { setCreating(!creating); setError(null); };

  return <form className="account-form" onSubmit={submit} aria-label={creating ? "Create an account" : "Sign in with email"} aria-busy={pending}>
    <Heading className="account-form-title">{creating ? "Create an account" : "Sign in with email"}</Heading>
    {creating && <label className="field" htmlFor={`${id}-name`}>Name <span className="field-optional">(optional, shown in the game)</span>
      <input id={`${id}-name`} name="name" autoComplete="nickname" maxLength={60} value={name} disabled={pending} onChange={(e) => setName(e.target.value)} />
    </label>}
    <label className="field" htmlFor={`${id}-email`}>Email
      <input id={`${id}-email`} name="email" type="email" autoComplete="email" required maxLength={254} value={email} disabled={pending} onChange={(e) => setEmail(e.target.value)} />
    </label>
    <div className="field">
      <label htmlFor={`${id}-password`}>Password</label>
      <span className="password-field">
        <input id={`${id}-password`} name="password" type={shown ? "text" : "password"} required minLength={creating ? 8 : 1} maxLength={200}
          autoComplete={creating ? "new-password" : "current-password"} aria-describedby={creating ? `${id}-password-hint` : undefined}
          value={password} disabled={pending} onChange={(e) => setPassword(e.target.value)} />
        <button type="button" className="icon-btn password-toggle" aria-label={shown ? "Hide password" : "Show password"} aria-pressed={shown} onClick={() => setShown(!shown)}>
          <Icon name={shown ? "eyeOff" : "eye"} size={20} />
        </button>
      </span>
    </div>
    {creating && <p id={`${id}-password-hint`} className="field-hint">At least 8 characters.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <button type="submit" className="btn btn-primary" disabled={pending || busy}>
      <Icon name={creating ? "hire" : "login"} size={20} />
      {pending ? (creating ? "Creating account…" : "Signing in…") : creating ? "Create account" : "Sign in"}
    </button>
    <p className="account-switch">
      {creating ? "Already have an account?" : "New here?"}{" "}
      <button type="button" className="text-btn" onClick={switchForm}>{creating ? "Sign in instead" : "Create an account"}</button>
    </p>
  </form>;
}

/** Google's "G", as its sign-in branding asks for on a Continue with Google button. */
function GoogleMark() {
  return <svg className="google-mark" width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>;
}

/* ------------------------------------------------------------------ */
/* Signed in                                                           */
/* ------------------------------------------------------------------ */

function SignedIn({ onLoaded, Heading }: { onLoaded?: () => void; Heading: HeadingTag }) {
  return <div className="account-signed-in">
    <AccountProfile />
    <CloudSaves onLoaded={onLoaded} Heading={Heading} />
  </div>;
}

function AccountProfile() {
  const session = useGame((s) => s.accountSession)!;
  const busy = useGame((s) => s.cloudBusy);
  const signOut = useGame((s) => s.signOut);
  return <div className="account-profile">
    <span className="account-avatar account-avatar-big" aria-hidden="true">{initials(session.account.displayName)}</span>
    <div className="account-profile-text">
      <strong>{session.account.displayName}</strong>
      <span>Signed in</span>
    </div>
    <button type="button" className="btn btn-small" disabled={busy} onClick={() => void signOut()}><Icon name="logout" size={20} />Sign out</button>
  </div>;
}

function CloudSaves({ onLoaded, Heading }: { onLoaded?: () => void; Heading: HeadingTag }) {
  const s = useGame();
  const session = s.accountSession!;
  // Only a successful refresh may say the account has no cloud saves.
  const [listing, setListing] = useState<"loading" | "listed" | "failed">("loading");
  const listedFor = useRef<typeof session | null>(null);
  useEffect(() => {
    if (listedFor.current === session) return;
    listedFor.current = session;
    setListing("loading");
    void useGame.getState().refreshCloudRuns().then((ok) => setListing(ok ? "listed" : "failed"));
  }, [session]);

  const campaign = s.mode === "campaign" ? s.game.campaign : undefined;
  const local = campaign && s.hasRun ? campaign.runId : null;
  let owner: string | undefined, revision = 0, hasConflict = false, ownershipError = false;
  if (local) {
    try { const copy = localCloudCopy(local); owner = copy?.ownerId; revision = copy?.revision ?? 0; hasConflict = !!copy?.remote; }
    catch { ownershipError = true; }
  }
  const mismatch = !!owner && owner !== session.account.id;
  const refresh = () => { void s.refreshCloudRuns().then((ok) => setListing(ok ? "listed" : "failed")); };
  const save = async () => { await s.saveCloud(!owner); refresh(); };
  const load = async (runId: string) => { if (await s.resumeCloud(runId)) onLoaded?.(); };
  const download = () => {
    try {
      const bytes = JSON.stringify({ copies: JSON.parse(exportCloudCopies()), pendingConflict: s.cloudConflict, localCompany: s.game });
      saveTextFile("99.99-save-backup.json", bytes);
    } catch { s.notify("Browser storage could not be read for the backup. Keep this tab open.", "error"); }
  };

  return <div className="cloud-saves">
    <p className="account-status" role="status">{s.cloudStatus}</p>

    <Heading className="cloud-heading"><Icon name="save" size={20} />This browser</Heading>
    {s.mode === "classic"
      ? <p className="cloud-note">Cloud saves are for Guided Mode. Challenge Mode progress stays in this browser.</p>
      : !local
        ? <p className="cloud-note">No Guided Mode game in this browser yet. Start one, or load a cloud save below.</p>
        : <div className="cloud-row">
            <div className="cloud-row-text">
              <strong>Guided Mode save</strong>
              <span>{owner && !mismatch ? `In the cloud as version ${revision}` : "Not saved to the cloud yet"}</span>
            </div>
            <button type="button" className="btn btn-primary btn-small" disabled={s.cloudBusy || mismatch || ownershipError || s.saveBlocked || hasConflict} onClick={() => void save()}>
              <Icon name="upload" size={20} />Save to cloud
            </button>
          </div>}
    {mismatch && <Callout compact tone="warn" icon="alert" kicker="Another account">
      This local save belongs to another account. Sign in as that account to save it, or start a new game. It stays in this browser.
    </Callout>}
    {hasConflict && <Callout compact tone="warn" icon="alert" kicker="Two versions">
      The cloud has a different version of this save, probably from another device. Both are kept. Choose which one to continue:
      <span className="btn-row cloud-conflict-actions">
        <button type="button" className="btn btn-small" disabled={s.cloudBusy} onClick={() => void s.keepLocalConflict().then(refresh)}>Keep this browser’s version</button>
        <button type="button" className="btn btn-small" disabled={s.cloudBusy} onClick={() => void load(local!)}>Load the cloud version</button>
      </span>
    </Callout>}
    {ownershipError && <Callout compact tone="critical" icon="alert" kicker="Cannot read" live="alert">
      This browser’s cloud records could not be read. Download a backup before replacing any save.
    </Callout>}

    <div className="cloud-heading-row">
      <Heading className="cloud-heading"><Icon name="cloud" size={20} />In your account</Heading>
      <button type="button" className="btn btn-quiet btn-small" disabled={s.cloudBusy} onClick={refresh}><Icon name="refresh" size={20} />Refresh</button>
    </div>
    {s.cloudRuns.length
      ? <ul className="cloud-list">
          {s.cloudRuns.map((run) => <CloudRunRow key={run.runId} run={run} current={run.runId === local} busy={s.cloudBusy} onLoad={() => void load(run.runId)} />)}
        </ul>
      : <p className="cloud-note">{{ loading: "Looking for your cloud saves…", listed: "No cloud saves yet.", failed: "Your cloud saves could not be listed. Choose Refresh to try again." }[listing]}</p>}
    {s.cloudRuns.length > 0 && <p className="cloud-note">Loading a cloud save replaces this browser’s Guided Mode save. A backup copy of it is kept first.</p>}

    <details className="more cloud-backup">
      <summary>Backup</summary>
      <p className="cloud-note">Download every Guided Mode copy this browser holds, including cloud copies and unresolved versions.</p>
      <button type="button" className="btn btn-small" onClick={download}><Icon name="download" size={20} />Download backup</button>
    </details>
  </div>;
}

function CloudRunRow({ run, current, busy, onLoad }: { run: RunSummary; current: boolean; busy: boolean; onLoad: () => void }) {
  const when = savedAt(run.updatedAt);
  return <li className="cloud-row">
    <div className="cloud-row-text">
      <strong>{current ? "Guided Mode save (this game)" : "Guided Mode save"}</strong>
      <span>Saved {when} · version {run.revision}</span>
    </div>
    <button type="button" className="btn btn-small" disabled={busy} aria-label={`Load cloud save from ${when}`} onClick={onLoad}>
      <Icon name="download" size={20} />Load
    </button>
  </li>;
}
