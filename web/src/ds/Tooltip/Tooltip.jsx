/* eslint-disable react/prop-types */
import { useEffect, useId, useRef, useState } from "react";

export const Tooltip = ({ children, label = "More information" }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <span ref={containerRef} className='relative inline-flex items-center'>
      <button
        type='button'
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
        className='inline-flex items-center justify-center text-dr-text-muted hover:text-dr-accent focus-visible:outline-2 focus-visible:outline-dr-accent'
      >
        <ion-icon name='information-circle-outline' className='text-lg' />
      </button>
      {open && (
        <span
          id={id}
          role='tooltip'
          className='absolute left-0 top-full z-50 mt-2 w-64 max-w-[80vw] rounded-lg border border-dr-border bg-dr-surface p-3 text-left text-sm font-normal text-dr-text shadow-lg'
        >
          {children}
        </span>
      )}
    </span>
  );
};