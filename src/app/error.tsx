'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            ⚠️
          </h1>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            حدث خطأ
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            عذراً، حدث خطأ غير متوقع
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
            {error.message || 'Please try again later'}
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={reset}
            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            جرب مجددًا
          </button>
          <Link
            href="/"
            className="w-full flex justify-center py-2.5 px-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            العودة للصفحة الرئيسية
          </Link>
        </div>

        {error.digest && (
          <details className="text-left">
            <summary className="cursor-pointer text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
              معلومات تقنية
            </summary>
            <code className="block mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-700 dark:text-gray-300 overflow-auto max-h-40">
              {error.digest}
            </code>
          </details>
        )}
      </div>
    </div>
  );
}
