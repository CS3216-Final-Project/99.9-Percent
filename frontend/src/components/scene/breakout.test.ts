import { describe, expect, it } from "vitest";
import { FIELD, newGame, step, type Breakout } from "./breakout";

const idle = { left: false, right: false, serve: false };
const serve = { ...idle, serve: true };

/** A game mid-flight with the ball where the test wants it. */
const flying = (x: number, y: number, vx: number, vy: number): Breakout => {
  const g = newGame();
  g.phase = "play";
  g.ball = { x, y, vx, vy };
  return g;
};

describe("the arcade cabinet's brick breaker", () => {
  it("serves upward, alternating sides by serve count", () => {
    const g = newGame();
    const { events } = step(g, serve, 1 / 60);
    expect(g.phase).toBe("play");
    expect(g.ball.vy).toBeLessThan(0);
    expect(g.ball.vx).toBeGreaterThan(0);
    expect(events).toEqual([]);
    // The next serve leans the other way.
    const h = newGame();
    h.serves = 1;
    step(h, serve, 1 / 60);
    expect(h.ball.vx).toBeLessThan(0);
    expect(h.ball.vy).toBeLessThan(0);
  });

  it("clamps the paddle at both edges of the field", () => {
    const g = newGame();
    step(g, { ...idle, right: true }, 5);
    expect(g.paddle.x).toBe(FIELD.w - 1 - g.paddle.w);
    step(g, { ...idle, left: true }, 5);
    expect(g.paddle.x).toBe(1);
  });

  it("bounces off both side walls and the ceiling", () => {
    const right = flying(FIELD.w - 3, 20, 30, -10);
    step(right, idle, 1 / 10);
    expect(right.ball.vx).toBeLessThan(0);
    const left = flying(1, 20, -30, -10);
    step(left, idle, 1 / 10);
    expect(left.ball.vx).toBeGreaterThan(0);
    const top = flying(30, 1, 0, -30);
    step(top, idle, 1 / 10);
    expect(top.ball.vy).toBeGreaterThan(0);
  });

  it("breaks a brick it hits, scores its row's value and sends the ball back", () => {
    // Under the middle of the second brick of the bottom row, moving up into it.
    const g = flying(15, 19.4, 0, -30);
    const { events } = step(g, idle, 1 / 10);
    expect(g.bricks.find((b) => b.x === 13 && b.y === 15)?.alive).toBe(false);
    expect(g.score).toBe(20);
    expect(g.ball.vy).toBeGreaterThan(0);
    expect(events.some((e) => e.kind === "brick" && e.value === 20)).toBe(true);
  });

  it("loses a life past the floor and waits on the paddle to serve again", () => {
    const g = flying(10, FIELD.h - 3, 0, 30);
    const { events } = step(g, idle, 1 / 5);
    expect(g.lives).toBe(2);
    expect(g.phase).toBe("serve");
    expect(events.map((e) => e.kind)).toEqual(["lost"]);
    expect(g.ball.y).toBe(g.paddle.y - 2);
  });

  it("ends after three misses, and answers no more input", () => {
    const g = newGame();
    for (let i = 0; i < 3; i++) {
      g.phase = "play";
      g.ball = { x: 30, y: FIELD.h - 1, vx: 0, vy: 60 };
      step(g, idle, 1 / 10);
    }
    expect(g.lives).toBe(0);
    expect(g.phase).toBe("over");
    const before = JSON.stringify(g);
    step(g, { left: true, right: true, serve: true }, 1);
    expect(JSON.stringify(g)).toBe(before);
  });

  it("is won when every brick is gone", () => {
    const g = flying(15, 8.2, 0, -30);
    g.bricks.forEach((b) => {
      b.alive = b.x === 13 && b.y === 5;
    });
    const { events } = step(g, idle, 1 / 30);
    expect(g.phase).toBe("won");
    expect(events.map((e) => e.kind)).toEqual(["brick", "won"]);
  });

  it("still bounces off the paddle on a 0.25 s frame at full speed", () => {
    const g = flying(32, FIELD.h - 12, 0, 60);
    g.speed = 60;
    g.paddle.x = 26;
    const { events } = step(g, idle, 0.25);
    expect(events.some((e) => e.kind === "paddle")).toBe(true);
    expect(g.ball.vy).toBeLessThan(0);
    expect(g.ball.y).toBeLessThan(FIELD.h);
    expect(g.lives).toBe(3);
  });

  it("changes nothing on a zero-length step", () => {
    const g = newGame();
    g.phase = "play";
    const before = JSON.stringify(g);
    const { events } = step(g, { left: true, right: false, serve: true }, 0);
    expect(JSON.stringify(g)).toBe(before);
    expect(events).toEqual([]);
  });
});
