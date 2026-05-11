"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2, Check, Sparkles } from "lucide-react";
import { saveDocumentationAction } from "../actions";
import {
  useEditor,
  EditorContent,
  ReactNodeViewRenderer,
  NodeViewWrapper,
  NodeViewContent,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

/* ────────────────────────────────────────────
   Mermaid React NodeView
   ──────────────────────────────────────────── */

function MermaidBlock({ node, selected }: { node: any; selected: boolean }) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const counter = useRef(0);
  const mermaidRef = useRef<any>(null);
  const code = node.textContent;

  useEffect(() => {
    if (typeof window === "undefined") return;
    import("mermaid").then((m) => {
      mermaidRef.current = m.default;
      mermaidRef.current.initialize({
        startOnLoad: false,
        theme: "default",
        securityLevel: "loose",
      });
    });
  }, []);

  useEffect(() => {
    if (!code.trim() || !mermaidRef.current) {
      setSvg("");
      setError("");
      return;
    }

    let cancelled = false;
    counter.current += 1;
    const id = `mmd-${counter.current}`;

    const timeout = setTimeout(async () => {
      try {
        const { svg: result } = await mermaidRef.current.render(
          id,
          code.trim()
        );
        if (!cancelled) {
          setSvg(result);
          setError("");
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.shortMessage || e?.message || "Syntax error");
          setSvg("");
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [code]);

  return (
    <NodeViewWrapper
      as="div"
      className={`mermaid-node my-4 ${selected ? "ring-2 ring-blue-300 rounded-xl" : ""}`}
    >
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-gray-200">
          <Sparkles className="w-3 h-3 text-purple-500" />
          <span className="text-[11px] font-semibold text-purple-700 tracking-wide uppercase">
            Mermaid
          </span>
        </div>
        <div className="bg-gray-900 p-4">
          <NodeViewContent
            as="pre"
            spellCheck={false}
            className="text-sm font-mono text-gray-100 leading-relaxed outline-none whitespace-pre-wrap break-words min-h-[48px] caret-white m-0 bg-transparent"
          />
        </div>
        {(svg || error) && (
          <div className="border-t border-gray-200 bg-white">
            <div className="px-3 py-1 bg-gray-50 border-b border-gray-100">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                Preview
              </span>
            </div>
            {svg ? (
              <div
                className="p-6 flex justify-center [&_svg]:max-w-full [&_svg]:h-auto"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            ) : (
              <div className="p-4">
                <pre className="text-xs text-red-600 bg-red-50 rounded-lg p-3 overflow-x-auto font-mono">
                  {error}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

/* ────────────────────────────────────────────
   Create Mermaid Extension at runtime
   (require() bypasses pnpm strict hoisting)
   ──────────────────────────────────────────── */

let _mermaidExt: any = null;

function getMermaidExtension() {
  if (_mermaidExt) return _mermaidExt;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const core = require("@tiptap/core") as typeof import("@tiptap/core");

  _mermaidExt = core.Node.create({
    name: "mermaidDiagram",
    group: "block",
    content: "text*",
    marks: "",
    code: true,
    defining: true,

    parseHTML() {
      return [{ tag: 'div[data-type="mermaid-diagram"]' }];
    },

    renderHTML({ HTMLAttributes }: any) {
      return [
        "div",
        core.mergeAttributes(HTMLAttributes, {
          "data-type": "mermaid-diagram",
        }),
        0,
      ];
    },

    addNodeView() {
      return ReactNodeViewRenderer(MermaidBlock);
    },
  });

  return _mermaidExt;
}

/* ────────────────────────────────────────────
   Editor Component
   ──────────────────────────────────────────── */

interface TaskEditorProps {
  taskId: string;
  taskName: string;
  moduleName: string;
  initialContent: object | null;
}

export default function TaskEditor({
  taskId,
  taskName,
  moduleName,
  initialContent,
}: TaskEditorProps) {
  const router = useRouter();
  const contentRef = useRef<object>(initialContent || {});

  const [content, setContent] = useState<object>(initialContent || {});
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);

  // Tiptap Editor Setup
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: "Type '/' for commands, or start writing...",
      }),
      getMermaidExtension(),
    ],
    content:
      initialContent && Object.keys(initialContent).length > 0
        ? initialContent
        : { type: "doc", content: [{ type: "paragraph" }] },
    editorProps: {
      attributes: {
        class:
          "prose prose-lg max-w-none focus:outline-none notion-prose min-h-[50vh]",
      },
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      setContent(json);
      contentRef.current = json;
      setHasChanges(true);
    },
    immediatelyRender: false,
  });

  // Handle content change (for parent sync)
  const handleContentChange = useCallback((newContent: object) => {
    setContent(newContent);
    contentRef.current = newContent;
    setHasChanges(true);
  }, []);

  // Save documentation
  const handleSave = useCallback(async () => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      const result = await saveDocumentationAction(
        taskId,
        contentRef.current,
        null
      );

      if (!result.error) {
        setLastSaved(new Date());
        setHasChanges(false);
        setShowSavedToast(true);
        setTimeout(() => setShowSavedToast(false), 2000);
      } else {
        console.error("Save error:", result.error);
      }
    } catch (error) {
      console.error("Save exception:", error);
    } finally {
      setIsSaving(false);
    }
  }, [taskId, isSaving]);

  // Insert Mermaid Diagram
  const insertMermaidDiagram = useCallback(() => {
    if (!editor) return;
    const template = `graph TD
    A[Start] --> B{Decision}
    B -- Yes --> C[Continue]
    B -- No --> D[Fix it]
    D --> B`;
    editor
      .chain()
      .focus()
      .insertContent({
        type: "mermaidDiagram",
        content: [{ type: "text", text: template }],
      })
      .run();
  }, [editor]);

  // Auto-save
  useEffect(() => {
    if (!hasChanges || isSaving) return;
    const timer = setTimeout(() => {
      handleSave();
    }, 30000);
    return () => clearTimeout(timer);
  }, [hasChanges, isSaving, handleSave]);

  // Keyboard shortcut: Ctrl/Cmd + S and Ctrl/Cmd + M
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "m") {
        e.preventDefault();
        insertMermaidDiagram();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, insertMermaidDiagram]);

  // Before unload warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges && !isSaving) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasChanges, isSaving]);

  // Sync external content changes
  useEffect(() => {
    if (editor && initialContent && Object.keys(initialContent).length > 0) {
      const current = editor.getJSON();
      if (JSON.stringify(current) !== JSON.stringify(initialContent)) {
        editor.commands.setContent(initialContent);
      }
    }
  }, [editor, initialContent]);

  // Toolbar button component
  const ToolbarButton = ({
    onClick,
    isActive,
    children,
    title,
  }: {
    onClick: () => void;
    isActive?: boolean;
    children: React.ReactNode;
    title: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-2 rounded transition-colors ${
        isActive
          ? "bg-gray-200 text-gray-900"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      }`}
    >
      {children}
    </button>
  );

  if (!editor) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading editor...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm p-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/documentation")}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-gray-900"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex flex-col">
            <span className="text-xs text-gray-500 font-medium">
              {moduleName}
            </span>
            <h1 className="text-sm font-semibold text-gray-900">{taskName}</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {showSavedToast && (
            <span className="flex items-center gap-1 text-xs text-green-600 font-medium animate-fade-in">
              <Check className="w-3 h-3" />
              Saved
            </span>
          )}
          {lastSaved && !showSavedToast && (
            <span className="text-xs text-gray-400">
              {lastSaved.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          {hasChanges && !isSaving && (
            <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Editing
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
              isSaving || !hasChanges
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-black text-white hover:bg-gray-800 active:scale-[0.98]"
            }`}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">
              {isSaving ? "Saving" : "Save"}
            </span>
          </button>
        </div>
      </header>

      {/* Editor Area */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          {/* Title */}
          <div className="mb-6 pb-4 border-b border-gray-100">
            <input
              type="text"
              value={taskName}
              readOnly
              className="w-full text-3xl sm:text-4xl font-bold text-gray-900 placeholder-gray-300 bg-transparent border-none outline-none focus:ring-0 p-0"
              placeholder="Untitled"
            />
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
              <span>{moduleName}</span>
              <span>•</span>
              <span>Task #{taskId.slice(-4)}</span>
            </div>
          </div>

          {/* Toolbar */}
          <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg p-1.5 mb-4 flex flex-wrap gap-1 shadow-sm">
            <ToolbarButton
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 1 }).run()
              }
              isActive={editor.isActive("heading", { level: 1 })}
              title="Heading 1"
            >
              <span className="text-sm font-bold">H1</span>
            </ToolbarButton>
            <ToolbarButton
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 2 }).run()
              }
              isActive={editor.isActive("heading", { level: 2 })}
              title="Heading 2"
            >
              <span className="text-sm font-bold">H2</span>
            </ToolbarButton>
            <ToolbarButton
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 3 }).run()
              }
              isActive={editor.isActive("heading", { level: 3 })}
              title="Heading 3"
            >
              <span className="text-sm font-bold">H3</span>
            </ToolbarButton>

            <div className="w-px bg-gray-200 mx-1" />

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              isActive={editor.isActive("bold")}
              title="Bold (Ctrl+B)"
            >
              <span className="font-bold">B</span>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              isActive={editor.isActive("italic")}
              title="Italic (Ctrl+I)"
            >
              <span className="italic">I</span>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleStrike().run()}
              isActive={editor.isActive("strike")}
              title="Strikethrough"
            >
              <span className="line-through">S</span>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleCode().run()}
              isActive={editor.isActive("code")}
              title="Code"
            >
              <span className="font-mono text-xs">{`</>`}</span>
            </ToolbarButton>

            <div className="w-px bg-gray-200 mx-1" />

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              isActive={editor.isActive("bulletList")}
              title="Bullet List"
            >
              <span className="text-sm">•</span>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              isActive={editor.isActive("orderedList")}
              title="Numbered List"
            >
              <span className="text-sm">1.</span>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              isActive={editor.isActive("blockquote")}
              title="Quote"
            >
              <span className="text-lg leading-none">&ldquo;</span>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              title="Divider"
            >
              <span className="text-sm">—</span>
            </ToolbarButton>

            <div className="w-px bg-gray-200 mx-1" />

            {/* Mermaid Diagram */}
            <ToolbarButton
              onClick={insertMermaidDiagram}
              title="Insert Mermaid Diagram (Ctrl+M)"
            >
              <Sparkles className="w-4 h-4 text-purple-500" />
            </ToolbarButton>

            <div className="w-px bg-gray-200 mx-1" />

            <ToolbarButton
              onClick={() => editor.chain().focus().undo().run()}
              title="Undo (Ctrl+Z)"
            >
              ↩
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().redo().run()}
              title="Redo (Ctrl+Y)"
            >
              ↪
            </ToolbarButton>
          </div>

          {/* Editor Content */}
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Footer Status */}
      <footer className="border-t border-gray-100 bg-white/80 backdrop-blur-sm px-4 py-2 text-xs text-gray-400 flex items-center justify-between">
        <span>
          {hasChanges ? "● Unsaved changes" : "✓ All changes saved"}
        </span>
        <span className="hidden sm:inline">
          Press{" "}
          <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono text-[10px]">
            Ctrl
          </kbd>{" "}
          +{" "}
          <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono text-[10px]">
            S
          </kbd>{" "}
          to save ·{" "}
          <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono text-[10px]">
            Ctrl
          </kbd>{" "}
          +{" "}
          <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono text-[10px]">
            M
          </kbd>{" "}
          for diagram
        </span>
      </footer>

      {/* Styles */}
      <style jsx global>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        kbd {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
            monospace;
        }

        .notion-prose {
          --tw-prose-body: #374151;
          --tw-prose-headings: #111827;
          --tw-prose-bold: #111827;
          --tw-prose-bullets: #6b7280;
          --tw-prose-hr: #e5e7eb;
          --tw-prose-quotes: #374151;
          --tw-prose-quote-borders: #e5e7eb;
          --tw-prose-code: #111827;
          --tw-prose-pre-bg: #1f2937;
          --tw-prose-pre-code: #e5e7eb;
        }

        .notion-prose > *:first-child {
          margin-top: 0;
        }

        .notion-prose p {
          margin: 0.25em 0;
          line-height: 1.75;
          color: #374151;
        }

        .notion-prose p.is-editor-empty:first-child::before {
          color: #9ca3af;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }

        .notion-prose h1 {
          font-size: 1.875rem;
          font-weight: 700;
          margin: 1.5em 0 0.5em;
          color: #111827;
          line-height: 1.3;
        }

        .notion-prose h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin: 1.25em 0 0.5em;
          color: #111827;
          line-height: 1.4;
        }

        .notion-prose h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 1em 0 0.5em;
          color: #111827;
          line-height: 1.5;
        }

        .notion-prose ul,
        .notion-prose ol {
          margin: 0.5em 0;
          padding-left: 1.5em;
        }

        .notion-prose li {
          margin: 0.25em 0;
          padding-left: 0.25em;
        }

        .notion-prose li > p {
          margin: 0;
          display: inline;
        }

        .notion-prose blockquote {
          margin: 1em 0;
          padding: 0.25em 0 0.25em 1em;
          border-left: 3px solid #e5e7eb;
          color: #4b5563;
          font-style: normal;
        }

        .notion-prose code {
          background: #f3f4f6;
          color: #111827;
          padding: 0.2em 0.4em;
          border-radius: 0.25rem;
          font-size: 0.875em;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
            monospace;
        }

        .notion-prose pre {
          margin: 1em 0;
          background: #1f2937;
          border-radius: 0.5rem;
          padding: 1em;
          overflow-x: auto;
        }

        .notion-prose pre code {
          background: transparent;
          color: #e5e7eb;
          padding: 0;
          font-size: 0.875em;
        }

        .notion-prose hr {
          margin: 2em 0;
          border: none;
          border-top: 1px solid #e5e7eb;
        }

        .notion-prose a {
          color: #2563eb;
          text-decoration: none;
          font-weight: 500;
        }

        .notion-prose a:hover {
          text-decoration: underline;
        }

        .ProseMirror-focused {
          outline: none;
        }

        .ProseMirror-selectednode {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
          border-radius: 0.25rem;
        }

        /* ── Mermaid Node ── */
        .mermaid-node pre {
          margin: 0;
          padding: 0;
          background: transparent;
          border-radius: 0;
        }
        .mermaid-node pre code {
          background: transparent;
          color: #f3f4f6;
          padding: 0;
          font-size: 0.875em;
        }
        .mermaid-node .ProseMirror-selectednode {
          outline: none;
        }
      `}</style>
    </div>
  );
}
