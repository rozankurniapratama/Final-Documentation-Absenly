// app/documentation/[taskId]/editor.tsx
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2, Check, Code, Sparkles } from "lucide-react";
import { saveDocumentationAction } from "../actions";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { createLowlight, all } from "lowlight";
import { CodeBlockLowlightMermaid } from "tiptap-extension-mermaid";
import mermaid from "mermaid";

// Initialize Mermaid globally
mermaid.initialize({
  startOnLoad: false,
  theme: "neutral",
  securityLevel: "loose",
});

const lowlight = createLowlight(all);

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
  const contentRef = useRef(initialContent || {});

  const [content, setContent] = useState(initialContent || {});
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);

  // Tiptap Editor Setup with Mermaid Support
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false, // Disable default, use lowlight version
      }),
      Placeholder.configure({
        placeholder: "Type '/' for commands, or start writing...",
      }),
      // Mermaid-enabled Code Block
      CodeBlockLowlightMermaid.configure({
        lowlight,
        classList: "mermaid-container",
        debounce: 300,
        mermaidConfig: {
          theme: "neutral",
          securityLevel: "loose",
        },
      }),
    ],
    content: initialContent && Object.keys(initialContent).length > 0
      ? initialContent
      : { type: "doc", content: [{ type: "paragraph" }] },
    editorProps: {
      attributes: {
        class: "prose prose-lg max-w-none focus:outline-none notion-prose min-h-[50vh]",
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

  // Insert Mermaid Block Helper
  const insertMermaidBlock = useCallback(() => {
    if (!editor) return;

    const defaultDiagram = `graph TD
    A[Start] --> B{Is it working?}
    B -- Yes --> C[Ship it!]
    B -- No --> D[Debug]
    D --> B`;

    editor.chain().focus().insertContent(`
\`\`\`mermaid
${defaultDiagram}
\`\`\`
`).run();
  }, [editor]);

  // Auto-save
  useEffect(() => {
    if (!hasChanges || isSaving) return;
    const timer = setTimeout(() => { handleSave(); }, 30000);
    return () => clearTimeout(timer);
  }, [hasChanges, isSaving, handleSave]);

  // Keyboard shortcut: Ctrl/Cmd + S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      // Optional: Ctrl/Cmd + M for Mermaid
      if ((e.metaKey || e.ctrlKey) && e.key === "m") {
        e.preventDefault();
        insertMermaidBlock();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, insertMermaidBlock]);

  // Before unload warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges && !isSaving) {
        e.preventDefault();
        e.returnValue = '';
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
      onClick={onClick}
      className={`p-2 rounded hover:bg-secondary transition-colors ${isActive ? "bg-primary text-primary-foreground" : ""
        }`}
      title={title}
      type="button"
    >
      {children}
    </button>
  );

  if (!editor) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="ml-2">Loading editor...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b border-border">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-secondary rounded brutal-border transition-colors"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold font-mono">{taskName}</h1>
          <p className="text-sm text-muted-foreground">
            {moduleName} • Task #{taskId.slice(-4)}
          </p>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 overflow-auto p-6">
        {/* Title */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold font-mono">{taskName}</h2>
          <p className="text-muted-foreground">{moduleName}</p>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap gap-1 p-2 mb-4 brutal-border bg-card sticky top-0 z-10">
          {/* Headings */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            isActive={editor.isActive("heading", { level: 1 })}
            title="Heading 1"
          >
            H1
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor.isActive("heading", { level: 2 })}
            title="Heading 2"
          >
            H2
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            isActive={editor.isActive("heading", { level: 3 })}
            title="Heading 3"
          >
            H3
          </ToolbarButton>

          <div className="w-px h-6 bg-border mx-2" />

          {/* Text Formatting */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive("bold")}
            title="Bold (Ctrl+B)"
          >
            <strong>B</strong>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive("italic")}
            title="Italic (Ctrl+I)"
          >
            <em>I</em>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            isActive={editor.isActive("strike")}
            title="Strikethrough"
          >
            <del>S</del>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            isActive={editor.isActive("code")}
            title="Code"
          >
            <Code className="w-4 h-4" />
          </ToolbarButton>

          <div className="w-px h-6 bg-border mx-2" />

          {/* Lists */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive("bulletList")}
            title="Bullet List"
          >
            •
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive("orderedList")}
            title="Numbered List"
          >
            1.
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive("blockquote")}
            title="Quote"
          >
            "
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Divider"
          >
            —
          </ToolbarButton>

          <div className="w-px h-6 bg-border mx-2" />

          {/* Mermaid Button */}
          <ToolbarButton
            onClick={insertMermaidBlock}
            title="Insert Mermaid Diagram (Ctrl+M)"
          >
            <Sparkles className="w-4 h-4" />
          </ToolbarButton>

          <div className="w-px h-6 bg-border mx-2" />

          {/* Undo/Redo */}
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

      {/* Footer Status */}
      <div className="flex items-center justify-between p-3 border-t border-border text-sm text-muted-foreground">
        <div className="flex items-center gap-4">
          {hasChanges && !isSaving && (
            <span className="text-amber-500">● Unsaved changes</span>
          )}
          {isSaving && (
            <span className="flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Saving...
            </span>
          )}
          {lastSaved && !hasChanges && !isSaving && (
            <span>Saved: {lastSaved.toLocaleTimeString()}</span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded brutal-border hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : showSavedToast ? (
            <Check className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {showSavedToast ? "Saved!" : "Save"}
        </button>
      </div>

      {/* Toast Notification */}
      {showSavedToast && (
        <div className="fixed bottom-20 right-6 px-4 py-2 bg-primary text-primary-foreground rounded brutal-border shadow-lg animate-in fade-in slide-in-from-bottom-2">
          ✓ Documentation saved
        </div>
      )}

      {/* Styles for Mermaid rendering */}
      <style jsx global>{`
        .mermaid-container {
          display: flex;
          justify-content: center;
          padding: 1rem;
          overflow-x: auto;
          border-radius: 0.5rem;
          background: var(--code-bg, #f8f9fa);
          margin: 1rem 0;
          border: 1px solid var(--border);
        }
        .mermaid-container svg {
          max-width: 100%;
          height: auto;
        }
        .mermaid-container .mermaid-editor {
          width: 100%;
          font-family: monospace;
          background: transparent;
          border: none;
          outline: none;
          resize: vertical;
          min-height: 100px;
        }
        .mermaid-container .mermaid-preview {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100px;
        }
        .mermaid-container .mermaid-error {
          color: #ef4444;
          font-size: 0.875rem;
          padding: 0.5rem;
          background: #fef2f2;
          border-radius: 0.25rem;
          margin-top: 0.5rem;
        }
      `}</style>
    </div>
  );
}