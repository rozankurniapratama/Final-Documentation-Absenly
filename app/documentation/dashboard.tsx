"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  toggleTaskAction,
  updateTaskAction,
  deleteTaskAction,
  updateModuleAction,
  deleteModuleAction,
  createModuleAction,
  createTaskAction,
  saveDocumentationAction,
  getDocumentationAction,
  logoutAction,
} from "./actions";

/* ───────────────────── Types ───────────────────── */

interface Task {
  id: string;
  name: string;
  task_order: number;
  is_completed: boolean;
  module_id: string;
  updated_at: string;
}

interface Module {
  id: string;
  name: string;
  display_order: number;
  tasks: Task[];
}

interface Stroke {
  color: string;
  width: number;
  points: { x: number; y: number }[];
}

interface DrawingData {
  strokes: Stroke[];
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

/* ───────────────────── Color Palette ───────────────────── */

const PRESET_COLORS = [
  "#2a231c",
  "#b54c47",
  "#b08542",
  "#4a7c59",
  "#3d6b99",
  "#7b5ea7",
  "#c4703a",
  "#5a5a5a",
];

const BRUSH_SIZES = [2, 4, 8, 14, 24];

/* ───────────────────── Main Component ───────────────────── */

export function DocumentationApp({
  initialModules,
}: {
  initialModules: Module[];
}) {
  const [modules, setModules] = useState<Module[]>(initialModules);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [expandedModuleIds, setExpandedModuleIds] = useState<Set<string>>(
    () => new Set(initialModules.map((m) => m.id))
  );

  /* ── Text state ── */
  const [textContent, setTextContent] = useState("");
  const textSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  /* ── Drawing state ── */
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [drawingHistory, setDrawingHistory] = useState<Stroke[][]>([]);
  const [activeTool, setActiveTool] = useState<"pen" | "eraser">("pen");
  const [penColor, setPenColor] = useState("#2a231c");
  const [brushSize, setBrushSize] = useState(4);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const drawSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  /* ── UI state ── */
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [moduleDraftName, setModuleDraftName] = useState("");
  const [taskDraftName, setTaskDraftName] = useState("");
  const [newModuleName, setNewModuleName] = useState("");
  const [newTaskNames, setNewTaskNames] = useState<Record<string, string>>({});
  const [showNewTaskInput, setShowNewTaskInput] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "module" | "task";
    id: string;
    name: string;
  } | null>(null);

  /* ── Derived ── */
  const selectedTask = useMemo(() => {
    for (const m of modules) {
      const t = m.tasks.find((t) => t.id === selectedTaskId);
      if (t) return t;
    }
    return null;
  }, [modules, selectedTaskId]);

  const selectedModuleName = useMemo(() => {
    if (!selectedTask) return "";
    const m = modules.find((m) => m.id === selectedTask.module_id);
    return m?.name || "";
  }, [modules, selectedTask]);

  /* ═══════════════════════ Canvas ═══════════════════════ */

  const getCanvasPoint = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0]?.clientY ?? e.changedTouches[0]?.clientY : e.clientY;
      return {
        x: ((clientX - rect.left) / rect.width) * canvas.width,
        y: ((clientY - rect.top) / rect.height) * canvas.height,
      };
    },
    []
  );

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const allStrokes = currentStroke ? [...strokes, currentStroke] : strokes;

    for (const stroke of allStrokes) {
      if (stroke.points.length < 2) continue;

      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const pts = stroke.points;
      ctx.moveTo(pts[0].x, pts[0].y);

      if (pts.length === 2) {
        ctx.lineTo(pts[1].x, pts[1].y);
      } else {
        for (let i = 1; i < pts.length - 1; i++) {
          const midX = (pts[i].x + pts[i + 1].x) / 2;
          const midY = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
        }
        const last = pts[pts.length - 1];
        ctx.lineTo(last.x, last.y);
      }

      ctx.stroke();
    }
  }, [strokes, currentStroke]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  /* Size canvas on mount */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      canvas.width = rect.width;
      canvas.height = 400;
      renderCanvas();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [renderCanvas]);

  /* ── Canvas pointer handlers ── */

  const handlePointerDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      isDrawingRef.current = true;
      const point = getCanvasPoint(e);
      setCurrentStroke({
        color: activeTool === "eraser" ? "#ffffff" : penColor,
        width: activeTool === "eraser" ? brushSize * 3 : brushSize,
        points: [point],
      });
    },
    [activeTool, penColor, brushSize, getCanvasPoint]
  );

  const handlePointerMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) return;
      e.preventDefault();
      const point = getCanvasPoint(e);
      setCurrentStroke((prev) =>
        prev ? { ...prev, points: [...prev.points, point] } : null
      );
    },
    [getCanvasPoint]
  );

  const handlePointerUp = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    setCurrentStroke((prev) => {
      if (prev && prev.points.length >= 2) {
        setStrokes((s) => [...s, prev]);
        setDrawingHistory((h) => [...h, strokes]);
      }
      return null;
    });
  }, [strokes]);

  /* ── Canvas actions ── */

  const undoCanvas = useCallback(() => {
    if (drawingHistory.length === 0) return;
    const prev = drawingHistory[drawingHistory.length - 1];
    setStrokes(prev);
    setDrawingHistory((h) => h.slice(0, -1));
  }, [drawingHistory]);

  const clearCanvas = useCallback(() => {
    setDrawingHistory((h) => [...h, strokes]);
    setStrokes([]);
  }, [strokes]);

  /* ═══════════════════════ Data Loading ═══════════════════════ */

  const loadDocumentation = useCallback(async (taskId: string) => {
    setSaveStatus("idle");
    const result = await getDocumentationAction(taskId);
    if (!result.error) {
      setTextContent((result.textContent as any)?.text || "");
      setStrokes((result.drawingContent as any)?.strokes || []);
      setDrawingHistory([]);
    }
  }, []);

  /* ═══════════════════════ Auto-Save ═══════════════════════ */

  const saveDocumentation = useCallback(
    async (taskId: string, text: string, currentStrokes: Stroke[]) => {
      setSaveStatus("saving");
      const result = await saveDocumentationAction(
        taskId,
        { text },
        { strokes: currentStrokes }
      );
      setSaveStatus(result.error ? "error" : "saved");
      setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 2000);
    },
    []
  );

  /* Text auto-save (debounced) */
  useEffect(() => {
    if (!selectedTaskId) return;
    if (textSaveTimerRef.current) clearTimeout(textSaveTimerRef.current);
    textSaveTimerRef.current = setTimeout(() => {
      saveDocumentation(selectedTaskId, textContent, strokes);
    }, 1200);
    return () => {
      if (textSaveTimerRef.current) clearTimeout(textSaveTimerRef.current);
    };
  }, [textContent, selectedTaskId, saveDocumentation]);

  /* Drawing auto-save on stroke completion */
  useEffect(() => {
    if (!selectedTaskId || strokes.length === 0) return;
    if (drawSaveTimerRef.current) clearTimeout(drawSaveTimerRef.current);
    drawSaveTimerRef.current = setTimeout(() => {
      saveDocumentation(selectedTaskId, textContent, strokes);
    }, 800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes]);

  /* ═══════════════════════ Keyboard Shortcuts ═══════════════════════ */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (selectedTaskId) {
          saveDocumentation(selectedTaskId, textContent, strokes);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedTaskId, textContent, strokes, saveDocumentation]);

  /* ═══════════════════════ Task Selection ═══════════════════════ */

  const selectTask = useCallback(
    (taskId: string) => {
      if (taskId === selectedTaskId) return;
      setSelectedTaskId(taskId);
      setTextContent("");
      setStrokes([]);
      setDrawingHistory([]);
      loadDocumentation(taskId);
    },
    [selectedTaskId, loadDocumentation]
  );

  /* ═══════════════════════ Module Handlers ═══════════════════════ */

  const toggleModule = (moduleId: string) => {
    setExpandedModuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const startEditModule = (m: Module) => {
    setEditingModuleId(m.id);
    setModuleDraftName(m.name);
  };

  const commitEditModule = async () => {
    if (!editingModuleId || !moduleDraftName.trim()) {
      setEditingModuleId(null);
      return;
    }
    const result = await updateModuleAction(editingModuleId, moduleDraftName.trim());
    if (!result.error) {
      setModules((prev) =>
        prev.map((m) =>
          m.id === editingModuleId ? { ...m, name: moduleDraftName.trim() } : m
        )
      );
    }
    setEditingModuleId(null);
  };

  const handleCreateModule = async () => {
    if (!newModuleName.trim()) return;
    const result = await createModuleAction(newModuleName.trim());
    if (result.data && !result.error) {
      setModules((prev) => [
        ...prev,
        {
          id: result.data!.id,
          name: newModuleName.trim(),
          display_order: prev.length + 1,
          tasks: [],
        },
      ]);
      setNewModuleName("");
      setExpandedModuleIds((prev) => new Set([...prev, result.data!.id]));
    }
  };

  const handleDeleteModule = async () => {
    if (!deleteConfirm || deleteConfirm.type !== "module") return;
    const result = await deleteModuleAction(deleteConfirm.id);
    if (!result.error) {
      setModules((prev) => prev.filter((m) => m.id !== deleteConfirm.id));
      if (
        selectedTask &&
        modules.find((m) => m.id === deleteConfirm.id)?.tasks.some((t) => t.id === selectedTask.id)
      ) {
        setSelectedTaskId(null);
      }
    }
    setDeleteConfirm(null);
  };

  /* ═══════════════════════ Task Handlers ═══════════════════════ */

  const handleToggleTask = async (taskId: string, completed: boolean) => {
    const result = await toggleTaskAction(taskId, completed);
    if (!result.error) {
      setModules((prev) =>
        prev.map((m) => ({
          ...m,
          tasks: m.tasks.map((t) =>
            t.id === taskId ? { ...t, is_completed: completed } : t
          ),
        }))
      );
    }
  };

  const startEditTask = (t: Task) => {
    setEditingTaskId(t.id);
    setTaskDraftName(t.name);
  };

  const commitEditTask = async () => {
    if (!editingTaskId || !taskDraftName.trim()) {
      setEditingTaskId(null);
      return;
    }
    const result = await updateTaskAction(editingTaskId, { name: taskDraftName.trim() });
    if (!result.error) {
      setModules((prev) =>
        prev.map((m) => ({
          ...m,
          tasks: m.tasks.map((t) =>
            t.id === editingTaskId ? { ...t, name: taskDraftName.trim() } : t
          ),
        }))
      );
    }
    setEditingTaskId(null);
  };

  const handleCreateTask = async (moduleId: string) => {
    const name = newTaskNames[moduleId]?.trim();
    if (!name) return;
    const moduleTasks = modules.find((m) => m.id === moduleId)?.tasks || [];
    const result = await createTaskAction(moduleId, {
      name,
      task_order: moduleTasks.length + 1,
    });
    if (result.data && !result.error) {
      const newTask: Task = {
        id: result.data.id,
        name,
        task_order: moduleTasks.length + 1,
        is_completed: false,
        module_id: moduleId,
        updated_at: new Date().toISOString(),
      };
      setModules((prev) =>
        prev.map((m) =>
          m.id === moduleId ? { ...m, tasks: [...m.tasks, newTask] } : m
        )
      );
      setNewTaskNames((prev) => ({ ...prev, [moduleId]: "" }));
      setShowNewTaskInput(null);
      setExpandedModuleIds((prev) => new Set([...prev, moduleId]));
    }
  };

  const handleDeleteTask = async () => {
    if (!deleteConfirm || deleteConfirm.type !== "task") return;
    const result = await deleteTaskAction(deleteConfirm.id);
    if (!result.error) {
      setModules((prev) =>
        prev.map((m) => ({
          ...m,
          tasks: m.tasks.filter((t) => t.id !== deleteConfirm.id),
        }))
      );
      if (selectedTaskId === deleteConfirm.id) setSelectedTaskId(null);
    }
    setDeleteConfirm(null);
  };

  /* ═══════════════════════ Render ═══════════════════════ */

  return (
    <div className="doc-layout">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="2" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
              <path d="M6 7h8M6 10h6M6 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span>Documentation</span>
          </div>
          <form
            action={async () => {
              await logoutAction();
              window.location.href = "/login";
            }}
          >
            <button type="submit" className="logout-btn" title="Sign out">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 14H3.33C2.6 14 2 13.4 2 12.67V3.33C2 2.6 2.6 2 3.33 2H6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                <path d="M10.67 11.33L14 8l-3.33-3.33M14 8H6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
        </div>

        <div className="sidebar-modules">
          {modules.map((mod) => (
            <div key={mod.id} className="module-group">
              <div
                className="module-header"
                onClick={() => toggleModule(mod.id)}
              >
                <svg
                  className={`module-chevron ${expandedModuleIds.has(mod.id) ? "expanded" : ""}`}
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                >
                  <path
                    d="M5 3l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>

                {editingModuleId === mod.id ? (
                  <input
                    autoFocus
                    className="inline-edit"
                    value={moduleDraftName}
                    onChange={(e) => setModuleDraftName(e.target.value)}
                    onBlur={commitEditModule}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEditModule();
                      if (e.key === "Escape") setEditingModuleId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="module-name">{mod.name}</span>
                )}

                <div className="module-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="icon-btn-sm"
                    onClick={() => startEditModule(mod)}
                    title="Rename"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M8.5 1.5l2 2L4 10H2v-2l6.5-6.5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    className="icon-btn-sm danger"
                    onClick={() =>
                      setDeleteConfirm({ type: "module", id: mod.id, name: mod.name })
                    }
                    title="Delete module"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 3h8M4.5 3V2a1 1 0 011-1h1a1 1 0 011 1v1M3 3l.5 7a1 1 0 001 1h3a1 1 0 001-1L9 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>

              {expandedModuleIds.has(mod.id) && (
                <div className="task-list">
                  {mod.tasks.map((task) => (
                    <div
                      key={task.id}
                      className={`task-item ${selectedTaskId === task.id ? "selected" : ""} ${task.is_completed ? "completed" : ""}`}
                      onClick={() => selectTask(task.id)}
                    >
                      <button
                        className="task-checkbox"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleTask(task.id, !task.is_completed);
                        }}
                      >
                        {task.is_completed ? (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <rect x="1" y="1" width="12" height="12" rx="3" fill="var(--success)" />
                            <path d="M4 7l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <rect x="1" y="1" width="12" height="12" rx="3" stroke="currentColor" strokeWidth="1.2" />
                          </svg>
                        )}
                      </button>

                      {editingTaskId === task.id ? (
                        <input
                          autoFocus
                          className="inline-edit small"
                          value={taskDraftName}
                          onChange={(e) => setTaskDraftName(e.target.value)}
                          onBlur={commitEditTask}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEditTask();
                            if (e.key === "Escape") setEditingTaskId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="task-name">{task.name}</span>
                      )}

                      <div className="task-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="icon-btn-xs"
                          onClick={() => startEditTask(task)}
                          title="Rename"
                        >
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                            <path d="M8.5 1.5l2 2L4 10H2v-2l6.5-6.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <button
                          className="icon-btn-xs danger"
                          onClick={() =>
                            setDeleteConfirm({ type: "task", id: task.id, name: task.name })
                          }
                          title="Delete task"
                        >
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                            <path d="M2 3h8M4.5 3V2a1 1 0 011-1h1a1 1 0 011 1v1M3 3l.5 7a1 1 0 001 1h3a1 1 0 001-1L9 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}

                  {showNewTaskInput === mod.id ? (
                    <div className="new-task-row">
                      <input
                        autoFocus
                        className="new-task-input"
                        placeholder="Task name..."
                        value={newTaskNames[mod.id] || ""}
                        onChange={(e) =>
                          setNewTaskNames((prev) => ({ ...prev, [mod.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleCreateTask(mod.id);
                          if (e.key === "Escape") setShowNewTaskInput(null);
                        }}
                        onBlur={() => {
                          if (!newTaskNames[mod.id]?.trim()) setShowNewTaskInput(null);
                        }}
                      />
                    </div>
                  ) : (
                    <button
                      className="add-task-btn"
                      onClick={() => {
                        setShowNewTaskInput(mod.id);
                        setExpandedModuleIds((prev) => new Set([...prev, mod.id]));
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                      </svg>
                      Add task
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="new-module-row">
            <input
              className="new-module-input"
              placeholder="New module..."
              value={newModuleName}
              onChange={(e) => setNewModuleName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateModule();
              }}
            />
            <button
              className="add-module-btn"
              onClick={handleCreateModule}
              disabled={!newModuleName.trim()}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="main-content">
        {!selectedTask ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <rect x="8" y="6" width="32" height="36" rx="4" stroke="currentColor" strokeWidth="2" />
                <path d="M16 16h16M16 22h12M16 28h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <h2>Select a task to begin</h2>
            <p>Choose a task from the sidebar to view or edit its documentation.</p>
          </div>
        ) : (
          <div className="editor-area">
            {/* ── Editor Header ── */}
            <div className="editor-header">
              <div className="editor-breadcrumb">
                <span className="breadcrumb-module">{selectedModuleName}</span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="breadcrumb-task">{selectedTask.name}</span>
              </div>

              <div className="editor-meta">
                <button
                  className={`toggle-btn ${selectedTask.is_completed ? "active" : ""}`}
                  onClick={() =>
                    handleToggleTask(selectedTask.id, !selectedTask.is_completed)
                  }
                >
                  {selectedTask.is_completed ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <rect x="1" y="1" width="12" height="12" rx="3" fill="var(--success)" />
                      <path d="M4 7l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <rect x="1" y="1" width="12" height="12" rx="3" stroke="currentColor" strokeWidth="1.2" />
                    </svg>
                  )}
                  {selectedTask.is_completed ? "Completed" : "Mark complete"}
                </button>

                <div className={`save-indicator ${saveStatus}`}>
                  {saveStatus === "saving" && (
                    <>
                      <span className="save-dot" /> Saving...
                    </>
                  )}
                  {saveStatus === "saved" && (
                    <>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M3 7.5l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Saved
                    </>
                  )}
                  {saveStatus === "error" && "Save failed"}
                </div>
              </div>
            </div>

            {/* ── Text Editor ── */}
            <section className="editor-section">
              <div className="section-label">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 3h10M2 7h7M2 11h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                Notes
              </div>
              <textarea
                className="text-editor"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Start writing your documentation..."
              />
            </section>

            {/* ── Drawing Canvas ── */}
            <section className="editor-section">
              <div className="section-label">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 12l1.5-4L11 1.5a1 1 0 011.4 0l.1.1a1 1 0 010 1.4L7.5 8.5 2 12z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Diagram
              </div>

              <div className="canvas-toolbar">
                <div className="tool-group">
                  <button
                    className={`tool-btn ${activeTool === "pen" ? "active" : ""}`}
                    onClick={() => setActiveTool("pen")}
                    title="Pen"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M11 2l3 3L5 14H2v-3L11 2z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    className={`tool-btn ${activeTool === "eraser" ? "active" : ""}`}
                    onClick={() => setActiveTool("eraser")}
                    title="Eraser"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M6 14h7M2.5 10.5l5-5 3.5 3.5-5 5L2.5 10.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M2.5 10.5l3-8 4.5 2-3 8-4.5-2z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>

                <div className="divider-v" />

                <div className="tool-group colors">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      className={`color-dot ${penColor === c ? "active" : ""}`}
                      style={{ backgroundColor: c }}
                      onClick={() => {
                        setPenColor(c);
                        setActiveTool("pen");
                      }}
                    />
                  ))}
                </div>

                <div className="divider-v" />

                <div className="tool-group sizes">
                  {BRUSH_SIZES.map((s) => (
                    <button
                      key={s}
                      className={`size-btn ${brushSize === s ? "active" : ""}`}
                      onClick={() => setBrushSize(s)}
                    >
                      <span
                        className="size-dot"
                        style={{ width: Math.max(s, 3), height: Math.max(s, 3) }}
                      />
                    </button>
                  ))}
                </div>

                <div className="tool-spacer" />

                <div className="tool-group">
                  <button className="tool-btn" onClick={undoCanvas} title="Undo">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M3 6h6a3 3 0 010 6H8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M6 3L3 6l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button className="tool-btn danger" onClick={clearCanvas} title="Clear canvas">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="canvas-wrapper">
                <canvas
                  ref={canvasRef}
                  className="drawing-canvas"
                  onMouseDown={handlePointerDown}
                  onMouseMove={handlePointerMove}
                  onMouseUp={handlePointerUp}
                  onMouseLeave={handlePointerUp}
                  onTouchStart={handlePointerDown}
                  onTouchMove={handlePointerMove}
                  onTouchEnd={handlePointerUp}
                />
              </div>
            </section>
          </div>
        )}
      </main>

      {/* ── Delete Confirmation Modal ── */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete {deleteConfirm.type}?</h3>
            <p>
              This will permanently delete{" "}
              <strong>&ldquo;{deleteConfirm.name}&rdquo;</strong>
              {deleteConfirm.type === "module" && " and all its tasks and documentation"}.
              This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </button>
              <button
                className="btn-danger"
                onClick={
                  deleteConfirm.type === "module" ? handleDeleteModule : handleDeleteTask
                }
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        /* ══════════════════════════════════════════════════
           DESIGN TOKENS
           ══════════════════════════════════════════════════ */
        :global(*) {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        :global(body) {
          font-family: "Source Serif 4", "Georgia", serif;
          background: var(--bg);
          color: var(--text-primary);
          -webkit-font-smoothing: antialiased;
        }

        :global(:root) {
          --bg: #f5f0e8;
          --sidebar-bg: #1e1a16;
          --sidebar-hover: #2a2520;
          --sidebar-text: #a89e92;
          --sidebar-text-active: #f5f0e8;
          --surface: #ffffff;
          --surface-hover: #faf8f3;
          --accent: #b08542;
          --accent-hover: #96722f;
          --accent-bg: rgba(176, 133, 66, 0.08);
          --text-primary: #2a231c;
          --text-secondary: #6b5f52;
          --text-muted: #9c9084;
          --border: #e5ddd3;
          --border-light: #ede7dd;
          --success: #4a7c59;
          --success-bg: rgba(74, 124, 89, 0.08);
          --danger: #b54c47;
          --danger-bg: rgba(181, 76, 71, 0.06);
          --shadow-sm: 0 1px 2px rgba(42, 35, 28, 0.06);
          --shadow-md: 0 4px 12px rgba(42, 35, 28, 0.08);
          --radius-sm: 6px;
          --radius-md: 8px;
          --radius-lg: 12px;
        }

        /* ══════════════════════════════════════════════════
           LAYOUT
           ══════════════════════════════════════════════════ */
        .doc-layout {
          display: grid;
          grid-template-columns: 272px 1fr;
          height: 100vh;
          overflow: hidden;
        }

        /* ══════════════════════════════════════════════════
           SIDEBAR
           ══════════════════════════════════════════════════ */
        .sidebar {
          background: var(--sidebar-bg);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 16px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--sidebar-text-active);
          font-family: "Playfair Display", serif;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: -0.01em;
        }

        .sidebar-brand svg {
          opacity: 0.6;
        }

        .logout-btn {
          background: none;
          border: none;
          color: var(--sidebar-text);
          cursor: pointer;
          padding: 4px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          transition: all 0.15s ease;
        }
        .logout-btn:hover {
          color: var(--sidebar-text-active);
          background: rgba(255, 255, 255, 0.06);
        }

        .sidebar-modules {
          flex: 1;
          overflow-y: auto;
          padding: 8px 0;
        }

        .sidebar-modules::-webkit-scrollbar {
          width: 4px;
        }
        .sidebar-modules::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
        }

        /* Module group */
        .module-group {
          margin-bottom: 2px;
        }

        .module-header {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 8px 12px;
          color: var(--sidebar-text);
          cursor: pointer;
          user-select: none;
          transition: all 0.12s ease;
          min-height: 36px;
        }
        .module-header:hover {
          background: var(--sidebar-hover);
          color: var(--sidebar-text-active);
        }

        .module-chevron {
          flex-shrink: 0;
          transition: transform 0.2s ease;
          opacity: 0.4;
        }
        .module-chevron.expanded {
          transform: rotate(90deg);
        }

        .module-name {
          flex: 1;
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .module-actions {
          display: none;
          align-items: center;
          gap: 2px;
        }
        .module-header:hover .module-actions {
          display: flex;
        }
        .module-header:hover .module-chevron {
          opacity: 0;
        }

        /* Task list */
        .task-list {
          padding: 0 0 4px 0;
          animation: slideDown 0.15s ease;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .task-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px 6px 30px;
          color: var(--sidebar-text);
          cursor: pointer;
          transition: all 0.12s ease;
          font-size: 13px;
        }
        .task-item:hover {
          background: var(--sidebar-hover);
          color: var(--sidebar-text-active);
        }
        .task-item.selected {
          background: rgba(176, 133, 66, 0.12);
          color: var(--sidebar-text-active);
        }
        .task-item.completed .task-name {
          text-decoration: line-through;
          opacity: 0.5;
        }

        .task-checkbox {
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          padding: 0;
          display: flex;
          flex-shrink: 0;
          line-height: 0;
        }

        .task-name {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .task-actions {
          display: none;
          align-items: center;
          gap: 2px;
        }
        .task-item:hover .task-actions {
          display: flex;
        }

        .icon-btn-sm,
        .icon-btn-xs {
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          padding: 3px;
          border-radius: 3px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.12s ease;
        }
        .icon-btn-sm:hover,
        .icon-btn-xs:hover {
          background: rgba(255, 255, 255, 0.08);
        }
        .icon-btn-sm.danger:hover,
        .icon-btn-xs.danger:hover {
          color: #e8746e;
          background: rgba(232, 116, 110, 0.1);
        }

        /* Add task button */
        .add-task-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px 5px 34px;
          background: none;
          border: none;
          color: var(--sidebar-text);
          font-size: 12px;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.12s ease;
          font-family: inherit;
        }
        .task-list:hover .add-task-btn,
        .add-task-btn:focus {
          opacity: 1;
        }
        .add-task-btn:hover {
          color: var(--accent);
        }

        .new-task-row {
          padding: 4px 12px 4px 30px;
        }

        .new-task-input {
          width: 100%;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          color: var(--sidebar-text-active);
          font-size: 12px;
          padding: 5px 8px;
          font-family: inherit;
          outline: none;
          transition: border-color 0.15s ease;
        }
        .new-task-input:focus {
          border-color: var(--accent);
        }
        .new-task-input::placeholder {
          color: rgba(255, 255, 255, 0.25);
        }

        /* Sidebar footer */
        .sidebar-footer {
          padding: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .new-module-row {
          display: flex;
          gap: 6px;
        }

        .new-module-input {
          flex: 1;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          color: var(--sidebar-text-active);
          font-size: 13px;
          padding: 6px 10px;
          font-family: inherit;
          outline: none;
          transition: border-color 0.15s ease;
        }
        .new-module-input:focus {
          border-color: var(--accent);
        }
        .new-module-input::placeholder {
          color: rgba(255, 255, 255, 0.25);
        }

        .add-module-btn {
          background: var(--accent);
          border: none;
          color: white;
          cursor: pointer;
          padding: 6px 8px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }
        .add-module-btn:hover:not(:disabled) {
          background: var(--accent-hover);
        }
        .add-module-btn:disabled {
          opacity: 0.3;
          cursor: default;
        }

        /* Inline edit */
        .inline-edit {
          flex: 1;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid var(--accent);
          border-radius: 3px;
          color: var(--sidebar-text-active);
          font-size: 13px;
          padding: 2px 6px;
          font-family: inherit;
          font-weight: 500;
          outline: none;
          min-width: 0;
        }
        .inline-edit.small {
          font-size: 12px;
          padding: 1px 4px;
        }

        /* ══════════════════════════════════════════════════
           MAIN CONTENT
           ══════════════════════════════════════════════════ */
        .main-content {
          overflow-y: auto;
          background: var(--bg);
        }

        /* Empty state */
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-muted);
          gap: 12px;
          animation: fadeIn 0.4s ease;
        }
        .empty-icon {
          opacity: 0.25;
          margin-bottom: 4px;
        }
        .empty-state h2 {
          font-family: "Playfair Display", serif;
          font-size: 20px;
          font-weight: 600;
          color: var(--text-secondary);
        }
        .empty-state p {
          font-size: 14px;
          max-width: 320px;
          text-align: center;
          line-height: 1.5;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* Editor area */
        .editor-area {
          max-width: 860px;
          margin: 0 auto;
          padding: 32px 40px 80px;
          animation: fadeIn 0.3s ease;
        }

        .editor-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 32px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border);
        }

        .editor-breadcrumb {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: var(--text-muted);
        }
        .breadcrumb-module {
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-size: 11px;
        }
        .breadcrumb-task {
          color: var(--text-primary);
          font-weight: 600;
        }

        .editor-meta {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .toggle-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 5px 12px;
          font-size: 12px;
          font-family: inherit;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .toggle-btn:hover {
          border-color: var(--text-muted);
        }
        .toggle-btn.active {
          background: var(--success-bg);
          border-color: var(--success);
          color: var(--success);
        }

        .save-indicator {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          color: var(--text-muted);
          min-width: 70px;
          transition: all 0.2s ease;
        }
        .save-indicator.saving {
          color: var(--accent);
        }
        .save-indicator.saved {
          color: var(--success);
        }
        .save-indicator.error {
          color: var(--danger);
        }

        .save-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent);
          animation: pulse 1s ease infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        /* Sections */
        .editor-section {
          margin-bottom: 28px;
        }

        .section-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
          margin-bottom: 10px;
        }

        /* Text editor */
        .text-editor {
          width: 100%;
          min-height: 260px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 20px 24px;
          font-family: "Source Serif 4", Georgia, serif;
          font-size: 15px;
          line-height: 1.7;
          color: var(--text-primary);
          resize: vertical;
          outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .text-editor:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-bg);
        }
        .text-editor::placeholder {
          color: var(--text-muted);
        }

        /* Canvas toolbar */
        .canvas-toolbar {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-bottom: none;
          border-radius: var(--radius-lg) var(--radius-lg) 0 0;
          flex-wrap: wrap;
        }

        .tool-group {
          display: flex;
          align-items: center;
          gap: 3px;
        }

        .tool-group.colors {
          gap: 4px;
        }

        .tool-group.sizes {
          gap: 2px;
        }

        .divider-v {
          width: 1px;
          height: 20px;
          background: var(--border);
          margin: 0 4px;
        }

        .tool-spacer {
          flex: 1;
        }

        .tool-btn {
          background: none;
          border: 1px solid transparent;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 5px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.12s ease;
        }
        .tool-btn:hover {
          background: var(--surface-hover);
          color: var(--text-primary);
        }
        .tool-btn.active {
          background: var(--accent-bg);
          color: var(--accent);
          border-color: var(--accent);
        }
        .tool-btn.danger:hover {
          color: var(--danger);
          background: var(--danger-bg);
        }

        .color-dot {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 2px solid transparent;
          cursor: pointer;
          transition: all 0.12s ease;
          padding: 0;
        }
        .color-dot:hover {
          transform: scale(1.2);
        }
        .color-dot.active {
          border-color: var(--text-primary);
          box-shadow: 0 0 0 2px var(--surface), 0 0 0 3px var(--text-muted);
        }

        .size-btn {
          background: none;
          border: 1px solid transparent;
          cursor: pointer;
          padding: 5px 6px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.12s ease;
        }
        .size-btn:hover {
          background: var(--surface-hover);
        }
        .size-btn.active {
          background: var(--accent-bg);
          border-color: var(--accent);
        }

        .size-dot {
          display: block;
          border-radius: 50%;
          background: var(--text-primary);
        }

        /* Canvas */
        .canvas-wrapper {
          background: #ffffff;
          border: 1px solid var(--border);
          border-top: 1px solid var(--border-light);
          border-radius: 0 0 var(--radius-lg) var(--radius-lg);
          overflow: hidden;
          cursor: crosshair;
        }

        .drawing-canvas {
          display: block;
          width: 100%;
          height: 400px;
          touch-action: none;
        }

        /* ══════════════════════════════════════════════════
           MODAL
           ══════════════════════════════════════════════════ */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(30, 26, 22, 0.4);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          animation: fadeIn 0.15s ease;
        }

        .modal {
          background: var(--surface);
          border-radius: var(--radius-lg);
          padding: 28px 32px;
          max-width: 420px;
          width: 90%;
          box-shadow: 0 20px 60px rgba(42, 35, 28, 0.2);
          animation: modalIn 0.2s ease;
        }

        @keyframes modalIn {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .modal h3 {
          font-family: "Playfair Display", serif;
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 10px;
          color: var(--text-primary);
        }

        .modal p {
          font-size: 14px;
          line-height: 1.6;
          color: var(--text-secondary);
          margin-bottom: 24px;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        .btn-ghost {
          background: none;
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 8px 16px;
          font-size: 13px;
          font-family: inherit;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .btn-ghost:hover {
          background: var(--surface-hover);
          border-color: var(--text-muted);
        }

        .btn-danger {
          background: var(--danger);
          border: 1px solid var(--danger);
          border-radius: var(--radius-sm);
          padding: 8px 16px;
          font-size: 13px;
          font-family: inherit;
          color: white;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .btn-danger:hover {
          background: #943c38;
        }

        /* ══════════════════════════════════════════════════
           RESPONSIVE
           ══════════════════════════════════════════════════ */
        @media (max-width: 768px) {
          .doc-layout {
            grid-template-columns: 1fr;
          }
          .sidebar {
            display: none;
          }
          .editor-area {
            padding: 20px 16px 60px;
          }
        }
      `}</style>
    </div>
  );
}
