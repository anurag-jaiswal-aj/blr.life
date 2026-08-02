import { useState, useEffect, useMemo } from 'react';
import { RecommendationRequest, RecommendationResponse, fetchRecommendations } from '../lib/api';

export function useRecommendations(request: RecommendationRequest | null) {
  const [data, setData] = useState<RecommendationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestHash = useMemo(() => request ? JSON.stringify(request) : null, [request]);

  useEffect(() => {
    let active = true;

    if (!requestHash) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    const currentRequest = JSON.parse(requestHash);

    setLoading(true);
    setError(null);

    fetchRecommendations(currentRequest)
      .then((res) => {
        if (active) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || 'Unknown error occurred');
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [requestHash]);

  return { data, loading, error };
}
