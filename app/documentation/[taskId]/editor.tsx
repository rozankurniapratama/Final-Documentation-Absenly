"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { saveDocumentationAction } from "../actions";
import dynamic from "next/dynamic";
import TiptapEditor from "./tiptap-editor";

// Dynamically import Excalidraw to avoid SSR issues
const ExcalidrawWrapper = dynamic(() => import("./excalidraw-wrapper"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-secondary min-h-[300px]">
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

  // Refs to track latest content without triggering re-renders
  const textContentRef = useRef<object>(initialTextContent || {});
  const drawingContentRef = useRef<object>(initialDrawingContent || {});

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
    textContentRef.current = content;
    setHasChanges(true);
  }, []);

  // Handle drawing content change
  const handleDrawingChange = useCallback((elements: object, appState: object) => {
    const newDrawingContent = { elements, appState };
    setDrawingContent(newDrawingContent);
    drawingContentRef.current = newDrawingContent;
    setHasChanges(true);
  }, []);

  // Save documentation - memoized with stable dependencies
  const handleSave = useCallback(async () => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      const result = await saveDocumentationAction(
        taskId,
        textContentRef.current,
        drawingContentRef.current
      );

      if (!result.error) {
        setLastSaved(new Date());
        setHasChanges(false);
      } else {
        console.error("Save error:", result.error);
      }
    } catch (error) {
      console.error("Save exception:", error);
    } finally {
      setIsSaving(false);
    }
  }, [taskId, isSaving]);

  // Auto-save every 30 seconds if there are changes
  useEffect(() => {
    if (!hasChanges || isSaving) return;

    const timer = setTimeout(() => {
      handleSave();
    }, 30000);

    return () => clearTimeout(timer);
  }, [hasChanges, isSaving, handleSave]);

  // Keyboard shortcut for save (Ctrl/Cmd + S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  // Warn before leaving with unsaved changes
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="brutal-border-3 border-t-0 border-l-0 border-r-0 bg-card p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/documentation")}
            className="p-2 brutal-border bg-card hover:bg-secondary transition-colors"
            aria-label="Back to documentation"
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
            <span className="text-xs font-mono text-muted-foreground hidden sm:inline">
              Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
          {hasChanges && !isSaving && (
            <span className="text-xs font-mono text-accent-foreground bg-accent px-2 py-1 brutal-border">
              ● Unsaved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 brutal-border bg-primary text-primary-foreground font-bold flex items-center gap-2 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all brutal-shadow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{isSaving ? "Saving..." : "Save"}</span>
          </button>
        </div>
      </header>

      {/* Unified Editor Canvas - Notion-style flow */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-[#f8f9fa] brutal-border-3 border-t-0 border-l-0 border-r-0 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase text-sm">Documentation Editor</span>
            <span className="text-xs font-mono text-foreground/70 hidden sm:inline">
              (Write text or draw diagrams)
            </span>
          </div>
          <div className="text-xs font-mono text-muted-foreground">
            Ctrl/Cmd + S to save
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Tiptap Rich Text Editor */}
            <div className="brutal-border bg-card rounded-sm overflow-hidden">
              <TiptapEditor
                initialContent={initialTextContent}
                onChange={handleTextChange}
              />
            </div>

            {/* Excalidraw Drawing Canvas */}
            <div className="brutal-border bg-card rounded-sm overflow-hidden">
              <div className="bg-[#ffd60a]/20 brutal-border-3 border-t-0 border-l-0 border-r-0 p-2 flex items-center gap-2">
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
      </div>
    </div>
  );
}