import Link from "next/link";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer style={{ background: "#0A1521", color: "#9DB1C5", fontFamily: "var(--font-body)" }}>
      {/* Main grid — 2 cols on mobile, 4 on md+ */}
      <div className="max-w-[1320px] mx-auto px-5 sm:px-7 pt-10 sm:pt-14 pb-0
                      grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-10">

        {/* Brand — full-width on mobile */}
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-9 h-9 rounded-[11px] bg-[var(--brand)] flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10 12 5 2 10l10 5 10-5Z"/>
                <path d="M6 12v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5"/>
              </svg>
            </span>
            <b style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 18, color: "#F3F6FA" }}>Code-UP</b>
          </div>
          <p className="text-sm leading-relaxed max-w-[300px]" style={{ color: "#8295A8" }}>
            منصة كورسات مصرية تهدف إلى تمكين المتعلمين من المحتوى عالي الجودة وأدوات المتابعة الذكية.
          </p>
        </div>

        {/* Platform */}
        <div>
          <h4 className="text-xs font-bold mb-4 tracking-wider" style={{ color: "#5E7186" }}>المنصة</h4>
          <ul className="space-y-3">
            {[
              { href: "/courses",     label: "الكورسات" },
              { href: "/library",     label: "مكتبتي" },
              { href: "/account",     label: "حسابي" },
              { href: "/payment-methods", label: "طرق الدفع" },
              { href: "/leaderboard", label: "لوحة الشرف" },
            ].map(({ href, label }) => (
              <li key={href}>
                <Link href={href} className="text-sm no-underline hover:text-white transition-colors" style={{ color: "#A8B8C8" }}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Legal */}
        <div>
          <h4 className="text-xs font-bold mb-4 tracking-wider" style={{ color: "#5E7186" }}>قانوني</h4>
          <ul className="space-y-3">
            <li><Link href="/terms"   className="text-sm no-underline hover:text-white transition-colors" style={{ color: "#A8B8C8" }}>شروط الاستخدام</Link></li>
            <li><Link href="/privacy" className="text-sm no-underline hover:text-white transition-colors" style={{ color: "#A8B8C8" }}>سياسة الخصوصية</Link></li>
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h4 className="text-xs font-bold mb-4 tracking-wider" style={{ color: "#5E7186" }}>تواصل</h4>
          <ul className="space-y-3">
            <li>
              <a href="mailto:contact@code-up.tech" className="text-sm no-underline hover:text-white transition-colors break-all" dir="ltr" style={{ color: "#A8B8C8" }}>
                contact@code-up.tech
              </a>
            </li>
            <li>
              <a href="tel:+201285353604" className="text-sm no-underline hover:text-white transition-colors" dir="ltr" style={{ color: "#A8B8C8" }}>
                012 8535 3604
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="max-w-[1320px] mx-auto px-5 sm:px-7 mt-8 sm:mt-12 py-4 sm:py-5 flex flex-col sm:flex-row items-center justify-between gap-3"
           style={{ borderTop: "1px solid #16273A" }}>
        <span className="text-xs sm:text-sm order-2 sm:order-1" style={{ color: "#5E7186" }}>
          © Code-UP {year} — جميع الحقوق محفوظة.
        </span>
        <div className="flex items-center gap-3 order-1 sm:order-2">
          <Link href="/adminpanel" className="text-xs no-underline transition-colors hover:text-white" style={{ color: "#3C4D5E" }}>⚙</Link>
          <a href="https://kemetcraft.me/" target="_blank" rel="noopener noreferrer"
             className="text-xs no-underline transition-colors hover:text-white tracking-wide" style={{ color: "#3C4D5E" }}>
            2n2 DEV
          </a>
        </div>
      </div>
    </footer>
  );
}
