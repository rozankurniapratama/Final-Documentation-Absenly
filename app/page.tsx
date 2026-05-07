import Link from "next/link"
import { ArrowRight, FolderCode, FileCheck, Shield } from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f5f5f0] p-4 md:p-8 flex flex-col items-center justify-center">
      <div className="max-w-2xl w-full">
        {/* Hero Card */}
        <div className="brutal-border bg-white brutal-shadow p-8 mb-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="brutal-border bg-[#ffd60a] p-4">
              <FolderCode className="w-12 h-12 text-black" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-black mb-4">
            Odoo Documentation Tracker
          </h1>
          <p className="text-lg font-medium text-black/70">
            Track your codebase documentation progress across all 19 modules
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="brutal-border bg-[#a8d5ff] brutal-shadow-sm p-4">
            <FolderCode className="w-8 h-8 text-black mb-2" />
            <p className="font-bold text-black">19 Modules</p>
            <p className="text-sm text-black/70">Track all your Odoo modules</p>
          </div>
          <div className="brutal-border bg-[#4ade80] brutal-shadow-sm p-4">
            <FileCheck className="w-8 h-8 text-black mb-2" />
            <p className="font-bold text-black">8 Tasks Each</p>
            <p className="text-sm text-black/70">Comprehensive checklist</p>
          </div>
          <div className="brutal-border bg-[#ff6b6b] brutal-shadow-sm p-4">
            <Shield className="w-8 h-8 text-black mb-2" />
            <p className="font-bold text-black">Security Focus</p>
            <p className="text-sm text-black/70">Track security docs</p>
          </div>
        </div>

        {/* CTA Button */}
        <Link
          href="/documentation"
          className="brutal-border bg-black text-white brutal-shadow p-4 flex items-center justify-center gap-3 font-bold text-xl uppercase hover:bg-[#ffd60a] hover:text-black transition-all group"
        >
          <span>Open Dashboard</span>
          <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  )
}
