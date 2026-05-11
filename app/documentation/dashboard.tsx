// app/documentation/dashboard.tsx
"use client";

import { useState, useMemo, useRef, useEffect } from "react";
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
  Plus,
  FolderPlus,
  FilePlus,
  Download,
  Loader2,
} from "lucide-react";
import {
  toggleTaskAction,
  logoutAction,
  updateTaskAction,
  updateModuleAction,
  deleteTaskAction,
  deleteModuleAction,
  createModuleAction,
  createTaskAction,
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

const getTaskIcon = (name: string) => {
  if (name.includes("Technical")) return <Code className="w-4 h-4" />;
  if (name.includes("API")) return <FileText className="w-4 h-4" />;
  if (name.includes("User")) return <BookOpen className="w-4 h-4" />;
  return <FileText className="w-4 h-4" />;
};

const getTaskColor = (order: number) => {
  switch (order) {
    case 1: return "bg-[#a8d5ff]";
    case 2: return "bg-[#ffd60a]";
    case 3: return "bg-[#4ade80]";
    default: return "bg-white";
  }
};

type FilterOption = "all" | "incomplete" | "complete";

export default function DocumentationDashboard({
  modules: initialModules,
}: DocumentationDashboardProps) {
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);
  const [modules, setModules] = useState(initialModules);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set([initialModules[0]?.id])
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterOption>("all");
  const [updatingTasks, setUpdatingTasks] = useState<Set<string>>(new Set());
  const [updatingModules, setUpdatingModules] = useState<Set<string>>(new Set());

  // Edit/Delete state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskValue, setEditTaskValue] = useState("");
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [editModuleValue, setEditModuleValue] = useState("");
  const [deletingModuleId, setDeletingModuleId] = useState<string | null>(null);

  // Create state
  const [creatingModule, setCreatingModule] = useState(false);
  const [newModuleName, setNewModuleName] = useState("");
  const [creatingTaskForModule, setCreatingTaskForModule] = useState<string | null>(null);
  const [newTaskName, setNewTaskName] = useState("");
  const [creatingTasks, setCreatingTasks] = useState<Set<string>>(new Set());

  // PDF Export state
  const [exportingPdf, setExportingPdf] = useState(false);

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

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
                task.id === taskId ? { ...task, is_completed: !currentState } : task
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
                  task.id === taskId ? { ...task, is_completed: currentState } : task
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

  const openTaskEditor = (taskId: string) => {
    router.push(`/documentation/${taskId}`);
  };

  const toggleAllModules = (expand: boolean) => {
    setExpandedModules(expand ? new Set(modules.map((m) => m.id)) : new Set());
  };

  const handleLogout = async () => {
    await logoutAction();
    router.push("/login");
  };

  // ==================== TASK CRUD ====================

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

  const handleEditTaskKeyPress = (e: React.KeyboardEvent, taskId: string, moduleId: string) => {
    if (e.key === "Enter") handleEditTaskSave(taskId, moduleId, e as unknown as React.MouseEvent);
    else if (e.key === "Escape") handleEditTaskCancel(e as unknown as React.MouseEvent);
  };

  const handleDeleteTask = async (e: React.MouseEvent, moduleId: string, taskId: string) => {
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

  const handleCreateTaskStart = (moduleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCreatingTaskForModule(moduleId);
    setNewTaskName("");
  };

  const handleCreateTaskSave = async (moduleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!newTaskName.trim()) return;
    
    setCreatingTasks((prev) => new Set(prev).add(moduleId));
    const module = modules.find((m) => m.id === moduleId);
    const nextOrder = module ? module.tasks.length + 1 : 1;
    
    setModules((prev) =>
      prev.map((m) =>
        m.id === moduleId
          ? {
              ...m,
              tasks: [
                ...m.tasks,
                {
                  id: `temp-${Date.now()}`,
                  name: newTaskName.trim(),
                  task_order: nextOrder,
                  is_completed: false,
                },
              ],
            }
          : m
      )
    );

    const result = await createTaskAction(moduleId, {
      name: newTaskName.trim(),
      task_order: nextOrder,
    });

    if (result.error) {
      alert("Failed to create task: " + result.error);
      router.refresh();
      return;
    }

    if (result.data?.id) {
      setModules((prev) =>
        prev.map((m) =>
          m.id === moduleId
            ? {
                ...m,
                tasks: m.tasks.map((t) =>
                  t.id.startsWith("temp-") && t.name === newTaskName.trim()
                    ? { ...t, id: result.data!.id }
                    : t
                ),
              }
            : m
        )
      );
    }

    setCreatingTaskForModule(null);
    setNewTaskName("");
    setCreatingTasks((prev) => {
      const next = new Set(prev);
      next.delete(moduleId);
      return next;
    });
    router.refresh();
  };

  const handleCreateTaskCancel = () => {
    setCreatingTaskForModule(null);
    setNewTaskName("");
  };

  const handleCreateTaskKeyPress = (e: React.KeyboardEvent, moduleId: string) => {
    if (e.key === "Enter") handleCreateTaskSave(moduleId, e as unknown as React.MouseEvent);
    else if (e.key === "Escape") handleCreateTaskCancel();
  };

  // ==================== MODULE CRUD ====================

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

  const handleEditModuleKeyPress = (e: React.KeyboardEvent, moduleId: string) => {
    if (e.key === "Enter") handleEditModuleSave(moduleId, e as unknown as React.MouseEvent);
    else if (e.key === "Escape") handleEditModuleCancel(e as unknown as React.MouseEvent);
  };

  const handleDeleteModule = async (e: React.MouseEvent, moduleId: string, taskCount: number) => {
    e.stopPropagation();
    const message = taskCount > 0 
      ? `Are you sure? This will delete the module and all ${taskCount} task(s) inside.`
      : "Are you sure you want to delete this module?";
      
    if (!confirm(message)) return;
    
    setDeletingModuleId(moduleId);
    setUpdatingModules((prev) => new Set(prev).add(moduleId));
    setModules((prev) => prev.filter((m) => m.id !== moduleId));

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

  // ✅ FIXED: Module Creation Handlers (were missing!)
  const handleCreateModuleStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCreatingModule(true);
    setNewModuleName("");
  };

  const handleCreateModuleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!newModuleName.trim()) return;
    
    // Optimistic update
    setModules((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        name: newModuleName.trim(),
        display_order: prev.length + 1,
        tasks: [],
      },
    ]);

    const result = await createModuleAction(newModuleName.trim());
    
    if (result.error) {
      alert("Failed to create module: " + result.error);
      router.refresh();
      return;
    }

    // Replace temp ID with real ID
    if (result.data?.id) {
      setModules((prev) =>
        prev.map((m) =>
          m.id.startsWith("temp-") && m.name === newModuleName.trim()
            ? { ...m, id: result.data!.id }
            : m
        )
      );
    }

    setCreatingModule(false);
    setNewModuleName("");
    router.refresh();
  };

  const handleCreateModuleCancel = () => {
    setCreatingModule(false);
    setNewModuleName("");
  };

  const handleCreateModuleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleCreateModuleSave(e as unknown as React.MouseEvent);
    else if (e.key === "Escape") handleCreateModuleCancel();
  };

  // ==================== PDF EXPORT ====================
  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      // Dynamically import PDF libraries
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);

      const element = contentRef.current;
      if (!element) throw new Error("Content ref not found");

      // Temporarily expand all modules for export
      const wasExpanded = new Set(expandedModules);
      setExpandedModules(new Set(modules.map((m) => m.id)));
      
      // Wait for DOM update
      await new Promise((resolve) => setTimeout(resolve, 100));

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`odoo-documentation-${new Date().toISOString().split("T")[0]}.pdf`);
      setExpandedModules(wasExpanded);
    } catch (err) {
      console.error("PDF export error:", err);
      alert("Failed to export PDF. Please try again.");
    } finally {
      setExportingPdf(false);
    }
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
          (searchQuery !== "" && module.name.toLowerCase().includes(searchQuery.toLowerCase()))
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
        <div className="brutal-border bg-card brutal-shadow p-6 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
              Odoo Module Documentation
            </h1>
            <p className="text-lg font-medium text-muted-foreground mt-2">
              Click a task to open the editor with rich text and drawing canvas
            </p>
          </div>
          <div className="flex items-center gap-2">
            {typeof window !== "undefined" && (
              <button
                onClick={handleExportPdf}
                disabled={exportingPdf}
                className="px-4 py-2 brutal-border bg-card hover:bg-[#a8d5ff] font-bold text-sm flex items-center gap-2 transition-all disabled:opacity-50"
                title="Export dashboard to PDF"
              >
                {exportingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {exportingPdf ? "Exporting..." : "Export PDF"}
              </button>
            )}
            <button
              onClick={handleLogout}
              className="px-4 py-2 brutal-border bg-card hover:bg-destructive/10 font-bold text-sm flex items-center gap-2 transition-all"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="brutal-border bg-[#ffd60a] brutal-shadow-sm p-4">
            <p className="text-sm font-bold uppercase text-foreground/70">Total Tasks</p>
            <p className="text-3xl font-black">{stats.totalTasks}</p>
          </div>
          <div className="brutal-border bg-[#4ade80] brutal-shadow-sm p-4">
            <p className="text-sm font-bold uppercase text-foreground/70">Completed</p>
            <p className="text-3xl font-black">{stats.completedTasks}</p>
          </div>
          <div className="brutal-border bg-[#a8d5ff] brutal-shadow-sm p-4">
            <p className="text-sm font-bold uppercase text-foreground/70">Modules</p>
            <p className="text-3xl font-black">{stats.totalModules}</p>
          </div>
          <div className="brutal-border bg-card brutal-shadow-sm p-4">
            <p className="text-sm font-bold uppercase text-foreground/70">Progress</p>
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
                width: `${stats.totalTasks > 0 ? (stats.completedTasks / stats.totalTasks) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4">
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
          <div className="flex gap-2">
            {(["all", "incomplete", "complete"] as const).map((option) => (
              <button
                key={option}
                onClick={() => setFilter(option)}
                className={`px-4 py-3 brutal-border font-bold uppercase text-sm transition-all ${
                  filter === option
                    ? "bg-primary text-primary-foreground brutal-shadow-sm"
                    : "bg-card hover:bg-accent"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
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

      {/* Main Content - Exportable Area */}
      <main ref={contentRef} className="space-y-4">
        {filteredModules.length === 0 ? (
          <div className="brutal-border bg-card brutal-shadow p-8 text-center">
            <p className="text-xl font-bold text-muted-foreground">
              No modules match your search
            </p>
          </div>
        ) : (
          filteredModules.map((module) => {
            const moduleProgress = module.tasks.filter((t) => t.is_completed).length;
            const isComplete = moduleProgress === module.tasks.length;
            const isExpanded = expandedModules.has(module.id);
            const isEditingModule = editingModuleId === module.id;
            const isUpdatingModule = updatingModules.has(module.id);
            const isDeletingModule = deletingModuleId === module.id;
            const isCreatingTask = creatingTaskForModule === module.id;

            return (
              <div
                key={module.id}
                className={`brutal-border brutal-shadow transition-all ${
                  isComplete ? "bg-[#4ade80]/20" : "bg-card"
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
                      {isExpanded ? <ChevronDown className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
                    </button>
                    <FolderCode className="w-6 h-6 flex-shrink-0" />
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
                    {!isEditingModule && !isDeletingModule && !creatingModule && (
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
                      className={`px-3 py-1 brutal-border text-sm font-bold ${
                        isComplete ? "bg-[#4ade80]" : "bg-[#ffd60a]"
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
                    {isCreatingTask && (
                      <div className="p-4 border-b-2 border-border bg-secondary/30">
                        <div className="flex items-center gap-2">
                          <FilePlus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <input
                            type="text"
                            value={newTaskName}
                            onChange={(e) => setNewTaskName(e.target.value)}
                            onKeyDown={(e) => handleCreateTaskKeyPress(e, module.id)}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="New task name..."
                            autoFocus
                            className="flex-1 px-3 py-2 brutal-border bg-background font-medium outline-none focus:ring-2 focus:ring-primary"
                          />
                          <button
                            onClick={(e) => handleCreateTaskSave(module.id, e)}
                            className="p-2 hover:bg-[#4ade80] brutal-border transition-colors"
                            title="Save task"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleCreateTaskCancel}
                            className="p-2 hover:bg-destructive brutal-border transition-colors"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                    {(module.filteredTasks || module.tasks).map((task) => {
                      const isEditingTask = editingTaskId === task.id;
                      const isDeletingTask = deletingTaskId === task.id;
                      const isUpdatingTask = updatingTasks.has(task.id);

                      return (
                        <div
                          key={task.id}
                          onClick={() => !isEditingTask && openTaskEditor(task.id)}
                          className={`p-4 border-b-2 border-border last:border-b-0 flex items-center gap-4 transition-all ${
                            task.is_completed ? "bg-[#4ade80]/10" : "hover:bg-secondary/50"
                          } ${isUpdatingTask ? "opacity-60" : ""}`}
                        >
                          <button
                            onClick={(e) => handleToggleTask(e, module.id, task.id, task.is_completed)}
                            disabled={isUpdatingTask}
                            className={`w-6 h-6 brutal-border flex-shrink-0 flex items-center justify-center transition-all ${
                              task.is_completed
                                ? "bg-primary text-primary-foreground"
                                : "bg-card hover:bg-accent"
                            } ${isUpdatingTask ? "cursor-not-allowed" : ""}`}
                          >
                            {task.is_completed && (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                          <div
                            className={`px-2 py-1 brutal-border text-xs font-bold uppercase flex items-center gap-1 flex-shrink-0 ${getTaskColor(
                              task.task_order
                            )}`}
                          >
                            {getTaskIcon(task.name)}
                            <span>{task.task_order === 1 ? "Tech" : task.task_order === 2 ? "API" : "Guide"}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            {isEditingTask ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editTaskValue}
                                  onChange={(e) => setEditTaskValue(e.target.value)}
                                  onKeyDown={(e) => handleEditTaskKeyPress(e, task.id, module.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  autoFocus
                                  className="flex-1 px-2 py-1 brutal-border bg-background font-medium outline-none focus:ring-2 focus:ring-primary"
                                />
                                <button
                                  onClick={(e) => handleEditTaskSave(task.id, module.id, e)}
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
                                className={`font-medium block truncate ${
                                  task.is_completed ? "line-through opacity-60" : ""
                                }`}
                                title={task.name}
                              >
                                {task.name}
                              </span>
                            )}
                          </div>
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
                                  onClick={(e) => handleDeleteTask(e, module.id, task.id)}
                                  disabled={isUpdatingTask}
                                  className="p-2 hover:bg-destructive brutal-border transition-colors disabled:opacity-50"
                                  title="Delete task"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {isDeletingTask && <span className="text-xs text-muted-foreground">Deleting...</span>}
                          </div>
                          {!isEditingTask && (
                            <span className="text-xs font-mono text-muted-foreground uppercase hidden md:block">
                              Click to edit
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {!isCreatingTask && (
                      <button
                        onClick={(e) => handleCreateTaskStart(module.id, e)}
                        disabled={creatingTasks.has(module.id)}
                        className="w-full p-4 border-t-2 border-border flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" />
                        <span className="font-medium text-sm">Add Task</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Create Module Section - FIXED */}
        {creatingModule ? (
          <div className="brutal-border bg-card brutal-shadow p-4">
            <div className="flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <input
                type="text"
                value={newModuleName}
                onChange={(e) => setNewModuleName(e.target.value)}
                onKeyDown={handleCreateModuleKeyPress}
                onClick={(e) => e.stopPropagation()}
                placeholder="New module name..."
                autoFocus
                className="flex-1 px-3 py-2 brutal-border bg-background font-mono font-bold outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={handleCreateModuleSave}
                className="px-4 py-2 brutal-border bg-[#4ade80] font-bold text-sm hover:bg-[#22c55e] transition-colors flex items-center gap-1"
              >
                <Check className="w-4 h-4" />
                Create
              </button>
              <button
                onClick={handleCreateModuleCancel}
                className="px-4 py-2 brutal-border bg-destructive font-bold text-sm hover:bg-destructive/90 transition-colors flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleCreateModuleStart}
            className="w-full brutal-border bg-card brutal-shadow p-4 flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors group"
          >
            <FolderPlus className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="font-bold uppercase text-sm">+ Add New Module</span>
          </button>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-8 brutal-border bg-primary text-primary-foreground p-4 brutal-shadow">
        <p className="font-bold text-center">
          {stats.completedModules} of {stats.totalModules} modules fully documented
        </p>
      </footer>
    </div>
  );
}