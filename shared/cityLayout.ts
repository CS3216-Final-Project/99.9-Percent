// City layout format (Di Heng -> Qi Jun).
// Produced from OpenStreetMap data; rendered by the frontend.
// Units: metres. Origin: centre of the area. x = east, z = south.

export type Vec2 = [x: number, z: number];

export interface Road {
  id: string;
  points: Vec2[];
  width: number;
}

export interface Building {
  id: string;
  /** Outline of the building footprint. */
  footprint: Vec2[];
  height: number;
  /** Asset from the building kit, e.g. "shop_small". */
  kit?: string;
}

export interface MissionPoint {
  id: string;
  position: Vec2;
  missionId: string;
  /** Player level needed to enter. */
  unlockLevel: number;
}

export interface CityLayout {
  areaId: string;
  name: string;
  roads: Road[];
  buildings: Building[];
  missionPoints: MissionPoint[];
}
