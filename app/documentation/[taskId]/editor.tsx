// app/documentation/[taskId]/editor/TaskEditor.tsx
"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
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
  FileDown,
  AlertTriangle,
  Download,
  Printer,
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
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/* ────────────────────────────────────────────
   ⚠️ MEMORY SAFETY CONFIG
   ──────────────────────────────────────────── */
const MEMORY_CONFIG = {
  MAX_CONTENT_LENGTH: 150000, // Warn if content exceeds this
  MAX_DIAGRAMS_IN_PDF: 8, // Limit diagrams per export to prevent OOM
  SVG_TO_PNG_SCALE: 1.5, // Lower scale = less memory (was 2.0)
  CLEANUP_TIMEOUT_MS: 500, // Delay before revoking blob URLs
  EXPORT_DEBOUNCE_MS: 2000, // Prevent rapid export clicks
};

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
   🧹 Blob URL Manager (Prevents Memory Leaks)
   ──────────────────────────────────────────── */
class BlobURLManager {
  private static urls: Set<string> = new Set();
  private static cleanupTimers: Map<string, NodeJS.Timeout> = new Map();

  static create(url: string): string {
    this.urls.add(url);
    return url;
  }

  static scheduleRevoke(url: string, delayMs = MEMORY_CONFIG.CLEANUP_TIMEOUT_MS) {
    // Clear existing timer if any
    if (this.cleanupTimers.has(url)) {
      clearTimeout(this.cleanupTimers.get(url));
    }
    
    const timer = setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
        this.urls.delete(url);
      } catch (e) {
        console.warn("Failed to revoke blob URL:", e);
      }
      this.cleanupTimers.delete(url);
    }, delayMs);
    
    this.cleanupTimers.set(url, timer);
  }

  static revokeAll() {
    this.urls.forEach(url => {
      try { URL.revokeObjectURL(url); } catch (e) {}
    });
    this.urls.clear();
    this.cleanupTimers.forEach(timer => clearTimeout(timer));
    this.cleanupTimers.clear();
  }

  static getStats() {
    return { active: this.urls.size, pending: this.cleanupTimers.size };
  }
}

/* ────────────────────────────────────────────
   Mermaid Block Component (UI UNTOUCHED + Memory Safe)
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

  const mermaidRef = useRef<any>(null);
  const counterRef = useRef(0);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    import("mermaid").then((m) => {
      mermaidRef.current = m.default;
      mermaidRef.current.initialize({
        startOnLoad: false,
        theme: "neutral",
        securityLevel: "loose",
      });
      setMermaidReady(true);
    });
  }, []);

  useEffect(() => {
    setLocalCode(node.attrs.code ?? "");
  }, [node.attrs.code]);

  const handleCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newCode = e.target.value;
      setLocalCode(newCode);
      updateAttributes({ code: newCode });
    },
    [updateAttributes],
  );

  useEffect(() => {
    if (!mermaidReady || !localCode.trim()) {
      setSvg("");
      setError("");
      setIsRendering(false);
      return;
    }

    let cancelled = false;
    counterRef.current += 1;
    const renderId = `mmd-${Date.now()}-${counterRef.current}`;

    setIsRendering(true);

    const timeout = setTimeout(async () => {
      try {
        const { svg: result } = await mermaidRef.current.render(
          renderId,
          localCode.trim(),
        );
        if (!cancelled) {
          setSvg(result);
          setError("");
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Syntax error in mermaid code");
          setSvg("");
        }
      } finally {
        if (!cancelled) setIsRendering(false);
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [localCode, mermaidReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Any SVG blob URLs created here would be cleaned by BlobURLManager
    };
  }, []);

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

  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFullscreen]);

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
            className={`text-[10px] font-mono min-w-[32px] text-center select-none ${
              dark ? "text-gray-400" : "text-gray-400"
            }`}
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
          {viewMode === "diagram" ? <DiagramPreview /> : <CodeEditor />}
        </div>
      </NodeViewWrapper>

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
   Mermaid TipTap Node Extension - SERIALIZATION SAFE
   ──────────────────────────────────────────── */
let _mermaidExt: any = null;

function getMermaidExtension() {
  if (_mermaidExt) return _mermaidExt;

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
            element.getAttribute("data-mermaid-code") ?? "",
          renderHTML: (attributes: Record<string, any>) => {
            if (!attributes.code) return {};
            return { "data-mermaid-code": String(attributes.code) };
          },
          keepOnSplit: false,
        },
      };
    },

    parseHTML() {
      return [{ tag: 'div[data-type="mermaid-diagram"]' }];
    },

    renderHTML({ HTMLAttributes, node }: any) {
      const code = node?.attrs?.code ?? HTMLAttributes?.["data-mermaid-code"] ?? "";
      return [
        "div",
        core.mergeAttributes(
          { "data-type": "mermaid-diagram", ...(code ? { "data-mermaid-code": code } : {}) },
          HTMLAttributes
        ),
      ];
    },

    toJSON() {
      return {
        type: this.name,
        attrs: { code: this.attrs.code ?? "" },
      };
    },

    addNodeView() {
      return ReactNodeViewRenderer(MermaidBlock);
    },
  });

  return _mermaidExt;
}

/* ────────────────────────────────────────────
   🔧 PDF Export Helpers (Memory-Safe Version)
   ──────────────────────────────────────────── */

/**
 * Reusable canvas pool to avoid creating new canvases repeatedly
 */
const CanvasPool = {
  pool: [] as HTMLCanvasElement[],
  
  acquire(width: number, height: number): HTMLCanvasElement {
    // Find existing canvas with same or larger dimensions
    const existing = this.pool.find(c => c.width >= width && c.height >= height);
    if (existing) {
      this.pool = this.pool.filter(c => c !== existing);
      existing.width = width;
      existing.height = height;
      return existing;
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  },
  
  release(canvas: HTMLCanvasElement) {
    // Clear and return to pool (limit pool size to 3)
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (this.pool.length < 3) {
      this.pool.push(canvas);
    }
  },
  
  clear() {
    this.pool = [];
  }
};

/**
 * Converts SVG to PNG with memory-safe canvas reuse
 */
async function svgToPngSafe(svg: string, scale = MEMORY_CONFIG.SVG_TO_PNG_SCALE): Promise<string> {
  return new Promise((resolve, reject) => {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svg, "image/svg+xml");
    const svgEl = svgDoc.querySelector("svg");
    
    if (!svgEl) {
      reject(new Error("Invalid SVG"));
      return;
    }

    // Get dimensions from SVG or fallback
    const width = parseInt(svgEl.getAttribute("width") || "800");
    const height = parseInt(svgEl.getAttribute("height") || "600");
    const scaledWidth = Math.round(width * scale);
    const scaledHeight = Math.round(height * scale);

    const canvas = CanvasPool.acquire(scaledWidth, scaledHeight);
    const ctx = canvas.getContext("2d");
    
    if (!ctx) {
      CanvasPool.release(canvas);
      reject(new Error("Could not get canvas context"));
      return;
    }

    const img = new Image();
    const svgBlob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(svgBlob);
    
    // Track this blob for cleanup
    BlobURLManager.create(url);

    img.onload = () => {
      try {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, scaledWidth, scaledHeight);
        ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);
        
        const pngUrl = canvas.toDataURL("image/png");
        URL.revokeObjectURL(url); // Immediate cleanup for SVG blob
        resolve(pngUrl);
      } catch (err) {
        reject(err);
      } finally {
        CanvasPool.release(canvas);
        BlobURLManager.scheduleRevoke(url); // Double-safety cleanup
      }
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      CanvasPool.release(canvas);
      BlobURLManager.scheduleRevoke(url);
      reject(err);
    };

    img.src = url;
  });
}

/**
 * Prepares content for PDF with professional styling and memory guards
 */
async function prepareContentForPdfSafe(
  editorContent: HTMLElement,
  options: { skipDiagrams?: boolean; maxDiagrams?: number } = {}
): Promise<{ element: HTMLElement; warning?: string }> {
  const clone = editorContent.cloneNode(true) as HTMLElement;
  const { skipDiagrams = false, maxDiagrams = MEMORY_CONFIG.MAX_DIAGRAMS_IN_PDF } = options;
  
  let diagramCount = 0;
  let skippedCount = 0;

  // Remove interactive elements
  clone.querySelectorAll('.ProseMirror-selectednode, .mermaid-node [class*="ring-"]').forEach(el => {
    el.classList.remove('ring-2', 'ring-purple-400', 'ring-offset-2', 'ProseMirror-selectednode');
  });

  // Convert Mermaid diagrams to PNG (with limit)
  if (!skipDiagrams) {
    const mermaidNodes = clone.querySelectorAll('.mermaid-node svg');
    
    for (const svgEl of Array.from(mermaidNodes)) {
      if (diagramCount >= maxDiagrams) {
        skippedCount++;
        // Replace with placeholder
        const placeholder = document.createElement("div");
        placeholder.style.cssText = "padding:1rem;background:#f3f4f6;border:1px dashed #9ca3af;border-radius:0.5rem;text-align:center;color:#6b7280;font-size:0.875rem";
        placeholder.textContent = "Diagram omitted (export limit reached)";
        svgEl.parentElement?.replaceWith(placeholder);
        continue;
      }

      try {
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgEl);
        const pngDataUrl = await svgToPngSafe(svgString);
        
        const img = document.createElement("img");
        img.src = pngDataUrl;
        img.style.cssText = "max-width:100%;height:auto;display:block;margin:1rem auto";
        img.alt = "Diagram";
        
        const parent = svgEl.parentElement;
        if (parent) parent.replaceWith(img);
        
        diagramCount++;
        // Schedule cleanup of the PNG data URL after delay
        if (pngDataUrl.startsWith("data:")) {
          // Data URLs don't need URL.revokeObjectURL, but we track for memory awareness
        }
      } catch (err) {
        console.warn("Failed to convert diagram:", err);
        // Keep SVG as fallback but add warning class
        svgEl.classList.add("print-fallback");
      }
    }
  } else {
    // If skipping diagrams, just hide them
    clone.querySelectorAll('.mermaid-node').forEach(el => {
      (el as HTMLElement).style.display = "none";
    });
  }

  // Apply professional print styles
  Object.assign(clone.style, {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    lineHeight: "1.7",
    color: "#1f2937",
    maxWidth: "800px",
    margin: "0 auto",
    padding: "2rem",
    boxSizing: "border-box",
  });

  // Style headings
  clone.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((heading: Element) => {
    Object.assign((heading as HTMLElement).style, {
      color: "#111827",
      margin: "1.5em 0 0.5em",
      fontWeight: "600",
      lineHeight: "1.3",
    });
  });
  clone.querySelectorAll('h1').forEach(el => (el as HTMLElement).style.fontSize = "1.875rem");
  clone.querySelectorAll('h2').forEach(el => (el as HTMLElement).style.fontSize = "1.5rem");
  clone.querySelectorAll('h3').forEach(el => (el as HTMLElement).style.fontSize = "1.25rem");

  // Style paragraphs
  clone.querySelectorAll('p').forEach(p => {
    Object.assign((p as HTMLElement).style, {
      margin: "0.75em 0",
      color: "#374151",
    });
  });

  // Style lists
  clone.querySelectorAll('ul, ol').forEach(list => {
    Object.assign((list as HTMLElement).style, {
      margin: "0.5em 0",
      paddingLeft: "1.5em",
    });
  });
  clone.querySelectorAll('li').forEach(li => {
    (li as HTMLElement).style.margin = "0.25em 0";
  });

  // Style code blocks
  clone.querySelectorAll('pre, code').forEach(el => {
    (el as HTMLElement).style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    (el as HTMLElement).style.fontSize = "0.875rem";
  });
  clone.querySelectorAll('pre').forEach(el => {
    Object.assign((el as HTMLElement).style, {
      background: "#1f2937",
      color: "#e5e7eb",
      padding: "1rem",
      borderRadius: "0.5rem",
      overflowX: "auto",
      margin: "1em 0",
    });
  });
  clone.querySelectorAll('code:not(pre code)').forEach(el => {
    Object.assign((el as HTMLElement).style, {
      background: "#f3f4f6",
      color: "#111827",
      padding: "0.2em 0.4em",
      borderRadius: "0.25rem",
    });
  });

  // Style blockquotes
  clone.querySelectorAll('blockquote').forEach(el => {
    Object.assign((el as HTMLElement).style, {
      borderLeft: "4px solid #e5e7eb",
      padding: "0.5em 0 0.5em 1em",
      margin: "1em 0",
      color: "#4b5563",
      fontStyle: "normal",
    });
  });

  // Style links
  clone.querySelectorAll('a').forEach(el => {
    Object.assign((el as HTMLElement).style, {
      color: "#2563eb",
      textDecoration: "none",
      fontWeight: "500",
    });
  });

  // Style tables
  clone.querySelectorAll('table').forEach(table => {
    Object.assign((table as HTMLElement).style, {
      width: "100%",
      borderCollapse: "collapse",
      margin: "1em 0",
    });
  });
  clone.querySelectorAll('th, td').forEach(cell => {
    Object.assign((cell as HTMLElement).style, {
      border: "1px solid #e5e7eb",
      padding: "0.75rem",
      textAlign: "left",
    });
  });
  clone.querySelectorAll('th').forEach(el => {
    Object.assign((el as HTMLElement).style, {
      background: "#f9fafb",
      fontWeight: "600",
    });
  });

  // Style horizontal rules
  clone.querySelectorAll('hr').forEach(el => {
    Object.assign((el as HTMLElement).style, {
      border: "none",
      borderTop: "1px solid #e5e7eb",
      margin: "2em 0",
    });
  });

  const warning = skippedCount > 0 
    ? `${skippedCount} diagram(s) omitted to prevent memory issues`
    : diagramCount > maxDiagrams 
      ? `Exported ${maxDiagrams} diagrams (limit reached)`
      : undefined;

  return { element: clone, warning };
}

/**
 * Simple fallback: use browser print dialog (zero memory risk)
 */
function exportViaPrint(title: string, moduleName: string, taskId: string) {
  const printWindow = window.open("", "_blank", "width=800,height=600");
  if (!printWindow) {
    alert("Popup blocked. Please allow popups for PDF export.");
    return;
  }

  const styles = `
    <style>
      @media print {
        body { margin: 0; padding: 20mm; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        .no-print { display: none !important; }
        .page-break { page-break-before: always; }
        img { max-width: 100%; height: auto; }
        pre { white-space: pre-wrap; word-wrap: break-word; }
      }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #1f2937; max-width: 800px; margin: 0 auto; padding: 2rem; }
      h1, h2, h3 { color: #111827; }
      .header { border-bottom: 2px solid #e5e7eb; padding-bottom: 1rem; margin-bottom: 2rem; }
      .footer { border-top: 1px solid #e5e7eb; padding-top: 1rem; margin-top: 2rem; text-align: center; color: #6b7280; font-size: 0.875rem; }
      code { background: #f3f4f6; padding: 0.2em 0.4em; border-radius: 0.25rem; font-family: monospace; }
      pre { background: #1f2937; color: #e5e7eb; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; }
      a { color: #2563eb; text-decoration: none; }
    </style>
  `;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title} - Documentation</title>
      ${styles}
    </head>
    <body>
      <div class="header no-print">
        <h1 style="margin:0">${title}</h1>
        <p style="margin:0.25rem 0;color:#6b7280">${moduleName} • Task #${taskId.slice(-4)}</p>
        <button onclick="window.print()" style="margin-top:1rem;padding:0.5rem 1rem;background:#2563eb;color:white;border:none;border-radius:0.375rem;cursor:pointer">🖨️ Print / Save as PDF</button>
        <p style="font-size:0.875rem;color:#6b7280;margin-top:0.5rem">Tip: In print dialog, choose "Save as PDF" as destination</p>
      </div>
      <div id="content"></div>
      <div class="footer">
        <p>Generated from Documentation System • ${new Date().toLocaleDateString()}</p>
        <p class="no-print" style="font-size:0.75rem">Close this tab after printing</p>
      </div>
      <script>
        // Copy editor content
        const editorContent = window.opener?.document?.querySelector('.ProseMirror');
        if (editorContent) {
          const clone = editorContent.cloneNode(true);
          // Remove interactive classes
          clone.querySelectorAll('.ProseMirror-selectednode, [class*="ring-"]').forEach(el => {
            el.classList.remove('ProseMirror-selectednode');
            el.className = el.className.replace(/ring-\\S+/g, '').trim();
          });
          document.getElementById('content').appendChild(clone);
        }
        // Auto-focus print button
        window.addEventListener('load', () => {
          const btn = document.querySelector('button');
          if (btn) btn.focus();
        });
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

/* ────────────────────────────────────────────
   Editor Component (MONOLITHIC)
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
  
  const [content, setContent] = useState<object>(initialContent || {});
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [showDiagramMenu, setShowDiagramMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMode, setExportMode] = useState<"full" | "simple" | "print">("full");
  const [exportWarning, setExportWarning] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const editorContentRef = useRef<HTMLDivElement>(null);
  const exportTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Global cleanup on unmount
  useEffect(() => {
    return () => {
      BlobURLManager.revokeAll();
      CanvasPool.clear();
      if (exportTimeoutRef.current) clearTimeout(exportTimeoutRef.current);
    };
  }, []);

  // Close diagram menu on outside click
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
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: "Type '/' for commands, or start writing..." }),
      getMermaidExtension(),
    ],
    content: initialContent && Object.keys(initialContent).length > 0
      ? initialContent
      : { type: "doc", content: [{ type: "paragraph" }] },
    editorProps: {
      attributes: { 
        class: "prose prose-lg max-w-none focus:outline-none notion-prose min-h-[50vh]",
        ref: editorContentRef 
      },
    },
    onUpdate: ({ editor }) => {
      const fresh = JSON.parse(JSON.stringify(editor.getJSON()));
      setContent(fresh);
      setHasChanges(true);
    },
    immediatelyRender: false,
  });

  // Check content size and warn if large
  const contentSizeWarning = useMemo(() => {
    if (!content) return null;
    const jsonStr = JSON.stringify(content);
    if (jsonStr.length > MEMORY_CONFIG.MAX_CONTENT_LENGTH) {
      return `Large document (${Math.round(jsonStr.length / 1000)}KB). PDF export may be slow or fail. Consider using "Simple Export" or "Print" mode.`;
    }
    return null;
  }, [content]);

  /* Save - Fetches directly from editor */
  const handleSave = useCallback(async () => {
    if (isSaving || !editor) return;
    setIsSaving(true);
    try {
      const raw = editor.getJSON();
      const cleanContent = JSON.parse(JSON.stringify(raw));
      
      const sanitizeMermaid = (obj: any): any => {
        if (!obj || typeof obj !== "object") return obj;
        if (Array.isArray(obj)) return obj.map(sanitizeMermaid);
        
        if (obj.type === "mermaidDiagram") {
          return {
            ...obj,
            attrs: { code: String(obj.attrs?.code ?? "") }
          };
        }
        
        const res: Record<string, any> = {};
        for (const k in obj) res[k] = sanitizeMermaid(obj[k]);
        return res;
      };

      const payload = sanitizeMermaid(cleanContent);
      const result = await saveDocumentationAction(taskId, payload, null);
      
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
  }, [taskId, isSaving, editor]);

  /**
   * Memory-safe PDF export with multiple modes
   */
  const handleExportPdf = useCallback(async (mode: "full" | "simple" | "print" = "full") => {
    if (!editor || isExporting) return;
    
    // Debounce rapid clicks
    if (exportTimeoutRef.current) {
      clearTimeout(exportTimeoutRef.current);
    }
    
    setIsExporting(true);
    setExportWarning(null);
    setExportMode(mode);
    
    try {
      // MODE: Print fallback (safest, zero memory risk)
      if (mode === "print") {
        exportViaPrint(taskName, moduleName, taskId);
        return;
      }

      // Create temporary container
      const exportContainer = document.createElement("div");
      Object.assign(exportContainer.style, {
        position: "absolute",
        left: "-9999px",
        top: "0",
        width: "210mm", // A4 width
        background: "white",
        boxSizing: "border-box",
      });
      document.body.appendChild(exportContainer);

      // Add header
      const header = document.createElement("div");
      header.style.cssText = "padding:1rem 2rem;border-bottom:2px solid #e5e7eb;margin-bottom:2rem";
      header.innerHTML = `
        <h1 style="margin:0;font-size:1.5rem;color:#111827">${taskName}</h1>
        <p style="margin:0.25rem 0 0;color:#6b7280;font-size:0.875rem">
          ${moduleName} • Task #${taskId.slice(-4)} • Exported: ${new Date().toLocaleDateString()}
        </p>
      `;
      exportContainer.appendChild(header);

      // Prepare content with memory guards
      const { element: preparedContent, warning } = await prepareContentForPdfSafe(
        editor.view.dom,
        { 
          skipDiagrams: mode === "simple",
          maxDiagrams: mode === "simple" ? 3 : MEMORY_CONFIG.MAX_DIAGRAMS_IN_PDF
        }
      );
      
      if (warning) setExportWarning(warning);
      exportContainer.appendChild(preparedContent);

      // Add footer
      const footer = document.createElement("div");
      footer.style.cssText = "padding:1rem 2rem;border-top:1px solid #e5e7eb;margin-top:2rem;text-align:center;color:#9ca3af;font-size:0.75rem";
      footer.textContent = `Generated from Documentation System • Page ${new Date().toLocaleDateString()}`;
      exportContainer.appendChild(footer);

      // Wait for images to load (with timeout guard)
      await new Promise((resolve, reject) => {
        const images = exportContainer.querySelectorAll("img");
        if (images.length === 0) {
          resolve(true);
          return;
        }
        
        let loaded = 0;
        const timeout = setTimeout(() => {
          console.warn("Image loading timeout, proceeding with loaded images");
          resolve(true);
        }, 5000); // 5 second max wait
        
        images.forEach(img => {
          if ((img as HTMLImageElement).complete) {
            loaded++;
          } else {
            img.onload = () => { 
              loaded++; 
              if (loaded === images.length) {
                clearTimeout(timeout);
                resolve(true);
              }
            };
            img.onerror = () => { 
              loaded++; 
              if (loaded === images.length) {
                clearTimeout(timeout);
                resolve(true);
              }
            };
          }
        });
        
        if (loaded === images.length) {
          clearTimeout(timeout);
          resolve(true);
        }
      });

      // Capture with html2canvas (optimized settings)
      const canvas = await html2canvas(exportContainer, {
        scale: 2, // Balance quality vs memory
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        removeContainer: true, // Auto-remove after capture
        windowWidth: exportContainer.scrollWidth,
        windowHeight: exportContainer.scrollHeight,
      });

      // Generate PDF
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const finalWidth = imgWidth * ratio;
      const finalHeight = imgHeight * ratio;

      pdf.addImage(imgData, "PNG", (pdfWidth - finalWidth) / 2, 10, finalWidth, finalHeight);
      
      // Download
      const fileName = `${taskName.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_${new Date().toISOString().split("T")[0]}.pdf`;
      pdf.save(fileName);

      // Cleanup: remove container and schedule blob cleanup
      document.body.removeChild(exportContainer);
      BlobURLManager.scheduleRevoke(imgData, 1000); // Schedule cleanup of PDF image data

    } catch (error: any) {
      console.error("PDF export failed:", error);
      
      // Fallback suggestion
      if (error.message?.includes("memory") || error.message?.includes("canvas")) {
        alert("PDF export failed due to memory constraints.\n\nTry:\n• 'Simple Export' (fewer diagrams)\n• 'Print Mode' (uses browser print)\n• Reduce document size");
      } else {
        alert("Failed to export PDF. Please try again or use Print mode.");
      }
    } finally {
      setIsExporting(false);
      // Final cleanup pass
      exportTimeoutRef.current = setTimeout(() => {
        BlobURLManager.revokeAll();
      }, 2000);
    }
  }, [editor, taskName, moduleName, taskId, isExporting]);

  const insertMermaidDiagram = useCallback(
    (templateCode?: string) => {
      if (!editor) return;
      const code = templateCode || `graph TD
    A[Start] --> B{Decision}
    B -- Yes --> C[Continue]
    B -- No --> D[Fix it]
    D --> B`;
      editor
        .chain()
        .focus()
        .insertContent({ type: "mermaidDiagram", attrs: { code } })
        .run();
      setShowDiagramMenu(false);
    },
    [editor],
  );

  // Auto-save debounce
  useEffect(() => {
    if (!hasChanges || isSaving) return;
    const timer = setTimeout(handleSave, 30000);
    return () => clearTimeout(timer);
  }, [hasChanges, isSaving, handleSave]);

  // Keyboard shortcuts
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
      if ((e.metaKey || e.ctrlKey) && e.key === "e" && e.shiftKey) {
        e.preventDefault();
        // Show export options instead of immediate export
        setExportMode("full");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, insertMermaidDiagram]);

  // Unsaved changes warning
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

  // Sync initial content
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
    disabled,
  }: {
    onClick: () => void;
    isActive?: boolean;
    children: React.ReactNode;
    title: string;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`p-2 rounded transition-colors ${
        disabled 
          ? "text-gray-300 cursor-not-allowed" 
          : isActive 
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
      {/* ── Header ── */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm p-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/documentation")} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-gray-900" aria-label="Back">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex flex-col">
            <span className="text-xs text-gray-500 font-medium">{moduleName}</span>
            <h1 className="text-sm font-semibold text-gray-900">{taskName}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {showSavedToast && (
            <span className="flex items-center gap-1 text-xs text-green-600 font-medium animate-fade-in">
              <Check className="w-3 h-3" /> Saved
            </span>
          )}
          {lastSaved && !showSavedToast && (
            <span className="text-xs text-gray-400 hidden sm:inline">
              {lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {hasChanges && !isSaving && (
            <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Editing
            </span>
          )}
          
          {/* PDF Export Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowDiagramMenu(v => !v)}
              disabled={isExporting}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
                isExporting 
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                  : "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98]"
              }`}
              title="Export options (Shift+Ctrl+E)"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">{isExporting ? "Exporting" : "Export"}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            
            {showDiagramMenu && (
              <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50 animate-fade-in">
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-xs font-medium text-gray-700">Export Mode</p>
                  {contentSizeWarning && (
                    <p className="text-[10px] text-amber-600 mt-1 flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      {contentSizeWarning}
                    </p>
                  )}
                </div>
                
                <button
                  type="button"
                  onClick={() => { handleExportPdf("full"); setShowDiagramMenu(false); }}
                  disabled={isExporting}
                  className="w-full px-3 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-3 transition-colors disabled:opacity-50"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <FileDown className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Full Export</p>
                    <p className="text-[10px] text-gray-500">All content + diagrams (may be slow)</p>
                  </div>
                </button>
                
                <button
                  type="button"
                  onClick={() => { handleExportPdf("simple"); setShowDiagramMenu(false); }}
                  disabled={isExporting}
                  className="w-full px-3 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-3 transition-colors disabled:opacity-50"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <Download className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Simple Export</p>
                    <p className="text-[10px] text-gray-500">Text only, max 3 diagrams (fast & safe)</p>
                  </div>
                </button>
                
                <button
                  type="button"
                  onClick={() => { handleExportPdf("print"); setShowDiagramMenu(false); }}
                  disabled={isExporting}
                  className="w-full px-3 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-3 transition-colors disabled:opacity-50"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Printer className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Print Mode</p>
                    <p className="text-[10px] text-gray-500">Use browser print → Save as PDF (zero memory risk)</p>
                  </div>
                </button>
                
                {exportWarning && (
                  <div className="px-3 py-2 border-t border-gray-100 bg-amber-50">
                    <p className="text-[10px] text-amber-700 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {exportWarning}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
              isSaving || !hasChanges ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-black text-white hover:bg-gray-800 active:scale-[0.98]"
            }`}
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span className="hidden sm:inline">{isSaving ? "Saving" : "Save"}</span>
          </button>
        </div>
      </header>

      {/* Content size warning banner */}
      {contentSizeWarning && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2">
          <div className="max-w-3xl mx-auto flex items-center gap-2 text-xs text-amber-800">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{contentSizeWarning}</span>
          </div>
        </div>
      )}

      {/* ── Editor Area ── */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="mb-6 pb-4 border-b border-gray-100">
            <input type="text" value={taskName} readOnly className="w-full text-3xl sm:text-4xl font-bold text-gray-900 placeholder-gray-300 bg-transparent border-none outline-none focus:ring-0 p-0" placeholder="Untitled" />
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
              <span>{moduleName}</span>
              <span>•</span>
              <span>Task #{taskId.slice(-4)}</span>
            </div>
          </div>

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
                <Sparkles className="w-4 h-4 text-purple-500" /><ChevronDown className="w-3 h-3" />
              </button>
              {showDiagramMenu && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50 animate-fade-in">
                  <button type="button" onClick={() => insertMermaidDiagram()} className="w-full px-3 py-2 text-left text-sm hover:bg-purple-50 flex items-center gap-2 transition-colors">
                    <Sparkles className="w-4 h-4 text-purple-400" /><span className="text-gray-700">Blank Diagram</span>
                    <kbd className="ml-auto text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono">Ctrl+M</kbd>
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  {DIAGRAM_TEMPLATES.map((tpl) => {
                    const Icon = tpl.icon;
                    return (
                      <button key={tpl.label} type="button" onClick={() => insertMermaidDiagram(tpl.code)} className="w-full px-3 py-2 text-left text-sm hover:bg-purple-50 flex items-center gap-2 transition-colors">
                        <Icon className="w-4 h-4 text-gray-400" /><span className="text-gray-700">{tpl.label}</span>
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

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 bg-white/80 backdrop-blur-sm px-4 py-2 text-xs text-gray-400 flex items-center justify-between">
        <span>{hasChanges ? "● Unsaved changes" : "✓ All changes saved"}</span>
        <span className="hidden sm:inline">
          <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono text-[10px]">S</kbd> save • 
          <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono text-[10px]">M</kbd> diagram • 
          <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono text-[10px]">Shift+Ctrl+E</kbd> export
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
        
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}