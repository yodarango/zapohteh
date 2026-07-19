import { useState, useEffect, useRef, useCallback } from "react";
import { Loading } from "@ds";
import { API_GET_ALL_COURSE_HIGHLIGHTS } from "@constants";
import { authHeaders } from "@utils";
import { useAppContext } from "@views/context/appContextProvider";
import { HighlightCard } from "./HighlightCard";

const PAGE_SIZE = 20;

export const HighlightsView = () => {
  const { showToast } = useAppContext();
  const [highlights, setHighlights] = useState([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const sentinelRef = useRef(null);

  const handleDelete = (id) => {
    setHighlights((prev) => prev.filter((h) => h.id !== id));
  };

  const fetchHighlights = useCallback(
    async (currentOffset, append = false) => {
      if (loading) return;

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `${API_GET_ALL_COURSE_HIGHLIGHTS}?limit=${PAGE_SIZE}&offset=${currentOffset}`,
          {
            headers: authHeaders(),
          },
        );

        const result = await res.json();

        if (!res.ok || result.error) {
          throw new Error(result.error || "Failed to load highlights");
        }

        const page = result.data?.highlights || [];
        const total = result.data?.total || 0;

        setHighlights((prev) => {
          return append ? [...prev, ...page] : page;
        });

        setHasMore(currentOffset + page.length < total);
      } catch (err) {
        setError(err.message || "Something went wrong");

        showToast({
          type: "danger",
          message: err.message || "Failed to load highlights",
        });
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
      {
        rootMargin: "200px",
      },
    );

    observer.observe(sentinelRef.current);

    return () => {
      observer.disconnect();
    };
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
        <div className='grid grid-cols-1 gap-6 min-[700px]:grid-cols-2 xl:grid-cols-3'>
          {highlights.map((highlight) => (
            <HighlightCard
              key={highlight.id}
              highlight={highlight}
              onDelete={handleDelete}
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
    </section>
  );
};
