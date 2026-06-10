export type ProjectId = 1 | 2 | 3 | 4;

export const defaultProjectImages: Record<ProjectId, string> = {
  1: "/projects/station-meteo.svg",
  2: "/projects/project-2.svg",
  3: "/projects/project-3.svg",
  4: "/projects/project-4.svg"
};

export const projectSlugToId: Record<string, ProjectId> = {
  "station-meteo": 1,
  "smart-irrigation": 2,
  "energy-monitor": 3,
  "home-security": 4
};

export const PROJECT_IMAGE_STORAGE_KEY = "project-image-map";
export const PROJECT_IMAGE_SECONDARY_STORAGE_KEY = "project-image-secondary-map";
export const PROJECT_BG_STORAGE_KEY = "project-bg-map";
export const PROJECT_IMAGE_STYLE_STORAGE_KEY = "project-image-style-map";

export type ProjectImageStyle = {
  fit: "cover" | "contain";
  x: number;
  y: number;
  scale: number;
};

export const defaultProjectImageStyles: Record<ProjectId, ProjectImageStyle> = {
  1: { fit: "cover", x: 50, y: 50, scale: 1 },
  2: { fit: "cover", x: 50, y: 50, scale: 1 },
  3: { fit: "cover", x: 50, y: 50, scale: 1 },
  4: { fit: "cover", x: 50, y: 50, scale: 1 }
};

export const defaultProjectBackgrounds: Record<ProjectId, string> = {
  1: "linear-gradient(135deg,#1d4ed8,#0ea5e9,#22c55e,#0f172a)",
  2: "linear-gradient(135deg,#94a3b8,#475569,#1e293b,#0f172a)",
  3: "linear-gradient(135deg,#67e8f9,#0ea5e9,#2563eb,#0f172a)",
  4: "linear-gradient(135deg,#fb923c,#ea580c,#9a3412,#0f172a)"
};
