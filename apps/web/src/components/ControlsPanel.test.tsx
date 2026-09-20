import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ControlsPanel } from "./ControlsPanel";
import { AppState } from "../hooks/useUrlState";
import { describe, it, expect, vi } from "vitest";

describe("ControlsPanel (CONTROLS)", () => {
  const defaultState: AppState = {
    lat: 12.97,
    lng: 77.59,
    max_dist: 15,
    max_budget_inr: null,
    bhk_type: null,
    w_metro: 1,
    w_work: 1,
    w_cafe: 0,
    w_restaurant: 0,
    w_park: 0,
    w_healthcare: 0.0,
    w_nightlife: 0.0,
    loc: null,
    saved_ids: [],
  };

  it("renders preference controls when coordinates are present", () => {
    render(<ControlsPanel state={defaultState} updateState={vi.fn()} />);
    expect(screen.getByLabelText(/Maximum Distance/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Metro Importance/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Near Work Importance/i)).toBeInTheDocument();
  });

  it("updates state when sliders are changed", () => {
    const updateSpy = vi.fn();
    render(<ControlsPanel state={defaultState} updateState={updateSpy} />);

    fireEvent.change(screen.getByLabelText(/Maximum Distance/i), {
      target: { value: "20" },
    });
    expect(updateSpy).toHaveBeenCalledWith({ max_dist: 20 });

    fireEvent.change(screen.getByLabelText(/Metro Importance Weight/i), {
      target: { value: "0.5" },
    });
    expect(updateSpy).toHaveBeenCalledWith({ w_metro: 0.5 });

    fireEvent.change(screen.getByLabelText(/Near Work Importance Weight/i), {
      target: { value: "0.8" },
    });
    expect(updateSpy).toHaveBeenCalledWith({ w_work: 0.8 });
  });

  // WorkLocationInput is now rendered in RecommendationWorkspace

  it("updates amenity priorities when lifestyle accordion is toggled and selectors clicked", () => {
    const updateSpy = vi.fn();
    const { getByText } = render(
      <ControlsPanel state={defaultState} updateState={updateSpy} />,
    );

    fireEvent.click(getByText("Lifestyle Preferences"));

    const cafeLabel = getByText("Cafes").parentElement;
    if (cafeLabel) {
      const buttons = cafeLabel.querySelectorAll("button");
      expect(buttons[0]).toHaveAttribute("aria-pressed", "true");
      expect(buttons[1]).toHaveAttribute("aria-pressed", "false");

      const mustBtn = buttons[2];
      fireEvent.click(mustBtn);
      expect(updateSpy).toHaveBeenCalledWith({ w_cafe: 1.0 });
    }

    const diningLabel = getByText("Dining").parentElement;
    if (diningLabel) {
      const niceBtn = diningLabel.querySelectorAll("button")[1];
      fireEvent.click(niceBtn);
      expect(updateSpy).toHaveBeenCalledWith({ w_restaurant: 0.5 });
    }
  });

  it("renders budget controls and updates state", () => {
    const updateSpy = vi.fn();
    render(<ControlsPanel state={defaultState} updateState={updateSpy} />);

    const rentInput = screen.getByLabelText(/Max Rent/i);
    expect(rentInput).toBeInTheDocument();
    fireEvent.change(rentInput, { target: { value: "25000" } });
    expect(updateSpy).toHaveBeenCalledWith({ max_budget_inr: 25000 });

    const typeSelect = screen.getByLabelText(/Property Type/i);
    expect(typeSelect).toBeInTheDocument();
    fireEvent.change(typeSelect, { target: { value: "1bhk" } });
    expect(updateSpy).toHaveBeenCalledWith({ bhk_type: "1bhk" });
  });

  it("displays correct priority labels and accessibility text for sliders", () => {
    const stateWithMixedWeights: AppState = {
      ...defaultState,
      w_work: 0.5,
      w_metro: 1.0,
    };
    const { getByText, getByLabelText } = render(
      <ControlsPanel state={stateWithMixedWeights} updateState={vi.fn()} />,
    );

    expect(getByText("50% Priority")).toBeInTheDocument();
    expect(getByText("100% Priority")).toBeInTheDocument();

    const workSlider = getByLabelText(/Near Work Importance Weight/i);
    const metroSlider = getByLabelText(/Metro Importance Weight/i);
    const distSlider = getByLabelText(/Maximum Distance/i);

    expect(workSlider).toHaveAttribute("aria-valuetext", "50% Priority");
    expect(metroSlider).toHaveAttribute("aria-valuetext", "100% Priority");
    expect(distSlider).toHaveAttribute("aria-valuetext", "15 km");
  });
});
