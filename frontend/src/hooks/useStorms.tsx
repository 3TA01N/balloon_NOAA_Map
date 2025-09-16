import { useState, useEffect, useCallback,useMemo } from "react";
import axios from 'axios';
import type { Feature, Geometry } from "geojson";


export function useStorms(preFilters?: {
    area?: string[];
    point?: string[];
    region?: string[];
    regionType?: string[];
    urgency?: string[];
    severity?: string[];
    certainty?: string[];
}) {
    const filters = useMemo(()=> preFilters, [JSON.stringify(preFilters)])
    const [storms, setStorms] = useState<any[]>([]);
    const [stormLoading, setLoading] = useState(true);
    const [stormError, setError] = useState<string | null>(null);

    const fetchStorms = useCallback(async (controller?: AbortController) => {
        setLoading(true);
        try {
            const params: any = {};

            if (filters) {
                if (filters.area?.length) params.area = filters.area.join(",");
                if (filters.point?.length) params.point = filters.point.join(",");
                if (filters.region?.length) params.region = filters.region.join(",");
                if (filters.regionType) params.regionType = filters.regionType.join(",");
                if (filters.urgency?.length) params.urgency = filters.urgency.join(",");
                if (filters.severity?.length) params.severity = filters.severity.join(",");
                if (filters.certainty?.length) params.certainty = filters.certainty.join(",");
            }
            const res = await axios.get("/api/storms", {
                params,
                signal: controller?.signal,
        });
        
        setError(null)
        const features: Feature<Geometry | null>[] = res.data
        setStorms(features)



        } 
        catch (err: any) {
            if (!axios.isCancel(err)) {
                console.error(err);
                setError(err.message);
            }
        } 
        finally {
            setLoading(false);
        }
        

        
        
    }, [filters]);
    useEffect(() => {
        const controller = new AbortController();
        fetchStorms(controller);
        const interval = setInterval(() => fetchStorms(new AbortController()), 5 * 60 * 1000);
  
        return () => {
            controller.abort();
            clearInterval(interval);
        };
        
    }, [fetchStorms]);
    useEffect(() => {
        const controller = new AbortController();
        fetchStorms(controller);
        return () => controller.abort();
    }, [fetchStorms]);

  return { storms, stormLoading, stormError };
}