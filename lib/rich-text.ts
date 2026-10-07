const BULLET_RE = /^[●•]\s*/;
const HTML_TAG_RE = /<[a-z][\s\S]*>/i;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Some rows were saved through the Tiptap editor (real <p> tags) but the
 * text pasted into it was still Word-style flat bullets — each line landed
 * in its own <p>, with the literal "●"/"•" glyph left as plain text instead
 * of becoming a real list item. Finds runs of consecutive <p>●...</p>
 * siblings and merges each run into one <ul><li>; non-bullet paragraphs and
 * any markup that isn't a bare <p> block (an existing <ul>, for instance)
 * pass through untouched.
 */
function upgradeBulletParagraphs(html: string): string {
  const BLOCK_RE = /<p>([\s\S]*?)<\/p>/gi;
  const BULLET_PREFIX_RE = /^[●•]\s*/;
  let result = "";
  let lastIndex = 0;
  let pendingItems: string[] = [];

  const flush = () => {
    if (pendingItems.length) {
      result += `<ul>${pendingItems.map((item) => `<li>${item}</li>`).join("")}</ul>`;
      pendingItems = [];
    }
  };

  let match: RegExpExecArray | null;
  while ((match = BLOCK_RE.exec(html))) {
    const between = html.slice(lastIndex, match.index);
    if (between.trim()) {
      flush();
      result += between;
    }
    const inner = match[1];
    const leadingTrimmed = inner.replace(/^(\s|<br\s*\/?>)+/i, "");
    const bulletMatch = leadingTrimmed.match(BULLET_PREFIX_RE);
    if (bulletMatch) {
      pendingItems.push(leadingTrimmed.slice(bulletMatch[0].length).trim());
    } else {
      flush();
      result += `<p>${inner}</p>`;
    }
    lastIndex = BLOCK_RE.lastIndex;
  }
  flush();
  result += html.slice(lastIndex);
  return result;
}

/**
 * Charter-style fields were plain pasted text (literal "●" bullets, "\n"
 * line breaks) before the Tiptap rich-text editor existed. Browsers collapse
 * bare "\n" inside HTML, so those unmigrated rows render as a run-on wall of
 * text with the "●" glyphs left dangling. This reconstructs real
 * <p>/<ul><li> markup from that legacy shape, grouping bullet lines into
 * lists and non-bullet lines (phase headers, etc.) into paragraphs in their
 * original order. Content that already contains HTML tags goes through
 * upgradeBulletParagraphs instead, for the "pasted into the editor, still
 * bullet-prefixed" shape described above.
 */
export function normalizeLegacyRichText(raw: string): string {
  if (!raw) return raw;
  if (HTML_TAG_RE.test(raw)) return upgradeBulletParagraphs(raw);

  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return raw;

  if (!lines.some((l) => BULLET_RE.test(l))) {
    return lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("");
  }

  const blocks: string[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length) {
      blocks.push(`<p>${paragraphLines.map(escapeHtml).join("<br>")}</p>`);
      paragraphLines = [];
    }
  };
  const flushList = () => {
    if (listItems.length) {
      blocks.push(`<ul>${listItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`);
      listItems = [];
    }
  };

  for (const line of lines) {
    if (BULLET_RE.test(line)) {
      flushParagraph();
      listItems.push(line.replace(BULLET_RE, ""));
    } else {
      flushList();
      paragraphLines.push(line);
    }
  }
  flushParagraph();
  flushList();

  return blocks.join("");
}
