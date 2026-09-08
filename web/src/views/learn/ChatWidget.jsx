import { useState, useEffect } from "react";
import { Portal } from "@ds";
import { ChatPanel } from "./ChatPanel";

const MIN_W = 300;
const MIN_H = 360;
const STORAGE_KEY = "chatWidgetSize";

// Floating assistant: a bubble anchored to the bottom-right corner that opens a
// resizable chat window. Rendered through a Portal so it is never clipped by
// parent overflow and always floats above the page content.
export const ChatWidget = ({ topic, chapters }) => {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && saved.width && saved.height) return saved;
    } catch (e) {
      // ignore malformed stored size
    }
    return { width: 380, height: 520 };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(size));
  }, [size]);

  // Anchored bottom-right, so dragging the top-left handle outward grows the
  // window: width/height increase as the pointer moves left/up.
  const startResize = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = size.width;
    const startH = size.height;

    const onMove = (ev) => {
      const maxW = Math.min(window.innerWidth - 48, 720);
      const maxH = window.innerHeight - 120;
      const nextW = Math.max(
        MIN_W,
        Math.min(maxW, startW + (startX - ev.clientX)),
      );
      const nextH = Math.max(
        MIN_H,
        Math.min(maxH, startH + (startY - ev.clientY)),
      );
      setSize({ width: nextW, height: nextH });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <Portal>
      {open ? (
        <div
          className='fixed bottom-6 right-6 z-40 flex flex-col overflow-hidden rounded-2xl border border-dr-border bg-dr-surface shadow-2xl'
          style={{ width: size.width, height: size.height }}
        >
          {/* Resize handle (top-left corner) */}
          <div
            onPointerDown={startResize}
            className='absolute left-0 top-0 z-10 h-5 w-5 cursor-nwse-resize'
            aria-label='Resize chat window'
          >
            <span className='pointer-events-none absolute left-1.5 top-1.5 h-2 w-2 border-l-2 border-t-2 border-dr-text-muted' />
          </div>

          {/* Header */}
          <div className='flex items-center justify-between border-b border-dr-border bg-dr-surface-light px-4 py-3'>
            <span className='flex items-center gap-2 text-sm font-semibold text-dr-text'>
              <ion-icon
                name='sparkles-outline'
                className='text-dr-accent'
              ></ion-icon>
              Assistant
            </span>
            <button
              type='button'
              onClick={() => setOpen(false)}
              className='flex h-8 w-8 items-center justify-center rounded-lg text-dr-text-muted transition-colors hover:bg-dr-surface'
              aria-label='Close chat'
            >
              <ion-icon name='close-outline' className='text-xl'></ion-icon>
            </button>
          </div>

          {/* Chat body */}
          <div className='min-h-0 flex-1 overflow-hidden p-4'>
            <ChatPanel topic={topic} chapters={chapters} />
          </div>
        </div>
      ) : (
        <button
          type='button'
          onClick={() => setOpen(true)}
          className='fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-dr-accent text-white shadow-lg transition-transform hover:scale-105'
          aria-label='Open assistant'
        >
          <ion-icon
            name='chatbubble-ellipses-outline'
            className='text-2xl'
          ></ion-icon>
        </button>
      )}
    </Portal>
  );
};
