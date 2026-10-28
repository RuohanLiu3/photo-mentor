import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

/** Separate storage namespaces preserve existing course history and local-only provenance. */
export function useLocalState<T>(
  key: string,
  parse: (raw: string | null) => T,
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const [initial] = useState(() => {
    try {
      return { value: parse(localStorage.getItem(key)), error: false };
    } catch {
      return { value: parse(null), error: true };
    }
  });
  const [value, setValue] = useState(initial.value);
  const [error, setError] = useState(initial.error);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      setError(false);
    } catch {
      setError(true);
    }
  }, [key, value]);
  return [value, setValue, error];
}
