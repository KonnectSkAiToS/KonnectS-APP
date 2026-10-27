import { useState, useEffect } from 'react';

export interface UseProgressiveImageOptions {
  placeholder?: string;
  delay?: number; // Optional artificial delay for demonstration/debugging
}

/**
 * Custom hook to progressively load high-res images.
 * Starts with a lightweight placeholder or tiny base64 blur representation,
 * and swaps to the full-size source once downloaded, offering a professional blur-up effect.
 */
export function useProgressiveImage(src: string, options: UseProgressiveImageOptions = {}) {
  const { 
    placeholder = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23f1f5f9"/><circle cx="50" cy="50" r="10" fill="%23cbd5e1" opacity="0.3"/></svg>', 
    delay = 0 
  } = options;

  const [currentSrc, setCurrentSrc] = useState(placeholder);
  const [loading, setLoading] = useState(!!src);
  const [prevSrc, setPrevSrc] = useState(src);

  if (src !== prevSrc) {
    setPrevSrc(src);
    setCurrentSrc(placeholder);
    setLoading(!!src);
  }

  useEffect(() => {
    if (!src) {
      return;
    }

    const img = new Image();
    img.src = src;

    img.onload = () => {
      if (delay > 0) {
        setTimeout(() => {
          setCurrentSrc(src);
          setLoading(false);
        }, delay);
      } else {
        setCurrentSrc(src);
        setLoading(false);
      }
    };

    img.onerror = () => {
      console.warn(`Failed to progressively load image: ${src}`);
      setLoading(false);
    };

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src, placeholder, delay]);

  return { currentSrc, loading };
}
