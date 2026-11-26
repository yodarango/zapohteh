import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Input, Loading, Switch, TextArea } from "@ds";
import {
  API_COURSE_JOBS,
  API_GET_SUBJECTS,
  lessonPath,
  isVirtualSource,
} from "@constants";
import { useGet } from "@utils";
import { readStoredJSON, removeStoredItem, writeStoredJSON } from "@utils/localStorage";
import { useAppContext } from "@views/context/appContextProvider";

const FORM_STATE_KEY = "zapohteh-lesson-form";

// Available research depth levels for a topic
const RESEARCH_LEVELS = [
  { value: "low", label: "Low", icon: "cafe-outline" },
  { value: "medium", label: "Medium", icon: "search-outline" },
  { value: "high", label: "High", icon: "flask-outline" },
];

const LANGUAGES = ["English", "Italian", "Spanish", "German"];

const WRITING_STYLES = [
  { value: "academic", label: "Academic" },
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
];

const STEPS = [
  { label: "Craft Chapters", key: "chapters" },
  { label: "Research Chapters", key: "research" },
  { label: "Create Thumbnail", key: "thumbnail" },
];

// Lesson creation modes: AI research, PDF document import or web article import
const MODES = [
  { value: "ai", label: "AI", icon: "sparkles-outline" },
  { value: "pdf", label: "PDF", icon: "document-text-outline" },
  { value: "url", label: "URL", icon: "link-outline" },
];

// Progress steps shown while importing a document or article; AI mode uses STEPS
const IMPORT_STEPS = [
  { label: "Extract Content", key: "extract" },
  { label: "Save Lesson", key: "save" },
  { label: "Create Thumbnail", key: "thumbnail" },
];

function currentJobStep(job) {
  if (job.status === "succeeded") return 3;
  if (job.phase === "thumbnail") return 2;
  if (job.phase === "research" || (job.source !== "ai" && ["reserve", "chapters"].includes(job.phase))) return 1;
  return 0;
}

// This project does not use the prop-types package.
/* eslint-disable react/prop-types */
function CourseJobs({ jobs, error, navigate }) {
  return (
    <div className='mt-8'>
      <h2 className='text-lg font-semibold text-dr-text'>Course creation</h2>
      {error && <p className='mt-2 text-sm text-dr-danger'>{error}</p>}
      {!error && jobs.length === 0 && <p className='mt-2 text-sm text-dr-text-muted'>No recent creation jobs.</p>}
      <div className='mt-3 flex flex-col gap-4'>
        {jobs.map((job) => {
          const active = job.status === "queued" || job.status === "running";
          const running = job.status === "running";
          const failed = job.status === "failed" || job.status === "interrupted";
          const steps = job.source === "ai" ? STEPS : IMPORT_STEPS;
          const step = currentJobStep(job);
          return (
            <div key={job.id} className='rounded-xl border border-dr-border p-4'>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <h3 className='font-semibold text-dr-text'>{job.courseTitle || job.title || "Imported lesson"}</h3>
                <span className='text-sm capitalize text-dr-text-muted'>{job.status}</span>
              </div>
              <div className='relative mt-6' aria-label='Course creation progress'>
                <div aria-hidden='true' className='absolute left-0 right-0 top-4 flex px-[16.6667%]'>
                  {steps.slice(0, -1).map((item, index) => (
                    <div key={item.key} className={`h-0.5 flex-1 ${index < step - 1 ? "bg-dr-success" : "bg-dr-border"}`} />
                  ))}
                </div>
                <ol className='relative flex items-start justify-between'>
                  {steps.map((item, index) => {
                    const isActive = running && index === step;
                    const isCompleted = index < step;
                    const isError = (failed && index === step) || (job.warning && index === steps.length - 1);
                    const status = isError ? (job.warning && index === steps.length - 1 ? "thumbnail failed" : job.status) : isCompleted ? "completed" : isActive ? "in progress" : "pending";
                    return (
                      <li key={item.key} aria-current={isActive ? "step" : undefined} className='flex min-w-0 flex-1 flex-col items-center gap-2'>
                        <div aria-hidden='true' className={`relative flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                          isError ? "bg-dr-danger text-white" : isCompleted ? "bg-dr-success text-white" : isActive ? "animate-pulse bg-dr-accent text-white" : "border border-dr-border bg-dr-surface text-dr-text-muted"
                        }`}>
                          {isError ? <ion-icon name='close-outline'></ion-icon> : isCompleted ? <ion-icon name='checkmark-outline'></ion-icon> : index + 1}
                        </div>
                        <span className={`text-center text-xs font-medium ${isError || isActive || isCompleted ? "text-dr-text" : "text-dr-text-muted"}`}>
                          {item.label}<span className='sr-only'>: {status}</span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
              {active && job.detail && <p className='mt-2 text-xs text-dr-text-muted'>{job.detail}</p>}
              {job.chapters?.length > 0 && (
                <ul className='mt-3 flex flex-col gap-1 text-sm'>
                  {job.chapters.map((chapter, index) => (
                    <li key={`${index}-${chapter}`} className={index < job.completed.length ? "text-dr-success" : "text-dr-text-muted"}>
                      <ion-icon name={index < job.completed.length ? "checkmark-circle" : "ellipse-outline"}></ion-icon> {chapter}
                    </li>
                  ))}
                </ul>
              )}
              {job.warning && <p className='mt-2 text-xs text-dr-danger'>Could not create the thumbnail. You can try again later.</p>}
              {job.error && <p className='mt-2 text-sm text-dr-danger'>{job.error}</p>}
              {job.notificationStatus === "failed" && <p className='mt-2 text-xs text-dr-danger'>The notification email could not be sent.</p>}
              {job.status === "succeeded" && (
                <Button success className='mt-3' onClick={() => navigate(lessonPath(job.courseTitle, job.source))}>{isVirtualSource(job.source) ? "Read Virtual" : "Read course"}</Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
/* eslint-enable react/prop-types */

export const IntroSection = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const virtuals = params.get("type") === "virtuals";
  const { showToast } = useAppContext();
  const [saved] = useState(() => readStoredJSON(FORM_STATE_KEY) || {});
  const [importMode, setImportMode] = useState(() => saved.mode === "url" ? "url" : "pdf");
  const mode = virtuals ? importMode : "ai";
  const [titles, setTitles] = useState(() => {
    if (saved.titles && typeof saved.titles === "object") {
      return {
        ai: typeof saved.titles.ai === "string" ? saved.titles.ai : "",
        pdf: typeof saved.titles.pdf === "string" ? saved.titles.pdf : "",
        url: typeof saved.titles.url === "string" ? saved.titles.url : "",
      };
    }
    return { ai: "", pdf: "", url: "", [saved.mode || "ai"]: typeof saved.title === "string" ? saved.title : "" };
  });
  const [input, setInput] = useState(() => typeof saved.input === "string" ? saved.input : "");
  const [level, setLevel] = useState(() => RESEARCH_LEVELS.some((option) => option.value === saved.level) ? saved.level : "medium");
  const [language, setLanguage] = useState(() => LANGUAGES.includes(saved.language) ? saved.language : "English");
  const [writingStyle, setWritingStyle] = useState(() => WRITING_STYLES.some((option) => option.value === saved.writingStyle) ? saved.writingStyle : "academic");
  const [searchWeb, setSearchWeb] = useState(() => saved.searchWeb === true);
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [jobsError, setJobsError] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(() => saved.notifyEmail === true);
  const requestRef = useRef(null);
  const [selectedSubjects, setSelectedSubjects] = useState(() =>
    new Set(Array.isArray(saved.selectedSubjects) ? saved.selectedSubjects.filter(Number.isInteger) : []),
  );
  const [url, setUrl] = useState(() => typeof saved.url === "string" ? saved.url : "");
  // the selected PDF file is intentionally not persisted to localStorage
  const [pdfFile, setPdfFile] = useState(null);
  const [isDraggingPDF, setIsDraggingPDF] = useState(false);
  const title = titles[mode];

  // Persist form state to localStorage whenever it changes
  useEffect(() => {
    const state = {
      titles,
      input,
      level,
      language,
      writingStyle,
      searchWeb,
      notifyEmail,
      mode: importMode,
      url,
      selectedSubjects: Array.from(selectedSubjects),
    };
    writeStoredJSON(FORM_STATE_KEY, state);
  }, [
    titles,
    input,
    level,
    language,
    writingStyle,
    searchWeb,
    notifyEmail,
    importMode,
    url,
    selectedSubjects,
  ]);

  const {
    data: subjects,
    loading: subjectsLoading,
    error: subjectsError,
  } = useGet({ url: API_GET_SUBJECTS });

  useEffect(() => {
    if (subjectsError) {
      showToast({
        type: "danger",
        message: String(subjectsError),
      });
    }
  }, [subjectsError, showToast]);

  const toggleSubject = (id) => {
    setSelectedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectPDF = (file) => {
    if (loading || !file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      showToast({ type: "danger", message: "Please choose a PDF file" });
      return;
    }
    setPdfFile(file);
  };

  const loadJobs = useCallback(async () => {
    try {
      const response = await fetch(API_COURSE_JOBS, {
        headers: { Authorization: "Bearer " + localStorage.getItem("auth") },
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.errors || "Could not load jobs");
      setJobs(result.data);
      setJobsError("");
    } catch (err) {
      setJobsError(err.message || "Could not load jobs");
    }
  }, []);

  useEffect(() => {
    loadJobs();
    const timer = setInterval(loadJobs, 5000);
    return () => clearInterval(timer);
  }, [loadJobs]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (mode === "ai" && (!title.trim() || !input.trim())) {
      showToast({
        type: "danger",
        message: "Please enter a title and a topic",
      });
      return;
    }
    if (mode === "pdf" && !pdfFile) {
      showToast({
        type: "danger",
        message: "Please choose a PDF file",
      });
      return;
    }
    if (mode === "url" && !url.trim()) {
      showToast({
        type: "danger",
        message: "Please enter a URL",
      });
      return;
    }

    setLoading(true);
    const body = {
      source: mode === "ai" ? "ai" : mode === "pdf" ? "doc" : "web",
      title: title.trim(), input: input.trim(), url: url.trim(), level,
      language, writingStyle, searchWeb, notifyEmail,
      subjectIds: Array.from(selectedSubjects),
    };
    const signature = JSON.stringify(body);
    if (!requestRef.current || requestRef.current.signature !== signature || requestRef.current.file !== pdfFile) {
      requestRef.current = { signature, file: pdfFile, key: crypto.randomUUID() };
    }
    body.requestKey = requestRef.current.key;
    try {
      let payload = JSON.stringify(body);
      const headers = { Authorization: "Bearer " + localStorage.getItem("auth") };
      if (mode === "pdf") {
        payload = new FormData();
        payload.append("file", pdfFile);
        payload.append("title", body.title);
        payload.append("language", language);
        payload.append("writingStyle", writingStyle);
        payload.append("subjectIds", body.subjectIds.join(","));
        payload.append("notifyEmail", String(notifyEmail));
        payload.append("requestKey", body.requestKey);
      } else {
        headers["Content-Type"] = "application/json";
      }
      const response = await fetch(API_COURSE_JOBS, { method: "POST", headers, body: payload });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.errors || "Could not queue course");
      requestRef.current = null;
      removeStoredItem(FORM_STATE_KEY);
      setPdfFile(null);
      showToast({ type: "success", message: "Course queued. You can safely leave this page." });
      await loadJobs();
    } catch (err) {
      showToast({
        type: "danger",
        message: err.message || "Something went wrong",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <h1 className='mb-1 text-2xl font-bold text-dr-text'>
        {virtuals ? "Import a Virtual" : "Create a course"}
      </h1>
      <p className='mb-6 text-sm text-dr-text-muted'>
        {virtuals ? "Upload a PDF or import a web article." : "Describe the topic you want to learn about."}
      </p>

      <div role='group' aria-label='Content type' className='mb-4 flex flex-wrap items-center gap-2'>
        <span className='text-sm font-medium text-dr-text'>Content type:</span>
        {["courses", "virtuals"].map((type) => (
          <button key={type} type='button' aria-pressed={(type === "virtuals") === virtuals} disabled={loading}
            onClick={() => setParams({ type })}
            className={`rounded-xl border px-4 py-2 text-sm font-medium ${(type === "virtuals") === virtuals ? "border-dr-accent bg-dr-accent-light text-dr-accent" : "border-dr-border text-dr-text-muted"}`}>
            {type === "virtuals" ? "Virtuals" : "Courses"}
          </button>
        ))}
      </div>
      <div className='lg:rounded-2xl lg:border lg:border-dr-border lg:bg-dr-surface-light lg:p-6'>
        <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
          <fieldset disabled={loading} className='flex min-w-0 flex-col gap-3'>
            {/* Lesson source selector */}
            {virtuals && <div className='flex flex-col gap-2'>
              <span className='text-sm font-medium text-dr-text'>
                Import source
              </span>
              <div className='flex flex-wrap gap-3'>
                {MODES.filter((option) => option.value !== "ai").map((option) => (
                  <label
                    key={option.value}
                    className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-2 text-center text-sm font-medium transition-colors ${
                      mode === option.value
                        ? "border-dr-accent bg-dr-accent-light text-dr-accent"
                        : "border-dr-border text-dr-text-muted hover:border-dr-accent/50"
                    }`}
                  >
                    <input
                      type='radio'
                      name='lesson-mode'
                      value={option.value}
                      checked={mode === option.value}
                      onChange={() => setImportMode(option.value)}
                      className='sr-only'
                    />
                    <ion-icon name={option.icon} aria-hidden='true' />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>}

            {/* Title only names the storage folder, nothing else; imports fall
                back to the file name or article title when left empty */}
            <Input
              value={title}
              onChange={(e) =>
                setTitles((previous) => ({ ...previous, [mode]: e.target.value }))
              }
              placeholder={
                mode === "ai"
                  ? "TItle for this lesson"
                  : "Optional title for this lesson"
              }
            />

            {mode === "ai" && (
              <TextArea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder='Describe everythiing you want to know about it...'
                minRows={3}
              />
            )}

            {mode === "pdf" && (
              <div className='flex flex-col gap-2'>
                <label
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!loading) setIsDraggingPDF(true);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget)) setIsDraggingPDF(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingPDF(false);
                    selectPDF(e.dataTransfer.files?.[0]);
                  }}
                  className={`flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 text-center text-sm transition-colors focus-within:ring-2 focus-within:ring-dr-accent/25 ${
                    loading
                      ? "cursor-not-allowed border-dr-border text-dr-text-muted opacity-60"
                      : isDraggingPDF
                        ? "cursor-pointer border-dr-accent bg-dr-accent-light text-dr-accent"
                        : "cursor-pointer border-dr-border text-dr-text-muted hover:border-dr-accent"
                  }`}
                >
                  <input
                    type='file'
                    accept='application/pdf,.pdf'
                    disabled={loading}
                    className='sr-only'
                    onChange={(e) => {
                      selectPDF(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  <ion-icon name='cloud-upload-outline' className='text-2xl' aria-hidden='true' />
                  <span>Drag and drop a PDF here, or click to choose a file</span>
                </label>
                {pdfFile && (
                  <p className='text-xs text-dr-text-muted'>
                    Selected: {pdfFile.name}
                  </p>
                )}
                {!pdfFile && (
                  <p className='text-xs text-dr-text-muted'>
                    PDF files must be selected again after reloading the page.
                  </p>
                )}
              </div>
            )}

            {mode === "url" && (
              <Input
                type='url'
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder='https://example.com/article'
              />
            )}

            {/* Research depth selector */}
            {mode === "ai" && (
            <div className='flex flex-col gap-2'>
              <span className='text-sm font-medium text-dr-text'>
                Research Intensity
              </span>
              <div className='flex flex-wrap gap-3'>
                {RESEARCH_LEVELS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-2 text-center text-sm font-medium transition-colors ${
                      level === option.value
                        ? "border-dr-accent bg-dr-accent-light text-dr-accent"
                        : "border-dr-border text-dr-text-muted hover:border-dr-accent/50"
                    }`}
                  >
                    <input
                      type='radio'
                      name='research-level'
                      value={option.value}
                      checked={level === option.value}
                      onChange={() => setLevel(option.value)}
                      className='sr-only'
                    />
                    <ion-icon name={option.icon} aria-hidden='true' />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
            )}

            {/* Language selector */}
            <div className='flex flex-col gap-2'>
              <span className='text-sm font-medium text-dr-text'>
                {mode === "ai" ? "Language" : "Source language"}
              </span>
              {mode !== "ai" && (
                <p className='text-xs text-dr-text-muted'>
                  Imported content keeps its original language; it is not translated.
                </p>
              )}
              <div className='flex flex-wrap gap-3'>
                {LANGUAGES.map((option) => (
                  <label
                    key={option}
                    className={`flex-1 cursor-pointer rounded-xl border px-4 py-2 text-center text-sm font-medium transition-colors ${
                      language === option
                        ? "border-dr-accent bg-dr-accent-light text-dr-accent"
                        : "border-dr-border text-dr-text-muted hover:border-dr-accent/50"
                    }`}
                  >
                    <input
                      type='radio'
                      name='language'
                      value={option}
                      checked={language === option}
                      onChange={() => setLanguage(option)}
                      className='sr-only'
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>

            {/* Writing style applies only to AI research. */}
            {mode === "ai" && (
            <div className='flex flex-col gap-2'>
              <span className='text-sm font-medium text-dr-text'>
                Writing style
              </span>
              <div className='flex flex-wrap gap-3'>
                {WRITING_STYLES.map((option) => (
                  <label
                    key={option.value}
                    className={`flex-1 cursor-pointer rounded-xl border px-4 py-2 text-center text-sm font-medium transition-colors ${
                      writingStyle === option.value
                        ? "border-dr-accent bg-dr-accent-light text-dr-accent"
                        : "border-dr-border text-dr-text-muted hover:border-dr-accent/50"
                    }`}
                  >
                    <input
                      type='radio'
                      name='writing-style'
                      value={option.value}
                      checked={writingStyle === option.value}
                      onChange={() => setWritingStyle(option.value)}
                      className='sr-only'
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
            )}

            {/* Toggle to let the model search the web while elaborating chapters */}
            {mode === "ai" && (
              <div className='flex items-center justify-between'>
                <label htmlFor='search-web' className='text-sm font-medium text-dr-text'>
                  Search the web
                </label>
                <Switch
                  id='search-web'
                  primary
                  size='small'
                  checked={searchWeb}
                  onChange={setSearchWeb}
                  disabled={loading}
                />
              </div>
            )}
            <div className='flex items-center justify-between gap-3'>
              <label htmlFor='notify-email' className='text-sm font-medium text-dr-text'>
                Email me when this course is ready
              </label>
              <Switch id='notify-email' primary size='small' checked={notifyEmail} onChange={setNotifyEmail} disabled={loading} />
            </div>
            {/* Subject selector */}
            <div className='flex flex-col gap-2'>
              <span className='text-sm font-medium text-dr-text'>Subjects</span>
              {subjectsLoading ? (
                <Loading size={18} />
              ) : subjectsError ? (
                <p className='text-xs text-dr-text-muted'>
                  Failed to load subjects
                </p>
              ) : subjects?.length === 0 ? (
                <p className='text-xs text-dr-text-muted'>
                  No subjects yet. Create some in the subjects page.
                </p>
              ) : (
                <div className='flex flex-wrap items-center gap-3'>
                  {subjects?.map((subject) => {
                    const selected = selectedSubjects.has(subject.id);
                    return (
                      <button
                        key={subject.id}
                        type='button'
                        onClick={() => toggleSubject(subject.id)}
                        disabled={loading}
                        className={`group flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                          selected
                            ? ""
                            : "border-dr-border bg-dr-surface hover:border-dr-text-muted"
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
                        title={subject.name}
                      >
                        <span
                          className={`inline-block h-4 w-4 rounded-full border-2 transition-colors ${
                            selected
                              ? "border-white bg-white"
                              : "border-current bg-transparent"
                          }`}
                          style={selected ? {} : { borderColor: subject.color }}
                        />
                        {subject.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </fieldset>
          {loading ? (
            <div className='flex items-center justify-center gap-2 py-2.5 text-dr-text-muted animate-pulse'>
              <ion-icon
                name='book-outline'
                className='text-dr-accent'
              ></ion-icon>
              <span>
                Submitting your course...
              </span>
            </div>
          ) : (
            <Button type='submit' primary className='w-full'>
              Submit
            </Button>
          )}
        </form>

        <CourseJobs jobs={jobs} error={jobsError} navigate={navigate} />
      </div>
    </section>
  );
};
