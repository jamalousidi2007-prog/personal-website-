import Link from "next/link";
import { notFound } from "next/navigation";

import RequireAuth from "@/components/auth/RequireAuth";
import WeatherStation from "@/components/WeatherStation";
import { projectSlugToId } from "@/lib/projectVisuals";

type ProjectPageProps = {
  params: {
    slug: string;
  };
};

const projectMeta: Record<number, { title: string; description: string; status: string }> = {
  1: {
    title: "Station Meteo",
    description: "لوحة الطقس الحية مع الرسوم البيانية والتنبيه اللحظي والتحميل إلى Excel.",
    status: "Live"
  },
  2: {
    title: "Smart Irrigation",
    description: "مشروع السقي الذكي المرتبط بالرطوبة والجدولة والتحكم عن بعد.",
    status: "Coming soon"
  },
  3: {
    title: "Energy Monitor",
    description: "مراقبة الطاقة وتحليل الأحمال وعرض المؤشرات بشكل مباشر.",
    status: "Coming soon"
  },
  4: {
    title: "Home Security",
    description: "نظام الأمان المنزلي مع الاستشعارات والتنبيهات والواجهة التفاعلية.",
    status: "Coming soon"
  }
};

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = params;
  const projectId = projectSlugToId[slug];

  if (!projectId) {
    notFound();
  }

  if (projectId === 1) {
    return (
      <RequireAuth>
        <main className="page-shell">
          <div className="container">
            <WeatherStation />
          </div>
        </main>
      </RequireAuth>
    );
  }

  const meta = projectMeta[projectId];

  return (
    <RequireAuth>
      <main className="page-shell">
        <div className="container">
          <section style={{ minHeight: "760px", borderRadius: "24px", overflow: "hidden", border: "1px solid #ffffff14", background: "linear-gradient(180deg, #121c2f 0%, #0f172a 60%, #0b1322 100%)", padding: "2rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
              <div>
                <div style={{ color: "#8ea4c3", fontSize: "0.85rem", marginBottom: "0.35rem" }}>Project {projectId}</div>
                <h1 style={{ margin: 0, fontSize: "1.7rem" }}>{meta.title}</h1>
              </div>
              <Link
                href="/home"
                style={{
                  borderRadius: "10px",
                  border: "1px solid #ffffff28",
                  color: "#d2deef",
                  padding: "0.45rem 0.85rem",
                  textDecoration: "none"
                }}
              >
                Back
              </Link>
            </div>

            <div
              style={{
                border: "1px solid #ffffff14",
                borderRadius: "18px",
                background: "#101b2fdd",
                padding: "1.5rem",
                minHeight: "320px",
                display: "grid",
                alignContent: "start",
                gap: "1rem"
              }}
            >
              <div style={{ fontSize: "0.85rem", color: "#90a8c7", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                {meta.status}
              </div>
              <p style={{ margin: 0, color: "#d8e6ff", maxWidth: "720px", lineHeight: 1.75 }}>{meta.description}</p>
              <div style={{ color: "#9cb0c9", fontSize: "0.92rem" }}>
                هذه الصفحة جاهزة الآن، ويمكننا لاحقًا ربط كل مشروع بوحدة بياناته الفعلية بنفس النمط.
              </div>
            </div>
          </section>
        </div>
      </main>
    </RequireAuth>
  );
}
