import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { marked } from "marked";
import { Button, Loading } from "@ds";
import { API_GET_TOPIC, API_POST_CHAPTER_IMAGE, ROUTE_HOME } from "@constants";
import { splitChapters } from "./splitChapters";

/* *************************************************************************************************
 * Renders the assembled markdown research for a single topic, split into chapters so each chapter
 * heading can carry a "Create summary image" button. Clicking the button asks the backend to
 * generate a summarizing image and returns the updated content, which is re-rendered in place.
 * *************************************************************************************************
 */
export const LearnView = () => {
  const { topic } = useParams();
  const navigate = useNavigate();

  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // title of the chapter whose image is currently being generated
  const [generating, setGenerating] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${API_GET_TOPIC}?name=${encodeURIComponent(topic)}`,
          { signal: controller.signal },
        );
        const result = await res.json();
        if (result.error) setError(result.error);
        else setContent(result.data?.content || "");
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
    setGenerating(chapter);
    setError(null);
    try {
      const res = await fetch(API_POST_CHAPTER_IMAGE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, chapter }),
      });
      const result = await res.json();
      if (result.error) setError(result.error);
      else setContent(result.data?.content || content);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setGenerating(null);
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

  return (
    <div className='mx-auto w-full max-w-[800px] px-4 py-8'>
      <Button secondary className='mb-6' onClick={() => navigate(ROUTE_HOME)}>
        <ion-icon name='arrow-back-outline'></ion-icon>
        <span className='ml-2'>Back</span>
      </Button>

      {intro && (
        <div
          className='research-content'
          dangerouslySetInnerHTML={{ __html: marked.parse(intro) }}
        />
      )}

      {chapters.map((chapter) => {
        const isGenerating = generating === chapter.title;
        return (
          <section key={chapter.title} className='mt-8'>
            {/* chapter heading with its summary image action */}
            <div className='mb-3 flex items-start justify-between gap-4'>
              <h2 className='text-xl font-bold text-dr-text'>
                {chapter.title}
              </h2>
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
            <div
              className='research-content'
              dangerouslySetInnerHTML={{ __html: marked.parse(chapter.body) }}
            />
          </section>
        );
      })}
    </div>
  );
};
