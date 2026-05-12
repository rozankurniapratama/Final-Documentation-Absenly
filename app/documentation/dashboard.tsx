"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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

/* ───── Types ───── */

interface Task {
  id: string;
  name: string;
  task_order: number;
  is_completed: boolean;
  module_id: string;
}

interface Module {
  id: string;
  name: string;
  display_order: number;
  tasks: Task[];
}

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  color: string;
  width: number;
  points: Point[];
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

const COLORS = [
  "#2a231c",
  "#b54c47",
  "#b08542",
  "#4a7c59",
  "#3d6b99",
  "#7b5ea7",
  "#c4703a",
  "#5a5a5a",
];

const SIZES = [2, 4, 8, 14, 24];

/* ───── Dashboard ───── */

export default function DocumentationDashboard({
  initialModules,
}: {
  initialModules: Module[];
}) {
  const [modules, setModules] = useState<Module[]>(initialModules);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(initialModules.map((m) => m.id))
  );

  /* text */
  const [textContent, setTextContent] = useState("");
  const textTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* canvas */
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [history, setHistory] = useState<Stroke[][]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [penColor, setPenColor] = useState("#2a231c");
  const [brushSize, setBrushSize] = useState(4);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const drawTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ui */
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [editModuleId, setEditModuleId] = useState<string | null>(null);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [modDraft, setModDraft] = useState("");
  const [taskDraft, setTaskDraft] = useState("");
  const [newModName, setNewModName] = useState("");
  const [newTaskName, setNewTaskName] = useState("");
  const [showNewTask, setShowNewTask] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    type: "module" | "task";
    id: string;
    name: string;
  } | null>(null);

  /* derived */
  const selectedTask = modules
    .flatMap((m) => m.tasks)
    .find((t) => t.id === selectedTaskId);

  const selectedModuleName = selectedTask
    ? modules.find((m) => m.id === selectedTask.module_id)?.name ?? ""
    : "";

  /* ═══════ Canvas helpers ═══════ */

  const canvasPoint = useCallback(
    (e: React.MouseEvent | React.TouchEvent): Point | null => {
      const c = canvasRef.current;
      if (!c) return null;
      const r = c.getBoundingClientRect();
      const cx =
        "touches" in e
          ? (e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX)
          : e.clientX;
      const cy =
        "touches" in e
          ? (e.touches[0]?.clientY ?? e.changedTouches[0]?.clientY)
          : e.clientY;
      return {
        x: ((cx - r.left) / r.width) * c.width,
        y: ((cy - r.top) / r.height) * c.height,
      };
    },
    []
  );

  const renderCanvas = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);

    const all = currentStroke ? [...strokes, currentStroke] : strokes;
    for (const s of all) {
      if (s.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const pts = s.points;
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2;
        const my = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.stroke();
    }
  }, [strokes, currentStroke]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const resize = () => {
      const p = c.parentElement?.getBoundingClientRect();
      if (!p) return;
      c.width = p.width;
      c.height = 360;
      renderCanvas();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [renderCanvas]);

  /* ═══════ Canvas pointer events ═══════ */

  const onPointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const pt = canvasPoint(e);
      if (!pt) return;
      drawing.current = true;
      setCurrentStroke({
        color: tool === "eraser" ? "#ffffff" : penColor,
        width: tool === "eraser" ? brushSize * 3 : brushSize,
        points: [pt],
      });
    },
    [tool, penColor, brushSize, canvasPoint]
  );

  const onPointerMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!drawing.current) return;
      e.preventDefault();
      const pt = canvasPoint(e);
      if (!pt) return;
      setCurrentStroke((prev) =>
        prev ? { ...prev, points: [...prev.points, pt] } : null
      );
    },
    [canvasPoint]
  );

  const onPointerUp = useCallback(() => {
    if (!drawing.current) return;
    drawing.current = false;
    setCurrentStroke((prev) => {
      if (prev && prev.points.length >= 2) {
        setStrokes((s) => {
          setHistory((h) => [...h, s]);
          return [...s, prev];
        });
      }
      return null;
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      setStrokes(h[h.length - 1]);
      return h.slice(0, -1);
    });
  }, []);

  const clearAll = useCallback(() => {
    setHistory((h) => [...h, strokes]);
    setStrokes([]);
  }, [strokes]);

  /* ═══════ Load documentation ═══════ */

  const loadDoc = useCallback(async (taskId: string) => {
    setSaveStatus("idle");
    const res = await getDocumentationAction(taskId);
    if (!res.error) {
      setTextContent((res.textContent as any)?.text ?? "");
      setStrokes((res.drawingContent as any)?.strokes ?? []);
      setHistory([]);
    }
  }, []);

  /* ═══════ Auto-save ═══════ */

  const doSave = useCallback(
    async (taskId: string, text: string, s: Stroke[]) => {
      setSaveStatus("saving");
      const res = await saveDocumentationAction(
        taskId,
        { text },
        { strokes: s }
      );
      setSaveStatus(res.error ? "error" : "saved");
      setTimeout(
        () => setSaveStatus((v) => (v === "saved" ? "idle" : v)),
        2000
      );
    },
    []
  );

  useEffect(() => {
    if (!selectedTaskId) return;
    if (textTimerRef.current) clearTimeout(textTimerRef.current);
    textTimerRef.current = setTimeout(
      () => doSave(selectedTaskId, textContent, strokes),
      1200
    );
    return () => {
      if (textTimerRef.current) clearTimeout(textTimerRef.current);
    };
  }, [textContent, selectedTaskId, strokes, doSave]);

  useEffect(() => {
    if (!selectedTaskId || strokes.length === 0) return;
    if (drawTimerRef.current) clearTimeout(drawTimerRef.current);
    drawTimerRef.current = setTimeout(
      () => doSave(selectedTaskId, textContent, strokes),
      800
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes]);

  /* ═══════ Keyboard shortcut ═══════ */

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (selectedTaskId) doSave(selectedTaskId, textContent, strokes);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [selectedTaskId, textContent, strokes, doSave]);

  /* ═══════ Task selection ═══════ */

  const selectTask = useCallback(
    (id: string) => {
      if (id === selectedTaskId) return;
      setSelectedTaskId(id);
      setTextContent("");
      setStrokes([]);
      setHistory([]);
      loadDoc(id);
    },
    [selectedTaskId, loadDoc]
  );

  /* ═══════ Module CRUD ═══════ */

  const toggleMod = (id: string) => {
    setExpandedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const commitModEdit = async () => {
    if (!editModuleId || !modDraft.trim()) {
      setEditModuleId(null);
      return;
    }
    const res = await updateModuleAction(editModuleId, modDraft.trim());
    if (!res.error) {
      setModules((ms) =>
        ms.map((m) =>
          m.id === editModuleId ? { ...m, name: modDraft.trim() } : m
        )
      );
    }
    setEditModuleId(null);
  };

  const createMod = async () => {
    if (!newModName.trim()) return;
    const res = await createModuleAction(newModName.trim());
    if (res.data && !res.error) {
      setModules((ms) => [
        ...ms,
        {
          id: res.data!.id,
          name: newModName.trim(),
          display_order: ms.length + 1,
          tasks: [],
        },
      ]);
      setNewModName("");
      setExpandedIds((prev) => new Set([...prev, res.data!.id]));
    }
  };

  const deleteMod = async () => {
    if (!confirm || confirm.type !== "module") return;
    const res = await deleteModuleAction(confirm.id);
    if (!res.error) {
      setModules((ms) => ms.filter((m) => m.id !== confirm.id));
      const mod = modules.find((m) => m.id === confirm.id);
      if (mod?.tasks.some((t) => t.id === selectedTaskId))
        setSelectedTaskId(null);
    }
    setConfirm(null);
  };

  /* ═══════ Task CRUD ═══════ */

  const toggleTask = async (id: string, done: boolean) => {
    const res = await toggleTaskAction(id, done);
    if (!res.error) {
      setModules((ms) =>
        ms.map((m) => ({
          ...m,
          tasks: m.tasks.map((t) =>
            t.id === id ? { ...t, is_completed: done } : t
          ),
        }))
      );
    }
  };

  const commitTaskEdit = async () => {
    if (!editTaskId || !taskDraft.trim()) {
      setEditTaskId(null);
      return;
    }
    const res = await updateTaskAction(editTaskId, { name: taskDraft.trim() });
    if (!res.error) {
      setModules((ms) =>
        ms.map((m) => ({
          ...m,
          tasks: m.tasks.map((t) =>
            t.id === editTaskId ? { ...t, name: taskDraft.trim() } : t
          ),
        }))
      );
    }
    setEditTaskId(null);
  };

  const createTask = async (moduleId: string) => {
    const name = newTaskName.trim();
    if (!name) return;
    const mod = modules.find((m) => m.id === moduleId);
    const order = (mod?.tasks.length ?? 0) + 1;
    const res = await createTaskAction(moduleId, { name, task_order: order });
    if (res.data && !res.error) {
      setModules((ms) =>
        ms.map((m) =>
          m.id === moduleId
            ? {
                ...m,
                tasks: [
                  ...m.tasks,
                  {
                    id: res.data!.id,
                    name,
                    task_order: order,
                    is_completed: false,
                    module_id: moduleId,
                  },
                ],
              }
            : m
        )
      );
      setNewTaskName("");
      setShowNewTask(null);
      setExpandedIds((prev) => new Set([...prev, moduleId]));
    }
  };

  const deleteTask = async () => {
    if (!confirm || confirm.type !== "task") return;
    const res = await deleteTaskAction(confirm.id);
    if (!res.error) {
      setModules((ms) =>
        ms.map((m) => ({
          ...m,
          tasks: m.tasks.filter((t) => t.id !== confirm.id),
        }))
      );
      if (selectedTaskId === confirm.id) setSelectedTaskId(null);
    }
    setConfirm(null);
  };

  /* ═══════════════════════════════════════
     RENDER
     ═══════════════════════════════════════ */

  return (
    <div className="doc-layout">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-head">
          <div className="brand">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <rect
                x="2"
                y="2"
                width="16"
                height="16"
                rx="3"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M6 7h8M6 10h6M6 13h4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span>Docs</span>
          </div>
          <form
            action={async () => {
              await logoutAction();
              window.location.href = "/login";
            }}
          >
            <button
              type="submit"
              className="icon-btn head-btn"
              title="Sign out"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path
                  d="M6 14H3.33C2.6 14 2 13.4 2 12.67V3.33C2 2.6 2.6 2 3.33 2H6"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
                <path
                  d="M10.67 11.33L14 8l-3.33-3.33M14 8H6"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </form>
        </div>

        <nav className="sidebar-nav">
          {modules.map((mod) => (
            <div key={mod.id} className="mod-group">
              <div className="mod-head" onClick={() => toggleMod(mod.id)}>
                <svg
                  className={`chev ${expandedIds.has(mod.id) ? "on" : ""}`}
                  width="13"
                  height="13"
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

                {editModuleId === mod.id ? (
                  <input
                    autoFocus
                    className="inline-input"
                    value={modDraft}
                    onChange={(e) => setModDraft(e.target.value)}
                    onBlur={commitModEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitModEdit();
                      if (e.key === "Escape") setEditModuleId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="mod-name">{mod.name}</span>
                )}

                <div
                  className="mod-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="icon-btn xs"
                    onClick={() => {
                      setEditModuleId(mod.id);
                      setModDraft(mod.name);
                    }}
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 12 12"
                      fill="none"
                    >
                      <path
                        d="M8.5 1.5l2 2L4 10H2v-2l6.5-6.5z"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <button
                    className="icon-btn xs danger"
                    onClick={() =>
                      setConfirm({
                        type: "module",
                        id: mod.id,
                        name: mod.name,
                      })
                    }
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 12 12"
                      fill="none"
                    >
                      <path
                        d="M2 3h8M4.5 3V2a1 1 0 011-1h1a1 1 0 011 1v1M3 3l.5 7a1 1 0 001 1h3a1 1 0 001-1L9 3"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {expandedIds.has(mod.id) && (
                <div className="task-list">
                  {mod.tasks.map((task) => (
                    <div
                      key={task.id}
                      className={`task-row ${selectedTaskId === task.id ? "sel" : ""} ${task.is_completed ? "done" : ""}`}
                      onClick={() => selectTask(task.id)}
                    >
                      <button
                        className="task-check"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTask(task.id, !task.is_completed);
                        }}
                      >
                        {task.is_completed ? (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 14 14"
                            fill="none"
                          >
                            <rect
                              x="1"
                              y="1"
                              width="12"
                              height="12"
                              rx="3"
                              fill="var(--ok)"
                            />
                            <path
                              d="M4 7l2 2 4-4"
                              stroke="#fff"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 14 14"
                            fill="none"
                          >
                            <rect
                              x="1"
                              y="1"
                              width="12"
                              height="12"
                              rx="3"
                              stroke="currentColor"
                              strokeWidth="1.1"
                            />
                          </svg>
                        )}
                      </button>

                      {editTaskId === task.id ? (
                        <input
                          autoFocus
                          className="inline-input sm"
                          value={taskDraft}
                          onChange={(e) => setTaskDraft(e.target.value)}
                          onBlur={commitTaskEdit}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitTaskEdit();
                            if (e.key === "Escape") setEditTaskId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="task-name">{task.name}</span>
                      )}

                      <div
                        className="task-actions"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          className="icon-btn xs"
                          onClick={() => {
                            setEditTaskId(task.id);
                            setTaskDraft(task.name);
                          }}
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 12 12"
                            fill="none"
                          >
                            <path
                              d="M8.5 1.5l2 2L4 10H2v-2l6.5-6.5z"
                              stroke="currentColor"
                              strokeWidth="1.3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                        <button
                          className="icon-btn xs danger"
                          onClick={() =>
                            setConfirm({
                              type: "task",
                              id: task.id,
                              name: task.name,
                            })
                          }
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 12 12"
                            fill="none"
                          >
                            <path
                              d="M2 3h8M4.5 3V2a1 1 0 011-1h1a1 1 0 011 1v1M3 3l.5 7a1 1 0 001 1h3a1 1 0 001-1L9 3"
                              stroke="currentColor"
                              strokeWidth="1.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}

                  {showNewTask === mod.id ? (
                    <div className="new-task-row">
                      <input
                        autoFocus
                        className="sidebar-input"
                        placeholder="Task name..."
                        value={newTaskName}
                        onChange={(e) => setNewTaskName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") createTask(mod.id);
                          if (e.key === "Escape") setShowNewTask(null);
                        }}
                        onBlur={() => {
                          if (!newTaskName.trim()) setShowNewTask(null);
                        }}
                      />
                    </div>
                  ) : (
                    <button
                      className="add-task-btn"
                      onClick={() => {
                        setShowNewTask(mod.id);
                        setExpandedIds((p) => new Set([...p, mod.id]));
                      }}
                    >
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <path
                          d="M6 2v8M2 6h8"
                          stroke="currentColor"
                          strokeWidth="1.3"
                          strokeLinecap="round"
                        />
                      </svg>
                      Add task
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <input
            className="sidebar-input"
            placeholder="New module..."
            value={newModName}
            onChange={(e) => setNewModName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") createMod();
            }}
          />
          <button
            className="add-mod-btn"
            onClick={createMod}
            disabled={!newModName.trim()}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M7 3v8M3 7h8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </aside>

      {/* ── Editor ── */}
      <main className="editor">
        {!selectedTask ? (
          <div className="empty">
            <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
              <rect
                x="8"
                y="6"
                width="32"
                height="36"
                rx="4"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M16 16h16M16 22h12M16 28h8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <h2>Select a task</h2>
            <p>Pick a task from the sidebar to view or edit its documentation.</p>
          </div>
        ) : (
          <div className="editor-inner">
            {/* header bar */}
            <div className="ed-head">
              <div className="breadcrumb">
                <span className="bc-mod">{selectedModuleName}</span>
                <span className="bc-sep">/</span>
                <span className="bc-task">{selectedTask.name}</span>
              </div>
              <div className="ed-meta">
                <button
                  className={`complete-btn ${selectedTask.is_completed ? "on" : ""}`}
                  onClick={() =>
                    toggleTask(selectedTask.id, !selectedTask.is_completed)
                  }
                >
                  {selectedTask.is_completed ? (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                    >
                      <rect
                        x="1"
                        y="1"
                        width="12"
                        height="12"
                        rx="3"
                        fill="var(--ok)"
                      />
                      <path
                        d="M4 7l2 2 4-4"
                        stroke="#fff"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                    >
                      <rect
                        x="1"
                        y="1"
                        width="12"
                        height="12"
                        rx="3"
                        stroke="currentColor"
                        strokeWidth="1.2"
                      />
                    </svg>
                  )}
                  {selectedTask.is_completed ? "Done" : "Complete"}
                </button>

                <span className={`save-badge ${saveStatus}`}>
                  {saveStatus === "saving" && (
                    <>
                      <span className="pulse-dot" /> Saving
                    </>
                  )}
                  {saveStatus === "saved" && (
                    <>
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 14 14"
                        fill="none"
                      >
                        <path
                          d="M3 7.5l3 3 5-6"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Saved
                    </>
                  )}
                  {saveStatus === "error" && "Error"}
                </span>
              </div>
            </div>

            {/* text notes */}
            <section className="sec">
              <label className="sec-label">Notes</label>
              <textarea
                className="text-editor"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Write your documentation here..."
              />
            </section>

            {/* drawing canvas */}
            <section className="sec">
              <label className="sec-label">Diagram</label>

              <div className="toolbar">
                <div className="tg">
                  <button
                    className={`tb ${tool === "pen" ? "on" : ""}`}
                    onClick={() => setTool("pen")}
                    title="Pen"
                  >
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M11 2l3 3L5 14H2v-3L11 2z"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <button
                    className={`tb ${tool === "eraser" ? "on" : ""}`}
                    onClick={() => setTool("eraser")}
                    title="Eraser"
                  >
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M6 14h7M2.5 10.5l5-5 3.5 3.5-5 5L2.5 10.5z"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M2.5 10.5l3-8 4.5 2-3 8-4.5-2z"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>

                <div className="sep" />

                <div className="tg colors">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      className={`dot ${penColor === c ? "on" : ""}`}
                      style={{ background: c }}
                      onClick={() => {
                        setPenColor(c);
                        setTool("pen");
                      }}
                    />
                  ))}
                </div>

                <div className="sep" />

                <div className="tg sizes">
                  {SIZES.map((s) => (
                    <button
                      key={s}
                      className={`sz ${brushSize === s ? "on" : ""}`}
                      onClick={() => setBrushSize(s)}
                    >
                      <span
                        className="sz-dot"
                        style={{
                          width: Math.max(s, 3),
                          height: Math.max(s, 3),
                        }}
                      />
                    </button>
                  ))}
                </div>

                <div className="spacer" />

                <div className="tg">
                  <button className="tb" onClick={undo} title="Undo">
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M3 6h6a3 3 0 010 6H8"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M6 3L3 6l3 3"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <button className="tb danger" onClick={clearAll} title="Clear">
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M3 3l10 10M13 3L3 13"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="canvas-wrap">
                <canvas
                  ref={canvasRef}
                  className="canvas"
                  onMouseDown={onPointerDown}
                  onMouseMove={onPointerMove}
                  onMouseUp={onPointerUp}
                  onMouseLeave={onPointerUp}
                  onTouchStart={onPointerDown}
                  onTouchMove={onPointerMove}
                  onTouchEnd={onPointerUp}
                />
              </div>
            </section>
          </div>
        )}
      </main>

      {/* ── Modal ── */}
      {confirm && (
        <div className="overlay" onClick={() => setConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>
              Delete {confirm.type === "module" ? "module" : "task"}?
            </h3>
            <p>
              Permanently delete &ldquo;{confirm.name}&rdquo;
              {confirm.type === "module" &&
                " and all its tasks and documentation"}
              . This cannot be undone.
            </p>
            <div className="modal-btns">
              <button className="btn-cancel" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button
                className="btn-delete"
                onClick={confirm.type === "module" ? deleteMod : deleteTask}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        /* ═══════════════════════════════════════
           RESETS & TOKENS
           ═══════════════════════════════════════ */
        :global(*) {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        :global(body) {
          background: #f5f0e8;
          color: #2a231c;
          -webkit-font-smoothing: antialiased;
        }
        :global(:root) {
          --bg: #f5f0e8;
          --surface: #fff;
          --surface-2: #faf8f3;
          --sidebar: #1e1a16;
          --sidebar-hover: #2a2520;
          --sidebar-txt: #a89e92;
          --sidebar-active: #f5f0e8;
          --accent: #b08542;
          --accent-dim: #96722f;
          --accent-bg: rgba(176, 133, 66, 0.08);
          --fg: #2a231c;
          --fg-2: #6b5f52;
          --fg-3: #9c9084;
          --border: #e5ddd3;
          --border-lt: #ede7dd;
          --ok: #4a7c59;
          --ok-bg: rgba(74, 124, 89, 0.08);
          --danger: #b54c47;
          --danger-bg: rgba(181, 76, 71, 0.06);
          --r-sm: 6px;
          --r-md: 8px;
          --r-lg: 12px;
        }

        /* ═══════════════════════════════════════
           LAYOUT
           ═══════════════════════════════════════ */
        .doc-layout {
          display: grid;
          grid-template-columns: 272px 1fr;
          height: 100vh;
          overflow: hidden;
        }

        /* ═══════════════════════════════════════
           SIDEBAR
           ═══════════════════════════════════════ */
        .sidebar {
          background: var(--sidebar);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .sidebar-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 14px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--sidebar-active);
          font-family: "Playfair Display", serif;
          font-size: 15px;
          font-weight: 600;
        }
        .brand svg {
          opacity: 0.55;
        }
        .head-btn {
          color: var(--sidebar-txt);
        }
        .head-btn:hover {
          color: var(--sidebar-active);
          background: rgba(255, 255, 255, 0.06);
        }

        .sidebar-nav {
          flex: 1;
          overflow-y: auto;
          padding: 8px 0;
        }
        .sidebar-nav::-webkit-scrollbar {
          width: 4px;
        }
        .sidebar-nav::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
        }

        /* Module */
        .mod-group {
          margin-bottom: 2px;
        }
        .mod-head {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 8px 12px;
          color: var(--sidebar-txt);
          cursor: pointer;
          user-select: none;
          transition: background 0.12s;
          min-height: 36px;
        }
        .mod-head:hover {
          background: var(--sidebar-hover);
          color: var(--sidebar-active);
        }
        .chev {
          flex-shrink: 0;
          transition: transform 0.2s;
          opacity: 0.4;
        }
        .chev.on {
          transform: rotate(90deg);
        }
        .mod-name {
          flex: 1;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .mod-actions {
          display: none;
          align-items: center;
          gap: 2px;
        }
        .mod-head:hover .mod-actions {
          display: flex;
        }
        .mod-head:hover .chev {
          opacity: 0;
        }

        /* Tasks */
        .task-list {
          padding-bottom: 4px;
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
        .task-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px 6px 30px;
          color: var(--sidebar-txt);
          cursor: pointer;
          transition: background 0.12s;
          font-size: 13px;
        }
        .task-row:hover {
          background: var(--sidebar-hover);
          color: var(--sidebar-active);
        }
        .task-row.sel {
          background: rgba(176, 133, 66, 0.12);
          color: var(--sidebar-active);
        }
        .task-row.done .task-name {
          text-decoration: line-through;
          opacity: 0.45;
        }
        .task-check {
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
        .task-row:hover .task-actions {
          display: flex;
        }

        .add-task-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px 5px 34px;
          background: none;
          border: none;
          color: var(--sidebar-txt);
          font-size: 12px;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.12s;
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

        /* Sidebar input */
        .sidebar-input {
          width: 100%;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          color: var(--sidebar-active);
          font-size: 12px;
          padding: 6px 8px;
          font-family: inherit;
          outline: none;
          transition: border-color 0.15s;
        }
        .sidebar-input:focus {
          border-color: var(--accent);
        }
        .sidebar-input::placeholder {
          color: rgba(255, 255, 255, 0.25);
        }

        .sidebar-foot {
          display: flex;
          gap: 6px;
          padding: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }
        .add-mod-btn {
          background: var(--accent);
          border: none;
          color: #fff;
          cursor: pointer;
          padding: 6px 8px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          transition: background 0.15s;
        }
        .add-mod-btn:hover:not(:disabled) {
          background: var(--accent-dim);
        }
        .add-mod-btn:disabled {
          opacity: 0.3;
          cursor: default;
        }

        /* Inline edit */
        .inline-input {
          flex: 1;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid var(--accent);
          border-radius: 3px;
          color: var(--sidebar-active);
          font-size: 12px;
          padding: 2px 6px;
          font-family: inherit;
          font-weight: 500;
          outline: none;
          min-width: 0;
        }
        .inline-input.sm {
          font-size: 12px;
          padding: 1px 5px;
        }

        /* Icon buttons */
        .icon-btn {
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          padding: 4px;
          border-radius: 3px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.12s;
        }
        .icon-btn:hover {
          background: rgba(255, 255, 255, 0.08);
        }
        .icon-btn.xs {
          padding: 3px;
        }
        .icon-btn.danger:hover {
          color: #e8746e;
          background: rgba(232, 116, 110, 0.1);
        }

        /* ═══════════════════════════════════════
           EDITOR
           ═══════════════════════════════════════ */
        .editor {
          overflow-y: auto;
          background: var(--bg);
        }

        .empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--fg-3);
          gap: 12px;
          animation: fadeIn 0.4s;
        }
        .empty h2 {
          font-family: "Playfair Display", serif;
          font-size: 20px;
          font-weight: 600;
          color: var(--fg-2);
        }
        .empty p {
          font-size: 14px;
          max-width: 300px;
          text-align: center;
          line-height: 1.5;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .editor-inner {
          max-width: 820px;
          margin: 0 auto;
          padding: 28px 36px 80px;
          animation: fadeIn 0.3s;
        }

        .ed-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 28px;
          padding-bottom: 14px;
          border-bottom: 1px solid var(--border);
        }
        .breadcrumb {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
        }
        .bc-mod {
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-size: 11px;
          color: var(--fg-3);
        }
        .bc-sep {
          color: var(--fg-3);
          font-size: 11px;
        }
        .bc-task {
          color: var(--fg);
          font-weight: 600;
        }
        .ed-meta {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .complete-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: 1px solid var(--border);
          border-radius: var(--r-sm);
          padding: 5px 12px;
          font-size: 12px;
          font-family: inherit;
          color: var(--fg-2);
          cursor: pointer;
          transition: all 0.15s;
        }
        .complete-btn:hover {
          border-color: var(--fg-3);
        }
        .complete-btn.on {
          background: var(--ok-bg);
          border-color: var(--ok);
          color: var(--ok);
        }

        .save-badge {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          color: var(--fg-3);
          min-width: 64px;
          transition: color 0.2s;
        }
        .save-badge.saving {
          color: var(--accent);
        }
        .save-badge.saved {
          color: var(--ok);
        }
        .save-badge.error {
          color: var(--danger);
        }
        .pulse-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent);
          animation: pulse 1s ease infinite;
        }
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }

        /* Sections */
        .sec {
          margin-bottom: 24px;
        }
        .sec-label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--fg-3);
          margin-bottom: 8px;
        }

        /* Text editor */
        .text-editor {
          width: 100%;
          min-height: 240px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          padding: 18px 22px;
          font-family: "Source Serif 4", Georgia, serif;
          font-size: 15px;
          line-height: 1.7;
          color: var(--fg);
          resize: vertical;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .text-editor:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-bg);
        }
        .text-editor::placeholder {
          color: var(--fg-3);
        }

        /* Toolbar */
        .toolbar {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-bottom: none;
          border-radius: var(--r-lg) var(--r-lg) 0 0;
          flex-wrap: wrap;
        }
        .tg {
          display: flex;
          align-items: center;
          gap: 3px;
        }
        .tg.colors {
          gap: 4px;
        }
        .tg.sizes {
          gap: 2px;
        }
        .sep {
          width: 1px;
          height: 20px;
          background: var(--border);
          margin: 0 4px;
        }
        .spacer {
          flex: 1;
        }
        .tb {
          background: none;
          border: 1px solid transparent;
          color: var(--fg-2);
          cursor: pointer;
          padding: 5px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.12s;
        }
        .tb:hover {
          background: var(--surface-2);
          color: var(--fg);
        }
        .tb.on {
          background: var(--accent-bg);
          color: var(--accent);
          border-color: var(--accent);
        }
        .tb.danger:hover {
          color: var(--danger);
          background: var(--danger-bg);
        }
        .dot {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 2px solid transparent;
          cursor: pointer;
          transition: all 0.12s;
          padding: 0;
        }
        .dot:hover {
          transform: scale(1.2);
        }
        .dot.on {
          border-color: var(--fg);
          box-shadow: 0 0 0 2px var(--surface), 0 0 0 3px var(--fg-3);
        }
        .sz {
          background: none;
          border: 1px solid transparent;
          cursor: pointer;
          padding: 5px 6px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.12s;
        }
        .sz:hover {
          background: var(--surface-2);
        }
        .sz.on {
          background: var(--accent-bg);
          border-color: var(--accent);
        }
        .sz-dot {
          display: block;
          border-radius: 50%;
          background: var(--fg);
        }

        /* Canvas */
        .canvas-wrap {
          background: #fff;
          border: 1px solid var(--border);
          border-radius: 0 0 var(--r-lg) var(--r-lg);
          overflow: hidden;
          cursor: crosshair;
        }
        .canvas {
          display: block;
          width: 100%;
          height: 360px;
          touch-action: none;
        }

        /* ═══════════════════════════════════════
           MODAL
           ═══════════════════════════════════════ */
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(30, 26, 22, 0.4);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          animation: fadeIn 0.15s;
        }
        .modal {
          background: var(--surface);
          border-radius: var(--r-lg);
          padding: 28px 32px;
          max-width: 400px;
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
          color: var(--fg);
        }
        .modal p {
          font-size: 14px;
          line-height: 1.6;
          color: var(--fg-2);
          margin-bottom: 24px;
        }
        .modal-btns {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }
        .btn-cancel {
          background: none;
          border: 1px solid var(--border);
          border-radius: var(--r-sm);
          padding: 8px 16px;
          font-size: 13px;
          font-family: inherit;
          color: var(--fg-2);
          cursor: pointer;
          transition: all 0.15s;
        }
        .btn-cancel:hover {
          background: var(--surface-2);
          border-color: var(--fg-3);
        }
        .btn-delete {
          background: var(--danger);
          border: 1px solid var(--danger);
          border-radius: var(--r-sm);
          padding: 8px 16px;
          font-size: 13px;
          font-family: inherit;
          color: #fff;
          cursor: pointer;
          transition: background 0.15s;
        }
        .btn-delete:hover {
          background: #943c38;
        }
      `}</style>
    </div>
  );
}
