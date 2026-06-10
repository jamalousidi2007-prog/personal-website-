import RequireAuth from "@/components/auth/RequireAuth";
import WeatherStation from "@/components/WeatherStation";

export default function StationMeteoPage() {
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