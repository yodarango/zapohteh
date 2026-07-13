import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Loading, Input, Select, Thumbnail } from "@ds";
import { API_GET_COURSES, API_GET_SUBJECTS, ROUTE_LEARN } from "@constants";
import { useGet, formatLocalTime } from "@utils";
import { useAppContext } from "@views/context/appContextProvider";

const MONTHS = [
  { value: 1, label: "Jan" },
  { value: 2, label: "Feb" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Apr" },
  { value: 5, label: "May" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Aug" },
  { value: 9, label: "Sep" },
  { value: 10, label: "Oct" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Dec" },
];

// Soft background tints rotated across the course cards to echo the reference
// design's colorful thumbnails.
const TINTS = [
  "bg-amber-100 text-amber-700",
  "bg-teal-100 text-teal-700",
  "bg-rose-100 text-rose-700",
  "bg-indigo-100 text-indigo-700",
  "bg-emerald-100 text-emerald-700",
  "bg-fuchsia-100 text-fuchsia-700",
];

/* *************************************************************************************************
 * Lists every researched topic stored in the backend data directory as a grid of course cards,
 * each linking to its assembled markdown at /learn/:courseId.
 * *************************************************************************************************
 */
export const CoursesView = () => {
  const { showToast } = useAppContext();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState(new Set());
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedYears, setSelectedYears] = useState(new Set());
  const [selectedMonths, setSelectedMonths] = useState(new Set());

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 1000);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: subjectsData } = useGet({ url: API_GET_SUBJECTS });
  const subjects = subjectsData || [];

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (debouncedQuery) p.set("search", debouncedQuery);
    if (selectedSubjects.size > 0)
      p.set("subjects", Array.from(selectedSubjects).join(","));
    if (selectedStatus) p.set("status", selectedStatus);
    if (selectedYears.size > 0)
      p.set("year", Array.from(selectedYears).join(","));
    if (selectedMonths.size > 0)
      p.set("month", Array.from(selectedMonths).join(","));
    return p;
  }, [debouncedQuery, selectedSubjects, selectedStatus, selectedYears, selectedMonths]);

  const searchUrl = params.toString()
    ? `${API_GET_COURSES}?${params.toString()}`
    : API_GET_COURSES;

  const { data, loading, error } = useGet({ url: searchUrl });
  const courses = useMemo(() => data || [], [data]);

  // Fetch the full, unfiltered course list so year/month filter tags always remain visible
  // regardless of other active filters.
  const { data: allCoursesData } = useGet({ url: API_GET_COURSES });
  const allCourses = useMemo(() => allCoursesData || [], [allCoursesData]);

  const [sortBy, setSortBy] = useState(() => {
    if (typeof window === "undefined") return "lastRead";
    return window.localStorage.getItem("coursesSort") || "lastRead";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("coursesSort", sortBy);
    }
  }, [sortBy]);

  const sortedCourses = useMemo(() => {
    const sorted = [...courses];
    switch (sortBy) {
      case "title":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "created":
        sorted.sort((a, b) => {
          const aDate = a.createdAt ? new Date(a.createdAt) : new Date(0);
          const bDate = b.createdAt ? new Date(b.createdAt) : new Date(0);
          return bDate - aDate;
        });
        break;
      case "lastRead":
      default:
        sorted.sort((a, b) => {
          const aDate = a.lastReadAt
            ? new Date(a.lastReadAt)
            : a.createdAt
              ? new Date(a.createdAt)
              : new Date(0);
          const bDate = b.lastReadAt
            ? new Date(b.lastReadAt)
            : b.createdAt
              ? new Date(b.createdAt)
              : new Date(0);
          return bDate - aDate;
        });
        break;
    }
    return sorted;
  }, [courses, sortBy]);

  useEffect(() => {
    if (error) {
      showToast({ type: "danger", message: String(error) });
    }
  }, [error, showToast]);

  const availableYears = useMemo(() => {
    const years = new Set();
    allCourses.forEach((c) => {
      const d = c.createdAt ? new Date(c.createdAt) : null;
      if (d && !isNaN(d)) years.add(d.getFullYear());
    });
    return Array.from(years).sort((a, b) => a - b);
  }, [allCourses]);

  const toggleInSet = (set, setFn, value) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setFn(next);
  };

  const toggleStatus = (value) => {
    setSelectedStatus((prev) => (prev === value ? "" : value));
  };

  const hasFilters =
    debouncedQuery ||
    selectedSubjects.size > 0 ||
    selectedStatus ||
    selectedYears.size > 0 ||
    selectedMonths.size > 0;

  const clearFilters = () => {
    setQuery("");
    setDebouncedQuery("");
    setSelectedSubjects(new Set());
    setSelectedStatus("");
    setSelectedYears(new Set());
    setSelectedMonths(new Set());
  };

  return (
    <section>
      <div className='mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
        <div>
          <h1 className='mb-1 text-2xl font-bold text-dr-text'>Courses</h1>
          <p className='text-sm text-dr-text-muted'>
            Every topic you have researched so far.
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <span className='text-sm text-dr-text-muted'>Sort by</span>
          <Select
            value={sortBy}
            onChange={(val) => setSortBy(val)}
            options={[
              { value: "lastRead", label: "Last read" },
              { value: "title", label: "Title" },
              { value: "created", label: "Date created" },
            ]}
            className='min-w-[9rem]'
          />
        </div>
      </div>

      <div className='mb-4'>
        <Input
          placeholder='Search courses by title...'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className='mb-6 flex flex-wrap items-center gap-2'>
        {subjects.map((subject) => {
          const selected = selectedSubjects.has(subject.id);
          return (
            <button
              key={subject.id}
              type='button'
              onClick={() => toggleInSet(selectedSubjects, setSelectedSubjects, subject.id)}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                selected
                  ? ""
                  : "border-dr-border bg-dr-surface text-dr-text hover:border-dr-text-muted"
              }`}
              style={
                selected
                  ? {
                      backgroundColor: subject.color,
                      borderColor: subject.color,
                      color: "#fff",
                    }
                  : {}
              }
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full border-2 ${
                  selected ? "border-white bg-white" : "bg-transparent"
                }`}
                style={selected ? {} : { borderColor: subject.color }}
              />
              {subject.name}
            </button>
          );
        })}

        {["complete", "incomplete"].map((status) => {
          const selected = selectedStatus === status;
          return (
            <button
              key={status}
              type='button'
              onClick={() => toggleStatus(status)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium capitalize transition-all ${
                selected
                  ? "border-dr-accent bg-dr-accent-light text-dr-accent"
                  : "border-dr-border bg-dr-surface text-dr-text-muted hover:border-dr-text-muted"
              }`}
            >
              {status}
            </button>
          );
        })}

        {availableYears.map((year) => (
          <button
            key={year}
            type='button'
            onClick={() => toggleInSet(selectedYears, setSelectedYears, year)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
              selectedYears.has(year)
                ? "border-dr-accent bg-dr-accent-light text-dr-accent"
                : "border-dr-border bg-dr-surface text-dr-text-muted hover:border-dr-text-muted"
            }`}
          >
            {year}
          </button>
        ))}

        {MONTHS.map((month) => (
          <button
            key={month.value}
            type='button'
            onClick={() => toggleInSet(selectedMonths, setSelectedMonths, month.value)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
              selectedMonths.has(month.value)
                ? "border-dr-accent bg-dr-accent-light text-dr-accent"
                : "border-dr-border bg-dr-surface text-dr-text-muted hover:border-dr-text-muted"
            }`}
          >
            {month.label}
          </button>
        ))}

        {hasFilters && (
          <button
            type='button'
            onClick={clearFilters}
            className='rounded-full border border-dr-border px-3 py-1.5 text-sm font-medium text-dr-text-muted transition-all hover:border-dr-danger hover:text-dr-danger'
          >
            Clear
          </button>
        )}
      </div>

      {loading && (
        <div className='flex justify-center py-20'>
          <Loading size={40} />
        </div>
      )}

      {!loading && courses.length === 0 && (
        <p className='py-20 text-center text-dr-text-muted'>
          No courses yet. Research a topic to get started.
        </p>
      )}

      {!loading && courses.length > 0 && (
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {sortedCourses.map((course, index) => (
            <Link
              key={course.id}
              to={`${ROUTE_LEARN}/${encodeURIComponent(course.id)}`}
              className='group flex flex-col gap-3 rounded-2xl border border-dr-border bg-dr-surface p-4 transition-colors hover:border-dr-accent'
            >
              {course.coverImagePath ? (
                <Thumbnail
                  src={course.coverImagePath}
                  alt={course.name}
                  className='h-28 w-full rounded-xl'
                />
              ) : (
                <div
                  className={`flex h-28 items-center justify-center rounded-xl text-3xl ${
                    TINTS[index % TINTS.length]
                  }`}
                >
                  <ion-icon name='book-outline'></ion-icon>
                </div>
              )}
              <div className='flex items-center justify-between gap-2'>
                <span className='font-semibold text-dr-text line-clamp-2'>
                  {course.name}
                </span>
                <ion-icon
                  name='arrow-forward-outline'
                  className='shrink-0 text-dr-text-muted transition-colors group-hover:text-dr-accent'
                ></ion-icon>
              </div>

              <div className='flex flex-col gap-0.5 text-xs text-dr-text-muted'>
                <span>Created: {formatLocalTime(course.createdAt)}</span>
                {course.lastReadAt && (
                  <span>Last read: {formatLocalTime(course.lastReadAt)}</span>
                )}
                {course.completedAt && (
                  <span className='text-dr-success'>
                    Completed: {formatLocalTime(course.completedAt)}
                  </span>
                )}
              </div>

              {course.totalChapters > 0 && (
                <div className='mt-2'>
                  {course.readChapters === course.totalChapters ? (
                    <div className='flex items-center gap-1.5 text-sm text-dr-success'>
                      <ion-icon name='checkmark-circle'></ion-icon>
                      <span className='font-medium'>Read</span>
                    </div>
                  ) : (
                    <>
                      <div className='mb-1 flex items-center justify-between text-xs text-dr-text-muted'>
                        <span>Progress</span>
                        <span>
                          {course.readChapters} of {course.totalChapters}
                        </span>
                      </div>
                      <div className='h-1.5 w-full overflow-hidden rounded-full bg-dr-border'>
                        <div
                          className='h-full rounded-full bg-dr-accent'
                          style={{
                            width: `${Math.round(
                              (course.readChapters / course.totalChapters) * 100,
                            )}%`,
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {course.subjects && course.subjects.length > 0 && (
                <div className='mt-2 flex flex-wrap items-center gap-1.5'>
                  {course.subjects.map((subject) => (
                    <span
                      key={subject.id}
                      title={subject.name}
                      className='inline-block h-2.5 w-2.5 rounded-full'
                      style={{ backgroundColor: subject.color }}
                    />
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
};
