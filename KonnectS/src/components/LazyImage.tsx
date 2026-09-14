import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon, Zap } from 'lucide-react';
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
  const [isPowerSavingMode, setIsPowerSavingMode] = useState<boolean>(() => {
    return localStorage.getItem('konnects_manual_power_saving') === 'true';
  });
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

  // Monitor battery level and local power saving configurations
  useEffect(() => {
    const checkPowerSaving = () => {
      const manual = localStorage.getItem('konnects_manual_power_saving') === 'true';
      const appLowBattery = localStorage.getItem('is_low_battery') === 'true';
      const batterySaverActive = localStorage.getItem('konnects_battery_saver_active') === 'true';
      if (manual || appLowBattery || batterySaverActive) {
        setIsPowerSavingMode(true);
        return;
      }

      // Check real-time Battery Status API
      if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'getBattery' in navigator) {
        (navigator as any).getBattery().then((battery: any) => {
          const isLow = battery.level <= 0.25 && !battery.charging;
          setIsPowerSavingMode(isLow || appLowBattery || batterySaverActive);
        }).catch(() => {});
      } else {
        setIsPowerSavingMode(appLowBattery || batterySaverActive);
      }
    };

    checkPowerSaving();
    const interval = setInterval(checkPowerSaving, 2500);
    return () => clearInterval(interval);
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
          // Trigger asynchronous background cache download for same-origin assets only
          if (src.startsWith('/') || src.startsWith(window.location.origin)) {
            fetch(src, { referrerPolicy: 'no-referrer' })
              .then((res) => {
                if (!res.ok) return null;
                return res.blob();
              })
              .then((blob) => {
                if (!blob) return;
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
        }
      });
      return () => {
        active = false;
      };
    }
  }, [src, isInView, isPowerSavingMode]);

  // Use the progressive loading hook to manage blur-up
  const targetSrc = cachedSrc || src;
  const { currentSrc, loading } = useProgressiveImage(isInView ? targetSrc : '', {
    delay: isPowerSavingMode ? 0 : 150 // Bypass transition delay in power saving mode, but still load!
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
