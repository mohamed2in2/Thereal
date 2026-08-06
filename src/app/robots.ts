import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/adminpanel/", "/api/", "/parent/", "/student/", "/account/"],
      },
      {
        userAgent: "Bingbot",
        allow: "/",
        disallow: ["/adminpanel/", "/api/", "/parent/", "/student/", "/account/"],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/adminpanel/", "/api/", "/parent/", "/student/", "/account/"],
      },
    ],
    sitemap: "https://code-up.tech/sitemap.xml",
  };
}
