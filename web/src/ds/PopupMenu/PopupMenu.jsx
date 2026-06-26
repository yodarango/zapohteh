import React, { useState, useRef, useEffect, useCallback } from "react";
import { Portal } from "@ds";

export const PopupMenu = ({
  trigger,
  children,
  placement = "bottom",
  offset = 8,
  onOpen,
  onClose,
  disabled = false,
  closeOnSelect = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !menuRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const menuRect = menuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollX = window.pageXOffset;
    const scrollY = window.pageYOffset;

    // Calcola la posizione iniziale
    let top = triggerRect.bottom + scrollY + offset;
    let left = triggerRect.left + scrollX;

    // Gestisci il posizionamento verticale
    if (placement === "top") {
      top = triggerRect.top + scrollY - menuRect.height - offset;
    }

    // Verifica se il menu esce dal bordo destro della finestra
    if (left + menuRect.width > viewportWidth + scrollX) {
      left = viewportWidth + scrollX - menuRect.width - 10; // 10px di margine
    }

    // Verifica se il menu esce dal bordo inferiore della finestra
    if (
      top + menuRect.height > viewportHeight + scrollY &&
      placement === "bottom"
    ) {
      // Cambia il posizionamento da bottom a top
      top = triggerRect.top + scrollY - menuRect.height - offset;
    }

    // Verifica se il menu esce dal bordo superiore della finestra
    if (top < scrollY && placement === "top") {
      // Cambia il posizionamento da top a bottom
      top = triggerRect.bottom + scrollY + offset;
    }

    // Assicurati che il menu non esca dal bordo sinistro
    if (left < scrollX) {
      left = scrollX + 10; // 10px di margine
    }

    setPosition({ top, left });
  }, [placement, offset]);

  const handleTriggerClick = useCallback(
    (e) => {
      e.stopPropagation();
      if (disabled) return;

      if (!isOpen) {
        setIsOpen(true);
        onOpen?.();
        // Calcola la posizione dopo che il menu è stato renderizzato
        setTimeout(calculatePosition, 0);
      } else {
        setIsOpen(false);
        onClose?.();
      }
    },
    [isOpen, disabled, onOpen, onClose, calculatePosition],
  );

  const handleOutsideClick = useCallback(
    (e) => {
      if (
        triggerRef.current?.contains(e.target) ||
        menuRef.current?.contains(e.target)
      ) {
        return;
      }
      setIsOpen(false);
      onClose?.();
    },
    [onClose],
  );

  const handleMenuClick = useCallback(
    (e) => {
      e.stopPropagation();

      if (closeOnSelect) {
        setIsOpen(false);
        onClose?.();
      }
    },
    [closeOnSelect, onClose],
  );

  const handleScrollResize = useCallback(() => {
    if (isOpen) {
      calculatePosition();
    }
  }, [isOpen, calculatePosition]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        onClose?.();
      }
    },
    [isOpen, onClose],
  );

  useEffect(() => {
    if (isOpen) {
      // Calcola la posizione dopo che il menu è stato renderizzato
      setTimeout(calculatePosition, 0);

      document.addEventListener("click", handleOutsideClick);
      document.addEventListener("keydown", handleKeyDown);
      window.addEventListener("scroll", handleScrollResize, true);
      window.addEventListener("resize", handleScrollResize);

      return () => {
        document.removeEventListener("click", handleOutsideClick);
        document.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("scroll", handleScrollResize, true);
        window.removeEventListener("resize", handleScrollResize);
      };
    }
  }, [
    isOpen,
    calculatePosition,
    handleOutsideClick,
    handleKeyDown,
    handleScrollResize,
  ]);

  const triggerElement = React.cloneElement(trigger, {
    ref: triggerRef,
    onClick: handleTriggerClick,
  });

  return (
    <>
      {triggerElement}
      {isOpen && (
        <Portal>
          <div
            ref={menuRef}
            className='rounded-lg border border-dr-accent bg-dr-surface py-1 shadow-lg min-w-[16rem]'
            style={{
              position: "absolute",
              top: `${position.top}px`,
              left: `${position.left}px`,
              zIndex: 1000,
            }}
            onClick={handleMenuClick}
          >
            {children}
          </div>
        </Portal>
      )}
    </>
  );
};

// Componenti helper
export const PopupMenuItem = ({
  children,
  onClick,
  disabled = false,
  icon,
}) => {
  const handleClick = (e) => {
    if (disabled) return;
    onClick?.(e);
  };

  return (
    <button
      className={`flex w-full items-center gap-4 whitespace-nowrap px-4 py-2 text-left text-base text-dr-text bg-transparent border-none cursor-pointer hover:bg-dr-accent/10 ${
        disabled ? "opacity-50 cursor-not-allowed hover:bg-transparent" : ""
      }`}
      onClick={handleClick}
      disabled={disabled}
    >
      {icon && <span className='flex-shrink-0'>{icon}</span>}
      <span>{children}</span>
    </button>
  );
};

export const PopupMenuDivider = () => {
  return <div className='h-px bg-dr-accent' />;
};
