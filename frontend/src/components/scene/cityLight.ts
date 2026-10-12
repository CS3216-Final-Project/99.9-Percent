import * as THREE from "three";
import { FADE, HAZE, NIGHT } from "./city";
import type { Daylight } from "./sky";

/**
 * The light on the city and the sky it fades into: uniforms every city material shares (see faded in
 * exterior.tsx), set once a frame from the time of day.
 */
export const world = {
  uFade: { value: new THREE.Vector4(FADE.x, FADE.z, FADE.from, FADE.to) },
  uHaze: { value: new THREE.Vector2(HAZE.depth, HAZE.most) },
  uHorizon: { value: new THREE.Color(NIGHT) },
  uKeyDir: { value: new THREE.Vector3(-0.45, 1, -0.3).normalize() },
  uKeyLight: { value: new THREE.Color(0.3, 0.36, 0.52) },
  uSkyLight: { value: new THREE.Color(0.27, 0.3, 0.45) },
  uGroundLight: { value: new THREE.Color(0.15, 0.14, 0.2) },
  uDark: { value: 1 },
};

/**
 * Light the city for a time of day. The horizon colour is mixed in after the colour-space conversion, so it is
 * linear when effects render off-screen first and a display colour otherwise.
 */
export function applyDaylight(d: Daylight, linear: boolean): void {
  world.uHorizon.value.setRGB(d.horizon[0], d.horizon[1], d.horizon[2], THREE.SRGBColorSpace);
  if (!linear) world.uHorizon.value.convertLinearToSRGB();
  world.uKeyDir.value.set(d.key[0], d.key[1], d.key[2]);
  world.uKeyLight.value.setRGB(d.keyLight[0], d.keyLight[1], d.keyLight[2], THREE.LinearSRGBColorSpace);
  world.uSkyLight.value.setRGB(d.skyLight[0], d.skyLight[1], d.skyLight[2], THREE.LinearSRGBColorSpace);
  world.uGroundLight.value.setRGB(d.groundLight[0], d.groundLight[1], d.groundLight[2], THREE.LinearSRGBColorSpace);
  world.uDark.value = d.dark;
}
