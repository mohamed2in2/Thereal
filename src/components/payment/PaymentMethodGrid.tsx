"use client";

import { useState, useMemo, useRef, KeyboardEvent } from "react";
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
 * Vertical radio list of payment methods.
 * Full keyboard arrow navigation, single column layout, no decorative pills or multi-col grid.
 */
export function PaymentMethodGrid({
  methods,
  selectedId,
  onSelect,
  onOpenDetails,
  showFilters = false,
}: PaymentMethodGridProps) {
  const [activeCategory, setActiveCategory] = useState<PaymentMethodCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onSelect || filteredMethods.length === 0) return;

    const available = filteredMethods.filter((m) => m.available);
    if (available.length === 0) return;

    const currentIndex = available.findIndex((m) => m.id === selectedId);

    if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
      e.preventDefault();
      const nextIndex = currentIndex < available.length - 1 ? currentIndex + 1 : 0;
      onSelect(available[nextIndex]);
    } else if (e.key === "ArrowUp" || e.key === "ArrowRight") {
      e.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : available.length - 1;
      onSelect(available[prevIndex]);
    }
  };

  return (
    <div dir="rtl" className="space-y-4">
      {/* Category Tabs & Search Header (only when showFilters is explicitly true) */}
      {showFilters && (
        <div className="space-y-3">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن وسيلة الدفع..."
              className="w-full h-10 rounded-lg border border-[#E4E7EC] dark:border-[#232C36] bg-[#FFFFFF] dark:bg-[#141A21] px-4 text-[15px] font-normal text-[#101828] dark:text-[#F2F4F7] outline-none focus-visible:ring-2 focus-visible:ring-[#047857] dark:focus-visible:ring-[#10B981]"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`shrink-0 h-8 rounded-lg px-3 text-[13px] font-medium transition-colors ${
                activeCategory === "all"
                  ? "border border-[#047857] dark:border-[#10B981] bg-[#047857]/5 dark:bg-[#10B981]/10 text-[#101828] dark:text-[#F2F4F7]"
                  : "border border-[#E4E7EC] dark:border-[#232C36] bg-[#FFFFFF] dark:bg-[#141A21] text-[#667085] dark:text-[#98A2B3]"
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
                  className={`shrink-0 h-8 rounded-lg px-3 text-[13px] font-medium transition-colors ${
                    activeCategory === cat.id
                      ? "border border-[#047857] dark:border-[#10B981] bg-[#047857]/5 dark:bg-[#10B981]/10 text-[#101828] dark:text-[#F2F4F7]"
                      : "border border-[#E4E7EC] dark:border-[#232C36] bg-[#FFFFFF] dark:bg-[#141A21] text-[#667085] dark:text-[#98A2B3]"
                  }`}
                >
                  {cat.label} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Vertical Radio List */}
      {filteredMethods.length > 0 ? (
        <div
          ref={containerRef}
          role="radiogroup"
          aria-label="طريقة الدفع"
          onKeyDown={handleKeyDown}
          className="flex flex-col gap-3"
        >
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
        <div className="rounded-xl border border-[#E4E7EC] dark:border-[#232C36] bg-[#FFFFFF] dark:bg-[#141A21] p-6 text-center">
          <p className="text-[15px] font-normal text-[#667085] dark:text-[#98A2B3]">
            لم يتم العثور على طريقة دفع تطابق بحثك.
          </p>
          <button
            type="button"
            onClick={() => {
              setActiveCategory("all");
              setSearchQuery("");
            }}
            className="mt-3 text-[15px] font-medium text-[#047857] dark:text-[#10B981] underline"
          >
            عرض كافة طرق الدفع
          </button>
        </div>
      )}
    </div>
  );
}

