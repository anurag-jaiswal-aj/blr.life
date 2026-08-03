#!/usr/bin/env python3
"""Fetch canonical Bengaluru amenity POIs from OpenStreetMap."""

import json
import logging
import sys
from pathlib import Path

import requests

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# Bounding box for Bengaluru to restrict Overpass queries
BBOX = "12.7,77.3,13.2,77.9"

# Mapping from our internal category names to Overpass query conditions
CATEGORIES = {
    "cafe": '["amenity"="cafe"]',
    "restaurant": '["amenity"="restaurant"]',
    "park": '["leisure"="park"]',
    "healthcare": '["amenity"~"hospital|clinic"]',
    "nightlife": '["amenity"~"pub|bar|nightclub"]',
}

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

def main() -> None:
    output_dir = Path("data/raw")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    output_file = output_dir / "osm_amenities.json"
    
    # Use a dictionary keyed by osm_id to ensure deduplication.
    # The first matching category determines the internal taxonomy mapping.
    all_pois: dict[str, dict] = {}
    
    # We query node, way, relation for each category using center out to get point geometry
    for category, osm_filter in CATEGORIES.items():
        logger.info(f"Fetching POIs for category: {category}")
        
        query = f"""
        [out:json][timeout:60];
        (
          node{osm_filter}({BBOX});
          way{osm_filter}({BBOX});
          relation{osm_filter}({BBOX});
        );
        out center;
        """
        
        try:
            resp = requests.post(OVERPASS_URL, data={"data": query}, headers={"User-Agent": "blrlife-ingestion/2.0"}, timeout=120)
            resp.raise_for_status()
            data = resp.json()
            
            elements = data.get("elements", [])
            logger.info(f"Retrieved {len(elements)} elements for {category}")
            
            for el in elements:
                osm_type = el["type"]
                osm_id = el["id"]
                
                # 'center' handles ways and relations; nodes just have 'lat' and 'lon'
                if osm_type == "node":
                    lat = el["lat"]
                    lon = el["lon"]
                else:
                    center = el.get("center")
                    if not center:
                        continue
                    lat = center["lat"]
                    lon = center["lon"]
                
                tags = el.get("tags", {})
                name = tags.get("name")
                
                poi_id = f"{osm_type}/{osm_id}"
                
                if poi_id in all_pois:
                    # Deduplicate: if an amenity matches multiple categories, we keep the first one
                    # encountered (which is deterministic based on the order of CATEGORIES dict).
                    logger.debug(f"Skipping duplicate POI {poi_id} (already mapped as {all_pois[poi_id]['category']})")
                    continue
                
                all_pois[poi_id] = {
                    "category": category,
                    "osm_id": poi_id,
                    "name": name,
                    "lat": lat,
                    "lon": lon
                }
                
        except Exception as e:
            logger.error(f"Failed to fetch {category}: {e}")
            sys.exit(1)
            
    with open(output_file, "w") as f:
        json.dump({"pois": list(all_pois.values())}, f, indent=2)
        
    logger.info(f"Successfully wrote {len(all_pois)} deduplicated POIs to {output_file}")

if __name__ == "__main__":
    main()
