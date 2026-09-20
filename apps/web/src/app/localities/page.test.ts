import { describe, it, expect, vi } from "vitest";
import { generateStaticParams } from "./[slug]/page";
import * as api from "@/lib/api";

// Mock the API module
vi.mock("@/lib/api", () => ({
  fetchLocalities: vi.fn(),
  fetchLocalityDetail: vi.fn(),
}));

describe("generateStaticParams", () => {
  it("returns slugs when fetchLocalities succeeds", async () => {
    vi.mocked(api.fetchLocalities).mockResolvedValueOnce([
      { id: 1, name: "Locality A", slug: "locality-a", parent_zone: "Zone A" },
      { id: 2, name: "Locality B", slug: "locality-b", parent_zone: "Zone B" },
    ]);

    const params = await generateStaticParams();
    expect(params).toEqual([{ slug: "locality-a" }, { slug: "locality-b" }]);
  });

  it("throws an error when fetchLocalities fails, intentionally crashing the build", async () => {
    vi.mocked(api.fetchLocalities).mockRejectedValueOnce(
      new Error("API Unreachable")
    );

    await expect(generateStaticParams()).rejects.toThrow("API Unreachable");
  });
});
