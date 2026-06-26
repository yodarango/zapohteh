import { createPortal } from "react-dom";

export const Portal = ({ children, container }) => {
  if (!children) return null;
  return createPortal(children, container ?? document.body);
};
