"use client";

import { useState, useMemo } from "react";
import {
  PAYMENT_CATEGORIES,
  PaymentMethodCategory,
  type PaymentMethodConfig,
} from "@/lib/payment-methods";
import { PaymentMethodCard } from "./PaymentMethodCard";

interface PaymentMethodGridProps {
  methods: readonly PaymentMethodConfig[];
  selectedId?: string | null;
  onSelect?: (m: PaymentMethodConfig) => void;
  onOpenDetails?: (m: PaymentMethodConfig) => void;
  showFilters?: boolean;
}

/**
 * Responsive, filterable grid of payment-method cards.
 * Provides category tabs (All, Wallets, InstaPay, Fawry, Cards, Balance) and live search,
 * making it effortless to navigate through many payment options.
 */
export function PaymentMethodGrid({
  methods,
  selectedId,
  onSelect,
  onOpenDetails,
  showFilters = true,
}: PaymentMethodGridProps) {
  const [activeCategory, setActiveCategory] = useState<PaymentMethodCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredMethods = useMemo(() => {
    let list = [...methods];

    if (activeCategory !== "all") {
      list = list.filter((m) => m.category === activeCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (m) =>
          m.label.toLowerCase().includes(q) ||
          m.labelEn.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q)
      );
    }

    return list;
  }, [methods, activeCategory, searchQuery]);

  return (
    <div dir="rtl" className="space-y-6">
      {/* Category Tabs & Search Header */}
      {showFilters && (
        <div className="space-y-3">
          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن وسيلة الدفع (فودافون كاش، إنستاباي، فوري، فيزا...)"
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pr-10 pl-4 text-sm font-medium text-gray-900 outline-none transition-colors focus:border-emerald-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:focus:border-emerald-400"
            />
            <svg
              className="absolute right-3.5 top-3 h-4 w-4 text-gray-400 dark:text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute left-3 top-2.5 text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                مسح
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                activeCategory === "all"
                  ? "bg-emerald-600 text-white shadow-md dark:bg-emerald-500"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
              }`}
            >
              الكل ({methods.length})
            </button>
            {PAYMENT_CATEGORIES.map((cat) => {
              const count = methods.filter((m) => m.category === cat.id).length;
              if (count === 0) return null;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                    activeCategory === cat.id
                      ? "bg-emerald-600 text-white shadow-md dark:bg-emerald-500"
                      : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
                  }`}
                >
                  {cat.label} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Grid of Payment Methods */}
      {filteredMethods.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {filteredMethods.map((m) => (
            <PaymentMethodCard
              key={m.id}
              method={m}
              selected={selectedId === m.id}
              onSelect={onSelect}
              onOpenDetails={onOpenDetails}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center dark:border-gray-800">
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
            لم يتم العثور على طريقة دفع تطابق بحثك.
          </p>
          <button
            type="button"
            onClick={() => {
              setActiveCategory("all");
              setSearchQuery("");
            }}
            className="mt-3 text-xs font-bold text-emerald-600 hover:underline dark:text-emerald-400"
          >
            عرض كافة طرق الدفع
          </button>
        </div>
      )}
    </div>
  );
}
