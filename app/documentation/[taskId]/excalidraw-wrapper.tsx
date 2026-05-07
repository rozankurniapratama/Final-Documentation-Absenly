"use client";

import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useCallback, useState, useRef, useEffect } from "react";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

interface ExcalidrawWrapperProps {
  initialData: {
    elements?: readonly ExcalidrawElement[];
    appState?: Partial<AppState>;
  } | null;
  onChange: (elements: object, appState: object) => void;
}

export default function ExcalidrawWrapper({
  initialData,
  onChange,
}: ExcalidrawWrapperProps) {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const hasInitialized = useRef(false);

  // Set initial data once the API is available
  useEffect(() => {
    if (excalidrawAPI && initialData && !hasInitialized.current) {
      hasInitialized.current = true;
      if (initialData.elements && Array.isArray(initialData.elements)) {
        excalidrawAPI.updateScene({
          elements: initialData.elements as ExcalidrawElement[],
        });
      }
    }
  }, [excalidrawAPI, initialData]);

  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState) => {
      // Only track essential app state to reduce storage size
      const essentialAppState = {
        viewBackgroundColor: appState.viewBackgroundColor,
        currentItemStrokeColor: appState.currentItemStrokeColor,
        currentItemBackgroundColor: appState.currentItemBackgroundColor,
        currentItemFillStyle: appState.currentItemFillStyle,
        currentItemStrokeWidth: appState.currentItemStrokeWidth,
        currentItemRoughness: appState.currentItemRoughness,
        zoom: appState.zoom,
        scrollX: appState.scrollX,
        scrollY: appState.scrollY,
      };
      onChange([...elements], essentialAppState);
    },
    [onChange]
  );

  return (
    <div className="flex-1 bg-white" style={{ height: "100%" }}>
      <Excalidraw
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        onChange={handleChange}
        initialData={{
          elements: (initialData?.elements as ExcalidrawElement[]) || [],
          appState: {
            viewBackgroundColor: "#ffffff",
            ...initialData?.appState,
          },
        }}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            export: false,
            saveAsImage: true,
          },
        }}
        theme="light"
      />
    </div>
  );
}
