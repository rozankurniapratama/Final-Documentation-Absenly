"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2, Check } from "lucide-react";
import { saveDocumentationAction } from "../actions";
import NotionEditor from "./notion-editor";

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

  // Refs to track latest content without triggering re-renders
  const contentRef = useRef<object>(initialContent || {});

  const [content, setContent] = useState<object>(initialContent || {});
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);

  // Handle content change
  const handleContentChange = useCallback((newContent: object) => {
    setContent(newContent);
    contentRef.current = newContent;
    setHasChanges(true);
  }, []);

  // Save documentation - memoized with stable dependencies
  const handleSave = useCallback(async () => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      const result = await saveDocumentationAction(
        taskId,
        contentRef.current,
        null // No drawing content
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

  // Auto-save every 30 seconds if there are changes
  useEffect(() => {
    if (!hasChanges || isSaving) return;
    const timer = setTimeout(() => { handleSave(); }, 30000);
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
    <div className="min-h-screen bg-[#ffffff] flex flex-col">
      {/* Header - Minimal Notion-style */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm p-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/documentation")}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-gray-900"
            aria-label="Back to documentation"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex flex-col">
            <span className="text-xs text-gray-500 font-medium">{moduleName}</span>
            <h1 className="text-sm font-semibold text-gray-900">{taskName}</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Saved indicator */}
          <div className="flex items-center gap-2">
            {showSavedToast && (
              <span className="flex items-center gap-1 text-xs text-green-600 font-medium animate-fade-in">
                <Check className="w-3 h-3" />
                Saved
              </span>
            )}
            {lastSaved && !showSavedToast && (
              <span className="text-xs text-gray-400">
                {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          {/* Unsaved changes indicator */}
          {hasChanges && !isSaving && (
            <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Editing
            </span>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${isSaving || !hasChanges
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-black text-white hover:bg-gray-800 active:scale-[0.98]"
              }`}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{isSaving ? "Saving" : "Save"}</span>
          </button>
        </div>
      </header>

      {/* Notion-style Editor */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          {/* Page title area */}
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

          {/* Main Editor */}
          <NotionEditor
            initialContent={initialContent}
            onChange={handleContentChange}
            placeholder="Type '/' for commands, or start writing..."
          />
        </div>
      </div>

      {/* Bottom status bar */}
      <footer className="border-t border-gray-100 bg-white/80 backdrop-blur-sm px-4 py-2 text-xs text-gray-400 flex items-center justify-between">
        <span>{hasChanges ? '● Unsaved changes' : '✓ All changes saved'}</span>
        <span className="hidden sm:inline">Press <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono">S</kbd> to save</span>
      </footer>

      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        kbd {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }
      `}</style>
    </div>
  );
}