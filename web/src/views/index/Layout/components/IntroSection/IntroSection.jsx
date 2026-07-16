import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Input, Loading, Switch, TextArea } from "@ds";
import {
  API_POST_LEARN_ABOUT,
  API_GET_SUBJECTS,
  ROUTE_LEARN,
} from "@constants";
import { streamPost, useGet } from "@utils";
import { useAppContext } from "@views/context/appContextProvider";

// Available research depth levels for a topic
const RESEARCH_LEVELS = [
  { value: "low", label: "☕️ Low" },
  { value: "medium", label: "🧐 Medium" },
  { value: "high", label: "👨‍🔬 High" },
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

export const IntroSection = () => {
  const navigate = useNavigate();
  const { showToast } = useAppContext();
  const [title, setTitle] = useState("");
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
  const [selectedSubjects, setSelectedSubjects] = useState(new Set());

  const FORM_STATE_KEY = "zapohteh-lesson-form";

  // Load any previously saved form state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(FORM_STATE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (parsed.title) setTitle(parsed.title);
      if (parsed.input) setInput(parsed.input);
      if (parsed.level) setLevel(parsed.level);
      if (parsed.language) setLanguage(parsed.language);
      if (parsed.writingStyle) setWritingStyle(parsed.writingStyle);
      if (typeof parsed.searchWeb === "boolean") setSearchWeb(parsed.searchWeb);
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
      title,
      input,
      level,
      language,
      writingStyle,
      searchWeb,
      selectedSubjects: Array.from(selectedSubjects),
    };
    localStorage.setItem(FORM_STATE_KEY, JSON.stringify(state));
  }, [
    title,
    input,
    level,
    language,
    writingStyle,
    searchWeb,
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !input.trim() || loading) {
      showToast({
        type: "danger",
        message: "Please enter a title and a topic",
      });
      return;
    }

    // reset progress state before starting a new research
    setLoading(true);
    setChapters([]);
    setCompleted([]);
    setFinished(false);
    setTopic("");
    setCurrentStep(0);

    try {
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
        onEvent: (event, data) => {
          const parsed = JSON.parse(data);
          if (event === "chapters") {
            setChapters(parsed);
            setCurrentStep(1);
          } else if (event === "chapterDone") {
            setCompleted((prev) => [...prev, parsed]);
          } else if (event === "coverImage") {
            setCurrentStep(2);
          } else if (event === "done") {
            setTopic(parsed.topic);
            setFinished(true);
            setCurrentStep(3);
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
                  : parsed?.message || "Research failed",
            });
          }
        },
      });
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
        what brain update are we installing today? 🧠
      </h1>
      <p className='mb-6 text-sm text-dr-text-muted'>
        You can make it as broad as the gates of Hell or as narrow as the eye of
        a niddle. Just describe it.
      </p>

      <div className='rounded-2xl border border-dr-border bg-dr-surface-light p-6'>
        <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
          <div className='flex flex-col gap-3'>
            {/* Title only names the storage folder, nothing else */}
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='TItle for this lesson'
            />
            <TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='Describe everythiing you want to know about it...'
              minRows={3}
            />
            {/* Research depth selector */}
            <div className='flex flex-col gap-2'>
              <span className='text-sm font-medium text-dr-text'>
                Research Intensity
              </span>
              <div className='flex flex-wrap gap-3'>
                {RESEARCH_LEVELS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex-1 cursor-pointer rounded-xl border px-4 py-2 text-center text-sm font-medium transition-colors ${
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
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Language selector */}
            <div className='flex flex-col gap-2'>
              <span className='text-sm font-medium text-dr-text'>Language</span>
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

            {/* Writing style selector */}
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

            {/* Toggle to let the model search the web while elaborating chapters */}
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
          </div>
          {loading ? (
            <div className='flex items-center justify-center gap-2 py-2.5 text-dr-text-muted animate-pulse'>
              <ion-icon
                name='book-outline'
                className='text-dr-accent'
              ></ion-icon>
              <span>Reading what others have written...</span>
            </div>
          ) : (
            <Button type='submit' primary className='w-full'>
              Submit
            </Button>
          )}
        </form>

        {/* Timeline of the research pipeline */}
        {currentStep !== null && (
          <div className='relative mt-6'>
            <div className='absolute left-0 right-0 top-4 flex px-4'>
              {STEPS.map((_, index) =>
                index < STEPS.length - 1 ? (
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
              {STEPS.map((step, index) => {
                const isActive = index === currentStep;
                const isCompleted = index < currentStep;
                return (
                  <div
                    key={step.key}
                    className='flex flex-1 flex-col items-center gap-2'
                  >
                    <div
                      className={`relative flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                        isCompleted
                          ? "bg-dr-success text-white"
                          : isActive
                            ? "bg-dr-accent text-white animate-pulse"
                            : "border border-dr-border bg-dr-surface text-dr-text-muted"
                      }`}
                    >
                      {isCompleted ? (
                        <ion-icon name='checkmark-outline'></ion-icon>
                      ) : (
                        index + 1
                      )}
                    </div>
                    <span
                      className={`text-center text-xs font-medium ${
                        isActive || isCompleted
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
          </div>
        )}

        {/* Progress of each chapter as it gets completed */}
        {chapters.length > 0 && (
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
