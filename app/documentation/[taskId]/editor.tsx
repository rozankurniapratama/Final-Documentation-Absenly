"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Loader2,
  Check,
  Sparkles,
  ChevronDown,
  GitBranch,
  Table,
  Workflow,
  Network,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Code,
  Eye,
} from "lucide-react";
import { saveDocumentationAction } from "../actions";
import {
  useEditor,
  EditorContent,
  ReactNodeViewRenderer,
  NodeViewWrapper,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

/* ────────────────────────────────────────────
   Diagram Templates
   ──────────────────────────────────────────── */

const DIAGRAM_TEMPLATES = [
  {
    label: "Flowchart",
    icon: GitBranch,
    code: `graph TD
    A[Start] --> B{Decision}
    B -- Yes --> C[OK]
    B -- No --> D[Fix]
    D --> B
    C --> E[End]`,
  },
  {
    label: "Sequence",
    icon: Workflow,
    code: `sequenceDiagram
    participant U as User
    participant S as Server
    participant D as Database
    U->>S: Request
    S->>D: Query
    D-->>S: Data
    S-->>U: Response`,
  },
  {
    label: "Class",
    icon: Table,
    code: `classDiagram
    class Animal {
        +String name
        +int age
        +makeSound()
    }
    class Dog {
        +fetch()
    }
    class Cat {
        +purr()
    }
    Animal <|-- Dog
    Animal <|-- Cat`,
  },
  {
    label: "State",
    icon: Network,
    code: `stateDiagram-v2
    [*] --> Idle
    Idle --> Loading: fetch
    Loading --> Success: ok
    Loading --> Error: fail
    Error --> Loading: retry
    Success --> [*]`,
  },
];

/* ────────────────────────────────────────────
   Mermaid Block — fixed initial render
   ──────────────────────────────────────────── */

function MermaidBlock({
  node,
  updateAttributes,
  selected,
}: {
  node: any;
  updateAttributes: (attrs: Record<string, any>) => void;
  selected: boolean;
}) {
  const [localCode, setLocalCode] = useState(node.attrs.code ?? "");
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const [isRendering, setIsRendering] = useState(false);
  const [mermaidReady, setMermaidReady] = useState(false);
  const [viewMode, setViewMode] = useState<"diagram" | "code">("diagram");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Refs for stable access inside callbacks / effects
  const mermaidRef = useRef<any>(null);
  const counterRef = useRef(0);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const localCodeRef = useRef(node.attrs.code ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  /* ── Core render function ── */
  const doRender = useCallback(async (code: string) => {
    if (!mermaidRef.current || !code.trim()) {
      setSvg("");
      setError("");
      return;
    }

    counterRef.current += 1;
    const id = `mmd-${Date.now()}-${counterRef.current}`;
    setIsRendering(true);

    try {
      const { svg: result } = await mermaidRef.current.render(
        id,
        code.trim(),
      );
      setSvg(result);
      setError("");
    } catch (e: any) {
      setError(e?.message || "Syntax error");
      setSvg("");
    } finally {
      setIsRendering(false);
    }
  }, []);

  /* ── Load mermaid once ── */
  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;

    import("mermaid").then((m) => {
      if (cancelled) return;

      mermaidRef.current = m.default;
      mermaidRef.current.initialize({
        startOnLoad: false,
        theme: "neutral",
        securityLevel: "loose",
      });

      setMermaidReady(true);

      // Render any existing code IMMEDIATELY on load
      const existingCode = localCodeRef.current;
      if (existingCode.trim()) {
        doRender(existingCode);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [doRender]);

  /* ── Sync from node attrs (undo / redo) ── */
  useEffect(() => {
    const code = node.attrs.code ?? "";
    setLocalCode(code);
    localCodeRef.current = code;

    // If mermaid is already loaded, render the restored code
    if (mermaidReady && code.trim()) {
      doRender(code);
    }
  }, [node.attrs.code, mermaidReady, doRender]);

  /* ── Textarea change → update node attribute + debounced render ── */
  const handleCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newCode = e.target.value;
      setLocalCode(newCode);
      localCodeRef.current = newCode;
      updateAttributes({ code: newCode });

      // Debounce rendering while user is typing
      clearTimeout(debounceRef.current);
      if (!newCode.trim()) {
        setSvg("");
        setError("");
        return;
      }
      debounceRef.current = setTimeout(() => {
        doRender(newCode);
      }, 500);
    },
    [updateAttributes, doRender],
  );

  /* ── Zoom / Pan ── */
  const handleZoomIn = useCallback(
    () => setZoom((z) => Math.min(z + 0.25, 3)),
    [],
  );
  const handleZoomOut = useCallback(
    () => setZoom((z) => Math.max(z - 0.25, 0.25)),
    [],
  );
  const handleReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (zoom <= 1) return;
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      panStartRef.current = { ...pan };
      e.preventDefault();
    },
    [zoom, pan],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      setPan({
        x: panStartRef.current.x + (e.clientX - dragStartRef.current.x),
        y: panStartRef.current.y + (e.clientY - dragStartRef.current.y),
      });
    },
    [isDragging],
  );

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom((z) =>
        Math.min(Math.max(z + (e.deltaY > 0 ? -0.1 : 0.1), 0.25), 3),
      );
    }
  }, []);

  /* ── Escape to close fullscreen ── */
  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFullscreen]);

  /* ── Sub-components ── */

  const DiagramPreview = ({ large }: { large?: boolean }) => (
    <div
      className={`relative overflow-hidden bg-white ${large ? "h-full" : "min-h-[200px] max-h-[500px]"}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      style={{
        cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default",
      }}
    >
      {svg ? (
        <div
          className="p-6 flex items-center justify-center transition-transform duration-150"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : error ? (
        <div className="p-4">
          <pre className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg p-3 overflow-x-auto font-mono whitespace-pre-wrap">
            {error}
          </pre>
        </div>
      ) : (
        <div className="flex items-center justify-center h-full min-h-[120px]">
          <span className="text-xs text-gray-300 italic">
            Type mermaid code to see diagram...
          </span>
        </div>
      )}
    </div>
  );

  const CodeEditor = () => (
    <div className="bg-[#1e1e2e]">
      <textarea
        value={localCode}
        onChange={handleCodeChange}
        spellCheck={false}
        className="w-full p-4 min-h-[200px] max-h-[400px] bg-transparent text-[13px] font-mono text-[#cdd6f4] leading-relaxed outline-none resize-y whitespace-pre"
        placeholder="Type mermaid syntax here..."
      />
    </div>
  );

  const ViewToolbar = ({ dark }: { dark?: boolean }) => (
    <div className="flex items-center gap-1">
      <div
        className={`flex rounded-md p-0.5 ${dark ? "bg-white/10" : "bg-gray-100"}`}
      >
        <button
          type="button"
          onClick={() => setViewMode("diagram")}
          className={`px-2 py-1 rounded text-xs font-medium transition-all flex items-center gap-1 ${
            viewMode === "diagram"
              ? dark
                ? "bg-white/20 text-white"
                : "bg-white text-gray-800 shadow-sm"
              : dark
                ? "text-gray-400 hover:text-white"
                : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Eye className="w-3 h-3" />
          Preview
        </button>
        <button
          type="button"
          onClick={() => setViewMode("code")}
          className={`px-2 py-1 rounded text-xs font-medium transition-all flex items-center gap-1 ${
            viewMode === "code"
              ? dark
                ? "bg-white/20 text-white"
                : "bg-white text-gray-800 shadow-sm"
              : dark
                ? "text-gray-400 hover:text-white"
                : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Code className="w-3 h-3" />
          Code
        </button>
      </div>

      {viewMode === "diagram" && (
        <>
          <div
            className={`w-px h-5 mx-1 ${dark ? "bg-white/10" : "bg-gray-200"}`}
          />
          <button
            type="button"
            onClick={handleZoomOut}
            className={`p-1.5 rounded transition-colors ${
              dark
                ? "hover:bg-white/10 text-gray-300"
                : "hover:bg-gray-100 text-gray-500"
            }`}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span
            className={`text-[10px] font-mono min-w-[32px] text-center select-none text-gray-400`}
          >
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            className={`p-1.5 rounded transition-colors ${
              dark
                ? "hover:bg-white/10 text-gray-300"
                : "hover:bg-gray-100 text-gray-500"
            }`}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleReset}
            className={`p-1.5 rounded transition-colors ${
              dark
                ? "hover:bg-white/10 text-gray-300"
                : "hover:bg-gray-100 text-gray-500"
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </>
      )}

      <div
        className={`w-px h-5 mx-1 ${dark ? "bg-white/10" : "bg-gray-200"}`}
      />
      <button
        type="button"
        onClick={() => setIsFullscreen(true)}
        className={`p-1.5 rounded transition-colors ${
          dark
            ? "hover:bg-white/10 text-gray-300"
            : "hover:bg-gray-100 text-gray-500"
        }`}
      >
        <Maximize2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  /* ── Main render ── */

  return (
    <>
      <NodeViewWrapper
        as="div"
        className={`mermaid-node my-6 ${
          selected
            ? "ring-2 ring-purple-400 ring-offset-2 rounded-2xl"
            : ""
        }`}
      >
        <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm bg-white group">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
              </div>
              <span className="text-[11px] font-mono text-gray-400 ml-1">
                mermaid.diagram
              </span>
              {isRendering && (
                <Loader2 className="w-3 h-3 animate-spin text-amber-500 ml-1" />
              )}
              {!isRendering && svg && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 ml-1" />
              )}
            </div>
            <ViewToolbar />
          </div>

          {/* Body */}
          {viewMode === "diagram" ? <DiagramPreview /> : <CodeEditor />}
        </div>
      </NodeViewWrapper>

      {/* Fullscreen modal */}
      {isFullscreen && (
        <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex flex-col animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3 bg-black/50 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-400" />
                <span className="w-3 h-3 rounded-full bg-amber-400" />
                <span className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <span className="text-sm font-mono text-gray-300">
                mermaid.diagram
              </span>
              {isRendering && (
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <ViewToolbar dark />
              <div className="w-px h-6 bg-white/10 mx-1" />
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="p-2 rounded-lg hover:bg-white/10 text-gray-300 transition-colors"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            {viewMode === "diagram" ? (
              <DiagramPreview large />
            ) : (
              <div className="h-full bg-[#1e1e2e] overflow-auto p-6">
                <textarea
                  value={localCode}
                  onChange={handleCodeChange}
                  spellCheck={false}
                  className="w-full h-full max-w-4xl mx-auto block bg-transparent text-sm font-mono text-[#cdd6f4] leading-relaxed outline-none resize-none whitespace-pre"
                />
              </div>
            )}
          </div>

          <div className="px-4 py-2 bg-black/50 border-t border-white/10 text-[11px] text-gray-500 flex items-center gap-4">
            <span>
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-gray-400 font-mono text-[10px]">
                Esc
              </kbd>{" "}
              close
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-gray-400 font-mono text-[10px]">
                Ctrl
              </kbd>{" "}
              + scroll zoom
            </span>
            {zoom > 1 && <span>Drag to pan</span>}
          </div>
        </div>
      )}
    </>
  );
}

/* ────────────────────────────────────────────
   Mermaid TipTap Extension (leaf + attribute)
   ──────────────────────────────────────────── */

let _mermaidExt: any = null;

function getMermaidExtension() {
  if (_mermaidExt) return _mermaidExt;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const core = require("@tiptap/core") as typeof import("@tiptap/core");

  _mermaidExt = core.Node.create({
    name: "mermaidDiagram",
    group: "block",
    atom: true,

    addAttributes() {
      return {
        code: {
          default: "",
          parseHTML: (element: HTMLElement) =>
            element.getAttribute("data-mermaid-code") || "",
          renderHTML: (attributes: any) => ({
            "data-mermaid-code": attributes.code,
          }),
        },
      };
    },

    parseHTML() {
      return [{ tag: 'div[data-type="mermaid-diagram"]' }];
    },

    renderHTML({ HTMLAttributes }: any) {
      return [
        "div",
        core.mergeAttributes(HTMLAttributes, {
          "data-type": "mermaid-diagram",
        }),
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
  const [showDiagramMenu, setShowDiagramMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowDiagramMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const result = await saveDocumentationAction(
        taskId,
        contentRef.current,
        null,
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

  const insertMermaidDiagram = useCallback(
    (templateCode?: string) => {
      if (!editor) return;
      const code =
        templateCode ||
        `graph TD
    A[Start] --> B{Decision}
    B -- Yes --> C[Continue]
    B -- No --> D[Fix it]
    D --> B`;
      editor
        .chain()
        .focus()
        .insertContent({
          type: "mermaidDiagram",
          attrs: { code },
        })
        .run();
      setShowDiagramMenu(false);
    },
    [editor],
  );

  useEffect(() => {
    if (!hasChanges || isSaving) return;
    const timer = setTimeout(() => {
      handleSave();
    }, 30000);
    return () => clearTimeout(timer);
  }, [hasChanges, isSaving, handleSave]);

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

  useEffect(() => {
    if (editor && initialContent && Object.keys(initialContent).length > 0) {
      const current = editor.getJSON();
      if (JSON.stringify(current) !== JSON.stringify(initialContent)) {
        editor.commands.setContent(initialContent);
      }
    }
  }, [editor, initialContent]);

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

      {/* Editor */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
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
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive("heading", { level: 1 })} title="Heading 1"><span className="text-sm font-bold">H1</span></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive("heading", { level: 2 })} title="Heading 2"><span className="text-sm font-bold">H2</span></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive("heading", { level: 3 })} title="Heading 3"><span className="text-sm font-bold">H3</span></ToolbarButton>
            <div className="w-px bg-gray-200 mx-1" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive("bold")} title="Bold (Ctrl+B)"><span className="font-bold">B</span></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive("italic")} title="Italic (Ctrl+I)"><span className="italic">I</span></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive("strike")} title="Strikethrough"><span className="line-through">S</span></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive("code")} title="Code"><span className="font-mono text-xs">{`</>`}</span></ToolbarButton>
            <div className="w-px bg-gray-200 mx-1" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive("bulletList")} title="Bullet List"><span className="text-sm">•</span></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive("orderedList")} title="Numbered List"><span className="text-sm">1.</span></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive("blockquote")} title="Quote"><span className="text-lg leading-none">&ldquo;</span></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider"><span className="text-sm">—</span></ToolbarButton>
            <div className="w-px bg-gray-200 mx-1" />

            <div className="relative" ref={menuRef}>
              <button type="button" onClick={() => setShowDiagramMenu((v) => !v)} title="Insert Mermaid Diagram (Ctrl+M)" className="p-2 rounded transition-colors text-gray-500 hover:bg-gray-100 hover:text-gray-700 flex items-center gap-1">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <ChevronDown className="w-3 h-3" />
              </button>
              {showDiagramMenu && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50 animate-fade-in">
                  <button type="button" onClick={() => insertMermaidDiagram()} className="w-full px-3 py-2 text-left text-sm hover:bg-purple-50 flex items-center gap-2 transition-colors">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span className="text-gray-700">Blank Diagram</span>
                    <kbd className="ml-auto text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono">Ctrl+M</kbd>
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  {DIAGRAM_TEMPLATES.map((tpl) => {
                    const Icon = tpl.icon;
                    return (
                      <button key={tpl.label} type="button" onClick={() => insertMermaidDiagram(tpl.code)} className="w-full px-3 py-2 text-left text-sm hover:bg-purple-50 flex items-center gap-2 transition-colors">
                        <Icon className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-700">{tpl.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="w-px bg-gray-200 mx-1" />
            <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo (Ctrl+Z)">↩</ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo (Ctrl+Y)">↪</ToolbarButton>
          </div>

          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white/80 backdrop-blur-sm px-4 py-2 text-xs text-gray-400 flex items-center justify-between">
        <span>{hasChanges ? "● Unsaved changes" : "✓ All changes saved"}</span>
        <span className="hidden sm:inline">
          <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono text-[10px]">S</kbd> to save · <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono text-[10px]">M</kbd> for diagram
        </span>
      </footer>

      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
        kbd { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }

        .notion-prose { --tw-prose-body: #374151; --tw-prose-headings: #111827; --tw-prose-bold: #111827; --tw-prose-bullets: #6b7280; --tw-prose-hr: #e5e7eb; --tw-prose-quotes: #374151; --tw-prose-quote-borders: #e5e7eb; --tw-prose-code: #111827; --tw-prose-pre-bg: #1f2937; --tw-prose-pre-code: #e5e7eb; }
        .notion-prose > *:first-child { margin-top: 0; }
        .notion-prose p { margin: 0.25em 0; line-height: 1.75; color: #374151; }
        .notion-prose p.is-editor-empty:first-child::before { color: #9ca3af; content: attr(data-placeholder); float: left; height: 0; pointer-events: none; }
        .notion-prose h1 { font-size: 1.875rem; font-weight: 700; margin: 1.5em 0 0.5em; color: #111827; line-height: 1.3; }
        .notion-prose h2 { font-size: 1.5rem; font-weight: 600; margin: 1.25em 0 0.5em; color: #111827; line-height: 1.4; }
        .notion-prose h3 { font-size: 1.25rem; font-weight: 600; margin: 1em 0 0.5em; color: #111827; line-height: 1.5; }
        .notion-prose ul, .notion-prose ol { margin: 0.5em 0; padding-left: 1.5em; }
        .notion-prose li { margin: 0.25em 0; padding-left: 0.25em; }
        .notion-prose li > p { margin: 0; display: inline; }
        .notion-prose blockquote { margin: 1em 0; padding: 0.25em 0 0.25em 1em; border-left: 3px solid #e5e7eb; color: #4b5563; font-style: normal; }
        .notion-prose code { background: #f3f4f6; color: #111827; padding: 0.2em 0.4em; border-radius: 0.25rem; font-size: 0.875em; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
        .notion-prose pre { margin: 1em 0; background: #1f2937; border-radius: 0.5rem; padding: 1em; overflow-x: auto; }
        .notion-prose pre code { background: transparent; color: #e5e7eb; padding: 0; font-size: 0.875em; }
        .notion-prose hr { margin: 2em 0; border: none; border-top: 1px solid #e5e7eb; }
        .notion-prose a { color: #2563eb; text-decoration: none; font-weight: 500; }
        .notion-prose a:hover { text-decoration: underline; }
        .ProseMirror-focused { outline: none; }
        .ProseMirror-selectednode { outline: 2px solid #3b82f6; outline-offset: 2px; border-radius: 0.25rem; }
        .mermaid-node .ProseMirror-focused { outline: none; }
        .mermaid-node .ProseMirror-selectednode { outline: none; }
      `}</style>
    </div>
  );
}
