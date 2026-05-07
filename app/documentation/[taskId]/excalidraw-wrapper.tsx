"use client";

import { Excalidraw } from "@excalidraw/excalidraw";
// ✅ CRITICAL: Import Excalidraw CSS to prevent rendering errors
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
  // Track last sent data to prevent unnecessary onChange calls
  const lastSentRef = useRef<{ elements: string; appState: string } | null>(null);

  // Set initial data once the API is available
  useEffect(() => {
    if (excalidrawAPI && initialData?.elements && !hasInitialized.current) {
      hasInitialized.current = true;
      excalidrawAPI.updateScene({
        elements: initialData.elements as ExcalidrawElement[],
        appState: initialData.appState,
      });
    }
  }, [excalidrawAPI, initialData]);

  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState) => {
      // Serialize to compare changes and prevent infinite loops
      const elementsStr = JSON.stringify(elements);
      const appStateStr = JSON.stringify({
        viewBackgroundColor: appState.viewBackgroundColor,
        zoom: appState.zoom,
        scrollX: appState.scrollX,
        scrollY: appState.scrollY,
      });

      // Skip if data hasn't meaningfully changed
      if (
        lastSentRef.current?.elements === elementsStr &&
        lastSentRef.current?.appState === appStateStr
      ) {
        return;
      }

      lastSentRef.current = { elements: elementsStr, appState: appStateStr };

      // Send minimal essential state to reduce storage size
      const essentialAppState = {
        viewBackgroundColor: appState.viewBackgroundColor,
        zoom: appState.zoom,
        scrollX: appState.scrollX,
        scrollY: appState.scrollY,
      };

      onChange(elements as unknown as object, essentialAppState);
    },
    [onChange]
  );

  return (
    <div className="w-full h-full min-h-[500px] bg-white">
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