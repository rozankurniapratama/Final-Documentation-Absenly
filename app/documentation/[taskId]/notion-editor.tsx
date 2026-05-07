"use client";

import { useEditor, EditorContent, ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { all, createLowlight } from "lowlight";
import { useCallback, useEffect } from "react";
import { SlashMenu } from "./extensions/slash-menu";
import { DragHandle } from "./extensions/drag-handle";
import { NotionNodeView } from "./components/notion-node-view";

// Initialize syntax highlighting
const lowlight = createLowlight(all);

interface NotionEditorProps {
  initialContent: object | null;
  onChange: (content: object) => void;
  placeholder?: string;
}

export default function NotionEditor({
  initialContent,
  onChange,
  placeholder = "Type '/' for commands...",
}: NotionEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false, // Use lowlight version instead
      }),
      Placeholder.configure({
        placeholder,
        includeChildren: true,
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: "plaintext",
      }),
      SlashMenu,
      DragHandle,
    ],
    content: initialContent && Object.keys(initialContent).length > 0
      ? initialContent
      : { type: "doc", content: [{ type: "paragraph" }] },
    editorProps: {
      attributes: {
        class: "prose prose-lg max-w-none focus:outline-none notion-prose",
      },
      handleDOMEvents: {
        keydown: (_view, event) => {
          // Prevent default Enter behavior in some cases for better block handling
          if (event.key === "Enter" && event.shiftKey) {
            return false;
          }
          return false;
        },
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());
    },
    immediatelyRender: false,
    parseOptions: {
      preserveWhitespace: "full",
    },
  });

  // Sync external content changes
  useEffect(() => {
    if (editor && initialContent && Object.keys(initialContent).length > 0) {
      const current = editor.getJSON();
      if (JSON.stringify(current) !== JSON.stringify(initialContent)) {
        editor.commands.setContent(initialContent);
      }
    }
  }, [editor, initialContent]);

  if (!editor) {
    return (
      <div className="min-h-[400px] flex items-center justify-center text-gray-400">
        Loading editor...
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Drag handle container */}
      <DragHandle editor={editor} />

      {/* Slash menu container */}
      <SlashMenu editor={editor} />

      {/* Main editor */}
      <EditorContent editor={editor} />

      {/* Notion-like styles */}
      <style jsx global>{`
        .notion-prose {
          --tw-prose-body: #374151;
          --tw-prose-headings: #111827;
          --tw-prose-links: #2563eb;
          --tw-prose-bold: #111827;
          --tw-prose-counters: #6b7280;
          --tw-prose-bullets: #6b7280;
          --tw-prose-hr: #e5e7eb;
          --tw-prose-quotes: #374151;
          --tw-prose-quote-borders: #e5e7eb;
          --tw-prose-captions: #6b7280;
          --tw-prose-code: #111827;
          --tw-prose-pre-code: #e5e7eb;
          --tw-prose-pre-bg: #1f2937;
          --tw-prose-th-borders: #e5e7eb;
          --tw-prose-td-borders: #e5e7eb;
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
        
        .notion-prose blockquote p:first-child {
          margin-top: 0;
        }
        
        .notion-prose blockquote p:last-child {
          margin-bottom: 0;
        }
        
        .notion-prose code {
          background: #f3f4f6;
          color: #111827;
          padding: 0.2em 0.4em;
          border-radius: 0.25rem;
          font-size: 0.875em;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
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
        
        .notion-prose .task-list-item {
          list-style: none;
          margin: 0.25em 0;
          padding-left: 0;
        }
        
        .notion-prose .task-list-item label {
          display: flex;
          align-items: flex-start;
          gap: 0.5em;
          cursor: pointer;
        }
        
        .notion-prose .task-list-item input[type="checkbox"] {
          margin: 0.2em 0 0;
          width: 1em;
          height: 1em;
          accent-color: #2563eb;
          cursor: pointer;
        }
        
        .notion-prose a {
          color: #2563eb;
          text-decoration: none;
          font-weight: 500;
        }
        
        .notion-prose a:hover {
          text-decoration: underline;
        }
        
        .notion-prose img {
          max-width: 100%;
          height: auto;
          border-radius: 0.375rem;
          margin: 0.5em 0;
        }
        
        .ProseMirror-selectednode {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
          border-radius: 0.25rem;
        }
        
        /* Slash menu styles */
        .slash-menu {
          position: absolute;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 0.75rem;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
          z-index: 100;
          overflow: hidden;
          min-width: 280px;
          max-height: 300px;
          overflow-y: auto;
        }
        
        .slash-menu-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.625rem 0.875rem;
          cursor: pointer;
          transition: background 0.1s;
        }
        
        .slash-menu-item:hover,
        .slash-menu-item.selected {
          background: #f3f4f6;
        }
        
        .slash-menu-item-icon {
          width: 1.25rem;
          height: 1.25rem;
          color: #6b7280;
          flex-shrink: 0;
        }
        
        .slash-menu-item-title {
          font-size: 0.875rem;
          font-weight: 500;
          color: #111827;
        }
        
        .slash-menu-item-desc {
          font-size: 0.75rem;
          color: #6b7280;
          margin-left: auto;
        }
        
        /* Drag handle */
        .drag-handle {
          position: absolute;
          left: -1.5rem;
          top: 0.25rem;
          width: 1rem;
          height: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #9ca3af;
          cursor: grab;
          opacity: 0;
          transition: opacity 0.1s;
          z-index: 10;
        }
        
        .drag-handle:active {
          cursor: grabbing;
        }
        
        .ProseMirror-focused .drag-handle,
        .drag-handle:hover {
          opacity: 1;
        }
        
        /* Hide placeholder when focused */
        .ProseMirror-focused .is-editor-empty:first-child::before {
          display: none;
        }
      `}</style>
    </div>
  );
}