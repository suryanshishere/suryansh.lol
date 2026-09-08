"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ContactStatus = "new" | "read" | "archived";
type NotificationStatus = "sent" | "pending" | "failed";
type Contact = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: ContactStatus;
  createdAt: string;
  updatedAt: string;
  notification: {
    status: NotificationStatus;
    attempts: number;
    lastAttemptAt?: string;
    sentAt?: string;
  };
};
type Session = {
  authenticated: true;
  user: { email: string; name: string; picture?: string };
  csrfToken: string;
};
type InboxData = {
  contacts: Contact[];
  pagination: { page: number; limit: number; total: number; pages: number };
  counts: Record<ContactStatus | "total", number>;
};

const statusLabels: Record<ContactStatus, string> = {
  new: "New",
  read: "Read",
  archived: "Archived",
};

const authMessages: Record<string, string> = {
  auth: "Sign-in did not finish. Please try again.",
  access_denied: "This inbox is only available to Suryansh’s admin account. Sign in with the authorized Google account.",
  configuration: "Google sign-in is not available yet. Please try again once it has been configured.",
};

function readableDate(value: string, full = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: full ? "long" : "short",
    year: "numeric",
    ...(full ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

function replyLink(contact: Contact) {
  const email = contact.email.trim();
  if (!/^[^\s<>@,;:?&#]+@[^\s<>@,;:?&#]+\.[^\s<>@,;:?&#]+$/.test(email)) return null;
  const subject = `Re: ${contact.subject || "Your message to Suryansh"}`.replace(/[\r\n]/g, " ");
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}`;
}

function Envelope({ large = false }: { large?: boolean }) {
  return (
    <svg width={large ? 136 : 48} height={large ? 112 : 40} viewBox="0 0 136 112" fill="none" aria-hidden="true">
      <path d="m17 30 96-6 6 64-96 6-6-64Z" fill="var(--paper, #faf8f2)" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="m18 31 51 35 44-40M24 93l33-41m61 35L80 50" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="m99 8 3-6m13 12 6-3M10 71l-7 2" stroke="var(--red, #ee4935)" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="112" cy="83" r="15" fill="var(--red, #ee4935)" />
      <path d="M106 83h12m-6-6v12" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.7 2.9-4.2 2.9-7.4Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-1 6.7-2.4l-3.3-2.5c-.9.6-2 1-3.4 1-2.6 0-4.9-1.8-5.7-4.2H2.9v2.6A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.3 13.9a6 6 0 0 1 0-3.8V7.5H2.9a10 10 0 0 0 0 9l3.4-2.6Z" />
      <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.6 9.6 0 0 0 12 2a10 10 0 0 0-9.1 5.5l3.4 2.6C7.1 7.7 9.4 5.9 12 5.9Z" />
    </svg>
  );
}

export default function AdminInbox() {
  const [authState, setAuthState] = useState<"loading" | "signed-out" | "signed-in" | "error">("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [authError, setAuthError] = useState("");
  const [data, setData] = useState<InboxData | null>(null);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ContactStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<"status" | "notification" | "logout" | null>(null);
  const requestVersion = useRef(0);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const lastMessageButton = useRef<HTMLButtonElement | null>(null);

  const checkSession = useCallback(async (signal?: AbortSignal) => {
    setAuthState("loading");
    try {
      const response = await fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error("session");
      const result = (await response.json()) as Session | { authenticated: false };
      if (signal?.aborted) return;
      if (result.authenticated && result.csrfToken && result.user?.email) {
        setSession(result);
        setAuthState("signed-in");
        setAuthError("");
      } else {
        setSession(null);
        setAuthState("signed-out");
      }
    } catch {
      if (!signal?.aborted) setAuthState("error");
    }
  }, []);

  useEffect(() => {
    const errorCode = new URLSearchParams(window.location.search).get("error");
    if (errorCode) setAuthError(authMessages[errorCode] || authMessages.auth);
    const controller = new AbortController();
    void checkSession(controller.signal);
    return () => controller.abort();
  }, [checkSession]);

  useEffect(() => {
    if (search.trim() === query) return;
    const timer = window.setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [search, query]);

  function expireSession() {
    setSession(null);
    setData(null);
    setSelected(null);
    setAuthError("Your session has ended. Sign in again to open your inbox.");
    setAuthState("signed-out");
  }

  const loadContacts = useCallback(async (signal?: AbortSignal) => {
    if (authState !== "signed-in") return;
    const version = ++requestVersion.current;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page) });
    if (query) params.set("q", query);
    if (filter !== "all") params.set("status", filter);
    try {
      const response = await fetch(`/api/admin/contacts?${params}`, { credentials: "same-origin", cache: "no-store", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) });
      if (signal?.aborted || version !== requestVersion.current) return;
      if (response.status === 401 || response.status === 403) {
        expireSession();
        return;
      }
      if (!response.ok) throw new Error("contacts");
      const result = (await response.json()) as InboxData;
      if (signal?.aborted || version !== requestVersion.current) return;
      if (result.pagination.pages > 0 && page > result.pagination.pages) {
        setPage(result.pagination.pages);
        return;
      }
      setData(result);
      setSelected((current) => current ? result.contacts.find((contact) => contact.id === current.id) || current : null);
    } catch {
      if (!signal?.aborted && version === requestVersion.current) setError("Your messages could not be loaded. Check your connection and try again.");
    } finally {
      if (!signal?.aborted && version === requestVersion.current) setLoading(false);
    }
  }, [authState, filter, page, query]);

  const latestLoadContacts = useRef(loadContacts);

  useEffect(() => {
    latestLoadContacts.current = loadContacts;
    const controller = new AbortController();
    void loadContacts(controller.signal);
    return () => controller.abort();
  }, [loadContacts]);

  useEffect(() => {
    if (selected && window.matchMedia("(max-width: 760px)").matches) detailHeading.current?.focus();
  }, [selected?.id]);

  async function mutateContact(action: "status" | "notification", nextStatus?: ContactStatus) {
    if (!session || !selected || busy) return;
    const contact = selected;
    setBusy(action);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/contacts/${encodeURIComponent(contact.id)}${action === "notification" ? "/retry-email" : ""}`, {
        method: action === "status" ? "PATCH" : "POST",
        credentials: "same-origin",
        signal: AbortSignal.timeout(45000),
        headers: { "Content-Type": "application/json", "X-CSRF-Token": session.csrfToken },
        ...(action === "status" ? { body: JSON.stringify({ status: nextStatus }) } : {}),
      });
      if (response.status === 401 || response.status === 403) {
        expireSession();
        return;
      }
      if (!response.ok) throw new Error("mutation");
      if (action === "status" && nextStatus) {
        setSelected((current) => current?.id === contact.id ? { ...current, status: nextStatus } : current);
        setNotice(`Message marked as ${statusLabels[nextStatus].toLowerCase()}.`);
      } else {
        const result = (await response.json()) as { notification: NotificationStatus };
        setSelected((current) => current?.id === contact.id ? { ...current, notification: { ...current.notification, status: result.notification } } : current);
        setNotice(result.notification === "sent" ? "Email notification sent to your inbox." : "The email notification could not be sent. Your message is still saved here; you can retry later.");
      }
      await latestLoadContacts.current();
    } catch {
      setError(action === "status" ? "The message status could not be saved. Please try again." : "The email notification could not be sent. Please try again later.");
    } finally {
      setBusy(null);
    }
  }

  async function logout() {
    if (!session || busy) return;
    setBusy("logout");
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", headers: { "X-CSRF-Token": session.csrfToken }, signal: AbortSignal.timeout(20000) });
      if (!response.ok && response.status !== 401) throw new Error("logout");
      ++requestVersion.current;
      setSession(null);
      setSelected(null);
      setData(null);
      setAuthError("");
      setAuthState("signed-out");
    } catch {
      setError("You could not be signed out. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  function changeFilter(value: ContactStatus | "all") {
    setFilter(value);
    setPage(1);
    setSelected(null);
    setNotice("");
  }

  const reply = selected ? replyLink(selected) : null;
  const pagination = data?.pagination;
  const pages = Math.max(1, pagination?.pages || 1);

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <a className="admin-brand" href="/" aria-label="Suryansh’s portfolio">suryansh<span>.lol</span></a>
        <div className="admin-header-right">
          <a className="admin-return" href="/">↗ <span>View portfolio</span></a>
          {session && <button className="admin-text-button" onClick={() => void logout()} disabled={Boolean(busy)}>{busy === "logout" ? "Signing out…" : "Sign out"}</button>}
        </div>
      </header>

      {authState !== "signed-in" ? (
        <section className="admin-gateway" aria-labelledby="inbox-title">
          <div className="admin-envelope"><Envelope large /></div>
          <p className="admin-eyebrow">For Suryansh’s eyes</p>
          <h1 id="inbox-title">Good conversations<br />start <span>here.</span></h1>
          <p className="admin-gateway-copy">Your portfolio messages, all in one little inbox.</p>
          {authState === "loading" && <p className="admin-checking" role="status"><span className="admin-spinner" /> Opening your inbox…</p>}
          {authState === "error" && <div className="admin-gateway-error" role="alert"><p>Your sign-in status could not be checked. Check your connection and try again.</p><button className="admin-button" onClick={() => void checkSession()}>Try again <span aria-hidden="true">↻</span></button></div>}
          {authState === "signed-out" && <>
            {authError && <p className="admin-gateway-error" role="alert">{authError}</p>}
            <a className="admin-google" href="/api/auth/google"><GoogleMark /> Continue with Google <span aria-hidden="true">↗</span></a>
            <p className="admin-private-note">Private access · Admin account only</p>
          </>}
        </section>
      ) : (
        <div className="admin-workspace">
          <div className="admin-title-row">
            <div><p className="admin-eyebrow">A little room for conversations</p><h1>Your inbox<span>.</span></h1></div>
            <p className="admin-account"><span className="admin-account-dot" aria-hidden="true" /> {session?.user.email}</p>
          </div>

          <div className="admin-toolbar">
            <div className="admin-filters" role="group" aria-label="Filter messages by status">
              {(["all", "new", "read", "archived"] as const).map((value) => (
                <button key={value} className={`admin-filter ${filter === value ? "is-active" : ""}`} aria-pressed={filter === value} onClick={() => changeFilter(value)}>
                  {value === "all" ? "All messages" : statusLabels[value]}<span>{data ? data.counts[value === "all" ? "total" : value] : "—"}</span>
                </button>
              ))}
            </div>
            <div className="admin-search-wrap">
              <label className="admin-search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.6" /><path d="m16 16 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg><span className="admin-sr-only">Search messages</span><input type="search" value={search} placeholder="Find a conversation…" maxLength={200} onChange={(event) => { setSearch(event.target.value); setSelected(null); }} /></label>
              <button className="admin-icon-button" aria-label="Refresh messages" title="Refresh messages" disabled={loading || Boolean(busy)} onClick={() => void loadContacts()}>↻</button>
            </div>
          </div>

          {error && <div className="admin-alert" role="alert"><p>{error}</p><button className="admin-text-button" onClick={() => void loadContacts()} disabled={loading}>Reload messages</button></div>}
          <p className="admin-notice" role="status" aria-live="polite">{notice}</p>

          <div className={`admin-inbox ${selected ? "has-selection" : ""}`}>
            <section className="admin-message-column" aria-label="Messages" aria-busy={loading}>
              <div className="admin-list-caption"><span>{loading ? "Loading messages…" : `${pagination?.total || 0} conversation${pagination?.total === 1 ? "" : "s"}`}</span><span>Newest first</span></div>
              {loading && !data ? <div className="admin-list-loading" role="status"><span className="admin-spinner" /> Fetching your messages…</div> : data?.contacts.length ? (
                <ul className="admin-message-list">{data.contacts.map((contact) => <li key={contact.id}>
                  <button className={`admin-message-item ${selected?.id === contact.id ? "is-selected" : ""} ${contact.status === "new" ? "is-new" : ""}`} aria-pressed={selected?.id === contact.id} disabled={loading} onClick={(event) => { lastMessageButton.current = event.currentTarget; setSelected(contact); setNotice(""); }}>
                    <span className="admin-message-top"><span className="admin-message-name">{contact.status === "new" && <span className="admin-unread-dot" aria-label="New message" />}{contact.name}</span><time dateTime={contact.createdAt}>{readableDate(contact.createdAt)}</time></span>
                    <span className="admin-message-subject">{contact.subject || "A new conversation"}</span>
                    <span className="admin-message-preview">{contact.message}</span>
                    <span className={`admin-status admin-status-${contact.status}`}>{statusLabels[contact.status]}</span>
                  </button>
                </li>)}</ul>
              ) : !error && !loading ? <div className="admin-empty-list"><Envelope /><h2>{query ? "Nothing by that name." : filter === "all" ? "The next hello is on its way." : `No ${filter} messages.`}</h2><p>{query ? "Try another name, email, or phrase." : filter === "all" ? "Messages sent through your portfolio will land here." : "Try another filter to see your conversations."}</p>{(query || filter !== "all") && <button className="admin-text-button" onClick={() => { setSearch(""); setQuery(""); changeFilter("all"); }}>Show all messages <span aria-hidden="true">↗</span></button>}</div> : null}
              <nav className="admin-pagination" aria-label="Message pages"><button className="admin-text-button" disabled={loading || page <= 1} onClick={() => { setPage((current) => current - 1); setSelected(null); }}>← Previous</button><span>Page {page} of {pages}</span><button className="admin-text-button" disabled={loading || page >= pages} onClick={() => { setPage((current) => current + 1); setSelected(null); }}>Next →</button></nav>
            </section>

            {selected ? (
              <article className="admin-detail" aria-labelledby="message-subject">
                <button className="admin-mobile-back admin-text-button" onClick={() => { setSelected(null); requestAnimationFrame(() => lastMessageButton.current?.focus()); }}>← All conversations</button>
                <div className="admin-detail-meta"><span className={`admin-status admin-status-${selected.status}`}>{statusLabels[selected.status]}</span><time dateTime={selected.createdAt}>{readableDate(selected.createdAt, true)}</time></div>
                <h2 ref={detailHeading} tabIndex={-1} id="message-subject">{selected.subject || "A new conversation"}</h2>
                <div className="admin-sender"><span className="admin-avatar" aria-hidden="true">{selected.name.trim().charAt(0).toUpperCase() || "?"}</span><div><strong>{selected.name}</strong><span>{selected.email}</span></div></div>
                <div className="admin-message-body">{selected.message}</div>
                <div className="admin-detail-actions">
                  {reply ? <a className="admin-button admin-reply" href={reply}>Reply by email <span aria-hidden="true">↗</span></a> : <p className="admin-invalid-email">This email address cannot be opened for a reply.</p>}
                  <label className="admin-status-select"><span>Move to</span><select aria-label="Message status" value={selected.status} disabled={Boolean(busy)} onChange={(event) => void mutateContact("status", event.target.value as ContactStatus)}>{(["new", "read", "archived"] as const).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select>{busy === "status" && <span className="admin-spinner" aria-label="Saving status" />}</label>
                </div>
                <div className={`admin-delivery admin-delivery-${selected.notification.status}`}>
                  <span className="admin-delivery-symbol" aria-hidden="true">{selected.notification.status === "sent" ? "✓" : selected.notification.status === "pending" ? "◷" : "!"}</span>
                  <div><strong>{selected.notification.status === "sent" ? "A copy is in your email inbox." : selected.notification.status === "pending" ? "Email notification is pending." : "The email notification did not send."}</strong><p>{selected.notification.status === "sent" ? "Sent to heresuryanshsingh@gmail.com" : "The contact message is safely saved here."}</p></div>
                  {selected.notification.status !== "sent" && <button className="admin-text-button" disabled={Boolean(busy)} onClick={() => void mutateContact("notification")}>{busy === "notification" ? "Sending…" : "Retry email"}</button>}
                </div>
              </article>
            ) : (
              <div className="admin-detail-empty"><Envelope large /><h2>Pick a hello.</h2><p>Open a message to read it,<br />reply, or put it away for later.</p></div>
            )}
          </div>
          <footer className="admin-footer"><span>Small inbox. Good possibilities.</span><a href="/">Back to the portfolio ↗</a></footer>
        </div>
      )}
    </main>
  );
}
