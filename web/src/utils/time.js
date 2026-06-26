/*************************************************************************
 * Convert UTC date to local browser time with custom formatting
 * ***********************************************************************
 */
export function formatLocalTime(utcDateString) {
  if (!utcDateString) return "";

  const date = new Date(utcDateString);
  const now = new Date();
  const currentYear = now.getFullYear();
  const dateYear = date.getFullYear();

  // Get month name (short format)
  const month = date.toLocaleDateString("en-US", { month: "short" });

  // Get day with ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
  const day = date.getDate();
  const ordinalSuffix = getOrdinalSuffix(day);

  // Get time in 12-hour format with AM/PM
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12; // Convert 0 to 12 for midnight
  const displayMinutes = minutes.toString().padStart(2, "0");

  // Format: "Nov 23rd @ 11:08PM" or "Nov 23rd, 2023 @ 11:08PM"
  const yearPart = dateYear !== currentYear ? `, ${dateYear}` : "";
  return `${month} ${day}${ordinalSuffix}${yearPart} @ ${displayHours}:${displayMinutes}${period}`;
}

/**
 * Get ordinal suffix for a day number (1st, 2nd, 3rd, 4th, etc.)
 * @param {number} day - Day of the month (1-31)
 * @returns {string} - Ordinal suffix ("st", "nd", "rd", or "th")
 */
function getOrdinalSuffix(day) {
  if (day > 3 && day < 21) return "th"; // 11th, 12th, 13th, etc.
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}
