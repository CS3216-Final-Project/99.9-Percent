/*
 * The brick breaker the red arcade cabinet plays while the avatar is busy with it (see arcade.ts): a paddle, a
 * ball and three rows of bricks on the cabinet screen's own 64×52 pixels. Pure arithmetic, kept free of React,
 * three.js and the wall clock so the game can be tested frame by frame; every random-looking thing is decided by
 * the serve count instead.
 */

/** The cabinet screen's field, in its pixels. */
export const FIELD = { w: 64, h: 52 };

/** A brick still standing: where it sits in the field, its row's colour and the score it gives. */
export interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  colour: string;
  value: number;
  alive: boolean;
}

export type BreakoutPhase = "serve" | "play" | "won" | "over";

export interface Breakout {
  bricks: Brick[];
  paddle: { x: number; y: number; w: number; h: number };
  ball: { x: number; y: number; vx: number; vy: number };
  /** Where the game is: the ball waiting on the paddle, in flight, or done either way. */
  phase: BreakoutPhase;
  lives: number;
  score: number;
  /** How many times a serve has gone, deciding which way the next one launches. */
  serves: number;
  speed: number;
}

export type BreakoutEvent =
  | { kind: "paddle" }
  | { kind: "wall" }
  | { kind: "brick"; value: number; x: number; y: number }
  | { kind: "lost" }
  | { kind: "over" }
  | { kind: "won" };

export interface BreakoutInput {
  left: boolean;
  right: boolean;
  serve: boolean;
}

const BRICK_COLS = 6;
const BRICK_ROWS = 3;
/** A row's colour and what its bricks score, top to bottom (the attract mode's palette in textures.ts). */
const ROWS = [
  { colour: "#ff4d5e", value: 50 },
  { colour: "#ff9f43", value: 30 },
  { colour: "#ffc53d", value: 20 },
];
const PADDLE = { w: 12, h: 2, speed: 48 };
const BALL = 2;
/** The serve's launch angle from straight up; each serve leans to the other side. */
const SERVE_ANGLE = (35 * Math.PI) / 180;
/** The steepest the paddle may turn the ball, from straight up. */
const PADDLE_ANGLE = (60 * Math.PI) / 180;
const SPEED = { first: 34, perBrick: 1.5, max: 60 };
const LIVES = 3;
/** A frame is stepped in pieces no longer than this, so a slow frame can never tunnel through a brick. */
const MAX_STEP = 1 / 120;

/** A new game at the paddle, three lives, every brick standing. */
export function newGame(): Breakout {
  const bricks: Brick[] = [];
  for (let row = 0; row < BRICK_ROWS; row++)
    for (let col = 0; col < BRICK_COLS; col++)
      bricks.push({ x: 3 + col * 10, y: 5 + row * 5, w: 8, h: 3, colour: ROWS[row].colour, value: ROWS[row].value, alive: true });
  const paddle = { x: FIELD.w / 2 - PADDLE.w / 2, y: FIELD.h - 5, w: PADDLE.w, h: PADDLE.h };
  return { bricks, paddle, ball: { x: paddle.x + paddle.w / 2 - BALL / 2, y: paddle.y - BALL, vx: 0, vy: 0 }, phase: "serve", lives: LIVES, score: 0, serves: 0, speed: SPEED.first };
}

/** Put the ball back on the paddle waiting to be served. */
function onPaddle(g: Breakout): void {
  g.ball.x = g.paddle.x + g.paddle.w / 2 - BALL / 2;
  g.ball.y = g.paddle.y - BALL;
  g.ball.vx = 0;
  g.ball.vy = 0;
}

/** Launch the ball upward, leaning to a side that alternates serve by serve. */
function launch(g: Breakout): void {
  const side = g.serves % 2 === 0 ? 1 : -1;
  g.serves += 1;
  g.ball.vx = Math.sin(SERVE_ANGLE) * g.speed * side;
  g.ball.vy = -Math.cos(SERVE_ANGLE) * g.speed;
  g.phase = "play";
}

/** The ball's speed, rescaled when a brick speeds it up. */
function setSpeed(g: Breakout, speed: number): void {
  g.speed = speed;
  const v = Math.hypot(g.ball.vx, g.ball.vy);
  if (v < 1e-9) return;
  g.ball.vx = (g.ball.vx / v) * speed;
  g.ball.vy = (g.ball.vy / v) * speed;
}

const overlap = (b: { x: number; y: number; w: number; h: number }, x: number, y: number, w: number, h: number) => x + w > b.x && x < b.x + b.w && y + h > b.y && y < b.y + b.h;

/** Whether the game ended, so the caller stops stepping mid-frame. */
function stepPiece(g: Breakout, input: BreakoutInput, dt: number, events: BreakoutEvent[]): boolean {
  // The paddle answers in every live phase, clamped inside the field's edges.
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  g.paddle.x = Math.min(FIELD.w - 1 - g.paddle.w, Math.max(1, g.paddle.x + dir * PADDLE.speed * dt));
  if (g.phase === "serve") {
    onPaddle(g);
    if (input.serve) launch(g);
    return false;
  }
  if (g.phase !== "play") return true;
  g.ball.x += g.ball.vx * dt;
  g.ball.y += g.ball.vy * dt;
  if (g.ball.x < 0) {
    g.ball.x = 0;
    g.ball.vx = Math.abs(g.ball.vx);
    events.push({ kind: "wall" });
  } else if (g.ball.x + BALL > FIELD.w) {
    g.ball.x = FIELD.w - BALL;
    g.ball.vx = -Math.abs(g.ball.vx);
    events.push({ kind: "wall" });
  }
  if (g.ball.y < 0) {
    g.ball.y = 0;
    g.ball.vy = Math.abs(g.ball.vy);
    events.push({ kind: "wall" });
  }
  // Off the paddle: the hit's place across its width turns the ball back up, steeper nearer the ends.
  if (g.ball.vy > 0 && overlap(g.paddle, g.ball.x, g.ball.y, BALL, BALL)) {
    g.ball.y = g.paddle.y - BALL;
    const off = Math.min(1, Math.max(-1, (g.ball.x + BALL / 2 - (g.paddle.x + g.paddle.w / 2)) / (g.paddle.w / 2)));
    const a = off * PADDLE_ANGLE;
    g.ball.vx = Math.sin(a) * g.speed;
    g.ball.vy = -Math.cos(a) * g.speed;
    events.push({ kind: "paddle" });
  }
  // Into a brick: it breaks, scores its row's value, sends the ball back down and hurries it a little.
  const hit = g.bricks.find((b) => b.alive && overlap(b, g.ball.x, g.ball.y, BALL, BALL));
  if (hit) {
    hit.alive = false;
    g.score += hit.value;
    g.ball.vy = -g.ball.vy;
    setSpeed(g, Math.min(SPEED.max, g.speed + SPEED.perBrick));
    events.push({ kind: "brick", value: hit.value, x: hit.x + hit.w / 2, y: hit.y });
    if (g.bricks.every((b) => !b.alive)) {
      g.phase = "won";
      events.push({ kind: "won" });
      return true;
    }
    return false;
  }
  if (g.ball.y > FIELD.h) {
    g.lives -= 1;
    events.push({ kind: "lost" });
    if (g.lives <= 0) {
      g.phase = "over";
      events.push({ kind: "over" });
      return true;
    }
    g.phase = "serve";
    onPaddle(g);
  }
  return false;
}

/**
 * One frame of the game: the paddle steered by `input`, a serve launched, and the ball's bounces, bricks and
 * misses. Stepped in small pieces so a long frame still finds every collision; `dt` 0 changes nothing.
 */
export function step(g: Breakout, input: BreakoutInput, dt: number): { state: Breakout; events: BreakoutEvent[] } {
  const events: BreakoutEvent[] = [];
  if (dt <= 0 || g.phase === "won" || g.phase === "over") return { state: g, events };
  const pieces = Math.max(1, Math.ceil(dt / MAX_STEP));
  const h = dt / pieces;
  for (let i = 0; i < pieces; i++) {
    if (stepPiece(g, input, h, events)) break;
  }
  return { state: g, events };
}

/** Paint a frame of the game to the cabinet screen's 2D context, 64×52 pixels. */
export function drawBreakout(g2d: CanvasRenderingContext2D, state: Breakout, t: number): void {
  g2d.fillStyle = "#0b0d1a";
  g2d.fillRect(0, 0, FIELD.w, FIELD.h);
  if (state.phase === "won") {
    // The field kept, its rows cycling through the brick colours in celebration.
    for (let row = 0; row < BRICK_ROWS; row++)
      for (let col = 0; col < BRICK_COLS; col++) {
        g2d.fillStyle = ROWS[(row + Math.floor(t * 5)) % ROWS.length].colour;
        g2d.fillRect(3 + col * 10, 5 + row * 5, 8, 3);
      }
  } else {
    for (const b of state.bricks) {
      if (!b.alive) continue;
      g2d.fillStyle = b.colour;
      g2d.fillRect(Math.round(b.x), Math.round(b.y), b.w, b.h);
    }
  }
  g2d.fillStyle = "#3ddc84";
  g2d.fillRect(Math.round(state.paddle.x), state.paddle.y, state.paddle.w, state.paddle.h);
  // Waiting on the paddle the ball blinks, asking to be served.
  if (state.phase !== "serve" || Math.floor(t * 4) % 2 === 0) {
    g2d.fillStyle = "#f4f1ea";
    g2d.fillRect(Math.round(state.ball.x), Math.round(state.ball.y), BALL, BALL);
  }
  g2d.fillStyle = "#f4f1ea";
  for (let i = 0; i < state.lives; i++) g2d.fillRect(2 + i * 3, FIELD.h - 2, 1, 1);
  if (state.phase === "over") {
    g2d.fillStyle = "rgba(255, 77, 94, 0.35)";
    g2d.fillRect(0, 0, FIELD.w, FIELD.h);
  }
}
