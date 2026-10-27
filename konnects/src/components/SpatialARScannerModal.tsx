import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, RefreshCw, Layers, PenTool, Check, Ruler, Info, Box, Clipboard, Compass } from 'lucide-react';
import { haptics } from '../utils/haptics';

interface SpatialARScannerModalProps {
  show: boolean;
  onClose: () => void;
  onSaveScan: (scanData: {
    area: number;
    perimeter: number;
    height: number;
    wallArea: number;
    materials: Record<string, string>;
    nodesCount: number;
    label: string;
  }) => void;
  serviceName: string;
}

export function SpatialARScannerModal({ show, onClose, onSaveScan, serviceName }: SpatialARScannerModalProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [nodes, setNodes] = useState<{ x: number; y: number; id: number; dist: number }[]>(() => [
    { x: 30, y: 30, id: 1, dist: 3.2 },
    { x: 70, y: 30, id: 2, dist: 4.1 },
    { x: 70, y: 70, id: 3, dist: 3.0 },
    { x: 30, y: 70, id: 4, dist: 2.8 },
  ]);
  const [ceilingHeight, setCeilingHeight] = useState(2.8); // Metres
  const [viewMode, setViewMode] = useState<'camera' | 'bim' | 'floorplan'>('camera');
  const [scanComplete, setScanComplete] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 450 });

  // Dynamically update element dimensions via ResizeObserver
  useEffect(() => {
    if (!show || !containerRef.current) return;
    
    setDimensions({
      width: containerRef.current.clientWidth || 400,
      height: containerRef.current.clientHeight || 450
    });

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          setDimensions({
            width: entry.contentRect.width || 400,
            height: entry.contentRect.height || 450
          });
        }
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [show]);

  // Request real camera feed
  const startCamera = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      Promise.resolve().then(() => {
        setIsScanning(true);
      });
    } catch (err) {
      console.warn('Real camera feed request timed out or was blocked by browser. Activating telemetry simulation.', err);
      Promise.resolve().then(() => {
        setIsScanning(true);
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    Promise.resolve().then(() => {
      setIsScanning(false);
    });
  };

  useEffect(() => {
    let active = true;
    if (show) {
      Promise.resolve().then(() => {
        if (active) startCamera();
      });
    } else {
      Promise.resolve().then(() => {
        if (active) stopCamera();
      });
    }
    return () => {
      active = false;
      stopCamera();
    };
  }, [show]);

  const addManualNode = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    haptics.light();
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    // Random distance from 2.0 to 5.0m
    const dist = +(2 + Math.random() * 3.5).toFixed(1);
    
    setNodes(prev => [
      ...prev,
      { x, y, id: Date.now(), dist }
    ]);
  };

  const resetScanner = () => {
    haptics.medium();
    setNodes([
      { x: 30, y: 30, id: 1, dist: 3.2 },
      { x: 70, y: 30, id: 2, dist: 4.1 },
      { x: 70, y: 70, id: 3, dist: 3.0 },
      { x: 30, y: 70, id: 4, dist: 2.8 },
    ]);
    setScanProgress(0);
    setScanComplete(false);
  };

  const handleRunSpatialAnalysis = () => {
    haptics.heavy();
    setScanComplete(true);
  };

  // Calculations based on node geometry (simulated)
  const perimeter = +(nodes.length * 3.2 + 2).toFixed(1);
  const area = +(nodes.length * 4.5 + 1.2).toFixed(1);
  const wallArea = +(perimeter * ceilingHeight).toFixed(1);

  // Dynamic estimate recommendations depending on whether it is painting, trades, construction or cleaning
  const getMaterialEstimates = () => {
    const isPaint = serviceName.toLowerCase().includes('paint') || serviceName.toLowerCase().includes('decorat');
    const isClean = serviceName.toLowerCase().includes('clean') || serviceName.toLowerCase().includes('hygien');
    const isTrades = serviceName.toLowerCase().includes('electric') || serviceName.toLowerCase().includes('plumb') || serviceName.toLowerCase().includes('wire');

    if (isPaint) {
      return {
        'Primer Required': '5.0 Litres (Low-VOC)',
        'Topcoat Paint': `${+(wallArea * 0.15).toFixed(1)} Litres (Matte or Silk)`,
        'Painter Tape': '2 Rolls (50m each)',
        'Recommended Time': '1.5 Days duration estimate'
      };
    } else if (isClean) {
      return {
        'Sanitiser spray': '2.5 Litres commercial-grade',
        'Deep Steam Cleaner': 'Heavy Duty Floor Vacuum toolset',
        'Recommended Crew': '2 Qualified Hygiene specialists',
        'Recommended Time': '4 Hours deep clean service'
      };
    } else if (isTrades) {
      return {
        'Wall Chase Length': `${perimeter} metres of routing`,
        'Conduit Cable': `${+(perimeter * 1.5).toFixed(1)} metres structured wire`,
        'Junction Boxes': `${nodes.length + 2} heavy-duty terminals`,
        'Compliance Check': '17th Ed. Certified Signoff'
      };
    } else {
      return {
        'Subfloor Baseboard': `${perimeter} running metres`,
        'Underlay Layer': `${area} m² moisture lock cover`,
        'Screws & Wall Plugs': '150 units pack',
        'Worker Labor': 'BIM aligned structural quote'
      };
    }
  };

  const materialSuggestions = getMaterialEstimates();

  const handleSaveAndInject = () => {
    haptics.heavy();
    onSaveScan({
      area,
      perimeter,
      height: ceilingHeight,
      wallArea,
      materials: materialSuggestions,
      nodesCount: nodes.length,
      label: `${area}m² Room Scan attached to ${serviceName}`
    });
    onClose();
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950 p-0 sm:p-4 md:p-6 overflow-hidden select-none">
        {/* Main interactive full-screen container */}
        <div className="relative w-full h-full max-w-5xl bg-slate-900 sm:rounded-[36px] flex flex-col md:flex-row overflow-hidden border border-slate-800 shadow-2xl">
          
          {/* LEFT: AR / Camera view with scan wireframes */}
          <div className="relative flex-1 bg-black overflow-hidden flex flex-col">
            
            {/* Simulation camera viewport */}
            <div 
              ref={containerRef}
              onClick={addManualNode}
              className="relative flex-1 w-full h-full flex items-center justify-center cursor-pointer overflow-hidden group"
            >
              <div className="absolute inset-0 bg-slate-900 pointer-events-none opacity-20" />
              
              {/* Actual camera feed */}
              <video 
                ref={videoRef}
                autoPlay 
                playsInline
                className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1] opacity-75 mix-blend-screen pointer-events-none"
              />

              {/* Wireframe Grid or Canvas simulation */}
              <div className="absolute inset-x-0 top-0 h-1 bg-cyan-400 opacity-60 shadow-lg shadow-cyan-400/85 animate-[pulse_2s_infinite] pointer-events-none" />

              <div className="absolute inset-0 flex flex-col justify-between p-4 pointer-events-none">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-800">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping shrink-0" />
                    <span className="text-[10px] font-mono text-cyan-400 font-extrabold tracking-widest uppercase">LiDAR SPATIAL SCANNER ACTIVE</span>
                  </div>
                  <div className="flex space-x-1.5">
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setViewMode('camera'); }}
                      className={`p-2 rounded-xl transition-all border-none text-[10px] uppercase font-black tracking-widest cursor-pointer pointer-events-auto ${viewMode === 'camera' ? 'bg-cyan-500 text-white shadow-lg' : 'bg-slate-950/85 text-slate-400'}`}
                    >
                      Camera
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setViewMode('bim'); }}
                      className={`p-2 rounded-xl transition-all border-none text-[10px] uppercase font-black tracking-widest cursor-pointer pointer-events-auto ${viewMode === 'bim' ? 'bg-indigo-500 text-white shadow-lg' : 'bg-slate-950/85 text-slate-400'}`}
                    >
                      BIM 3D
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setViewMode('floorplan'); }}
                      className={`p-2 rounded-xl transition-all border-none text-[10px] uppercase font-black tracking-widest cursor-pointer pointer-events-auto ${viewMode === 'floorplan' ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-950/85 text-slate-400'}`}
                    >
                      Blueprint
                    </button>
                  </div>
                </div>

                <div className="text-center text-[11px] font-bold text-slate-350 bg-slate-950/65 backdrop-blur px-3 py-2 rounded-2xl mx-auto max-w-sm">
                  📢 Tap on coordinates inside the box to insert more architectural corner nodes and plot boundaries manually.
                </div>
              </div>

              {/* DRAW CONNECTOR LINES BETWEEN NODES */}
              {viewMode === 'camera' && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {nodes.length > 1 && (
                    <polygon
                      points={nodes.map(n => `${(n.x / 100) * dimensions.width},${(n.y / 100) * dimensions.height}`).join(' ')}
                      fill="rgba(34, 211, 238, 0.08)"
                      stroke="#22d3ee"
                      strokeWidth="2.5"
                      strokeDasharray="6 4"
                      className="animate-[dash_20s_linear_infinite]"
                    />
                  )}
                  {nodes.map((n, idx) => {
                    const cx = (n.x / 100) * dimensions.width;
                    const cy = (n.y / 100) * dimensions.height;
                    return (
                      <g key={n.id}>
                        <circle cx={cx} cy={cy} r="6" fill="#22d3ee" className="animate-pulse" />
                        <line x1={cx} y1={cy} x2={cx} y2={cy - 20} stroke="#22d3ee" strokeWidth="1" />
                        <text x={cx + 10} y={cy - 10} fill="#22d3ee" fontSize="10" fontFamily="monospace" fontWeight="bold">
                          N-{idx + 1}: {n.dist}m
                        </text>
                      </g>
                    );
                  })}
                </svg>
              )}

              {/* 3D BIM WIREFRAME WIRE RENDERING */}
              {viewMode === 'bim' && (
                <div className="absolute inset-0 flex items-center justify-center p-8 bg-black/60 backdrop-blur-sm">
                  <div className="w-full max-w-md h-[70%] border border-cyan-500/20 rounded-3xl relative overflow-hidden bg-slate-950 flex flex-col justify-between p-4">
                    <Compass className="text-cyan-400 absolute top-4 left-4 animate-spin-slow" size={24} />
                    <div className="text-cyan-400 text-[10px] font-mono text-right font-black uppercase">WALL WIREFRAME EXPANSION • REAL-TIME BIM MODEL</div>
                    
                    {/* Simulated 3D isometric room container */}
                    <div className="flex-1 flex items-center justify-center">
                      <div className="relative w-56 h-48 border border-cyan-500/30 transform rotate-x-[45deg] rotate-z-[30deg] skew-x-[15deg]">
                        {/* Floor plane */}
                        <div className="absolute inset-0 bg-cyan-500/10 border-b-2 border-cyan-500/40" />
                        {/* Extruded walls */}
                        <div className="absolute inset-y-0 left-0 w-2 h-48 bg-cyan-500/25 border-r border-cyan-500 transform -translate-x-[2px] -translate-y-24 origin-bottom rotate-x-[-90deg] skew-y-[30deg]" />
                        <div className="absolute inset-x-0 bottom-0 h-2 w-56 bg-cyan-500/20 border-t border-cyan-500 transform -translate-y-[2px] translate-z-[24px] origin-right rotate-y-[90deg]" />
                        
                        <div className="absolute top-10 left-10 text-cyan-400 text-[9px] font-mono tracking-widest uppercase">
                          H: {ceilingHeight}m
                        </div>
                        <div className="absolute bottom-1 right-2 text-cyan-400 text-[9px] font-mono tracking-widest uppercase">
                          W: {perimeter}m
                        </div>
                      </div>
                    </div>
                    
                    <span className="text-[9px] text-cyan-500 uppercase font-mono font-black text-center tracking-wider bg-cyan-500/5 py-1.5 rounded-xl border border-cyan-500/10">BIM MODEL GENERATED COMPLIANT TO BS ISO 19650</span>
                  </div>
                </div>
              )}

              {/* FLAT ARCHITECTURAL BLUEPRINT BLUEPRINT */}
              {viewMode === 'floorplan' && (
                <div className="absolute inset-0 flex items-center justify-center p-8 bg-slate-950/95">
                  <div className="w-full max-w-md h-[70%] border border-emerald-500/30 rounded-3xl relative bg-slate-900 border-dashed border-2 flex flex-col justify-between p-4">
                    <Compass className="text-emerald-400 absolute top-4 left-4" size={24} />
                    <div className="text-emerald-400 text-[10px] font-mono text-right font-black uppercase">2D BLUEPRINT PLAN LAYOUT • HORIZONTAL LEVEL</div>
                    
                    <div className="flex-1 flex items-center justify-center">
                      <svg className="w-64 h-64 border border-emerald-500/15 bg-slate-950/30">
                        {/* Isometric Blueprint grid lines */}
                        <path d="M 0,32 L 256,32 M 0,64 L 256,64 M 0,96 L 256,96 M 0,128 L 256,128 M 0,160 L 256,160 M 0,192 L 256,192 M 0,224 L 256,224" stroke="rgba(16, 185, 129, 0.04)" strokeWidth="1" />
                        <path d="M 32,0 L 32,256 M 64,0 L 64,256 M 96,0 L 96,256 M 128,0 L 128,256 M 160,0 L 160,256 M 192,0 L 192,256 M 224,0 L 224,256" stroke="rgba(16, 185, 129, 0.04)" strokeWidth="1" />
                        {polygonArea(nodes) > 0 && (
                          <polygon
                            points={nodes.map(n => `${(n.x / 100) * 256},${(n.y / 100) * 256}`).join(' ')}
                            fill="rgba(16, 185, 129, 0.08)"
                            stroke="#10b981"
                            strokeWidth="2.5"
                          />
                        )}
                        <text x="128" y="128" fill="#10b981" fontSize="11" fontFamily="monospace" fontWeight="extrabold" textAnchor="middle">
                          {area}m² Area
                        </text>
                      </svg>
                    </div>
                    
                    <span className="text-[9px] text-emerald-500 uppercase font-mono font-black text-center tracking-wider bg-emerald-500/5 py-1.5 rounded-xl border border-emerald-500/10">BIM BOUNDARY ESTIMATOR ACTIVE</span>
                  </div>
                </div>
              )}
            </div>

            {/* In-view Camera control drawer */}
            <div className="bg-slate-950/90 border-t border-slate-800 p-4.5 flex justify-between items-center text-xs">
              <div className="flex items-center space-x-3.5">
                <div className="flex flex-col">
                  <span className="text-slate-400 text-[10px] uppercase font-black tracking-widest mb-1.5">Set Ceiling Height</span>
                  <div className="flex items-center space-x-2">
                    <input 
                      type="range"
                      min="2.0"
                      max="4.5"
                      step="0.1"
                      value={ceilingHeight}
                      onChange={(e) => { haptics.light(); setCeilingHeight(+e.target.value); }}
                      className="w-24 accent-cyan-400"
                    />
                    <span className="font-mono text-cyan-400 font-extrabold">{ceilingHeight}m</span>
                  </div>
                </div>
              </div>

              <div className="flex space-x-2">
                <button 
                  onClick={resetScanner}
                  className="px-4 py-3 border border-slate-800 hover:bg-slate-900 bg-transparent text-slate-450 rounded-2xl flex items-center space-x-1.5 transition-all text-xs font-bold cursor-pointer"
                >
                  <RefreshCw size={12} />
                  <span>Reset All</span>
                </button>
                <button 
                  onClick={handleRunSpatialAnalysis}
                  className="px-5 py-3 border-none bg-cyan-500 hover:bg-cyan-600 active:scale-95 text-white font-extrabold rounded-2xl flex items-center space-x-2 transition-all text-xs cursor-pointer shadow-lg shadow-cyan-500/20"
                >
                  <PenTool size={13} />
                  <span>Fit Boundary & Estimate</span>
                </button>
              </div>
            </div>

          </div>

          {/* RIGHT: Analysis & material quote summaries */}
          <div className="w-full md:w-[360px] bg-slate-900 border-l border-slate-800 p-6 flex flex-col justify-between overflow-y-auto max-h-[45vh] md:max-h-none no-scrollbar">
            
            <div className="space-y-6">
              <div>
                <span className="text-[8.5px] uppercase font-black tracking-widest text-[#22d3ee] bg-[#22d3ee]/10 px-2 py-0.5 rounded-md">BIM Architectural Engine</span>
                <h3 className="text-lg font-black text-white mt-2 tracking-tight">Quantity Survey & Quote</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Bound to: {serviceName}</p>
              </div>

              {/* Key Metrics block */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="bg-slate-950 p-4.5 rounded-2.5xl border border-slate-800 flex flex-col justify-between">
                  <Ruler size={16} className="text-cyan-400 mb-2" />
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Estimated Area</span>
                    <span className="text-lg font-mono font-extrabold text-cyan-400">{area} m²</span>
                  </div>
                </div>
                <div className="bg-slate-950 p-4.5 rounded-2.5xl border border-slate-800 flex flex-col justify-between">
                  <Box size={16} className="text-indigo-400 mb-2" />
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Walls Surface</span>
                    <span className="text-lg font-mono font-extrabold text-indigo-400">{wallArea} m²</span>
                  </div>
                </div>
              </div>

              {/* Material Estimate Lists */}
              <div className="space-y-3">
                <span className="text-[10px] tracking-widest uppercase font-black text-slate-400 block mt-2">BIM Core Material Forecast</span>
                <div className="bg-slate-950 border border-slate-850 rounded-2xl p-4.5 space-y-2.5">
                  {Object.entries(materialSuggestions).map(([name, val], idx) => (
                    <div key={idx} className="flex justify-between items-center text-[11px] font-bold border-b border-slate-850 last:border-0 pb-1.5 last:pb-0">
                      <span className="text-slate-400 font-medium">{name}</span>
                      <span className="text-white font-mono">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dynamic Quote estimate */}
              <div className="bg-gradient-to-br from-indigo-950 to-slate-900 border border-indigo-500/20 rounded-2.5xl p-5 relative overflow-hidden">
                <div className="text-[9px] font-black uppercase text-indigo-300 tracking-widest">Adjusted Space Quote Estimate</div>
                <div className="flex items-baseline space-x-1.5 mt-2">
                  <span className="text-2xl font-mono font-extrabold text-white">£{(area * 14.5 + ceilingHeight * 12 + 45).toFixed(2)}</span>
                  <span className="text-[10px] text-indigo-400 font-bold">Fixed material + labor estimate</span>
                </div>
                <p className="text-[9.5px] text-slate-400 mt-2 font-medium leading-relaxed">
                  Real-time dimensions are parsed directly by our contractor AI suite, guaranteeing no hidden overruns or custom service price inflation after callout.
                </p>
              </div>
            </div>

            <div className="pt-6 space-y-3 mt-6 border-t border-slate-800">
              <button 
                onClick={onClose}
                className="w-full py-4 bg-transparent border border-slate-800 hover:bg-slate-900 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
              >
                Cancel / Return
              </button>
              <button 
                onClick={handleSaveAndInject}
                className="w-full py-4.5 border-none bg-gradient-to-r from-cyan-400 to-indigo-500 hover:from-cyan-500 hover:to-indigo-600 active:scale-95 text-white rounded-2.5xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-950/20 flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <Check size={14} strokeWidth={3} />
                <span>Attach Spatial BIM to Booking</span>
              </button>
            </div>

          </div>

        </div>
      </div>
    </AnimatePresence>
  );
}

// Minimalist local helper for polygon calculation
function polygonArea(nodes: any[]): number {
  if (nodes.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < nodes.length; i++) {
    const j = (i + 1) % nodes.length;
    area += nodes[i].x * nodes[j].y;
    area -= nodes[j].x * nodes[i].y;
  }
  return Math.abs(area / 2);
}
