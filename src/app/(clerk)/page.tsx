import { getSiteText } from "@/lib/site-text";
import { HomeContent } from "./HomeContent";

// Rendered per request: site copy is fetched server-side (no flash, SEO-friendly)
// and never touches the DB at build time. Superadmin edits appear immediately.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const text = await getSiteText();
  return <HomeContent text={text} />;
}
