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
  AlertTriangle,
} from "lucide-react";
import {
  toggleTaskAction,
  logoutAction,
  updateTaskAction,
  updateModuleAction,
  deleteTaskAction,
  deleteModuleAction,
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
      return "bg-[#a8d5ff]";
    case 2:
      return "bg-[#ffd60a]";
    case 3:
      return "bg-[#4ade80]";
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
  const [updatingModules, setUpdatingModules] = useState<Set<string>>(new Set());

  // Task edit/delete state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskValue, setEditTaskValue] = useState("");
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  // Module edit/delete state
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [editModuleValue, setEditModuleValue] = useState("");
  const [deletingModuleId, setDeletingModuleId] = useState<string | null>(null);

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

  // ==================== TASK EDITING ====================

  const handleEditTaskStart = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTaskId(task.id);
    setEditTaskValue(task.name);
  };

  const handleEditTaskSave = async (taskId: string, moduleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editTaskValue.trim()) return;

    setUpdatingTasks((prev) => new Set(prev).add(taskId));

    setModules((prev) =>
      prev.map((module) =>
        module.id === moduleId
          ? {
            ...module,
            tasks: module.tasks.map((task) =>
              task.id === taskId ? { ...task, name: editTaskValue.trim() } : task
            ),
          }
          : module
      )
    );

    const result = await updateTaskAction(taskId, { name: editTaskValue.trim() });

    if (result.error) {
      setModules((prev) =>
        prev.map((module) =>
          module.id === moduleId
            ? {
              ...module,
              tasks: module.tasks.map((task) =>
                task.id === taskId ? { ...task, name: editTaskValue } : task
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

  const handleEditTaskCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTaskId(null);
  };

  const handleEditTaskKeyPress = (
    e: React.KeyboardEvent,
    taskId: string,
    moduleId: string
  ) => {
    if (e.key === "Enter") {
      handleEditTaskSave(taskId, moduleId, e as unknown as React.MouseEvent);
    } else if (e.key === "Escape") {
      handleEditTaskCancel(e as unknown as React.MouseEvent);
    }
  };

  const handleDeleteTask = async (
    e: React.MouseEvent,
    moduleId: string,
    taskId: string
  ) => {
    e.stopPropagation();

    if (!confirm("Are you sure you want to delete this task?")) return;

    setDeletingTaskId(taskId);
    setUpdatingTasks((prev) => new Set(prev).add(taskId));

    setModules((prev) =>
      prev.map((module) =>
        module.id === moduleId
          ? { ...module, tasks: module.tasks.filter((t) => t.id !== taskId) }
          : module
      )
    );

    const result = await deleteTaskAction(taskId);

    if (result.error) {
      alert("Failed to delete task: " + result.error);
      router.refresh();
    }

    setDeletingTaskId(null);
    setUpdatingTasks((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
  };

  // ==================== MODULE EDITING ====================

  const handleEditModuleStart = (module: Module, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingModuleId(module.id);
    setEditModuleValue(module.name);
  };

  const handleEditModuleSave = async (moduleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editModuleValue.trim()) return;

    setUpdatingModules((prev) => new Set(prev).add(moduleId));

    setModules((prev) =>
      prev.map((module) =>
        module.id === moduleId ? { ...module, name: editModuleValue.trim() } : module
      )
    );

    const result = await updateModuleAction(moduleId, editModuleValue.trim());

    if (result.error) {
      setModules((prev) =>
        prev.map((module) =>
          module.id === moduleId ? { ...module, name: editModuleValue } : module
        )
      );
      alert("Failed to update module: " + result.error);
    }

    setEditingModuleId(null);
    setUpdatingModules((prev) => {
      const next = new Set(prev);
      next.delete(moduleId);
      return next;
    });
  };

  const handleEditModuleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingModuleId(null);
  };

  const handleEditModuleKeyPress = (
    e: React.KeyboardEvent,
    moduleId: string
  ) => {
    if (e.key === "Enter") {
      handleEditModuleSave(moduleId, e as unknown as React.MouseEvent);
    } else if (e.key === "Escape") {
      handleEditModuleCancel(e as unknown as React.MouseEvent);
    }
  };

  const handleDeleteModule = async (
    e: React.MouseEvent,
    moduleId: string,
    taskCount: number
  ) => {
    e.stopPropagation();

    const warning = taskCount > 0
      ? `⚠️ This will delete the module AND all ${taskCount} task(s) inside it.\n\nAre you sure you want to continue?`
      : "Are you sure you want to delete this module?";

    if (!confirm(warning)) return;

    setDeletingModuleId(moduleId);
    setUpdatingModules((prev) => new Set(prev).add(moduleId));

    // Optimistic update: remove module from UI
    setModules((prev) => prev.filter((m) => m.id !== moduleId));
    setExpandedModules((prev) => {
      const next = new Set(prev);
      next.delete(moduleId);
      return next;
    });

    const result = await deleteModuleAction(moduleId);

    if (result.error) {
      alert("Failed to delete module: " + result.error);
      router.refresh();
    }

    setDeletingModuleId(null);
    setUpdatingModules((prev) => {
      const next = new Set(prev);
      next.delete(moduleId);
      return next;
    });
  };

  // ==================== FILTER & STATS ====================

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
            const isEditingModule = editingModuleId === module.id;
            const isUpdatingModule = updatingModules.has(module.id);
            const isDeletingModule = deletingModuleId === module.id;

            return (
              <div
                key={module.id}
                className={`brutal-border brutal-shadow transition-all ${isComplete ? "bg-[#4ade80]/20" : "bg-card"
                  } ${isUpdatingModule || isDeletingModule ? "opacity-70" : ""}`}
              >
                {/* Module Header */}
                <div className="w-full p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      onClick={() => toggleModule(module.id)}
                      className="flex-shrink-0"
                      disabled={isEditingModule || isDeletingModule}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-6 h-6" />
                      ) : (
                        <ChevronRight className="w-6 h-6" />
                      )}
                    </button>
                    <FolderCode className="w-6 h-6 flex-shrink-0" />

                    {/* Module Name - Editable */}
                    <div className="flex-1 min-w-0">
                      {isEditingModule ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editModuleValue}
                            onChange={(e) => setEditModuleValue(e.target.value)}
                            onKeyDown={(e) => handleEditModuleKeyPress(e, module.id)}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                            disabled={isUpdatingModule}
                            className="flex-1 px-2 py-1 brutal-border bg-background font-mono font-bold text-lg outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                          />
                          <button
                            onClick={(e) => handleEditModuleSave(module.id, e)}
                            className="p-1 hover:bg-[#4ade80] brutal-border transition-colors disabled:opacity-50"
                            title="Save"
                            disabled={isUpdatingModule}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleEditModuleCancel}
                            className="p-1 hover:bg-destructive brutal-border transition-colors disabled:opacity-50"
                            title="Cancel"
                            disabled={isUpdatingModule}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span
                          className="font-mono font-bold text-lg truncate block cursor-pointer"
                          title={module.name}
                          onClick={() => toggleModule(module.id)}
                        >
                          {module.name}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Module Action Buttons */}
                    {!isEditingModule && !isDeletingModule && (
                      <>
                        <button
                          onClick={(e) => handleEditModuleStart(module, e)}
                          disabled={isUpdatingModule}
                          className="p-2 hover:bg-[#a8d5ff] brutal-border transition-colors disabled:opacity-50"
                          title="Edit module name"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteModule(e, module.id, module.tasks.length)}
                          disabled={isUpdatingModule}
                          className="p-2 hover:bg-destructive brutal-border transition-colors disabled:opacity-50"
                          title="Delete module"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {isDeletingModule && (
                      <span className="flex items-center gap-1 text-xs text-destructive font-bold">
                        <AlertTriangle className="w-4 h-4" />
                        Deleting...
                      </span>
                    )}

                    <span
                      className={`px-3 py-1 brutal-border text-sm font-bold ${isComplete ? "bg-[#4ade80]" : "bg-[#ffd60a]"
                        }`}
                    >
                      {moduleProgress}/{module.tasks.length}
                    </span>
                    {isComplete && <CheckCircle2 className="w-6 h-6" />}
                  </div>
                </div>

                {/* Tasks */}
                {isExpanded && (
                  <div className="border-t-2 border-border">
                    {(module.filteredTasks || module.tasks).map((task) => {
                      const isEditingTask = editingTaskId === task.id;
                      const isDeletingTask = deletingTaskId === task.id;
                      const isUpdatingTask = updatingTasks.has(task.id);

                      return (
                        <div
                          key={task.id}
                          onClick={() => !isEditingTask && openTaskEditor(task.id)}
                          className={`p-4 border-b-2 border-border last:border-b-0 flex items-center gap-4 transition-all ${task.is_completed
                              ? "bg-[#4ade80]/10"
                              : "hover:bg-secondary/50"
                            } ${isUpdatingTask ? "opacity-60" : ""}`}
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
                            disabled={isUpdatingTask}
                            className={`w-6 h-6 brutal-border flex-shrink-0 flex items-center justify-center transition-all ${task.is_completed
                                ? "bg-primary text-primary-foreground"
                                : "bg-card hover:bg-accent"
                              } ${isUpdatingTask ? "cursor-not-allowed" : ""}`}
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
                            {isEditingTask ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editTaskValue}
                                  onChange={(e) => setEditTaskValue(e.target.value)}
                                  onKeyDown={(e) =>
                                    handleEditTaskKeyPress(e, task.id, module.id)
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                  autoFocus
                                  className="flex-1 px-2 py-1 brutal-border bg-background font-medium outline-none focus:ring-2 focus:ring-primary"
                                />
                                <button
                                  onClick={(e) =>
                                    handleEditTaskSave(task.id, module.id, e)
                                  }
                                  className="p-1 hover:bg-[#4ade80] brutal-border transition-colors"
                                  title="Save"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={handleEditTaskCancel}
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
                            {!isEditingTask && !isDeletingTask && (
                              <>
                                <button
                                  onClick={(e) => handleEditTaskStart(task, e)}
                                  disabled={isUpdatingTask}
                                  className="p-2 hover:bg-[#a8d5ff] brutal-border transition-colors disabled:opacity-50"
                                  title="Edit task name"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) =>
                                    handleDeleteTask(e, module.id, task.id)
                                  }
                                  disabled={isUpdatingTask}
                                  className="p-2 hover:bg-destructive brutal-border transition-colors disabled:opacity-50"
                                  title="Delete task"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {isDeletingTask && (
                              <span className="text-xs text-muted-foreground">
                                Deleting...
                              </span>
                            )}
                          </div>

                          {/* Open indicator */}
                          {!isEditingTask && (
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