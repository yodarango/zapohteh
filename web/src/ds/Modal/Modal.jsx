import { createPortal } from "react-dom";
import React from "react";

export const Modal = ({
  closeOnBackdropClick = true,
  contentContainerStyle = {},
  showCloseButton = true,
  showWaves = true,
  height = "auto",
  zIndex = 10,
  children,
  onClose,
  title,
  open,
  ...rest
}) => {
  if (!open) return null;

  const handleBackdropClick = (e) => {
    if (closeOnBackdropClick && onClose) {
      e.stopPropagation();
      onClose(e);
    } else {
      e.stopPropagation();
    }
  };

  // handle the click on the content propagation unless it is the close button or the closeOnBackdropClick is true
  const handleContentClick = (e) => {
    if (e.target.closest("[data-modal-close]")) {
      onClose();
    } else {
      e.stopPropagation();
    }
  };

  const modalContent = (
    <div
      className='fixed inset-0 flex items-center justify-center'
      style={{ zIndex: zIndex + 1 }}
      {...rest}
    >
      <div
        className='relative w-[90vw] max-w-[60rem] overflow-hidden rounded-2xl bg-dr-surface p-6'
        onClick={handleContentClick}
        style={{
          zIndex: zIndex + 1,
          height,
        }}
      >
        {showCloseButton && (
          <button
            data-modal-close
            className='absolute right-4 top-4 z-30 bg-transparent border-none cursor-pointer text-2xl text-dr-text'
            onClick={onClose}
          >
            <ion-icon name='close-outline' />
          </button>
        )}
        <h4 className='mb-6 px-4 text-center text-xl font-bold'>{title}</h4>
        <div
          className='w-full max-h-[calc(90vh-10rem)] overflow-y-auto z-10'
          style={{ ...contentContainerStyle }}
        >
          {children}
        </div>
      </div>
      <div
        className='fixed inset-0 bg-dr-accent/40'
        onClick={handleBackdropClick}
        style={{ zIndex }}
      ></div>
    </div>
  );

  // Create portal to render modal at the end of document body
  return createPortal(modalContent, document.body);
};
