"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Search,
  CheckCircle2,
  FolderCode,
  FileText,
  Code,
  BookOpen,
  LogOut,
  Pencil,
  Trash2,
  X,
  Check,
} from "lucide-react";
import {
  toggleTaskAction,
  logoutAction,
  updateTaskAction,
  deleteTaskAction,
} from "./actions";

interface Task {
  id: string;
  name: string;
  task_order: number;
  is_completed: boolean;
}

interface Module {
  id: string;
  name: string;
  display_order: number;
  tasks: Task[];
}

interface DocumentationDashboardProps {
  modules: Module[];
}

// Task icons based on name
const getTaskIcon = (name: string) => {
  if (name.includes("Technical")) return <Code className="w-4 h-4" />;
  if (name.includes("API")) return <FileText className="w-4 h-4" />;
  if (name.includes("User")) return <BookOpen className="w-4 h-4" />;
  return <FileText className="w-4 h-4" />;
};

// Task colors based on order
const getTaskColor = (order: number) => {
  switch (order) {
    case 1:
      return "bg-[#a8d5ff]"; // Technical - blue
    case 2:
      return "bg-[#ffd60a]"; // API - yellow
    case 3:
      return "bg-[#4ade80]"; // User Guide - green
    default:
      return "bg-white";
  }
};

type FilterOption = "all" | "incomplete" | "complete";

export default function DocumentationDashboard({
  modules: initialModules,
}: DocumentationDashboardProps) {
  const router = useRouter();
  const [modules, setModules] = useState(initialModules);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set([initialModules[0]?.id])
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterOption>("all");
  const [updatingTasks, setUpdatingTasks] = useState<Set<string>>(new Set());

  // Edit/Delete state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  // Toggle module expansion
  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  };

  // Toggle task completion
  const handleToggleTask = async (
    e: React.MouseEvent,
    moduleId: string,
    taskId: string,
    currentState: boolean
  ) => {
    e.stopPropagation();
    setUpdatingTasks((prev) => new Set(prev).add(taskId));

    setModules((prev) =>
      prev.map((module) =>
        module.id === moduleId
          ? {
            ...module,
            tasks: module.tasks.map((task) =>
              task.id === taskId
                ? { ...task, is_completed: !currentState }
                : task
            ),
          }
          : module
      )
    );

    const result = await toggleTaskAction(taskId, !currentState);

    if (result.error) {
      setModules((prev) =>
        prev.map((module) =>
          module.id === moduleId
            ? {
              ...module,
              tasks: module.tasks.map((task) =>
                task.id === taskId
                  ? { ...task, is_completed: currentState }
                  : task
              ),
            }
            : module
        )
      );
    }

    setUpdatingTasks((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
  };

  // Navigate to task editor
  const openTaskEditor = (taskId: string) => {
    router.push(`/documentation/${taskId}`);
  };

  // Expand/collapse all
  const toggleAllModules = (expand: boolean) => {
    if (expand) {
      setExpandedModules(new Set(modules.map((m) => m.id)));
    } else {
      setExpandedModules(new Set());
    }
  };

  // Handle logout
  const handleLogout = async () => {
    await logoutAction();
    router.push("/login");
  };

  // Start editing task name
  const handleEditStart = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTaskId(task.id);
    setEditValue(task.name);
  };

  // Save edited task name
  const handleEditSave = async (taskId: string, moduleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editValue.trim()) return;

    setUpdatingTasks((prev) => new Set(prev).add(taskId));

    // Optimistic update
    setModules((prev) =>
      prev.map((module) =>
        module.id === moduleId
          ? {
            ...module,
            tasks: module.tasks.map((task) =>
              task.id === taskId ? { ...task, name: editValue.trim() } : task
            ),
          }
          : module
      )
    );

    const result = await updateTaskAction(taskId, { name: editValue.trim() });

    if (result.error) {
      // Revert on error
      setModules((prev) =>
        prev.map((module) =>
          module.id === moduleId
            ? {
              ...module,
              tasks: module.tasks.map((task) =>
                task.id === taskId ? { ...task, name: editValue } : task
              ),
            }
            : module
        )
      );
      alert("Failed to update task: " + result.error);
    }

    setEditingTaskId(null);
    setUpdatingTasks((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
  };

  // Cancel editing
  const handleEditCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTaskId(null);
  };

  // Handle key press in edit input
  const handleEditKeyPress = (
    e: React.KeyboardEvent,
    taskId: string,
    moduleId: string
  ) => {
    if (e.key === "Enter") {
      handleEditSave(taskId, moduleId, e as unknown as React.MouseEvent);
    } else if (e.key === "Escape") {
      handleEditCancel(e as unknown as React.MouseEvent);
    }
  };

  // Delete task
  const handleDeleteTask = async (
    e: React.MouseEvent,
    moduleId: string,
    taskId: string
  ) => {
    e.stopPropagation();

    if (!confirm("Are you sure you want to delete this task?")) return;

    setDeletingTaskId(taskId);
    setUpdatingTasks((prev) => new Set(prev).add(taskId));

    // Optimistic update: remove task from UI
    setModules((prev) =>
      prev.map((module) =>
        module.id === moduleId
          ? { ...module, tasks: module.tasks.filter((t) => t.id !== taskId) }
          : module
      )
    );

    const result = await deleteTaskAction(taskId);

    if (result.error) {
      // Revert on error - reload modules from server would be ideal, but for now:
      alert("Failed to delete task: " + result.error);
      router.refresh(); // Force refresh to get fresh data
    }

    setDeletingTaskId(null);
    setUpdatingTasks((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
  };

  // Filter and search modules
  const filteredModules = useMemo(() => {
    return modules
      .map((module) => {
        const filteredTasks = module.tasks.filter((task) => {
          const matchesSearch =
            searchQuery === "" ||
            task.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            module.name.toLowerCase().includes(searchQuery.toLowerCase());

          const matchesFilter =
            filter === "all" ||
            (filter === "complete" && task.is_completed) ||
            (filter === "incomplete" && !task.is_completed);

          return matchesSearch && matchesFilter;
        });

        return { ...module, filteredTasks };
      })
      .filter(
        (module) =>
          module.filteredTasks.length > 0 ||
          (searchQuery !== "" &&
            module.name.toLowerCase().includes(searchQuery.toLowerCase()))
      );
  }, [modules, searchQuery, filter]);

  // Calculate progress stats
  const stats = useMemo(() => {
    const totalTasks = modules.reduce((acc, m) => acc + m.tasks.length, 0);
    const completedTasks = modules.reduce(
      (acc, m) => acc + m.tasks.filter((t) => t.is_completed).length,
      0
    );
    const totalModules = modules.length;
    const completedModules = modules.filter((m) =>
      m.tasks.every((t) => t.is_completed)
    ).length;

    return { totalTasks, completedTasks, totalModules, completedModules };
  }, [modules]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      {/* Header */}
      <header className="mb-8">
        <div className="brutal-border bg-card brutal-shadow p-6 mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
              Odoo Module Documentation
            </h1>
            <p className="text-lg font-medium text-muted-foreground mt-2">
              Click a task to open the editor with rich text and drawing canvas
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 brutal-border bg-card hover:bg-destructive/10 font-bold text-sm flex items-center gap-2 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="brutal-border bg-[#ffd60a] brutal-shadow-sm p-4">
            <p className="text-sm font-bold uppercase text-foreground/70">
              Total Tasks
            </p>
            <p className="text-3xl font-black">{stats.totalTasks}</p>
          </div>
          <div className="brutal-border bg-[#4ade80] brutal-shadow-sm p-4">
            <p className="text-sm font-bold uppercase text-foreground/70">
              Completed
            </p>
            <p className="text-3xl font-black">{stats.completedTasks}</p>
          </div>
          <div className="brutal-border bg-[#a8d5ff] brutal-shadow-sm p-4">
            <p className="text-sm font-bold uppercase text-foreground/70">
              Modules
            </p>
            <p className="text-3xl font-black">{stats.totalModules}</p>
          </div>
          <div className="brutal-border bg-card brutal-shadow-sm p-4">
            <p className="text-sm font-bold uppercase text-foreground/70">
              Progress
            </p>
            <p className="text-3xl font-black">
              {stats.totalTasks > 0
                ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
                : 0}
              %
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="brutal-border bg-card p-3 mb-6">
          <div className="h-6 bg-secondary brutal-border">
            <div
              className="h-full bg-[#4ade80] transition-all duration-300"
              style={{
                width: `${stats.totalTasks > 0
                    ? (stats.completedTasks / stats.totalTasks) * 100
                    : 0
                  }%`,
              }}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 brutal-border bg-card flex items-center px-4">
            <Search className="w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search modules or tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-3 bg-transparent outline-none font-medium placeholder:text-muted-foreground"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-2">
            {(["all", "incomplete", "complete"] as const).map((option) => (
              <button
                key={option}
                onClick={() => setFilter(option)}
                className={`px-4 py-3 brutal-border font-bold uppercase text-sm transition-all ${filter === option
                    ? "bg-primary text-primary-foreground brutal-shadow-sm"
                    : "bg-card hover:bg-accent"
                  }`}
              >
                {option}
              </button>
            ))}
          </div>

          {/* Expand/Collapse All */}
          <div className="flex gap-2">
            <button
              onClick={() => toggleAllModules(true)}
              className="px-4 py-3 brutal-border bg-card font-bold text-sm hover:bg-[#a8d5ff] transition-all"
            >
              Expand All
            </button>
            <button
              onClick={() => toggleAllModules(false)}
              className="px-4 py-3 brutal-border bg-card font-bold text-sm hover:bg-[#a8d5ff] transition-all"
            >
              Collapse All
            </button>
          </div>
        </div>
      </header>

      {/* Module List */}
      <main className="space-y-4">
        {filteredModules.length === 0 ? (
          <div className="brutal-border bg-card brutal-shadow p-8 text-center">
            <p className="text-xl font-bold text-muted-foreground">
              No modules match your search
            </p>
          </div>
        ) : (
          filteredModules.map((module) => {
            const moduleProgress = module.tasks.filter(
              (t) => t.is_completed
            ).length;
            const isComplete = moduleProgress === module.tasks.length;
            const isExpanded = expandedModules.has(module.id);

            return (
              <div
                key={module.id}
                className={`brutal-border brutal-shadow transition-all ${isComplete ? "bg-[#4ade80]/20" : "bg-card"
                  }`}
              >
                {/* Module Header */}
                <button
                  onClick={() => toggleModule(module.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="w-6 h-6" />
                    ) : (
                      <ChevronRight className="w-6 h-6" />
                    )}
                    <FolderCode className="w-6 h-6" />
                    <span className="font-mono font-bold text-lg">
                      {module.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 brutal-border text-sm font-bold ${isComplete ? "bg-[#4ade80]" : "bg-[#ffd60a]"
                        }`}
                    >
                      {moduleProgress}/{module.tasks.length}
                    </span>
                    {isComplete && <CheckCircle2 className="w-6 h-6" />}
                  </div>
                </button>

                {/* Tasks */}
                {isExpanded && (
                  <div className="border-t-2 border-border">
                    {(module.filteredTasks || module.tasks).map((task) => {
                      const isEditing = editingTaskId === task.id;
                      const isDeleting = deletingTaskId === task.id;
                      const isUpdating = updatingTasks.has(task.id);

                      return (
                        <div
                          key={task.id}
                          onClick={() => !isEditing && openTaskEditor(task.id)}
                          className={`p-4 border-b-2 border-border last:border-b-0 flex items-center gap-4 transition-all ${task.is_completed
                              ? "bg-[#4ade80]/10"
                              : "hover:bg-secondary/50"
                            } ${isUpdating ? "opacity-60" : ""}`}
                        >
                          {/* Custom Checkbox */}
                          <button
                            onClick={(e) =>
                              handleToggleTask(
                                e,
                                module.id,
                                task.id,
                                task.is_completed
                              )
                            }
                            disabled={isUpdating}
                            className={`w-6 h-6 brutal-border flex-shrink-0 flex items-center justify-center transition-all ${task.is_completed
                                ? "bg-primary text-primary-foreground"
                                : "bg-card hover:bg-accent"
                              } ${isUpdating ? "cursor-not-allowed" : ""}`}
                          >
                            {task.is_completed && (
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={3}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </button>

                          {/* Task Badge */}
                          <div
                            className={`px-2 py-1 brutal-border text-xs font-bold uppercase flex items-center gap-1 flex-shrink-0 ${getTaskColor(
                              task.task_order
                            )}`}
                          >
                            {getTaskIcon(task.name)}
                            <span>
                              {task.task_order === 1
                                ? "Tech"
                                : task.task_order === 2
                                  ? "API"
                                  : "Guide"}
                            </span>
                          </div>

                          {/* Task Name - Editable */}
                          <div className="flex-1 min-w-0">
                            {isEditing ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) =>
                                    handleEditKeyPress(e, task.id, module.id)
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                  autoFocus
                                  className="flex-1 px-2 py-1 brutal-border bg-background font-medium outline-none focus:ring-2 focus:ring-primary"
                                />
                                <button
                                  onClick={(e) =>
                                    handleEditSave(task.id, module.id, e)
                                  }
                                  className="p-1 hover:bg-[#4ade80] brutal-border transition-colors"
                                  title="Save"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={handleEditCancel}
                                  className="p-1 hover:bg-destructive brutal-border transition-colors"
                                  title="Cancel"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <span
                                className={`font-medium block truncate ${task.is_completed
                                    ? "line-through opacity-60"
                                    : ""
                                  }`}
                                title={task.name}
                              >
                                {task.name}
                              </span>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {!isEditing && !isDeleting && (
                              <>
                                <button
                                  onClick={(e) => handleEditStart(task, e)}
                                  disabled={isUpdating}
                                  className="p-2 hover:bg-[#a8d5ff] brutal-border transition-colors disabled:opacity-50"
                                  title="Edit task name"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) =>
                                    handleDeleteTask(e, module.id, task.id)
                                  }
                                  disabled={isUpdating}
                                  className="p-2 hover:bg-destructive brutal-border transition-colors disabled:opacity-50"
                                  title="Delete task"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {isDeleting && (
                              <span className="text-xs text-muted-foreground">
                                Deleting...
                              </span>
                            )}
                          </div>

                          {/* Open indicator */}
                          {!isEditing && (
                            <span className="text-xs font-mono text-muted-foreground uppercase hidden md:block">
                              Click to edit
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>

      {/* Footer */}
      <footer className="mt-8 brutal-border bg-primary text-primary-foreground p-4 brutal-shadow">
        <p className="font-bold text-center">
          {stats.completedModules} of {stats.totalModules} modules fully
          documented
        </p>
      </footer>
    </div>
  );
}