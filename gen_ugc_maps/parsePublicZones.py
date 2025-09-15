
import geopandas as gpd
import json

# Path to your shapefile (.shp, .dbf, .shx)
shapefile_path = "z_18mr25/z_18mr25.shp"

# Load the shapefile
gdf = gpd.read_file(shapefile_path)
print(gdf.head())

# Dictionary to store UGC (ZONE) -> geometry
ugc_polygons = {}

for _, row in gdf.iterrows():
    # Use correct column name
    state = row.get("STATE")
    zone = row.get("ZONE")
    ugc_code = state + "Z" + zone
    if not ugc_code:
        continue

    geometry = row.geometry
    if geometry is None:
        continue

    # Convert to GeoJSON-like dict
    ugc_polygons[ugc_code] = geometry.__geo_interface__

# Save to JSON file
with open("UGC_POLYGONS.json", "w") as f:
    json.dump(ugc_polygons, f, indent=2)

print(f"UGC_POLYGONS.json created with {len(ugc_polygons)} entries!")