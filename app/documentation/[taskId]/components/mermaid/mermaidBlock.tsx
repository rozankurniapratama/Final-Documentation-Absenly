// components/mermaid/MermaidBlock.tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import mermaid from "mermaid";
import { ZoomIn, ZoomOut, Maximize2, Minimize2, RefreshCw } from "lucide-react";

// Initialize mermaid once
if (typeof window !== "undefined") {
  mermaid.initialize({
    startOnLoad: false,
    theme: "default",
    securityLevel: "loose",
    fontFamily: "monospace",
    flowchart: {
      useMaxWidth: false,
      htmlLabels: true,
      curve: "basis",
    },
    sequence: {
      useMaxWidth: false,
    },
  });
}

interface MermaidBlockProps {
  code: string;
  onChange?: (code: string) => void;
  onRemove?: () => void;
  blockId?: string;
}

export default function MermaidBlock({
  code,
  onChange,
  onRemove,
  blockId,
}: MermaidBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [svgContent, setSvgContent] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editCode, setEditCode] = useState(code);

  // Zoom & Pan state
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Render mermaid diagram
  const renderDiagram = useCallback(async (mermaidCode: string) => {
    try {
      setError(null);
      const id = blockId || `mermaid-${Date.now()}`;
      const { svg } = await mermaid.render(id, mermaidCode);
      setSvgContent(svg);
    } catch (err: any) {
      console.error("Mermaid render error:", err);
      setError(err.message || "Failed to render diagram");
      setSvgContent("");
    }
  }, [blockId]);

  // Initial render
  useEffect(() => {
    if (code.trim()) {
      renderDiagram(code);
    }
  }, [code, renderDiagram]);

  // Update SVG ref after render
  useEffect(() => {
    if (containerRef.current && svgContent) {
      const svg = containerRef.current.querySelector("svg");
      if (svg) {
        svgRef.current = svg as SVGSVGElement;
        // Make SVG scalable
        svg.setAttribute("style", "width: 100%; height: auto;");
      }
    }
  }, [svgContent]);

  // Zoom handlers
  const handleZoomIn = () => setScale((s) => Math.min(s * 1.2, 4));
  const handleZoomOut = () => setScale((s) => Math.max(s / 1.2, 0.25));
  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Pan handlers (mouse/touch)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    e.preventDefault();
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch support for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    }
  };

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return;
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
      e.preventDefault();
    },
    [isDragging, dragStart]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Attach global event listeners for drag
  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleTouchMove, { passive: false });
      window.addEventListener("touchend", handleTouchEnd);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  // Wheel zoom support
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale((s) => Math.max(0.25, Math.min(s * delta, 4)));
    }
  };

  // Edit mode handlers
  const handleSaveEdit = () => {
    onChange?.(editCode);
    setIsEditing(false);
    renderDiagram(editCode);
  };

  const handleCancelEdit = () => {
    setEditCode(code);
    setIsEditing(false);
  };

  return (
    <div className="my-4 brutal-border bg-card rounded-lg overflow-hidden">
      {/* Block Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-secondary/50 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase text-muted-foreground">
            📊 Mermaid Diagram
          </span>
          {error && (
            <span className="text-xs text-destructive">⚠️ {error}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="p-1.5 hover:bg-[#a8d5ff] brutal-border rounded transition-colors"
                title="Edit diagram code"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={onRemove}
                className="p-1.5 hover:bg-destructive brutal-border rounded transition-colors"
                title="Remove diagram"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleSaveEdit}
                className="p-1.5 hover:bg-[#4ade80] brutal-border rounded transition-colors"
                title="Save changes"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <button
                onClick={handleCancelEdit}
                className="p-1.5 hover:bg-destructive brutal-border rounded transition-colors"
                title="Cancel"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Edit Mode */}
      {isEditing ? (
        <div className="p-3">
          <textarea
            value={editCode}
            onChange={(e) => setEditCode(e.target.value)}
            className="w-full h-40 px-3 py-2 brutal-border bg-background font-mono text-sm outline-none focus:ring-2 focus:ring-primary resize-y"
            placeholder="Enter Mermaid syntax&#10;&#10;Example:&#10;graph TD&#10;  A[Start] --> B{Decision}&#10;  B -->|Yes| C[Action]&#10;  B -->|No| D[End]"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            💡 <a href="https://mermaid.js.org/intro/" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Mermaid Syntax Guide</a>
          </p>
        </div>
      ) : (
        <>
          {/* Diagram Viewport */}
          <div
            ref={containerRef}
            className="relative overflow-hidden bg-background cursor-grab active:cursor-grabbing"
            style={{ minHeight: "200px", maxHeight: "500px" }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onWheel={handleWheel}
          >
            {/* SVG Container with Transform */}
            <div
              className="absolute inset-0 flex items-center justify-center transition-transform duration-75"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transformOrigin: "center center",
              }}
            >
              {svgContent ? (
                <div
                  dangerouslySetInnerHTML={{ __html: svgContent }}
                  className="mermaid-output"
                />
              ) : error ? (
                <div className="p-4 text-center text-destructive text-sm">
                  ⚠️ {error}
                </div>
              ) : (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  Enter Mermaid code to render a diagram
                </div>
              )}
            </div>

            {/* Zoom Controls */}
            <div className="absolute bottom-2 right-2 flex flex-col gap-1 bg-card brutal-border rounded p-1">
              <button
                onClick={handleZoomIn}
                className="p-1.5 hover:bg-[#a8d5ff] brutal-border rounded transition-colors"
                title="Zoom in (Ctrl + Scroll)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={handleZoomOut}
                className="p-1.5 hover:bg-[#a8d5ff] brutal-border rounded transition-colors"
                title="Zoom out (Ctrl + Scroll)"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={handleReset}
                className="p-1.5 hover:bg-[#a8d5ff] brutal-border rounded transition-colors"
                title="Reset view"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Zoom Level Indicator */}
            <div className="absolute bottom-2 left-2 px-2 py-1 brutal-border bg-card rounded text-xs font-mono">
              {Math.round(scale * 100)}%
            </div>
          </div>

          {/* Hint */}
          <div className="px-3 py-2 bg-secondary/30 text-xs text-muted-foreground border-t border-border flex items-center justify-between">
            <span>🖱️ Drag to pan • Ctrl+Scroll to zoom • Click ✏️ to edit code</span>
            <button
              onClick={() => setIsEditing(true)}
              className="underline hover:text-foreground"
            >
              Edit code
            </button>
          </div>
        </>
      )}
    </div>
  );
}