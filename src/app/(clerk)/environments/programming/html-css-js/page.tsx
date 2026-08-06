"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Navbar } from "@/components/ui/Navbar";
import { Footer } from "@/components/ui/Footer";
import { ProfileGuard } from "@/components/auth/ProfileGuard";
import { fetchMeWithRetry, type MeUser } from "@/lib/fetch-me";

const DEFAULT_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>صفحتي</title>
</head>
<body>
  <h1>مرحباً بالعالم!</h1>
  <p>هذه صفحة تجريبية</p>
  <button id="myButton">اضغط هنا</button>
</body>
</html>`;

const DEFAULT_CSS = `body {
  font-family: Arial, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  padding: 20px;
}

h1 {
  font-size: 3rem;
  margin-bottom: 1rem;
}

p {
  font-size: 1.2rem;
  margin-bottom: 2rem;
}

#myButton {
  padding: 15px 30px;
  font-size: 1.1rem;
  background: white;
  color: #667eea;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: transform 0.2s;
}

#myButton:hover {
  transform: scale(1.05);
}`;

const DEFAULT_JS = `const button = document.getElementById('myButton');
button.addEventListener('click', () => {
  alert('تم النقر على الزر!');
  console.log('تم النقر على الزر!');
});

console.log('تم تحميل الصفحة بنجاح!');`;

export default function HTMLEditorPage() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [html, setHtml] = useState(DEFAULT_HTML);
  const [css, setCss] = useState(DEFAULT_CSS);
  const [js, setJs] = useState(DEFAULT_JS);
  const [output, setOutput] = useState<Array<{ type: "log" | "error"; message: string }>>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<"html" | "css" | "js">("html");
  const consoleRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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

    // Override console methods
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    const logs: Array<{ type: "log" | "error"; message: string }> = [];

    console.log = (...args: unknown[]) => {
      logs.push({ type: "log", message: args.map(a => formatOutput(a)).join(" ") });
      originalLog(...args);
    };

    console.error = (...args: unknown[]) => {
      logs.push({ type: "error", message: args.map(a => formatOutput(a)).join(" ") });
      originalError(...args);
    };

    console.warn = (...args: unknown[]) => {
      logs.push({ type: "log", message: args.map(a => formatOutput(a)).join(" ") });
      originalWarn(...args);
    };

    try {
      // Create the complete HTML document
      const fullHtml = html.replace('</body>', `
        <style>${css}</style>
        <script>
          try {
            ${js}
          } catch (error) {
            console.error(error);
          }
        <\/script>
      </body>`);

      // Update iframe
      if (iframeRef.current) {
        const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(fullHtml);
          doc.close();
        }
      }

      setOutput(logs);
    } catch (error) {
      setOutput([...logs, { type: "error", message: error instanceof Error ? error.message : String(error) }]);
    } finally {
      // Restore console methods
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      setIsRunning(false);
    }
  };

  const formatOutput = (value: unknown): string => {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof value === "object") {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value);
      }
    }
    return String(value);
  };

  const clearConsole = () => {
    setHtml(DEFAULT_HTML);
    setCss(DEFAULT_CSS);
    setJs(DEFAULT_JS);
    setOutput([]);
  };

  // Auto-run on mount
  useEffect(() => {
    const timer = setTimeout(() => runCode(), 100);
    return () => clearTimeout(timer);
  }, []);

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
              <div className="text-4xl">🌐</div>
              <div>
                <h1 className="text-3xl font-black text-gray-900 dark:text-white">HTML / CSS / JS Editor</h1>
                <p className="text-gray-500 dark:text-gray-400">أنشئ صفحات ويب كاملة مع معاينة حية</p>
              </div>
            </div>
          </motion.div>

          {/* Editor and Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Code Editors */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
                {/* Tabs */}
                <div className="flex border-b border-gray-200 dark:border-gray-700">
                  {[
                    { id: "html" as const, label: "HTML", color: "from-orange-400 to-red-500" },
                    { id: "css" as const, label: "CSS", color: "from-blue-400 to-blue-600" },
                    { id: "js" as const, label: "JavaScript", color: "from-yellow-400 to-amber-500" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 py-3 font-medium text-sm transition-colors ${
                        activeTab === tab.id
                          ? `bg-gradient-to-r ${tab.color} text-white`
                          : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Editor Area */}
                <div className="relative">
                  {activeTab === "html" && (
                    <textarea
                      value={html}
                      onChange={(e) => setHtml(e.target.value)}
                      className="w-full h-[300px] p-4 font-mono text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-none focus:outline-none"
                      placeholder="اكتب كود HTML هنا..."
                      spellCheck={false}
                      dir="ltr"
                    />
                  )}
                  {activeTab === "css" && (
                    <textarea
                      value={css}
                      onChange={(e) => setCss(e.target.value)}
                      className="w-full h-[300px] p-4 font-mono text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-none focus:outline-none"
                      placeholder="اكتب كود CSS هنا..."
                      spellCheck={false}
                      dir="ltr"
                    />
                  )}
                  {activeTab === "js" && (
                    <textarea
                      value={js}
                      onChange={(e) => setJs(e.target.value)}
                      className="w-full h-[300px] p-4 font-mono text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-none focus:outline-none"
                      placeholder="اكتب كود JavaScript هنا..."
                      spellCheck={false}
                      dir="ltr"
                    />
                  )}
                </div>

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
                        تشغيل
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

            {/* Preview and Console */}
            <div className="space-y-6">
              {/* Live Preview */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
                  <div className="bg-gradient-to-r from-gray-700 to-gray-800 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span className="text-white font-medium text-sm">Live Preview</span>
                    </div>
                  </div>
                  <div className="h-[300px] bg-white">
                    <iframe
                      ref={iframeRef}
                      title="Preview"
                      className="w-full h-full border-0"
                      sandbox="allow-scripts allow-same-origin"
                    />
                  </div>
                </div>
              </motion.div>

              {/* Console Output */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700 h-[250px] flex flex-col">
                  <div className="bg-gradient-to-r from-gray-700 to-gray-800 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-white font-medium text-sm">Console</span>
                    </div>
                    <span className="text-gray-300 text-xs">{output.length} رسائل</span>
                  </div>
                  <div
                    ref={consoleRef}
                    className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-2 bg-gray-50 dark:bg-gray-900"
                    dir="ltr"
                  >
                    {output.length === 0 ? (
                      <div className="text-center text-gray-400 py-8">
                        <div className="text-4xl mb-2">💻</div>
                        <p>لا توجد رسائل في الكونسول</p>
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
          </div>
        </main>
        <Footer />
      </div>
    </ProfileGuard>
  );
}
