"use client";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";

interface ConfigItem {
  key: string;
  type: "number" | "string" | "boolean";
  label: string;
  value: string;
  enforced?: boolean;
}
interface ConfigGroup {
  category: string;
  label: string;
  items: ConfigItem[];
}
interface Provider {
  id: string;
  name: string;
  slug: string;
  baseUrl: string;
  models: string[];
  hasKey: boolean;
  isPrimary: boolean;
  isBackup: boolean;
  isActive: boolean;
}

const card = "rounded-2xl border border-gray-700 bg-gray-800 p-5";
const input =
  "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500";

export function AdvancedSettingsSection() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [groups, setGroups] = useState<ConfigGroup[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [encReady, setEncReady] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/config", { credentials: "include" });
      const json = await res.json();
      if (res.ok && Array.isArray(json.groups)) {
        setGroups(json.groups);
        setOpen((p) => (Object.keys(p).length ? p : { [json.groups[0]?.category]: true }));
      } else toastError(json.error ?? "تعذر تحميل الإعدادات");
    } catch {
      toastError("تعذر الاتصال بالخادم");
    }
  }, [toastError]);

  const loadProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ai-providers", { credentials: "include" });
      const json = await res.json();
      if (res.ok) {
        setProviders(json.providers ?? []);
        setEncReady(json.encryptionConfigured !== false);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadConfig();
    void loadProviders();
  }, [loadConfig, loadProviders]);

  const saveConfig = async (key: string, value: string | boolean) => {
    setSavingKey(key);
    try {
      const res = await fetch("/api/admin/config", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      const json = await res.json();
      if (!res.ok) {
        toastError(json.error ?? "تعذر الحفظ");
        return;
      }
      toastSuccess("تم الحفظ — يسري خلال ثوانٍ");
    } catch {
      toastError("تعذر الاتصال بالخادم");
    } finally {
      setSavingKey(null);
    }
  };

  const setItemValue = (cat: string, key: string, value: string) =>
    setGroups((gs) =>
      gs.map((g) =>
        g.category === cat ? { ...g, items: g.items.map((i) => (i.key === key ? { ...i, value } : i)) } : g
      )
    );

  return (
    <div className="max-w-3xl space-y-6" dir="rtl">
      {/* ── Config categories ── */}
      {groups.map((g) => {
        const isOpen = !!open[g.category];
        return (
          <div key={g.category} className={`${card} p-0 overflow-hidden`}>
            <button
              onClick={() => setOpen((p) => ({ ...p, [g.category]: !p[g.category] }))}
              className="flex w-full items-center justify-between p-4 text-right hover:bg-gray-700/40"
            >
              <span className="font-bold text-white">{g.label}</span>
              <span className="text-gray-400">{isOpen ? "−" : "+"}</span>
            </button>
            {isOpen && (
              <div className="space-y-3 border-t border-gray-700 p-4">
                {g.items.map((item) => (
                  <div key={item.key} className="flex flex-wrap items-end gap-2">
                    <div className="flex-1 min-w-[160px]">
                      <label className="mb-1 flex items-center gap-2 text-xs text-gray-300">
                        {item.label}
                        {item.enforced === false && (
                          <span className="rounded-full bg-gray-700 px-2 py-0.5 text-[10px] font-bold text-gray-400">
                            غير مُفعّل بعد
                          </span>
                        )}
                      </label>
                      {item.type === "boolean" ? (
                        <button
                          onClick={() => saveConfig(item.key, item.value !== "true")}
                          className={`relative h-7 w-12 rounded-full transition-colors ${
                            item.value === "true" ? "bg-emerald-500" : "bg-gray-600"
                          }`}
                          aria-pressed={item.value === "true"}
                        >
                          <span
                            className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                              item.value === "true" ? "left-1" : "right-1"
                            }`}
                          />
                        </button>
                      ) : (
                        <input
                          type={item.type === "number" ? "number" : "text"}
                          value={item.value}
                          onChange={(e) => setItemValue(g.category, item.key, e.target.value)}
                          className={input}
                        />
                      )}
                    </div>
                    {item.type !== "boolean" && (
                      <button
                        onClick={() => saveConfig(item.key, item.value)}
                        disabled={savingKey === item.key}
                        className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                      >
                        {savingKey === item.key ? "..." : "حفظ"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* ── AI providers ── */}
      <AIProvidersBlock
        providers={providers}
        encReady={encReady}
        reload={loadProviders}
        toastSuccess={toastSuccess}
        toastError={toastError}
      />
    </div>
  );
}

function AIProvidersBlock({
  providers,
  encReady,
  reload,
  toastSuccess,
  toastError,
}: {
  providers: Provider[];
  encReady: boolean;
  reload: () => Promise<void>;
  toastSuccess: (m: string) => void;
  toastError: (m: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", slug: "", baseUrl: "", models: "", apiKey: "" });

  const patch = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/ai-providers/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toastError(json.error ?? "تعذر التعديل");
      return;
    }
    toastSuccess("تم التحديث");
    await reload();
  };

  const create = async () => {
    const res = await fetch("/api/admin/ai-providers", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toastError(json.error ?? "تعذر الإنشاء");
      return;
    }
    toastSuccess("تمت إضافة المزوّد");
    setDraft({ name: "", slug: "", baseUrl: "", models: "", apiKey: "" });
    setAdding(false);
    await reload();
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/admin/ai-providers/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) {
      toastError("تعذر الحذف");
      return;
    }
    toastSuccess("تم الحذف");
    await reload();
  };

  return (
    <div className={card}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold text-white">مزوّدو الذكاء الاصطناعي</h3>
        <button
          onClick={() => setAdding((a) => !a)}
          className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
        >
          {adding ? "إلغاء" : "+ إضافة"}
        </button>
      </div>
      {!encReady && (
        <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-950/20 p-2 text-xs text-amber-300">
          لحفظ مفاتيح الـ API يجب ضبط CONFIG_ENCRYPTION_KEY في الخادم.
        </p>
      )}

      {adding && (
        <div className="mb-4 space-y-2 rounded-xl border border-gray-700 bg-gray-900/50 p-3">
          <input className={input} placeholder="الاسم" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <input className={input} placeholder="المعرّف (slug)" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
          <input className={input} placeholder="رابط الـ API (Base URL)" value={draft.baseUrl} onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })} />
          <input className={input} placeholder="النماذج (مفصولة بفاصلة)" value={draft.models} onChange={(e) => setDraft({ ...draft, models: e.target.value })} />
          <input className={input} type="password" placeholder="مفتاح الـ API" value={draft.apiKey} onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })} />
          <button onClick={create} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700">
            حفظ المزوّد
          </button>
        </div>
      )}

      <div className="space-y-3">
        {providers.length === 0 && <p className="text-sm text-gray-500">لا يوجد مزوّدون بعد.</p>}
        {providers.map((p) => (
          <ProviderCard key={p.id} provider={p} onPatch={patch} onRemove={remove} />
        ))}
      </div>
    </div>
  );
}

function ProviderCard({
  provider,
  onPatch,
  onRemove,
}: {
  provider: Provider;
  onPatch: (id: string, body: Record<string, unknown>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900/50 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-white">{provider.name}</span>
        <span className="text-[11px] text-gray-500">{provider.slug}</span>
        {provider.isPrimary && <Badge color="sky">أساسي</Badge>}
        {provider.isBackup && <Badge color="amber">احتياطي</Badge>}
        <Badge color={provider.hasKey ? "emerald" : "red"}>{provider.hasKey ? "مفتاح مضبوط" : "بدون مفتاح"}</Badge>
        {!provider.isActive && <Badge color="red">موقوف</Badge>}
      </div>
      <p className="mb-1 text-xs text-gray-400" dir="ltr">{provider.baseUrl}</p>
      <p className="mb-3 text-xs text-gray-500">النماذج: {provider.models.join(", ") || "—"}</p>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => onPatch(provider.id, { isPrimary: !provider.isPrimary })} className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-600">
          {provider.isPrimary ? "إلغاء كأساسي" : "تعيين أساسي"}
        </button>
        <button onClick={() => onPatch(provider.id, { isBackup: !provider.isBackup })} className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-600">
          {provider.isBackup ? "إلغاء كاحتياطي" : "تعيين احتياطي"}
        </button>
        <button onClick={() => onPatch(provider.id, { isActive: !provider.isActive })} className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-600">
          {provider.isActive ? "إيقاف" : "تفعيل"}
        </button>
        <button onClick={() => setShowKey((s) => !s)} className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/20">
          تغيير المفتاح
        </button>
        <button onClick={() => onRemove(provider.id)} className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20">
          حذف
        </button>
      </div>

      {showKey && (
        <div className="mt-3 flex gap-2">
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="مفتاح API جديد (لن يُعرض بعد الحفظ)"
            className={input}
          />
          <button
            onClick={async () => {
              if (!keyInput) return;
              await onPatch(provider.id, { apiKey: keyInput });
              setKeyInput("");
              setShowKey(false);
            }}
            className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            حفظ المفتاح
          </button>
        </div>
      )}
    </div>
  );
}

function Badge({ color, children }: { color: "sky" | "amber" | "emerald" | "red"; children: React.ReactNode }) {
  const map: Record<string, string> = {
    sky: "bg-sky-500/15 text-sky-300",
    amber: "bg-amber-500/15 text-amber-300",
    emerald: "bg-emerald-500/15 text-emerald-300",
    red: "bg-red-500/15 text-red-400",
  };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${map[color]}`}>{children}</span>;
}
