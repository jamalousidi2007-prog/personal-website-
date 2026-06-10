import RequireAuth from "@/components/auth/RequireAuth";
import MapPage from "@/components/MapPage";

export default function Map() {
  return (
    <RequireAuth>
      <main className="page-shell">
        <div className="container">
          <MapPage />
        </div>
      </main>
    </RequireAuth>
  );
}
