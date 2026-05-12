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

// Types
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

// Helper functions
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

// PDF Export Utility Functions
const generateModulePdfBlob = async (
  module: Module,
  allModules: Module[],
  jsPDF: any,
  html2canvas: any
): Promise<Blob | null> => {
  try {
    // Buat container temporary untuk render module saja
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.width = '800px';
    tempContainer.style.background = '#ffffff';
    tempContainer.style.padding = '40px';
    tempContainer.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    tempContainer.style.color = '#1a1a1a';
    document.body.appendChild(tempContainer);

    // Generate HTML content untuk module ini saja
    const moduleContent = `
      <div style="text-align: center; padding: 40px 20px; margin-bottom: 30px; page-break-after: always;">
        <h1 style="font-size: 28px; font-weight: bold; margin-bottom: 10px; color: #1a1a1a;">
          ${module.name}
        </h1>
        <p style="color: #666; font-size: 14px;">
          Documentation Module
        </p>
        <div style="display: flex; justify-content: center; gap: 15px; margin-top: 20px;">
          <span style="background: #f3f4f6; padding: 6px 12px; border-radius: 4px; font-size: 12px;">
            ${module.tasks.length} Tasks
          </span>
          <span style="background: #f3f4f6; padding: 6px 12px; border-radius: 4px; font-size: 12px;">
            Generated: ${new Date().toLocaleDateString('id-ID')}
          </span>
        </div>
      </div>
      <div style="page-break-after: always;"></div>
      ${module.tasks.map((task, idx) => `
        <div style="margin-bottom: 30px; page-break-inside: avoid;">
          <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb;">
            ${idx + 1}. ${task.name}
          </h3>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="background: ${getTaskColor(task.task_order)}; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 500;">
              ${task.task_order === 1 ? 'Technical' : task.task_order === 2 ? 'API' : 'User Guide'}
            </span>
            ${task.is_completed ? '<span style="color: #22c55e; font-size: 12px;">✓ Completed</span>' : ''}
          </div>
        </div>
      `).join('')}
    `;

    tempContainer.innerHTML = moduleContent;
    
    // Wait untuk resources load
    await new Promise(resolve => setTimeout(resolve, 100));

    // Convert ke canvas
    const canvas = await html2canvas(tempContainer, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    // Cleanup
    document.body.removeChild(tempContainer);

    // Setup jsPDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    // Add pages
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // Return blob
    return pdf.output('blob');

  } catch (error) {
    console.error('Error generating module PDF:', error);
    return null;
  }
};

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

  // PDF Export state - UPDATED
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedModulesForExport, setSelectedModulesForExport] = useState<Set<string>>(new Set());
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number; moduleName: string } | null>(null);

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

  const handleCreateModuleStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCreatingModule(true);
    setNewModuleName("");
  };

  const handleCreateModuleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!newModuleName.trim()) return;

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

  // ==================== PDF EXPORT - UPDATED ====================
  
  // Export ALL modules (original behavior - kept for backward compatibility)
  const handleExportAllPdf = async () => {
    setExportingPdf(true);
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);

      const element = contentRef.current;
      if (!element) throw new Error("Content ref not found");

      const wasExpanded = new Set(expandedModules);
      setExpandedModules(new Set(modules.map((m) => m.id)));
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

  // ✅ NEW: Export selected modules as separate PDFs
  const handleExportSelectedModulesPdf = async () => {
    if (selectedModulesForExport.size === 0) return;
    
    setExportingPdf(true);
    setExportProgress({ current: 0, total: selectedModulesForExport.size, moduleName: '' });
    
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);

      const selectedModules = modules.filter(m => selectedModulesForExport.has(m.id));
      
      for (let i = 0; i < selectedModules.length; i++) {
        const module = selectedModules[i];
        
        // Update progress
        setExportProgress({ 
          current: i + 1, 
          total: selectedModules.length, 
          moduleName: module.name 
        });

        // Generate PDF for this module
        const blob = await generateModulePdfBlob(module, modules, jsPDF, html2canvas);
        
        if (blob) {
          // Trigger download
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${module.name.replace(/\s+/g, '_')}_documentation.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }

        // Small delay to prevent browser freeze
        if (i < selectedModules.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      // Show success message
      alert(`Successfully exported ${selectedModules.length} PDF file(s)!`);
      
    } catch (err) {
      console.error("PDF export error:", err);
      alert("Failed to export PDF. Please try again.");
    } finally {
      setExportingPdf(false);
      setExportProgress(null);
      setShowExportModal(false);
      setSelectedModulesForExport(new Set());
    }
  };

  // Toggle module selection for export
  const toggleModuleForExport = (moduleId: string) => {
    setSelectedModulesForExport((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  };

  // Select/Deselect all modules
  const toggleSelectAllModules = () => {
    if (selectedModulesForExport.size === modules.length) {
      setSelectedModulesForExport(new Set());
    } else {
      setSelectedModulesForExport(new Set(modules.map(m => m.id)));
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
    <div className="min-h-screen bg-background text-foreground font-mono">
      {/* Header */}
      <header className="border-b-2 border-border bg-card p-4 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderCode className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold">Odoo Documentation</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Export Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExportModal(true)}
                disabled={exportingPdf || modules.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground brutal-border rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {exportingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Export PDF
              </button>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-secondary brutal-border rounded transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content - Exportable Area */}
      <main ref={contentRef} className="max-w-6xl mx-auto p-4">
        {/* Stats & Filters */}
        <div className="flex flex-wrap gap-4 mb-6 items-center justify-between">
          <div className="flex gap-4 text-sm">
            <span className="flex items-center gap-1">
              <FolderCode className="w-4 h-4" />
              {stats.completedModules}/{stats.totalModules} Modules
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-[#4ade80]" />
              {stats.completedTasks}/{stats.totalTasks} Tasks
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => toggleAllModules(true)}
              className="px-3 py-1 text-sm brutal-border hover:bg-secondary rounded"
            >
              Expand All
            </button>
            <button
              onClick={() => toggleAllModules(false)}
              className="px-3 py-1 text-sm brutal-border hover:bg-secondary rounded"
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search modules or tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 brutal-border bg-background rounded focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterOption)}
            className="px-4 py-2 brutal-border bg-background rounded focus:ring-2 focus:ring-primary outline-none"
          >
            <option value="all">All Tasks</option>
            <option value="incomplete">Incomplete</option>
            <option value="complete">Completed</option>
          </select>
        </div>

        {/* Modules List */}
        {filteredModules.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No modules match your search</p>
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
            const isSelectedForExport = selectedModulesForExport.has(module.id);

            return (
              <div
                key={module.id}
                className="mb-4 brutal-border rounded-lg overflow-hidden bg-card"
              >
                {/* Module Header */}
                <div
                  onClick={() => !isEditingModule && toggleModule(module.id)}
                  className="p-4 flex items-center gap-3 cursor-pointer hover:bg-secondary/50 transition-colors"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleModule(module.id);
                    }}
                    className="flex-shrink-0"
                    disabled={isEditingModule || isDeletingModule}
                  >
                    {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </button>

                  {isEditingModule ? (
                    <div className="flex items-center gap-2 flex-1">
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
                        className="p-1 hover:bg-destructive brutal-border transition-colors"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 flex-1">
                      <FolderCode className="w-5 h-5 text-muted-foreground" />
                      <span className="font-mono font-bold text-lg">{module.name}</span>
                    </div>
                  )}

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
                    <span className="text-destructive text-sm font-medium">Deleting...</span>
                  )}

                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-sm text-muted-foreground">
                      {moduleProgress}/{module.tasks.length}
                    </span>
                    {isComplete && <CheckCircle2 className="w-5 h-5 text-[#4ade80]" />}
                  </div>
                </div>

                {/* Tasks */}
                {isExpanded && (
                  <div className="border-t-2 border-border">
                    {isCreatingTask && (
                      <div className="p-4 flex items-center gap-2 border-b-2 border-border bg-secondary/30">
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
                            {task.is_completed && <Check className="w-4 h-4" />}
                          </button>

                          <div className="flex items-center gap-2">
                            {getTaskIcon(task.name)}
                            <span className="text-xs font-medium px-2 py-0.5 rounded bg-[#a8d5ff]/50">
                              {task.task_order === 1 ? "Tech" : task.task_order === 2 ? "API" : "Guide"}
                            </span>
                          </div>

                          {isEditingTask ? (
                            <div className="flex items-center gap-2 flex-1">
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
                            <span className="font-medium flex-1">{task.name}</span>
                          )}

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
                          {isDeletingTask && <span className="text-destructive text-sm">Deleting...</span>}

                          {!isEditingTask && (
                            <span className="text-xs text-muted-foreground ml-2">
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
                        Add Task
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Create Module Section */}
        {creatingModule ? (
          <div className="p-4 brutal-border rounded-lg bg-secondary/30 flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-muted-foreground" />
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
              className="px-4 py-2 bg-primary text-primary-foreground brutal-border rounded hover:bg-primary/90 transition-colors"
            >
              Create
            </button>
            <button
              onClick={handleCreateModuleCancel}
              className="px-4 py-2 brutal-border hover:bg-secondary rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={handleCreateModuleStart}
            className="w-full p-4 mt-4 brutal-border rounded-lg border-dashed hover:bg-secondary/50 transition-colors flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <FolderPlus className="w-5 h-5" />
            + Add New Module
          </button>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-border p-4 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} TiLabs Documentation System</p>
      </footer>

      {/* ✅ Export PDF Modal - NEW */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background brutal-border rounded-lg p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Download className="w-5 h-5" />
                Export PDF per Folder
              </h3>
              <button 
                onClick={() => {
                  setShowExportModal(false);
                  setSelectedModulesForExport(new Set());
                }}
                className="p-1 hover:bg-secondary brutal-border rounded transition-colors"
                disabled={exportingPdf}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-sm text-muted-foreground mb-4">
              Pilih folder yang ingin di-export. Setiap folder akan menghasilkan 1 file PDF terpisah.
            </p>
            
            {/* Select All */}
            <button
              onClick={toggleSelectAllModules}
              className="w-full text-left px-3 py-2 mb-2 text-sm brutal-border rounded hover:bg-secondary/50 transition-colors flex items-center justify-between"
              disabled={exportingPdf}
            >
              <span className="font-medium">
                {selectedModulesForExport.size === modules.length ? 'Deselect All' : 'Select All'}
              </span>
              <span className="text-muted-foreground">
                {modules.length} folders
              </span>
            </button>
            
            {/* Module List */}
            <div className="max-h-64 overflow-y-auto space-y-2 mb-4">
              {modules.map((module) => (
                <label 
                  key={module.id}
                  className="flex items-center gap-3 p-3 brutal-border rounded cursor-pointer hover:bg-secondary/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedModulesForExport.has(module.id)}
                    onChange={() => toggleModuleForExport(module.id)}
                    className="w-4 h-4 accent-primary"
                    disabled={exportingPdf}
                  />
                  <FolderCode className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium flex-1">{module.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {module.tasks.length} tasks
                  </span>
                </label>
              ))}
            </div>
            
            {/* Progress */}
            {exportProgress && (
              <div className="mb-4 p-3 bg-secondary/30 brutal-border rounded">
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    Exporting: {exportProgress.moduleName} ({exportProgress.current}/{exportProgress.total})
                  </span>
                </div>
              </div>
            )}
            
            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowExportModal(false);
                  setSelectedModulesForExport(new Set());
                }}
                disabled={exportingPdf}
                className="px-4 py-2 brutal-border hover:bg-secondary rounded font-medium transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleExportSelectedModulesPdf}
                disabled={selectedModulesForExport.size === 0 || exportingPdf}
                className="px-4 py-2 bg-primary text-primary-foreground brutal-border rounded font-medium disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                {exportingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Export {selectedModulesForExport.size} PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}