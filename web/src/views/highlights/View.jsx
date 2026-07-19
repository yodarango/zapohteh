import { useState, useEffect, useRef, useCallback } from "react";
import { Loading } from "@ds";
import { API_GET_ALL_COURSE_HIGHLIGHTS } from "@constants";
import { authHeaders } from "@utils";
import { useAppContext } from "@views/context/appContextProvider";

const PAGE_SIZE = 20;

const HighlightCard = ({ highlight }) => {
  const highlightColor = highlight.color || "#ffffff";

  return (
    <article className='w-full overflow-hidden rounded-2xl border border-dr-border bg-white min-[700px]:min-w-[330px] min-[700px]:max-w-[500px] min-[700px]:flex-1'>
      <header className='flex items-center gap-3 border-b border-black/10 px-4 py-3'>
        <div
          className='h-10 w-10 shrink-0 rounded-full border-2 border-black/10'
          style={{ backgroundColor: highlightColor }}
          aria-hidden='true'
        />

        <div className='min-w-0 flex-1'>
          <h3 className='truncate text-sm font-semibold text-black'>
            {highlight.courseTitle}
          </h3>

          {highlight.lessonTitle && (
            <p className='truncate text-xs text-black/60'>
              {highlight.lessonTitle}
            </p>
          )}
        </div>

        <ion-icon name='ellipsis-horizontal' className='text-xl text-black' />
      </header>

      <div className='relative aspect-square overflow-hidden bg-white'>
        {highlight.coverImagePath ? (
          <img
            src={highlight.coverImagePath}
            alt={highlight.courseTitle}
            className='absolute inset-0 h-full w-full object-cover opacity-30'
          />
        ) : (
          <div className='absolute inset-0 flex items-center justify-center bg-white'>
            <ion-icon name='image-outline' className='text-5xl text-black/20' />
          </div>
        )}

        <div className='absolute inset-0 bg-white/20' />

        <div className='relative z-10 flex h-full items-center justify-center p-8'>
          <blockquote className='max-w-md text-center text-xl font-bold leading-relaxed text-black sm:text-2xl'>
            “{highlight.text}”
          </blockquote>
        </div>
      </div>

      <div className='border-t border-black/10 bg-white px-4 py-4'>
        {/* <div className='mb-3 flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <ion-icon name='heart-outline' className='text-2xl text-black' />

            <ion-icon
              name='chatbubble-outline'
              className='text-2xl text-black'
            />

            <ion-icon
              name='paper-plane-outline'
              className='text-2xl text-black'
            />
          </div>

          <ion-icon name='bookmark-outline' className='text-2xl text-black' />
        </div> */}

        {highlight.note && (
          <p className='text-sm leading-relaxed text-black'>
            <span className='mr-2 font-semibold'>{highlight.courseTitle}</span>

            {highlight.note}
          </p>
        )}
      </div>
    </article>
  );
};

export const HighlightsView = () => {
  const { showToast } = useAppContext();
  const [highlights, setHighlights] = useState([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const sentinelRef = useRef(null);

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
            <HighlightCard key={highlight.id} highlight={highlight} />
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
