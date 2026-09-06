import { notFound } from "next/navigation";
import { resolveFunnelConfig } from "../../../lib/studio/funnel-store";
import { QualificationWizard } from "../../../components/qualify/QualificationWizard";

export const runtime = "nodejs";

// Public, unauthenticated live qualification funnel. The [slug] resolves to a
// builder-authored funnel the workspace published, or the built-in demo.
export default async function QualifyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const config = await resolveFunnelConfig(slug);
  if (!config) notFound();
  return <QualificationWizard config={config} />;
}
