"use client";

import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";

export function NotionNodeView({ node, updateAttributes }: any) {
  return (
    <NodeViewWrapper className="notion-node" draggable="true">
      <NodeViewContent className="notion-node-content" />
    </NodeViewWrapper>
  );
}