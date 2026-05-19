// app/documentation/[taskId]/editor/DocumentationPDF.tsx
'use client';

import React from 'react';

interface DocumentationPDFProps {
  taskId: string;
  taskName: string;
  moduleName: string;
  content: string | null;
  generatedAt?: string;
}

export default function DocumentationPDF({
  taskId,
  taskName,
  moduleName,
  content,
  generatedAt = new Date().toISOString(),
}: DocumentationPDFProps) {
  // Parse content into sections for professional structure
  const sections = React.useMemo(() => {
    if (!content) return [];

    // Simple markdown-like parsing: split by ## for sections
    return content.split(/^##\s+/m).filter(Boolean).map((section, idx) => {
      const [title, ...body] = section.split('\n');
      return {
        id: `section-${idx}`,
        title: title?.trim() || `Section ${idx + 1}`,
        body: body.join('\n').trim(),
      };
    });
  }, [content]);

  return (
    <div
      id="pdf-document"
      className="pdf-document"
      style={{
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '11pt',
        lineHeight: '1.6',
        color: '#1a1a1a',
        maxWidth: '210mm',
        margin: '0 auto',
        padding: '15mm',
        backgroundColor: '#fff',
      }}
    >
      {/* Header / Title Page */}
      <header style={{
        borderBottom: '2px solid #2563eb',
        paddingBottom: '12pt',
        marginBottom: '20pt',
        pageBreakAfter: 'avoid'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{
              margin: '0 0 4pt 0',
              fontSize: '18pt',
              fontWeight: 'bold',
              color: '#1e293b'
            }}>
              {taskName}
            </h1>
            <p style={{ margin: '2pt 0', fontSize: '10pt', color: '#64748b' }}>
              Module: <strong>{moduleName}</strong>
            </p>
            <p style={{ margin: '2pt 0', fontSize: '9pt', color: '#94a3b8' }}>
              Task ID: {taskId}
            </p>
          </div>
          <div style={{ textAlign: 'right', fontSize: '9pt', color: '#64748b' }}>
            <p style={{ margin: '2pt 0' }}>Generated</p>
            <p style={{ margin: '2pt 0', fontWeight: '500' }}>
              {new Date(generatedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>
      </header>

      {/* Table of Contents */}
      {sections.length > 0 && (
        <nav style={{
          marginBottom: '24pt',
          padding: '10pt',
          backgroundColor: '#f8fafc',
          borderRadius: '4px',
          pageBreakAfter: 'avoid'
        }}>
          <h2 style={{
            margin: '0 0 8pt 0',
            fontSize: '12pt',
            fontWeight: 'bold',
            color: '#1e293b',
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: '4pt'
          }}>
            Table of Contents
          </h2>
          <ol style={{ margin: 0, paddingLeft: '18pt', fontSize: '10pt' }}>
            {sections.map((section, idx) => (
              <li key={section.id} style={{ margin: '3pt 0' }}>
                <a
                  href={`#${section.id}`}
                  style={{
                    color: '#2563eb',
                    textDecoration: 'none',
                    fontWeight: '500'
                  }}
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      {/* Main Content */}
      <main>
        {sections.length > 0 ? (
          sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              style={{
                marginBottom: '18pt',
                pageBreakInside: 'avoid'
              }}
            >
              <h2 style={{
                margin: '0 0 8pt 0',
                fontSize: '13pt',
                fontWeight: 'bold',
                color: '#1e293b',
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: '4pt'
              }}>
                {section.title}
              </h2>
              <div
                style={{
                  fontSize: '11pt',
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word'
                }}
                dangerouslySetInnerHTML={{
                  __html: section.body
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                    .replace(/`(.*?)`/g, '<code style="background:#f1f5f9;padding:2px 4px;border-radius:3px;font-family:monospace;font-size:10pt">$1</code>')
                    .replace(/\n{2,}/g, '</p><p style="margin:8pt 0">')
                    .replace(/\n/g, '<br/>')
                }}
              />
            </section>
          ))
        ) : (
          <p style={{
            fontStyle: 'italic',
            color: '#64748b',
            textAlign: 'center',
            padding: '40pt 0'
          }}>
            No documentation content available for this task.
          </p>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        marginTop: '30pt',
        paddingTop: '12pt',
        borderTop: '1px solid #e2e8f0',
        fontSize: '9pt',
        color: '#94a3b8',
        textAlign: 'center',
        pageBreakBefore: 'avoid'
      }}>
        <p style={{ margin: '4pt 0' }}>
          Task Documentation Export • {moduleName} • {taskId}
        </p>
        <p style={{ margin: '2pt 0', fontSize: '8pt' }}>
          Generated via Task Management System • Confidential
        </p>
      </footer>
    </div>
  );
}