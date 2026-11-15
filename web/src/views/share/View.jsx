import { LearnView } from "../learn/View";

/* The shared lesson view reuses the exact LearnView component.
 * It detects the /share/:token path and adjusts API calls and permissions
 * accordingly, ensuring the UI is identical without duplicating code. */
export const ShareView = () => {
  return <LearnView />;
};
