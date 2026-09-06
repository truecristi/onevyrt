import type { MetadataRoute } from "next";
import { SITE_ORIGIN, PRIVATE_PREFIXES } from "../lib/site";

/**
 * robots.txt (Next metadata route). Let crawlers index the public marketing
 * and legal pages, but keep the signed-in app, admin, and the API out of
 * search results — a crawler only ever sees a login wall there anyway, and
 * indexing those URLs just leaks structure and wastes crawl budget. Points to
 * the sitemap so the good pages are found quickly.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...PRIVATE_PREFIXES],
    },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
    host: SITE_ORIGIN,
  };
}
