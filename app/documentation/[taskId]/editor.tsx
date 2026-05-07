"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { saveDocumentationAction } from "../actions";
import dynamic from "next/dynamic";
import TiptapEditor from "./tiptap-editor";

// Dynamically import Excalidraw to avoid SSR issues
const ExcalidrawWrapper = dynamic(() => import("./excalidraw-wrapper"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-secondary">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

interface TaskEditorProps {
  taskId: string;
  taskName: string;
  moduleName: string;
  initialTextContent: object | null;
  initialDrawingContent: object | null;
}

export default function TaskEditor({
  taskId,
  taskName,
  moduleName,
  initialTextContent,
  initialDrawingContent,
}: TaskEditorProps) {
  const router = useRouter();
  const [textContent, setTextContent] = useState<object>(
    initialTextContent || {}
  );
  const [drawingContent, setDrawingContent] = useState<object>(
    initialDrawingContent || {}
  );
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Handle text content change
  const handleTextChange = useCallback((content: object) => {
    setTextContent(content);
    setHasChanges(true);
  }, []);

  // Handle drawing content change
  const handleDrawingChange = useCallback((elements: object, appState: object) => {
    setDrawingContent({ elements, appState });
    setHasChanges(true);
  }, []);

  // Save documentation
  const handleSave = async () => {
    setIsSaving(true);
    const result = await saveDocumentationAction(
      taskId,
      textContent,
      drawingContent
    );

    if (!result.error) {
      setLastSaved(new Date());
      setHasChanges(false);
    } else {
      console.error("Save error:", result.error);
    }
    setIsSaving(false);
  };

  // Auto-save every 30 seconds if there are changes
  useEffect(() => {
    if (!hasChanges) return;

    const timer = setTimeout(() => {
      handleSave();
    }, 30000);

    return () => clearTimeout(timer);
  }, [hasChanges, textContent, drawingContent]);

  // Keyboard shortcut for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [textContent, drawingContent]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="brutal-border-3 border-t-0 border-l-0 border-r-0 bg-card p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/documentation")}
            className="p-2 brutal-border bg-card hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="text-xs font-mono text-muted-foreground uppercase">
              {moduleName}
            </p>
            <h1 className="text-xl font-black">{taskName}</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {lastSaved && (
            <span className="text-xs font-mono text-muted-foreground">
              Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
          {hasChanges && !isSaving && (
            <span className="text-xs font-mono text-accent-foreground bg-accent px-2 py-1 brutal-border">
              Unsaved changes
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 brutal-border bg-primary text-primary-foreground font-bold flex items-center gap-2 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all brutal-shadow disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </header>

      {/* Main content - split view */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Text Editor (Tiptap) */}
        <div className="flex-1 flex flex-col border-b-2 lg:border-b-0 lg:border-r-2 border-border">
          <div className="bg-[#a8d5ff] brutal-border-3 border-t-0 border-l-0 border-r-0 p-2 flex items-center gap-2">
            <span className="font-bold uppercase text-sm">Rich Text Editor</span>
            <span className="text-xs font-mono text-foreground/70">
              (Notion-like)
            </span>
          </div>
          <div className="flex-1 overflow-auto">
            <TiptapEditor
              initialContent={initialTextContent}
              onChange={handleTextChange}
            />
          </div>
        </div>

        {/* Drawing Canvas (Excalidraw) */}
        <div className="flex-1 flex flex-col min-h-[400px] lg:min-h-0">
          <div className="bg-[#ffd60a] brutal-border-3 border-t-0 border-l-0 border-r-0 p-2 flex items-center gap-2">
            <span className="font-bold uppercase text-sm">Drawing Canvas</span>
            <span className="text-xs font-mono text-foreground/70">
              (Excalidraw)
            </span>
          </div>
          <ExcalidrawWrapper
            initialData={initialDrawingContent}
            onChange={handleDrawingChange}
          />
        </div>
      </div>
    </div>
  );
}
