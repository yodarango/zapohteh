import React from "react";

export const Switch = ({
  disabled = false,
  checked = false,
  onChange,
  primary,
  secondary,
  danger,
  warning,
  success,
  color,
  className = "",
}) => {
  const handleToggle = () => {
    if (!disabled && onChange) {
      onChange(!checked);
    }
  };

  const variantClass = primary
    ? "checked:bg-blue-500 checked:border-blue-500"
    : secondary
      ? "checked:bg-dr-text/30 checked:border-dr-text"
      : danger
        ? "checked:bg-red-500 checked:border-red-500"
        : warning
          ? "checked:bg-yellow-400 checked:border-yellow-400"
          : success
            ? "checked:bg-dr-success checked:border-dr-success"
            : "checked:bg-dr-accent checked:border-dr-accent";

  const thumbVariantClass =
    warning || success ? "checked:bg-dr-bg" : "checked:bg-dr-text";

  const trackStyle = color
    ? {
        backgroundColor: checked ? color : undefined,
        borderColor: checked ? color : undefined,
      }
    : {};

  return (
    <div
      className={`relative inline-block h-12 w-20 cursor-pointer ${
        disabled ? "cursor-not-allowed opacity-40" : ""
      } ${className}`}
      onClick={handleToggle}
      role='switch'
      aria-checked={checked}
      aria-disabled={disabled}
    >
      <div
        className={`absolute inset-0 rounded-full border transition-colors duration-150 ${
          checked ? variantClass : "border-dr-accent bg-dr-accent/40"
        }`}
        style={trackStyle}
      />
      <div
        className={`absolute top-2 h-8 w-8 rounded-full bg-dr-text transition-all duration-150 ${
          checked ? "left-10" : "left-2"
        } ${thumbVariantClass}`}
      />
      <input
        type='checkbox'
        className='absolute inset-0 z-10 opacity-0 cursor-inherit'
        checked={checked}
        onChange={() => {}}
        disabled={disabled}
      />
    </div>
  );
};
