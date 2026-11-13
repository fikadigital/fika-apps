-- Slim, tile-clustered copy of hex_areas used by /tile-join and /api/hex-tile-values.
-- Holds only h3_index, the z8 web mercator tile containing each hex centroid, and the numeric
-- columns, so a tile read touches a few hundred KB instead of the wide hex_areas rows.
--
-- Refresh after hex_areas changes:
--   REFRESH MATERIALIZED VIEW CONCURRENTLY hex_values;
-- Remove:
--   DROP MATERIALIZED VIEW hex_values;

CREATE MATERIALIZED VIEW hex_values AS
WITH slim AS (
	SELECT
		h3_index,
		ogc_fid,
		ST_X(ST_Centroid(geometry)) AS lon,
		radians(ST_Y(ST_Centroid(geometry))) AS lat_rad,
		population,
		pop_0_4,
		females_0_4,
		males_0_4,
		pop_5_9,
		females_5_9,
		males_5_9,
		pop_10_14,
		females_10_14,
		males_10_14,
		pop_0_9,
		females_0_9,
		males_0_9,
		pop_15_49,
		females_15_49,
		males_15_49,
		pop_50_64,
		females_50_64,
		males_50_64,
		pop_65_plus,
		females_65_plus,
		males_65_plus,
		births,
		pregnancies,
		rwi,
		underweight,
		female_educational_attainment_mean,
		male_educational_attainment_mean,
		travel_time_no_sites_all_health,
		time_delta_no_sites_semi_dense_urban,
		travel_time_health_posts,
		travel_time_major_roads,
		travel_time_no_sites_secondary_schools,
		travel_time_secondary_schools,
		travel_time_no_sites_health_centers,
		travel_time_no_sites_major_roads,
		time_delta_no_sites_secondary_schools,
		time_delta_no_sites_all_health,
		travel_time_health_centers,
		time_delta_no_sites_health_centers,
		time_delta_no_sites_major_roads,
		travel_time_semi_dense_urban,
		time_delta_no_sites_major_hospitals,
		travel_time_all_health,
		travel_time_no_sites_primary_schools,
		travel_time_no_sites_semi_dense_urban,
		time_delta_no_sites_health_posts,
		travel_time_no_sites_all_education,
		travel_time_major_hospitals,
		travel_time_no_sites_major_hospitals,
		travel_time_primary_schools,
		time_delta_no_sites_primary_schools,
		travel_time_all_education,
		time_delta_no_sites_all_education,
		travel_time_no_sites_health_posts
	FROM hex_areas
),
deduped AS (
	-- ~73 border hexes have one row per country with different values; keep the row for the
	-- country with the larger population so each h3_index maps to exactly one value.
	SELECT DISTINCT ON (h3_index) *
	FROM slim
	ORDER BY h3_index, population DESC NULLS LAST, ogc_fid
)
SELECT
	h3_index,
	floor((lon + 180) / 360 * 256)::smallint AS tile_x,
	floor((1 - ln(tan(lat_rad) + 1 / cos(lat_rad)) / pi()) / 2 * 256)::smallint AS tile_y,
	population,
	pop_0_4,
	females_0_4,
	males_0_4,
	pop_5_9,
	females_5_9,
	males_5_9,
	pop_10_14,
	females_10_14,
	males_10_14,
	pop_0_9,
	females_0_9,
	males_0_9,
	pop_15_49,
	females_15_49,
	males_15_49,
	pop_50_64,
	females_50_64,
	males_50_64,
	pop_65_plus,
	females_65_plus,
	males_65_plus,
	births,
	pregnancies,
	rwi,
	underweight,
	female_educational_attainment_mean,
	male_educational_attainment_mean,
	travel_time_no_sites_all_health,
	time_delta_no_sites_semi_dense_urban,
	travel_time_health_posts,
	travel_time_major_roads,
	travel_time_no_sites_secondary_schools,
	travel_time_secondary_schools,
	travel_time_no_sites_health_centers,
	travel_time_no_sites_major_roads,
	time_delta_no_sites_secondary_schools,
	time_delta_no_sites_all_health,
	travel_time_health_centers,
	time_delta_no_sites_health_centers,
	time_delta_no_sites_major_roads,
	travel_time_semi_dense_urban,
	time_delta_no_sites_major_hospitals,
	travel_time_all_health,
	travel_time_no_sites_primary_schools,
	travel_time_no_sites_semi_dense_urban,
	time_delta_no_sites_health_posts,
	travel_time_no_sites_all_education,
	travel_time_major_hospitals,
	travel_time_no_sites_major_hospitals,
	travel_time_primary_schools,
	time_delta_no_sites_primary_schools,
	travel_time_all_education,
	time_delta_no_sites_all_education,
	travel_time_no_sites_health_posts
FROM deduped
ORDER BY tile_x, tile_y;

CREATE UNIQUE INDEX hex_values_h3_index_idx ON hex_values (h3_index);
CREATE INDEX hex_values_tile_idx ON hex_values (tile_x, tile_y);
ANALYZE hex_values;
