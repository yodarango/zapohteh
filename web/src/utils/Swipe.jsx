/* *************************************************************************************************
 * Swipe component for handling swipe gestures on mobile devices.
 * Wraps a single child component and provides onLeft and onRight callbacks that are triggered by:
 * - Touch swipe gestures (left/right) on mobile devices
 *
 * Usage:
 * <Swipe
 *   onLeft={() => console.log('Swiped left')}
 *   onRight={() => console.log('Swiped right')}
 *   threshold={50} // Optional: minimum swipe distance in pixels (default: 50)
 * >
 *   <YourChildComponent />
 * </Swipe>
 * *************************************************************************************************
 */
import { useEffect, useRef, useCallback } from "react";

export function Swipe({ children, onLeft, onRight, threshold = 50 }) {
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const elementRef = useRef(null);

  // Handle touch start
  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  // Handle touch end and determine swipe direction
  const handleTouchEnd = useCallback(
    (e) => {
      if (touchStartX.current === null || touchStartY.current === null) {
        return;
      }

      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;

      const deltaX = touchEndX - touchStartX.current;
      const deltaY = touchEndY - touchStartY.current;

      // Check if horizontal swipe is more significant than vertical
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Check if swipe distance meets threshold
        if (Math.abs(deltaX) > threshold) {
          if (deltaX > 0 && onRight) {
            onRight();
          } else if (deltaX < 0 && onLeft) {
            onLeft();
          }
        }
      }

      // Reset touch positions
      touchStartX.current = null;
      touchStartY.current = null;
    },
    [onLeft, onRight, threshold]
  );

  // Set up touch event listeners on the element
  useEffect(() => {
    const element = elementRef.current;
    if (element) {
      element.addEventListener("touchstart", handleTouchStart, {
        passive: true,
      });
      element.addEventListener("touchend", handleTouchEnd, { passive: true });

      return () => {
        element.removeEventListener("touchstart", handleTouchStart);
        element.removeEventListener("touchend", handleTouchEnd);
      };
    }
  }, [handleTouchStart, handleTouchEnd]);

  return (
    <div ref={elementRef} style={{ outline: "none" }}>
      {children}
    </div>
  );
}
