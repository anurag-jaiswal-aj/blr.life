#!/usr/bin/env python3
import json
import sys
from pathlib import Path
from urllib.parse import urlparse

def validate_rent_data(filepath: str, localities_path: str):
    print(f"Validating {filepath}...")

    with open(filepath, "r") as f:
        data = json.load(f)

    with open(localities_path, "r") as f:
        loc_data = json.load(f)
        canonical_slugs = {loc["slug"] for loc in loc_data["localities"]}

    observations = data.get("observations", [])
    if not observations:
        print("No observations found!")
        sys.exit(1)

    seen_combos = set()
    valid_bhks = {"1rk", "1bhk", "2bhk", "3bhk"}
    valid_confidences = {"high", "medium", "low", "insufficient"}

    for i, obs in enumerate(observations):
        slug = obs.get("locality_slug")
        bhk = obs.get("bhk")
        rent_min = obs.get("rent_min_inr")
        rent_max = obs.get("rent_max_inr")
        confidence = obs.get("confidence")
        provenance = obs.get("provenance")

        if slug not in canonical_slugs:
            print(f"Error at obs {i}: Unknown locality slug '{slug}'")
            sys.exit(1)

        if bhk not in valid_bhks:
            print(f"Error at obs {i}: Invalid BHK '{bhk}'")
            sys.exit(1)

        if not isinstance(rent_min, int) or rent_min < 0:
            print(f"Error at obs {i}: Invalid rent_min_inr '{rent_min}'")
            sys.exit(1)

        if not isinstance(rent_max, int) or rent_max < 0:
            print(f"Error at obs {i}: Invalid rent_max_inr '{rent_max}'")
            sys.exit(1)

        if rent_min > rent_max:
            print(f"Error at obs {i}: rent_min_inr > rent_max_inr ({rent_min} > {rent_max})")
            sys.exit(1)

        if confidence not in valid_confidences:
            print(f"Error at obs {i}: Invalid confidence '{confidence}'")
            sys.exit(1)

        if not provenance or not isinstance(provenance, dict):
            print(f"Error at obs {i}: Missing required structured 'provenance' dict")
            sys.exit(1)

        publisher = provenance.get("publisher")
        if not publisher:
            print(f"Error at obs {i}: missing publisher")
            sys.exit(1)

        source_title = provenance.get("source_title")
        if not source_title:
            print(f"Error at obs {i}: missing source_title")
            sys.exit(1)

        source_url = provenance.get("source_url")
        if not source_url:
            print(f"Error at obs {i}: missing source_url")
            sys.exit(1)

        parsed_url = urlparse(source_url)
        if parsed_url.scheme not in ("http", "https"):
            print(f"Error at obs {i}: invalid source_url '{source_url}'")
            sys.exit(1)

        published_at = provenance.get("published_at")
        if published_at is not None:
            try:
                import datetime
                datetime.date.fromisoformat(published_at)
            except ValueError:
                print(f"Error at obs {i}: invalid published_at '{published_at}', must be YYYY-MM-DD or null")
                sys.exit(1)

        accessed_at = provenance.get("accessed_at")
        if not accessed_at:
            print(f"Error at obs {i}: missing accessed_at")
            sys.exit(1)
        try:
            import datetime
            datetime.date.fromisoformat(accessed_at)
        except ValueError:
            print(f"Error at obs {i}: invalid accessed_at '{accessed_at}', must be YYYY-MM-DD")
            sys.exit(1)

        source_type = provenance.get("source_type")
        if not source_type:
            print(f"Error at obs {i}: missing source_type")
            sys.exit(1)

        derivation = provenance.get("derivation")
        if not derivation:
            print(f"Error at obs {i}: missing derivation")
            sys.exit(1)

        if source_type in ("aggregated", "listings_average"):
            sample_count = provenance.get("sample_count")
            if not isinstance(sample_count, int) or sample_count <= 0:
                print(f"Error at obs {i}: aggregated source requires positive sample_count")
                sys.exit(1)

        combo = (slug, bhk)
        if combo in seen_combos:
            print(f"Error at obs {i}: Duplicate locality_slug + bhk combo '{combo}'")
            sys.exit(1)
        seen_combos.add(combo)

    print(f"Validation successful. {len(observations)} verified observations.")

if __name__ == "__main__":
    rent_path = sys.argv[1] if len(sys.argv) > 1 else "data/curated/bengaluru_rent_v1.json"
    loc_path = sys.argv[2] if len(sys.argv) > 2 else "data/curated/bengaluru_localities_v1.json"
    validate_rent_data(rent_path, loc_path)
