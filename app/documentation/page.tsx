"use client"

import { useState, useMemo } from "react"
import { ChevronDown, ChevronRight, Search, CheckCircle2, Circle, FolderCode, FileText, Code, Shield, Eye, BookOpen, Terminal } from "lucide-react"

// Types
type TaskId = string
type ModuleId = string

interface Task {
  id: TaskId
  label: string
  category: "meta" | "python" | "security" | "views" | "docs" | "global"
  completed: boolean
}

interface Module {
  id: ModuleId
  name: string
  tasks: Task[]
  expanded: boolean
}

// Default tasks template for each module
const createDefaultTasks = (moduleId: string): Task[] => [
  {
    id: `${moduleId}-meta-manifest`,
    label: "Meta: Clean the `__manifest__.py` description and extract the changelog to `CHANGELOG.md`.",
    category: "meta",
    completed: false,
  },
  {
    id: `${moduleId}-python-signature`,
    label: "Python: Ensure the 5-line signature header is present in all `.py` files.",
    category: "python",
    completed: false,
  },
  {
    id: `${moduleId}-python-docstrings`,
    label: "Python: Add inline `\"\"\" docstrings \"\"\"` for complex methods and document `.sudo()` usage.",
    category: "python",
    completed: false,
  },
  {
    id: `${moduleId}-security-access`,
    label: "Security: Add explicit read/write rules in `ir.model.access.csv`.",
    category: "security",
    completed: false,
  },
  {
    id: `${moduleId}-security-rules`,
    label: "Security: Add XML comments explaining record rules in `security.xml`.",
    category: "security",
    completed: false,
  },
  {
    id: `${moduleId}-views-comments`,
    label: "Views: Add XML comments to complex inherited views.",
    category: "views",
    completed: false,
  },
  {
    id: `${moduleId}-docs-readme`,
    label: "Docs: Create/Update `README.md` with user-facing explanations.",
    category: "docs",
    completed: false,
  },
  {
    id: `${moduleId}-global-map`,
    label: "Global: Run `./scripts/generate_map.sh` to update `REPO_MAP.md`.",
    category: "global",
    completed: false,
  },
]

// Module names (exact folder names)
const MODULE_NAMES = [
  "sudo_erp_cash_advance",
  "sudo_hris_announcement",
  "sudo_hris_attendance",
  "sudo_hris_attendance_dummy_data",
  "sudo_hris_branch_attendance",
  "sudo_hris_branch_employee",
  "sudo_hris_document",
  "sudo_hris_employee",
  "sudo_hris_expense",
  "sudo_hris_leave",
  "sudo_hris_loan",
  "sudo_hris_mobile",
  "sudo_hris_overtime",
  "sudo_hris_payroll",
  "sudo_hris_payroll_leave_religion",
  "sudo_hris_payroll_pph21",
  "sudo_hris_reimbursement",
  "sudo_hris_report_1721",
  "til_web_grid",
] as const

// Initialize modules with sudo_hris_mobile first and expanded
const initializeModules = (): Module[] => {
  const mobileModule: Module = {
    id: "sudo_hris_mobile",
    name: "sudo_hris_mobile",
    tasks: createDefaultTasks("sudo_hris_mobile"),
    expanded: true,
  }

  const otherModules: Module[] = MODULE_NAMES
    .filter((name) => name !== "sudo_hris_mobile")
    .map((name) => ({
      id: name,
      name: name,
      tasks: createDefaultTasks(name),
      expanded: false,
    }))

  return [mobileModule, ...otherModules]
}

// Filter options
type FilterOption = "all" | "incomplete" | "complete"

// Category icons
const getCategoryIcon = (category: Task["category"]) => {
  switch (category) {
    case "meta":
      return <FileText className="w-4 h-4" />
    case "python":
      return <Code className="w-4 h-4" />
    case "security":
      return <Shield className="w-4 h-4" />
    case "views":
      return <Eye className="w-4 h-4" />
    case "docs":
      return <BookOpen className="w-4 h-4" />
    case "global":
      return <Terminal className="w-4 h-4" />
    default:
      return <Circle className="w-4 h-4" />
  }
}

// Category colors (Neo-Brutalist palette)
const getCategoryColor = (category: Task["category"]) => {
  switch (category) {
    case "meta":
      return "bg-[#ffd60a]"
    case "python":
      return "bg-[#a8d5ff]"
    case "security":
      return "bg-[#ff6b6b]"
    case "views":
      return "bg-[#c084fc]"
    case "docs":
      return "bg-[#4ade80]"
    case "global":
      return "bg-white"
    default:
      return "bg-white"
  }
}

export default function DocumentationPage() {
  const [modules, setModules] = useState<Module[]>(initializeModules)
  const [searchQuery, setSearchQuery] = useState("")
  const [filter, setFilter] = useState<FilterOption>("all")

  // Toggle module expansion
  const toggleModule = (moduleId: ModuleId) => {
    setModules((prev) =>
      prev.map((module) =>
        module.id === moduleId ? { ...module, expanded: !module.expanded } : module
      )
    )
  }

  // Toggle task completion
  const toggleTask = (moduleId: ModuleId, taskId: TaskId) => {
    setModules((prev) =>
      prev.map((module) =>
        module.id === moduleId
          ? {
              ...module,
              tasks: module.tasks.map((task) =>
                task.id === taskId ? { ...task, completed: !task.completed } : task
              ),
            }
          : module
      )
    )
  }

  // Expand/collapse all modules
  const toggleAllModules = (expand: boolean) => {
    setModules((prev) => prev.map((module) => ({ ...module, expanded: expand })))
  }

  // Filter and search modules
  const filteredModules = useMemo(() => {
    return modules
      .map((module) => {
        const filteredTasks = module.tasks.filter((task) => {
          const matchesSearch =
            searchQuery === "" ||
            task.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            module.name.toLowerCase().includes(searchQuery.toLowerCase())

          const matchesFilter =
            filter === "all" ||
            (filter === "complete" && task.completed) ||
            (filter === "incomplete" && !task.completed)

          return matchesSearch && matchesFilter
        })

        return { ...module, filteredTasks }
      })
      .filter(
        (module) =>
          module.filteredTasks.length > 0 ||
          (searchQuery !== "" && module.name.toLowerCase().includes(searchQuery.toLowerCase()))
      )
  }, [modules, searchQuery, filter])

  // Calculate progress stats
  const stats = useMemo(() => {
    const totalTasks = modules.reduce((acc, m) => acc + m.tasks.length, 0)
    const completedTasks = modules.reduce(
      (acc, m) => acc + m.tasks.filter((t) => t.completed).length,
      0
    )
    const totalModules = modules.length
    const completedModules = modules.filter((m) => m.tasks.every((t) => t.completed)).length

    return { totalTasks, completedTasks, totalModules, completedModules }
  }, [modules])

  return (
    <div className="min-h-screen bg-[#f5f5f0] p-4 md:p-8">
      {/* Header */}
      <header className="mb-8">
        <div className="brutal-border bg-white brutal-shadow p-6 mb-6">
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-black">
            Odoo Codebase Documentation
          </h1>
          <p className="text-lg font-medium text-black/70 mt-2">
            Track documentation progress across all modules
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="brutal-border bg-[#ffd60a] brutal-shadow-sm p-4">
            <p className="text-sm font-bold uppercase text-black/70">Total Tasks</p>
            <p className="text-3xl font-black text-black">{stats.totalTasks}</p>
          </div>
          <div className="brutal-border bg-[#4ade80] brutal-shadow-sm p-4">
            <p className="text-sm font-bold uppercase text-black/70">Completed</p>
            <p className="text-3xl font-black text-black">{stats.completedTasks}</p>
          </div>
          <div className="brutal-border bg-[#a8d5ff] brutal-shadow-sm p-4">
            <p className="text-sm font-bold uppercase text-black/70">Modules</p>
            <p className="text-3xl font-black text-black">{stats.totalModules}</p>
          </div>
          <div className="brutal-border bg-white brutal-shadow-sm p-4">
            <p className="text-sm font-bold uppercase text-black/70">Progress</p>
            <p className="text-3xl font-black text-black">
              {stats.totalTasks > 0
                ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
                : 0}
              %
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="brutal-border bg-white p-3 mb-6">
          <div className="h-6 bg-[#e8e8e0] brutal-border">
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
          {/* Search */}
          <div className="flex-1 brutal-border bg-white flex items-center px-4">
            <Search className="w-5 h-5 text-black/50" />
            <input
              type="text"
              placeholder="Search modules or tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-3 bg-transparent outline-none font-medium text-black placeholder:text-black/40"
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
                    ? "bg-black text-white brutal-shadow-sm"
                    : "bg-white text-black hover:bg-[#ffd60a]"
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
              className="px-4 py-3 brutal-border bg-white font-bold text-sm hover:bg-[#a8d5ff] transition-all"
            >
              Expand All
            </button>
            <button
              onClick={() => toggleAllModules(false)}
              className="px-4 py-3 brutal-border bg-white font-bold text-sm hover:bg-[#a8d5ff] transition-all"
            >
              Collapse All
            </button>
          </div>
        </div>
      </header>

      {/* Module List */}
      <main className="space-y-4">
        {filteredModules.length === 0 ? (
          <div className="brutal-border bg-white brutal-shadow p-8 text-center">
            <p className="text-xl font-bold text-black/50">No modules match your search</p>
          </div>
        ) : (
          filteredModules.map((module) => {
            const moduleProgress = module.tasks.filter((t) => t.completed).length
            const isComplete = moduleProgress === module.tasks.length

            return (
              <div
                key={module.id}
                className={`brutal-border brutal-shadow transition-all ${
                  isComplete ? "bg-[#4ade80]/20" : "bg-white"
                }`}
              >
                {/* Module Header */}
                <button
                  onClick={() => toggleModule(module.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-black/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {module.expanded ? (
                      <ChevronDown className="w-6 h-6 text-black" />
                    ) : (
                      <ChevronRight className="w-6 h-6 text-black" />
                    )}
                    <FolderCode className="w-6 h-6 text-black" />
                    <span className="font-mono font-bold text-lg text-black">{module.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 brutal-border text-sm font-bold ${
                        isComplete ? "bg-[#4ade80]" : "bg-[#ffd60a]"
                      }`}
                    >
                      {moduleProgress}/{module.tasks.length}
                    </span>
                    {isComplete && <CheckCircle2 className="w-6 h-6 text-black" />}
                  </div>
                </button>

                {/* Tasks */}
                {module.expanded && (
                  <div className="border-t-2 border-black">
                    {(module.filteredTasks || module.tasks).map((task) => (
                      <div
                        key={task.id}
                        className={`p-4 border-b-2 border-black last:border-b-0 flex items-start gap-4 transition-all ${
                          task.completed ? "bg-[#4ade80]/10" : "hover:bg-black/5"
                        }`}
                      >
                        {/* Custom Checkbox */}
                        <button
                          onClick={() => toggleTask(module.id, task.id)}
                          className={`w-6 h-6 brutal-border flex-shrink-0 flex items-center justify-center transition-all ${
                            task.completed
                              ? "bg-black text-white"
                              : "bg-white hover:bg-[#ffd60a]"
                          }`}
                        >
                          {task.completed && (
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

                        {/* Category Badge */}
                        <div
                          className={`px-2 py-1 brutal-border text-xs font-bold uppercase flex items-center gap-1 flex-shrink-0 ${getCategoryColor(
                            task.category
                          )}`}
                        >
                          {getCategoryIcon(task.category)}
                          <span>{task.category}</span>
                        </div>

                        {/* Task Label */}
                        <span
                          className={`font-medium text-black flex-1 ${
                            task.completed ? "line-through opacity-60" : ""
                          }`}
                        >
                          {task.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </main>

      {/* Footer */}
      <footer className="mt-8 brutal-border bg-black text-white p-4 brutal-shadow">
        <p className="font-bold text-center">
          {stats.completedModules} of {stats.totalModules} modules fully documented
        </p>
      </footer>
    </div>
  )
}
