import { useState, useEffect, useCallback } from "react";
import axios from 'axios';
import express from "express";

const app = express();

export function useBalloons() {
  const [balloons, setBalloons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (controller?: AbortController) => {
    setLoading(true);
    let isMounted = true;
    try {
      const res = await axios.get("http://localhost:3000/api/balloons", {
        signal: controller?.signal,
      });
      const filterBalloons = res.data
      .filter((b: any) => 
        Array.isArray(b) &&
          b.length === 3 &&
          typeof b[0] === "number" &&
          typeof b[1] === "number" &&
          typeof b[2] === "number"
      )
      .map((b: number[]) => ({
        latitude: b[0],
        longitude: b[1],
        altitude: b[2],
      }));
      setBalloons(res.data)
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

  },[]);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller);

    return () => {
      controller.abort();
    }
    
  }, [fetchData]);


  return { balloons, loading, error, refresh: fetchData };
}

