import RequireAuth from "@/components/auth/RequireAuth";
import HomeDashboard from "@/components/HomeDashboard";

export default function HomePage() {
  return (
    <RequireAuth>
      <main className="page-shell">
        <div className="container">
          <HomeDashboard />
        </div>
      </main>
    </RequireAuth>
  );
}