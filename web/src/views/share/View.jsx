import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { marked } from "marked";
import { Loading, Thumbnail } from "@ds";
import { API_GET_SHARED_LESSON } from "@constants";
import { splitChapters } from "../learn/splitChapters";
import zapohtehLogo from "../../../public/logo.webp";

/* *************************************************************************************************
 * Public, read-only page for a shared lesson. Anyone with the link can open it: no account and
 * no authentication required. It renders exactly what the share token exposes — the assembled
 * lesson content and its notes — and nothing else.
 * *************************************************************************************************
 */
export const ShareView = () => {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${API_GET_SHARED_LESSON}/${encodeURIComponent(token)}`,
        );
        const result = await res.json();
        if (cancelled) return;
        if (!result.success || !result.data) {
          setError(
            String(
              result.error ||
                "This share link is invalid or has been disabled.",
            ),
          );
          return;
        }
        setData(result.data);
      } catch {
        if (!cancelled) setError("Could not load this shared lesson.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-dr-bg'>
        <Loading size={40} />
      </div>
    );
  }

  if (error) {
    return (
      <div className='flex min-h-screen flex-col items-center justify-center gap-3 bg-dr-bg px-6 text-center'>
        <ion-icon
          name='link-outline'
          className='text-4xl text-dr-text-muted'
        ></ion-icon>
        <p className='max-w-md text-sm text-dr-text-muted'>{error}</p>
      </div>
    );
  }

  const { intro, chapters } = splitChapters(data.content);
  const notes = Array.isArray(data.notes)
    ? data.notes.filter((n) => (n.body || "").trim())
    : [];

  return (
    <div className='min-h-screen bg-dr-bg'>
      <header className='border-b border-dr-border bg-dr-surface'>
        <div className='mx-auto flex max-w-[800px] items-center gap-3 px-6 py-4'>
          <img src={zapohtehLogo} alt='Zapohteh' className='h-8 w-8 rounded-lg' />
          <span className='text-sm font-semibold text-dr-text'>Zapohteh</span>
          <span className='ml-auto text-xs text-dr-text-muted'>
            Shared lesson
          </span>
        </div>
      </header>

      <main className='mx-auto max-w-[800px] px-6 py-8'>
        {data.coverImagePath && (
          <Thumbnail
            src={data.coverImagePath}
            alt={data.title}
            className='mb-6 h-48 w-full rounded-2xl'
          />
        )}

        {intro && (
          <div
            className='research-content'
            dangerouslySetInnerHTML={{
              __html: marked.parse(intro, { async: false }),
            }}
          />
        )}

        {chapters.map((chapter) => (
          <section key={chapter.title} className='mt-8'>
            <h4 className='mb-2 font-bold text-blue-500/80'>{chapter.title}</h4>
            <div
              className='research-content'
              dangerouslySetInnerHTML={{
                __html: marked.parse(chapter.body, { async: false }),
              }}
            />
          </section>
        ))}

        {notes.length > 0 && (
          <section className='mt-12'>
            <h2 className='mb-4 text-lg font-bold text-dr-text'>Notes</h2>
            <div className='flex flex-col gap-4'>
              {notes.map((note, idx) => (
                <div
                  key={idx}
                  className='rounded-xl border border-dr-border bg-dr-surface p-4'
                >
                  {note.author && (
                    <p className='mb-2 text-xs font-medium text-dr-text-muted'>
                      @{note.author}
                    </p>
                  )}
                  <div
                    className='research-content text-sm'
                    dangerouslySetInnerHTML={{
                      __html: marked.parse(note.body, { async: false }),
                    }}
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
