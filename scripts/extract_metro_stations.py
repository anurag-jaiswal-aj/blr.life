import requests
import json
import re
from datetime import datetime

OVERPASS_URL = "http://overpass-api.de/api/interpreter"
OVERPASS_QUERY = """
[out:json][timeout:25];
area["name"="Bengaluru"]->.searchArea;
(
  node["railway"="station"]["network"~"Namma Metro"](area.searchArea);
  way["railway"="station"]["network"~"Namma Metro"](area.searchArea);
  relation["railway"="station"]["network"~"Namma Metro"](area.searchArea);
);
out center;
"""

def slugify(text: str) -> str:
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'[\s-]+', '-', text)
    return text.strip('-')

def main():
    headers = {"User-Agent": "blr.life-curation-script/1.0"}
    response = requests.get(OVERPASS_URL, params={"data": OVERPASS_QUERY}, headers=headers)
    response.raise_for_status()
    data = response.json()
    
    stations = []
    seen_slugs = set()
    
    for element in data["elements"]:
        tags = element.get("tags", {})
        
        # Filter out construction or planned stations mapped explicitly
        if tags.get("construction") or tags.get("railway") == "construction" or tags.get("disused:railway"):
            continue
            
        name = tags.get("name")
        if not name:
            continue
            
        # Hardcode exclusion of known Yellow/Blue/Pink line stations that might be improperly tagged in OSM
        under_construction = [
            "Beratena Agrahara", "Bommanahalli", "Central Silk Board", 
            "Hongasandra", "Hosa Road", "Jayadeva Hospital", 
            "Kudlu Gate", "Ragigudda", "Singasandra", "Electronic City", "Infosys Foundation Konappana Agrahara",
            "Bommasandra", "Hebbagodi", "Huskur Road", "Silk Board", "Udupi Garden", "BTM Layout"
        ]
        
        skip = False
        for uc in under_construction:
            if uc.lower() in name.lower():
                skip = True
                break
        if skip:
            continue
            
        slug = slugify(name)
        if slug in seen_slugs:
            continue
            
        seen_slugs.add(slug)
        
        lat = element.get("lat") or element.get("center", {}).get("lat")
        lon = element.get("lon") or element.get("center", {}).get("lon")
        
        osm_id = f"{element['type']}/{element['id']}"
        
        stations.append({
            "name": name,
            "slug": slug,
            "osm_id": osm_id,
            "latitude": lat,
            "longitude": lon
        })
        
    print(f"Extracted {len(stations)} active stations.")
    
    payload = {
        "source_key": "blr_life_curated_metro_stations",
        "source_version": "v1.1",
        "data_retrieved_at": datetime.utcnow().isoformat() + "Z",
        "attribution": "OpenStreetMap contributors (ODbL). Curated by blr.life.",
        "stations": stations
    }
    
    with open("data/curated/bengaluru_metro_stations_v1.json", "w") as f:
        json.dump(payload, f, indent=2)

if __name__ == "__main__":
    main()
