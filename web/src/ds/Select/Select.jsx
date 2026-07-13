import { Portal } from "@ds";
import { useCallback, useEffect, useRef, useState } from "react";

export const Select = ({
  label,
  options = [],
  value,
  onChange,
  placeholder = "Select an option",
  className = "",
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, flip: false });
  const containerRef = useRef(null);
  const listRef = useRef(null);

  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  const toggle = () => {
    if (!disabled) setIsOpen((prev) => !prev);
  };

  const handleSelect = (option) => {
    if (option.disabled) return;
    onChange?.(option.value);
    setIsOpen(false);
  };

  const calculatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const listHeight = Math.min(options.length * 40 + 8, 16 * 16); // approximate max height
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const flip = spaceBelow < listHeight && spaceAbove > spaceBelow;

    setPosition({
      top: flip ? rect.top : rect.bottom,
      left: rect.left,
      width: rect.width,
      flip,
    });
  }, [options.length]);

  useEffect(() => {
    if (isOpen) {
      calculatePosition();
      const handleScroll = () => {
        calculatePosition();
      };
      const handleResize = () => {
        calculatePosition();
      };
      window.addEventListener("scroll", handleScroll, true);
      window.addEventListener("resize", handleResize);
      return () => {
        window.removeEventListener("scroll", handleScroll, true);
        window.removeEventListener("resize", handleResize);
      };
    }
  }, [isOpen, calculatePosition]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      const insideTrigger =
        containerRef.current && containerRef.current.contains(e.target);
      const insideDropdown =
        listRef.current && listRef.current.contains(e.target);
      if (!insideTrigger && !insideDropdown) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const index = options.findIndex((o) => o.value === value);
      setHighlightedIndex(index >= 0 ? index : 0);
    }
  }, [isOpen, options, value]);

  useEffect(() => {
    if (isOpen && listRef.current && highlightedIndex >= 0) {
      const item = listRef.current.children[highlightedIndex];
      if (item) item.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, isOpen]);

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < options.length - 1 ? prev + 1 : prev,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0) {
          handleSelect(options[highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
      case "Tab":
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className='mb-1 block text-sm font-medium text-dr-text'>
          {label}
        </label>
      )}
      <button
        type='button'
        onClick={toggle}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup='listbox'
        aria-expanded={isOpen}
        className={`flex w-full items-center justify-between rounded-xl border bg-dr-surface px-4 py-3 text-left text-sm outline-none transition-colors focus:border-dr-accent focus:ring-2 focus:ring-dr-accent/25 ${
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        } ${
          selectedOption
            ? "border-dr-border text-dr-text"
            : "border-dr-border text-dr-text-muted"
        }`}
      >
        <span className='truncate'>{displayLabel}</span>
        <ion-icon
          name='chevron-down-outline'
          className={`ml-2 shrink-0 text-dr-text-muted transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {isOpen && (
        <Portal>
          <div
            ref={listRef}
            role='listbox'
            className='fixed z-50 max-h-[16rem] overflow-auto rounded-xl border border-dr-border bg-dr-surface shadow-lg'
            style={{
              top: position.flip
                ? position.top - (listRef.current?.offsetHeight || 0)
                : position.top + 4,
              left: position.left,
              width: position.width,
              maxHeight: position.flip
                ? position.top - 8
                : window.innerHeight - position.top - 8,
            }}
          >
            {options.length === 0 ? (
              <div className='px-4 py-3 text-sm text-dr-text-muted'>
                No options
              </div>
            ) : (
              options.map((option, index) => (
                <div
                  key={option.value}
                  role='option'
                  aria-selected={option.value === value}
                  onClick={() => handleSelect(option)}
                  className={`cursor-pointer px-4 py-2.5 text-sm transition-colors ${
                    option.value === value
                      ? "bg-dr-accent-light text-dr-accent"
                      : "text-dr-text hover:bg-dr-surface-light"
                  } ${option.disabled ? "cursor-not-allowed opacity-50" : ""} ${
                    index === highlightedIndex ? "bg-dr-surface-light" : ""
                  }`}
                >
                  {option.label}
                </div>
              ))
            )}
          </div>
        </Portal>
      )}
    </div>
  );
};
