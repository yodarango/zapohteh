import { useState, useEffect, useRef, useCallback } from "react";
import { Loading, Modal } from "@ds";
import { API_GET_ALL_COURSE_HIGHLIGHTS } from "@constants";
import { authHeaders } from "@utils";
import { useAppContext } from "@views/context/appContextProvider";

const PAGE_SIZE = 20;

const HighlightCard = ({ highlight, onViewNote }) => (
  <div className='rounded-2xl border border-dr-border bg-dr-surface p-4'>
    <div className='mb-3 flex items-start gap-3'>
      {highlight.coverImagePath ? (
        <img
          src={highlight.coverImagePath}
          alt={highlight.courseTitle}
          className='h-16 w-16 shrink-0 rounded-xl object-cover'
        />
      ) : (
        <div className='flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-dr-accent/20'>
          <ion-icon
            name='image-outline'
            className='text-2xl text-dr-accent/60'
          />
        </div>
      )}
      <div className='min-w-0 flex-1'>
        <div className='mb-1 flex items-center gap-2'>
          <span
            className='inline-block h-3 w-3 shrink-0 rounded-full'
            style={{ backgroundColor: highlight.color }}
          />
          <h3 className='truncate text-sm font-semibold text-dr-text'>
            {highlight.courseTitle}
          </h3>
        </div>
        <p className='text-xs font-medium text-dr-text-muted'>
          {highlight.chapter || "No chapter"}
        </p>
      </div>
      {highlight.note && (
        <button
          type='button'
          onClick={() => onViewNote(highlight)}
          className='flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-dr-accent transition-colors hover:bg-dr-accent-light'
          aria-label='View note'
          title='View note'
        >
          <ion-icon name='document-outline'></ion-icon>
        </button>
      )}
    </div>

    <blockquote className='rounded-xl border-l-4 border-dr-accent bg-dr-surface-light p-3 text-sm italic text-dr-text'>
      "{highlight.text}"
    </blockquote>
  </div>
);

export const HighlightsView = () => {
  const { showToast } = useAppContext();
  const [highlights, setHighlights] = useState([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const [selectedHighlight, setSelectedHighlight] = useState(null);
  const sentinelRef = useRef(null);

  const fetchHighlights = useCallback(
    async (currentOffset, append = false) => {
      if (loading) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${API_GET_ALL_COURSE_HIGHLIGHTS}?limit=${PAGE_SIZE}&offset=${currentOffset}`,
          { headers: authHeaders() },
        );
        const result = await res.json();
        if (!res.ok || result.error) {
          throw new Error(result.error || "Failed to load highlights");
        }
        const page = result.data?.highlights || [];
        const total = result.data?.total || 0;
        setHighlights((prev) => (append ? [...prev, ...page] : page));
        setHasMore(currentOffset + page.length < total);
      } catch (err) {
        setError(err.message || "Something went wrong");
        showToast({ type: "danger", message: err.message || "Failed to load highlights" });
      } finally {
        setLoading(false);
        setInitialLoading(false);
      }
    },
    [showToast, loading],
  );

  useEffect(() => {
    fetchHighlights(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting) {
          const nextOffset = offset + PAGE_SIZE;
          setOffset(nextOffset);
          fetchHighlights(nextOffset, true);
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, offset, fetchHighlights]);

  return (
    <section>
      <h1 className='mb-1 text-2xl font-bold text-dr-text'>Highlights</h1>
      <p className='mb-6 text-sm text-dr-text-muted'>
        All your highlighted passages across every course.
      </p>

      {initialLoading && (
        <div className='flex justify-center py-12'>
          <Loading size={40} />
        </div>
      )}

      {!initialLoading && !error && highlights.length === 0 && (
        <p className='py-12 text-center text-dr-text-muted'>
          No highlights yet. Start highlighting while you read.
        </p>
      )}

      {!initialLoading && highlights.length > 0 && (
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          {highlights.map((highlight) => (
            <HighlightCard
              key={highlight.id}
              highlight={highlight}
              onViewNote={setSelectedHighlight}
            />
          ))}
        </div>
      )}

      {hasMore && !initialLoading && (
        <div ref={sentinelRef} className='flex justify-center py-6'>
          <Loading size={32} />
        </div>
      )}

      {!hasMore && highlights.length > 0 && (
        <p className='py-6 text-center text-xs text-dr-text-muted'>
          No more highlights
        </p>
      )}

      <Modal
        open={selectedHighlight != null}
        onClose={() => setSelectedHighlight(null)}
        title={selectedHighlight ? `Note - ${selectedHighlight.courseTitle}` : "Note"}
        zIndex={30}
      >
        {selectedHighlight && (
          <div className='flex flex-col gap-3'>
            <p className='text-xs font-medium text-dr-text-muted'>
              {selectedHighlight.chapter || "No chapter"}
            </p>
            <div className='rounded-xl border-l-4 border-dr-accent bg-dr-surface-light p-3'>
              <p className='text-sm italic text-dr-text'>"{selectedHighlight.text}"</p>
            </div>
            <div className='rounded-xl bg-dr-surface-light p-3'>
              <p className='text-sm text-dr-text'>{selectedHighlight.note}</p>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
};
