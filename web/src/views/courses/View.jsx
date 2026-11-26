import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Loading,
  Input,
  Select,
  Thumbnail,
  Tooltip,
  ConfirmationModal,
  Button,
} from "@ds";
import {
  API_GET_COURSES,
  API_DELETE_COURSE,
  API_GET_SUBJECTS,
  API_GET_SHARED_COURSES,
  API_POST_COURSE_LEAVE,
  ROUTE_CREATE,
  lessonPath,
  isVirtualSource,
} from "@constants";
import { useGet, formatLocalTime } from "@utils";
import { useAppContext } from "@views/context/appContextProvider";
import { FilterDropdowns } from "../FilterDropdowns";
import { useStoredFilters } from "../useStoredFilters";

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

const LANGUAGE_FLAGS = {
  english: "🇬🇧",
  spanish: "🇪🇸",
  italian: "🇮🇹",
  german: "🇩🇪",
  "koine greek": "🇬🇷",
};

// Badge shown on each course card indicating how the lesson was created.
const SOURCE_BADGES = { ai: "AI", doc: "PDF", web: "Web" };

const languageFlag = (language) => {
  if (!language) return null;
  return LANGUAGE_FLAGS[language.toLowerCase()] || "🏳️";
};

const ReadingProgress = ({ course }) => {
  const virtual = isVirtualSource(course.source);
  const percent = virtual ? (course.checkpointPercent ?? 0) : course.totalChapters > 0
    ? Math.round(course.readChapters * 100 / course.totalChapters)
    : 0;

  return (
    <div className='mt-2'>
      <div className='mb-1 flex items-center justify-between text-xs text-dr-text-muted'>
        <span>Reading progress</span>
        <span className='font-semibold tabular-nums'>{percent}%</span>
      </div>
      <div role='progressbar' aria-label='Reading progress' aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
        className='h-1.5 w-full overflow-hidden rounded-full bg-dr-border'>
        <div className={`h-full rounded-full ${percent === 100 ? "bg-dr-success" : "bg-dr-accent"}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};

/* *************************************************************************************************
 * A single course card, shared by the All and Shared tabs. Cards of courses shared with the
 * caller (role "collaborator") show the owner and a Leave action instead of Delete; the caller's
 * own shared courses carry a small people marker.
 * *************************************************************************************************
 */
const CourseCard = ({ course, index, onDelete, onLeave, sharedMarker }) => (
  <div className='group relative flex flex-col gap-3 rounded-2xl border border-dr-border bg-dr-surface p-4 transition-colors hover:border-dr-accent'>
    <Link
      to={lessonPath(course.id, course.source)}
      className='flex flex-col gap-3'
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
        <span className='flex min-w-0 items-center gap-2 font-semibold text-dr-text'>
          {course.language && (
            <span className='shrink-0' title={course.language}>{languageFlag(course.language)}</span>
          )}
          <Tooltip hoverTrigger={course.name} className='min-w-0'>
            {course.name}
          </Tooltip>
        </span>
        <span className='flex shrink-0 items-center gap-1.5'>
          {sharedMarker && (
            <span
              className='flex items-center text-dr-text-muted'
              title='Shared with collaborators'
            >
              <ion-icon name='people-outline'></ion-icon>
            </span>
          )}
          <span className='rounded-full border border-dr-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-dr-text-muted'>
            {SOURCE_BADGES[course.source] || "AI"}
          </span>
        </span>
      </div>

      {course.role === "collaborator" && course.owner && (
        <span className='text-xs text-dr-text-muted'>by @{course.owner}</span>
      )}

      <div className='flex flex-col gap-0.5 text-xs text-dr-text-muted'>
        <span>Created: {formatLocalTime(course.createdAt)}</span>

        {!isVirtualSource(course.source) && !(course.totalChapters > 0 && course.readChapters === course.totalChapters) && (
          <span>
            Last read:{" "}
            {course.lastReadAt
              ? formatLocalTime(course.lastReadAt)
              : "Not started"}
          </span>
        )}

        {!isVirtualSource(course.source) && course.completedAt && (
          <span className='text-dr-success'>
            Completed: {formatLocalTime(course.completedAt)}
          </span>
        )}
      </div>

      <ReadingProgress course={course} />

      {course.subjects && course.subjects.length > 0 ? (
        <div className='mt-2 flex flex-wrap items-center gap-1.5'>
          {course.subjects.map((subject) => (
            <div
              key={subject.id}
              className='flex flex-wrap items-center gap-1.5'
            >
              <span
                title={subject.name}
                className='inline-block h-2.5 w-2.5 rounded-full'
                style={{ backgroundColor: subject.color }}
              />
              <span>{subject.name}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className='flex flex-wrap items-center gap-1.5'>
          <span className='inline-block h-2.5 w-2.5 rounded-full bg-gray-200' />
          <span>General</span>
        </div>
      )}
    </Link>

    {onLeave ? (
      <Button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onLeave(course);
        }}
        className=''
        secondary
      >
        <ion-icon name='exit-outline' className='text-lg' />
        Leave
      </Button>
    ) : (
      <Button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete(course);
        }}
        className=''
        danger
      >
        <ion-icon name='trash-outline' className='text-lg' />
        Delete
      </Button>
    )}
  </div>
);

/* *************************************************************************************************
 * Lists every researched topic stored in the backend data directory as a grid of course cards,
 * each linking to its assembled markdown at /learn/:courseId.
 * *************************************************************************************************
 */
export const CoursesView = ({ virtuals = false }) => {
  const { showToast } = useAppContext();
  const library = virtuals ? "virtuals" : "courses";
  const createLabel = virtuals ? "Import a Virtual" : "Create a course";
  const {
    query, setQuery, debouncedQuery,
    selectedSubjects, setSelectedSubjects,
    selectedStatus, setSelectedStatus,
    selectedYears, setSelectedYears,
    selectedMonths, setSelectedMonths,
    hasFilters, clearFilters,
  } = useStoredFilters(`zapohteh-${library}-filters`);

  const { data: subjectsData } = useGet({ url: API_GET_SUBJECTS });
  const subjects = subjectsData || [];

  const params = useMemo(() => {
    const p = new URLSearchParams({ library });
    if (debouncedQuery) p.set("search", debouncedQuery);
    if (selectedSubjects.size > 0)
      p.set("subjects", Array.from(selectedSubjects).join(","));
    if (!virtuals && selectedStatus) p.set("status", selectedStatus);
    if (selectedYears.size > 0)
      p.set("year", Array.from(selectedYears).join(","));
    if (selectedMonths.size > 0)
      p.set("month", Array.from(selectedMonths).join(","));
    return p;
  }, [
    debouncedQuery,
    selectedSubjects,
    selectedStatus,
    selectedYears,
    selectedMonths,
    library,
    virtuals,
  ]);

  const searchUrl = params.toString()
    ? `${API_GET_COURSES}?${params.toString()}`
    : API_GET_COURSES;

  const {
    data,
    loading,
    error,
    refetch: refetchCourses,
  } = useGet({
    url: searchUrl,
  });
  const courses = useMemo(() => data || [], [data]);

  // Fetch the full, unfiltered course list so year options remain available
  // regardless of other active filters.
  const { data: allCoursesData, refetch: refetchAllCourses } = useGet({
    url: `${API_GET_COURSES}?library=${library}`,
  });
  const allCourses = useMemo(() => allCoursesData || [], [allCoursesData]);

  const [courseToDelete, setCourseToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // "all" lists every own course with filters; "shared" lists the courses that
  // involve collaborators (mine with accepted collaborators + shared with me)
  const [activeTab, setActiveTab] = useState("all");

  const {
    data: sharedData,
    loading: sharedLoading,
    error: sharedError,
    refetch: refetchShared,
  } = useGet({ url: `${API_GET_SHARED_COURSES}?library=${library}`, avoidFirstFetch: true });
  const sharedCourses = useMemo(() => sharedData || [], [sharedData]);

  // fetch the shared list the first time the Shared tab is opened
  useEffect(() => {
    if (activeTab === "shared") refetchShared();
  }, [activeTab, refetchShared]);

  useEffect(() => {
    if (sharedError) {
      showToast({ type: "danger", message: String(sharedError) });
    }
  }, [sharedError, showToast]);

  // Removes the caller's own collaboration from a course shared with them.
  const leaveCourse = async (course) => {
    try {
      const response = await fetch(
        `${API_POST_COURSE_LEAVE}/${encodeURIComponent(course.id)}/leave`,
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + localStorage.getItem("auth"),
          },
        },
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.errors || result.error || "Failed to leave course");
      }
      showToast({ type: "success", message: "Left course" });
      refetchShared();
    } catch (err) {
      showToast({ type: "danger", message: err.message });
    }
  };

  const [sortBy, setSortBy] = useState(() => {
    const defaultSort = virtuals ? "created" : "lastRead";
    if (typeof window === "undefined") return defaultSort;
    const stored = window.localStorage.getItem(virtuals ? "virtualsSort" : "coursesSort");
    return virtuals && stored === "lastRead" ? defaultSort : stored || defaultSort;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(virtuals ? "virtualsSort" : "coursesSort", sortBy);
    }
  }, [sortBy, virtuals]);

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

  const handleDelete = async () => {
    if (!courseToDelete) return;
    setIsDeleting(true);
    try {
      const response = await fetch(
        `${API_DELETE_COURSE}/${encodeURIComponent(courseToDelete.id)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: "Bearer " + localStorage.getItem("auth"),
          },
        },
      );
      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error || "Failed to delete course");
      }
      showToast({ type: "success", message: "Course deleted" });
      refetchCourses();
      refetchAllCourses();
      // keep the shared list in sync when deleting from the Shared tab
      if (sharedData) refetchShared();
    } catch (err) {
      showToast({ type: "danger", message: err.message });
    } finally {
      setIsDeleting(false);
      setCourseToDelete(null);
    }
  };

  return (
    <section>
      <div className='mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
        <div>
          <div className='mb-1 flex items-center gap-2'>
            <h1 className='text-2xl font-bold text-dr-text'>{virtuals ? "Virtuals" : "Courses"}</h1>
            <Link
              to={`${ROUTE_CREATE}?type=${library}`}
              aria-label={createLabel}
              title={createLabel}
              className='flex h-8 w-8 items-center justify-center rounded-lg text-dr-accent transition-colors hover:bg-dr-accent-light focus-visible:outline-2 focus-visible:outline-dr-accent'
            >
              <ion-icon name='add-outline' className='text-2xl' aria-hidden='true' />
            </Link>
          </div>
          <p className='text-sm text-dr-text-muted'>
            {virtuals ? "Read and annotate your imported PDFs and web articles." : "Your AI-generated lessons."}
          </p>
        </div>
        {activeTab === "all" && (
          <div className='flex items-center gap-2'>
            <span className='text-sm text-dr-text-muted'>Sort by</span>
            <Select
              value={sortBy}
              onChange={(val) => setSortBy(val)}
              options={[
                ...(!virtuals ? [{ value: "lastRead", label: "Last read" }] : []),
                { value: "title", label: "Title" },
                { value: "created", label: "Date created" },
              ]}
              className='min-w-[9rem]'
            />
          </div>
        )}
      </div>

      {/* All / Shared tab pills */}
      <div className='mb-6 flex gap-3'>
        {[
          { value: "all", label: "All" },
          { value: "shared", label: "Shared" },
        ].map((tab) => (
          <button
            key={tab.value}
            type='button'
            onClick={() => setActiveTab(tab.value)}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? "border-dr-accent bg-dr-accent-light text-dr-accent"
                : "border-dr-border text-dr-text-muted hover:border-dr-accent/50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "shared" && (
        <>
          {sharedLoading && (
            <div className='flex justify-center py-20'>
              <Loading size={40} />
            </div>
          )}

          {!sharedLoading && sharedCourses.length === 0 && (
            <p className='py-20 text-center text-dr-text-muted'>
              No shared lessons yet. Invite collaborators from a lesson page, or
              accept an invitation from the notifications bell.
            </p>
          )}

          {!sharedLoading && sharedCourses.length > 0 && (
            <div className='grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4'>
              {sharedCourses.map((course, index) => (
                <CourseCard
                  key={`${course.role || "owner"}-${course.id}`}
                  course={course}
                  index={index}
                  sharedMarker={course.role === "owner"}
                  onDelete={
                    course.role === "owner"
                      ? (c) => setCourseToDelete(c)
                      : undefined
                  }
                  onLeave={
                    course.role === "collaborator" ? leaveCourse : undefined
                  }
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "all" && (
        <>
      <div className='mb-4'>
        <Input
          placeholder={virtuals ? "Search Virtuals by title..." : "Search courses by title..."}
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
        showStatus={!virtuals}
        setSelectedStatus={setSelectedStatus}
        selectedYears={selectedYears}
        setSelectedYears={setSelectedYears}
        selectedMonths={selectedMonths}
        setSelectedMonths={setSelectedMonths}
        hasFilters={hasFilters}
        clearFilters={clearFilters}
      />

      {loading && (
        <div className='flex justify-center py-20'>
          <Loading size={40} />
        </div>
      )}

      {!loading && courses.length === 0 && (
        <p className='py-20 text-center text-dr-text-muted'>
          {virtuals ? "No Virtuals found. Import a PDF or web article to get started." : "No courses found. Research a topic to get started."}
        </p>
      )}

      {!loading && courses.length > 0 && (
        <div className='grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4'>
          {sortedCourses.map((course, index) => (
            <CourseCard
              key={course.id}
              course={course}
              index={index}
              onDelete={(c) => setCourseToDelete(c)}
            />
          ))}
        </div>
      )}
        </>
      )}

      <ConfirmationModal
        open={!!courseToDelete}
        onClose={() => setCourseToDelete(null)}
        onConfirm={handleDelete}
        title={virtuals ? "Delete Virtual" : "Delete course"}
        message={
          courseToDelete
            ? `Are you sure you want to delete "${courseToDelete.name}"? This action cannot be undone.`
            : ""
        }
        confirmText='Delete'
        cancelText='Cancel'
        confirmVariant='danger'
        isLoading={isDeleting}
      />
    </section>
  );
};
