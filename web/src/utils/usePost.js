/* *************************************************************************************************
 * Utlity function to post data to the API. It handles loading, error and data states. It also
 * provides a callback function to process the data.
 * *************************************************************************************************
 */
import { useState } from "react";

export function usePost(props) {
  const { callback, url, options = {} } = props;

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const post = async (body) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
          Authorization: "Bearer " + localStorage.getItem("auth"),
        },
        method: "POST",
        body: JSON.stringify(body),
        ...options,
      });

      if (!response.ok) {
        setError(`HTTP error! Status: ${response.status}`);
      }

      const result = await response.json();

      setSuccess(result.success);
      setError(result.errors);
      setData(result.data);

      if (callback) {
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

  return { data, success, loading, error, post };
}
