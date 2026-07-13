/*************************************************************************
 * Convert UTC date to local browser time with custom formatting
 * ***********************************************************************
 */
export function formatLocalTime(utcDateString) {
  if (!utcDateString) return "";

  const date = new Date(utcDateString);
  const year = date.getFullYear();

  // Full month name, e.g. "July"
  const month = date.toLocaleDateString("en-US", { month: "long" });

  // Day without ordinal suffix, e.g. "15"
  const day = date.getDate();

  // Time in 12-hour format with AM/PM, e.g. "8:01PM"
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, "0");

  // Format: "July 15, 2026 @8:01PM"
  return `${month} ${day}, ${year} @${displayHours}:${displayMinutes}${period}`;
}
