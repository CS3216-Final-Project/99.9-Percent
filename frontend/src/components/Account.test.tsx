import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { newGame } from "@/sim";
import { makeEnvelope } from "@/game/saveEnvelope";
import { useGame } from "@/game/store";
import * as api from "@/lib/api";
import { AccountButton, AccountSection } from "./Account";

vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  getSession: vi.fn(), listRuns: vi.fn(), getRun: vi.fn(), putRun: vi.fn(), logout: vi.fn(), emailLogin: vi.fn(), emailRegister: vi.fn(),
}));
const ada = { account: { id: "ada", displayName: "Ada Lovelace" }, csrfToken: "csrf" };
beforeEach(() => {
  localStorage.clear();
  useGame.setState(useGame.getInitialState(), true);
  vi.clearAllMocks();
  vi.mocked(api.getSession).mockRejectedValue(new api.AccountApiError(401, { error: "guest" }));
  vi.mocked(api.listRuns).mockResolvedValue([]);
  vi.mocked(api.logout).mockResolvedValue();
  useGame.getState().boot();
});
afterEach(cleanup);

async function openAccount() {
  render(<StrictMode><AccountButton /></StrictMode>);
  fireEvent.click(await screen.findByRole("button", { name: /Sign in/ }));
  return screen.getByRole("dialog", { name: "Account" });
}

it("offers Google and email sign-in, and signs in with email in place", async () => {
  const dialog = await openAccount();
  expect(within(dialog).getByRole("link", { name: "Continue with Google" }).getAttribute("href")).toBe("/api/auth/google");
  vi.mocked(api.emailLogin).mockResolvedValue(ada);
  fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: " ada@example.com " } });
  fireEvent.change(within(dialog).getByLabelText("Password"), { target: { value: "analytical-engine" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Sign in" }));
  expect(await within(dialog).findByText("Ada Lovelace")).toBeTruthy();
  expect(api.emailLogin).toHaveBeenCalledWith("ada@example.com", "analytical-engine");
  expect(api.putRun).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: /Ada Lovelace/ })).toBeTruthy();
});

it("keeps the form and shows the reason when email sign-in fails", async () => {
  const dialog = await openAccount();
  vi.mocked(api.emailLogin).mockRejectedValue(new api.AccountApiError(401, { error: "Email or password is incorrect." }));
  fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: "ada@example.com" } });
  fireEvent.change(within(dialog).getByLabelText("Password"), { target: { value: "wrong-password" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Sign in" }));
  expect((await within(dialog).findByRole("alert")).textContent).toBe("Email or password is incorrect.");
  expect((within(dialog).getByLabelText("Email") as HTMLInputElement).value).toBe("ada@example.com");
  expect(useGame.getState().accountSession).toBeNull();
});

it("creates an account with an optional name and a new password", async () => {
  const dialog = await openAccount();
  fireEvent.click(within(dialog).getByRole("button", { name: "Create an account" }));
  const password = within(dialog).getByLabelText("Password") as HTMLInputElement;
  expect(password.autocomplete).toBe("new-password");
  expect(password.minLength).toBe(8);
  fireEvent.click(within(dialog).getByRole("button", { name: "Show password" }));
  expect(password.type).toBe("text");
  vi.mocked(api.emailRegister).mockResolvedValue(ada);
  fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: " Ada Lovelace " } });
  fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: "ada@example.com" } });
  fireEvent.change(password, { target: { value: "analytical-engine" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Create account" }));
  await waitFor(() => expect(useGame.getState().accountSession).toBe(ada));
  expect(api.emailRegister).toHaveBeenCalledWith("ada@example.com", "analytical-engine", "Ada Lovelace");
});

it("lists cloud saves once signed in, loads one and closes, and signs out", async () => {
  vi.mocked(api.getSession).mockResolvedValue(ada);
  const remote = makeEnvelope(newGame(6, "cloud-company"), 0);
  vi.mocked(api.listRuns).mockResolvedValue([{ runId: remote.runId, revision: 3, updatedAt: "2026-10-10T08:00:00Z" }]);
  vi.mocked(api.getRun).mockResolvedValue({ runId: remote.runId, revision: 3, envelope: remote, updatedAt: "2026-10-10T08:00:00Z" });
  render(<StrictMode><AccountButton /></StrictMode>);
  fireEvent.click(await screen.findByRole("button", { name: /Ada Lovelace/ }));
  const dialog = screen.getByRole("dialog", { name: "Account" });
  expect(within(dialog).getByText(/No Campaign game in this browser yet/)).toBeTruthy();
  const row = (await within(dialog).findByText(/version 3/)).closest("li")!;
  expect(api.listRuns).toHaveBeenCalledTimes(1);
  fireEvent.click(within(row).getByRole("button", { name: /^Load cloud save from/ }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(useGame.getState()).toMatchObject({ hasRun: true, started: false });
  expect(useGame.getState().game.campaign!.runId).toBe("cloud-company");

  fireEvent.click(screen.getByRole("button", { name: /Ada Lovelace/ }));
  const reopened = screen.getByRole("dialog", { name: "Account" });
  expect(await within(reopened).findByText("Campaign save (this game)")).toBeTruthy();
  fireEvent.click(within(reopened).getByRole("button", { name: "Sign out" }));
  expect(await screen.findByRole("link", { name: "Continue with Google" })).toBeTruthy();
  expect(useGame.getState().game.campaign!.runId).toBe("cloud-company");
});

it("does not claim the account is empty when its cloud saves cannot be listed", async () => {
  vi.mocked(api.getSession).mockResolvedValue(ada);
  vi.mocked(api.listRuns).mockRejectedValueOnce(TypeError("Failed to fetch"));
  render(<StrictMode><AccountSection /></StrictMode>);
  expect(await screen.findByText(/could not be listed/)).toBeTruthy();
  expect(screen.queryByText("No cloud saves yet.")).toBeNull();
  expect(screen.getByText("Cloud saves are unavailable right now. Your local save is unchanged.")).toBeTruthy();
  vi.mocked(api.listRuns).mockResolvedValue([]);
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
  expect(await screen.findByText("No cloud saves yet.")).toBeTruthy();
});

it("explains in Menu, Saves that Classic progress stays in this browser", async () => {
  vi.mocked(api.getSession).mockResolvedValue(ada);
  useGame.getState().switchMode("classic");
  render(<StrictMode><AccountSection /></StrictMode>);
  expect(await screen.findByText("Cloud saves are for Campaign. Classic progress stays in this browser.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Save to cloud" })).toBeNull();
});
