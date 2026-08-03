#!/usr/bin/env python3
import asyncio
import asyncpg
import numpy as np
import json
from pathlib import Path

DB_URL = "postgresql://blrlife:blrlife_dev_password@localhost:5432/blrlife"

async def main():
    conn = await asyncpg.connect(DB_URL)
    
    # 1. Fetch Localities
    localities = await conn.fetch("SELECT id, name, slug FROM locality WHERE is_active = true")
    locality_map = {r['id']: r['name'] for r in localities}
    
    # 2. Fetch Metrics
    query = """
    SELECT locality_id, metric_type, value
    FROM locality_metric
    WHERE metric_type::text LIKE '%accessibility%'
      AND confidence != 'insufficient'
    """
    rows = await conn.fetch(query)
    
    data = {}
    locality_counts = {m: [] for m in ['cafe', 'restaurant', 'park', 'healthcare', 'nightlife']}
    
    for r in rows:
        cat = r['metric_type'].replace("_accessibility", "")
        if cat not in data:
            data[cat] = []
        loc_name = locality_map.get(r['locality_id'], "Unknown")
        val = float(r['value'])
        data[cat].append({"locality": loc_name, "count": val})
        locality_counts[cat].append((loc_name, val))
        
    print("--- 1. Sorted Distributions ---")
    for cat in ['cafe', 'restaurant', 'park', 'healthcare', 'nightlife']:
        sorted_list = sorted(locality_counts[cat], key=lambda x: x[1], reverse=True)
        print(f"\n{cat.upper()}:")
        for loc, val in sorted_list:
            print(f"  {loc}: {int(val)}")

    print("\n--- 2. Percentiles & Stats ---")
    p90_exact = {}
    p90_int = {}
    for cat in ['cafe', 'restaurant', 'park', 'healthcare', 'nightlife']:
        arr = np.array([x[1] for x in locality_counts[cat]])
        
        # We calculate percentiles using the default numpy linear interpolation
        p25 = np.percentile(arr, 25)
        p50 = np.percentile(arr, 50)
        p75 = np.percentile(arr, 75)
        p90 = np.percentile(arr, 90)
        p95 = np.percentile(arr, 95)
        p90_exact[cat] = p90
        # The exact empirical P90 used in previous report was cast to int.
        # We will use exactly: Cafe: 59, Restaurant: 143, Park: 41, Healthcare: 83, Nightlife: 25
        # (This matches int(np.percentile(arr, 90)))
        
        p90_i = int(p90)
        p90_int[cat] = p90_i
        
        zeros = np.sum(arr == 0)
        above_p90 = np.sum(arr >= p90_i)
        
        print(f"\n{cat.upper()}:")
        print(f"  Count: {len(arr)}")
        print(f"  Min: {np.min(arr)}")
        print(f"  P25: {p25}")
        print(f"  P50: {p50}")
        print(f"  P75: {p75}")
        print(f"  P90: {p90} (Exact np.percentile), Int: {p90_i}")
        print(f"  P95: {p95}")
        print(f"  Max: {np.max(arr)}")
        print(f"  Zero-valued localities: {zeros}")
        print(f"  At or above P90 (>= {p90_i}): {above_p90}")

    print("\n--- 4 & 5. Normalized Score Distribution ---")
    old_caps = {"cafe": 15, "restaurant": 30, "park": 5, "healthcare": 5, "nightlife": 10}
    for cat in ['cafe', 'restaurant', 'park', 'healthcare', 'nightlife']:
        arr = np.array([x[1] for x in locality_counts[cat]])
        emp_p90 = p90_int[cat]
        old_cap = old_caps[cat]
        
        norm_emp = np.clip(arr / emp_p90, 0, 1.0)
        norm_old = np.clip(arr / old_cap, 0, 1.0)
        
        print(f"\n{cat.upper()} (P90 Cap: {emp_p90}, Old Cap: {old_cap}):")
        print(f"  EMPIRICAL NORM -> Min: {np.min(norm_emp):.2f}, P25: {np.percentile(norm_emp, 25):.2f}, P50: {np.percentile(norm_emp, 50):.2f}, P75: {np.percentile(norm_emp, 75):.2f}, Max: {np.max(norm_emp):.2f}")
        print(f"  OLD NORM       -> Min: {np.min(norm_old):.2f}, P25: {np.percentile(norm_old, 25):.2f}, P50: {np.percentile(norm_old, 50):.2f}, P75: {np.percentile(norm_old, 75):.2f}, Max: {np.max(norm_old):.2f}")
        print(f"  Saturated localities (score 1.0) using Empirical: {np.sum(norm_emp == 1.0)}")
        print(f"  Saturated localities (score 1.0) using Old Cap: {np.sum(norm_old == 1.0)}")

    print("\n--- 6 & 7. Data Quality and POI Counts ---")
    total_pois = await conn.fetchval("SELECT count(*) FROM amenity_poi")
    print(f"Total POIs in DB: {total_pois}")
    
    cat_counts = await conn.fetch("SELECT category, count(*) as c FROM amenity_poi GROUP BY category")
    sum_cats = 0
    for r in cat_counts:
        print(f"  {r['category']}: {r['c']}")
        sum_cats += r['c']
    print(f"  Sum of categories: {sum_cats}")
    
    dup_ids = await conn.fetchval("SELECT count(*) FROM (SELECT osm_id FROM amenity_poi GROUP BY osm_id HAVING count(*) > 1) sq")
    print(f"Duplicate OSM IDs: {dup_ids}")
    
    null_geom = await conn.fetchval("SELECT count(*) FROM amenity_poi WHERE geometry IS NULL")
    print(f"Null geometries: {null_geom}")
    
    outside_bbox = await conn.fetchval("""
        SELECT count(*) FROM amenity_poi 
        WHERE NOT ST_Intersects(geometry, ST_MakeEnvelope(77.3, 12.7, 77.9, 13.2, 4326))
    """)
    print(f"POIs outside BBOX: {outside_bbox}")
    
    loc_metrics_count = await conn.fetchval("SELECT count(DISTINCT locality_id) FROM locality_metric WHERE metric_type::text LIKE '%accessibility%'")
    print(f"Canonical localities with metrics: {loc_metrics_count} / {len(locality_map)}")
    
    null_snap = await conn.fetchval("SELECT count(*) FROM amenity_poi WHERE snapshot_id IS NULL")
    print(f"POIs missing snapshot: {null_snap}")

    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
