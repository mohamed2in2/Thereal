import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/adminpanel/", "/api/", "/parent/", "/student/", "/account/", "/demo"],
      },
      {
        userAgent: "Bingbot",
        allow: "/",
        disallow: ["/adminpanel/", "/api/", "/parent/", "/student/", "/account/", "/demo"],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/adminpanel/", "/api/", "/parent/", "/student/", "/account/", "/demo"],
      },
    ],
    sitemap: "https://code-up.tech/sitemap.xml",
  };
}
