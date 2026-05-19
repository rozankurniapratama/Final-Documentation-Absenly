import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import DocumentationDashboard from "./dashboard";

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

export default async function DocumentationPage() {
  const session = await getSession();

  if (!session?.authenticated) {
    redirect("/login");
  }

  const supabase = await createClient();

  // Fetch modules with their tasks
  const { data: modules, error } = await supabase
    .from("modules")
    .select(
      `
      id,
      name,
      display_order,
      tasks (
        id,
        name,
        task_order,
        is_completed
      )
    `
    )
    .order("display_order", { ascending: true });

  if (error) {
    console.error("Error fetching modules:", error);
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="brutal-border bg-destructive/10 p-8">
          <h1 className="text-xl font-bold">Error loading modules</h1>
          <p className="text-muted-foreground">{error.message}</p>
        </div>
      </div>
    );
  }

  // Sort tasks within each module
  const sortedModules: Module[] = (modules || []).map((module) => ({
    ...module,
    tasks: [...(module.tasks || [])].sort(
      (a, b) => a.task_order - b.task_order
    ),
  }));

  return <DocumentationDashboard modules={sortedModules} />;
}