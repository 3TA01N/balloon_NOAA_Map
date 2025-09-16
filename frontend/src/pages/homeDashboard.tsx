import React, { useState, useEffect } from "react";
import { ZoomControl, useMapEvent, Popup } from "react-leaflet";
import MarkerClusterGroup from 'react-leaflet-markercluster';
import type { Storm } from '../components/parseStormShape.tsx';
import type { UGCJson } from "../components/parseStormShape.tsx"
import {getStormShape} from "../components/parseStormShape.tsx"
import * as turf from "@turf/turf";
import { createPortal } from "react-dom";
import { useRef } from "react";
import InfoIcon from "@mui/icons-material/Info";

import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Typography,
  Dialog, 
  DialogTitle,
   DialogContent,
    DialogActions, 
  Drawer,
  Slider,
  Accordion,
  InputLabel,
  Select,
  AccordionSummary,
  FormControl,
  ListItemText,
  MenuItem,
  AccordionDetails,
  CircularProgress,
  IconButton
} from "@mui/material"
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import MenuIcon from "@mui/icons-material/Menu";
import { MapContainer, TileLayer, Marker, Polyline, Polygon } from 'react-leaflet';
import L from 'leaflet';
import type { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useBalloons } from "../hooks/useBalloons.tsx";
import { useStorms } from "../hooks/useStorms.tsx"

const darkBlueIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png", // dark blue variant
  iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const styles = `
  .dark-blue-marker {
    filter: hue-rotate(200deg) brightness(0.7);
  }
`;
document.head.insertAdjacentHTML(
  "beforeend",
  `<style>${styles}</style>`
);

const markerPopupStyle: React.CSSProperties = {
  backgroundColor: "#2c2c2c",
  color: "#f0f0f0",
  padding: "24px",
  borderRadius: "12px",
  width: "80%",
  maxWidth: "800px",
  height: "70%",
  maxHeight: "80%",
  overflowY: "auto",
  boxShadow: "0 8px 25px rgba(0,0,0,0.6)",
  border: "1px solid #444",
};



const popupStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  backgroundColor: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const popupWindowStyle: React.CSSProperties = {
  backgroundColor: "#2c2c2c",
  color: "#f0f0f0",
  padding: "24px",
  borderRadius: "12px",
  width: "80%",         // wider
  maxWidth: "800px",    // larger max width
  height: "70%",        // taller
  maxHeight: "80%",
  overflowY: "auto",
  boxShadow: "0 8px 25px rgba(0,0,0,0.6)",
};

const alertHeaderStyle: React.CSSProperties = {
  cursor: "pointer",
  padding: "8px",
  borderRadius: "8px",
  backgroundColor: "#444",
  marginBottom: "8px",
};

const polygonStyle = {
  color: "#a259ff",
  fillColor: "#a259ff",
  fillOpacity: 0.4,
  weight: 2
};

const polygonHoverStyle = {
  color: "#d299ff",
  fillColor: "#d299ff",
  fillOpacity: 0.6,
  weight: 3
};
const AVAILABLE_AREAS = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
  "DC","PR","GU","VI","MP","AS",
  "57","58","59","61","65","73","75","77","91","92",
  "93","94","96","97","98"
];
const AVAILABLE_REGION_TYPES = ["land", "marine"];
const AVAILABLE_URGENCY = ["Immediate", "Expected", "Future", "Past", "Unknown"];
const AVAILABLE_SEVERITY = ["Extreme", "Severe", "Moderate", "Minor", "Unknown"];
const AVAILABLE_CERTAINTY = ["Observed", "Likely", "Possible", "Unlikely", "Unknown"];


interface Balloon {
    id: number,
    altitude: number;
    latitude: number;
    longitude: number;
}

const renderCoordinates = (shape: any) => {
    if (shape.type === "polygon") {
        return shape.coordinates[0].map(([long, lat]: number[]) => [lat, long]);
    } 
    else if (shape.type === "multipolygon") {
        return shape.coordinates.map((poly: any) =>
            poly[0].map(([long, lat]: number[]) => [lat, long])
        );
    }
    return [];
};
const isBalloonInPolygon = (balloon: {latitude: number; longitude: number}, coords: [number, number][]) => {
    const point = turf.point([balloon.longitude, balloon.latitude]);
    const poly = turf.polygon([coords.map(([lon, lat]: number[]) => [lon, lat])]); 
    return turf.booleanPointInPolygon(point, poly);
};




function MultiPolygonPopup({ storms, balloons, UGC_LOOKUP }: { storms: Storm[], balloons: Balloon[][], UGC_LOOKUP: UGCJson  }) {
    const [popupData, setPopupData] = useState<
        { latlng: any; alerts: (Storm & { balloonsInside: Balloon[] })[] } | null
    >(null);
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

    useMapEvent("click", (e) => {
    const point = turf.point([e.latlng.lng, e.latlng.lat]);
    const alertsHere: (Storm & { balloonsInside: Balloon[] })[] = [];
    storms.forEach((storm) => {
        const shape = getStormShape(storm, UGC_LOOKUP);
        if (!shape) {
            return;
        }
        const coords = renderCoordinates(shape);
        if (shape.type === "polygon") {
            const poly = turf.polygon([coords.map(([lat, lon]: number[]) => [lon, lat])]);
            if (turf.booleanPointInPolygon(point, poly)) {
                
                const balloonsInside = balloons
                        .map((traj) => traj[0])
                        .filter((b) => b && isBalloonInPolygon(b, coords.map(([lat, lon]: [number, number]) => [lon, lat])));
                    alertsHere.push({ ...storm, balloonsInside });
                console.log(balloonsInside)
            }
            
        } 
        else if (shape.type === "multipolygon") {
            coords.forEach((poly: [number, number][]) => {
                const turfPoly = turf.polygon([poly.map(([lat, lon]) => [lon, lat])]);
                if (turf.booleanPointInPolygon(point, turfPoly)) {
                    const balloonsInside = balloons
                            .map((traj) => traj[0])
                            .filter((b) => b && isBalloonInPolygon(b, poly.map(([lat, lon]: [number, number]) => [lon, lat])));
                        alertsHere.push({ ...storm, balloonsInside });

                }
            });
        }
    });
    
    if (alertsHere.length > 0) {
        setPopupData({ latlng: e.latlng, alerts: alertsHere });
        setExpandedIndex(null);
    } else {
        setPopupData(null);
    }
    });
    const toggleExpand = (index: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedIndex(expandedIndex === index ? null : index);
  };
    const closePopup = () => setPopupData(null);
    const modalContent = popupData ? (
        <div style={popupStyle} onClick={closePopup}>
        <div style={popupWindowStyle} onClick={(e) => e.stopPropagation()}>
            <div onClick={(e) => e.stopPropagation()}>
            {popupData.alerts.map((storm, i) => (
            <div key={i}>
                <div style={alertHeaderStyle} onClick={(e) => toggleExpand(i, e)}>
                <strong>{storm.properties?.event ?? "Weather Alert"}</strong>
                <span style={{ float: "right", transition: "transform 0.2s", transform: expandedIndex === i ? "rotate(90deg)" : "rotate(0deg)" }}>
                    ▶
                </span>
                </div>
                {expandedIndex === i && (
                <div style={{ paddingLeft: "10px", marginBottom: "12px" }}>
                    <strong>Area Descriptions:</strong> {storm.properties?.areaDesc}
                    <br />
                    <strong>Headline</strong>: {storm.properties?.headline}
                    <br />
                    <strong>Description</strong>: {storm.properties?.description}
                    <br />
                    <strong>Certainty</strong>: {storm.properties?.certainty}
                    <br />
                    <strong>Effective</strong>: {storm.properties?.effective}
                    <br />
                    <strong>Urgency</strong>: {storm.properties?.urgency}
                    <br />
                    {storm.balloonsInside.length > 0 && (
                    <>
                        <strong>Balloons inside:</strong>
                        <ul>
                        {storm.balloonsInside.map((b) => (
                            <li key={b.id}>{`Balloon ${b.id}`}</li>
                        ))}
                        </ul>
                    </>
                    )}
                </div>
                )}
            </div>
            ))}
            </div>
        </div>
        </div>
    ) : null;
    const portalRoot = document.getElementById("modal-root");
    return portalRoot ? createPortal(modalContent, portalRoot) : null;
}
function normalizeTraj(traj: { latitude: number; longitude: number }[]) {
    if (!traj.length) return [];

    const normalized: [number, number][] = [[traj[0].latitude, traj[0].longitude]];

    for (let i = 1; i < traj.length; i++) {
    let prevLon = normalized[i - 1][1];
    let lon = traj[i].longitude;

    if (lon - prevLon > 180) lon -= 360;
    else if (lon - prevLon < -180) lon += 360;

    normalized.push([traj[i].latitude, lon]);
    }

    return normalized;
    }
function HomeDashboard() {
    //Layout:
    /*
    Home
    Map
    On side of map, menu, with stuff like search for location, checkmark show certain data or nto
    */
    

    const [UGC_LOOKUP, setUGC_LOOKUP] = useState<UGCJson>({});
    const [loadingUGCLookup, setLoadingUGC] = useState(true);
    useEffect(() => {
    async function loadUGCData() {
        setLoadingUGC(true)
        try {
            const [coastalRes, publicRes, offshoreRes] = await Promise.all([
                fetch("https://noaa-shapefile-json.s3.amazonaws.com/UGC_COASTAL.json"),
                fetch("https://noaa-shapefile-json.s3.amazonaws.com/UGC_PUBLIC_ZONE.json"),
                fetch("https://noaa-shapefile-json.s3.amazonaws.com/UGC_OFFSHORE.json"),
            ]);

            const [rawUGCCoastal, rawUGCPublic, rawUGCOffshore] = await Promise.all([
            coastalRes.json(),
            publicRes.json(),
            offshoreRes.json(),
            ]);
            console.log("Coastal response status:", coastalRes.status);
            console.log("Public response status:", publicRes.status);
            console.log("Offshore response status:", offshoreRes.status);

            console.log("JSON successfully parsed!");
            console.log("Coastal sample:", rawUGCCoastal[0]);

            const merged: UGCJson = {
            ...rawUGCCoastal,
            ...rawUGCPublic,
            ...rawUGCOffshore,
            };

            setUGC_LOOKUP(merged);
        }
        catch (error) {
            console.error("Failed to fetch UGC json", error)
        }
        finally {
            setLoadingUGC(false)
        }
    }

    loadUGCData();
    }, []);

    const [trajDisplayMode/*, setTrajDisplayMode*/] = useState<"all" | "selected">("all");
    const [area, setArea] = useState<string[]>([]);
    const [regionType, setRegionType] = useState<string[]>([]);
    const [urgency, setUrgency] = useState<string[]>([]);
    const [severity, setSeverity] = useState<string[]>([]);
    const [certainty, setCertainty] = useState<string[]>([]);
    const [trajRange, setTrajRange] = useState(0)
    const [pendingTrajRange, setPendingTrajRange] = useState(1);
    const showTraj = trajRange > 0
    const [highlightedIndex] = useState<number | null>(null);
    const { balloons, /*loading, error,*/ refresh } = useBalloons(showTraj, trajRange);
    const [showBalloons, setShowBalloons] = useState(true);
    const [showStorms, setShowStorms] = useState(true);
    const { storms/*,stormLoading, stormError*/ } = useStorms({
        area,
        regionType,
        urgency,
        severity,
        certainty,
    });
    //memos
    const mapRef = useRef<L.Map | null>(null);
    const markerRefs = useRef<Map<number, any>>(new Map());
    const polylineRefs = useRef<Map<number, any>>(new Map());
    const prevHighlighted = useRef<number | null>(null);
    /*const normalizedTrajectories = useMemo(() => {
        return balloons.map((traj) => normalizeTraj(traj));
    }, [balloons, trajRange]);*/


    
    useEffect(() => {
  if (!mapRef.current) return;
  const map = mapRef.current;
  

  const handleMapClick = () => {
    const prev = prevHighlighted.current;
    if (prev !== null) {
        const prevPoly = polylineRefs.current.get(prev);
        if (prevPoly)
        prevPoly.setStyle({ color: "#3b82f6", weight: 2, dashArray: "5,10" }); // default style
        prevHighlighted.current = null;
    }
    };

    map.on("click", handleMapClick);
    return () => {
    map.off("click", handleMapClick);
    };
    }, []);


    const [drawerOpen, setDrawerOpen] = useState(false);
    const [infoOpen, setInfoOpen] = useState(false);
    const refreshTraj = () => {
        setTrajRange(pendingTrajRange);
        refresh();
    }
    const MultiSelect = (
        label: string,
        values: string[],
        setValues: any,
        options: string[],
        disabled: boolean = false
        ) => {
        const menuProps = {
            PaperProps: {
            sx: {
                backgroundColor: "#2a2a2a",
                color: "#f0f0f0",
            },
            },
        };

        return (
            <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel sx={{ color: "#f0f0f0" }}>{label}</InputLabel>
            <Select
                multiple
                value={values}
                onChange={(e) => setValues(e.target.value as string[])}
                renderValue={(selected) => selected.join(", ")}
                disabled={disabled}
                sx={{
                color: "#f0f0f0",
                ".MuiOutlinedInput-notchedOutline": { borderColor: "#555" },
                "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#888" },
                "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#888" },
                }}
                MenuProps={menuProps}
            >
                {options.map((opt) => (
                <MenuItem key={opt} value={opt} sx={{ backgroundColor: "#2a2a2a", color: "#f0f0f0" }}>
                    <Checkbox checked={values.indexOf(opt) > -1} sx={{ color: "#f0f0f0" }} />
                    <ListItemText primary={opt} />
                </MenuItem>
                ))}
            </Select>
            </FormControl>
        );
        };
    useEffect(() => {
        const interval = setInterval(() => {
            refresh();

        }, 60000);
        return () => clearInterval(interval);
    }, [refresh])
    
    return (
        <Box sx={{ height: "100vh", width: "100vw", backgroundColor: "black"}}>
        <Box
            sx={{
            height: "64px",
            display: "flex",
            alignItems: "center",
            px: 2,
            backgroundColor: "#1f1f1f",
            color: "#f0f0f0",
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            }}
        >
            <IconButton
            edge="start"
            color="inherit"
            onClick={() => setDrawerOpen(true)}
            >
            <MenuIcon />
            </IconButton>
            <Typography variant="h5" ml={2}>
            Balloon Dashboard
            </Typography>
            <Box
            
            onClick={() => setInfoOpen(true)}
            sx={{
                display: "flex",
                alignItems: "center",
                cursor: "pointer",
                px: 2,
                py: 0.5,
                ml: 3,
                borderRadius: 1,
                border: "1px solid #555",
                "&:hover": { backgroundColor: "#333", borderColor: "#888" },
                transition: "all 0.2s ease",
            }}
            >
          <InfoIcon sx={{ mr: 1 }} />
          <Typography variant="body1">Info</Typography>
          
          
        </Box>
        {loadingUGCLookup && (
            <Box sx={{ display: "flex", alignItems: "center", ml: 4 }}>
            <CircularProgress size = {20} sx={{ mr: 1}} />
            <Typography variant="body2" sx = {{ display : "flex", alignItems: "center"}}>
                Loading weather polygons…
            </Typography>
            </Box>
        )}


        </Box>
        <Dialog 
        open={infoOpen} 
        onClose={() => setInfoOpen(false)} 
        fullWidth maxWidth="md"
        PaperProps={{
            sx: {
            backgroundColor: "#1f1f1f",
            color: "#f0f0f0",
            },
        }}
        >
        <DialogTitle>Information</DialogTitle>
        <DialogContent dividers>
            <Accordion
                sx={{
                    backgroundColor: "#2a2a2a",
                    color: "#f0f0f0",
                    "&:before": { display: "none" },
                    mb: 1,
                }}
            >
            <AccordionSummary expandIcon={<ExpandMoreIcon sx={{color: "#f0f0f0"}}/>}>
                <Typography variant="subtitle1">Overview</Typography>
            </AccordionSummary>
            <AccordionDetails>
                <Typography>
                This is an app mapping global sounding balloons from Windbourne Systems over current weather alerts from the NOAA. 
                This allows users to clearly see which balloons are currently within the range of weather alerts. <br /><br />Though the API from Windbourne Systems only provides balloon
                locations, a user with access to more data such as individual balloon weather measurements could gain deeper insights. <br /><br />
                For example, they could identify localized atmospheric conditions, track developing weather patterns in real time, or correlate balloon data with alert severity to better assess risk in specific areas.
                <br /><br />Further, by tracking the balloon's trajectories over time, users can predict whether a balloon is on trajectory to enter a region with a weather alert. 
                </Typography>
            </AccordionDetails>
            </Accordion>

            <Accordion
            sx={{
                    backgroundColor: "#2a2a2a",
                    color: "#f0f0f0",
                    "&:before": { display: "none" },
                    mb: 1,
                }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon sx={{color: "#f0f0f0"}}/>}>
                <Typography variant="subtitle1">Usage</Typography>
            </AccordionSummary>
            <AccordionDetails>
                <Typography>
                Zoom into the map to see more balloon markers.<br /><br />
                Click on a marker icon to bring up that balloon's location. <br /><br />
                Click on a purple highlighted region to display information about the 
                alert in that region, along with the balloons in that region. <br /><br />
                Adjust Balloon options and Weather alert options in the sidebar menu next the the "Balloon Dashboard" title.
                </Typography>
            </AccordionDetails>
            </Accordion>

            <Accordion
            sx={{
                    backgroundColor: "#2a2a2a",
                    color: "#f0f0f0",
                    "&:before": { display: "none" },
                    mb: 1,
                }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon sx={{color: "#f0f0f0"}}/>}>
                <Typography variant="subtitle1">Future Implementations</Typography>
            </AccordionSummary>
            <AccordionDetails>
                <Typography>
                1.Currently, the app is fetching data from NOAA's active alerts API. Each alert fetched there has a UGC code, which must be converted to a location range through the NOAA's provided shapefiles. 
                I've currently only implemented scripts to parse two of the shapefiles out of the more than 16 provided, as there is no existing tool/lookup. Implementing the rest of these scripts will provide further coverage of alerts. 
                <br /><br />2.The NOAA API has a hard limit of 500 entries when querying the API. Other paid APIs have no such limit, and could provide much more comprehensive coverage (especially as the NOAA data is largely concentrated around US/US territories).
                <br /><br />3. I plan on implementing a more robust backend that will store historical NOAA weather alert data, such that users will be able to see if, for example 3 hours ago weather balloon 5 was within a alert at that time.
                </Typography>
            </AccordionDetails>
            </Accordion>
        </DialogContent>
        <DialogActions>
            <Button onClick={() => setInfoOpen(false)}>Close</Button>
        </DialogActions>
        </Dialog>

        <Drawer
            anchor="left"
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            PaperProps={{
                sx: { backgroundColor: "#1f1f1f", color: "#f0f0f0" },
            }}
        >
            <Box sx={{ width: 250, p: 2 }}>
                <Typography variant="h6" mb={2}>
                    Menu
                </Typography>

                <Accordion
                sx={{
                    backgroundColor: "#2a2a2a",
                    color: "#f0f0f0",
                    "&:before": { display: "none" },
                    mb: 1,
                }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon sx={{color: "#f0f0f0"}}/>}>
                    <Typography>Balloon Options</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                    <FormControlLabel
                        control={
                        <Checkbox
                            checked={showBalloons}
                            onChange={(e) => setShowBalloons(e.target.checked)}
                        />
                        }
                        label="Show balloon locations"
                    />
                    <Button
                        variant="contained"
                        sx={{ mt: 1 }}
                        onClick={() => refresh()}
                        disabled ={!showBalloons}
                    >
                        Refresh balloon data
                    </Button>
                    <Typography sx={{ mt: 2 }}>Show past hours trajectories: {pendingTrajRange}</Typography>
                        <Slider
                        defaultValue={pendingTrajRange}
                        min={0}
                        max={23}
                        step={1}
                        marks
                        valueLabelDisplay="auto"
                        onChangeCommitted={(_, value) => setPendingTrajRange(value as number)}
                        />
                    

                    <Button
                        variant="contained"
                        sx={{ mt: 1 }}
                        onClick={() => refreshTraj()}
                    >
                        Apply trajectories
                    </Button>
                    
                    
                    
                    </AccordionDetails>
                </Accordion>

                <Accordion
                sx={{
                    backgroundColor: "#2a2a2a",
                    color: "#f0f0f0",
                    "&:before": { display: "none" },
                    mb: 1,
                }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon sx={{color: "#f0f0f0"}}/>}>
                    <Typography>Weather Alerts Options</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <FormControlLabel
                            control={
                            <Checkbox
                                checked={showStorms}
                                onChange={(e) => setShowStorms(e.target.checked)}
                            />
                            }
                            label="Show weather alerts"
                        />
                        <Typography>Note: area and region type filters cannot be used at the same time</Typography>
                        {MultiSelect("Area", area, setArea, AVAILABLE_AREAS, regionType.length > 0)}
                        {MultiSelect("Region Type", regionType, setRegionType, AVAILABLE_REGION_TYPES, area.length > 0)}
                        {MultiSelect("Urgency", urgency, setUrgency, AVAILABLE_URGENCY)}
                        {MultiSelect("Severity", severity, setSeverity, AVAILABLE_SEVERITY)}
                        {MultiSelect("Certainty", certainty, setCertainty, AVAILABLE_CERTAINTY)}

                    </AccordionDetails>
                </Accordion>
                </Box>
        </Drawer>

        <Box sx={{ position: "absolute", top: 84, left:0, right: 0, bottom: 0 , backgroundColor: "black"}}>

            <MapContainer
            ref={mapRef}
            zoomControl={false}
            style={{ height: "100vh", width: "100vw" }}
            
            center={[10, 0] as LatLngExpression}
            zoom={2}
            >
                <MultiPolygonPopup storms={storms} balloons={balloons} UGC_LOOKUP={UGC_LOOKUP}/>
                <ZoomControl position="bottomright" />
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
                />
                <MarkerClusterGroup chunkedLoading removeOutsideVisibleBounds showCoverageOnHover={false} animate={false}>
                    {showBalloons && 
                        balloons.map((traj) => {
                            if (!traj || traj.length === 0) {
                                return null
                            }
                            const latestMarkerPos = traj[traj.length - 1];
                            return (
                                <React.Fragment key={`marker-${latestMarkerPos.id}`}>
                                    <Marker 
                                    
                                    position={[latestMarkerPos.latitude, latestMarkerPos.longitude] as [number, number] } 
                                    icon={darkBlueIcon}
                                    ref={(ref: any) => {
                                        if (ref) markerRefs.current.set(latestMarkerPos.id, ref);
                                        else markerRefs.current.delete(latestMarkerPos.id);
                                    }}
                                    eventHandlers={{
                                        popupopen: () => {
                                            const id = latestMarkerPos.id;
                                            //setHighlightedIndex(id)
                                            const prev = prevHighlighted.current;
                                            if (prev !== null && prev !== id) {
                                                const prevPoly = polylineRefs.current.get(prev);
                                                if (prevPoly)
                                                prevPoly.setStyle({ color: "#3b82f6", weight: 2, dashArray: "5,10" });
                                            }

                                            const poly = polylineRefs.current.get(id);
                                            if (poly)
                                                poly.setStyle({ color: "purple", weight: 4, dashArray: "5,10" });

                                            prevHighlighted.current = id;
                                        },
                                        
                                        popupclose: () => {
                                        const id = latestMarkerPos.id;
                                        const poly = polylineRefs.current.get(id);
                                        if (poly)
                                            poly.setStyle({ color: "#3b82f6", weight: 2, dashArray: "5,10" });

                                        if (prevHighlighted.current === id) prevHighlighted.current = null;
                                        },
                                    }}
                                    >
                                        <Popup autoPan={false}>
                                            <div style={markerPopupStyle}>
                                                <strong>Balloon {latestMarkerPos.id}</strong>
                                                <br />
                                                <strong>Current:</strong> Lat: {latestMarkerPos.latitude.toFixed(4)}, Lon: {latestMarkerPos.longitude.toFixed(4)}, Alt: {latestMarkerPos.altitude.toFixed(4)}
                                                {traj.length > 1 && (
                                                    <>
                                                        <br />
                                                        <strong>Previous positions:</strong>
                                                        <ul style={{ margin: 0, paddingLeft: "1em" }}>
                                                        {traj.slice(0, -1).map((p: Balloon, id: number) => (
                                                            <li key={id}>
                                                            Lat: {p.latitude.toFixed(4)}, Lon: {p.longitude.toFixed(4)}, Alt: {p.altitude.toFixed(4)}
                                                            </li>
                                                        ))}
                                                        </ul>
                                                    </>
                                                    )}
                                            </div>
                                        </Popup>
                                    </Marker>
                                    {showBalloons && trajRange > 0 && traj.length > 1 && (trajDisplayMode === "all" || prevHighlighted.current === latestMarkerPos.id) && (
                                        <Polyline
                                        eventHandlers={{
                                            click: () => {
                                            const prev = prevHighlighted.current;
                                            if (prev !== null && prev !== latestMarkerPos.id) {
                                                const prevPoly = polylineRefs.current.get(prev);
                                                if (prevPoly)
                                                prevPoly.setStyle({ color: "#3b82f6", weight: 2, dashArray: "5,10" });
                                            }
                                            const poly = polylineRefs.current.get(latestMarkerPos.id);
                                            if (poly) poly.setStyle({ color: "red", weight: 4, dashArray: "5,10" });
                                            prevHighlighted.current = latestMarkerPos.id;
                                            const marker = markerRefs.current.get(latestMarkerPos.id);
                                            if (marker) {
                                                marker.openPopup(); 
                                            }
                                            },
                                            mouseover: (e) => {
                                            const poly = e.target;
                                            poly.setStyle({ weight: 10, color: "#ff9900" });
                                            },
                                            mouseout: (e) => {
                                            const poly = e.target;
                                            const id = latestMarkerPos.id;
                                            const isHighlighted = prevHighlighted.current === id;
                                            poly.setStyle({
                                                weight: isHighlighted ? 4 : 2,
                                                color: isHighlighted ? "purple" : "#342fcc",
                                            });
                                            },
                                        }}
                                        key={`polyline-${latestMarkerPos.id}`}
                                        ref={(ref: any) => {
                                            if (ref) {
                                                polylineRefs.current.set(latestMarkerPos.id, ref);
                                                
                                            }
                                            else polylineRefs.current.delete(latestMarkerPos.id);
                                        }}
                                            positions={normalizeTraj(traj)}
                                            pathOptions={{
                                                color: highlightedIndex === latestMarkerPos.id ? "purple" : "#342fcc",
                                                dashArray: "5, 10",
                                                weight: 2,
                                                interactive: true,
                                            }}
                                            
                                        />
                                    )}
                                </React.Fragment>
                            );                        
                })}
                </MarkerClusterGroup>
                {showStorms && (
                    storms.map((storm: Storm, id: number) => {
                        const shape = getStormShape(storm, UGC_LOOKUP)
                        if (shape) {
                            if (shape.type === "polygon" || shape.type === "multipolygon") {
                                const coords = renderCoordinates(shape);
                                if (shape.type === "polygon") {
                                    return <Polygon 
                                                key={id} 
                                                positions={coords} 
                                                pathOptions={polygonStyle}
                                                eventHandlers={{
                                                    mouseover: (e) => e.target.setStyle(polygonHoverStyle),
                                                    mouseout: (e) => e.target.setStyle(polygonStyle)
                                                }}
                                            />;
                                } 
                                else if (storm.geometry?.type === "MultiPolygon") {
                                    return coords.map((poly: any, i: number) => (
                                        <Polygon 
                                            key={`${id}-${i}`} 
                                            positions={poly} 
                                            pathOptions={polygonStyle}
                                            eventHandlers={{
                                                mouseover: (e) => e.target.setStyle(polygonHoverStyle),
                                                mouseout: (e) => e.target.setStyle(polygonStyle)
                                            }}
                                        />
                                    ));
                                }
                                return null;
                            }
    
                        }
                    })
                )}
                
                
            </MapContainer>
            </Box>
        </Box>
    );
}


export default HomeDashboard;