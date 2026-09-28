import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = ["p", "strong", "em", "s", "ul", "ol", "li", "a", "br"];

/**
 * Read-only rendering for a RichTextEditor value. The value is already
 * sanitized server-side on save (see pmplan-actions.sanitizeRichText), but
 * sanitizing again here is cheap and means this component is safe to reuse
 * anywhere an HTML string of unknown provenance needs to be displayed.
 */
export function RichTextView({ html, emptyText = "—" }: { html: string | null; emptyText?: string }) {
  if (!html || !html.trim()) {
    return <p className="text-sm text-slate-400">{emptyText}</p>;
  }
  const clean = sanitizeHtml(html, { allowedTags: ALLOWED_TAGS, allowedAttributes: { a: ["href", "target", "rel"] } });
  return (
    <div
      className="prose-sm max-w-none text-sm text-slate-800 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_a]:text-indigo-600 [&_a]:underline"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
