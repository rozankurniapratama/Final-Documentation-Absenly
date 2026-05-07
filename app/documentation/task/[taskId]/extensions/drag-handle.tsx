"use client";

import { Extension } from "@tiptap/react";
import { NodeSelection, Plugin, PluginKey } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { ReactRenderer } from "@tiptap/react";
import tippy from "tippy.js";
import { GripVertical } from "lucide-react";

function DragHandleContent() {
  return (
    <div className="drag-handle" draggable="true">
      <GripVertical className="w-4 h-4" />
    </div>
  );
}

export const DragHandle = Extension.create({
  name: "dragHandle",

  addProseMirrorPlugins() {
    let popup: any;
    let component: any;

    const showDragHandle = (view: EditorView, pos: number) => {
      const editor = this.editor;

      // Destroy existing popup
      popup?.[0]?.destroy();
      component?.destroy();

      // Create drag handle component
      component = new ReactRenderer(DragHandleContent, {
        editor,
      });

      // Get position of the node
      const node = view.nodeDOM(pos) as HTMLElement;
      if (!node) return;

      // Show tippy popup
      popup = tippy(node, {
        content: component.element,
        trigger: "manual",
        placement: "left",
        showOnCreate: true,
        interactive: true,
        appendTo: () => view.dom.parentElement || document.body,
        offset: [0, 8],
        theme: "drag-handle",
      });

      popup[0].show();
    };

    return [
      new Plugin({
        key: new PluginKey("dragHandle"),
        props: {
          handleDOMEvents: {
            mousemove: (view, event) => {
              if (!view.editable) return false;

              const pos = view.posAtDOM(event.target as Node, 0);
              const $pos = view.state.doc.resolve(pos);

              // Only show for top-level blocks
              if ($pos.depth === 1) {
                showDragHandle(view, $pos.start());
              }
              return false;
            },
            mouseleave: () => {
              popup?.[0]?.hide();
              return false;
            },
          },
        },
        view: () => ({
          destroy: () => {
            popup?.[0]?.destroy();
            component?.destroy();
          },
        }),
      }),
    ];
  },
});