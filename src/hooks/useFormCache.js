import { useState, useCallback, useEffect } from 'react';

export const useFormCache = (key, defaultValues) => {
  const [values, setValuesState] = useState(() => {
    try {
      const cached = localStorage.getItem(key);
      if (cached) return JSON.parse(cached);
    } catch {}
    return defaultValues;
  });

  const setValues = useCallback((newValues) => {
    setValuesState((prev) => {
      const next = typeof newValues === 'function' ? newValues(prev) : { ...prev, ...newValues };
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  }, [key]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setValues({ [name]: value });
  }, [setValues]);

  const clearCache = useCallback(() => {
    localStorage.removeItem(key);
    setValuesState(defaultValues);
  }, [key, defaultValues]);

  return { values, handleChange, setValues, clearCache };
};
