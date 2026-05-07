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
} from "lucide-react";
import { toggleTaskAction, logoutAction } from "./actions";

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

    // Optimistic update
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
      // Revert on error
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
                width: `${
                  stats.totalTasks > 0
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
                className={`brutal-border brutal-shadow transition-all ${
                  isComplete ? "bg-[#4ade80]/20" : "bg-card"
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
                      className={`px-3 py-1 brutal-border text-sm font-bold ${
                        isComplete ? "bg-[#4ade80]" : "bg-[#ffd60a]"
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
                    {(module.filteredTasks || module.tasks).map((task) => (
                      <div
                        key={task.id}
                        onClick={() => openTaskEditor(task.id)}
                        className={`p-4 border-b-2 border-border last:border-b-0 flex items-center gap-4 cursor-pointer transition-all ${
                          task.is_completed
                            ? "bg-[#4ade80]/10"
                            : "hover:bg-secondary/50"
                        }`}
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
                          disabled={updatingTasks.has(task.id)}
                          className={`w-6 h-6 brutal-border flex-shrink-0 flex items-center justify-center transition-all ${
                            task.is_completed
                              ? "bg-primary text-primary-foreground"
                              : "bg-card hover:bg-accent"
                          } ${
                            updatingTasks.has(task.id)
                              ? "opacity-50 cursor-not-allowed"
                              : ""
                          }`}
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

                        {/* Task Label */}
                        <span
                          className={`font-medium flex-1 ${
                            task.is_completed ? "line-through opacity-60" : ""
                          }`}
                        >
                          {task.name}
                        </span>

                        {/* Open indicator */}
                        <span className="text-xs font-mono text-muted-foreground uppercase">
                          Click to edit
                        </span>
                      </div>
                    ))}
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
