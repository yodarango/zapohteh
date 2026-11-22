import { useCallback } from "react";

// Keep the native input for keyboard, form, and assistive-technology support.
// The project does not use the prop-types package.
/* eslint-disable react/prop-types */
export const Checkbox = ({ children, className = "", indeterminate = false, ...props }) => {
  const setInput = useCallback((input) => {
    if (input) input.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <label className={`inline-flex cursor-pointer items-center gap-2 text-sm text-dr-text has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 ${className}`}>
      <span className='relative flex h-5 w-5 shrink-0 items-center justify-center'>
        <input
          {...props}
          ref={setInput}
          type='checkbox'
          className='peer absolute inset-0 z-10 m-0 h-full w-full cursor-inherit opacity-0'
        />
        <span className='pointer-events-none flex h-5 w-5 items-center justify-center rounded-md border border-dr-border bg-dr-surface text-transparent transition-colors peer-hover:border-dr-accent peer-checked:border-dr-accent peer-checked:bg-dr-accent peer-checked:text-white peer-indeterminate:border-dr-accent peer-indeterminate:bg-dr-accent peer-indeterminate:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-dr-accent/40 peer-focus-visible:ring-offset-2'>
          <ion-icon name={indeterminate ? "remove-outline" : "checkmark-outline"} className='text-base'></ion-icon>
        </span>
      </span>
      {children}
    </label>
  );
};
/* eslint-enable react/prop-types */