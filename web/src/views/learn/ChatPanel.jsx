import { useState, useEffect } from "react";
import { Button, Select } from "@ds";
import { API_GET_CHAT, API_POST_CHAT } from "@constants";
import { useAppContext } from "@views/context/appContextProvider";

export const ChatPanel = ({ topic, chapters }) => {
  const { showToast } = useAppContext();
  const [messages, setMessages] = useState([]);
  const [chapter, setChapter] = useState("generic");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const authHeaders = () => ({
    Authorization: "Bearer " + localStorage.getItem("auth"),
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${API_GET_CHAT}?course=${encodeURIComponent(topic)}`,
          { headers: authHeaders() },
        );
        const result = await res.json();
        if (!cancelled && result.data && Array.isArray(result.data)) {
          setMessages(result.data);
        }
      } catch (err) {
        // silently fail on load; the chat is optional
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [topic]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const trimmed = input.trim();
    setLoading(true);
    try {
      const res = await fetch(API_POST_CHAT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          course: topic,
          chapter,
          content: trimmed,
        }),
      });
      const result = await res.json();
      if (result.error || !result.success) {
        showToast({
          type: "danger",
          message: String(result.error || "AI request failed"),
        });
        return;
      }
      const userMsg = {
        role: "user",
        chapter,
        content: trimmed,
        id: Date.now(),
      };
      const assistantMsg = result.data;
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
    } catch (err) {
      showToast({
        type: "danger",
        message: err.message || "AI request failed",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3 className='mb-3 text-xs font-semibold uppercase tracking-wide text-dr-text-muted'>
        Assistant
      </h3>

      <div className='mb-3'>
        <Select
          label=''
          value={chapter}
          onChange={(val) => setChapter(val)}
          placeholder='Select a chapter'
          options={[
            { value: "generic", label: "Generic" },
            ...chapters.map((c) => ({ value: c.title, label: c.title })),
          ]}
        />
      </div>

      <div className='mb-3 max-h-48 overflow-y-auto'>
        {messages.map((msg, idx) => (
          <div
            key={msg.id || idx}
            className={`mb-2 rounded-xl px-3 py-2 text-sm ${
              msg.role === "user"
                ? "bg-dr-accent-light text-dr-accent"
                : "bg-dr-surface-light text-dr-text"
            }`}
          >
            <p className='text-xs font-medium opacity-75'>
              {msg.role === "user" ? "You" : "AI"}
              {msg.chapter && msg.chapter !== "generic" && (
                <span className='ml-1'>· {msg.chapter}</span>
              )}
            </p>
            <p className='mt-0.5 whitespace-pre-wrap'>{msg.content}</p>
          </div>
        ))}
      </div>

      <div className='flex flex-col gap-2'>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder='Ask a question...'
          rows={1}
          className='w-full resize-none overflow-hidden rounded-xl border border-dr-border bg-dr-surface px-4 py-3 pb-4 text-sm text-dr-text outline-none transition-colors placeholder:text-dr-text-muted focus:border-dr-accent focus:ring-2 focus:ring-dr-accent/25'
        />
        <Button primary className='w-full' onClick={send} isLoading={loading}>
          Send
        </Button>
      </div>
    </div>
  );
};
