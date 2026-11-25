import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Input, Loading } from "@ds";
import {
  API_GET_ALL_COURSE_HIGHLIGHTS,
  API_GET_HIGHLIGHTS,
  API_GET_SUBJECTS,
} from "@constants";
import { authHeaders, useGet } from "@utils";
import { useAppContext } from "@views/context/appContextProvider";
import { FilterDropdowns } from "../FilterDropdowns";
import { HighlightCard } from "./HighlightCard";
import { useStoredFilters } from "../useStoredFilters";

const PAGE_SIZE = 20;

export const HighlightsView = () => {
  const { showToast } = useAppContext();
  const {
    query, setQuery, debouncedQuery,
    selectedSubjects, setSelectedSubjects,
    selectedStatus, setSelectedStatus,
    selectedYears, setSelectedYears,
    selectedMonths, setSelectedMonths,
    hasFilters, clearFilters,
  } = useStoredFilters("zapohteh-highlights-filters");
  const [highlights, setHighlights] = useState([]);
  const [userHighlights, setUserHighlights] = useState([]);
  const [stylesError, setStylesError] = useState(null);
  const [availableYears, setAvailableYears] = useState([]);
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const sentinelRef = useRef(null);
  const sessionRef = useRef(null);
  const {
    data: subjectsData,
    loading: subjectsLoading,
    error: subjectsError,
    refetch: refetchSubjects,
  } = useGet({
    url: API_GET_SUBJECTS,
  });
  const subjects = useMemo(() => {
    const byId = new Map();
    for (const subject of [...(Array.isArray(subjectsData) ? subjectsData : []), ...availableSubjects]) {
      byId.set(subject.id, subject);
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [subjectsData, availableSubjects]);
  const subjectsLoadError = subjectsError ||
    (!subjectsLoading && !Array.isArray(subjectsData) && "Failed to load subjects");
  const loadedCount = highlights.length;

  const filterParams = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("search", debouncedQuery);
    if (selectedSubjects.size) params.set("subjects", [...selectedSubjects].join(","));
    if (selectedStatus) params.set("status", selectedStatus);
    if (selectedYears.size) params.set("year", [...selectedYears].join(","));
    if (selectedMonths.size) params.set("month", [...selectedMonths].join(","));
    return params.toString();
  }, [debouncedQuery, selectedSubjects, selectedStatus, selectedYears, selectedMonths]);

  const refreshHighlights = () => setRefreshVersion((version) => version + 1);

  const fetchPage = useCallback(
    async (session, currentOffset) => {
      if (sessionRef.current !== session || session.busy) return;

      session.busy = true;
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams(session.filters);
        params.set("limit", PAGE_SIZE);
        params.set("offset", currentOffset);
        const res = await fetch(
          `${API_GET_ALL_COURSE_HIGHLIGHTS}?${params}`,
          {
            headers: authHeaders(),
            signal: session.controller.signal,
          },
        );
        const result = await res.json();
        if (sessionRef.current !== session || session.controller.signal.aborted) return;
        if (!res.ok || !result.success || result.errors || result.error) {
          throw new Error(result.errors || result.error || "Failed to load highlights");
        }

        const page = result.data?.highlights || [];
        const filteredTotal = result.data?.total;
        if (!Array.isArray(page) || typeof filteredTotal !== "number" ||
            (page.length === 0 && currentOffset < filteredTotal)) {
          throw new Error("Invalid highlights response");
        }

        if (Array.isArray(result.data.years)) {
          setAvailableYears([...result.data.years].sort((a, b) => a - b));
        }
        if (Array.isArray(result.data.subjects)) {
          setAvailableSubjects((previous) => {
            const byId = new Map(previous.map((subject) => [subject.id, subject]));
            result.data.subjects.forEach((subject) => byId.set(subject.id, subject));
            return [...byId.values()];
          });
        }
        session.nextOffset = currentOffset + page.length;
        session.ready = true;
        setHighlights((prev) => currentOffset === 0 ? page : [...prev, ...page]);
        setTotal(filteredTotal);
        setHasMore(session.nextOffset < filteredTotal);
      } catch (err) {
        if (sessionRef.current !== session || session.controller.signal.aborted) return;
        setError(err.message || "Something went wrong");
        showToast({
          type: "danger",
          message: err.message || "Failed to load highlights",
        });
      } finally {
        if (sessionRef.current === session && !session.controller.signal.aborted) {
          session.busy = false;
          setLoading(false);
          setInitialLoading(false);
        }
      }
    },
    [showToast],
  );

  useEffect(() => {
    const session = {
      controller: new AbortController(),
      filters: filterParams,
      nextOffset: 0,
      ready: false,
      busy: false,
    };
    sessionRef.current = session;
    setHighlights([]);
    setTotal(0);
    setHasMore(false);
    setInitialLoading(true);
    fetchPage(session, 0);
    return () => {
      session.controller.abort();
      if (sessionRef.current === session) sessionRef.current = null;
    };
  }, [filterParams, refreshVersion, fetchPage]);

  useEffect(() => {
    const controller = new AbortController();
    const loadUserHighlights = async () => {
      try {
        const res = await fetch(API_GET_HIGHLIGHTS, {
          headers: authHeaders(),
          signal: controller.signal,
        });
        const result = await res.json();
        if (!res.ok || !result.success || result.errors || result.error) {
          throw new Error(result.errors || result.error || "Failed to load highlight styles");
        }
        if (!Array.isArray(result.data)) throw new Error("Invalid highlight styles response");
        if (!controller.signal.aborted) setUserHighlights(result.data);
      } catch (err) {
        if (!controller.signal.aborted) {
          setStylesError(err.message || "Failed to load highlight styles");
        }
      }
    };
    loadUserHighlights();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!sentinelRef.current || !loadedCount || !hasMore || loading || initialLoading || error) return;
    const session = sessionRef.current;
    if (!session?.ready) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && sessionRef.current === session) {
          fetchPage(session, session.nextOffset);
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
  }, [loadedCount, hasMore, loading, initialLoading, error, fetchPage]);

  return (
    <section>
      <h1 className='mb-1 text-2xl font-bold text-dr-text'>Highlights</h1>

      <p className='mb-6 text-sm text-dr-text-muted'>
        All your highlighted passages across every course.
      </p>

      <div className='mb-4'>
        <Input
          aria-label='Search highlights'
          placeholder='Search course title, chapter, highlight text or note...'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <FilterDropdowns
        subjects={subjects}
        availableYears={availableYears}
        selectedSubjects={selectedSubjects}
        setSelectedSubjects={setSelectedSubjects}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
        selectedYears={selectedYears}
        setSelectedYears={setSelectedYears}
        selectedMonths={selectedMonths}
        setSelectedMonths={setSelectedMonths}
        hasFilters={hasFilters}
        clearFilters={clearFilters}
      />

      {subjectsLoadError && (
        <div role='alert' className='mb-4 text-sm text-dr-danger'>
          Could not load subjects: {String(subjectsLoadError)}{" "}
          <button type='button' onClick={refetchSubjects} className='underline'>
            Try again
          </button>
        </div>
      )}
      {stylesError && (
        <p role='alert' className='mb-4 text-sm text-dr-danger'>
          Could not load highlight styles: {stylesError}
        </p>
      )}

      {!initialLoading && !error && (
        <p className='mb-4 text-sm text-dr-text-muted'>
          {total} {total === 1 ? "highlight" : "highlights"}
        </p>
      )}

      {initialLoading && (
        <div className='flex justify-center py-12'>
          <Loading size={40} />
        </div>
      )}

      {!initialLoading && error && (
        <div role='alert' className='py-6 text-center text-sm text-dr-danger'>
          <p>{error}</p>
          <button
            type='button'
            onClick={refreshHighlights}
            className='mt-2 underline'
          >
            Try again
          </button>
        </div>
      )}

      {!initialLoading && !error && highlights.length === 0 && (
        <p className='py-12 text-center text-dr-text-muted'>
          {hasFilters
            ? "No highlights match your filters."
            : "No highlights yet. Start highlighting while you read."}
        </p>
      )}

      {!initialLoading && highlights.length > 0 && (
        <div className='grid grid-cols-1 items-start gap-3 min-[700px]:grid-cols-2 xl:grid-cols-3'>
          {highlights.map((highlight) => (
            <HighlightCard
              key={highlight.id}
              highlight={highlight}
              userHighlights={userHighlights}
              onDelete={refreshHighlights}
              onUpdate={refreshHighlights}
            />
          ))}
        </div>
      )}

      {hasMore && !initialLoading && !error && (
        <div ref={sentinelRef} className='flex justify-center py-6'>
          <Loading size={32} />
        </div>
      )}

      {!hasMore && !initialLoading && !error && highlights.length > 0 && (
        <p className='py-6 text-center text-xs text-dr-text-muted'>
          No more highlights
        </p>
      )}
    </section>
  );
};
