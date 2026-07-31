import { useState, useEffect, useRef, useCallback } from "react";
import {
  API_GET_STICKIES,
  API_POST_STICKIES,
  API_PUT_STICKIES,
  API_DELETE_STICKIES,
} from "@constants";
import { authHeaders } from "@utils";
import { useAppContext } from "@views/context/appContextProvider";

const MIN_WIDTH = 180;
const MIN_HEIGHT = 140;

export const StickiesPanel = ({ topic, visible }) => {
  const { showToast } = useAppContext();
  const [stickies, setStickies] = useState([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${API_GET_STICKIES}?course=${encodeURIComponent(topic)}`,
          { headers: authHeaders() },
        );
        const result = await res.json();
        if (!cancelled && result.success && Array.isArray(result.data)) {
          setStickies(result.data);
        }
      } catch (err) {
        if (!cancelled) {
          showToast({
            type: "danger",
            message: err.message || "Failed to load stickies",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [topic, visible, showToast]);

  const saveSticky = useCallback(
    async (id, updates) => {
      const sticky = stickies.find((s) => s.id === id);
      if (!sticky) return;
      const updated = { ...sticky, ...updates };
      if ("x" in updated) updated.x = Math.round(updated.x);
      if ("y" in updated) updated.y = Math.round(updated.y);
      if ("width" in updated) updated.width = Math.round(updated.width);
      if ("height" in updated) updated.height = Math.round(updated.height);
      try {
        const res = await fetch(`${API_PUT_STICKIES}/${id}`, {
          method: "PUT",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        });
        const result = await res.json();
        if (!res.ok || !result.success || result.error || result.errors) {
          throw new Error(result.error || result.errors || "Failed to save sticky");
        }
        setStickies((prev) =>
          prev.map((s) => (s.id === id ? result.data || updated : s)),
        );
      } catch (err) {
        showToast({
          type: "danger",
          message: err.message || "Failed to save sticky",
        });
      }
    },
    [stickies, showToast],
  );

  const createSticky = async () => {
    const container = containerRef.current;
    const x = container
      ? Math.round(Math.max(20, container.clientWidth / 2 - 120))
      : 100;
    const y = container
      ? Math.round(Math.max(20, container.clientHeight / 2 - 100))
      : 100;
    const newSticky = {
      content: "",
      x,
      y,
      width: 240,
      height: 180,
    };
    try {
      const res = await fetch(
        `${API_POST_STICKIES}?course=${encodeURIComponent(topic)}`,
        {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify(newSticky),
        },
      );
      const result = await res.json();
      if (!res.ok || !result.success || result.error || result.errors) {
        throw new Error(result.error || result.errors || "Failed to create sticky");
      }
      if (!result.data) {
        throw new Error("Failed to create sticky");
      }
      setStickies((prev) => [result.data, ...prev]);
    } catch (err) {
      showToast({
        type: "danger",
        message: err.message || "Failed to create sticky",
      });
    }
  };

  const deleteSticky = async (id) => {
    try {
      const res = await fetch(`${API_DELETE_STICKIES}/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const result = await res.json();
      if (!res.ok || !result.success || result.error || result.errors) {
        throw new Error(result.error || result.errors || "Failed to delete sticky");
      }
      setStickies((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      showToast({
        type: "danger",
        message: err.message || "Failed to delete sticky",
      });
    }
  };

  if (!visible) return null;

  return (
    <div ref={containerRef} className='pointer-events-none fixed inset-0 z-40'>
      <button
        type='button'
        onClick={createSticky}
        className='pointer-events-auto absolute bottom-6 right-6 flex h-12 w-12 items-center justify-center rounded-full bg-dr-accent text-2xl text-white shadow-lg transition-transform hover:scale-110'
        title='Add sticky note'
        aria-label='Add sticky note'
      >
        +
      </button>
      {loading && stickies.length === 0 && (
        <div className='absolute bottom-20 right-6 text-xs text-dr-text-muted'>
          Loading stickies...
        </div>
      )}
      {stickies.map((sticky) => (
        <StickyNote
          key={sticky.id}
          sticky={sticky}
          containerRef={containerRef}
          onUpdate={saveSticky}
          onDelete={deleteSticky}
        />
      ))}
    </div>
  );
};

const StickyNote = ({ sticky, containerRef, onUpdate, onDelete }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const noteRef = useRef(null);
  const startRef = useRef({ x: 0, y: 0 });

  const onDragStart = (e) => {
    if (e.target.closest(".sticky-delete") || e.target.closest(".sticky-resize")) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    startRef.current = {
      x: clientX - sticky.x,
      y: clientY - sticky.y,
    };
    setIsDragging(true);
  };

  const onResizeStart = (e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    startRef.current = {
      x: clientX,
      y: clientY,
      width: sticky.width,
      height: sticky.height,
    };
    setIsResizing(true);
    e.stopPropagation();
  };

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMove = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const container = containerRef.current;
      const maxX = container ? container.clientWidth - sticky.width : 1000;
      const maxY = container ? container.clientHeight - sticky.height : 1000;

      if (isDragging) {
        const x = Math.round(Math.min(Math.max(0, clientX - startRef.current.x), maxX));
        const y = Math.round(Math.min(Math.max(0, clientY - startRef.current.y), maxY));
        onUpdate(sticky.id, { x, y });
      } else if (isResizing) {
        const dx = clientX - startRef.current.x;
        const dy = clientY - startRef.current.y;
        const width = Math.round(Math.max(MIN_WIDTH, startRef.current.width + dx));
        const height = Math.round(Math.max(MIN_HEIGHT, startRef.current.height + dy));
        onUpdate(sticky.id, { width, height });
      }
    };

    const handleEnd = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleMove);
    window.addEventListener("touchend", handleEnd);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [isDragging, isResizing, sticky.id, sticky.width, sticky.height, containerRef, onUpdate]);

  return (
    <div
      ref={noteRef}
      className='pointer-events-auto absolute flex flex-col overflow-hidden rounded-xl border border-dr-border bg-yellow-100 shadow-lg'
      style={{
        left: sticky.x,
        top: sticky.y,
        width: sticky.width,
        height: sticky.height,
        cursor: isDragging ? "grabbing" : "grab",
        zIndex: isDragging || isResizing ? 50 : 40,
      }}
      onMouseDown={onDragStart}
      onTouchStart={onDragStart}
    >
      <div className='flex items-center justify-between border-b border-black/10 bg-black/5 px-2 py-1'>
        <span className='text-xs font-semibold text-yellow-900'>Note</span>
        <button
          type='button'
          onClick={() => onDelete(sticky.id)}
          className='sticky-delete flex h-5 w-5 items-center justify-center rounded text-sm text-yellow-900 transition-colors hover:bg-black/10'
          aria-label='Delete sticky'
          title='Delete sticky'
        >
          ×
        </button>
      </div>
      <textarea
        value={sticky.content}
        onChange={(e) => onUpdate(sticky.id, { content: e.target.value })}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        placeholder='Write a note...'
        className='flex-1 resize-none bg-transparent p-3 text-sm text-yellow-950 placeholder:text-yellow-800/50 focus:outline-none'
      />
      <div
        className='sticky-resize absolute bottom-0 right-0 h-4 w-4 cursor-se-resize'
        onMouseDown={onResizeStart}
        onTouchStart={onResizeStart}
      >
        <div className='absolute bottom-1 right-1 h-0 w-0 border-b-4 border-r-4 border-yellow-900/40' />
      </div>
    </div>
  );
};
