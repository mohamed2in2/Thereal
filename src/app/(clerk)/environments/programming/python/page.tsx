"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Navbar } from "@/components/ui/Navbar";
import { Footer } from "@/components/ui/Footer";
import { ProfileGuard } from "@/components/auth/ProfileGuard";
import { fetchMeWithRetry, type MeUser } from "@/lib/fetch-me";

const DEFAULT_CODE = `# اكتب كود Python هنا
print("مرحباً بالعالم!")

numbers = [1, 2, 3, 4, 5]
doubled = [n * 2 for n in numbers]
print("الأرقام مضاعفة:", doubled)

# جرب كتابة كودك الخاص
`;

export default function PythonEditorPage() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [code, setCode] = useState(DEFAULT_CODE);
  const [output, setOutput] = useState<Array<{ type: "log" | "error"; message: string }>>([]);
  const [isRunning, setIsRunning] = useState(false);
  const consoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [output]);

  useEffect(() => {
    fetchMeWithRetry(2, 100).then(me => setUser(me)).catch(() => {});
  }, []);

  const runCode = () => {
    setIsRunning(true);
    setOutput([]);

    try {
      // Use Pyodide to run Python in the browser
      // For now, we'll simulate with a basic interpreter
      // In production, you'd load Pyodide from CDN
      
      // Simple Python-like interpreter for demo
      const lines = code.split('\n');
      const logs: Array<{ type: "log" | "error"; message: string }> = [];
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        if (trimmed.startsWith('print(')) {
          const match = trimmed.match(/print\((.*)\)/);
          if (match) {
            let content = match[1].replace(/['"]/g, '');
            // Handle simple variable references
            if (content.includes(':')) {
              content = content.split(':').map(s => s.trim()).join(' ');
            }
            logs.push({ type: "log", message: content });
          }
        } else if (trimmed.includes('=')) {
          // Variable assignment - just log it
          logs.push({ type: "log", message: `تم تعيين المتغير: ${trimmed}` });
        } else if (trimmed.startsWith('for ') || trimmed.startsWith('if ')) {
          logs.push({ type: "log", message: `تنفيذ: ${trimmed}` });
        }
      }
      
      setOutput(logs);
    } catch (error) {
      setOutput([{ type: "error", message: error instanceof Error ? error.message : String(error) }]);
    } finally {
      setIsRunning(false);
    }
  };

  const clearConsole = () => {
    setCode(DEFAULT_CODE);
    setOutput([]);
  };

  return (
    <ProfileGuard>
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950">
        <Navbar user={user ? { name: user.name, role: user.role } : null} />
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <motion.div
            className="mb-6"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Link
              href="/environments/programming"
              className="inline-flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              العودة للبرمجة
            </Link>
            <div className="flex items-center gap-3">
              <div className="text-4xl">🐍</div>
              <div>
                <h1 className="text-3xl font-black text-gray-900 dark:text-white">Python Editor</h1>
                <p className="text-gray-500 dark:text-gray-400">اكتب وشغّل كود Python مباشرة</p>
              </div>
            </div>
          </motion.div>

          {/* Editor and Console */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Code Editor */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
                {/* Editor Header */}
                <div className="bg-gradient-to-r from-blue-400 to-green-500 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full" />
                    <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                    <div className="w-3 h-3 bg-green-500 rounded-full" />
                  </div>
                  <span className="text-white font-medium text-sm">script.py</span>
                </div>

                {/* Editor Area */}
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full h-[500px] p-4 font-mono text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-none focus:outline-none"
                  placeholder="اكتب كود Python هنا..."
                  spellCheck={false}
                  dir="ltr"
                />

                {/* Action Buttons */}
                <div className="px-4 py-3 bg-gray-100 dark:bg-gray-700 flex gap-3">
                  <motion.button
                    onClick={runCode}
                    disabled={isRunning}
                    className="flex-1 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isRunning ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        جاري التشغيل...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        تشغيل الكود
                      </>
                    )}
                  </motion.button>
                  <motion.button
                    onClick={clearConsole}
                    className="px-4 py-2.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-xl hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    مسح
                  </motion.button>
                </div>
              </div>
            </motion.div>

            {/* Console Output */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700 h-[600px] flex flex-col">
                {/* Console Header */}
                <div className="bg-gradient-to-r from-gray-700 to-gray-800 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-white font-medium text-sm">Console</span>
                  </div>
                  <span className="text-gray-300 text-xs">{output.length} رسائل</span>
                </div>

                {/* Console Output */}
                <div
                  ref={consoleRef}
                  className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-2 bg-gray-50 dark:bg-gray-900"
                  dir="ltr"
                >
                  {output.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                      <div className="text-4xl mb-2">💻</div>
                      <p>اضغط &quot;تشغيل الكود&quot; لرؤية النتائج هنا</p>
                    </div>
                  ) : (
                    output.map((item, index) => (
                      <div
                        key={index}
                        className={`p-2 rounded-lg ${
                          item.type === "error"
                            ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800"
                            : "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                        }`}
                      >
                        <pre className="whitespace-pre-wrap break-words">{item.message}</pre>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </main>
        <Footer />
      </div>
    </ProfileGuard>
  );
}
