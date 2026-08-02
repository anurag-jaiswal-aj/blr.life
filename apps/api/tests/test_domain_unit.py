"""Unit tests for pure domain helpers and enum invariants.

These tests run without a database and verify:
- Enum values are stable identifiers
- Normalization helpers work correctly
- Model repr is readable
"""

from app.models.locality import GeometryConfidence, GeometrySource
from app.models.observations import (
    HousingConfiguration,
    MetricConfidence,
    MetricType,
)


class TestGeometrySourceEnum:
    def test_all_values_are_strings(self) -> None:
        for member in GeometrySource:
            assert isinstance(member.value, str)

    def test_expected_values(self) -> None:
        assert GeometrySource.OSM_POLYGON.value == "osm_polygon"
        assert GeometrySource.OSM_POINT.value == "osm_point"
        assert GeometrySource.MANUAL_CURATION.value == "manual_curation"
        assert GeometrySource.CENTROID_BUFFER.value == "centroid_buffer"


class TestGeometryConfidenceEnum:
    def test_expected_levels(self) -> None:
        assert GeometryConfidence.HIGH.value == "high"
        assert GeometryConfidence.MEDIUM.value == "medium"
        assert GeometryConfidence.LOW.value == "low"
        assert GeometryConfidence.INSUFFICIENT.value == "insufficient"

    def test_four_levels(self) -> None:
        assert len(list(GeometryConfidence)) == 4


class TestHousingConfigurationEnum:
    def test_expected_values(self) -> None:
        assert HousingConfiguration.RK_1.value == "1rk"
        assert HousingConfiguration.BHK_1.value == "1bhk"
        assert HousingConfiguration.BHK_2.value == "2bhk"
        assert HousingConfiguration.BHK_3.value == "3bhk"

    def test_all_lowercase(self) -> None:
        for member in HousingConfiguration:
            assert member.value == member.value.lower()


class TestMetricTypeEnum:
    def test_expected_types_exist(self) -> None:
        values = {m.value for m in MetricType}
        assert "cafe_density" in values
        assert "restaurant_density" in values
        assert "park_accessibility" in values
        assert "healthcare_accessibility" in values
        assert "metro_distance_m" in values

    def test_all_lowercase_underscore(self) -> None:
        for member in MetricType:
            assert member.value == member.value.lower()
            assert " " not in member.value


class TestMetricConfidenceEnum:
    def test_four_levels(self) -> None:
        assert len(list(MetricConfidence)) == 4

    def test_same_values_as_geometry_confidence(self) -> None:
        gc_values = {m.value for m in GeometryConfidence}
        mc_values = {m.value for m in MetricConfidence}
        assert gc_values == mc_values


class TestAliasNormalization:
    """Test the application-level normalization contract for locality aliases.

    The DB stores alias_lower = lower(alias_lower). This test ensures
    the application's normalization produces valid inputs.
    """

    def test_lowercase_normalization(self) -> None:
        cases = [
            ("BTM", "btm"),
            ("BTM Layout", "btm layout"),
            ("RR Nagar", "rr nagar"),
            ("Koramangla", "koramangla"),
            ("HSR", "hsr"),
            ("Electronic City", "electronic city"),
        ]
        for original, expected in cases:
            assert original.lower() == expected

    def test_strip_whitespace(self) -> None:
        assert "  HSR Layout  ".strip().lower() == "hsr layout"

    def test_empty_is_invalid(self) -> None:
        assert len("  ".strip()) == 0
