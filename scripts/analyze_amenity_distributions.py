#!/usr/bin/env python3
"""Analyze amenity metric distributions to derive empirical P90/P95 normalization caps."""

import json
from pathlib import Path
import numpy as np

# Use raw SQL connection to avoid full app setup if we just need quick analysis
import asyncio
import asyncpg

DB_URL = "postgresql://blrlife:blrlife_dev_password@localhost:5432/blrlife"

async def main():
    conn = await asyncpg.connect(DB_URL)
    
    # Get all amenity metrics
    query = """
    SELECT metric_type, value
    FROM locality_metric
    WHERE metric_type::text LIKE '%accessibility%'
      AND confidence != 'insufficient'
    """
    
    rows = await conn.fetch(query)
    await conn.close()
    
    # Organize by metric type
    data = {}
    for r in rows:
        mtype = r['metric_type']
        val = float(r['value'])
        if mtype not in data:
            data[mtype] = []
        data[mtype].append(val)
    
    results = {}
    
    for mtype, values in data.items():
        arr = np.array(values)
        cat = mtype.replace("_accessibility", "")
        
        results[cat] = {
            "count": len(arr),
            "min": int(np.min(arr)),
            "p50": int(np.percentile(arr, 50)),
            "p75": int(np.percentile(arr, 75)),
            "p90": int(np.percentile(arr, 90)),
            "p95": int(np.percentile(arr, 95)),
            "max": int(np.max(arr))
        }
        
    print(json.dumps(results, indent=2))
    
    # Save the report for the artifact
    out_dir = Path("reports")
    out_dir.mkdir(exist_ok=True)
    with open(out_dir / "amenity_distribution.json", "w") as f:
        json.dump(results, f, indent=2)

if __name__ == "__main__":
    asyncio.run(main())
