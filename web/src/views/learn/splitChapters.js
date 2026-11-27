/* *************************************************************************************************
 * Splits assembled research markdown into an intro section (everything before the first chapter,
 * e.g. the "# Title" heading) and a list of chapters.
 *
 * For generated lessons a chapter starts at every level-2 heading ("## Chapter title").
 * Imported lessons preserve the heading structure of their source and pass their declared
 * chapter titles: a heading of any level then starts a chapter only when it matches the next
 * declared title, and every other heading stays in the flow and renders in place instead of
 * becoming a chapter of its own.
 *
 * The heading itself is dropped from the body because the view renders the title separately
 * so it can sit next to the action button.
 * *************************************************************************************************
 */
export function splitChapters(markdown, chapterTitles) {
  // An explicitly empty list means one whole cleaned document, with no inferred chapters.
  if (Array.isArray(chapterTitles) && chapterTitles.length === 0) {
    return { intro: (markdown || "").trim(), chapters: [] };
  }
  const lines = (markdown || "").split("\n");
  const titles =
    Array.isArray(chapterTitles) && chapterTitles.length > 0
      ? chapterTitles
      : null;
  const intro = [];
  const chapters = [];
  let current = null;
  let nextTitle = 0;

  for (const line of lines) {
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    let chapterTitle = null;
    if (titles) {
      if (
        heading &&
        nextTitle < titles.length &&
        heading[1].trim() === titles[nextTitle]
      ) {
        chapterTitle = titles[nextTitle];
        nextTitle++;
      }
    } else if (heading && /^##\s/.test(line)) {
      chapterTitle = heading[1].trim();
    }

    if (chapterTitle != null) {
      if (current) chapters.push(current);
      current = { title: chapterTitle, body: "" };
      continue;
    }

    if (current) {
      current.body += line + "\n";
    } else {
      intro.push(line);
    }
  }

  if (current) chapters.push(current);

  return {
    intro: intro.join("\n").trim(),
    chapters: chapters.map((c) => ({ title: c.title, body: c.body.trim() })),
  };
}
