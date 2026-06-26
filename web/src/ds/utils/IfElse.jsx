/*****************************************************************************************
 * If Else component that renders the first component if the value is true and the second
 *  component if the value is false 🐺
 *v************************************
 */

export const IfElse = ({ children, condition }) => {
  if (condition) return children[0];
  else return children[1];
};
