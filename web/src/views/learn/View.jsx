import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { marked } from "marked";
import { Button, Loading, Thumbnail } from "@ds";
import {
  API_GET_TOPIC,
  API_POST_CHAPTER_IMAGE,
  API_GET_READING_PROGRESS,
  API_POST_READING_PROGRESS,
  API_GET_SUBJECTS,
  API_GET_COURSE_SUBJECTS,
  API_POST_COURSE_SUBJECTS,
  ROUTE_HOME,
} from "@constants";
import { splitChapters } from "./splitChapters";
import { useAppContext } from "../../views/context/appContextProvider";

// turns a chapter title into a DOM id that can be used as an anchor target
const chapterSlug = (title) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/* *************************************************************************************************
 * Renders the assembled markdown research for a single topic, split into chapters so each chapter
 * heading can carry a "Create summary image" button. Clicking the button asks the backend to
 * generate a summarizing image and returns the updated content, which is re-rendered in place.
 * *************************************************************************************************
 */
export const LearnView = () => {
  const { topic } = useParams();
  const navigate = useNavigate();
  const { showToast } = useAppContext();

  const [content, setContent] = useState("");
  const [coverImagePath, setCoverImagePath] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // titles of chapters whose images are currently being generated
  const [generating, setGenerating] = useState(new Set());
  // titles of chapters that have been marked as read
  const [readChapters, setReadChapters] = useState(new Set());
  // all available subjects and the ids currently assigned to this course
  const [subjects, setSubjects] = useState([]);
  const [courseSubjectIds, setCourseSubjectIds] = useState(new Set());

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [topicRes, progressRes, subjectsRes, courseSubjectsRes] =
          await Promise.all([
            fetch(`${API_GET_TOPIC}?name=${encodeURIComponent(topic)}`, {
              signal: controller.signal,
            }),
            fetch(
              `${API_GET_READING_PROGRESS}?course=${encodeURIComponent(topic)}`,
              { signal: controller.signal },
            ),
            fetch(API_GET_SUBJECTS, { signal: controller.signal }),
            fetch(
              `${API_GET_COURSE_SUBJECTS}?course=${encodeURIComponent(topic)}`,
              { signal: controller.signal },
            ),
          ]);
        const topicResult = await topicRes.json();
        const progressResult = await progressRes.json();
        const subjectsResult = await subjectsRes.json();
        const courseSubjectsResult = await courseSubjectsRes.json();

        if (topicResult.error) setError(topicResult.error);
        else {
          setContent(topicResult.data?.content || "");
          setCoverImagePath(topicResult.data?.coverImagePath || "");
        }

        if (progressResult.data && Array.isArray(progressResult.data)) {
          setReadChapters(new Set(progressResult.data));
        }

        if (subjectsResult.data && Array.isArray(subjectsResult.data)) {
          setSubjects(subjectsResult.data);
        }

        if (courseSubjectsResult.data && Array.isArray(courseSubjectsResult.data)) {
          setCourseSubjectIds(
            new Set(courseSubjectsResult.data.map((s) => s.id)),
          );
        }
      } catch (err) {
        if (err.name !== "AbortError")
          setError(err.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [topic]);

  const createImage = async (chapter) => {
    setGenerating((prev) => new Set(prev).add(chapter));
    setError(null);
    try {
      const res = await fetch(API_POST_CHAPTER_IMAGE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, chapter }),
      });
      const result = await res.json();
      if (result.errors || !result.success) {
        const message = result.errors || "Failed to create summary image";
        setError(message);
        showToast({
          type: "danger",
          message: String(message),
        });
      } else {
        const newContent = result.data?.content;
        if (newContent) setContent(newContent);
        showToast({
          type: "success",
          message: `Summary image created for "${chapter}"`,
        });
      }
    } catch (err) {
      const message = err.message || "Something went wrong";
      setError(message);
      showToast({
        type: "danger",
        message: message,
      });
    } finally {
      setGenerating((prev) => {
        const next = new Set(prev);
        next.delete(chapter);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className='flex justify-center py-20'>
        <Loading size={40} />
      </div>
    );
  }

  if (error) {
    return <p className='py-20 text-center text-dr-danger'>{String(error)}</p>;
  }

  const { intro, chapters } = splitChapters(content);

  const toggleRead = async (chapter) => {
    const nextRead = !readChapters.has(chapter);
    setReadChapters((prev) => {
      const next = new Set(prev);
      if (nextRead) next.add(chapter);
      else next.delete(chapter);
      return next;
    });
    try {
      await fetch(API_POST_READING_PROGRESS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course: topic, chapter, read: nextRead }),
      });
    } catch (err) {
      showToast({
        type: "danger",
        message: err.message || "Failed to save reading progress",
      });
      // revert on error
      setReadChapters((prev) => {
        const next = new Set(prev);
        if (nextRead) next.delete(chapter);
        else next.add(chapter);
        return next;
      });
    }
  };

  const scrollToChapter = (title) => {
    const id = chapterSlug(title);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const progress = chapters.length
    ? Math.round((readChapters.size / chapters.length) * 100)
    : 0;

  const toggleSubject = async (subjectId) => {
    const nextIds = new Set(courseSubjectIds);
    if (nextIds.has(subjectId)) {
      nextIds.delete(subjectId);
    } else {
      nextIds.add(subjectId);
    }
    setCourseSubjectIds(nextIds);
    try {
      await fetch(API_POST_COURSE_SUBJECTS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course: topic,
          subjectIds: Array.from(nextIds),
        }),
      });
    } catch (err) {
      showToast({
        type: "danger",
        message: err.message || "Failed to update subjects",
      });
      // revert on error
      const reverted = new Set(courseSubjectIds);
      if (reverted.has(subjectId)) {
        reverted.delete(subjectId);
      } else {
        reverted.add(subjectId);
      }
      setCourseSubjectIds(reverted);
    }
  };

  return (
    <div className='flex items-start gap-8'>
      <div className='min-w-0 flex-1 max-w-[800px] px-4 py-8'>
        <Button secondary className='mb-6' onClick={() => navigate(ROUTE_HOME)}>
          <ion-icon name='arrow-back-outline'></ion-icon>
          <span className='ml-2'>Back</span>
        </Button>

        {coverImagePath && (
          <Thumbnail
            src={coverImagePath}
            alt={topic}
            className='mb-6 h-48 w-full rounded-2xl'
          />
        )}

        {chapters.length > 0 && (
          <div className='mb-6 rounded-2xl border border-dr-border bg-dr-surface p-4'>
            <div className='mb-2 flex items-center justify-between text-sm'>
              <span className='font-semibold text-dr-text'>Reading progress</span>
              <span className='text-dr-text-muted'>
                {readChapters.size} of {chapters.length} chapters ({progress}%)
              </span>
            </div>
            <div className='h-2 w-full overflow-hidden rounded-full bg-dr-border'>
              <div
                className='h-full rounded-full bg-dr-accent transition-all'
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {intro && (
          <div
            className='research-content'
            dangerouslySetInnerHTML={{ __html: marked.parse(intro) }}
          />
        )}

        {chapters.map((chapter) => {
          const isGenerating = generating.has(chapter.title);
          return (
            <section
              key={chapter.title}
              id={chapterSlug(chapter.title)}
              className='mt-8 scroll-mt-6'
            >
              {/* chapter heading with its summary image action */}
              <div className='mb-3 flex items-start justify-between gap-4'>
                <h2 className='text-xl font-bold text-dr-text'>
                  {chapter.title}
                </h2>
                <div className='flex shrink-0 items-center gap-2'>
                  <button
                    type='button'
                    onClick={() => toggleRead(chapter.title)}
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                      readChapters.has(chapter.title)
                        ? "border-dr-success bg-dr-success/10 text-dr-success"
                        : "border-dr-border bg-dr-surface text-dr-text-muted hover:bg-dr-surface-light hover:text-dr-text"
                    }`}
                  >
                    <ion-icon
                      name={
                        readChapters.has(chapter.title)
                          ? "checkmark-circle"
                          : "ellipse-outline"
                      }
                    ></ion-icon>
                    <span>Read</span>
                  </button>
                  <Button
                    secondary
                    className='shrink-0 text-sm'
                    disabled={isGenerating}
                    onClick={() => createImage(chapter.title)}
                  >
                    {isGenerating ? (
                      <Loading size={18} />
                    ) : (
                      <>
                        <ion-icon name='image-outline'></ion-icon>
                        <span className='ml-2'>Create summary image</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <div
                className='research-content'
                dangerouslySetInnerHTML={{ __html: marked.parse(chapter.body) }}
              />
            </section>
          );
        })}
      </div>

      <div className='sticky top-6 mt-8 hidden w-64 shrink-0 lg:block'>
        {chapters.length > 0 && (
          <div className='rounded-2xl border border-dr-border bg-dr-surface p-4'>
            <h3 className='mb-3 text-xs font-semibold uppercase tracking-wide text-dr-text-muted'>
              Chapters
            </h3>
            <ul className='flex flex-col gap-1'>
              {chapters.map((chapter) => (
                <li key={chapter.title}>
                  <button
                    type='button'
                    onClick={() => scrollToChapter(chapter.title)}
                    className='w-full rounded-lg px-2 py-1.5 text-left text-sm text-dr-text-muted transition-colors hover:bg-dr-surface-light hover:text-dr-text'
                  >
                    {chapter.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {subjects.length > 0 && (
          <div className='mt-4 rounded-2xl border border-dr-border bg-dr-surface p-4'>
            <h3 className='mb-3 text-xs font-semibold uppercase tracking-wide text-dr-text-muted'>
              Subjects
            </h3>
            <ul className='flex flex-col gap-2'>
              {subjects.map((subject) => {
                const checked = courseSubjectIds.has(subject.id);
                return (
                  <li key={subject.id}>
                    <label className='flex cursor-pointer items-center gap-2 text-sm text-dr-text'>
                      <input
                        type='checkbox'
                        checked={checked}
                        onChange={() => toggleSubject(subject.id)}
                        className='h-4 w-4 rounded border-dr-border accent-dr-accent'
                      />
                      <span
                        className='inline-block h-2.5 w-2.5 rounded-full'
                        style={{ backgroundColor: subject.color }}
                      />
                      <span className='line-clamp-1'>{subject.name}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
