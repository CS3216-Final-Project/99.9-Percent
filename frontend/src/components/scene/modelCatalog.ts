import type * as THREE from "three";
import { loadGltf } from "./gltf";

/* Furniture catalogues and the shared loader, including photo-scanned HD stand-ins. */

const KENNEY = "/models/kenney/";
const KAYKIT = "/models/kaykit/";

const kenney = (name: string) => `${KENNEY}${name}.glb`;
const kaykit = (name: string) => `${KAYKIT}${name}.gltf`;

export const MODELS = {
  desk: kenney("desk"),
  chairDesk: kenney("chairDesk"),
  cabinet: kenney("kitchenCabinet"),
  cabinetDrawer: kenney("kitchenCabinetDrawer"),
  sink: kenney("kitchenSink"),
  stove: kenney("kitchenStove"),
  microwave: kenney("kitchenMicrowave"),
  blender: kenney("kitchenBlender"),
  toaster: kenney("toaster"),
  cabinetUpper: kenney("kitchenCabinetUpper"),
  bar: kenney("kitchenBar"),
  barEnd: kenney("kitchenBarEnd"),
  stoolBar: kenney("stoolBar"),
  trashcan: kenney("trashcan"),
  tableCoffee: kenney("tableCoffee"),
  tableCoffeeGlass: kenney("tableCoffeeGlass"),
  chairModern: kenney("chairModernCushion"),
  chairCushion: kenney("chairCushion"),
  bench: kenney("benchCushion"),
  loungeChair: kenney("loungeChairRelax"),
  tvCabinet: kenney("cabinetTelevision"),
  tv: kenney("televisionModern"),
  speaker: kenney("speaker"),
  lampRoundFloor: kenney("lampRoundFloor"),
  lampSquareFloor: kenney("lampSquareFloor"),
  lampTable: kenney("lampRoundTable"),
  pottedPlant: kenney("pottedPlant"),
  plantSmall1: kenney("plantSmall1"),
  plantSmall3: kenney("plantSmall3"),
  boxClosed: kenney("cardboardBoxClosed"),
  boxOpen: kenney("cardboardBoxOpen"),
  coatRack: kenney("coatRackStanding"),
  sideTable: kenney("sideTable"),
  couch: kaykit("couch_pillows"),
  armchair: kaykit("armchair_pillows"),
  cactusSmallA: kaykit("cactus_small_A"),
  cactusSmallB: kaykit("cactus_small_B"),
  cactusMedium: kaykit("cactus_medium_A"),
  frameLargeA: kaykit("pictureframe_large_A"),
  frameMedium: kaykit("pictureframe_medium"),
  pillowA: kaykit("pillow_A"),
  pillowB: kaykit("pillow_B"),
  tableLong: kaykit("table_medium_long"),
} as const;

export type ModelId = keyof typeof MODELS;

/** How many metres one model unit is: Kenney models are about half size, KayKit about one and a half. */
export function packScale(id: ModelId): number {
  return MODELS[id].startsWith(KAYKIT) ? 0.62 : 1.93;
}

const POLYHAVEN = "/models/polyhaven/";

/** Photo-scanned stand-ins for HD detail. */
export const HD_MODELS = {
  plantLarge: `${POLYHAVEN}potted_plant_02.glb`,
  plantSmall: `${POLYHAVEN}potted_plant_04.glb`,
  loungeChair: `${POLYHAVEN}mid_century_lounge_chair.glb`,
  armchair: `${POLYHAVEN}modern_arm_chair_01.glb`,
  sofa: `${POLYHAVEN}sofa_02.glb`,
  coffeeTable: `${POLYHAVEN}coffee_table_round_01.glb`,
  sideTable: `${POLYHAVEN}side_table_01.glb`,
  box: `${POLYHAVEN}cardboard_box_01.glb`,
  deskLamp: `${POLYHAVEN}desk_lamp_arm_01.glb`,
} as const;

export type HdId = keyof typeof HD_MODELS;

export interface Swap {
  id: HdId;
  /** Extra turn so the stand-in faces the same way as the model it replaces. */
  turn?: number;
  /** "height" matches the original's height; "box" fits inside its whole box. */
  fit?: "height" | "box";
}

/** Which models get a photo-scanned stand-in at HD detail. */
export const HD_SWAPS: Partial<Record<ModelId, Swap>> = {
  pottedPlant: { id: "plantLarge", fit: "height" },
  cactusMedium: { id: "plantLarge", fit: "height" },
  plantSmall1: { id: "plantSmall", fit: "height" },
  plantSmall3: { id: "plantSmall", fit: "height" },
  cactusSmallA: { id: "plantSmall", fit: "height" },
  cactusSmallB: { id: "plantSmall", fit: "height" },
  loungeChair: { id: "loungeChair" },
  armchair: { id: "armchair" },
  couch: { id: "sofa" },
  tableCoffee: { id: "coffeeTable" },
  tableCoffeeGlass: { id: "coffeeTable" },
  sideTable: { id: "sideTable" },
  boxClosed: { id: "box" },
  boxOpen: { id: "box" },
  lampTable: { id: "deskLamp", fit: "height" },
};

/** Fetch a model's scene once however often it is asked for. A failed fetch is forgotten, so a later mount tries again. */
export function loadModel(url: string): Promise<THREE.Object3D> {
  return loadGltf(url).then((gltf) => gltf.scene);
}

/** Start fetching every model as soon as the 3D scene's code loads. */
export function preloadModels(): void {
  // A failure here is reported by whichever batch needed the model, so the preload itself stays quiet.
  for (const url of Object.values(MODELS)) loadGltf(url).catch(() => {});
}
