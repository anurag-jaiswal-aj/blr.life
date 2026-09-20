import { describe, it, expect, vi } from "vitest";
import sitemap from "./sitemap";
import * as api from "@/lib/api";

// Mock the API module
vi.mock("@/lib/api", () => ({
  fetchLocalities: vi.fn(),
  fetchLocalityDetail: vi.fn(),
}));

describe("sitemap", () => {
  it("returns root and locality URLs when fetchLocalities succeeds", async () => {
    vi.mocked(api.fetchLocalities).mockResolvedValueOnce([
      { id: 1, name: "Locality A", slug: "locality-a", parent_zone: "Zone A" },
    ]);

    const entries = await sitemap();
    expect(entries).toHaveLength(2);
    expect(entries[0].url).toBe("https://blr.life/");
    expect(entries[1].url).toBe("https://blr.life/localities/locality-a");
  });

  it("throws an error when fetchLocalities fails, intentionally crashing the build", async () => {
    vi.mocked(api.fetchLocalities).mockRejectedValueOnce(
      new Error("API Unreachable")
    );

    await expect(sitemap()).rejects.toThrow("API Unreachable");
  });
});
