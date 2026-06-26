import React from "react";

export const Input = ({ danger, className, shineOnFocus = true, ...rest }) => {
  const dangerClass = danger ? "border-dr-danger" : "border-dr-accent";
  const shineClass = shineOnFocus
    ? danger
      ? "focus:shadow-[0_0_5px_#ff4d62,-5px_0_20px_#ff4d62,5px_0_20px_#ff4d62]"
      : "focus:shadow-[0_0_5px_#794ef5,-5px_0_20px_#794ef5,5px_0_20px_#794ef5]"
    : "focus:shadow-none";

  return (
    <input
      {...rest}
      className={`w-full rounded-2xl border bg-dr-surface px-4 py-3 text-dr-text outline-none placeholder:text-dr-text/40 ${dangerClass} ${shineClass} ${className}`.trim()}
    />
  );
};

export default Input;
