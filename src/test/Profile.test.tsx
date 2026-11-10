import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../app/App";
import { mockRoutes, renderWithProviders, storeSession } from "./renderWithProviders";

const PROFILE = {
  emp_id: "EMP003", full_name: "Test User", role: "pm", dept: "IT", email: "test@example.com", phone: null, gender: "Female",
  date_of_joining: "2022-01-03", date_of_birth: "1985-03-09", address: null, emergency_contact: null, manager_name: "Rahul Verma", is_active: true,
};

describe("my profile (/me)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    storeSession();
  });

  it("shows my own details, and Not recorded for empty ones", async () => {
    mockRoutes({ "GET /me/profile": { body: PROFILE } });
    renderWithProviders(<App />, "/me");
    expect(await screen.findByRole("heading", { name: "Test User" })).toBeInTheDocument();
    expect(screen.getByText("PM (project manager)")).toBeInTheDocument();
    expect(screen.getByText("Rahul Verma")).toBeInTheDocument();
    expect(screen.getByText("03 Jan 2022")).toBeInTheDocument();
    expect(screen.getAllByText("Not recorded").length).toBeGreaterThanOrEqual(3);
  });

  it("is reachable from the menu", async () => {
    mockRoutes({ "GET /me/profile": { body: PROFILE } });
    renderWithProviders(<App />, "/chat");
    expect(await screen.findByRole("link", { name: "My profile" })).toHaveAttribute("href", "/me");
  });

  it("shows the error when the profile cannot be loaded", async () => {
    mockRoutes({ "GET /me/profile": { status: 500, body: { detail: "down" } } });
    renderWithProviders(<App />, "/me");
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
