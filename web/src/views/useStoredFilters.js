import { useEffect, useState } from "react";
import { readStoredJSON, writeStoredJSON } from "@utils/localStorage";

export const useStoredFilters = (storageKey) => {
  const [saved] = useState(() => readStoredJSON(storageKey) || {});
  const [query, setQuery] = useState(() => typeof saved.query === "string" ? saved.query : "");
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [selectedSubjects, setSelectedSubjects] = useState(() =>
    new Set(Array.isArray(saved.selectedSubjects) ? saved.selectedSubjects.filter(Number.isInteger) : []),
  );
  const [selectedStatus, setSelectedStatus] = useState(() =>
    ["complete", "incomplete"].includes(saved.selectedStatus) ? saved.selectedStatus : "",
  );
  const [selectedYears, setSelectedYears] = useState(() =>
    new Set(Array.isArray(saved.selectedYears) ? saved.selectedYears.filter(Number.isInteger) : []),
  );
  const [selectedMonths, setSelectedMonths] = useState(() =>
    new Set(Array.isArray(saved.selectedMonths) ? saved.selectedMonths.filter((month) => Number.isInteger(month) && month >= 1 && month <= 12) : []),
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 1000);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    writeStoredJSON(storageKey, {
      query,
      selectedSubjects: [...selectedSubjects],
      selectedStatus,
      selectedYears: [...selectedYears],
      selectedMonths: [...selectedMonths],
    });
  }, [storageKey, query, selectedSubjects, selectedStatus, selectedYears, selectedMonths]);

  const hasFilters = Boolean(query || debouncedQuery || selectedSubjects.size ||
    selectedStatus || selectedYears.size || selectedMonths.size);

  const clearFilters = () => {
    setQuery("");
    setDebouncedQuery("");
    setSelectedSubjects(new Set());
    setSelectedStatus("");
    setSelectedYears(new Set());
    setSelectedMonths(new Set());
  };

  return {
    query, setQuery, debouncedQuery,
    selectedSubjects, setSelectedSubjects,
    selectedStatus, setSelectedStatus,
    selectedYears, setSelectedYears,
    selectedMonths, setSelectedMonths,
    hasFilters, clearFilters,
  };
};