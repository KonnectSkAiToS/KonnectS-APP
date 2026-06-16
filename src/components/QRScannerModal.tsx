import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, Upload, Check, Sparkles, AlertCircle, Laptop, CreditCard, RefreshCw } from 'lucide-react';
import { haptics } from '../utils/haptics';
import { motion, AnimatePresence } from 'framer-motion';

interface QRScannerModalProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
  mode: 'vouchers' | 'products';
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({ onScanSuccess, onClose, mode }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [simulatedTrigger, setSimulatedTrigger] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);

  useEffect(() => {
    // Attempt standard browser media camera permissions
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then((mediaStream) => {
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      })
      .catch((err) => {
        console.warn("Iframe camera access restrictions or device missing:", err);
        setCameraError("Camera device blocked or unavailable inside sandbox environment. Using visual focus helper.");
      });

    // Cleanup camera feed on close
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    haptics.medium();
    
    // Simulate image uploading
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setUploadedFile(file.name);
      setTimeout(() => {
        triggerSimulatedResult(mode === 'vouchers' ? 'VOUCHER-KONNECTS25' : 'PRODUCT-OXFORD-DESK');
      }, 1000);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    haptics.medium();
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setUploadedFile(file.name);
      setTimeout(() => {
        triggerSimulatedResult(mode === 'vouchers' ? 'VOUCHER-KONNECTS25' : 'PRODUCT-OXFORD-DESK');
      }, 1000);
    }
  };

  const triggerSimulatedResult = (code: string) => {
    haptics.success();
    onScanSuccess(code);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[250] flex items-center justify-center p-6 text-left">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-slate-900 border border-slate-800 text-white rounded-[32px] p-6 max-w-sm w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar"
      >
        {/* Modal Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping shrink-0" />
            <div>
              <h3 className="font-black text-sm uppercase tracking-widest text-[#f43f5e] leading-none">
                QR Scanner Active
              </h3>
              <p className="text-[9.5px] text-slate-400 font-extrabold uppercase mt-0.5 tracking-wider">
                {mode === 'vouchers' ? 'Redeem Voucher Coupon' : 'Scan Product Barcode'}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-200 cursor-pointer border-none"
          >
            <X size={14} />
          </button>
        </div>

        {/* Live Video Display Container */}
        <div className="relative w-full aspect-square bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-center overflow-hidden">
          {cameraError ? (
            <div className="absolute inset-0 p-5 flex flex-col items-center justify-center text-center space-y-2 select-none">
              <Camera size={28} className="text-slate-600 animate-pulse" />
              <span className="text-[10px] text-slate-500 font-bold leading-normal">
                {cameraError}
              </span>
            </div>
          ) : (
            <video 
              ref={videoRef}
              autoPlay 
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover rounded-2xl" 
            />
          )}

          {/* Glowing Green Scanning Reticle Overlay */}
          <div className="absolute inset-8 border border-dashed border-emerald-500 rounded-xl pointer-events-none flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <div className="w-full h-0.5 bg-emerald-500 absolute top-1/2 left-0 animate-pulse shadow-[0_0_10px_#10b981]" />
          </div>

          <div className="absolute bottom-4 right-4 bg-emerald-600 text-[8.5px] font-black uppercase px-2 py-0.5 rounded tracking-wide">
            Auto-focusing
          </div>
        </div>

        {/* Interactive Simulation targets */}
        <div className="space-y-2 pt-1">
          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
            Simulate QR Target Code Detect:
          </span>
          <div className="flex gap-2">
            {mode === 'vouchers' ? (
              <>
                <button
                  type="button"
                  onClick={() => triggerSimulatedResult('VOUCHER-KONNECTS25')}
                  className="flex-1 p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider cursor-pointer border-none"
                >
                  🎫 £25 Voucher
                </button>
                <button
                  type="button"
                  onClick={() => triggerSimulatedResult('VOUCHER-FREESHIP')}
                  className="flex-1 p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider cursor-pointer border-none"
                >
                  🚚 Free Delivery
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => triggerSimulatedResult('PRODUCT-HOXTON-DESK')}
                  className="flex-1 p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider cursor-pointer border-none"
                >
                  🖥️ Oak Desk
                </button>
                <button
                  type="button"
                  onClick={() => triggerSimulatedResult('PRODUCT-VINTAGE-CHAIR')}
                  className="flex-1 p-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider cursor-pointer border-none"
                >
                  🪑 Retro Chair
                </button>
              </>
            )}
          </div>
        </div>

        {/* Usability Pattern Fallback: Drag and Drop support OR upload manual QR image files */}
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`p-4 border border-dashed rounded-2xl text-center cursor-pointer transition-colors ${
            isDragOver 
              ? 'border-emerald-500 bg-emerald-950/20 text-[#10b981]' 
              : 'border-slate-805 bg-slate-950/40 text-slate-400 hover:border-slate-700'
          }`}
        >
          <label className="cursor-pointer space-y-1 block">
            <Upload size={18} className="mx-auto text-slate-500" />
            <p className="text-[10px] font-bold">
              {uploadedFile ? `Scanning: ${uploadedFile}` : 'Drag & Drop QR image or Click to scan'}
            </p>
            <p className="text-[8.5px] uppercase tracking-wider text-slate-500 font-black">
              Supports JPEG, PNG, WEBP
            </p>
            <input 
              type="file" 
              accept="image/*"
              className="hidden" 
              onChange={handleFileSelect}
            />
          </label>
        </div>

      </motion.div>
    </div>
  );
};
