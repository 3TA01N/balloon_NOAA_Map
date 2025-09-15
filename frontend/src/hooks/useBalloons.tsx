import { useState, useEffect, useCallback } from "react";
import axios from 'axios';


export function useBalloons(showTrajectory = false, hoursPast = 0) {
  const [balloons, setBalloons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (controller?: AbortController) => {
    setLoading(true);
    try {
      const res = await axios.get(`http://localhost:3000/api/balloons?hoursPast=${showTrajectory ? hoursPast : 0}`, {
        signal: controller?.signal,
      });
      const flattened: { id: number; latitude: number; longitude: number; altitude: number }[][] = [];

      res.data.forEach((hourData: any) => {
        if (!Array.isArray(hourData)) return;

        hourData.forEach((b: number[], balloonId: number) => {
          if (!flattened[balloonId]) {
            flattened[balloonId] = [];
          }

          if (Array.isArray(b) && b.length === 3 && b.every(n => typeof n === "number")) {
            flattened[balloonId].push({
              id: balloonId,
              latitude: b[0],
              longitude: b[1],
              altitude: b[2],
            });
          }
        });
      })
      //console.log("flattened balloons: ", flattened)
      setBalloons(flattened)
      setError(null)
    } 
    catch (err:any) {
      if (!axios.isCancel(err)) {
        setError(err);
      } 
    } 
    finally {
      setLoading(false);
    }

  },[showTrajectory, hoursPast]);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller);

    return () => {
      controller.abort();
    }
    
  }, [fetchData]);


  return { balloons, loading, error, refresh: fetchData };
}

