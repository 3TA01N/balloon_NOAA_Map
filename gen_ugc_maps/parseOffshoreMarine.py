
import geopandas as gpd
import json

# Path to your shapefile (.shp, .dbf, .shx)
shapefile_path = "oz18mr25/oz18mr25.shp"

# Load the shapefile
gdf = gpd.read_file(shapefile_path)
print(gdf.head())


# Dictionary to store UGC (ZONE) -> geometry
ugc_polygons = {}

for _, row in gdf.iterrows():
    # Use correct column name
    id = row.get("ID")
    ugc_code = id
    if not ugc_code:
        continue

    geometry = row.geometry
    if geometry is None:
        continue

    # Convert to GeoJSON-like dict
    ugc_polygons[ugc_code] = geometry.__geo_interface__

# Save to JSON file
with open("UGC_OFFSHORE.json", "w") as f:
    json.dump(ugc_polygons, f, indent=2)

print(f"UGC_OFFSHORE.json created with {len(ugc_polygons)} entries!")