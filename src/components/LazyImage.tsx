import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon } from 'lucide-react';
import { getCachedImage, cacheImage } from '../utils/indexedDB';
import { useProgressiveImage } from '../hooks/useProgressiveImage';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
}

export function LazyImage({ src, alt, className = '' }: LazyImageProps) {
  const [isInView, setIsInView] = useState(false);
  const [cachedSrc, setCachedSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '100px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  // Fetch from IndexedDB offline cache first
  useEffect(() => {
    if (isInView && src) {
      let active = true;
      getCachedImage(src).then((cachedData) => {
        if (!active) return;
        if (cachedData) {
          setCachedSrc(cachedData);
        } else {
          // Trigger asynchronous background cache download
          fetch(src, { referrerPolicy: 'no-referrer' })
            .then((res) => res.blob())
            .then((blob) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                if (reader.result && typeof reader.result === 'string') {
                  cacheImage(src, reader.result);
                }
              };
              reader.readAsDataURL(blob);
            })
            .catch(() => {});
        }
      });
      return () => {
        active = false;
      };
    }
  }, [src, isInView]);

  // Use the progressive loading hook to manage blur-up
  const targetSrc = cachedSrc || src;
  const { currentSrc, loading } = useProgressiveImage(isInView ? targetSrc : '', {
    delay: 150 // Add a subtle delay to guarantee progressive blur-up visual feedback
  });

  return (
    <div
      ref={imgRef}
      className={`relative overflow-hidden bg-slate-100 dark:bg-slate-850 flex items-center justify-center ${className}`}
    >
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center text-slate-300 dark:text-slate-700 bg-slate-100 dark:bg-slate-850/80 backdrop-blur-md z-10"
          >
            <ImageIcon size={20} className="stroke-[1.5] animate-pulse" />
          </motion.div>
        )}
      </AnimatePresence>

      {isInView && currentSrc && (
        <img
          src={currentSrc}
          alt={alt}
          referrerPolicy="no-referrer"
          className={`w-full h-full object-cover transition-all duration-700 ease-out ${
            loading ? 'blur-md scale-105 opacity-60' : 'blur-0 scale-100 opacity-100'
          }`}
        />
      )}
    </div>
  );
}
