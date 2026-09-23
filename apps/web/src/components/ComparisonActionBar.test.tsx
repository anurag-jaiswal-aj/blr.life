import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ComparisonActionBar } from "./ComparisonActionBar";

describe("ComparisonActionBar", () => {
  it("is hidden when zero localities are selected", () => {
    const { container } = render(
      <ComparisonActionBar compareCount={0} onClear={vi.fn()} onCompare={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows current selection count and requires one more when 1 locality is selected", () => {
    render(
      <ComparisonActionBar compareCount={1} onClear={vi.fn()} onCompare={vi.fn()} />,
    );
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByText("Add 1 more to compare")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Compare" })).toBeDisabled();
  });

  it("exposes Compare action when 2 localities are selected", () => {
    const onCompare = vi.fn();
    render(
      <ComparisonActionBar compareCount={2} onClear={vi.fn()} onCompare={onCompare} />,
    );
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    expect(screen.queryByText("Add 1 more to compare")).toBeNull();
    const compareBtn = screen.getByRole("button", { name: "Compare" });
    expect(compareBtn).not.toBeDisabled();
    fireEvent.click(compareBtn);
    expect(onCompare).toHaveBeenCalled();
  });

  it("exposes Compare action when 4 localities are selected", () => {
    render(
      <ComparisonActionBar compareCount={4} onClear={vi.fn()} onCompare={vi.fn()} />,
    );
    expect(screen.getByText("4 selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Compare" })).not.toBeDisabled();
  });

  it("provides a clear way to remove/clear the current comparison selection", () => {
    const onClear = vi.fn();
    render(
      <ComparisonActionBar compareCount={2} onClear={onClear} onCompare={vi.fn()} />,
    );
    const clearBtn = screen.getByLabelText("Clear comparison selection");
    fireEvent.click(clearBtn);
    expect(onClear).toHaveBeenCalled();
  });
});
