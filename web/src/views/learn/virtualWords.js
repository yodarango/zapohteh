// Index only reading text. Highlight wrappers split text nodes, but their
// controls must not add words or change where words start and end.
export function indexVirtualWords(root) {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  const offsets = new Map();
  const chunks = [];
  let length = 0;
  let previousBlock;
  let node;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (!parent?.closest(".research-content, [data-reading-heading]") ||
        (parent.closest("button, script, style, template, [hidden]") || parent.closest("[data-virtual-bookmark]"))) continue;
    const block = parent.closest("p,li,dt,dd,h1,h2,h3,h4,h5,h6,pre,td,th,div,blockquote");
    if (block !== previousBlock || (node.previousSibling?.nodeName === "BR")) {
      chunks.push("\n");
      length++;
    }
    previousBlock = block;
    const start = length;
    chunks.push(node.data);
    length += node.length;
    if (node.length) {
      nodes.push({ node, start, end: length });
      offsets.set(node, start);
    }
  }

  const words = Array.from(chunks.join("").matchAll(/[\p{L}\p{N}][\p{L}\p{N}\p{M}]*(?:['’][\p{L}\p{N}\p{M}]+)*/gu),
    (match) => ({ start: match.index, end: match.index + match[0].length }));

  return {
    count: words.length,
    selectedWord(selection) {
      if (!selection?.rangeCount || selection.isCollapsed) return -1;
      const range = selection.getRangeAt(0);
      if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return -1;
      const startNodeOffset = offsets.get(range.startContainer);
      const endNodeOffset = offsets.get(range.endContainer);
      if (startNodeOffset == null || endNodeOffset == null) return -1;
      const start = startNodeOffset + range.startOffset;
      const end = endNodeOffset + range.endOffset;
      const index = words.findIndex((word) => word.end > start && word.start < end);
      return index >= 0 && !(words[index + 1]?.start < end) ? index : -1;
    },
    rangeFor(index) {
      const word = words[index];
      if (!word) return null;
      const first = nodes.find((entry) => entry.end > word.start);
      const last = nodes.find((entry) => entry.end >= word.end);
      const range = root.ownerDocument.createRange();
      range.setStart(first.node, word.start - first.start);
      range.setEnd(last.node, word.end - last.start);
      return range;
    },
  };
}