import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StaticLocalityView } from "./StaticLocalityView";
import { LocalityDetailResponse } from "@/lib/api";

const mockLocality: LocalityDetailResponse = {
  id: 1,
  name: "Whitefield",
  slug: "whitefield",
  parent_zone: "East Bengaluru",
  centroid: { lat: 12.9698, lng: 77.7499 },
  metro: {
    station_name: "Whitefield",
    station_slug: "whitefield",
    line: "Purple",
    distance_m: 1200,
  },
  amenities: {
    cafes: 42,
    restaurants: 120,
    parks: 15,
    healthcare: 10,
    nightlife: 25,
  },
  rent: {
    min_inr: 25000,
    max_inr: 40000,
    confidence: "high",
  },
};

describe("StaticLocalityView", () => {
  it("renders locality name and parent zone", () => {
    render(<StaticLocalityView locality={mockLocality} />);
    expect(screen.getByRole("heading", { name: "Whitefield", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("East Bengaluru")).toBeInTheDocument();
  });

  it("renders metro information when available", () => {
    render(<StaticLocalityView locality={mockLocality} />);
    expect(screen.getByText("Whitefield", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText(/Purple Line/)).toBeInTheDocument();
    expect(screen.getByText(/1.2 km away/)).toBeInTheDocument();
  });

  it("renders amenity counts", () => {
    render(<StaticLocalityView locality={mockLocality} />);
    expect(screen.getByText("42")).toBeInTheDocument(); // Cafes
    expect(screen.getByText("120")).toBeInTheDocument(); // Restaurants
    expect(screen.getByText("15")).toBeInTheDocument(); // Parks
    expect(screen.getByText("10")).toBeInTheDocument(); // Healthcare
    expect(screen.getByText("25")).toBeInTheDocument(); // Nightlife
  });

  it("renders rent when present", () => {
    render(<StaticLocalityView locality={mockLocality} />);
    expect(screen.getByText(/25,000/)).toBeInTheDocument();
    expect(screen.getByText(/40,000/)).toBeInTheDocument();
    expect(screen.getByText(/Confidence: high/i)).toBeInTheDocument();
  });

  it("renders fallback messages when data is missing", () => {
    const missingDataLocality: LocalityDetailResponse = {
      ...mockLocality,
      metro: null,
      amenities: { cafes: null, restaurants: null, parks: null, healthcare: null, nightlife: null },
      rent: null,
    };
    render(<StaticLocalityView locality={missingDataLocality} />);
    expect(screen.getByText("Metro data unavailable.")).toBeInTheDocument();
    expect(screen.getByText("Rent data unavailable.")).toBeInTheDocument();
    // 5 amenities fallback to "-"
    const fallbacks = screen.getAllByText("-");
    expect(fallbacks).toHaveLength(5);
  });

  it("includes CTA link", () => {
    render(<StaticLocalityView locality={mockLocality} />);
    const link = screen.getByRole("link", { name: /Find your best-fit Bengaluru locality/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/");
  });

  it("does not render subjective terms", () => {
    render(<StaticLocalityView locality={mockLocality} />);
    // Sanity check - the component shouldn't have words like 'best' or 'premium' hardcoded except in CTA
    const textContent = document.body.textContent;
    expect(textContent).not.toMatch(/\b(premium|vibrant|peaceful)\b/i);
  });
});
