"""add_osm_id_to_metro_station

Revision ID: 0005
Revises: '0004'
Create Date: 2026-08-02 21:40:52.269309

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


V1_OSM_MAPPING = {
    "manjunathanagara": "node/1576973980",
    "whitefield-kadugodi": "node/5760197744",
    "hopefarm-channasandra": "node/5760197745",
    "pattandur-agrahara": "node/5760197749",
    "sri-sathya-sai-hospital": "node/5760197751",
    "nallurahalli": "node/5760197754",
    "kundalahalli": "node/5760197755",
    "seetharampalya": "node/5760197757",
    "hoodi": "node/5760197761",
    "garudacharpalya": "node/5760197762",
    "singayyanapalya": "node/5760197764",
    "krishnarajapura": "node/5760197765",
    "benniganahalli": "node/5760197766",
    "dasarahalli": "node/5960788724",
    "jalahalli": "node/5960788725",
    "srirampura": "node/5960788726",
    "baiyappanahalli": "node/6400857549",
    "swami-vivekananda-road": "node/6400857550",
    "indiranagar": "node/6400857551",
    "halasuru": "node/6400857552",
    "trinity": "node/6400857553",
    "mahatma-gandhi-road": "node/6400857554",
    "cubbon-park": "node/6400857555",
    "dr-b-r-ambedkar-station-vidhana-soudha": "node/6400857556",
    "sir-m-visvesvaraya-stn-central-college": "node/6400857557",
    "nadaprabhu-kempegowda-station-majestic": "node/6400857558",
    "krantivira-sangolli-rayanna-railway-station": "node/6400857559",
    "magadi-road": "node/6400857560",
    "sri-balagangadharanatha-swamiji-station-hosahalli": "node/6400857561",
    "vijayanagar": "node/6400857562",
    "attiguppe": "node/6400857563",
    "deepanjali-nagar": "node/6400857564",
    "mysore-road": "node/6400857565",
    "mantri-square-sampige-road": "node/6410706688",
    "mahakavi-kuvempu-road": "node/6410706689",
    "rajajinagar": "node/6410706690",
    "mahalakshmi": "node/6410706691",
    "sandal-soap-factory": "node/6410706692",
    "peenya": "node/6410706695",
    "peenya-industry": "node/6410706696",
    "yelachenahalli": "node/6432710292",
    "jaya-prakash-nagar": "node/6432710293",
    "banashankari": "node/6432710294",
    "rashtreeya-vidyalaya-road": "node/6432710295",
    "jayanagar": "node/6432710296",
    "south-end-circle": "node/6432710297",
    "lalbagh": "node/6432710298",
    "national-college": "node/6432710299",
    "krishna-rajendra-market": "node/6432710300",
    "chickpete": "node/6432710301",
    "jnanabharathi": "node/9049846515",
    "pantharapalya-nayandahalli": "node/9050797592",
    "kengeri-bus-terminal": "node/9051395755",
    "kengeri": "node/9051405243",
    "rajarajeshwari-nagar": "node/9051410519",
    "pattanagere": "node/9051417969",
    "silk-institute": "node/9919651773",
    "thalaghattapura": "node/9919651774",
    "vajarahalli": "node/9919651775",
    "doddakallasandra": "node/9919651776",
    "konanakunte-cross": "node/9919651777",
    "nagasandra": "node/11941173068",
    "yeshwantpur": "node/11941186869",
    "kadugodi-tree-park": "node/11941186870",
    "goraguntepalya": "way/1353733806",
}


def upgrade() -> None:
    # 1. Add column as nullable first
    op.add_column("metro_station", sa.Column("osm_id", sa.String(length=50), nullable=True))

    # 2. Backfill from embedded canonical dataset mapping
    conn = op.get_bind()
    result = conn.execute(sa.text("SELECT id, slug FROM metro_station"))
    for row in result:
        row_id = row[0]
        slug = row[1]

        osm_id = V1_OSM_MAPPING.get(slug)
        if not osm_id:
            msg = f"Data migration failure: Cannot find canonical osm_id for '{slug}'"
            raise ValueError(msg)

        conn.execute(
            sa.text("UPDATE metro_station SET osm_id = :osm_id WHERE id = :id"),
            {"osm_id": osm_id, "id": row_id},
        )

    # 3. Apply NOT NULL constraint
    op.alter_column("metro_station", "osm_id", existing_type=sa.String(length=50), nullable=False)

    # 4. Apply format check constraint
    op.create_check_constraint(
        "ck_metro_station_osm_id_format",
        "metro_station",
        "osm_id ~ '^(node|way|relation)/\\d+$'",
    )


def downgrade() -> None:
    op.drop_constraint("ck_metro_station_osm_id_format", "metro_station", type_="check")
    op.drop_column("metro_station", "osm_id")
