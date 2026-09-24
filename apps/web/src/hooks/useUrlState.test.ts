/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderHook, act } from "@testing-library/react";
import { useUrlState } from "./useUrlState";
import { vi, describe, it, expect, beforeEach } from "vitest";
import * as navigation from "next/navigation";

describe("useUrlState", () => {
  beforeEach(() => {
    (navigation as any).__setSearchParams("");
    vi.clearAllMocks();
  });

  it("initializes with default state when URL is empty", () => {
    const { result } = renderHook(() => useUrlState());
    expect(result.current.state).toEqual({
      lat: null,
      lng: null,
      max_dist: 15.0,
      w_metro: 1.0,
      w_work: 1.0,
      w_cafe: 0.0,
      w_restaurant: 0.0,
      w_park: 0.0,
      w_healthcare: 0.0,
      w_nightlife: 0.0,
      max_budget_inr: null,
      bhk_type: null,
      loc: null,
      saved_ids: [],
      compare_ids: [],
      days: 5,
    });
  });

  it("parses valid query parameters correctly (URL PARSING)", () => {
    (navigation as any).__setSearchParams(
      "lat=12.9&lng=77.6&max_dist=10&w_metro=0.5&w_work=0.8&w_cafe=0.1&w_rest=0.2&w_park=0.3&w_health=0.4&w_night=0.5",
    );
    const { result } = renderHook(() => useUrlState());
    expect(result.current.state).toEqual({
      lat: 12.9,
      lng: 77.6,
      max_dist: 10.0,
      w_metro: 0.5,
      w_work: 0.8,
      w_cafe: 0.1,
      w_restaurant: 0.2,
      w_park: 0.3,
      w_healthcare: 0.4,
      w_nightlife: 0.5,
      max_budget_inr: null,
      bhk_type: null,
      loc: null,
      saved_ids: [],
      compare_ids: [],
      days: 5,
    });
  });

  it("handles malformed and invalid URLs safely (MALFORMED URL HANDLING)", () => {
    (navigation as any).__setSearchParams(
      "lat=invalid&lng=NaN&max_dist=-5&w_metro=1.5&w_work=-0.1&w_cafe=-1&w_rest=5&w_park=invalid&w_health=NaN&w_night=2",
    );
    const { result } = renderHook(() => useUrlState());
    expect(result.current.state).toEqual({
      lat: null,
      lng: null,
      max_dist: 15.0,
      w_metro: 1.0,
      w_work: 1.0,
      w_cafe: 0.0,
      w_restaurant: 0.0,
      w_park: 0.0,
      w_healthcare: 0.0,
      w_nightlife: 0.0,
      max_budget_inr: null,
      bhk_type: null,
      loc: null,
      saved_ids: [],
      compare_ids: [],
      days: 5,
    });
  });

  it("updates state and uses router.replace by default (URL SERIALIZATION)", () => {
    const replaceMock = (navigation as any).__getReplaceMock();
    const { result } = renderHook(() => useUrlState());

    act(() => {
      result.current.updateState({
        lat: 13.0,
        lng: 77.5,
        max_dist: 5,
        w_metro: 0,
        w_work: 0,
        w_cafe: 1.0,
        w_restaurant: 1.0,
        w_park: 1.0,
        w_healthcare: 1.0,
        w_nightlife: 1.0,
      });
    });

    expect(replaceMock).toHaveBeenCalled();
    const replaceUrl = replaceMock.mock.calls[0][0];
    expect(replaceUrl).toContain("lat=13");
    expect(replaceUrl).toContain("lng=77.5");
    expect(replaceUrl).toContain("max_dist=5");
    expect(replaceUrl).toContain("w_metro=0");
    expect(replaceUrl).toContain("w_work=0");
    expect(replaceUrl).toContain("w_cafe=1");
    expect(replaceUrl).toContain("w_rest=1");
    expect(replaceUrl).toContain("w_park=1");
    expect(replaceUrl).toContain("w_health=1");
    expect(replaceUrl).toContain("w_night=1");
  });

  it("updates state and uses router.push when explicit history is push", () => {
    const pushMock = (navigation as any).__getPushMock();
    const { result } = renderHook(() => useUrlState());

    act(() => {
      result.current.updateState({ lat: 13.0, lng: 77.5 }, { history: "push" });
    });

    expect(pushMock).toHaveBeenCalled();
    const pushUrl = pushMock.mock.calls[0][0];
    expect(pushUrl).toContain("lat=13");
    expect(pushUrl).toContain("lng=77.5");
  });

  it("updates state and uses router.replace when explicit history is replace", () => {
    const replaceMock = (navigation as any).__getReplaceMock();
    const { result } = renderHook(() => useUrlState());

    act(() => {
      result.current.updateState(
        { lat: 13.0, lng: 77.5 },
        { history: "replace" },
      );
    });

    expect(replaceMock).toHaveBeenCalled();
    const replaceUrl = replaceMock.mock.calls[0][0];
    expect(replaceUrl).toContain("lat=13");
    expect(replaceUrl).toContain("lng=77.5");
  });

  it("does not append parameters if they match DEFAULT_STATE or are NaN", () => {
    const replaceMock = (navigation as any).__getReplaceMock();
    const { result } = renderHook(() => useUrlState());

    act(() => {
      result.current.updateState({
        lat: NaN,
        lng: NaN,
        max_dist: 15.0,
        w_metro: 1.0,
        w_work: 1.0,
        w_cafe: 0.0,
        w_restaurant: 0.0,
        w_park: 0.0,
        w_healthcare: 0.0,
        w_nightlife: 0.0,
      });
    });

    const replaceUrl = replaceMock.mock.calls[0][0];
    expect(replaceUrl).toBe("/");
  });

  it("maintains determinism between state updates and URL generation (URL DETERMINISM)", () => {
    const replaceMock = (navigation as any).__getReplaceMock();
    const { result, rerender } = renderHook(() => useUrlState());

    act(() => {
      result.current.updateState({ lat: 12.9, lng: 77.6 });
    });

    const replaceUrl = replaceMock.mock.calls[0][0];
    (navigation as any).__setSearchParams(replaceUrl.split("?")[1] || "");
    rerender();

    expect(result.current.state.lat).toBe(12.9);
  });

  it("does not generate API request when coordinates are missing", () => {
    const { result } = renderHook(() => useUrlState());
    expect(result.current.getApiRequest()).toBeNull();
  });

  it("generates valid API request payload when state is populated", () => {
    (navigation as any).__setSearchParams(
      "lat=12.9&lng=77.6&max_dist=20&w_metro=0.9&w_work=0.2&w_cafe=1&w_rest=0.5",
    );
    const { result } = renderHook(() => useUrlState());

    const req = result.current.getApiRequest();
    expect(req).toEqual({
      work_location: { lat: 12.9, lng: 77.6 },
      constraints: { max_work_distance_km: 20 },
      preferences: {
        metro_access_weight: 0.9,
        short_commute_weight: 0.2,
        cafe_weight: 1,
        restaurant_weight: 0.5,
        park_weight: 0,
        healthcare_weight: 0,
        nightlife_weight: 0,
      },
    });
  });

  it("restores state from shareable URL with complete housing constraints", () => {
    (navigation as any).__setSearchParams(
      "lat=12.9&lng=77.6&max_dist=20&max_budget=30000&bhk=2bhk",
    );
    const { result } = renderHook(() => useUrlState());

    expect(result.current.state.max_budget_inr).toBe(30000);
    expect(result.current.state.bhk_type).toBe("2bhk");

    const req = result.current.getApiRequest();
    expect(req?.constraints.max_budget_inr).toBe(30000);
    expect(req?.constraints.bhk_type).toBe("2bhk");
  });

  it("returns undefined API request when housing constraints are incomplete (budget only)", () => {
    (navigation as any).__setSearchParams("lat=12.9&lng=77.6&max_budget=30000");
    const { result } = renderHook(() => useUrlState());

    expect(result.current.state.max_budget_inr).toBe(30000);
    expect(result.current.state.bhk_type).toBeNull();

    const req = result.current.getApiRequest();
    expect(req).toBeUndefined(); // preserves previous state
  });

  it("returns undefined API request when housing constraints are incomplete (bhk only)", () => {
    (navigation as any).__setSearchParams("lat=12.9&lng=77.6&bhk=1bhk");
    const { result } = renderHook(() => useUrlState());

    expect(result.current.state.max_budget_inr).toBeNull();
    expect(result.current.state.bhk_type).toBe("1bhk");

    const req = result.current.getApiRequest();
    expect(req).toBeUndefined(); // preserves previous state
  });

  it("parses saved locality IDs from URL correctly", () => {
    (navigation as any).__setSearchParams(
      "lat=12.9&lng=77.6&saved=101,102,103",
    );
    const { result } = renderHook(() => useUrlState());

    expect(result.current.state.saved_ids).toEqual([101, 102, 103]);

    const req = result.current.getApiRequest();
    expect(req?.include_locality_ids).toEqual([101, 102, 103]);
  });

  it("handles malformed saved IDs safely, normalizing duplicates and filtering NaNs", () => {
    (navigation as any).__setSearchParams(
      "lat=12.9&lng=77.6&saved=101,invalid,102,101,NaN,103,103",
    );
    const { result } = renderHook(() => useUrlState());

    expect(result.current.state.saved_ids).toEqual([101, 102, 103]);

    const req = result.current.getApiRequest();
    expect(req?.include_locality_ids).toEqual([101, 102, 103]);
  });

  it("serializes saved IDs to the URL correctly", () => {
    const replaceMock = (navigation as any).__getReplaceMock();
    const { result } = renderHook(() => useUrlState());

    act(() => {
      result.current.updateState({
        lat: 13.0,
        lng: 77.5,
        saved_ids: [102, 101, 102],
      });
    });

    const replaceUrl = replaceMock.mock.calls[0][0];
    // URL search params encodes commas
    expect(replaceUrl).toContain("saved=101%2C102");
  });

  it("parses compare_ids from URL correctly (one valid ID)", () => {
    (navigation as any).__setSearchParams("lat=12.9&lng=77.6&comp=42");
    const { result } = renderHook(() => useUrlState());
    expect(result.current.state.compare_ids).toEqual([42]);
    const req = result.current.getApiRequest();
    expect(req?.include_locality_ids).toEqual([42]);
  });

  it("parses compare_ids from URL correctly (multiple valid IDs)", () => {
    (navigation as any).__setSearchParams("lat=12.9&lng=77.6&comp=10,20,30");
    const { result } = renderHook(() => useUrlState());
    expect(result.current.state.compare_ids).toEqual([10, 20, 30]);
    const req = result.current.getApiRequest();
    expect(req?.include_locality_ids).toEqual([10, 20, 30]);
  });

  it("deduplicates compare_ids", () => {
    (navigation as any).__setSearchParams("lat=12.9&lng=77.6&comp=15,15,15,16");
    const { result } = renderHook(() => useUrlState());
    expect(result.current.state.compare_ids).toEqual([15, 16]);
  });

  it("enforces a maximum of 4 compare_ids", () => {
    (navigation as any).__setSearchParams("lat=12.9&lng=77.6&comp=1,2,3,4,5,6");
    const { result } = renderHook(() => useUrlState());
    expect(result.current.state.compare_ids).toEqual([1, 2, 3, 4]);
  });

  it("ignores malformed and non-positive compare_ids", () => {
    (navigation as any).__setSearchParams("lat=12.9&lng=77.6&comp=abc,-5,0,42,NaN");
    const { result } = renderHook(() => useUrlState());
    expect(result.current.state.compare_ids).toEqual([42]);
  });

  it("does not alter existing saved_ids behavior when compare_ids is empty", () => {
    (navigation as any).__setSearchParams("lat=12.9&lng=77.6&saved=99,100");
    const { result } = renderHook(() => useUrlState());
    expect(result.current.state.compare_ids).toEqual([]);
    expect(result.current.state.saved_ids).toEqual([99, 100]);
    const req = result.current.getApiRequest();
    expect(req?.include_locality_ids).toEqual([99, 100]);
  });

  it("unions compare_ids and saved_ids in getApiRequest without duplicating", () => {
    (navigation as any).__setSearchParams("lat=12.9&lng=77.6&saved=100,200&comp=200,300");
    const { result } = renderHook(() => useUrlState());
    expect(result.current.state.saved_ids).toEqual([100, 200]);
    expect(result.current.state.compare_ids).toEqual([200, 300]);

    const req = result.current.getApiRequest();
    // 100, 200, 300 (deduplicated)
    expect(req?.include_locality_ids).toEqual([100, 200, 300]);
  });

  it("serializes compare_ids correctly and preserves other state", () => {
    const replaceMock = (navigation as any).__getReplaceMock();
    const { result } = renderHook(() => useUrlState());

    act(() => {
      result.current.updateState({
        lat: 13.0,
        lng: 77.5,
        saved_ids: [10],
        compare_ids: [25, 20, 25, -1, NaN], // should normalize to 20, 25
      });
    });

    const replaceUrl = replaceMock.mock.calls[0][0];
    expect(replaceUrl).toContain("lat=13");
    expect(replaceUrl).toContain("lng=77.5");
    expect(replaceUrl).toContain("saved=10");
    expect(replaceUrl).toContain("comp=20%2C25");
  });

  it("does not emit comp when compare_ids is empty", () => {
    const replaceMock = (navigation as any).__getReplaceMock();
    const { result } = renderHook(() => useUrlState());

    act(() => {
      result.current.updateState({
        lat: 13.0,
        lng: 77.5,
        compare_ids: [],
      });
    });

    const replaceUrl = replaceMock.mock.calls[0][0];
    expect(replaceUrl).not.toContain("comp=");
    expect(replaceUrl).toContain("lat=13");
  });
  it("parses valid days parameter correctly", () => {
    (navigation as any).__setSearchParams("lat=12.9&lng=77.6&days=2");
    const { result } = renderHook(() => useUrlState());
    expect(result.current.state.days).toBe(2);
  });

  it("parses days=0 correctly", () => {
    (navigation as any).__setSearchParams("lat=12.9&lng=77.6&days=0");
    const { result } = renderHook(() => useUrlState());
    expect(result.current.state.days).toBe(0);
  });

  it("falls back to 5 for negative days", () => {
    (navigation as any).__setSearchParams("lat=12.9&lng=77.6&days=-1");
    const { result } = renderHook(() => useUrlState());
    expect(result.current.state.days).toBe(5);
  });

  it("falls back to 5 for days greater than 5", () => {
    (navigation as any).__setSearchParams("lat=12.9&lng=77.6&days=6");
    const { result } = renderHook(() => useUrlState());
    expect(result.current.state.days).toBe(5);
  });

  it("falls back to 5 for malformed days", () => {
    (navigation as any).__setSearchParams("lat=12.9&lng=77.6&days=abc");
    const { result } = renderHook(() => useUrlState());
    expect(result.current.state.days).toBe(5);
  });

  it("serializes days when different from default", () => {
    const replaceMock = (navigation as any).__getReplaceMock();
    const { result } = renderHook(() => useUrlState());

    act(() => {
      result.current.updateState({
        lat: 13.0,
        lng: 77.5,
        days: 3,
      });
    });

    const replaceUrl = replaceMock.mock.calls[0][0];
    expect(replaceUrl).toContain("days=3");
  });

  it("does not serialize days when it matches default", () => {
    const replaceMock = (navigation as any).__getReplaceMock();
    const { result } = renderHook(() => useUrlState());

    act(() => {
      result.current.updateState({
        lat: 13.0,
        lng: 77.5,
        days: 5,
      });
    });

    const replaceUrl = replaceMock.mock.calls[0][0];
    expect(replaceUrl).not.toContain("days=");
  });

  describe("getApiRequest with Office Days scaling", () => {
    it("preserves the existing work weight when days=5 (100%)", () => {
      (navigation as any).__setSearchParams("lat=12.9&lng=77.6&w_work=1.0&days=5");
      const { result } = renderHook(() => useUrlState());
      const req = result.current.getApiRequest();
      expect(req?.preferences.short_commute_weight).toBe(1.0);
    });

    it("scales work weight correctly for days=4 (80%)", () => {
      (navigation as any).__setSearchParams("lat=12.9&lng=77.6&w_work=1.0&days=4");
      const { result } = renderHook(() => useUrlState());
      const req = result.current.getApiRequest();
      expect(req?.preferences.short_commute_weight).toBe(0.8);
    });

    it("scales work weight correctly for days=3 (60%)", () => {
      (navigation as any).__setSearchParams("lat=12.9&lng=77.6&w_work=1.0&days=3");
      const { result } = renderHook(() => useUrlState());
      const req = result.current.getApiRequest();
      expect(req?.preferences.short_commute_weight).toBe(0.6);
    });

    it("scales work weight correctly for days=2 (40%)", () => {
      (navigation as any).__setSearchParams("lat=12.9&lng=77.6&w_work=1.0&days=2");
      const { result } = renderHook(() => useUrlState());
      const req = result.current.getApiRequest();
      expect(req?.preferences.short_commute_weight).toBe(0.4);
    });

    it("scales work weight correctly for days=1 (20%)", () => {
      (navigation as any).__setSearchParams("lat=12.9&lng=77.6&w_work=1.0&days=1");
      const { result } = renderHook(() => useUrlState());
      const req = result.current.getApiRequest();
      expect(req?.preferences.short_commute_weight).toBe(0.2);
    });

    it("scales work weight correctly for days=0 (0%)", () => {
      (navigation as any).__setSearchParams("lat=12.9&lng=77.6&w_work=1.0&days=0");
      const { result } = renderHook(() => useUrlState());
      const req = result.current.getApiRequest();
      expect(req?.preferences.short_commute_weight).toBe(0);
    });

    it("scales Low base weight (0.5) correctly across days", () => {
      (navigation as any).__setSearchParams("lat=12.9&lng=77.6&w_work=0.5&days=3");
      const { result } = renderHook(() => useUrlState());
      const req = result.current.getApiRequest();
      expect(req?.preferences.short_commute_weight).toBe(0.3);
    });

    it("leaves other recommendation weights unchanged", () => {
      (navigation as any).__setSearchParams("lat=12.9&lng=77.6&w_work=1.0&w_metro=1.0&days=2");
      const { result } = renderHook(() => useUrlState());
      const req = result.current.getApiRequest();
      expect(req?.preferences.short_commute_weight).toBe(0.4);
      expect(req?.preferences.metro_access_weight).toBe(1.0);
    });

    it("does not send an office_days field to the API", () => {
      (navigation as any).__setSearchParams("lat=12.9&lng=77.6&w_work=1.0&days=2");
      const { result } = renderHook(() => useUrlState());
      const req = result.current.getApiRequest();
      expect(req as any).not.toHaveProperty("office_days");
      expect(req?.preferences).not.toHaveProperty("office_days");
    });
  });
});
