import { useState, useEffect, useRef, useCallback } from "react";
import { Modal, Input, Loading } from "@ds";
import { API_USERS_SEARCH, API_COURSE_COLLABORATORS } from "@constants";
import { authHeaders } from "@utils";
import { useAppContext } from "@views/context/appContextProvider";
import { avatars } from "@images";

// Small round avatar: catalog image when the avatar path is known, otherwise the
// first letter of the name as a fallback.
const UserAvatar = ({ avatar, name }) => {
  const chosen = avatars.find((a) => a.pathName === avatar);
  return (
    <div className='flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-dr-accent-light text-xs font-semibold text-dr-accent'>
      {chosen?.image ? (
        <img
          src={chosen.image}
          alt={name}
          className='h-full w-full object-cover'
        />
      ) : (
        (name || "?").charAt(0).toUpperCase()
      )}
    </div>
  );
};

/* *************************************************************************************************
 * Modal where the lesson owner invites other users to collaborate. Typing in the input searches
 * users (debounced, mirroring the topbar course search); clicking a result sends them an invite.
 * Below, the current collaborators are listed with their status and a remove action.
 * *************************************************************************************************
 */
export const CollaborateModal = ({ open, onClose, topic }) => {
  const { showToast } = useAppContext();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  const [loadingCollaborators, setLoadingCollaborators] = useState(false);
  const timeoutRef = useRef(null);

  const loadCollaborators = useCallback(async () => {
    if (!topic) return;
    setLoadingCollaborators(true);
    try {
      const res = await fetch(
        `${API_COURSE_COLLABORATORS}/${encodeURIComponent(topic)}/collaborators`,
        { headers: authHeaders() },
      );
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setCollaborators(json.data);
      }
    } catch {
      // keep the previous list on network errors
    } finally {
      setLoadingCollaborators(false);
    }
  }, [topic]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      loadCollaborators();
    }
  }, [open, loadCollaborators]);

  // debounced user search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_USERS_SEARCH}?q=${encodeURIComponent(query.trim())}`,
          { headers: authHeaders() },
        );
        const json = await res.json();
        setResults(json.success && Array.isArray(json.data) ? json.data : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeoutRef.current);
  }, [query]);

  const invite = async (username) => {
    try {
      const res = await fetch(
        `${API_COURSE_COLLABORATORS}/${encodeURIComponent(topic)}/collaborators`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ username }),
        },
      );
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.errors || json.error || "Failed to send invitation");
      }
      showToast({ type: "success", message: "Invitation sent" });
      setQuery("");
      setResults([]);
      loadCollaborators();
    } catch (err) {
      showToast({
        type: "danger",
        message: err.message || "Failed to send invitation",
      });
    }
  };

  const removeCollaborator = async (userId) => {
    try {
      const res = await fetch(
        `${API_COURSE_COLLABORATORS}/${encodeURIComponent(topic)}/collaborators/${userId}`,
        { method: "DELETE", headers: authHeaders() },
      );
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.errors || json.error || "Failed to remove collaborator");
      }
      showToast({ type: "success", message: "Collaborator removed" });
      loadCollaborators();
    } catch (err) {
      showToast({
        type: "danger",
        message: err.message || "Failed to remove collaborator",
      });
    }
  };

  // users already invited should not be offered again
  const invitedIds = new Set(collaborators.map((c) => c.userId));
  const filteredResults = results.filter((u) => !invitedIds.has(u.id));

  return (
    <Modal open={open} onClose={onClose} title='Collaborate' zIndex={20}>
      <div className='flex flex-col gap-4'>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Search users by username or name...'
        />

        {searching && (
          <div className='flex justify-center py-2'>
            <Loading size={20} />
          </div>
        )}

        {!searching && query.trim() && filteredResults.length === 0 && (
          <p className='text-sm text-dr-text-muted'>No users found</p>
        )}

        {filteredResults.length > 0 && (
          <div className='flex flex-col overflow-hidden rounded-xl border border-dr-border'>
            {filteredResults.map((u) => {
              const name = [u.firstName, u.lastName].filter(Boolean).join(" ");
              return (
                <button
                  key={u.id}
                  type='button'
                  onClick={() => invite(u.username)}
                  className='flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-dr-surface-light'
                >
                  <UserAvatar avatar={u.avatar} name={u.username} />
                  <span className='min-w-0'>
                    <span className='block truncate text-sm font-semibold text-dr-text'>
                      @{u.username}
                    </span>
                    {name && (
                      <span className='block truncate text-xs text-dr-text-muted'>
                        {name}
                      </span>
                    )}
                  </span>
                  <ion-icon
                    name='person-add-outline'
                    className='ml-auto text-dr-accent'
                  ></ion-icon>
                </button>
              );
            })}
          </div>
        )}

        <div className='flex flex-col gap-2'>
          <h5 className='text-xs font-semibold uppercase tracking-wide text-dr-text-muted'>
            Collaborators
          </h5>
          {loadingCollaborators && collaborators.length === 0 ? (
            <div className='flex justify-center py-2'>
              <Loading size={20} />
            </div>
          ) : collaborators.length === 0 ? (
            <p className='text-sm text-dr-text-muted'>
              No collaborators yet. Invite someone above.
            </p>
          ) : (
            collaborators.map((c) => {
              const name = [c.firstName, c.lastName].filter(Boolean).join(" ");
              return (
                <div
                  key={c.userId}
                  className='flex items-center gap-3 rounded-xl border border-dr-border px-3 py-2'
                >
                  <UserAvatar avatar={c.avatar} name={c.username} />
                  <span className='min-w-0'>
                    <span className='block truncate text-sm font-semibold text-dr-text'>
                      @{c.username}
                    </span>
                    {name && (
                      <span className='block truncate text-xs text-dr-text-muted'>
                        {name}
                      </span>
                    )}
                  </span>
                  <span
                    className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      c.status === "accepted"
                        ? "bg-dr-success/10 text-dr-success"
                        : "bg-dr-warning/20 text-dr-warning"
                    }`}
                  >
                    {c.status}
                  </span>
                  <button
                    type='button'
                    onClick={() => removeCollaborator(c.userId)}
                    className='flex h-7 w-7 items-center justify-center rounded-lg text-dr-danger transition-colors hover:bg-dr-danger/10'
                    aria-label={`Remove @${c.username}`}
                    title='Remove collaborator'
                  >
                    <ion-icon name='trash-outline'></ion-icon>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
};

