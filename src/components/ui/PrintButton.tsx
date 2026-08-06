"use client";

import { Download } from "lucide-react";

export function PrintButton() {
  return (
    <button 
      onClick={() => window.print()}
      className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-500/20 font-bold print:hidden"
    >
      <Download className="w-5 h-5" />
      تحميل التقرير الشامل (PDF)
    </button>
  );
}
