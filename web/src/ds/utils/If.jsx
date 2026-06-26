/***********************************************************************************************
 * Will render children if condition is true, otherwise returns <> </> 🥐
 * **********************************************************************
 *
 */

export const If = ({ condition, children }) => {
  if (condition) return <>{children}</>;
  return <></>;
};
