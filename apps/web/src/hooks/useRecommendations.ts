import { useState, useEffect, useMemo, useCallback } from 'react';
import { RecommendationRequest, RecommendationResponse, fetchRecommendations } from '../lib/api';

const responseCache = new Map<string, RecommendationResponse>();
const CACHE_LIMIT = 50;

export function useRecommendations(request: RecommendationRequest | null | undefined) {
  const [data, setData] = useState<RecommendationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const [isColdStarting, setIsColdStarting] = useState(false);

  const requestHash = useMemo(() => request ? JSON.stringify(request) : null, [request]);

  const retry = useCallback(() => setFetchTrigger(t => t + 1), []);

  useEffect(() => {
    let active = true;

    if (request === undefined) {
      // Incomplete state; preserve current data and do not fetch
      return;
    }

    if (!requestHash) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(null);
      setError(null);
      setLoading(false);
      setIsValidating(false);
      setIsColdStarting(false);
      return;
    }

    if (responseCache.has(requestHash)) {
      // Cache hit: cached RecommendationResponse objects are treated as immutable/read-only by consumers.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(responseCache.get(requestHash)!);
      setError(null);
      setLoading(false);
      setIsValidating(false);
      setIsColdStarting(false);
      return;
    }

    const currentRequest = JSON.parse(requestHash);

    if (data) {
      setIsValidating(true);
    } else {
      setLoading(true);
    }
    setError(null);
    setIsColdStarting(false);

    const coldStartTimer = setTimeout(() => {
      if (active) {
        setIsColdStarting(true);
      }
    }, 5000);

    const controller = new AbortController();

    const debounceTimer = setTimeout(() => {
      fetchRecommendations(currentRequest, controller.signal)
        .then((res) => {
          if (active) {
            clearTimeout(coldStartTimer);
            if (!responseCache.has(requestHash)) {
              if (responseCache.size >= CACHE_LIMIT) {
                const firstKey = responseCache.keys().next().value;
                if (firstKey) responseCache.delete(firstKey);
              }
              responseCache.set(requestHash, res);
            } else {
              responseCache.set(requestHash, res);
            }
            setData(res);
            setLoading(false);
            setIsValidating(false);
            setIsColdStarting(false);
          }
        })
        .catch((err) => {
          if (err.name === "AbortError") {
            // Intentional cancellation; do nothing
            return;
          }
          if (active) {
            clearTimeout(coldStartTimer);
            setError(err.message || 'Unknown error occurred');
            setLoading(false);
            setIsValidating(false);
            setIsColdStarting(false);
          }
        });
    }, 300);

    return () => {
      active = false;
      controller.abort();
      clearTimeout(coldStartTimer);
      clearTimeout(debounceTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestHash, fetchTrigger]);

  return { data, loading, error, isValidating, isColdStarting, retry };
}
