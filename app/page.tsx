import Link from "next/link";
import { ArrowRight, FolderCode, FileCheck, BookOpen } from "lucide-react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getSession();

  // If already authenticated, redirect to documentation
  if (session?.authenticated) {
    redirect("/documentation");
  }

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center justify-center">
      <div className="max-w-2xl w-full">
        {/* Hero Card */}
        <div className="brutal-border bg-card brutal-shadow p-8 mb-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="brutal-border bg-[#ffd60a] p-4">
              <FolderCode className="w-12 h-12" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight mb-4">
            TiLabs Documentation
          </h1>
          <p className="text-lg font-medium text-muted-foreground">
            Odoo Module Documentation Tracker with Rich Text and Drawing
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="brutal-border bg-[#a8d5ff] brutal-shadow-sm p-4">
            <FolderCode className="w-8 h-8 mb-2" />
            <p className="font-bold">19 Modules</p>
            <p className="text-sm opacity-70">Track all your Odoo modules</p>
          </div>
          <div className="brutal-border bg-[#ffd60a] brutal-shadow-sm p-4">
            <FileCheck className="w-8 h-8 mb-2" />
            <p className="font-bold">3 Tasks Each</p>
            <p className="text-sm opacity-70">Tech, API, User Guide</p>
          </div>
          <div className="brutal-border bg-[#4ade80] brutal-shadow-sm p-4">
            <BookOpen className="w-8 h-8 mb-2" />
            <p className="font-bold">Rich Editor</p>
            <p className="text-sm opacity-70">Notion + Excalidraw</p>
          </div>
        </div>

        {/* CTA Button */}
        <Link
          href="/login"
          className="brutal-border bg-primary text-primary-foreground brutal-shadow p-4 flex items-center justify-center gap-3 font-bold text-xl uppercase hover:bg-[#ffd60a] hover:text-foreground transition-all group"
        >
          <span>Access Dashboard</span>
          <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
