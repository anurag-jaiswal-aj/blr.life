# blr.life Data Directory

This directory contains data related to Bengaluru that is either used to bootstrap the application or generated during offline ETL processes.

## Git Commit Policy

**COMMIT:**
- Small curated JSON registries (e.g., `data/curated/bengaluru_localities_v1.json`)
- Aliases, manual overrides, mapping files
- Extracted references where licensing requires it and file size is small

**DO NOT COMMIT:**
- Raw OpenStreetMap exports (e.g., `karnataka-latest.osm.pbf`)
- Bulk generated GeoJSON files
- Database dumps (`.sql`, `.tar`)
- Cache files and temporary scraped downloads

Please ensure `.gitignore` rules in this directory or the project root protect against accidentally pushing multi-megabyte binary dumps.
