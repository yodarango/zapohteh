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

  const trackClass = primary
    ? "bg-blue-500/30 border-blue-500"
    : secondary
      ? "bg-dr-text/30 border-dr-text"
      : danger
        ? "bg-red-500/30 border-red-500"
        : warning
          ? "bg-yellow-400/30 border-yellow-400"
          : success
            ? "bg-dr-success/30 border-dr-success"
            : "bg-dr-accent/30 border-dr-accent";

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
          checked ? trackClass : "bg-dr-text/20 border-dr-text/40"
        }`}
        style={trackStyle}
      />
      <div
        className={`absolute top-2 h-8 w-8 rounded-full transition-all duration-150 ${
          checked ? "left-10" : "left-2"
        } ${checked && (warning || success) ? "bg-dr-bg" : "bg-dr-text"}`}
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
