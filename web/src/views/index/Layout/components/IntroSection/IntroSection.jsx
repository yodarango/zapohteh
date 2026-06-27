import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Input, Switch, TextArea } from "@ds";
import { API_POST_LEARN_ABOUT, ROUTE_LEARN } from "@constants";
import { streamPost } from "@utils";

// Available research depth levels for a topic
const RESEARCH_LEVELS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export const IntroSection = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [input, setInput] = useState("");
  const [level, setLevel] = useState("medium");
  const [searchWeb, setSearchWeb] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [topic, setTopic] = useState("");
  const [finished, setFinished] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !input.trim() || loading) return;

    // reset progress state before starting a new research
    setLoading(true);
    setError(null);
    setChapters([]);
    setCompleted([]);
    setFinished(false);
    setTopic("");

    try {
      await streamPost({
        url: API_POST_LEARN_ABOUT,
        body: { title: title.trim(), input: input.trim(), level, searchWeb },
        onEvent: (event, data) => {
          const parsed = JSON.parse(data);
          if (event === "chapters") setChapters(parsed);
          else if (event === "chapterDone")
            setCompleted((prev) => [...prev, parsed]);
          else if (event === "done") {
            setTopic(parsed.topic);
            setFinished(true);
          } else if (event === "error") setError(parsed);
        },
      });
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <h1 className='mb-1 text-2xl font-bold text-dr-text'>
        What do you want to learn about today
      </h1>
      <p className='mb-6 text-sm text-dr-text-muted'>
        Describe a topic and we will research it for you, chapter by chapter.
      </p>

      <div className='rounded-2xl border border-dr-border bg-dr-surface-light p-6'>
        <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
          <div className='flex flex-col gap-3'>
            {/* Title only names the storage folder, nothing else */}
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='Title...'
            />
            <TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='Type a topic...'
              minRows={3}
            />
            {/* Research depth selector */}
            <div className='flex gap-3'>
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
          </div>
          {loading ? (
            <div className='flex items-center justify-center gap-2 py-2.5 text-dr-text-muted'>
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

        {error && (
          <p className='mt-4 text-sm text-dr-danger'>{String(error)}</p>
        )}

        {/* Progress of each chapter as it gets completed */}
        {chapters.length > 0 && (
          <ul className='mt-6 flex flex-col gap-2 text-left'>
            {chapters.map((chapter) => {
              const isDone = completed.includes(chapter);
              return (
                <li
                  key={chapter}
                  className={`flex items-center gap-2 ${
                    isDone ? "text-dr-success" : "text-dr-text-muted"
                  }`}
                >
                  <ion-icon
                    name={isDone ? "checkmark-circle" : "ellipse-outline"}
                  ></ion-icon>
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
