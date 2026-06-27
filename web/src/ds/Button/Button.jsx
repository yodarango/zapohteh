import { Loading, IfElse } from "@ds";
import React from "react";

export const Button = (props) => {
  let {
    children,
    primary,
    secondary,
    danger,
    warning,
    success,
    className = "",
    isLoading,
    ...restOfProps
  } = props;

  const baseClasses =
    "flex items-center justify-center rounded-xl px-4 py-2.5 font-semibold transition-colors duration-200 hover:opacity-90 border";

  let variantClasses = "";
  if (primary) variantClasses = "border-dr-accent bg-dr-accent text-white";
  else if (secondary)
    variantClasses =
      "border-dr-border bg-dr-surface text-dr-text hover:bg-dr-surface-light";
  else if (danger) variantClasses = "border-dr-danger bg-dr-danger text-white";
  else if (warning)
    variantClasses = "border-dr-warning bg-dr-warning text-dr-text";
  else if (success)
    variantClasses = "border-dr-success bg-dr-success text-white";
  else variantClasses = "border-dr-accent bg-dr-accent text-white";

  className = `${baseClasses} ${variantClasses} ${className}`.trim();

  return (
    <button className={className} {...restOfProps}>
      <IfElse condition={isLoading}>
        <Loading size={30} />
        <> {children}</>
      </IfElse>
    </button>
  );
};
