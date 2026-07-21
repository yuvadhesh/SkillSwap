import React, { useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { API_URL } from '../../config';
import { Play, RotateCcw, ChevronDown, Terminal, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

const SUPPORTED_LANGUAGES = [
  { label: 'Python', value: 'python', monacoLang: 'python', version: '*', defaultCode: 'def solution():\n    # Write your code here\n    pass\n\nprint(solution())' },
  { label: 'JavaScript', value: 'javascript', monacoLang: 'javascript', version: '*', defaultCode: '// Write your JavaScript code here\nfunction solution() {\n    // Your code\n    return null;\n}\n\nconsole.log(solution());' },
  { label: 'C++', value: 'cpp', monacoLang: 'cpp', version: '*', defaultCode: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your C++ code here\n    cout << "Hello World" << endl;\n    return 0;\n}' },
  { label: 'Java', value: 'java', monacoLang: 'java', version: '*', defaultCode: 'public class Main {\n    public static void main(String[] args) {\n        // Write your Java code here\n        System.out.println("Hello World");\n    }\n}' },
  { label: 'C', value: 'c', monacoLang: 'c', version: '*', defaultCode: '#include <stdio.h>\n\nint main() {\n    // Write your C code here\n    printf("Hello World\\n");\n    return 0;\n}' },
  { label: 'Ruby', value: 'ruby', monacoLang: 'ruby', version: '*', defaultCode: '# Write your Ruby code here\ndef solution\n  # Your code\nend\n\nputs solution' },
  { label: 'Go', value: 'go', monacoLang: 'go', version: '*', defaultCode: 'package main\n\nimport "fmt"\n\nfunc main() {\n    // Write your Go code here\n    fmt.Println("Hello World")\n}' },
  { label: 'Rust', value: 'rust', monacoLang: 'rust', version: '*', defaultCode: 'fn main() {\n    // Write your Rust code here\n    println!("Hello World");\n}' },
];

interface CodingIDEProps {
  question: any;
  value: string;
  onChange: (code: string) => void;
}

interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  ran: boolean;
  isTestRun?: boolean;
  testResults?: { passed: boolean; input: string; expected: string; actual: string; }[];
}

// Get correct filename for each language (Java needs class name to match file name)
const getFileName = (langValue: string, code: string): string => {
  if (langValue === 'java') {
    const match = code.match(/public\s+class\s+(\w+)/);
    return match ? `${match[1]}.java` : 'Main.java';
  }
  const extMap: Record<string, string> = {
    python: 'main.py', javascript: 'main.js', cpp: 'main.cpp',
    c: 'main.c', ruby: 'main.rb', go: 'main.go', rust: 'main.rs',
  };
  return extMap[langValue] || 'main.txt';
};

export default function CodingIDE({ question, value, onChange }: CodingIDEProps) {
  const [selectedLang, setSelectedLang] = useState(SUPPORTED_LANGUAGES[0]);
  const [code, setCode] = useState(value || selectedLang.defaultCode);
  const [stdin, setStdin] = useState('');
  const [showStdin, setShowStdin] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const editorRef = useRef<any>(null);

  const handleLangChange = (lang: typeof SUPPORTED_LANGUAGES[0]) => {
    setSelectedLang(lang);
    const newCode = lang.defaultCode;
    setCode(newCode);
    onChange(newCode);
    setResult(null);
    setShowLangDropdown(false);
  };

  const handleCodeChange = (val: string | undefined) => {
    const newCode = val || '';
    setCode(newCode);
    onChange(newCode);
  };

  const runCode = async () => {
    if (!code.trim()) return;
    setRunning(true);
    setResult(null);

    try {
      // Check if we have test cases
      const testCases = (question?.type === 'Coding' && question?.correctAnswers && question.correctAnswers.length > 0)
        ? question.correctAnswers.map((tcStr: string) => { try { return JSON.parse(tcStr); } catch { return null; } }).filter((tc: any) => tc !== null)
        : null;

      if (testCases && testCases.length > 0) {
        // Run tests
        let allPassed = true;
        const results: { passed: boolean; input: string; expected: string; actual: string }[] = [];
        let combinedStdout = '';
        let lastStderr = '';

        for (const tc of testCases) {
          let res;
          try {
            res = await fetch(`${API_URL}/api/execute`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                language: selectedLang.value,
                version: '*',
                files: [{ name: getFileName(selectedLang.value, code), content: code }],
                stdin: tc.input || '',
                run_timeout: 5000,
              }),
            });
          } catch (e) {
            console.warn('[CodingIDE] Backend test execution failed, using fallback...');
            const fallbackUrl = 'https://corsproxy.io/?' + encodeURIComponent('https://piston.pylex.me/api/v2/execute');
            res = await fetch(fallbackUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                language: selectedLang.value,
                version: '*',
                files: [{ name: getFileName(selectedLang.value, code), content: code }],
                stdin: tc.input || '',
                run_timeout: 5000,
              }),
            });
          }
          const data = await res.json();
          const actualOutput = data.run?.output ?? data.run?.stdout ?? data.compile?.output ?? '';
          const compileErr = data.compile?.stderr || '';
          const runErr = data.run?.stderr || '';
          const apiMessage = data.message || '';
          const passed = !compileErr && !runErr && !apiMessage && actualOutput.trim() === tc.output.trim();
          if (!passed) allPassed = false;
          
          results.push({
            passed,
            input: tc.input,
            expected: tc.output,
            actual: apiMessage || actualOutput || compileErr || runErr || 'No output'
          });

          combinedStdout += `--- Test Case ---\nInput: ${tc.input}\nOutput: ${actualOutput}\n\n`;
          if (data.run?.stderr || data.compile?.stderr) lastStderr = data.run?.stderr || data.compile?.stderr;
        }

        setResult({
          stdout: combinedStdout,
          stderr: allPassed ? '' : lastStderr,
          exitCode: allPassed ? 0 : 1,
          ran: true,
          isTestRun: true,
          testResults: results
        });

        // Notify parent if all tests passed
        if (allPassed) {
          onChange('PASSED_ALL_TESTS');
        } else {
          onChange('');
        }
      } else {
        // Normal Run
        const res = await fetch(`${API_URL}/api/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            language: selectedLang.value,
            version: selectedLang.version,
            files: [{ name: getFileName(selectedLang.value, code), content: code }],
            stdin: stdin,
            run_timeout: 10000,
          }),
        });

        const data = await res.json();
        console.log('[CodingIDE] Piston Response:', JSON.stringify(data, null, 2));

        // Extract output - Piston v2 uses data.run.stdout or data.run.output
        const runOutput = data?.run?.output !== undefined ? data.run.output : (data?.run?.stdout ?? '');
        const compileError = data?.compile?.stderr || '';
        const runError = data?.run?.stderr || '';
        const combinedStderr = compileError || runError;

        setResult({
          stdout: runOutput,
          stderr: combinedStderr,
          exitCode: data?.run?.code ?? data?.compile?.code ?? 0,
          ran: true,
        });
      }
    } catch (err: any) {
      console.error('[CodingIDE] Backend execution failed, trying fallback...', err);
      try {
        // Fallback to public API via CORS proxy if backend is unreachable
        const fallbackUrl = 'https://corsproxy.io/?' + encodeURIComponent('https://piston.pylex.me/api/v2/execute');
        const fallbackRes = await fetch(fallbackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            language: selectedLang.value,
            version: '*',
            files: [{ name: getFileName(selectedLang.value, code), content: code }],
            stdin: stdin || '',
            run_timeout: 5000,
          }),
        });
        const fallbackData = await fallbackRes.json();
        
        const runOutput = fallbackData?.run?.output !== undefined ? fallbackData.run.output : (fallbackData?.run?.stdout ?? '');
        const compileError = fallbackData?.compile?.stderr || '';
        const runError = fallbackData?.run?.stderr || '';
        
        setResult({
          stdout: runOutput,
          stderr: compileError || runError || (fallbackData.message ? `API Error: ${fallbackData.message}` : ''),
          exitCode: fallbackData?.run?.code ?? fallbackData?.compile?.code ?? 0,
          ran: true,
        });
      } catch (fallbackErr: any) {
        setResult({
          stdout: '',
          stderr: `Execution Error: ${err.message || 'Unknown error'}\nFallback Error: ${fallbackErr.message}`,
          exitCode: 1,
          ran: true,
        });
      }
    } finally {
      setRunning(false);
    }
  };

  const resetCode = () => {
    setCode(selectedLang.defaultCode);
    onChange(selectedLang.defaultCode);
    setResult(null);
  };

  const hasError = result && (
    result.isTestRun
      ? result.testResults?.some(tr => !tr.passed)
      : !!result.stderr
  );

  return (
    <div className="flex flex-col gap-0 border border-white/10 rounded-2xl overflow-hidden bg-[#1e1e1e]">
      {/* IDE Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#2d2d2d] border-b border-white/10 flex-wrap gap-2">
        {/* Language Selector */}
        <div className="relative">
          <button
            onClick={() => setShowLangDropdown(!showLangDropdown)}
            className="flex items-center gap-2 bg-[#3a3a3a] border border-white/10 text-gray-200 px-3 py-1.5 rounded-lg cursor-pointer text-sm font-semibold"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            {selectedLang.label}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {showLangDropdown && (
            <div className="absolute top-full left-0 z-50 bg-[#2d2d2d] border border-white/10 rounded-lg mt-1 min-w-[160px] shadow-2xl overflow-hidden">
              {SUPPORTED_LANGUAGES.map(lang => (
                <button
                  key={lang.value}
                  onClick={() => handleLangChange(lang)}
                  className={`block w-full text-left px-3.5 py-2 cursor-pointer text-sm font-medium transition-colors ${lang.value === selectedLang.value
                    ? 'bg-emerald-500/20 text-emerald-450'
                    : 'text-gray-300 hover:bg-white/5'
                    }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setShowStdin(!showStdin)}
            className="bg-[#3a3a3a] border border-white/10 text-gray-400 px-3 py-1.5 rounded-lg cursor-pointer text-xs font-medium"
          >
            {showStdin ? 'Hide' : 'Input (stdin)'}
          </button>
          <button
            onClick={resetCode}
            className="bg-[#3a3a3a] border border-white/10 text-gray-400 p-1.5 rounded-lg cursor-pointer flex items-center justify-center"
            title="Reset to default"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={runCode}
            disabled={running}
            className={`border-none text-white px-4 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5 text-sm font-bold transition-all ${running
              ? 'bg-emerald-800 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-600/20'
              }`}
          >
            {running
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Running...</>
              : <><Play className="w-3.5 h-3.5" /> {question?.correctAnswers?.length > 0 ? 'Run Tests' : 'Run Code'}</>
            }
          </button>
        </div>
      </div>

      {/* stdin Input */}
      {showStdin && (
        <div className="px-4 py-2.5 bg-[#252525] border-b border-white/10">
          <p className="text-gray-400 text-[11px] mb-1.5 font-semibold uppercase tracking-wider">
            Standard Input (stdin)
          </p>
          <textarea
            value={stdin}
            onChange={e => setStdin(e.target.value)}
            placeholder="Enter input for your program..."
            className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg p-2 text-gray-250 font-mono text-sm h-16 resize-none outline-none focus:border-emerald-500"
          />
        </div>
      )}

      {/* Monaco Editor */}
      <div className="h-[380px]">
        <Editor
          height="100%"
          language={selectedLang.monacoLang}
          value={code}
          onChange={handleCodeChange}
          onMount={(editor) => { editorRef.current = editor; }}
          theme="vs-dark"
          options={{
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: 'on' as const,
            glyphMargin: false,
            folding: true,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on' as const,
            renderLineHighlight: 'line' as const,
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            cursorBlinking: 'smooth' as const,
            cursorSmoothCaretAnimation: 'on' as const,
            padding: { top: 12, bottom: 12 },
          }}
        />
      </div>

      {/* Output Panel */}
      <div className="bg-[#0f0f0f] border-t border-white/10 min-h-[120px] max-h-[220px] overflow-auto">
        {/* Output header */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 bg-[#151515]">
          <Terminal className="w-3.5 h-3.5 text-gray-450" />
          <span className="text-gray-450 text-xs font-semibold uppercase tracking-wider">
            Output
          </span>
          {result && (
            <span className={`ml-auto flex items-center gap-1 text-[11px] font-bold ${hasError ? 'text-red-400' : 'text-emerald-400'}`}>
              {hasError
                ? <><XCircle className="w-3 h-3" /> Error</>
                : <><CheckCircle2 className="w-3 h-3" /> Success</>
              }
            </span>
          )}
        </div>

        {/* Output content */}
        <div className="px-4 py-3 font-mono text-sm leading-relaxed">
          {!result && !running && (
            <span className="text-gray-600">Click "{question?.correctAnswers?.length > 0 ? 'Run Tests' : 'Run Code'}" to execute your program and see output here.</span>
          )}
          {running && (
            <span className="text-gray-400 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Executing code on Piston Runtime...
            </span>
          )}

          {result?.isTestRun && result.testResults && (
            <div className="mb-4 flex flex-col gap-2">
              {result.testResults.map((tr, idx) => (
                <div key={idx} className={`p-2.5 rounded-lg border text-sm ${tr.passed ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    {tr.passed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    Test Case {idx + 1}: {tr.passed ? 'Passed' : 'Failed'}
                  </div>
                  {!tr.passed && (
                    <div className="text-xs mt-1">
                      <div className="text-gray-400">Expected: <span className="text-gray-200">{tr.expected}</span></div>
                      <div className="text-gray-400">Actual: <span className="text-gray-200">{tr.actual}</span></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {result?.stdout && !result?.isTestRun && (
            <pre className="text-emerald-400 m-0 whitespace-pre-wrap break-all">
              {result.stdout}
            </pre>
          )}
          {result?.stderr && (
            <pre className={`text-red-400 m-0 whitespace-pre-wrap break-all ${result?.stdout && !result?.isTestRun ? 'mt-2' : ''}`}>
              {result.stderr}
            </pre>
          )}
          {result && !result.stdout && !result.stderr && !result.isTestRun && (
            <span className="text-gray-400">Program exited with code {result.exitCode}. No output.</span>
          )}
        </div>
      </div>
    </div>
  );
}
