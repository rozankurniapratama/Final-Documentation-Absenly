// components/mermaid/InsertMermaidButton.tsx
"use client";

import { GitMerge } from "lucide-react";

interface InsertMermaidButtonProps {
  onInsert: (code: string) => void;
}

export default function InsertMermaidButton({ onInsert }: InsertMermaidButtonProps) {
  const defaultCode = `graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action]
    B -->|No| D[End]
    C --> E[Result]
    D --> E`;

  return (
    <button
      onClick={() => onInsert(defaultCode)}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 brutal-border bg-card hover:bg-[#a8d5ff] font-medium text-sm transition-colors rounded"
      title="Insert Mermaid diagram"
    >
      <GitMerge className="w-4 h-4" />
      Add Diagram
    </button>
  );
}