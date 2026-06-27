import React from "react";

export const Input = ({ danger, className, shineOnFocus = true, ...rest }) => {
  const dangerClass = danger ? "border-dr-danger" : "border-dr-border";
  const shineClass = shineOnFocus
    ? danger
      ? "focus:border-dr-danger focus:ring-2 focus:ring-dr-danger/25"
      : "focus:border-dr-accent focus:ring-2 focus:ring-dr-accent/25"
    : "focus:shadow-none";

  return (
    <input
      {...rest}
      className={`w-full rounded-xl border bg-dr-surface px-4 py-3 text-dr-text outline-none transition-colors placeholder:text-dr-text-muted ${dangerClass} ${shineClass} ${className}`.trim()}
    />
  );
};

export default Input;
