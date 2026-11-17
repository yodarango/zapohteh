import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Input, Loading, Switch, TextArea } from "@ds";
import {
  API_POST_LEARN_ABOUT,
  API_POST_LEARN_FROM_SOURCE,
  API_GET_SUBJECTS,
  ROUTE_LEARN,
} from "@constants";
import { streamPost, useGet } from "@utils";
import { useAppContext } from "@views/context/appContextProvider";

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

export const IntroSection = () => {
  const navigate = useNavigate();
  const { showToast } = useAppContext();
  const [titles, setTitles] = useState({ ai: "", pdf: "", url: "" });
  const [input, setInput] = useState("");
  const [level, setLevel] = useState("medium");
  const [language, setLanguage] = useState("English");
  const [writingStyle, setWritingStyle] = useState("academic");
  const [searchWeb, setSearchWeb] = useState(false);
  const [loading, setLoading] = useState(false);
  const [chapters, setChapters] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [topic, setTopic] = useState("");
  const [finished, setFinished] = useState(false);
  const [currentStep, setCurrentStep] = useState(null);
  const [thumbnailError, setThumbnailError] = useState(false);
  // latest detail line reported by the extraction phase of an import
  const [extractDetail, setExtractDetail] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState(new Set());
  const [mode, setMode] = useState("ai");
  const [url, setUrl] = useState("");
  // the selected PDF file is intentionally not persisted to localStorage
  const [pdfFile, setPdfFile] = useState(null);
  const [isDraggingPDF, setIsDraggingPDF] = useState(false);
  const title = titles[mode];

  const FORM_STATE_KEY = "zapohteh-lesson-form";

  // Load any previously saved form state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(FORM_STATE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (parsed.titles && typeof parsed.titles === "object") {
        setTitles({
          ai: typeof parsed.titles.ai === "string" ? parsed.titles.ai : "",
          pdf: typeof parsed.titles.pdf === "string" ? parsed.titles.pdf : "",
          url: typeof parsed.titles.url === "string" ? parsed.titles.url : "",
        });
      } else if (typeof parsed.title === "string") {
        const savedMode = MODES.some((option) => option.value === parsed.mode)
          ? parsed.mode
          : "ai";
        setTitles((previous) => ({ ...previous, [savedMode]: parsed.title }));
      }
      if (parsed.input) setInput(parsed.input);
      if (parsed.level) setLevel(parsed.level);
      if (parsed.language) setLanguage(parsed.language);
      if (parsed.writingStyle) setWritingStyle(parsed.writingStyle);
      if (typeof parsed.searchWeb === "boolean") setSearchWeb(parsed.searchWeb);
      if (MODES.some((option) => option.value === parsed.mode)) setMode(parsed.mode);
      if (parsed.url) setUrl(parsed.url);
      if (parsed.selectedSubjects) {
        setSelectedSubjects(new Set(parsed.selectedSubjects));
      }
    } catch (err) {
      console.error("Failed to parse saved lesson form", err);
    }
  }, []);

  // Persist form state to localStorage whenever it changes
  useEffect(() => {
    const state = {
      titles,
      input,
      level,
      language,
      writingStyle,
      searchWeb,
      mode,
      url,
      selectedSubjects: Array.from(selectedSubjects),
    };
    localStorage.setItem(FORM_STATE_KEY, JSON.stringify(state));
  }, [
    titles,
    input,
    level,
    language,
    writingStyle,
    searchWeb,
    mode,
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

    // reset progress state before starting a new lesson
    setLoading(true);
    setChapters([]);
    setCompleted([]);
    setFinished(false);
    setTopic("");
    setCurrentStep(0);
    setThumbnailError(false);
    setExtractDetail("");

    const isImport = mode !== "ai";
    const handleEvent = (event, data) => {
      const parsed = JSON.parse(data);
      if (event === "extracting") {
        if (parsed.phase === "done") setCurrentStep(1);
        setExtractDetail(parsed.detail || parsed.phase);
      } else if (event === "chapters") {
        setChapters(parsed);
        setCurrentStep(1);
      } else if (event === "chapterDone") {
        setCompleted((prev) => [...prev, parsed]);
      } else if (event === "coverImage") {
        setCurrentStep(2);
        if (parsed.phase === "error") {
          setThumbnailError(true);
        }
      } else if (event === "done") {
        setTopic(parsed.topic);
        setFinished(true);
        setCurrentStep(isImport ? IMPORT_STEPS.length : STEPS.length);
        localStorage.removeItem(FORM_STATE_KEY);
        showToast({
          type: "success",
          message: "Course created successfully",
        });
      } else if (event === "error") {
        showToast({
          type: "danger",
          message:
            typeof parsed === "string"
              ? parsed
              : parsed?.message || "Something went wrong",
        });
      }
    };

    try {
      if (mode === "pdf") {
        const formData = new FormData();
        formData.append("file", pdfFile);
        if (title.trim()) formData.append("title", title.trim());
        formData.append("language", language);
        formData.append("subjectIds", Array.from(selectedSubjects).join(","));
        await streamPost({
          url: API_POST_LEARN_FROM_SOURCE,
          body: formData,
          onEvent: handleEvent,
        });
      } else if (mode === "url") {
        await streamPost({
          url: API_POST_LEARN_FROM_SOURCE,
          body: {
            url: url.trim(),
            title: title.trim(),
            language,
            subjectIds: Array.from(selectedSubjects),
          },
          onEvent: handleEvent,
        });
      } else {
        await streamPost({
          url: API_POST_LEARN_ABOUT,
          body: {
            title: title.trim(),
            input: input.trim(),
            level,
            language,
            writingStyle,
            searchWeb,
            subjectIds: Array.from(selectedSubjects),
          },
          onEvent: handleEvent,
        });
      }
    } catch (err) {
      showToast({
        type: "danger",
        message: err.message || "Something went wrong",
      });
    } finally {
      setLoading(false);
    }
  };

  // Imports save source content directly; AI research has its own progress steps.
  const steps = mode === "ai" ? STEPS : IMPORT_STEPS;

  return (
    <section>
      <h1 className='mb-1 text-2xl font-bold text-dr-text'>
        what brain update are we installing today? 🧠
      </h1>
      <p className='mb-6 text-sm text-dr-text-muted'>
        You can make it as broad as the gates of Hell or as narrow as the eye of
        a niddle. Just describe it.
      </p>

      <div className='lg:rounded-2xl lg:border lg:border-dr-border lg:bg-dr-surface-light lg:p-6'>
        <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
          <fieldset disabled={loading} className='flex min-w-0 flex-col gap-3'>
            {/* Lesson source selector */}
            <div className='flex flex-col gap-2'>
              <span className='text-sm font-medium text-dr-text'>
                Lesson Source
              </span>
              <div className='flex flex-wrap gap-3'>
                {MODES.map((option) => (
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
                      onChange={() => setMode(option.value)}
                      className='sr-only'
                    />
                    <ion-icon name={option.icon} aria-hidden='true' />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

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
                <span className='text-sm font-medium text-dr-text'>
                  Search the web
                </span>
                <Switch
                  primary
                  checked={searchWeb}
                  onChange={setSearchWeb}
                  disabled={loading}
                />
              </div>
            )}
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
                {mode === "ai"
                  ? "Reading what others have written..."
                  : "Importing your content..."}
              </span>
            </div>
          ) : (
            <Button type='submit' primary className='w-full'>
              Submit
            </Button>
          )}
        </form>

        {/* Timeline of lesson creation */}
        {currentStep !== null && (
          <div className='relative mt-6'>
            <div className='absolute left-0 right-0 top-4 flex px-4'>
              {steps.map((_, index) =>
                index < steps.length - 1 ? (
                  <div
                    key={index}
                    className={`h-0.5 flex-1 ${
                      index < currentStep - 1 ? "bg-dr-success" : "bg-dr-border"
                    }`}
                  />
                ) : null,
              )}
            </div>
            <div className='relative flex items-center justify-between'>
              {steps.map((step, index) => {
                const isActive = index === currentStep;
                const isCompleted = index < currentStep;
                const isError = thumbnailError && index === steps.length - 1;
                return (
                  <div
                    key={step.key}
                    className='flex flex-1 flex-col items-center gap-2'
                  >
                    <div
                      className={`relative flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                        isError
                          ? "bg-dr-danger text-white"
                          : isCompleted
                            ? "bg-dr-success text-white"
                            : isActive
                              ? "bg-dr-accent text-white animate-pulse"
                              : "border border-dr-border bg-dr-surface text-dr-text-muted"
                      }`}
                    >
                      {isError ? (
                        <ion-icon name='close-outline'></ion-icon>
                      ) : isCompleted ? (
                        <ion-icon name='checkmark-outline'></ion-icon>
                      ) : (
                        index + 1
                      )}
                    </div>
                    <span
                      className={`text-center text-xs font-medium ${
                        isError || isActive || isCompleted
                          ? "text-dr-text"
                          : "text-dr-text-muted"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
            {thumbnailError && (
              <p className='mt-3 text-center text-xs font-medium text-dr-danger'>
                Could not create the thumbnail. You can try again later.
              </p>
            )}
          </div>
        )}

        {/* Live detail line while an import is extracting (e.g. "page 3 of 12") */}
        {loading && mode !== "ai" && currentStep === 0 && extractDetail && (
          <p className='mt-3 text-center text-xs text-dr-text-muted'>
            {extractDetail}
          </p>
        )}

        {/* Progress of each chapter as it gets completed */}
        {mode === "ai" && chapters.length > 0 && (
          <ul className='mt-6 flex flex-col gap-2 text-left'>
            {chapters.map((chapter) => {
              const isDone = completed.includes(chapter);
              const isCurrent =
                !isDone &&
                chapter === chapters.find((c) => !completed.includes(c));
              return (
                <li
                  key={chapter}
                  className={`flex items-center gap-2 ${
                    isDone ? "text-dr-success" : "text-dr-text-muted"
                  }`}
                >
                  {isCurrent ? (
                    <Loading size={18} />
                  ) : (
                    <ion-icon
                      name={isDone ? "checkmark-circle" : "ellipse-outline"}
                    ></ion-icon>
                  )}
                  <span>{chapter}</span>
                </li>
              );
            })}
          </ul>
        )}

        {finished && (
          <Button
            success
            className='mt-6 w-full'
            onClick={() =>
              navigate(`${ROUTE_LEARN}/${encodeURIComponent(topic)}`)
            }
          >
            Read topic
          </Button>
        )}
      </div>
    </section>
  );
};
