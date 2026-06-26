import React from "react";
import { createPortal } from "react-dom";
import { If } from "@ds";

const typeStyles = {
  success: "border-dr-success bg-[#132d30]",
  danger: "border-red-500 bg-[#301313]",
  warning: "border-yellow-400 bg-[#302d13]",
  info: "border-blue-500 bg-[#131e30]",
  default: "border-dr-bg bg-[#131e30]",
};

export const Toast = (props) => {
  const { icon, onClose, children, title, type, style, open = false } = props;

  const cardClass = typeStyles[type] || typeStyles.default;
  const closeClass = !!onClose ? "py-3 ps-3 pe-1" : "p-3";

  if (!open) return null;

  const { zIndex = 22 } = props;

  const toastContent = (
    <div
      className={`fixed left-1/2 top-20 w-[92%] max-w-[50rem] -translate-x-1/2 rounded-2xl border text-dr-text flex items-center justify-start gap-3 ${closeClass} ${cardClass}`}
      style={{ zIndex, ...props.style }}
    >
      {icon && (
        <div className='flex-shrink-0 text-dr-text'>
          <ion-icon name={icon} />
        </div>
      )}
      <div className='w-full'>
        <div className='flex items-start justify-end gap-x-4'>
          <div className='w-full'>
            <h5 className='font-bold'>{title}</h5>
            <p>{children}</p>
          </div>
          <If condition={!!onClose}>
            <button
              className='flex-shrink-0 cursor-pointer border-none bg-transparent text-dr-text'
              onClick={onClose}
            >
              <ion-icon name='close' />
            </button>
          </If>
        </div>
      </div>
    </div>
  );

  return createPortal(toastContent, document.body);
};
