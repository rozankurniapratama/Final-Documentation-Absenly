// app/documentation/[taskId]/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import TaskEditor from "./editor/TaskEditor";
import { Suspense } from "react";

interface PageProps {
  params: Promise<{ taskId: string }> | { taskId: string };
}

// Loading fallback for Suspense
function TaskEditorSkeleton() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Loading documentation editor...</p>
      </div>
    </div>
  );
}

// Main editor wrapper (client-safe)
async function TaskEditorWrapper({ taskId }: { taskId: string }) {
  "use server";
  
  const supabase = await createClient();

  // 🔍 Debug log
  console.log(`[TaskPage] Fetching task: ${taskId}`);

  // 📦 Fetch task with module relation
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select(`
      id,
      name,
      task_order,
      is_completed,
      modules (
        id,
        name
      )
    `)
    .eq("id", taskId)
    .maybeSingle();

  if (taskError) {
    console.error(`[TaskPage] Supabase task error:`, taskError);
    throw new Error(`Failed to load task: ${taskError.message}`);
  }

  if (!task) {
    console.warn(`[TaskPage] Task not found: ${taskId}`);
    notFound();
  }

  // 📝 Fetch documentation content
  const { data: doc, error: docError } = await supabase
    .from("task_documentation")
    .select("text_content")
    .eq("task_id", taskId)
    .maybeSingle();

  if (docError) {
    console.warn(`[TaskPage] Documentation fetch warning:`, docError);
    // Continue without doc content - editor handles null
  }

  // 🏷️ Extract module name safely
  const modules = task.modules as { name: string } | { name: string }[] | null;
  const moduleName = Array.isArray(modules) 
    ? modules[0]?.name 
    : modules?.name 
    || "Unknown Module";

  console.log(`[TaskPage] Rendering editor for task: ${taskId}, module: ${moduleName}`);

  // ✅ Render editor with data
  return (
    <TaskEditor
      taskId={task.id}
      taskName={task.name}
      moduleName={moduleName}
      initialContent={doc?.text_content || null}
    />
  );
}

export default async function TaskDocumentationPage({ params }: PageProps) {
  // 🔐 Auth check (run early)
  const session = await getSession();
  if (!session?.authenticated) {
    console.log("[TaskPage] Redirecting unauthenticated user");
    redirect("/login");
  }

  // 🔄 Handle params for Next.js 14 vs 15
  let taskId: string;
  try {
    const resolvedParams = await Promise.resolve(params);
    taskId = resolvedParams.taskId;
    
    if (!taskId || typeof taskId !== "string") {
      console.error("[TaskPage] Invalid taskId:", taskId);
      notFound();
    }
  } catch (err) {
    console.error("[TaskPage] Failed to resolve params:", err);
    notFound();
  }

  // 🎯 Wrap in Suspense to prevent "already finished loading" errors
  return (
    <Suspense fallback={<TaskEditorSkeleton />}>
      <TaskEditorWrapper taskId={taskId} />
    </Suspense>
  );
}

// 🔍 SEO Metadata
export async function generateMetadata({ params }: PageProps) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const taskId = resolvedParams.taskId;
    
    return {
      title: `Task #${taskId} • Documentation`,
      description: `Edit and manage documentation for task ${taskId}`,
      robots: {
        index: false,
        follow: false,
      },
    };
  } catch {
    return {
      title: "Documentation • Task Manager",
      robots: { index: false, follow: false },
    };
  }
}