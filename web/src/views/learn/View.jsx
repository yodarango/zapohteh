import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { marked } from "marked";
import {
  Button,
  Loading,
  Thumbnail,
  ConfirmationModal,
  Modal,
  Input,
  Select,
} from "@ds";
import {
  API_GET_TOPIC,
  API_POST_COURSE_COVER_IMAGE,
  API_POST_CHAPTER_IMAGE,
  API_GET_READING_PROGRESS,
  API_POST_READING_PROGRESS,
  API_GET_SUBJECTS,
  API_GET_COURSE_SUBJECTS,
  API_DELETE_COURSE,
  API_PUT_COURSE,
  API_GET_COURSE_IMAGES,
  API_PUT_COURSE_COVER,
  API_GET_COURSE_HIGHLIGHTS,
  API_PUT_COURSE_HIGHLIGHTS,
  API_GET_HIGHLIGHTS,
  API_BASE,
  ROUTE_HOME,
  ROUTE_LEARN,
  ROUTE_COURSES,
  TANJREEN_API_URL,
  TANJREEN_API_KEY,
} from "@constants";
import { splitChapters } from "./splitChapters";
import { ChatPanel } from "./ChatPanel";
import { authHeaders } from "@utils";
import { useAppContext } from "@views/context/appContextProvider";

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
  const { showToast, state, closeLearnMenu } = useAppContext();

  const [content, setContent] = useState("");
  const [coverImagePath, setCoverImagePath] = useState("");
  const [courseLanguage, setCourseLanguage] = useState("");
  const [loading, setLoading] = useState(true);
  // titles of chapters whose images are currently being generated
  const [generating, setGenerating] = useState(new Set());
  // titles of chapters that have been marked as read
  const [readChapters, setReadChapters] = useState(new Set());
  // all available subjects and the ids currently assigned to this course
  const [subjects, setSubjects] = useState([]);
  const [courseSubjectIds, setCourseSubjectIds] = useState(new Set());
  const [coverImageLoading, setCoverImageLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editLanguage, setEditLanguage] = useState("");
  const [editSubjectIds, setEditSubjectIds] = useState(new Set());
  const [courseImages, setCourseImages] = useState([]);
  const [selectedCoverImage, setSelectedCoverImage] = useState("");
  const [highlights, setHighlights] = useState([]);
  const [userHighlights, setUserHighlights] = useState([]);
  const [activeHighlightId, setActiveHighlightId] = useState(null);
  const [isChaptersOpen, setIsChaptersOpen] = useState(true);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [pendingHighlight, setPendingHighlight] = useState(null);
  const [highlightNote, setHighlightNote] = useState("");
  const [viewingNote, setViewingNote] = useState(null);

  const renderMarkdownWithHighlights = (markdown, chapter = "") => {
    if (!markdown) return "";
    const html = marked.parse(markdown);
    if (!highlights.length) return html;

    const relevant = chapter
      ? highlights.filter((h) => h.chapter === chapter)
      : highlights.filter((h) => !h.chapter);
    if (!relevant.length) return html;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const body = doc.body;

    relevant.forEach(({ text, highlightId, chapter: chapterName, note }) => {
      if (!text) return;
      const userHighlight = userHighlights.find((h) => h.id === highlightId);
      const color = userHighlight?.color || "#ffeb3b";
      const walker = document.createTreeWalker(
        body,
        NodeFilter.SHOW_TEXT,
        null,
        false,
      );
      const textNodes = [];
      let node;
      while ((node = walker.nextNode())) {
        if (node.parentElement?.closest("mark.highlight")) continue;
        if (node.textContent.includes(text)) {
          textNodes.push(node);
        }
      }

      textNodes.forEach((textNode) => {
        const parts = textNode.textContent.split(text);
        if (parts.length <= 1) return;

        const fragment = document.createDocumentFragment();
        parts.forEach((part, index) => {
          fragment.appendChild(document.createTextNode(part));
          if (index < parts.length - 1) {
            const mark = document.createElement("mark");
            mark.className =
              "highlight rounded-md px-1 py-0.5 box-decoration-clone";
            mark.style.backgroundColor = color;
            mark.appendChild(document.createTextNode(text));
            if (note) {
              mark.setAttribute("title", note);
            }

            const actions = document.createElement("span");
            actions.className =
              "ml-1 inline-flex whitespace-nowrap align-middle items-center gap-1";

            const deleteBtn = document.createElement("button");
            deleteBtn.className =
              "highlight-delete inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full bg-dr-text text-dr-surface text-[10px] leading-none";
            deleteBtn.setAttribute("data-highlight-text", text);
            deleteBtn.setAttribute("data-highlight-id", String(highlightId));
            deleteBtn.setAttribute("data-highlight-chapter", chapterName || "");
            deleteBtn.setAttribute("aria-label", "Remove highlight");
            deleteBtn.setAttribute("title", "Remove highlight");
            deleteBtn.textContent = "×";
            actions.appendChild(deleteBtn);

            if (note) {
              const noteBtn = document.createElement("button");
              noteBtn.className =
                "highlight-note inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full bg-dr-accent text-white text-[10px] leading-none";
              noteBtn.setAttribute("data-highlight-note", note);
              noteBtn.setAttribute("data-highlight-text", text);
              noteBtn.setAttribute("data-highlight-chapter", chapterName || "");
              noteBtn.setAttribute("data-highlight-label", userHighlight?.label || "");
              noteBtn.setAttribute("aria-label", "View note");
              noteBtn.setAttribute("title", "View note");
              noteBtn.innerHTML = "<ion-icon name='document-outline'></ion-icon>";
              actions.appendChild(noteBtn);
            }

            mark.appendChild(actions);
            fragment.appendChild(mark);
          }
        });
        textNode.parentNode.replaceChild(fragment, textNode);
      });
    });

    return body.innerHTML;
  };

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const [topicRes, progressRes, subjectsRes, courseSubjectsRes] =
          await Promise.all([
            fetch(`${API_GET_TOPIC}?name=${encodeURIComponent(topic)}`, {
              signal: controller.signal,
              headers: authHeaders(),
            }),
            fetch(
              `${API_GET_READING_PROGRESS}?course=${encodeURIComponent(topic)}`,
              { signal: controller.signal, headers: authHeaders() },
            ),
            fetch(API_GET_SUBJECTS, {
              signal: controller.signal,
              headers: authHeaders(),
            }),
            fetch(
              `${API_GET_COURSE_SUBJECTS}?course=${encodeURIComponent(topic)}`,
              { signal: controller.signal, headers: authHeaders() },
            ),
          ]);
        const topicResult = await topicRes.json();
        const progressResult = await progressRes.json();
        const subjectsResult = await subjectsRes.json();
        const courseSubjectsResult = await courseSubjectsRes.json();

        if (topicResult.error) {
          showToast({
            type: "danger",
            message: String(topicResult.error),
          });
        } else {
          setContent(topicResult.data?.content || "");
          setCoverImagePath(topicResult.data?.coverImagePath || "");
          setCourseLanguage(topicResult.data?.language || "");
        }

        if (progressResult.data && Array.isArray(progressResult.data)) {
          setReadChapters(new Set(progressResult.data));
        }

        if (subjectsResult.data && Array.isArray(subjectsResult.data)) {
          setSubjects(subjectsResult.data);
        }

        if (
          courseSubjectsResult.data &&
          Array.isArray(courseSubjectsResult.data)
        ) {
          setCourseSubjectIds(
            new Set(courseSubjectsResult.data.map((s) => s.id)),
          );
        }

        // Load saved course highlights and user-defined highlights.
        try {
          const [highlightsRes, userHighlightsRes] = await Promise.all([
            fetch(
              `${API_GET_COURSE_HIGHLIGHTS}?topic=${encodeURIComponent(topic)}`,
              { headers: authHeaders() },
            ),
            fetch(API_GET_HIGHLIGHTS, { headers: authHeaders() }),
          ]);
          const highlightsResult = await highlightsRes.json();
          const userHighlightsResult = await userHighlightsRes.json();
          if (highlightsRes.ok && highlightsResult.data?.highlights) {
            setHighlights(highlightsResult.data.highlights);
          }
          if (
            userHighlightsRes.ok &&
            Array.isArray(userHighlightsResult.data)
          ) {
            setUserHighlights(userHighlightsResult.data);
          }
        } catch {
          // ignore highlights loading errors
        }
      } catch (err) {
        if (err.name !== "AbortError")
          showToast({
            type: "danger",
            message: err.message || "Something went wrong",
          });
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [topic]);

  const createImage = async (chapter) => {
    setGenerating((prev) => new Set(prev).add(chapter));
    try {
      const res = await fetch(API_POST_CHAPTER_IMAGE, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ topic, chapter }),
      });
      const result = await res.json();
      if (result.errors || !result.success) {
        const message = result.errors || "Failed to create summary image";
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

  const createCoverImage = async () => {
    setCoverImageLoading(true);
    try {
      const res = await fetch(API_POST_COURSE_COVER_IMAGE, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ topic }),
      });
      const result = await res.json();
      if (!res.ok || result.error) {
        throw new Error(result.error || "Failed to create cover image");
      }
      if (result.data?.coverImagePath) {
        setCoverImagePath(result.data.coverImagePath);
      }
      showToast({
        type: "success",
        message: coverImagePath
          ? "Cover image recreated"
          : "Cover image created",
      });
    } catch (err) {
      showToast({
        type: "danger",
        message: err.message || "Failed to create cover image",
      });
    } finally {
      setCoverImageLoading(false);
    }
  };

  if (loading) {
    return (
      <div className='flex justify-center py-20'>
        <Loading size={40} />
      </div>
    );
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
        headers: authHeaders(),
        body: JSON.stringify({ course: topic, chapter, read: nextRead }),
      });
      showToast({
        type: "success",
        message: nextRead ? "Marked as read" : "Marked as unread",
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
      element.scrollIntoView({ behavior: "auto", block: "start" });
    }
    closeLearnMenu();
  };

  const progress = chapters.length
    ? Math.round((readChapters.size / chapters.length) * 100)
    : 0;

  const backendOrigin = API_BASE.startsWith("http")
    ? new URL(API_BASE).origin
    : window.location.origin;

  const downloadPDF = () => {
    const cover = coverImagePath
      ? `<img src="${coverImagePath.startsWith("/data/") ? backendOrigin + coverImagePath : coverImagePath}" alt="${topic}" style="max-width:100%; border-radius:0.75rem; margin:1rem 0;">`
      : "";
    const introHtml = intro ? marked.parse(intro) : "";
    const chaptersHtml = chapters
      .map(
        (chapter) => `
          <h2>${chapter.title}</h2>
          ${marked.parse(chapter.body)}
        `,
      )
      .join("");
    const html = `
      <html>
        <head>
          <title>${topic}</title>
          <style>
            body { font-family: system-ui, sans-serif; color: #1d2333; max-width: 800px; margin: 2rem auto; padding: 1rem; }
            .research-content h1 { font-size: 2rem; font-weight: 700; margin: 1.5rem 0 0.75rem; }
            .research-content h2 { font-size: 1.5rem; font-weight: 700; margin: 1.25rem 0 0.5rem; }
            .research-content h3 { font-size: 1.25rem; font-weight: 600; margin: 1rem 0 0.5rem; }
            .research-content p { margin: 0.5rem 0; line-height: 1.7; }
            .research-content ul, .research-content ol { margin: 0.5rem 0; padding-left: 1.5rem; list-style: revert; }
            .research-content a { color: #2f6bff; text-decoration: underline; }
            .research-content code { background: rgba(15,23,42,0.06); padding: 0.1rem 0.3rem; border-radius: 0.25rem; }
            .research-content blockquote { border-left: 3px solid rgba(15,23,42,0.15); padding-left: 1rem; margin: 0.75rem 0; opacity: 0.85; }
            .research-content img { display: block; max-width: 100%; height: auto; border-radius: 0.75rem; margin: 1rem 0; }
          </style>
        </head>
        <body>
          <h1>${topic}</h1>
          ${cover}
          <div class="research-content">${introHtml}${chaptersHtml}</div>
        </body>
      </html>
    `.replace(/src="\/data\//g, `src="${backendOrigin}/data/`);

    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 500);
  };

  const narrate = () => {
    if (!TANJREEN_API_KEY) {
      showToast({
        type: "danger",
        message: "Tanjreen API key is not configured",
      });
      return;
    }

    const text = content
      .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const form = new FormData();
    form.append("bookTitle", topic || "Untitled");
    form.append("voice", "echo");
    form.append("text", text);

    // no-cors strips custom headers, so send the key via query parameter as
    // documented in the Tanjreen API.
    const url = `${TANJREEN_API_URL}?apiKey=${encodeURIComponent(TANJREEN_API_KEY)}`;

    fetch(url, {
      method: "POST",
      mode: "no-cors",
      body: form,
    });

    showToast({ type: "info", message: "Narration request sent" });
  };

  const handleDeleteCourse = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(
        `${API_DELETE_COURSE}/${encodeURIComponent(topic)}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        },
      );
      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error || "Failed to delete course");
      }
      showToast({ type: "success", message: "Course deleted" });
      navigate(ROUTE_COURSES);
    } catch (err) {
      showToast({
        type: "danger",
        message: err.message || "Failed to delete course",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const openEditModal = async () => {
    setEditTitle(topic);
    setEditLanguage(courseLanguage);
    setEditSubjectIds(new Set(courseSubjectIds));
    setSelectedCoverImage(coverImagePath);
    setShowEditModal(true);
    try {
      const res = await fetch(
        `${API_GET_COURSE_IMAGES}?topic=${encodeURIComponent(topic)}`,
        { headers: authHeaders() },
      );
      const result = await res.json();
      if (res.ok && result.data?.images) {
        setCourseImages(result.data.images);
      }
    } catch {
      // ignore image loading errors
    }
  };

  const handleSaveEdit = async () => {
    const title = editTitle.trim();
    if (!title) {
      showToast({ type: "danger", message: "Title is required" });
      return;
    }
    setIsSavingEdit(true);
    try {
      const response = await fetch(
        `${API_PUT_COURSE}/${encodeURIComponent(topic)}`,
        {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({
            title,
            language: editLanguage,
            subjectIds: Array.from(editSubjectIds),
          }),
        },
      );
      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error || "Failed to update course");
      }

      if (selectedCoverImage && selectedCoverImage !== coverImagePath) {
        const coverRes = await fetch(API_PUT_COURSE_COVER, {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({
            topic,
            coverImagePath: selectedCoverImage,
          }),
        });
        const coverResult = await coverRes.json();
        if (!coverRes.ok || coverResult.error) {
          throw new Error(coverResult.error || "Failed to update cover image");
        }
      }

      showToast({ type: "success", message: "Course updated" });
      setShowEditModal(false);
      // Navigate to the new course URL if the title changed.
      const newId = result.data?.id;
      if (newId && newId !== topic) {
        navigate(`${ROUTE_LEARN}/${encodeURIComponent(newId)}`, {
          replace: true,
        });
      } else {
        // Refresh the current page so the updated subjects/language/cover are reflected.
        window.location.reload();
      }
    } catch (err) {
      showToast({
        type: "danger",
        message: err.message || "Failed to update course",
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const saveHighlights = async (newHighlights, message = "Highlight saved") => {
    try {
      const res = await fetch(API_PUT_COURSE_HIGHLIGHTS, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          topic,
          highlights: newHighlights,
        }),
      });
      const result = await res.json();
      if (!res.ok || result.error) {
        throw new Error(result.error || "Failed to save highlights");
      }
      setHighlights(newHighlights);
      showToast({ type: "success", message });
    } catch (err) {
      showToast({
        type: "danger",
        message: err.message || "Failed to save highlights",
      });
    }
  };

  const deleteHighlight = (text, highlightId, chapter) => {
    const id = Number(highlightId);
    const newHighlights = highlights.filter(
      (h) => !(h.text === text && h.highlightId === id && h.chapter === chapter),
    );
    saveHighlights(newHighlights, "Highlight removed");
  };

  const getChapterFromSelection = (selection) => {
    if (!selection.rangeCount) return "";
    const range = selection.getRangeAt(0);
    let node = range.commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }
    const section = node.closest("section[id]");
    if (!section) return "";
    const chapter = chapters.find(
      (c) => chapterSlug(c.title) === section.id,
    );
    return chapter?.title || "";
  };

  const handleTextSelection = (e) => {
    if (!activeHighlightId) return;

    const target =
      e.target.nodeType === Node.TEXT_NODE ? e.target.parentElement : e.target;
    if (target.closest(".highlight-delete")) return;
    if (target.closest(".highlight-note")) return;

    const selection = window.getSelection();
    const text = selection.toString().trim();
    if (!text) return;

    const chapter = getChapterFromSelection(selection);
    setPendingHighlight({ text, highlightId: activeHighlightId, chapter });
    setHighlightNote("");
    setShowNoteModal(true);
    selection.removeAllRanges();
  };

  const savePendingHighlight = (withNote) => {
    if (!pendingHighlight) return;
    const newHighlight = {
      ...pendingHighlight,
      note: withNote ? highlightNote.trim() : "",
    };
    saveHighlights(
      [...highlights, newHighlight],
      withNote ? "Highlight and note saved" : "Highlight saved",
    );
    setShowNoteModal(false);
    setPendingHighlight(null);
    setHighlightNote("");
  };

  const handleContentClick = (e) => {
    const target =
      e.target.nodeType === Node.TEXT_NODE ? e.target.parentElement : e.target;
    const deleteBtn = target.closest(".highlight-delete");
    const noteBtn = target.closest(".highlight-note");

    if (deleteBtn) {
      const text = deleteBtn.getAttribute("data-highlight-text");
      const highlightId = deleteBtn.getAttribute("data-highlight-id");
      const chapter = deleteBtn.getAttribute("data-highlight-chapter") || "";
      if (text && highlightId) {
        deleteHighlight(text, highlightId, chapter);
      }
      return;
    }

    if (noteBtn) {
      const note = noteBtn.getAttribute("data-highlight-note") || "";
      const text = noteBtn.getAttribute("data-highlight-text") || "";
      const chapter = noteBtn.getAttribute("data-highlight-chapter") || "";
      const label = noteBtn.getAttribute("data-highlight-label") || "";
      setViewingNote({ note, text, chapter, label });
    }
  };

  return (
    <div className='flex h-full gap-8 overflow-x-hidden'>
      <div
        onMouseUp={handleTextSelection}
        onClick={handleContentClick}
        className='min-w-[400px] flex-1 max-w-[800px] overflow-y-auto h-[calc(100vh-100px)] overflow-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
      >
        <Button secondary className='mb-6' onClick={() => navigate(ROUTE_HOME)}>
          <ion-icon name='arrow-back-outline'></ion-icon>
          <span className='ml-2'>Back</span>
        </Button>

        <div className='relative mb-6'>
          {coverImagePath ? (
            <Thumbnail
              src={coverImagePath}
              alt={topic}
              className='h-48 w-full rounded-2xl'
            />
          ) : (
            <div className='flex h-48 w-full items-center justify-center rounded-2xl bg-dr-accent/20'>
              <ion-icon
                name='image-outline'
                className='text-4xl text-dr-accent/60'
              />
            </div>
          )}
          <div className='absolute right-3 top-3 z-10 flex items-center gap-2'>
            <button
              type='button'
              onClick={openEditModal}
              className='flex items-center gap-2 rounded-xl border border-dr-border bg-dr-surface px-3 py-2 text-sm font-semibold text-dr-text shadow-sm transition-colors hover:bg-dr-surface-light'
              aria-label='Edit course'
            >
              <ion-icon name='create-outline' />
              <span>Edit</span>
            </button>
            <button
              type='button'
              onClick={createCoverImage}
              disabled={coverImageLoading}
              className='flex items-center gap-2 rounded-xl border border-dr-border bg-dr-surface px-3 py-2 text-sm font-semibold text-dr-text shadow-sm transition-colors hover:bg-dr-surface-light disabled:opacity-60'
            >
              {coverImageLoading ? (
                <Loading size={18} />
              ) : (
                <ion-icon name='image-outline' />
              )}
              <span>{coverImagePath ? "Recreate" : "Create"}</span>
            </button>
          </div>
        </div>

        {chapters.length > 0 && (
          <div className='mb-6 rounded-2xl border border-dr-border bg-dr-surface p-4'>
            <div className='mb-2 flex items-center justify-between text-sm'>
              <span className='font-semibold text-dr-text'>
                Reading progress
              </span>
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
            dangerouslySetInnerHTML={{
              __html: renderMarkdownWithHighlights(intro),
            }}
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
              <h4 className='font-bold tet-xl mb-2 text-blue-500/80'>
                {chapter.title}
              </h4>

              <div
                className='research-content'
                dangerouslySetInnerHTML={{
                  __html: renderMarkdownWithHighlights(
                    chapter.body,
                    chapter.title,
                  ),
                }}
              />
                  {/* chapter heading with its summary image action */}
                  <div className='mb-3 flex items-start justify-between gap-4'>
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
                        <span>Mark read</span>
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
                            <span className='ml-2'>Menmonic summary</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </section>
              );
            })}
      </div>

      <div className={`${state.isLearnMenuOpen ? 'fixed inset-0 z-50 bg-dr-surface p-4 flex flex-col' : 'hidden'} md:flex md:flex-col md:sticky md:top-0 md:self-start md:border-l md:border-dr-border md:pl-4 md:h-[calc(100vh-100px)] overflow-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden w-full md:max-w-[400px] md:bg-transparent md:z-auto md:p-0`}>
        {state.isLearnMenuOpen && (
          <div className='mb-4 flex items-center justify-between md:hidden'>
            <h3 className='text-sm font-semibold uppercase tracking-wide text-dr-text-muted'>Menu</h3>
            <button
              type='button'
              onClick={closeLearnMenu}
              className='flex items-center gap-2 rounded-xl border border-dr-border bg-dr-surface px-3 py-2 text-sm font-semibold text-dr-text shadow-sm transition-colors hover:bg-dr-surface-light'
              aria-label='Close menu'
            >
              <ion-icon name='close-outline'></ion-icon>
              <span>Close</span>
            </button>
          </div>
        )}
        <div className='order-1 md:order-3'>
          <ChatPanel topic={topic} chapters={chapters} />
        </div>
        <div className='order-2 md:order-2 mb-4'>
          <h3 className='mb-2 text-xs font-semibold uppercase tracking-wide text-dr-text-muted'>
            Highlighter
          </h3>
          {userHighlights.length === 0 ? (
            <p className='text-xs text-dr-text-muted'>
              No highlights yet. Create them in the Highlights page.
            </p>
          ) : (
            <div className='flex flex-wrap items-center gap-2'>
              {userHighlights.map((highlight) => {
                const selected = activeHighlightId === highlight.id;
                return (
                  <button
                    key={highlight.id}
                    type='button'
                    onClick={() => {
                      setActiveHighlightId(selected ? null : highlight.id);
                      if (!selected) closeLearnMenu();
                    }}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                      selected
                        ? "border-dr-text bg-dr-surface-light"
                        : "border-dr-border bg-dr-surface hover:bg-dr-surface-light"
                    }`}
                    title={highlight.description || highlight.label}
                  >
                    <span
                      className='inline-block h-4 w-4 rounded-full'
                      style={{ backgroundColor: highlight.color }}
                    />
                    <span>{highlight.label}</span>
                  </button>
                );
              })}
            </div>
          )}
          <p className='mt-1 text-xs text-dr-text-muted'>
            {activeHighlightId
              ? "Drag to highlight text"
              : "Choose a highlight to start highlighting"}
          </p>
        </div>

        <div className='order-3 md:order-4 mb-4'>
          <h3 className='mb- text-xs font-semibold uppercase tracking-wide text-dr-text-muted'>
            Actions
          </h3>
          <div className='flex flex-col gap-2'>
            <Button secondary className='w-full' onClick={downloadPDF}>
              <ion-icon name='download-outline'></ion-icon>
              <span className='ml-2'>Download PDF</span>
            </Button>
            <Button secondary className='w-full' onClick={narrate}>
              <ion-icon name='musical-notes-outline'></ion-icon>
              <span className='ml-2'>Narrate</span>
            </Button>
            <Button
              danger
              className='w-full'
              onClick={() => setShowDeleteModal(true)}
            >
              <ion-icon name='trash-outline'></ion-icon>
              <span className='ml-2'>Delete course</span>
            </Button>
          </div>
        </div>

        {chapters.length > 0 && (
          <div className='order-4 md:order-1 py-4'>
            <div className='mb-3 flex items-center justify-between'>
              <h3 className='text-xs font-semibold uppercase tracking-wide text-dr-text-muted'>
                Chapters
              </h3>
              <button
                type='button'
                onClick={() => setIsChaptersOpen((v) => !v)}
                className='hidden md:flex h-6 w-6 items-center justify-center rounded-lg text-dr-text-muted transition-colors hover:bg-dr-surface-light'
                aria-label={isChaptersOpen ? 'Collapse chapters' : 'Expand chapters'}
              >
                <ion-icon name={isChaptersOpen ? 'chevron-up-outline' : 'chevron-down-outline'}></ion-icon>
              </button>
            </div>
            <ul className={`flex flex-col gap-1 ${!isChaptersOpen ? 'md:hidden' : ''}`}>
              {chapters.map((chapter) => {
                const isRead = readChapters.has(chapter.title);
                return (
                  <li key={chapter.title}>
                    <button
                      type='button'
                      onClick={() => scrollToChapter(chapter.title)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                        isRead
                          ? "text-dr-success"
                          : "text-dr-text-muted hover:bg-dr-surface-light hover:text-dr-text"
                      }`}
                    >
                      {isRead ? (
                        <ion-icon
                          name='checkmark-circle'
                          className='shrink-0'
                        />
                      ) : (
                        <ion-icon
                          name='ellipse-outline'
                          className='shrink-0 text-dr-text-muted'
                        />
                      )}
                      <span>{chapter.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <ConfirmationModal
          open={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteCourse}
          title='Delete course'
          message={`Are you sure you want to delete "${topic}"? This action cannot be undone.`}
          confirmText='Delete'
          cancelText='Cancel'
          confirmVariant='danger'
          isLoading={isDeleting}
        />

        <Modal
          open={showNoteModal}
          onClose={() => savePendingHighlight(false)}
          title={`Add a note to ${
            userHighlights.find((h) => h.id === pendingHighlight?.highlightId)
              ?.label || "highlight"
          }`}
          zIndex={30}
        >
          <div className='flex flex-col gap-4'>
            <p className='text-sm text-dr-text-muted'>
              Optional: add a note for the selected text, or close to save the highlight without a note.
            </p>
            <textarea
              value={highlightNote}
              onChange={(e) => setHighlightNote(e.target.value)}
              placeholder='Write your note here...'
              rows={4}
              className='w-full resize-none rounded-xl border border-dr-border bg-dr-surface px-4 py-3 text-sm text-dr-text outline-none transition-colors placeholder:text-dr-text-muted focus:border-dr-accent focus:ring-2 focus:ring-dr-accent/25'
              autoFocus
            />
            <div className='flex justify-end gap-2'>
              <Button
                secondary
                onClick={() => savePendingHighlight(false)}
              >
                Skip
              </Button>
              <Button primary onClick={() => savePendingHighlight(true)}>
                Save note
              </Button>
            </div>
          </div>
        </Modal>

        <Modal
          open={viewingNote != null}
          onClose={() => setViewingNote(null)}
          title={viewingNote?.label ? `Note: ${viewingNote.label}` : "Note"}
          zIndex={30}
        >
          <div className='flex flex-col gap-4'>
            {viewingNote?.chapter && (
              <p className='text-xs font-medium text-dr-text-muted'>
                {viewingNote.chapter}
              </p>
            )}
            {viewingNote?.text && (
              <div className='rounded-xl border-l-4 border-dr-accent bg-dr-surface-light p-3'>
                <p className='text-sm italic text-dr-text'>
                  "{viewingNote.text}"
                </p>
              </div>
            )}
            <div className='rounded-xl bg-dr-surface-light p-3'>
              <p className='text-sm text-dr-text'>
                {viewingNote?.note || "No note"}
              </p>
            </div>
            <div className='flex justify-end'>
              <Button secondary onClick={() => setViewingNote(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>

        <Modal
          open={showEditModal}
          onClose={() => setShowEditModal(false)}
          title='Edit course'
          zIndex={20}
        >
          <div className='flex flex-col gap-4'>
            <div>
              <label className='mb-1 block text-sm font-medium text-dr-text'>
                Title
              </label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder='Course title'
              />
            </div>
            <div>
              <label className='mb-1 block text-sm font-medium text-dr-text'>
                Language
              </label>
              <Select
                value={editLanguage}
                onChange={(val) => setEditLanguage(val)}
                options={[
                  { value: "", label: "Select language" },
                  { value: "english", label: "English" },
                  { value: "spanish", label: "Spanish" },
                  { value: "italian", label: "Italian" },
                  { value: "german", label: "German" },
                  { value: "koine greek", label: "Koine Greek" },
                ]}
              />
            </div>
            <div>
              <label className='mb-1 block text-sm font-medium text-dr-text'>
                Subjects
              </label>
              <div className='flex flex-wrap gap-2'>
                {subjects.map((subject) => {
                  const selected = editSubjectIds.has(subject.id);
                  return (
                    <button
                      key={subject.id}
                      type='button'
                      onClick={() => {
                        const next = new Set(editSubjectIds);
                        if (next.has(subject.id)) next.delete(subject.id);
                        else next.add(subject.id);
                        setEditSubjectIds(next);
                      }}
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
                      <span className='line-clamp-1'>{subject.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {courseImages.length > 0 && (
              <div>
                <label className='mb-1 block text-sm font-medium text-dr-text'>
                  Thumbnail
                </label>
                <div className='grid grid-cols-3 gap-2'>
                  {courseImages.map((image) => {
                    const selected = selectedCoverImage === image;
                    return (
                      <button
                        key={image}
                        type='button'
                        onClick={() => setSelectedCoverImage(image)}
                        className={`relative overflow-hidden rounded-xl border-2 transition-all ${
                          selected
                            ? "border-dr-accent"
                            : "border-transparent hover:border-dr-border"
                        }`}
                      >
                        <img
                          src={image}
                          alt='Course thumbnail option'
                          className='aspect-square w-full object-cover'
                        />
                        {selected && (
                          <div className='absolute right-1 top-1 rounded-full bg-dr-accent p-1 text-white'>
                            <ion-icon name='checkmark-outline' />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className='flex justify-end gap-2'>
              <Button
                secondary
                onClick={() => setShowEditModal(false)}
                disabled={isSavingEdit}
              >
                Cancel
              </Button>
              <Button
                primary
                onClick={handleSaveEdit}
                isLoading={isSavingEdit}
                disabled={isSavingEdit}
              >
                Save
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};