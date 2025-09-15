const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");

const app = express()
app.use(cors({ origin: "http://localhost:5173" }));

app.get("/api/balloons", async (req, res) => {
    const hoursPast = Number(req.query.hoursPast) || 0;
    const urls = [];

    for (let h = 0; h <= hoursPast; h++) {
    const hh = h.toString().padStart(2, "0");
    urls.push(`https://a.windbornesystems.com/treasure/${hh}.json`);
    }

    const results = [];
    for (const url of urls) {
        try {
            const response = await axios.get(url);
            if (Array.isArray(response.data)) {
            results.push(response.data);
            } 
            else {
            results.push(null);
            }
        } 
        catch (err) {
            console.log(err)
            results.push(null);
        }
    }
    res.json(results);
});

app.get("/api/storms", async (req, res) => {
  try {
    const { area, point, region, regionType, urgency, severity, certainty } = req.query;

    let nhcUrl = "https://api.weather.gov/alerts?status=actual&limit=500";

    if (urgency) nhcUrl += `&urgency=${urgency}`;
    if (severity) nhcUrl += `&severity=${severity}`;
    if (regionType) nhcUrl += `&regionType=${regionType}`;
    if (region) nhcUrl += `&region=${region}`;
    if (area) nhcUrl += `&area=${area}`;
    if (point) nhcUrl += `&point=${point}`;
    if (certainty) nhcUrl += `&certainty=${certainty}`;

    console.log(nhcUrl)
    const response = await axios.get(nhcUrl);
    const storms = (response.data.features || []).filter(
      (f) => f && 
        f.properties && 
        (f.properties.geocode || 
        f.geometry)
    );
    
    res.json(storms);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch storm data from NOAA" });
  }
});

app.use(express.static(path.join(__dirname, "../frontend/dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
