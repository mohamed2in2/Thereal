import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const disallowed = ["/adminpanel/", "/api/", "/parent/", "/student/", "/account/", "/demo", "/courses/*/watch/"];

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: disallowed,
      },
      // Search Engines
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: disallowed,
      },
      {
        userAgent: "Bingbot",
        allow: "/",
        disallow: disallowed,
      },
      // AI Search & Generative Engines (GEO)
      {
        userAgent: "GPTBot",
        allow: "/",
        disallow: disallowed,
      },
      {
        userAgent: "PerplexityBot",
        allow: "/",
        disallow: disallowed,
      },
      {
        userAgent: "ClaudeBot",
        allow: "/",
        disallow: disallowed,
      },
      {
        userAgent: "Applebot-Extended",
        allow: "/",
        disallow: disallowed,
      },
      {
        userAgent: "Google-Extended",
        allow: "/",
        disallow: disallowed,
      },
      {
        userAgent: "cohere-ai",
        allow: "/",
        disallow: disallowed,
      },
    ],
    sitemap: "https://code-up.tech/sitemap.xml",
  };
}
