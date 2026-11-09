import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  API_GET_COURSES,
  ROUTE_LEARN,
  API_GET_COLLABORATIONS,
  API_POST_COLLABORATION,
} from "@constants";
import { authHeaders } from "@utils";
import { useAppContext } from "@views/context/appContextProvider";
import { avatars } from "@images";
import zapohtehLogo from "../../../../public/logo.webp";

export const Topbar = ({ onMenuToggle }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { openLearnMenu, showToast } = useAppContext();
  const containerRef = useRef(null);
  const invitesRef = useRef(null);
  const timeoutRef = useRef(null);
  const isLearnRoute = location.pathname.startsWith(ROUTE_LEARN);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  // pending collaboration invitations shown in the bell dropdown
  const [invites, setInvites] = useState([]);
  const [showInvites, setShowInvites] = useState(false);

  const loadInvites = useCallback(async () => {
    try {
      const res = await fetch(API_GET_COLLABORATIONS, {
        headers: authHeaders(),
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setInvites(json.data);
      }
    } catch {
      // keep the previous list on network errors
    }
  }, []);

  // fetch pending invites on mount so the badge shows without opening the bell
  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  // close the invites dropdown on outside click (same pattern as the course search)
  useEffect(() => {
    const handleClick = (e) => {
      if (invitesRef.current && !invitesRef.current.contains(e.target)) {
        setShowInvites(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const toggleInvites = () => {
    setShowInvites((prev) => {
      const next = !prev;
      if (next) loadInvites();
      return next;
    });
  };

  const respondToInvite = async (inviteId, action) => {
    try {
      const res = await fetch(`${API_POST_COLLABORATION}/${inviteId}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.errors || json.error || "Failed to respond");
      }
      showToast({
        type: "success",
        message:
          action === "accept" ? "Invitation accepted" : "Invitation declined",
      });
      loadInvites();
    } catch (err) {
      showToast({
        type: "danger",
        message: err.message || "Failed to respond to invitation",
      });
    }
  };

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setShowResults(false);
      setSearching(false);
      return;
    }

    setSearching(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_GET_COURSES}?search=${encodeURIComponent(query.trim())}`,
          { headers: authHeaders() },
        );
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setResults(json.data.slice(0, 6));
        } else {
          setResults([]);
        }
        setShowResults(true);
      } catch {
        setResults([]);
        setShowResults(true);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutRef.current);
  }, [query]);

  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = (course) => {
    setQuery("");
    setResults([]);
    setShowResults(false);
    navigate(`${ROUTE_LEARN}/${encodeURIComponent(course.id)}`);
  };

  return (
    <header className='flex items-center justify-between gap-4 rounded-3xl border border-dr-border bg-dr-surface px-6 py-4 shadow-sm'>
      {/* Mobile hamburger */}
      <div className='flex items-center gap-2 lg:hidden'>
        <button
          type='button'
          onClick={onMenuToggle}
          className='flex h-10 w-10 items-center justify-center rounded-xl text-dr-text transition-colors hover:bg-dr-surface-light'
        >
          <ion-icon name='menu-outline' className='text-2xl'></ion-icon>
        </button>
        {isLearnRoute && (
          <button
            type='button'
            onClick={openLearnMenu}
            className='flex h-10 w-10 items-center justify-center rounded-xl text-dr-text transition-colors hover:bg-dr-surface-light'
            aria-label='Open course menu'
          >
            <ion-icon name='pencil-outline' className='text-2xl'></ion-icon>
          </button>
        )}
      </div>

      {/* Desktop search + notifications */}
      <div className='hidden items-center gap-4 lg:flex'>
        <div ref={invitesRef} className='relative'>
          <button
            type='button'
            onClick={toggleInvites}
            className='flex items-center gap-2 text-sm font-medium text-dr-text-muted transition-colors hover:text-dr-text'
            aria-label='Notifications'
          >
            <span className='relative'>
              <ion-icon
                name='notifications-outline'
                className='text-lg'
              ></ion-icon>
              {invites.length > 0 && (
                <span className='absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-dr-danger px-1 text-[10px] font-bold text-white'>
                  {invites.length}
                </span>
              )}
            </span>
            <span className='hidden sm:inline'>Notifications</span>
          </button>
          {showInvites && (
            <div className='absolute left-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-dr-border bg-dr-surface shadow-lg'>
              {invites.length === 0 ? (
                <div className='px-3 py-2 text-sm text-dr-text-muted'>
                  No pending invitations
                </div>
              ) : (
                invites.map((invite) => {
                  const chosen = avatars.find(
                    (a) => a.pathName === invite.inviterAvatar,
                  );
                  return (
                    <div
                      key={invite.id}
                      className='flex flex-col gap-2 border-b border-dr-border px-3 py-2 last:border-b-0'
                    >
                      <div className='flex items-center gap-2'>
                        <div className='flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-dr-accent-light text-xs font-semibold text-dr-accent'>
                          {chosen?.image ? (
                            <img
                              src={chosen.image}
                              alt={invite.inviterUsername}
                              className='h-full w-full object-cover'
                            />
                          ) : (
                            invite.inviterUsername.charAt(0).toUpperCase()
                          )}
                        </div>
                        <p className='min-w-0 text-sm text-dr-text'>
                          <span className='font-semibold'>
                            @{invite.inviterUsername}
                          </span>{" "}
                          invited you to collaborate on{" "}
                          <span className='font-semibold'>
                            {invite.courseTitle}
                          </span>
                        </p>
                      </div>
                      <div className='flex justify-end gap-2'>
                        <button
                          type='button'
                          onClick={() => respondToInvite(invite.id, "decline")}
                          className='rounded-lg border border-dr-border px-2 py-1 text-xs font-semibold text-dr-text-muted transition-colors hover:bg-dr-surface-light'
                        >
                          Decline
                        </button>
                        <button
                          type='button'
                          onClick={() => respondToInvite(invite.id, "accept")}
                          className='rounded-lg bg-dr-accent px-2 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-90'
                        >
                          Accept
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div ref={containerRef} className='relative w-full max-w-xs'>
          <ion-icon
            name='search-outline'
            className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dr-text-muted'
          ></ion-icon>
          <input
            type='search'
            placeholder='Search courses'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className='w-full rounded-xl border border-dr-border bg-dr-surface-light py-2 pl-9 pr-3 text-sm text-dr-text outline-none transition-colors placeholder:text-dr-text-muted focus:border-dr-accent'
          />
          {showResults && (
            <div className='absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-dr-border bg-dr-surface shadow-lg'>
              {results.length === 0 ? (
                <div className='px-3 py-2 text-sm text-dr-text-muted'>
                  No results
                </div>
              ) : (
                results.map((course) => (
                  <button
                    key={course.id}
                    type='button'
                    onClick={() => handleSelect(course)}
                    className='flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-dr-text hover:bg-dr-surface-light'
                  >
                    <ion-icon
                      name='book-outline'
                      className='text-dr-text-muted'
                    ></ion-icon>
                    <span className='truncate'>{course.name}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile brand icon */}
      <div className='flex items-center gap-2 lg:hidden'>
        <img
          src={zapohtehLogo}
          alt='Logo'
          className='h-8 w-8 rounded-lg object-contain'
        />
        <span className='text-lg font-bold text-dr-text'>Zapohteh</span>
      </div>
    </header>
  );
};
