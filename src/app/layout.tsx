import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { ErrorReporter } from "@/components/ErrorReporter";
import { AIAssistant } from "@/components/ai/AIAssistant";
import { MobileTabBar } from "@/components/ui/MobileTabBar";
import { MaintenanceScreen } from "@/components/MaintenanceScreen";
import { OverloadWaitingScreen } from "@/components/OverloadWaitingScreen";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { verifyToken } from "@/lib/auth";
import { getMaintenanceMode, getMaintenanceMessage } from "@/lib/settings";
import { getOverloadProtectionState } from "@/lib/overload-protection";
import "./globals.css";

interface GateResult {
  gated: boolean;
  type?: "maintenance" | "overload";
  message?: string;
  remainingMinutes?: number;
}

/**
 * Decide whether the public maintenance screen or overload waiting screen should replace the page.
 * Superadmins bypass it entirely (they see the live site), and /adminpanel +
 * /maintenance are always reachable so admins can still log in.
 */
async function resolveGatedState(): Promise<GateResult> {
  try {
    const hdrs = await headers();
    const pathname = hdrs.get("x-pathname") ?? "";
    if (pathname.startsWith("/adminpanel") || pathname === "/maintenance") {
      return { gated: false };
    }

    // Superadmins (named or break-glass) bypass — role is in the JWT, no DB hit.
    const token = (await cookies()).get("auth_token")?.value;
    if (token) {
      const payload = await verifyToken(token);
      if (payload?.role === "superadmin") return { gated: false };
    }

    // 1. Check Maintenance Mode
    const maintOn = await getMaintenanceMode();
    if (maintOn) {
      return {
        gated: true,
        type: "maintenance",
        message: await getMaintenanceMessage(),
      };
    }

    // 2. Check Emergency Overload Protection State
    const overloadState = await getOverloadProtectionState();
    if (overloadState.isTriggered) {
      return {
        gated: true,
        type: "overload",
        message: overloadState.message,
        remainingMinutes: overloadState.remainingMinutes || 15,
      };
    }

    return { gated: false };
  } catch {
    // Fail open: never let protection checks take down every page.
    return { gated: false };
  }
}

export const metadata: Metadata = {
  metadataBase: new URL("https://code-up.tech"),
  title: {
    default: "منصة Code-UP التعليمية | CodeUp Academy Tech",
    template: "%s | منصة Code-UP التعليمية",
  },
  description: "المنصة التعليمية الأولى للطلاب المصريين في الرياضيات والعلوم والبرمجة والذكاء الاصطناعي - كورس وتدريب وتطبيقات تفاعلية.",
  keywords: [
    "code up tech",
    "codeup tech",
    "codeup academy",
    "CodeUp",
    "Code-UP",
    "منصة code up",
    "منصة codeup",
    "منصة تعليمية",
    "كورسات برمجة",
    "رياضيات ثانوية عامة",
    "علوم إعدادية",
    "الذكاء الاصطناعي للتعليم",
  ],
  alternates: {
    canonical: "https://code-up.tech",
  },
  icons: {
    icon: "/logo.jpeg",
  },
  openGraph: {
    title: "منصة Code-UP التعليمية | CodeUp Academy",
    description: "المنصة التعليمية الأولى للطلاب المصريين في الرياضيات والعلوم والبرمجة بالذكاء الاصطناعي",
    url: "https://code-up.tech",
    siteName: "منصة Code-UP",
    locale: "ar_EG",
    type: "website",
    images: [
      {
        url: "https://code-up.tech/og-image.jpeg",
        width: 1200,
        height: 630,
        alt: "منصة Code-UP التعليمية",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "منصة Code-UP التعليمية | CodeUp Academy",
    description: "المنصة التعليمية الأولى للطلاب المصريين في الرياضيات والعلوم والبرمجة بالذكاء الاصطناعي",
    images: ["https://code-up.tech/og-image.jpeg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
    other: {
      "facebook-domain-verification": ["fagzmwahaw0vng7nfk8xm6izl2upf4"],
      "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION || "",
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  "name": "Code-UP Tech",
  "alternateName": ["CodeUp Academy", "منصة Code-UP التعليمية", "Code Up"],
  "url": "https://code-up.tech",
  "logo": "https://code-up.tech/logo.jpeg",
  "image": "https://code-up.tech/og-image.jpeg",
  "description": "منصة تعليمية متكاملة لتعليم الطلاب الرياضيات والعلوم والبرمجة في مصر بأحدث أساليب التفكير والذكاء الاصطناعي.",
  "sameAs": [
    "https://www.facebook.com/CodeUpAcad"
  ]
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gateState = await resolveGatedState();

  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <meta name="facebook-domain-verification" content="fagzmwahaw0vng7nfk8xm6izl2upf4" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0E6E62" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Code-UP" />
        <link rel="apple-touch-icon" href="/logo.jpeg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Tajawal:wght@500;700;800;900&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js')}` }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>
          {gateState.gated ? (
            gateState.type === "overload" ? (
              <OverloadWaitingScreen
                message={gateState.message}
                remainingMinutes={gateState.remainingMinutes}
              />
            ) : (
              <MaintenanceScreen message={gateState.message ?? ""} />
            )
          ) : (
            <>
              <ErrorReporter />
              <ToastProvider>
                {children}
                <AIAssistant />
                <MobileTabBar />
              </ToastProvider>
            </>
          )}
        </ThemeProvider>
      </body>
    </html>
  );
}
