/* eslint-disable react/prop-types */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  TextArea,
  Tooltip,
  PopupMenu,
  PopupMenuItem,
  IfElse,
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
  API_POST_COURSE_SHARE,
  API_GET_SHARED_LESSON,
  API_POST_COURSE_LEAVE,
  API_POST_NOTES,
  API_BASE,
  ROUTE_LEARN,
  ROUTE_COURSES,
  // Narrate feature disabled for now — unused
  // TANJREEN_API_URL,
  // TANJREEN_API_KEY,
} from "@constants";
import { splitChapters } from "./splitChapters";
import { findHighlightMatches } from "./highlightMatches";
import { ChatWidget } from "./ChatWidget";
import { CollaborateModal } from "./CollaborateModal";
import { authHeaders } from "@utils";
import { useAppContext } from "@views/context/appContextProvider";
import { LoginForm } from "../auth/components/LoginForm/LoginForm";
import { SignupForm } from "../auth/components/SignupForm/SignupForm";
import { avatars } from "@images";
import zapohtehLogo from "../../../public/logo.webp";

// turns a chapter title into a DOM id that can be used as an anchor target
const chapterSlug = (title) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const SharedNoteCard = ({ note }) => {
  const chosenAvatar = avatars.find((a) => a.pathName === note.authorAvatar);
  return (
    <div className='rounded-xl border border-dr-border bg-dr-surface p-3 shadow-sm transition-shadow hover:shadow-md'>
      <div className='mb-2 flex items-center justify-between'>
        <div className='flex min-w-0 items-center gap-2'>
          <div className='flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-dr-accent-light text-[10px] font-semibold text-dr-accent'>
            {chosenAvatar?.image ? (
              <img
                src={chosenAvatar.image}
                alt={note.author}
                className='h-full w-full object-cover'
              />
            ) : (
              (note.author || "?").charAt(0).toUpperCase()
            )}
          </div>
          {note.author && (
            <span className='truncate text-xs font-medium text-dr-text'>
              @{note.author}
            </span>
          )}
          <span className='shrink-0 text-xs text-dr-text-muted'>
            {new Date(note.updatedAt).toLocaleDateString()}
          </span>
        </div>
      </div>
      <div>
        {note.body ? (
          <div
            className='research-content text-sm text-dr-text'
            dangerouslySetInnerHTML={{
              __html: marked.parse(note.body || "", { async: false }),
            }}
          />
        ) : (
          <span className='text-sm text-dr-text-muted'>Empty note</span>
        )}
      </div>
    </div>
  );
};

const CourseNavigation = ({ chapters, readChapters, onChapterClick, actions, isOpen, onToggle }) => {
  const [activeTab, setActiveTab] = useState("chapters");

  return (
    <div className={`flex flex-col gap-3 ${isOpen ? "w-full" : "w-12 shrink-0"}`}>
      <button
        type='button'
        onClick={onToggle}
        aria-label={isOpen ? "Collapse course panel" : "Expand course panel"}
        aria-expanded={isOpen}
        title={isOpen ? "Collapse course panel" : "Expand course panel"}
        className={`flex h-10 items-center rounded-lg text-dr-text-muted hover:bg-dr-surface-light ${isOpen ? "justify-end px-3" : "justify-center"}`}
      >
        <ion-icon name={isOpen ? "chevron-forward-outline" : "chevron-back-outline"} className='text-xl' />
      </button>
      <div aria-label='Course panel sections' className={`flex gap-1 ${isOpen ? "flex-row" : "flex-col"}`}>
        {[
          { id: "chapters", label: "Chapters", icon: "list-outline" },
          { id: "actions", label: "Actions", icon: "ellipsis-horizontal-outline" },
        ].map((tab) => (
          <button
            key={tab.id}
            type='button'
            onClick={() => setActiveTab(tab.id)}
            aria-label={tab.label}
            aria-pressed={activeTab === tab.id}
            title={tab.label}
            className={`flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-lg text-xs font-semibold transition-colors ${isOpen ? "flex-1 px-0.5" : "w-full"} ${activeTab === tab.id ? "bg-dr-accent-light text-dr-accent" : "text-dr-text-muted hover:bg-dr-surface-light"}`}
          >
            <ion-icon name={tab.icon} className='shrink-0 text-base' />
            {isOpen && <span>{tab.label}</span>}
          </button>
        ))}
      </div>
      {activeTab === "chapters" ? (
        <ul className='flex flex-col gap-1'>
          {chapters.map((chapter, index) => {
            const isRead = readChapters.has(index);
            return (
              <li key={index}>
                <button
                  type='button'
                  onClick={() => onChapterClick(index)}
                  aria-label={`Chapter ${index + 1}: ${chapter.title}${isRead ? ", read" : ""}`}
                  title={chapter.title}
                  className={`flex w-full items-center gap-2 rounded-lg py-1.5 text-left text-sm text-dr-text-muted transition-colors hover:bg-dr-surface-light hover:text-dr-text ${isOpen ? "px-2" : "justify-center"}`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs ${isRead ? "bg-dr-success font-bold text-white" : "border border-dr-border bg-dr-surface font-medium text-dr-text-muted"}`}>
                    {index + 1}
                  </span>
                  {isOpen && <span className='min-w-0 break-words'>{chapter.title}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className='flex flex-col gap-2'>
          {actions.map((action) => (
            <button
              key={action.label}
              type='button'
              onClick={action.onClick}
              disabled={action.disabled}
              aria-label={action.label}
              title={action.label}
              className={`flex min-h-10 items-center gap-2 rounded-xl border text-sm font-semibold transition-colors disabled:opacity-50 ${isOpen ? "w-full px-3" : "w-12 justify-center"} ${action.danger ? "border-dr-danger text-dr-danger hover:bg-dr-danger/10" : "border-dr-border bg-dr-surface text-dr-text hover:bg-dr-surface-light"}`}
            >
              <ion-icon name={action.icon} className='shrink-0 text-lg' />
              {isOpen && <span>{action.label}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* *************************************************************************************************
 * Renders the assembled markdown research for a single topic, split into chapters so each chapter
 * heading can carry a "Create summary image" button. Clicking the button asks the backend to
 * generate a summarizing image and returns the updated content, which is re-rendered in place.
 * *************************************************************************************************
 */
export const LearnView = () => {
  const { topic: routeTopic, token } = useParams();
  const navigate = useNavigate();
  const { showToast, state, closeLearnMenu } = useAppContext();

  const isShared = Boolean(token);

  // tracks whether the "x" key is currently held down, so the user can
  // press x while selecting text to copy it without opening the note modal
  const xKeyHeld = useRef(false);

  const [content, setContent] = useState("");
  const [bibliography, setBibliography] = useState("");
  const [coverImagePath, setCoverImagePath] = useState("");
  const [courseLanguage, setCourseLanguage] = useState("");
  // declared chapter titles and whether the lesson was imported from a source;
  // imported lessons use the titles to split chapters (see splitChapters)
  const [chapterTitles, setChapterTitles] = useState(null);
  const [isImportedLesson, setIsImportedLesson] = useState(false);
  const [loading, setLoading] = useState(true);
  // titles of chapters whose images are currently being generated
  const [generating, setGenerating] = useState(new Set());
  // zero-based indices of chapters that have been marked as read
  const [readChapters, setReadChapters] = useState(new Set());
  // all available subjects and the ids currently assigned to this course
  const [subjects, setSubjects] = useState([]);
  const [courseSubjectIds, setCourseSubjectIds] = useState(new Set());
  const [coverImageLoading, setCoverImageLoading] = useState(false);
  // token of the public share link when the lesson is shared, "" otherwise
  const [shareToken, setShareToken] = useState("");
  // caller's role on this lesson: "owner" or "collaborator" (drives which
  // management controls are rendered)
  const [role, setRole] = useState("owner");
  const [showCollaborateModal, setShowCollaborateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isChaptersOpen, setIsChaptersOpen] = useState(false);
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
  const [showHighlightPopup, setShowHighlightPopup] = useState(false);
  const [pendingHighlight, setPendingHighlight] = useState(null);
  const [highlightNote, setHighlightNote] = useState("");
  const [editingHighlight, setEditingHighlight] = useState(null);
  const [viewingNote, setViewingNote] = useState(null);

  // Shared-view specific states
  const [sharedData, setSharedData] = useState(null);
  const [sharedNotes, setSharedNotes] = useState([]);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authPromptMessage, setAuthPromptMessage] = useState("");
  const [showNoPermissionsModal, setShowNoPermissionsModal] = useState(false);
  const [showAbandonModal, setShowAbandonModal] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const sharedContentRef = useRef(null);
  const chapterRefs = useRef([]);

  const topic = isShared ? sharedData?.title || "" : routeTopic || "";
  const access = isShared ? sharedData?.access || "anonymous" : role;
  const canOpenInApp = access === "owner" || access === "collaborator";
  const isAuthenticated = state.isAuthenticated;

  useEffect(() => {
    setIsChaptersOpen(false);
  }, [routeTopic, token]);

  const renderMarkdownWithHighlights = useCallback((markdown, chapter = "") => {
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

    relevant.forEach(
      ({
        text,
        highlightId,
        chapter: chapterName,
        note,
        color: directColor,
        label,
      }) => {
        if (!text) return;
        const userHighlight = userHighlights.find((h) => h.id === highlightId);
        const color = directColor || userHighlight?.color || "#ffeb3b";
        const highlightLabel = label || userHighlight?.label || "";
        const walker = doc.createTreeWalker(
          body,
          NodeFilter.SHOW_TEXT,
          null,
          false,
        );
        const textNodes = [];
        let contentText = "";
        let previousBlock = null;
        let node;
        while ((node = walker.nextNode())) {
          if (node.parentElement?.closest("mark.highlight, script, style")) {
            contentText += "\0";
            continue;
          }
          const block = node.parentElement?.closest(
            "p, li, h1, h2, h3, h4, h5, h6, blockquote, pre, td, th",
          );
          if (previousBlock && block !== previousBlock) contentText += "\n";
          const start = contentText.length;
          contentText += node.textContent;
          textNodes.push({ node, start, end: contentText.length });
          previousBlock = block;
        }

        const pieces = [];
        findHighlightMatches(contentText, text).forEach((ranges) => {
          const matchPieces = [];
          ranges.forEach(({ start, end }) => {
            textNodes.forEach((entry) => {
              if (entry.start >= end || entry.end <= start) return;
              matchPieces.push({
                node: entry.node,
                start: Math.max(start, entry.start) - entry.start,
                end: Math.min(end, entry.end) - entry.start,
              });
            });
          });
          if (matchPieces.length) {
            matchPieces[matchPieces.length - 1].showActions = true;
            pieces.push(...matchPieces);
          }
        });

        // Process backwards so offsets in each original text node stay valid.
        pieces
          .reverse()
          .forEach(({ node: textNode, start, end, showActions }) => {
            textNode.splitText(end);
            const selected = textNode.splitText(start);
            const mark = doc.createElement("mark");
            mark.className =
              "highlight rounded-md px-1 py-0.5 box-decoration-clone font-normal";
            mark.style.backgroundColor = color;
            selected.parentNode.replaceChild(mark, selected);
            mark.appendChild(selected);
            if (note) mark.setAttribute("title", note);
            if (!showActions) return;

            const actions = doc.createElement("span");
            actions.className =
              "ml-1 inline-flex whitespace-nowrap align-middle items-center gap-1";

            if (!isShared) {
              const editBtn = doc.createElement("button");
              editBtn.className =
                "highlight-edit inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full bg-dr-accent text-white text-[10px] leading-none";
              editBtn.setAttribute("data-highlight-text", text);
              editBtn.setAttribute("data-highlight-id", String(highlightId));
              editBtn.setAttribute("data-highlight-chapter", chapterName || "");
              editBtn.setAttribute("data-highlight-note", note || "");
              editBtn.setAttribute("aria-label", "Edit highlight");
              editBtn.setAttribute("title", "Edit highlight");
              editBtn.innerHTML = "<ion-icon name='create-outline'></ion-icon>";
              actions.appendChild(editBtn);
            }

            if (note) {
              const noteBtn = doc.createElement("button");
              noteBtn.className =
                "highlight-note inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full bg-dr-accent text-white text-[10px] leading-none";
              noteBtn.setAttribute("data-highlight-note", note);
              noteBtn.setAttribute("data-highlight-text", text);
              noteBtn.setAttribute("data-highlight-chapter", chapterName || "");
              noteBtn.setAttribute("data-highlight-label", highlightLabel);
              noteBtn.setAttribute("aria-label", "View note");
              noteBtn.setAttribute("title", "View note");
              noteBtn.innerHTML =
                "<ion-icon name='document-outline'></ion-icon>";
              actions.appendChild(noteBtn);
            }

            if (!isShared) {
              const deleteBtn = doc.createElement("button");
              deleteBtn.className =
                "highlight-delete inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full bg-dr-text text-dr-surface text-[10px] leading-none";
              deleteBtn.setAttribute("data-highlight-text", text);
              deleteBtn.setAttribute("data-highlight-id", String(highlightId));
              deleteBtn.setAttribute(
                "data-highlight-chapter",
                chapterName || "",
              );
              deleteBtn.setAttribute("aria-label", "Remove highlight");
              deleteBtn.setAttribute("title", "Remove highlight");
              deleteBtn.textContent = "×";
              actions.appendChild(deleteBtn);
            }

            mark.appendChild(actions);
          });
      },
    );

    return body.innerHTML;
  }, [highlights, userHighlights, isShared]);

  const { intro, chapters } = useMemo(
    () => splitChapters(content, isImportedLesson ? chapterTitles : null),
    [content, isImportedLesson, chapterTitles],
  );
  const renderedIntro = useMemo(
    () => renderMarkdownWithHighlights(intro),
    [intro, renderMarkdownWithHighlights],
  );
  const renderedChapters = useMemo(
    () => chapters.map((chapter) => renderMarkdownWithHighlights(chapter.body, chapter.title)),
    [chapters, renderMarkdownWithHighlights],
  );

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "x" || e.key === "X") xKeyHeld.current = true;
    };
    const handleKeyUp = (e) => {
      if (e.key === "x" || e.key === "X") xKeyHeld.current = false;
    };
    // reset if the window loses focus so the state can't get stuck
    const handleBlur = () => {
      xKeyHeld.current = false;
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  const loadSharedLesson = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_GET_SHARED_LESSON}/${encodeURIComponent(token)}`,
        { headers: authHeaders(null) },
      );
      const result = await res.json();
      if (!result.success || !result.data) {
        showToast({
          type: "danger",
          message: String(
            result.error || "This share link is invalid or has been disabled.",
          ),
        });
        setSharedData(null);
        return;
      }
      const d = result.data;
      setSharedData(d);
      setContent(d.content || "");
      setBibliography(d.bibliography || "");
      setCoverImagePath(d.coverImagePath || "");
      setCourseLanguage(d.language || "");
      setChapterTitles(d.chapters || null);
      setIsImportedLesson(!!d.imported);
      setRole(
        d.access === "owner"
          ? "owner"
          : d.access === "collaborator"
            ? "collaborator"
            : "viewer",
      );
      setHighlights(d.highlights || []);
      setUserHighlights(d.userHighlights || []);
      setSharedNotes(d.notes || []);
    } catch {
      showToast({
        type: "danger",
        message: "Could not load this shared lesson.",
      });
      setSharedData(null);
    } finally {
      setLoading(false);
    }
  }, [token, showToast]);

  useEffect(() => {
    if (isShared) {
      loadSharedLesson();
      return;
    }

    if (!routeTopic) return;

    const controller = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const [topicRes, progressRes, subjectsRes, courseSubjectsRes] =
          await Promise.all([
            fetch(`${API_GET_TOPIC}?name=${encodeURIComponent(routeTopic)}`, {
              signal: controller.signal,
              headers: authHeaders(),
            }),
            fetch(
              `${API_GET_READING_PROGRESS}?course=${encodeURIComponent(routeTopic)}`,
              { signal: controller.signal, headers: authHeaders() },
            ),
            fetch(API_GET_SUBJECTS, {
              signal: controller.signal,
              headers: authHeaders(),
            }),
            fetch(
              `${API_GET_COURSE_SUBJECTS}?course=${encodeURIComponent(routeTopic)}`,
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
          setBibliography(topicResult.data?.bibliography || "");
          setCoverImagePath(topicResult.data?.coverImagePath || "");
          setCourseLanguage(topicResult.data?.language || "");
          setShareToken(topicResult.data?.shareToken || "");
          setRole(topicResult.data?.role || "owner");
          setChapterTitles(topicResult.data?.chapters || null);
          setIsImportedLesson(!!topicResult.data?.imported);
        }

        if (progressResult.data && Array.isArray(progressResult.data)) {
          setReadChapters(new Set(progressResult.data.map((i) => Number(i))));
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
              `${API_GET_COURSE_HIGHLIGHTS}?topic=${encodeURIComponent(routeTopic)}`,
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
  }, [isShared, loadSharedLesson, routeTopic, showToast, isAuthenticated]);

  const openAuthPrompt = (mode = "login", message = "") => {
    setAuthMode(mode);
    setAuthPromptMessage(message);
    setIsAuthModalOpen(true);
  };

  const closeAuthPrompt = () => {
    setIsAuthModalOpen(false);
  };

  const requireAuth = (actionType = "note") => {
    if (!isAuthenticated) {
      const msg =
        actionType === "note"
          ? "Log in or create an account to add notes to this lesson."
          : "Log in or create an account to highlight text.";
      openAuthPrompt("signup", msg);
      return false;
    }
    return true;
  };

  const handleAddNote = async () => {
    if (!requireAuth("note")) return;
    if (!canOpenInApp) {
      setShowNoPermissionsModal(true);
      return;
    }

    try {
      const res = await fetch(
        `${API_POST_NOTES}?course=${encodeURIComponent(topic)}`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ body: "" }),
        },
      );
      const result = await res.json();
      if (!res.ok || !result.success || result.error || result.errors) {
        throw new Error(
          result.error || result.errors || "Failed to create note",
        );
      }
      showToast({
        type: "success",
        message: "Note added. Open the lesson in your account to edit it.",
      });
      if (isShared) {
        await loadSharedLesson();
      }
    } catch (err) {
      showToast({
        type: "danger",
        message: err.message || "Failed to create note",
      });
    }
  };

  const handleAbandonPiece = async () => {
    if (!isAuthenticated || access !== "collaborator") return;

    setIsLeaving(true);
    try {
      const res = await fetch(
        `${API_POST_COURSE_LEAVE}/${encodeURIComponent(topic)}/leave`,
        {
          method: "POST",
          headers: authHeaders(null),
        },
      );
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(
          result.errors || result.error || "Failed to leave lesson",
        );
      }
      showToast({
        type: "success",
        message: "You abandoned this piece.",
      });
      setShowAbandonModal(false);
      await loadSharedLesson();
    } catch (err) {
      showToast({
        type: "danger",
        message: err.message || "Failed to leave lesson",
      });
    } finally {
      setIsLeaving(false);
    }
  };

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

  const savePendingHighlight = (withNote) => {
    if (!pendingHighlight?.highlightId) return;
    const newHighlight = {
      ...pendingHighlight,
      note: withNote ? highlightNote.trim() : "",
    };

    let newHighlights;
    if (editingHighlight) {
      newHighlights = highlights.map((h) =>
        h.text === editingHighlight.text &&
        h.highlightId === editingHighlight.highlightId &&
        h.chapter === editingHighlight.chapter
          ? newHighlight
          : h,
      );
    } else {
      newHighlights = [...highlights, newHighlight];
    }

    saveHighlights(
      newHighlights,
      editingHighlight
        ? "Highlight updated"
        : withNote
          ? "Highlight and note saved"
          : "Highlight saved",
    );
    setShowHighlightPopup(false);
    setEditingHighlight(null);
    setPendingHighlight(null);
    setHighlightNote("");
  };

  const cancelPendingHighlight = () => {
    setShowHighlightPopup(false);
    setEditingHighlight(null);
    setPendingHighlight(null);
    setHighlightNote("");
  };

  useEffect(() => {
    if (!showHighlightPopup) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        cancelPendingHighlight();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showHighlightPopup]);

  if (loading) {
    return (
      <div className='flex justify-center py-20'>
        <Loading size={40} />
      </div>
    );
  }

  const usedChapterIds = new Set();
  const chapterIds = chapters.map((chapter) => {
    const base = chapterSlug(chapter.title) || "chapter";
    let id = base;
    let suffix = 1;
    while (usedChapterIds.has(id)) id = `${base}-${suffix++}`;
    usedChapterIds.add(id);
    return id;
  });

  const toggleRead = async (chapterIndex) => {
    const nextRead = !readChapters.has(chapterIndex);
    setReadChapters((prev) => {
      const next = new Set(prev);
      if (nextRead) next.add(chapterIndex);
      else next.delete(chapterIndex);
      return next;
    });

    if (isShared && !canOpenInApp) {
      // Allow reading progress locally for anonymous / non-collaborator readers
      return;
    }

    try {
      const response = await fetch(API_POST_READING_PROGRESS, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          course: topic,
          chapterIndex,
          read: nextRead,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.errors || "Failed to save reading progress");
      }
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
        if (nextRead) next.delete(chapterIndex);
        else next.add(chapterIndex);
        return next;
      });
    }
  };

  const scrollToChapter = (chapterIndex) => {
    const element = chapterRefs.current[chapterIndex];
    if (element) {
      element.scrollIntoView({ behavior: "auto", block: "start" });
    }
    closeLearnMenu();
  };

  // Enables the public share link for this lesson and copies it to the
  // clipboard. Sharing an already shared lesson copies the existing link.
  const shareCourse = async () => {
    try {
      const res = await fetch(
        `${API_POST_COURSE_SHARE}/${encodeURIComponent(topic)}/share`,
        { method: "POST", headers: authHeaders() },
      );
      const result = await res.json();
      if (!result.success || !result.data?.shareToken) {
        throw new Error(result.error || "Failed to create share link");
      }
      const token = result.data.shareToken;
      setShareToken(token);
      const link = `${window.location.origin}/share/${token}`;
      try {
        await navigator.clipboard.writeText(link);
        showToast({
          type: "success",
          message: "Share link copied to clipboard",
        });
      } catch {
        // clipboard is unavailable (e.g. insecure origin): show the link instead
        showToast({ type: "success", message: link });
      }
    } catch (err) {
      showToast({
        type: "danger",
        message: err.message || "Failed to create share link",
      });
    }
  };

  // Disables the public share link for this lesson.
  const unshareCourse = async () => {
    try {
      const res = await fetch(
        `${API_POST_COURSE_SHARE}/${encodeURIComponent(topic)}/share`,
        { method: "DELETE", headers: authHeaders() },
      );
      const result = await res.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to disable share link");
      }
      setShareToken("");
      showToast({ type: "success", message: "Share link disabled" });
    } catch (err) {
      showToast({
        type: "danger",
        message: err.message || "Failed to disable share link",
      });
    }
  };

  const visibleReadCount = chapters.filter((_, index) => readChapters.has(index)).length;
  const progress = chapters.length
    ? Math.round((visibleReadCount / chapters.length) * 100)
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
            .research-content pre { background: rgba(15,23,42,0.06); padding: 0.75rem 1rem; border-radius: 0.5rem; overflow-x: auto; margin: 0.75rem 0; }
            .research-content pre code { background: transparent; padding: 0; }
            .research-content table { width: 100%; border-collapse: collapse; margin: 0.75rem 0; }
            .research-content th, .research-content td { border: 1px solid rgba(15,23,42,0.15); padding: 0.4rem 0.75rem; text-align: left; }
            .research-content th { background: rgba(15,23,42,0.05); font-weight: 600; }
            .research-content hr { border: none; border-top: 1px solid rgba(15,23,42,0.15); margin: 1rem 0; }
          </style>
        </head>
        <body>
          <h1>${topic}</h1>
          ${cover}
          <div class="research-content">${introHtml}${chaptersHtml}${bibliography ? `<h2>Bibliography</h2>${marked.parse(bibliography)}` : ""}</div>
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

  /* Narrate feature disabled for now — unused
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

    const url = `${TANJREEN_API_URL}?apiKey=${encodeURIComponent(TANJREEN_API_KEY)}`;

    fetch(url, {
      method: "POST",
      mode: "no-cors",
      body: form,
    });

    showToast({ type: "info", message: "Narration request sent" });
  };
  */

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

  const deleteHighlight = (text, highlightId, chapter) => {
    const id = Number(highlightId);
    const newHighlights = highlights.filter(
      (h) =>
        !(h.text === text && h.highlightId === id && h.chapter === chapter),
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
    const section = node.closest("section[data-chapter-index]");
    if (!section) return "";
    const chapter = chapters[Number(section.dataset.chapterIndex)];
    return chapter?.title || "";
  };

  const isSelectionInLesson = (selection) => {
    if (!selection.rangeCount) return false;
    const range = selection.getRangeAt(0);
    const startEl =
      range.startContainer.nodeType === Node.TEXT_NODE
        ? range.startContainer.parentElement
        : range.startContainer;
    const endEl =
      range.endContainer.nodeType === Node.TEXT_NODE
        ? range.endContainer.parentElement
        : range.endContainer;
    return !!(
      startEl?.closest(".research-content") &&
      endEl?.closest(".research-content")
    );
  };

  const handleTextSelection = (e) => {
    // hold x while selecting to copy text without opening the note modal
    if (xKeyHeld.current) return;

    if (isShared) {
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      if (!text) return;
      if (!isAuthenticated) {
        requireAuth("highlight");
        return;
      }
      if (!canOpenInApp) {
        setShowNoPermissionsModal(true);
        return;
      }
    }

    const target =
      e.target.nodeType === Node.TEXT_NODE ? e.target.parentElement : e.target;
    if (target.closest(".highlight-delete")) return;
    if (target.closest(".highlight-edit")) return;
    if (target.closest(".highlight-note")) return;

    const selection = window.getSelection();
    const text = selection.toString().trim();
    if (!text) return;

    if (!isSelectionInLesson(selection)) return;

    const chapter = getChapterFromSelection(selection);

    setPendingHighlight({ text, chapter, highlightId: null });
    setHighlightNote("");
    setEditingHighlight(null);
    setShowHighlightPopup(true);
  };

  const handleContentClick = (e) => {
    const target =
      e.target.nodeType === Node.TEXT_NODE ? e.target.parentElement : e.target;
    const deleteBtn = target.closest(".highlight-delete");
    const editBtn = target.closest(".highlight-edit");
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

    if (editBtn) {
      const text = editBtn.getAttribute("data-highlight-text") || "";
      const highlightId = editBtn.getAttribute("data-highlight-id");
      const chapter = editBtn.getAttribute("data-highlight-chapter") || "";
      const note = editBtn.getAttribute("data-highlight-note") || "";
      setEditingHighlight({
        text,
        highlightId: Number(highlightId),
        chapter,
        note,
      });
      setPendingHighlight({
        text,
        highlightId: Number(highlightId),
        chapter,
        note,
      });
      setHighlightNote(note);
      setShowHighlightPopup(true);
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

  if (isShared) {
    const courseNotes = Array.isArray(sharedNotes)
      ? sharedNotes.filter((n) => (n.body || "").trim())
      : [];
    const highlightNotes = (highlights || []).filter((h) =>
      (h.note || "").trim(),
    );

    return (
      <div className='min-h-screen bg-dr-bg p-3 lg:p-6'>
        <div className='mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[100rem] gap-3 lg:gap-4 lg:min-h-[calc(100vh-3rem)]'>
          {/* LEFT SIDEBAR: Notes Panel */}
          <aside className='sticky top-3 hidden h-[90vh] w-[350px] shrink-0 self-start lg:top-6 lg:block'>
            <div className='flex h-full flex-col gap-4 overflow-y-auto rounded-3xl [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'>
              {/* Branding */}
              <div className='flex items-center gap-3 rounded-xl border border-dr-border bg-dr-surface p-3 shadow-sm'>
                <img
                  src={zapohtehLogo}
                  alt='Logo'
                  className='h-8 w-8 rounded-lg object-contain'
                />
                <span className='text-lg font-bold text-dr-text'>Zapohteh</span>
                <span className='ml-auto rounded-md bg-dr-accent-light px-2 py-0.5 text-xs font-semibold text-dr-accent'>
                  Shared
                </span>
              </div>

              {/* Add note button */}
              <button
                type='button'
                onClick={handleAddNote}
                className='flex w-full items-center justify-end gap-2 text-dr-accent hover:opacity-80 transition-opacity font-medium'
              >
                <span className='text-lg'>+</span>
                Add note
              </button>

              {/* Notes list */}
              <div className='flex flex-1 flex-col gap-4 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'>
                {/* Course Notes */}
                {courseNotes.length > 0 && (
                  <div className='flex flex-col gap-3'>
                    <div className='flex items-center justify-between px-1'>
                      <span className='text-xs font-semibold uppercase tracking-wide text-dr-text-muted'>
                        Course Notes
                      </span>
                      <span className='text-xs text-dr-text-muted'>
                        {courseNotes.length}
                      </span>
                    </div>
                    {courseNotes.map((note, idx) => (
                      <SharedNoteCard
                        key={note.id || `${note.updatedAt}-${idx}`}
                        note={note}
                      />
                    ))}
                  </div>
                )}

                {courseNotes.length === 0 && highlightNotes.length === 0 && (
                  <p className='py-8 text-center text-xs text-dr-text-muted'>
                    No notes yet.
                  </p>
                )}
              </div>
            </div>
          </aside>

          {/* MAIN BODY AREA */}
          <div className='flex min-w-0 flex-1 flex-col gap-3 lg:gap-4'>
            {/* Topbar header */}
            <header className='flex items-center justify-between gap-4 rounded-3xl border border-dr-border bg-dr-surface px-6 py-4 shadow-sm'>
              <div className='flex items-center gap-3 min-w-0'>
                <h2 className='truncate text-lg font-bold text-dr-text'>
                  {topic}
                </h2>
                {sharedData?.owner && (
                  <span className='shrink-0 rounded-full bg-dr-surface-light px-2.5 py-0.5 text-xs font-medium text-dr-text-muted'>
                    by @{sharedData.owner}
                  </span>
                )}
              </div>
              <span className='text-xs text-dr-text-muted shrink-0'>
                Shared lesson
              </span>
            </header>

            {/* Reading view matching LearnView */}
            <main className='flex-1 overflow-y-auto lg:rounded-3xl lg:border lg:border-dr-border lg:bg-dr-surface lg:px-8 lg:py-6 lg:shadow-sm'>
              <div className='flex h-full overflow-x-hidden flex-col md:flex-row'>
                {/* Content column */}
                <div
                  ref={sharedContentRef}
                  onMouseUp={handleTextSelection}
                  onClick={handleContentClick}
                  className='min-w-0 flex-1 overflow-y-auto md:pr-6'
                >
                  {coverImagePath && (
                    <Thumbnail
                      src={coverImagePath}
                      alt={topic}
                      className='mb-6 h-48 w-full rounded-2xl'
                    />
                  )}

                  {intro && (
                    <div
                      className='research-content'
                      dangerouslySetInnerHTML={{
                        __html: renderedIntro,
                      }}
                    />
                  )}

                  {chapters.map((chapter, chapterIndex) => (
                    <section
                      key={chapterIndex}
                      id={chapterIds[chapterIndex]}
                      data-chapter-index={chapterIndex}
                      ref={(element) => { chapterRefs.current[chapterIndex] = element; }}
                      className='mt-8 scroll-mt-6'
                    >
                      <h4 className='mb-2 text-xl font-bold text-blue-500/80'>
                        {chapter.title}
                      </h4>
                      <div
                        className='research-content'
                        dangerouslySetInnerHTML={{
                          __html: renderedChapters[chapterIndex],
                        }}
                      />
                      <div className='mb-3 flex items-start justify-between gap-4'>
                        <div className='flex shrink-0 items-center gap-2'>
                          <button
                            type='button'
                            onClick={() => toggleRead(chapterIndex)}
                            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                              readChapters.has(chapterIndex)
                                ? "border-dr-success bg-dr-success/10 text-dr-success"
                                : "border-dr-border bg-dr-surface text-dr-text-muted hover:bg-dr-surface-light hover:text-dr-text"
                            }`}
                          >
                            <ion-icon
                              name={
                                readChapters.has(chapterIndex)
                                  ? "checkmark-circle"
                                  : "ellipse-outline"
                              }
                            ></ion-icon>
                            <span>Mark read</span>
                          </button>
                        </div>
                      </div>
                    </section>
                  ))}
                  {bibliography && (
                    <section className='mt-8'>
                      <h4 className='mb-2 text-xl font-bold text-blue-500/80'>Bibliography</h4>
                      <div className='research-content' dangerouslySetInnerHTML={{ __html: marked.parse(bibliography) }} />
                    </section>
                  )}
                </div>

                {/* Right column: Actions & Chapters */}
                <div className={`shrink-0 border-l border-dr-border bg-dr-surface ${isChaptersOpen ? "w-full p-3 md:w-[min(30%,400px)]" : "w-14 p-1"}`}>
                  <CourseNavigation
                    key={token}
                    chapters={chapters}
                    readChapters={readChapters}
                    onChapterClick={scrollToChapter}
                    isOpen={isChaptersOpen}
                    onToggle={() => setIsChaptersOpen((open) => !open)}
                    actions={[
                      { label: "Download PDF", icon: "download-outline", onClick: downloadPDF },
                      ...(access === "collaborator" ? [{ label: "Abandon piece", icon: "exit-outline", onClick: () => setShowAbandonModal(true), danger: true, disabled: isLeaving }] : []),
                    ]}
                  />
                </div>
              </div>
            </main>
          </div>
        </div>

        {/* Closable Auth Modal (shown when an anonymous user attempts an action) */}
        <Modal
          open={isAuthModalOpen}
          onClose={closeAuthPrompt}
          title={authMode === "login" ? "Sign In" : "Create Account"}
          closeOnBackdropClick={true}
          showCloseButton={true}
        >
          <div className='flex flex-col gap-4'>
            {authPromptMessage && (
              <p className='text-center text-sm text-dr-text-muted'>
                {authPromptMessage}
              </p>
            )}
            <IfElse condition={authMode === "login"}>
              <LoginForm />
              <SignupForm />
            </IfElse>
            <Button
              secondary
              onClick={() =>
                setAuthMode((prev) => (prev === "login" ? "signup" : "login"))
              }
              className='w-full'
            >
              {authMode === "login" ? "Sign Up Instead" : "Sign In Instead"}
            </Button>
          </div>
        </Modal>

        {/* No permissions modal for logged-in users who are not collaborators */}
        <Modal
          open={showNoPermissionsModal}
          onClose={() => setShowNoPermissionsModal(false)}
          title='No permissions'
          closeOnBackdropClick={true}
          showCloseButton={true}
        >
          <div className='flex flex-col items-center gap-4 text-center p-2'>
            <ion-icon
              name='lock-closed-outline'
              className='text-4xl text-dr-accent'
            ></ion-icon>
            <p className='text-sm text-dr-text'>
              You are logged in, but you do not have permissions to modify this
              lesson. Ask the owner to add you as a collaborator.
            </p>
            <Button
              secondary
              onClick={() => setShowNoPermissionsModal(false)}
              className='w-full'
            >
              Close
            </Button>
          </div>
        </Modal>

        {/* Abandon piece confirmation */}
        <ConfirmationModal
          open={showAbandonModal}
          onClose={() => setShowAbandonModal(false)}
          onConfirm={handleAbandonPiece}
          title='Abandon piece'
          message='Are you sure you want to abandon collaboration on this lesson? It will no longer appear in your shared courses.'
          confirmText='Abandon piece'
          cancelText='Cancel'
          confirmVariant='danger'
          isLoading={isLeaving}
        />

        {/* Highlight note detail modal (available to everyone on shared links) */}
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
                  &quot;{viewingNote.text}&quot;
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
      </div>
    );
  }

  return (
    <div className='flex h-full min-w-0 overflow-x-hidden'>
      <div
        onMouseUp={handleTextSelection}
        onClick={handleContentClick}
        className='min-w-0 flex-1 h-[calc(100vh-72px)] overflow-auto px-4 py-6 lg:px-8 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
      >
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
          {role === "owner" && !isShared && (
            <div className='absolute right-3 top-3 z-10 flex items-center gap-2'>
              <button
                type='button'
                onClick={shareCourse}
                className='flex items-center gap-2 rounded-xl border border-dr-border bg-dr-surface px-3 py-2 text-sm font-semibold text-dr-text shadow-sm transition-colors hover:bg-dr-surface-light'
                aria-label='Share lesson'
                title='Copy the public share link'
              >
                <ion-icon
                  name={shareToken ? "link-outline" : "share-social-outline"}
                />
              </button>
              <PopupMenu
                trigger={
                  <button
                    type='button'
                    className='flex items-center gap-2 rounded-xl border border-dr-border bg-dr-surface px-3 py-2 text-sm font-semibold text-dr-text shadow-sm transition-colors hover:bg-dr-surface-light'
                    aria-label='Share options'
                    title='Share options'
                  >
                    <ion-icon name='ellipsis-vertical-outline' />
                  </button>
                }
              >
                <PopupMenuItem
                  icon={<ion-icon name='eye-off-outline' />}
                  disabled={!shareToken}
                  onClick={unshareCourse}
                >
                  Unshare
                </PopupMenuItem>
                <PopupMenuItem
                  icon={<ion-icon name='people-outline' />}
                  onClick={() => setShowCollaborateModal(true)}
                >
                  Collaborate
                </PopupMenuItem>
              </PopupMenu>
              <button
                type='button'
                onClick={openEditModal}
                className='flex items-center gap-2 rounded-xl border border-dr-border bg-dr-surface px-3 py-2 text-sm font-semibold text-dr-text shadow-sm transition-colors hover:bg-dr-surface-light'
                aria-label='Edit course'
                title='Edit course'
              >
                <ion-icon name='create-outline' />
              </button>
              <button
                type='button'
                onClick={createCoverImage}
                disabled={coverImageLoading}
                className='flex items-center gap-2 rounded-xl border border-dr-border bg-dr-surface px-3 py-2 text-sm font-semibold text-dr-text shadow-sm transition-colors hover:bg-dr-surface-light disabled:opacity-60'
                aria-label={
                  coverImagePath ? "Recreate cover image" : "Create cover image"
                }
                title={
                  coverImagePath ? "Recreate cover image" : "Create cover image"
                }
              >
                {coverImageLoading ? (
                  <Loading size={18} />
                ) : (
                  <ion-icon name='image-outline' />
                )}
              </button>
            </div>
          )}
        </div>

        {chapters.length > 0 && (
          <div className='mb-6 rounded-2xl border border-dr-border bg-dr-surface p-4'>
            <div className='mb-2 flex items-center justify-between text-sm'>
              <span className='font-semibold text-dr-text'>
                Reading progress
              </span>
              <span className='text-dr-text-muted'>
                {visibleReadCount} of {chapters.length} chapters ({progress}%)
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
              __html: renderedIntro,
            }}
          />
        )}

        {chapters.map((chapter, chapterIndex) => {
          const isGenerating = generating.has(chapter.title);
          return (
            <section
              key={chapterIndex}
              id={chapterIds[chapterIndex]}
              data-chapter-index={chapterIndex}
              ref={(element) => { chapterRefs.current[chapterIndex] = element; }}
              className='mt-8 scroll-mt-6'
            >
              <h4 className='font-bold tet-xl mb-2 text-blue-500/80'>
                {chapter.title}
              </h4>

              <div
                className='research-content'
                dangerouslySetInnerHTML={{
                  __html: renderedChapters[chapterIndex],
                }}
              />
              {/* chapter heading with its summary image action */}
              <div className='mb-3 flex items-start justify-between gap-4'>
                <div className='flex shrink-0 items-center gap-2'>
                  <button
                    type='button'
                    onClick={() => toggleRead(chapterIndex)}
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                      readChapters.has(chapterIndex)
                        ? "border-dr-success bg-dr-success/10 text-dr-success"
                        : "border-dr-border bg-dr-surface text-dr-text-muted hover:bg-dr-surface-light hover:text-dr-text"
                    }`}
                  >
                    <ion-icon
                      name={
                        readChapters.has(chapterIndex)
                          ? "checkmark-circle"
                          : "ellipse-outline"
                      }
                    ></ion-icon>
                    <span>Mark read</span>
                  </button>
                  {role === "owner" && (
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
                  )}
                </div>
              </div>
            </section>
          );
        })}
        {bibliography && (
          <section className='mt-8'>
            <h4 className='mb-2 text-xl font-bold text-blue-500/80'>Bibliography</h4>
            <div className='research-content' dangerouslySetInnerHTML={{ __html: marked.parse(bibliography) }} />
          </section>
        )}
      </div>

      {showHighlightPopup && (
        <div className='fixed inset-0 z-30 flex items-center justify-center'>
          <div
            className='absolute inset-0 bg-dr-accent/40'
            onClick={cancelPendingHighlight}
          />
          <div className='relative z-10 w-[90vw] max-w-[60rem] max-h-[90vh] overflow-y-auto rounded-2xl bg-dr-surface p-6 shadow-lg'>
            <div className='relative z-20 mb-6 flex items-center justify-between px-4'>
              <h4 className='flex items-center gap-2 text-xl font-bold'>
                {editingHighlight ? "Edit highlight" : "Highlight"}
                <Tooltip label='How to use ellipses in highlights'>
                  Use ... between excerpts to avoid highlighting the entire text
                </Tooltip>
              </h4>
              <button
                type='button'
                onClick={cancelPendingHighlight}
                className='border-none bg-transparent text-2xl text-dr-text'
                aria-label='Close'
              >
                ×
              </button>
            </div>
            <div className='flex w-full flex-col gap-3'>
              {userHighlights.length === 0 ? (
                <p className='text-xs text-dr-text-muted'>
                  No highlights yet. Create them in the Highlights page.
                </p>
              ) : (
                <>
                  <TextArea
                    value={pendingHighlight?.text || ""}
                    onChange={(e) =>
                      setPendingHighlight((prev) => ({
                        ...prev,
                        text: e.target.value,
                      }))
                    }
                    placeholder='Highlighted text...'
                    minHeight={56}
                    maxHeight={160}
                    className='w-full text-sm'
                  />
                  <div className='flex flex-wrap items-center gap-2'>
                    {userHighlights.map((highlight) => {
                      const selected =
                        pendingHighlight?.highlightId === highlight.id;
                      return (
                        <button
                          key={highlight.id}
                          type='button'
                          onClick={() =>
                            setPendingHighlight((prev) => ({
                              ...prev,
                              highlightId: highlight.id,
                            }))
                          }
                          className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                            selected ? "border-dr-text" : "border-transparent"
                          }`}
                          style={{ backgroundColor: highlight.color }}
                          title={highlight.label}
                          aria-label={highlight.label}
                        >
                          {selected && (
                            <span className='text-xs text-white'>✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <TextArea
                    value={highlightNote}
                    onChange={(e) => setHighlightNote(e.target.value)}
                    placeholder='Add a note (optional)...'
                    minHeight={150}
                    maxHeight={400}
                    autoFocus={!editingHighlight}
                    className='w-full overscroll-contain text-sm'
                  />
                </>
              )}
              <div className='flex justify-end gap-2'>
                <Button
                  secondary
                  className='px-3 py-1.5 text-xs'
                  onClick={cancelPendingHighlight}
                >
                  Cancel
                </Button>
                <Button
                  primary
                  className='px-3 py-1.5 text-xs'
                  disabled={!pendingHighlight?.highlightId}
                  onClick={() => savePendingHighlight(!!highlightNote.trim())}
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className={`${state.isLearnMenuOpen ? "fixed inset-0 z-50 flex flex-col p-4" : "hidden"} bg-dr-surface md:sticky md:top-0 md:z-auto md:flex md:h-[calc(100vh-72px)] md:shrink-0 md:self-start md:border-l md:border-dr-border ${isChaptersOpen ? "md:w-[min(30%,400px)] md:p-3" : "md:w-14 md:p-[3px]"} overflow-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden`}
      >
        {state.isLearnMenuOpen && (
          <div className='mb-4 flex items-center justify-between md:hidden'>
            <h3 className='text-sm font-semibold uppercase tracking-wide text-dr-text-muted'>
              Menu
            </h3>
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
        <CourseNavigation
          key={routeTopic}
          chapters={chapters}
          readChapters={readChapters}
          onChapterClick={scrollToChapter}
          isOpen={isChaptersOpen}
          onToggle={() => setIsChaptersOpen((open) => !open)}
          actions={[
            { label: "Download PDF", icon: "download-outline", onClick: downloadPDF },
            ...(role === "owner" ? [{ label: "Delete course", icon: "trash-outline", onClick: () => setShowDeleteModal(true), danger: true }] : []),
          ]}
        />

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
          zIndex={60}
        />

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
                  &quot;{viewingNote.text}&quot;
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

      {!isShared && <ChatWidget topic={topic} chapters={chapters} />}

      {role === "owner" && (
        <CollaborateModal
          open={showCollaborateModal}
          onClose={() => setShowCollaborateModal(false)}
          topic={topic}
        />
      )}
    </div>
  );
};
