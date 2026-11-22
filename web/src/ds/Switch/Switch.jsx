// The project does not use the prop-types package.
/* eslint-disable react/prop-types */
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
  size = "default",
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className = "",
}) => {
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
      className={`relative inline-block shrink-0 cursor-pointer ${size === "small" ? "h-6 w-11" : "h-12 w-20"} ${
        disabled ? "cursor-not-allowed opacity-40" : ""
      } ${className}`}
    >
      <div
        className={`absolute inset-0 rounded-full border transition-colors duration-150 ${
          checked ? trackClass : "bg-dr-text/20 border-dr-text/40"
        }`}
        style={trackStyle}
      />
      <div
        className={`absolute rounded-full transition-all duration-150 ${
          size === "small" ? "top-1 h-4 w-4" : "top-2 h-8 w-8"
        } ${
          size === "small" ? (checked ? "left-6" : "left-1") : (checked ? "left-10" : "left-2")
        } ${checked && (warning || success) ? "bg-dr-bg" : "bg-dr-text"}`}
      />
      <input
        id={id}
        type='checkbox'
        role='switch'
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className='peer absolute inset-0 z-10 h-full w-full cursor-inherit opacity-0'
        checked={checked}
        onChange={(event) => onChange?.(event.target.checked)}
        disabled={disabled}
      />
      <span className='pointer-events-none absolute inset-0 rounded-full peer-focus-visible:ring-2 peer-focus-visible:ring-dr-accent/40 peer-focus-visible:ring-offset-2' />
    </div>
  );
};
/* eslint-enable react/prop-types */
