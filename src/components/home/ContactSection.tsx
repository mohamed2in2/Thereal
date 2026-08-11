interface ContactSectionProps {
  heading?: string;
  subtitle?: string;
  email?: string;
  phone?: string;
}

export function ContactSection({
  heading  = "تواصل معنا",
  subtitle = "نحن هنا للإجابة على أسئلتك في أي وقت",
  email    = "contact@code-up.tech",
  phone    = "01118802621",
}: ContactSectionProps = {}) {
  const digits = phone.replace(/\D/g, "");
  const normalizedPhone = digits.startsWith("0") ? "2" + digits : digits.startsWith("2") ? digits : "20" + digits;
  const telHref = `+${normalizedPhone}`;
  const waHref = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent("السلام عليكم، أود التواصل مع إدارة ومنصة Code-UP")}`;

  return (
    <section
      className="py-20 border-t"
      id="contact"
      style={{ background: "var(--bg-2)", borderColor: "var(--border)" }}
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <h2
            className="text-balance text-2xl md:text-3xl font-black tracking-tight mb-2"
            style={{ color: "var(--ink)", fontFamily: "var(--font-head)" }}
          >
            {heading}
          </h2>
          <p className="text-sm md:text-base" style={{ color: "var(--ink-2)" }}>{subtitle}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <a
            href={`mailto:${email}`}
            className="group flex items-center gap-4 px-6 py-5 rounded-2xl transition-all"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--brand)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
          >
            <span
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors"
              style={{ background: "var(--brand-soft)", border: "1px solid var(--brand)" }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="var(--brand)" strokeWidth={1.5} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </span>
            <div>
              <p className="text-xs font-medium mb-0.5" style={{ color: "var(--ink-3)" }}>البريد الإلكتروني</p>
              <p className="text-sm font-semibold break-all" dir="ltr" style={{ color: "var(--ink)" }}>{email}</p>
            </div>
          </a>

          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-4 px-6 py-5 rounded-2xl transition-all"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#25D366"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
          >
            <span
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-lg"
              style={{ background: "#25D366" }}
            >
              💬
            </span>
            <div>
              <p className="text-xs font-medium mb-0.5" style={{ color: "var(--ink-3)" }}>واتساب الدعم المباشر</p>
              <p className="text-sm font-semibold" dir="ltr" style={{ color: "var(--ink)" }}>{phone}</p>
            </div>
          </a>

          <a
            href={`tel:${telHref}`}
            className="group flex items-center gap-4 px-6 py-5 rounded-2xl transition-all"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
            dir="rtl"
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--brand)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
          >
            <span
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "var(--brand-soft)", border: "1px solid var(--brand)" }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="var(--brand)" strokeWidth={1.5} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </span>
            <div>
              <p className="text-xs font-medium mb-0.5" style={{ color: "var(--ink-3)" }}>الهاتف</p>
              <p className="text-sm font-semibold" dir="ltr" style={{ color: "var(--ink)" }}>{phone}</p>
            </div>
          </a>
        </div>
      </div>
    </section>
  );
}
