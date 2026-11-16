// Return complete, non-overlapping matches. Each ellipsis joins excerpts to the
// next occurrence of the following excerpt, without highlighting the gap.
export const findHighlightMatches = (content, highlightText) => {
  const excerpts = highlightText.split(/\.{3}|…/).map((part) => part.trim());
  const hasEllipsis = excerpts.length > 1 && excerpts.every(Boolean);
  const parts = hasEllipsis ? excerpts : [highlightText];
  if (!parts[0]) return [];

  const matches = [];
  let searchFrom = 0;
  while (searchFrom < content.length) {
    const start = content.indexOf(parts[0], searchFrom);
    if (start === -1) break;

    const ranges = [{ start, end: start + parts[0].length }];
    let end = ranges[0].end;
    for (const part of parts.slice(1)) {
      const next = content.indexOf(part, end);
      if (next === -1) break;
      ranges.push({ start: next, end: next + part.length });
      end = next + part.length;
    }

    if (ranges.length === parts.length) {
      matches.push(ranges);
      searchFrom = end;
    } else {
      searchFrom = start + 1;
    }
  }
  return matches;
};