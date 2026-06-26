/* *************************************************************************************************
 * Utlity function to feth data from the API. It handles loading, error and data states. It also
 * provides a refetch function to manually trigger a new fetch. If the first fetch is to be
 * avoided simply pass true to the avoidFirstFetch parameter. The user can choose to just
 * have the data in the state or do somethng with it via the callback.
 * *************************************************************************************************
 */
import { useState, useEffect, useCallback } from "react";

export function useGet(props) {
  const {
    dependencies = [],
    avoidFirstFetch,
    options = {},
    callback,
    url,
  } = props;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const refetch = useCallback(() => {
    setFetchTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (avoidFirstFetch && fetchTrigger === 0) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const signal = controller.signal;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(url, {
          headers: {
            ...options.headers,
            Authorization: "Bearer " + localStorage.getItem("auth"),
          },
          method: "GET",
          ...options,
          signal,
        });
        if (!response.ok) {
          setError(`HTTP error! Status: ${response.status}`);
        }
        const result = await response.json();

        if (result.error) {
          setError(result.error);
        }

        if (result.data) {
          setData(result.data);
        }

        if (callback && result.data) {
          callback(result.data);
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Something went wrong");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    return () => controller.abort();
  }, [url, fetchTrigger, ...dependencies]);

  return { data, loading, error, refetch };
}
