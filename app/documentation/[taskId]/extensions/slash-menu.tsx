"use client";

import { Extension } from "@tiptap/react";
import { Plugin, PluginKey } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { ReactRenderer } from "@tiptap/react";
import tippy from "tippy.js";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  Minus,
  Image as ImageIcon,
  Table,
  ToggleLeft,
} from "lucide-react";

interface SlashMenuProps {
  editor: any;
  onClose: () => void;
}

function SlashMenuContent({ editor, onClose }: SlashMenuProps) {
  const items = [
    {
      title: "Heading 1",
      icon: Heading1,
      desc: "Large section heading",
      command: () => {
        editor.chain().focus().toggleHeading({ level: 1 }).run();
        onClose();
      },
    },
    {
      title: "Heading 2",
      icon: Heading2,
      desc: "Medium section heading",
      command: () => {
        editor.chain().focus().toggleHeading({ level: 2 }).run();
        onClose();
      },
    },
    {
      title: "Heading 3",
      icon: Heading3,
      desc: "Small section heading",
      command: () => {
        editor.chain().focus().toggleHeading({ level: 3 }).run();
        onClose();
      },
    },
    {
      title: "Bullet List",
      icon: List,
      desc: "Create a simple bullet list",
      command: () => {
        editor.chain().focus().toggleBulletList().run();
        onClose();
      },
    },
    {
      title: "Numbered List",
      icon: ListOrdered,
      desc: "Create a numbered list",
      command: () => {
        editor.chain().focus().toggleOrderedList().run();
        onClose();
      },
    },
    {
      title: "Task List",
      icon: CheckSquare,
      desc: "Track tasks with checkboxes",
      command: () => {
        editor.chain().focus().toggleTaskList().run();
        onClose();
      },
    },
    {
      title: "Quote",
      icon: Quote,
      desc: "Capture a quote",
      command: () => {
        editor.chain().focus().toggleBlockquote().run();
        onClose();
      },
    },
    {
      title: "Code Block",
      icon: Code,
      desc: "Add code with syntax highlighting",
      command: () => {
        editor.chain().focus().toggleCodeBlock().run();
        onClose();
      },
    },
    {
      title: "Divider",
      icon: Minus,
      desc: "Add a horizontal rule",
      command: () => {
        editor.chain().focus().setHorizontalRule().run();
        onClose();
      },
    },
  ];

  return (
    <div className="slash-menu">
      {items.map((item, index) => (
        <div
          key={item.title}
          className="slash-menu-item"
          onClick={item.command}
          data-index={index}
        >
          <item.icon className="slash-menu-item-icon" />
          <div className="flex-1">
            <div className="slash-menu-item-title">{item.title}</div>
            <div className="slash-menu-item-desc">{item.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export const SlashMenu = Extension.create({
  name: "slashMenu",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        command: ({ editor, range, props }: any) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    let popup: any;

    const createSlashMenu = (view: EditorView, props: any) => {
      const editor = this.editor;

      const component = new ReactRenderer(SlashMenuContent, {
        props: {
          editor,
          onClose: () => popup?.[0]?.hide(),
        },
        editor,
      });

      popup = tippy("body", {
        getReferenceClientRect: () => ({
          width: 0,
          height: 0,
          top: view.coordsAtPos(view.state.selection.from).top,
          bottom: view.coordsAtPos(view.state.selection.from).top,
          left: view.coordsAtPos(view.state.selection.from).left,
          right: view.coordsAtPos(view.state.selection.from).left,
        }),
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: "manual",
        placement: "bottom-start",
        appendTo: () => document.body,
        theme: "slash-menu",
      });

      return component;
    };

    return [
      new Plugin({
        key: new PluginKey("slashMenu"),
        props: {
          handleKeyDown: (view, event) => {
            if (event.key === "Escape") {
              popup?.[0]?.hide();
              return true;
            }
            return false;
          },
        },
        view: (view) => {
          let component: any;

          return {
            update: (view, prevState) => {
              const { from, to } = view.state.selection;
              const textFrom = view.state.doc.textBetween(
                Math.max(0, from - 1),
                from,
                "\n"
              );

              // Show menu when "/" is typed at start of line
              if (textFrom === "/" && from === to) {
                if (!popup?.[0]?.state?.isShown) {
                  component = createSlashMenu(view, {});
                  popup?.[0]?.show();
                }
              } else if (popup?.[0]?.state?.isShown) {
                popup?.[0]?.hide();
                component?.destroy();
              }
            },
            destroy: () => {
              popup?.[0]?.destroy();
              component?.destroy();
            },
          };
        },
      }),
    ];
  },
});