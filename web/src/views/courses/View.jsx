import { Link } from "react-router-dom";
import { Loading } from "@ds";
import { API_GET_COURSES, ROUTE_LEARN } from "@constants";
import { useGet } from "@utils";

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
  const { data, loading, error } = useGet({ url: API_GET_COURSES });
  const courses = data || [];

  return (
    <section>
      <h1 className='mb-1 text-2xl font-bold text-dr-text'>Courses</h1>
      <p className='mb-6 text-sm text-dr-text-muted'>
        Every topic you have researched so far.
      </p>

      {loading && (
        <div className='flex justify-center py-20'>
          <Loading size={40} />
        </div>
      )}

      {error && (
        <p className='py-20 text-center text-dr-danger'>{String(error)}</p>
      )}

      {!loading && !error && courses.length === 0 && (
        <p className='py-20 text-center text-dr-text-muted'>
          No courses yet. Research a topic to get started.
        </p>
      )}

      {!loading && !error && courses.length > 0 && (
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {courses.map((course, index) => (
            <Link
              key={course.id}
              to={`${ROUTE_LEARN}/${encodeURIComponent(course.id)}`}
              className='group flex flex-col gap-3 rounded-2xl border border-dr-border bg-dr-surface p-4 transition-colors hover:border-dr-accent'
            >
              <div
                className={`flex h-28 items-center justify-center rounded-xl text-3xl ${
                  TINTS[index % TINTS.length]
                }`}
              >
                <ion-icon name='book-outline'></ion-icon>
              </div>
              <div className='flex items-center justify-between gap-2'>
                <span className='font-semibold text-dr-text line-clamp-2'>
                  {course.name}
                </span>
                <ion-icon
                  name='arrow-forward-outline'
                  className='shrink-0 text-dr-text-muted transition-colors group-hover:text-dr-accent'
                ></ion-icon>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
};
