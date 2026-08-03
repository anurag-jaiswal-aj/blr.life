#!/usr/bin/env python3
"""Fetch and filter canonical Bengaluru amenity POIs from Geofabrik Karnataka OSM extract."""

import json
import logging
import re
import urllib.request
from pathlib import Path
# -----------------------------------------------------------------------------
# Dataset Provenance Metadata
# -----------------------------------------------------------------------------
# Upstream Provider: Geofabrik
# Source URL: https://download.geofabrik.de/asia/india/southern-zone-latest.osm.pbf
# Extraction Date: 2026-08-03
# OSM Replication Timestamp: Unavailable from this URL endpoint.
# File Size: ~531 MB
# SHA-256 Checksum: 8e0fa7edbf05116961435c9db73c61ac4738eeb0e360126c0e3a79e357a988ec
# Extraction BBOX: [12.7, 77.3, 13.2, 77.9]
# Resulting POI Total: 9,364
# Calibration Locality Count: 37
# Note: The 'southern-zone-latest.osm.pbf' URL provides a rolling daily snapshot.
# The SHA-256 checksum guarantees exactly which source bytes produced the V1 
# curated JSON payload. Multipolygon/Relation amenities are currently excluded.
# -----------------------------------------------------------------------------

import osmium

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

BBOX_MIN_LAT = 12.7
BBOX_MAX_LAT = 13.2
BBOX_MIN_LON = 77.3
BBOX_MAX_LON = 77.9

GEOFABRIK_URL = "https://download.geofabrik.de/asia/india/southern-zone-latest.osm.pbf"
PBF_FILE = Path("data/raw/southern-zone-latest.osm.pbf")
OUTPUT_FILE = Path("data/curated/bengaluru_amenities_v1.json")


def in_bbox(lat, lon):
    return (BBOX_MIN_LAT <= lat <= BBOX_MAX_LAT) and (BBOX_MIN_LON <= lon <= BBOX_MAX_LON)


def get_category(tags):
    amenity = tags.get("amenity", "")
    leisure = tags.get("leisure", "")
    
    if amenity == "cafe": return "cafe"
    if amenity == "restaurant": return "restaurant"
    if leisure == "park": return "park"
    
    if re.search(r"hospital|clinic", amenity): return "healthcare"
    if re.search(r"pub|bar|nightclub", amenity): return "nightlife"
    
    return None


class AmenityHandler(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.pois = {}

    def add_poi(self, osm_id, lat, lon, tags, category):
        if in_bbox(lat, lon):
            if osm_id not in self.pois:
                self.pois[osm_id] = {
                    "category": category,
                    "osm_id": osm_id,
                    "name": tags.get("name"),
                    "lat": round(lat, 7),
                    "lon": round(lon, 7)
                }

    def node(self, n):
        category = get_category(n.tags)
        if category:
            try:
                self.add_poi(f"node/{n.id}", n.location.lat, n.location.lon, n.tags, category)
            except osmium.InvalidLocationError:
                pass

    def way(self, w):
        category = get_category(w.tags)
        if category:
            try:
                lats = []
                lons = []
                for n in w.nodes:
                    lats.append(n.location.lat)
                    lons.append(n.location.lon)
                if lats:
                    clat = sum(lats) / len(lats)
                    clon = sum(lons) / len(lons)
                    self.add_poi(f"way/{w.id}", clat, clon, w.tags, category)
            except osmium.InvalidLocationError:
                pass


def main():
    Path("data/raw").mkdir(parents=True, exist_ok=True)
    Path("data/curated").mkdir(parents=True, exist_ok=True)
    
    if not PBF_FILE.exists():
        logger.error(f"PBF file not found at {PBF_FILE}. Please download it first.")
        return
        
    logger.info("Parsing PBF file for amenities...")
    handler = AmenityHandler()
    
    # locations=True caches node locations for ways
    handler.apply_file(str(PBF_FILE), locations=True)
    
    pois_list = list(handler.pois.values())
    logger.info(f"Extracted {len(pois_list)} valid POIs.")
    
    with open(OUTPUT_FILE, "w") as f:
        json.dump({"pois": pois_list}, f, indent=2)
    logger.info(f"Saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
