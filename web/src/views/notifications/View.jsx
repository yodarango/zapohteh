import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Checkbox } from "@ds";
import { API_NOTIFICATIONS, ROUTE_CREATE, ROUTE_LEARN } from "@constants";
import { authHeaders } from "@utils";
import { useAppContext } from "@views/context/appContextProvider";

const buttonStyle = "rounded-lg border border-dr-border px-3 py-1.5 text-xs font-semibold text-dr-text transition-colors hover:bg-dr-surface-light disabled:cursor-not-allowed disabled:opacity-50";

function labelFor(item) {
  switch (item.type) {
    case "course_succeeded": return `Your course “${item.courseTitle}” is ready.`;
    case "course_failed": return `Creation of “${item.courseTitle}” failed.`;
    case "course_interrupted": return `Creation of “${item.courseTitle}” was interrupted.`;
    case "invitation": return `@${item.actorUsername} invited you to collaborate on “${item.courseTitle}”.`;
    default: return "Notification";
  }
}

function displayTime(value) {
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export const NotificationsView = () => {
  const navigate = useNavigate();
  const { showToast, refreshNotifications } = useAppContext();
  const [view, setView] = useState("all");
  const [type, setType] = useState("all");
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestVersion = useRef(0);

  const load = useCallback(async (before = null, silent = false) => {
    const version = ++requestVersion.current;
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams({ view, type });
      if (before) params.set("before", String(before));
      const response = await fetch(`${API_NOTIFICATIONS}?${params}`, { headers: authHeaders() });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.errors || "Could not load notifications");
      if (version !== requestVersion.current) return;
      setItems((previous) => before ? [...previous, ...result.data.items] : result.data.items);
      setCursor(result.data.nextCursor);
      setError("");
    } catch (err) {
      if (version === requestVersion.current) setError(err.message || "Could not load notifications");
    } finally {
      if (version === requestVersion.current) { setLoading(false); setRefreshing(false); }
    }
  }, [view, type]);

  useEffect(() => {
    setSelected([]);
    load();
    return () => { requestVersion.current += 1; };
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => { if (!busy && !loading && !refreshing && selected.length === 0 && items.length <= 30) load(null, true); }, 15000);
    return () => clearInterval(timer);
  }, [load, busy, loading, refreshing, selected.length, items.length]);

  const action = async (name, ids = [], confirmDelete = false) => {
    if (confirmDelete && !window.confirm("Delete the selected notifications? This cannot be undone.")) return false;
    requestVersion.current += 1;
    setRefreshing(false);
    setBusy(true);
    try {
      const response = await fetch(`${API_NOTIFICATIONS}/actions`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify({ action: name, ids }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.errors || "Could not update notifications");
      setSelected([]);
      await Promise.all([load(), refreshNotifications()]);
      return true;
    } catch (err) {
      showToast({ type: "danger", message: err.message || "Could not update notifications" });
      await load();
      return false;
    } finally { setBusy(false); }
  };

  const respond = async (item, responseAction) => {
    requestVersion.current += 1;
    setRefreshing(false);
    setBusy(true);
    try {
      const response = await fetch(`${API_NOTIFICATIONS}/${item.id}/respond`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify({ action: responseAction }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.errors || "Could not respond to invitation");
      showToast({ type: "success", message: responseAction === "accept" ? "Invitation accepted" : "Invitation declined" });
    } catch (err) {
      showToast({ type: "danger", message: err.message || "Could not respond to invitation" });
    } finally {
      setSelected([]);
      await Promise.all([load(), refreshNotifications()]);
      setBusy(false);
    }
  };

  const openItem = async (item) => {
    if (!item.read && !(await action("read", [item.id]))) return;
    if (item.type === "course_succeeded") navigate(`${ROUTE_LEARN}/${encodeURIComponent(item.courseTitle)}`);
    else navigate(ROUTE_CREATE);
  };

  const selectedItems = items.filter((item) => selected.includes(item.id));
  const includesPending = selectedItems.some((item) => item.invitationStatus === "pending");

  return (
    <section className='mx-auto w-full max-w-5xl'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div><h1 className='text-2xl font-bold text-dr-text'>Notifications</h1><p className='mt-1 text-sm text-dr-text-muted'>Course updates and collaboration invitations.</p></div>
        <button type='button' className={buttonStyle} disabled={busy} onClick={() => action("read_all")}>Mark all read</button>
      </div>
      <div className='mt-6 flex flex-wrap items-center gap-2'>
        {[["all", "All"], ["unread", "Unread"], ["archived", "Archived"]].map(([value, label]) => (
          <button key={value} type='button' onClick={() => setView(value)} aria-pressed={view === value} className={`${buttonStyle} ${view === value ? "border-dr-accent bg-dr-accent-light text-dr-accent" : ""}`}>{label}</button>
        ))}
        <label className='ml-auto text-sm text-dr-text-muted'>
          <span className='sr-only'>Notification type</span>
          <select value={type} onChange={(event) => setType(event.target.value)} className='rounded-lg border border-dr-border bg-dr-surface px-3 py-1.5 text-sm text-dr-text'>
            <option value='all'>All types</option><option value='course'>Course creation</option><option value='invitation'>Invitations</option>
          </select>
        </label>
      </div>
      {items.length > 0 && (
        <div className='mt-4 flex flex-wrap items-center gap-2'>
          <Checkbox className='mr-2 text-dr-text-muted' checked={selected.length === items.length} indeterminate={selected.length > 0 && selected.length < items.length} onChange={(event) => setSelected(event.target.checked ? items.map((item) => item.id) : [])}>
            Select loaded
          </Checkbox>
          <button type='button' className={buttonStyle} disabled={busy || !selected.length || selected.length > 100} onClick={() => action("read", selected)}>Read</button>
          <button type='button' className={buttonStyle} disabled={busy || !selected.length || selected.length > 100} onClick={() => action("unread", selected)}>Unread</button>
          <button type='button' className={buttonStyle} disabled={busy || !selected.length || selected.length > 100 || (view !== "archived" && includesPending)} onClick={() => action(view === "archived" ? "restore" : "archive", selected)}>{view === "archived" ? "Restore" : "Archive"}</button>
          <button type='button' className={buttonStyle} disabled={busy || !selected.length || selected.length > 100 || includesPending} onClick={() => action("delete", selected, true)}>Delete</button>
          {selected.length > 100 && <span className='text-xs text-dr-text-muted'>Select at most 100 notifications at a time.</span>}
          {includesPending && <span className='text-xs text-dr-text-muted'>Respond to pending invitations before archiving or deleting.</span>}
        </div>
      )}
      {error && <div className='mt-5 text-sm text-dr-danger'>{error} <button type='button' className='underline' onClick={() => load()}>Try again</button></div>}
      {!loading && !error && items.length === 0 && <p className='mt-8 text-sm text-dr-text-muted'>No notifications in this view.</p>}
      <div className='mt-4 flex flex-col gap-3'>
        {items.map((item) => {
          const pending = item.type === "invitation" && item.invitationStatus === "pending";
          return (
            <article key={item.id} className={`flex gap-3 rounded-xl border p-4 ${item.read ? "border-dr-border" : "border-dr-accent bg-dr-accent-light/30"}`}>
              <Checkbox aria-label={`Select ${labelFor(item)}`} checked={selected.includes(item.id)} onChange={(event) => setSelected((prev) => event.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id))} className='mt-1 self-start' />
              <div className='min-w-0 flex-1'>
                <p className='text-sm font-medium text-dr-text'>{labelFor(item)} {!item.read && <span className='text-xs text-dr-accent'>(Unread)</span>}</p>
                <p className='mt-1 text-xs text-dr-text-muted'>{displayTime(item.createdAt)}{item.type === "invitation" && !pending ? ` · ${item.invitationStatus}` : ""}</p>
                {item.type === "course_succeeded" && !item.courseAvailable && <p className='mt-1 text-xs text-dr-text-muted'>This course is no longer available.</p>}
                <div className='mt-3 flex flex-wrap gap-2'>
                  {pending && <><button type='button' className={buttonStyle} disabled={busy} onClick={() => respond(item, "accept")}>Accept</button><button type='button' className={buttonStyle} disabled={busy} onClick={() => respond(item, "decline")}>Decline</button></>}
                  {item.type !== "invitation" && <button type='button' className={buttonStyle} disabled={busy || (item.type === "course_succeeded" && !item.courseAvailable)} onClick={() => openItem(item)}>{item.type === "course_succeeded" ? "Open course" : "View creation"}</button>}
                  <button type='button' className={buttonStyle} disabled={busy} onClick={() => action(item.read ? "unread" : "read", [item.id])}>{item.read ? "Mark unread" : "Mark read"}</button>
                  <button type='button' className={buttonStyle} disabled={busy || pending} onClick={() => action(item.archived ? "restore" : "archive", [item.id])}>{item.archived ? "Restore" : "Archive"}</button>
                  <button type='button' className={buttonStyle} disabled={busy || pending} onClick={() => action("delete", [item.id], true)}>Delete</button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {loading && <p className='mt-4 text-sm text-dr-text-muted' role='status'>Loading notifications...</p>}
      {cursor && !loading && <button type='button' className={`${buttonStyle} mt-4`} onClick={() => load(cursor)}>Load more</button>}
    </section>
  );
};