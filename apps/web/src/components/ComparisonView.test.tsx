import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ComparisonView } from "./ComparisonView";
import { RecommendationResult } from "../lib/api";

describe("ComparisonView", () => {
  const mockLocalities = [
    {
      locality_id: 1,
      name: "Locality 1",
      rank: 1,
      total_score: 85.5,
      raw_metrics: {
        work_distance_km: 5.2,
        metro_distance_m: 500,
        cafe_accessibility: 10,
        restaurant_accessibility: 20,
        park_accessibility: null,
        healthcare_accessibility: 5,
        nightlife_accessibility: 2,
      },
      affordability: {
        status: "affordable",
        rent_min_inr: 20000,
        rent_max_inr: 30000,
        confidence: "high",
      },
      explanations: {
        pros: ["Great parks", "Good metro"],
        warnings: ["High traffic"],
      },
    },
    {
      locality_id: 2,
      name: "Locality 2",
      rank: 0,
      total_score: 70.0,
      raw_metrics: {
        work_distance_km: 12.0,
        metro_distance_m: null,
        cafe_accessibility: null,
        restaurant_accessibility: 5,
        park_accessibility: 1,
        healthcare_accessibility: null,
        nightlife_accessibility: null,
      },
      affordability: {
        status: "unknown",
        rent_min_inr: null,
        rent_max_inr: null,
        confidence: null,
      },
      explanations: {
        pros: [],
        warnings: [],
      },
    },
  ] as unknown as RecommendationResult[];

  it("renders 2 localities side-by-side with their names", () => {
    render(<ComparisonView localities={mockLocalities} onClose={() => {}} />);
    expect(screen.getByText("Locality 1")).toBeInTheDocument();
    expect(screen.getByText("Locality 2")).toBeInTheDocument();
  });

  it("displays correct BLR scores", () => {
    render(<ComparisonView localities={mockLocalities} onClose={() => {}} />);
    expect(screen.getByText("86")).toBeInTheDocument(); // 85.5 rounds to 86
    expect(screen.getByText("70")).toBeInTheDocument();
  });

  it("renders valid rank and hides unavailable rank", () => {
    render(<ComparisonView localities={mockLocalities} onClose={() => {}} />);
    expect(screen.getByText("#1")).toBeInTheDocument();
    // Rank 0 should show as '—'
    const rankRow = screen.getByRole("rowheader", { name: "Rank" }).closest("tr")!;
    expect(within(rankRow as HTMLElement).getAllByText("—").length).toBeGreaterThan(0);
  });

  it("renders rent properly formatting est and missing rent", () => {
    render(<ComparisonView localities={mockLocalities} onClose={() => {}} />);
    expect(screen.getByText("₹20,000–₹30,000")).toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
  });

  it("renders missing and present commute and metro distance", () => {
    render(<ComparisonView localities={mockLocalities} onClose={() => {}} />);
    // 500 m
    expect(screen.getByText("500 m")).toBeInTheDocument();
    // 5.2 km
    expect(screen.getByText("5.2 km")).toBeInTheDocument();
    // Missing metro
    const metroRow = screen.getByRole("rowheader", { name: "Metro Access" }).closest("tr")!;
    expect(within(metroRow as HTMLElement).getByText("—")).toBeInTheDocument();
  });

  it("renders missing and present amenities", () => {
    render(<ComparisonView localities={mockLocalities} onClose={() => {}} />);
    expect(screen.getByText("10 nearby")).toBeInTheDocument();

    // Check parks (1 missing, 1 present)
    const parksRow = screen.getByRole("rowheader", { name: "Parks" }).closest("tr")!;
    expect(within(parksRow as HTMLElement).getByText("1 nearby")).toBeInTheDocument();
    expect(within(parksRow as HTMLElement).getByText("—")).toBeInTheDocument();
  });

  it("renders pros and trade-offs correctly including empty cases", () => {
    render(<ComparisonView localities={mockLocalities} onClose={() => {}} />);
    expect(screen.getByText("Great parks")).toBeInTheDocument();
    expect(screen.getByText("High traffic")).toBeInTheDocument();

    // Check that empty lists render '—'
    const prosRow = screen.getByRole("rowheader", { name: "Pros" }).closest("tr")!;
    expect(within(prosRow as HTMLElement).getByText("—")).toBeInTheDocument();

    const warningsRow = screen.getByRole("rowheader", { name: "Trade-offs" }).closest("tr")!;
    expect(within(warningsRow as HTMLElement).getByText("—")).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", () => {
    const handleClose = vi.fn();
    render(<ComparisonView localities={mockLocalities} onClose={handleClose} />);
    const closeBtn = screen.getByRole("button", { name: /Close comparison/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("uses semantic table structure", () => {
    render(<ComparisonView localities={mockLocalities} onClose={() => {}} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").length).toBe(3); // Metrics + 2 localities
  });
});
