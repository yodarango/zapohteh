import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { API_GET_COURSES, ROUTE_LEARN } from "@constants";
import { authHeaders } from "@utils";
import zapohtehLogo from "../../../../public/logo.webp";

export const Topbar = ({ onMenuToggle }) => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const timeoutRef = useRef(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);

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
      <button
        type='button'
        onClick={onMenuToggle}
        className='flex h-10 w-10 items-center justify-center rounded-xl text-dr-text transition-colors hover:bg-dr-surface-light lg:hidden'
      >
        <ion-icon name='menu-outline' className='text-2xl'></ion-icon>
      </button>

      {/* Desktop search + notifications */}
      <div className='hidden items-center gap-4 lg:flex'>
        <button
          type='button'
          className='flex items-center gap-2 text-sm font-medium text-dr-text-muted transition-colors hover:text-dr-text'
        >
          <ion-icon name='notifications-outline' className='text-lg'></ion-icon>
          <span className='hidden sm:inline'>Notifications</span>
        </button>

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
