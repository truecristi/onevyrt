import type { MetadataRoute } from "next";
import { SITE_ORIGIN, PUBLIC_PATHS } from "../lib/site";

/**
 * sitemap.xml (Next metadata route) listing the public, indexable pages only.
 * The landing page is the priority entry; the legal pages change rarely.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({
    url: `${SITE_ORIGIN}${path}`,
    changeFrequency: path === "/" ? "weekly" : "yearly",
    priority: path === "/" ? 1 : 0.4,
  }));
}
