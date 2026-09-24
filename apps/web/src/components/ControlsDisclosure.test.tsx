import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ControlsDisclosure } from "./ControlsDisclosure";
import { AppState } from "../hooks/useUrlState";

describe("ControlsDisclosure", () => {
  const defaultState: AppState = {
    lat: 12.9716,
    lng: 77.5946,
    max_dist: 5,
    max_budget_inr: null,
    bhk_type: null,
    w_metro: 0.5,
    w_work: 0.5,
    w_cafe: 0.5,
    w_restaurant: 0.5,
    w_park: 0.5,
    w_healthcare: 0.5,
    w_nightlife: 0.5,
    saved_ids: [],
    compare_ids: [],
    loc: null,
    days: 5,
  };

  it("renders the Refine button", () => {
    render(<ControlsDisclosure state={defaultState} updateState={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Refine/i })).toBeInTheDocument();
  });

  it("opens the controls modal when clicked and renders into portal", () => {
    render(
      <ControlsDisclosure state={defaultState} updateState={vi.fn()} />,
    );

    expect(
      screen.queryByRole("heading", { name: /Refine recommendations/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Refine/i }));

    expect(
      screen.getByRole("heading", { name: /Refine recommendations/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Budget & Home")).toBeInTheDocument();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "refine-dialog-title");

    fireEvent.click(screen.getByLabelText("Close filters"));
    expect(
      screen.queryByRole("heading", { name: /Refine recommendations/i }),
    ).not.toBeInTheDocument();
  });

  it("manages focus trapping correctly (accessibility)", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <ControlsDisclosure state={defaultState} updateState={vi.fn()} />
        <button id="outside">Outside Element</button>
      </div>,
    );

    const trigger = screen.getByRole("button", { name: /Refine/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    // The first focusable element should be focused (Close button)
    const closeBtn = screen.getByLabelText("Close filters");
    expect(document.activeElement).toBe(closeBtn);

    // Tab through elements
    await user.tab();
    expect(document.activeElement).not.toBe(closeBtn); // focus moves to next control
    expect(dialog.contains(document.activeElement)).toBe(true);

    // Tab backwards (Shift+Tab) to return to the close button
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(closeBtn);

    // Shift+Tab again should wrap around to the last element in the dialog
    await user.tab({ shift: true });
    expect(document.activeElement).not.toBe(closeBtn);
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement?.id).not.toBe("outside"); // Should not escape dialog

    // Test Escape key
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    // Focus returns to trigger
    expect(document.activeElement).toBe(trigger);
  });
});
