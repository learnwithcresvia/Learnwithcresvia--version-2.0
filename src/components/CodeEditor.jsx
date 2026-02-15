import { Editor } from '@monaco-editor/react';

export default function CodeEditor({ value, onChange, language = 'python' }) {
  
  const languageMap = {
    python: 'python',
    javascript: 'javascript',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
  };

  const editorLanguage = languageMap[language] || 'python';

  return (
    <div className="code-editor-wrapper">
      <div className="editor-header">
        <span className="editor-language">📝 {language.toUpperCase()}</span>
      </div>
      <Editor
        height="500px"
        language={editorLanguage}
        value={value}
        onChange={onChange}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          roundedSelection: false,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 4,
          wordWrap: 'on',
        }}
      />
    </div>
  );
}
