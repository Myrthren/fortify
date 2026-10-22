import type { Location, PersonId } from "./research-institute";

export type Point = [number, number];
// Every station opens onto the same unobstructed central aisle (z = 1).
// Desks and equipment sit behind these standing positions, never in that aisle.
export function station(location: Location, id: PersonId): Point {
  const index = ["mira", "ivo", "jun", "ada", "sol", "nia"].indexOf(id);
  switch (location) {
    case "office": return [[-11, 5], [-7.5, 5], [-11, 7.1], [-7.5, 7.1], [-5.3, 6], [-4.3, 4.5]][index] as Point;
    case "workbench": return [[-10, -3.1], [-5.6, -3.1], [-3.5, -3.1], [-8, -3.1], [-7.8, -6.1], [-2.2, -3.1]][index] as Point;
    case "compute": return [5.3 + index * .65, -3.05];
    case "maintenance": return [10.9 + (index % 2) * .7, -4.25 + Math.floor(index / 2) * .65];
    case "analysis": return [5.6 + index * .85, 5.7 + (index % 2) * 1.2];
    case "meeting": return [[-2.1, 4.2], [2.1, 4.2], [-2.1, 6.7], [2.1, 6.7], [-2.1, 5.5], [0, 3.4]][index] as Point;
  }
}

export function route(start: Point, end: Point): Point[] {
  if (Math.hypot(start[0] - end[0], start[1] - end[1]) < .08) return [];
  // Workbench service side has a clear passage around the western bench end.
  const toAisle = (p: Point): Point[] => {
    if (p[1] < -5 && p[0] < 0) return [[-12.5, p[1]], [-12.5, 1]];
    if (p[1] < -.55 && p[0] > 3.6) return [[p[0], -2.1], [8.5, -2.1], [8.5, 1]];
    if (p[1] > 2 && p[0] < -3.5) return [[p[0], 6.3], [-2.8, 6.3], [-2.8, 1]];
    if (p[1] > 2 && p[0] > 4) return [[p[0], 7.3], [4.2, 7.3], [4.2, 1]];
    return [[p[0], 1]];
  };
  const exit = toAisle(start), entry = [...toAisle(end)].reverse().concat([end]);
  return [...exit, ...entry].filter((p, i, all) => !i || Math.hypot(p[0] - all[i - 1][0], p[1] - all[i - 1][1]) > .05);
}

export const CAMERA_VIEWS = {
  overview: { eye: [24, 24, 29], target: [0, 0, 0] },
  inside: { eye: [-.8, 2.4, -.2], target: [-7.5, 1.6, -4.9] },
  laboratory: { eye: [-4, 8, 8], target: [-7, 1.1, -4] },
  systems: { eye: [12.8, 3.2, -1.4], target: [9.5, 1.3, -6] },
  office: { eye: [-3, 6, 14], target: [-8, 1, 4.5] },
  analysis: { eye: [15, 7, 14], target: [7, 1, 5] },
} as const;
export type CameraView = keyof typeof CAMERA_VIEWS | "follow";
