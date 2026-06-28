/* *************************************************************************************************
 * Splits assembled research markdown into an intro section (everything before the first chapter,
 * e.g. the "# Title" heading) and a list of chapters. Each chapter starts at a level-2 heading
 * ("## Chapter title"); its title is the heading text and its body is the markdown beneath it,
 * up to the next chapter. The heading itself is dropped from the body because the view renders
 * the title separately so it can sit next to the action button.
 * *************************************************************************************************
 */
export function splitChapters(markdown) {
  const lines = (markdown || "").split("\n");
  const intro = [];
  const chapters = [];
  let current = null;

  for (const line of lines) {
    const match = /^##\s+(.*)$/.exec(line);
    if (match) {
      if (current) chapters.push(current);
      current = { title: match[1].trim(), body: "" };
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
