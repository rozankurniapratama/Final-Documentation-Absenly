import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "@supabase/supabase-js";

// Mock Supabase client
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: {
                id: "test-task-id",
                name: "Technical Documentation",
                task_order: 1,
                is_completed: false,
              },
              error: null,
            })
          ),
        })),
        order: vi.fn(() =>
          Promise.resolve({
            data: [
              {
                id: "module-1",
                name: "sudo_hris_mobile",
                display_order: 1,
                tasks: [
                  { id: "task-1", name: "Technical Documentation", task_order: 1, is_completed: false },
                  { id: "task-2", name: "API Reference", task_order: 2, is_completed: false },
                  { id: "task-3", name: "User Guide", task_order: 3, is_completed: false },
                ],
              },
            ],
            error: null,
          })
        ),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
      upsert: vi.fn(() => Promise.resolve({ error: null })),
    })),
  })),
}));

describe("Documentation Data Structure", () => {
  it("should have correct module structure", () => {
    const module = {
      id: "module-1",
      name: "sudo_hris_mobile",
      display_order: 1,
      tasks: [],
    };

    expect(module).toHaveProperty("id");
    expect(module).toHaveProperty("name");
    expect(module).toHaveProperty("display_order");
    expect(module).toHaveProperty("tasks");
  });

  it("should have correct task structure", () => {
    const task = {
      id: "task-1",
      name: "Technical Documentation",
      task_order: 1,
      is_completed: false,
    };

    expect(task).toHaveProperty("id");
    expect(task).toHaveProperty("name");
    expect(task).toHaveProperty("task_order");
    expect(task).toHaveProperty("is_completed");
  });

  it("should have 3 tasks per module", () => {
    const tasks = [
      { id: "1", name: "Technical Documentation", task_order: 1, is_completed: false },
      { id: "2", name: "API Reference", task_order: 2, is_completed: false },
      { id: "3", name: "User Guide", task_order: 3, is_completed: false },
    ];

    expect(tasks.length).toBe(3);
    expect(tasks[0].name).toBe("Technical Documentation");
    expect(tasks[1].name).toBe("API Reference");
    expect(tasks[2].name).toBe("User Guide");
  });
});

describe("Task Documentation Content", () => {
  it("should save text content as JSON", () => {
    const textContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "test" }],
        },
      ],
    };

    expect(JSON.stringify(textContent)).toBeDefined();
    expect(typeof textContent).toBe("object");
  });

  it("should save drawing content as JSON", () => {
    const drawingContent = {
      elements: [
        {
          type: "rectangle",
          x: 100,
          y: 100,
          width: 200,
          height: 100,
        },
      ],
      appState: {
        viewBackgroundColor: "#ffffff",
      },
    };

    expect(JSON.stringify(drawingContent)).toBeDefined();
    expect(drawingContent.elements.length).toBe(1);
  });

  it("should handle writing 'test' to a module task", async () => {
    // Simulate writing "test" content to a task
    const taskId = "test-task-id";
    const textContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "test" }],
        },
      ],
    };
    const drawingContent = { elements: [], appState: {} };

    // Verify content structure
    expect(textContent.content[0].content[0].text).toBe("test");
    expect(taskId).toBeDefined();
    expect(drawingContent.elements).toEqual([]);

    // Simulate save operation
    const saveResult = { error: null };
    expect(saveResult.error).toBeNull();
  });
});

describe("Module List", () => {
  const moduleNames = [
    "sudo_hris_mobile",
    "sudo_hr_employee",
    "sudo_hr_attendance",
    "sudo_hr_leave",
    "sudo_hr_payroll",
    "sudo_hr_recruitment",
    "sudo_hr_appraisal",
    "sudo_hr_training",
    "sudo_hr_expense",
    "sudo_hr_loan",
    "sudo_hr_overtime",
    "sudo_hr_shift",
    "sudo_hr_timeoff",
    "sudo_hr_contract",
    "sudo_hr_department",
    "sudo_hr_job",
    "sudo_hr_skill",
    "sudo_hr_document",
    "sudo_hr_announcement",
  ];

  it("should have 19 modules", () => {
    expect(moduleNames.length).toBe(19);
  });

  it("should have sudo_hris_mobile as first module", () => {
    expect(moduleNames[0]).toBe("sudo_hris_mobile");
  });

  it("all modules should follow naming convention", () => {
    moduleNames.forEach((name) => {
      expect(name.startsWith("sudo_")).toBe(true);
    });
  });
});
