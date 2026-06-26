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
    "flex items-center justify-center rounded-md px-4 py-2.5 font-bold text-dr-text transition-colors duration-300 hover:opacity-80 border";

  let variantClasses = "";
  if (primary) variantClasses = "border-blue-500 bg-[rgba(15,57,83,0.44)]";
  else if (secondary)
    variantClasses = "border-dr-text bg-dr-text/30 backdrop-blur";
  else if (danger) variantClasses = "border-red-500 bg-[rgba(83,15,15,0.44)]";
  else if (warning)
    variantClasses = "border-yellow-400 bg-[rgba(83,76,15,0.44)]";
  else if (success)
    variantClasses = "border-dr-success bg-[rgba(15,83,67,0.44)]";
  else variantClasses = "border-blue-500 bg-[rgba(15,57,83,0.44)]";

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
