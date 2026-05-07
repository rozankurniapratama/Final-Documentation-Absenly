// In your TiptapEditor component, fix the content initialization:
const editor = useEditor({
  extensions: [
    StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
    Placeholder.configure({ placeholder: "Start writing your documentation here..." }),
  ],
  // ✅ Ensure valid empty JSON structure for Tiptap
  content: initialContent && Object.keys(initialContent).length > 0
    ? initialContent
    : { type: "doc", content: [] },
  editorProps: {
    attributes: {
      class: "prose prose-sm sm:prose lg:prose-lg max-w-none p-6 min-h-full focus:outline-none",
    },
  },
  onUpdate: ({ editor }) => {
    onChange(editor.getJSON());
  },
  // ✅ Prevent editor re-creation on parent re-renders
  immediatelyRender: false,
});