import Link from "next/link";

interface PlanCardProps {
  plan: {
    id: string;
    title: string;
    educationalStage: string;
    description?: string;
    price: number;
    discountPrice?: number | null;
    discountExpiresAt?: string | null;
    hasAccess?: boolean;
    _count?: { lessons: number };
  };
}

const STAGE_LABELS: Record<string, string> = {
  sec_1: "أولى بكالوريا",
  sec_2: "ثانية بكالوريا",
};

export function PlanCard({ plan }: PlanCardProps) {
  const hasDiscount = plan.discountPrice != null && plan.discountExpiresAt && new Date(plan.discountExpiresAt) > new Date();
  const effectivePrice = hasDiscount ? plan.discountPrice! : plan.price;

  return (
    <div className="flex flex-col h-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
      <div className="relative h-40 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-6 text-center">
        <h3 className="text-xl font-bold text-white leading-snug drop-shadow-md">{plan.title}</h3>
        {plan.hasAccess && (
          <span className="absolute top-3 right-3 bg-white/20 backdrop-blur-sm border border-white/30 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            مسجل
          </span>
        )}
      </div>

      <div className="p-5 flex-1 flex flex-col">
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
            خطة دراسية
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
            {STAGE_LABELS[plan.educationalStage] || plan.educationalStage}
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
            {plan._count?.lessons || 0} درس
          </span>
        </div>

        {plan.description && (() => {
          let text = plan.description;
          try {
            if (plan.description.startsWith('[') && plan.description.endsWith(']')) {
              const parsed = JSON.parse(plan.description);
              text = parsed.join(" · ");
            }
          } catch {}
          return (
            <p className="text-sm text-[var(--ink-muted)] mb-4 line-clamp-2 leading-relaxed">
              {text}
            </p>
          );
        })()}

        <div className="mt-auto pt-4 border-t border-[var(--border)] flex items-center justify-between">
          <div className="flex flex-col">
            {effectivePrice === 0 ? (
              <span className="font-black text-emerald-500 text-lg">مجانًا</span>
            ) : hasDiscount ? (
              <>
                <span className="font-black text-[var(--ink)] text-lg">{effectivePrice} جنيه</span>
                <span className="text-xs text-[var(--ink-muted)] line-through">{plan.price} جنيه</span>
              </>
            ) : (
              <span className="font-black text-[var(--ink)] text-lg">{plan.price} جنيه</span>
            )}
          </div>

          <Link
            href={plan.hasAccess ? `/plans/${plan.id}/learn` : `/plans/${plan.id}`}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              plan.hasAccess 
                ? "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-800/50" 
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
          >
            {plan.hasAccess ? "متابعة الخطة" : "التفاصيل"}
          </Link>
        </div>
      </div>
    </div>
  );
}
