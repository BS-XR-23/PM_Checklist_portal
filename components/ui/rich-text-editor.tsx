"use client";

import { useEffect, useState, useTransition } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import clsx from "clsx";
import { normalizeLegacyRichText } from "@/lib/rich-text";

const errorTextClass = "text-xs text-red-600 mt-0.5";
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Failed to save.";
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      // Mousedown+preventDefault (not onClick alone) keeps focus in the
      // editor — a plain click blurs it first, which collapses the
      // selection a mark like Bold needs to apply to.
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={clsx(
        "inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded px-1 text-xs font-medium",
        active ? "bg-slate-700 text-white" : "text-slate-500 hover:bg-slate-200",
        disabled && "opacity-40"
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-1.5 py-1">
      <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <span className="font-bold">B</span>
      </ToolbarButton>
      <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <span className="italic">I</span>
      </ToolbarButton>
      <ToolbarButton label="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <span className="line-through">S</span>
      </ToolbarButton>
      <span className="mx-1 h-4 w-px bg-slate-200" />
      <ToolbarButton label="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        •
      </ToolbarButton>
      <ToolbarButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        1.
      </ToolbarButton>
      <span className="mx-1 h-4 w-px bg-slate-200" />
      <ToolbarButton label="Link" active={editor.isActive("link")} onClick={setLink}>
        🔗
      </ToolbarButton>
      <ToolbarButton label="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
        ✕
      </ToolbarButton>
    </div>
  );
}

/**
 * Rich-text replacement for PlanField's plain textarea. Stores/receives an
 * HTML string in the same String column PlanField always used — a bare
 * plain-text value (pre-existing rows) renders fine as HTML too, so no
 * migration is needed. Sanitized again server-side in pmplan-actions
 * (updatePmPlanField) before it's persisted, since this is HTML a WRITE
 * user controls and other viewers' browsers will render.
 */
export function RichTextEditor({
  value,
  onSave,
  placeholder,
}: {
  value: string;
  onSave: (value: string) => Promise<void>;
  placeholder?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: normalizeLegacyRichText(value),
    editorProps: {
      attributes: {
        class: "prose-sm max-w-none px-2 py-1.5 text-sm text-slate-800 focus:outline-none min-h-[64px] [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-indigo-600 [&_a]:underline",
      },
    },
  });

  // Keeps the editor in sync if the server round-trips a different value
  // (e.g. another tab saved first) without fighting the user's own typing —
  // only resets when the doc actually differs from what's on screen.
  useEffect(() => {
    const normalized = normalizeLegacyRichText(value);
    if (editor && normalized !== editor.getHTML()) {
      editor.commands.setContent(normalized, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) {
    return <div className="rounded-md border border-slate-300 bg-slate-50 min-h-[96px] animate-pulse" />;
  }

  const commit = () => {
    const html = editor.getHTML();
    const normalizedEmpty = html === "<p></p>";
    const next = normalizedEmpty ? "" : html;
    if (next === value) return;
    setError(null);
    startTransition(async () => {
      try {
        await onSave(next);
      } catch (err) {
        setError(errorMessage(err));
        editor.commands.setContent(value, { emitUpdate: false });
      }
    });
  };

  return (
    <div>
      <div
        className={clsx(
          "rounded-md border overflow-hidden",
          pending ? "opacity-60" : "",
          error ? "border-red-400 focus-within:ring-red-400" : "border-slate-300 focus-within:ring-2 focus-within:ring-slate-400"
        )}
      >
        <Toolbar editor={editor} />
        <EditorContent editor={editor} onBlur={commit} />
      </div>
      {error && <p className={errorTextClass}>{error}</p>}
    </div>
  );
}
