import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Award, BookOpen, GraduationCap, Sparkles, TrendingUp } from 'lucide-react';
import { haptics } from '../utils/haptics';

interface Skill {
  axis: string;
  value: number;
  trainingOpportunity: string;
  courseDuration: string;
}

interface WorkerCapabilityRadarProps {
  workerType?: string;
  username?: string;
}

export const WorkerCapabilityRadar: React.FC<WorkerCapabilityRadarProps> = ({ workerType, username }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Default skill lists based on worker profession
  const getInitialSkills = (): Skill[] => {
    const isCleaner = workerType?.toLowerCase().includes('clean') || workerType?.toLowerCase().includes('domestic');
    if (isCleaner) {
      return [
        { axis: 'Coverage Speed', value: 75, trainingOpportunity: 'Apex-Cleaning Time Mastery Certificate', courseDuration: '2 hours self-paced' },
        { axis: 'Deep Cleaning', value: 95, trainingOpportunity: 'Advanced Sanitization & Biohazard Clearance', courseDuration: 'Approved ✓' },
        { axis: 'Communication', value: 70, trainingOpportunity: 'Client Protocol & Host Hospitality Masterclass', courseDuration: '1.5 hours' },
        { axis: 'Punctuality', value: 85, trainingOpportunity: 'Smart Route Schedule Planning Module', courseDuration: '30 mins micro-class' },
        { axis: 'Eco Safe Chem', value: 60, trainingOpportunity: 'Green Chemical Professional Safety Shield', courseDuration: '1 hour' },
        { axis: 'Attention to Detail', value: 90, trainingOpportunity: 'Premium Luxury Lodging Level-up', courseDuration: 'Approved ✓' },
      ];
    } else {
      // General artisan / trade pro
      return [
        { axis: 'Turnaround Rate', value: 80, trainingOpportunity: 'Contractor Workload & Speed Diagnostics Course', courseDuration: '1.5 hours' },
        { axis: 'Material Prep', value: 88, trainingOpportunity: 'Basic Material Waste Auditing Seminar', courseDuration: '45 mins' },
        { axis: 'Customer Care', value: 72, trainingOpportunity: 'Communication & Five-Star Superhost Workshop', courseDuration: '2 hours self-paced' },
        { axis: 'Time-Tracking', value: 92, trainingOpportunity: 'Pro Time Management Techniques', courseDuration: 'Approved ✓' },
        { axis: 'Advanced Tools', value: 65, trainingOpportunity: 'Multi-Tasking Smart-Tools Certification', courseDuration: '3 hours practical' },
        { axis: 'Safety Compliance', value: 95, trainingOpportunity: 'UK Professional Worksite Safety Standard', courseDuration: 'Approved ✓' },
      ];
    }
  };

  const [skills, setSkills] = useState<Skill[]>(getInitialSkills);
  const [selectedSkillIndex, setSelectedSkillIndex] = useState<number | null>(null);

  // Redraw SVG chart when skills change
  useEffect(() => {
    if (!svgRef.current) return;

    const width = 280;
    const height = 280;
    const radius = Math.min(width, height) / 2 - 40;
    const angleStep = (Math.PI * 2) / skills.length;

    const rScale = d3.scaleLinear()
      .domain([0, 100])
      .range([0, radius]);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Wipe clean for dynamic rendering

    // Add CSS definitions inside SVG to handle gradients
    const defs = svg.append("defs");
    
    // Gradient definitions
    const gradient = defs.append("linearGradient")
      .attr("id", "radarGradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "100%");

    gradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#6366f1"); // Indigo

    gradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#4f46e5"); // Dark Indigo

    const g = svg.append("g")
      .attr("transform", `translate(${width / 2}, ${height / 2})`);

    // 1. Draw nested background concentric circles (web level grids)
    const levels = 4;
    for (let level = 1; level <= levels; level++) {
      const r = (radius / levels) * level;
      const points: [number, number][] = skills.map((_, i) => [
        r * Math.cos(angleStep * i - Math.PI / 2),
        r * Math.sin(angleStep * i - Math.PI / 2)
      ]);
      const polygonPoints = points.map(p => p.join(",")).join(" ");

      g.append("polygon")
        .attr("points", polygonPoints)
        .attr("fill", "none")
        .attr("stroke", "#f1f5f9")
        .attr("stroke-width", "1.5")
        .attr("stroke-dasharray", "3 3");

      g.append("text")
        .attr("x", 6)
        .attr("y", -r + 10)
        .attr("fill", "#94a3b8")
        .attr("font-size", "7px")
        .attr("font-family", "monospace")
        .attr("font-weight", "bold")
        .text(`${(100 / levels) * level}%`);
    }

    // 2. Draw lines and labels along axis
    skills.forEach((skill, i) => {
      const angle = angleStep * i - Math.PI / 2;
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);

      // Web Line
      g.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", x)
        .attr("y2", y)
        .attr("stroke", "#e2e8f0")
        .attr("stroke-width", "1");

      // Outer Axis labels
      const labelRadius = radius + 22;
      const labelX = labelRadius * Math.cos(angle);
      const labelY = labelRadius * Math.sin(angle);

      let anchor = "middle";
      if (Math.cos(angle) > 0.1) anchor = "start";
      else if (Math.cos(angle) < -0.1) anchor = "end";

      g.append("text")
        .attr("x", labelX)
        .attr("y", labelY + 2)
        .attr("text-anchor", anchor)
        .attr("fill", selectedSkillIndex === i ? "#4f46e5" : "#475569")
        .attr("font-size", "8.5px")
        .attr("font-weight", selectedSkillIndex === i ? "900" : "700")
        .attr("font-family", "Inter, sans-serif")
        .style("cursor", "pointer")
        .text(skill.axis)
        .on("click", () => {
          haptics.light();
          setSelectedSkillIndex(i);
        });
    });

    // 3. Draw capability filled area
    const polygonPoints = skills.map((skill, i) => {
      const angle = angleStep * i - Math.PI / 2;
      const r = rScale(skill.value);
      return [r * Math.cos(angle), r * Math.sin(angle)] as [number, number];
    });

    // Draw polygon
    g.append("polygon")
      .attr("points", polygonPoints.map(p => p.join(",")).join(" "))
      .attr("fill", "url(#radarGradient)")
      .attr("fill-opacity", 0.2)
      .attr("stroke", "#4f46e5")
      .attr("stroke-width", "2.5")
      .attr("stroke-linejoin", "round");

    // 4. Dot markers for data vertices
    polygonPoints.forEach((p, i) => {
      const isSelected = selectedSkillIndex === i;
      g.append("circle")
        .attr("cx", p[0])
        .attr("cy", p[1])
        .attr("r", isSelected ? 6.5 : 4.5)
        .attr("fill", isSelected ? "#3b82f6" : "#4f46e5")
        .attr("stroke", "#ffffff")
        .attr("stroke-width", "1.5")
        .style("cursor", "pointer")
        .on("click", () => {
          haptics.light();
          setSelectedSkillIndex(i);
        });
    });

  }, [skills, selectedSkillIndex, workerType]);

  const handleSliderChange = (index: number, val: number) => {
    const updated = [...skills];
    updated[index].value = val;
    setSkills(updated);
  };

  const handleRegisterCourse = (opportunity: string) => {
    haptics.success();
    alert(`Successfully registered for the training module:\n"${opportunity}"\nWe have scheduled this into your personal calendar!`);
  };

  return (
    <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-xl space-y-4 text-left">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-black text-base text-slate-900 tracking-tight flex items-center gap-1.5">
            <GraduationCap size={18} className="text-indigo-600" />
            Worker Capability Center
          </h3>
          <p className="text-[9px] uppercase font-black tracking-wider text-slate-400 mt-1">
            Track expertise ratings & claim training opportunities
          </p>
        </div>
        <span className="p-1.5 px-2.5 bg-indigo-50 text-indigo-600 rounded-full text-[8.5px] font-black uppercase tracking-widest flex items-center gap-1">
          <Sparkles size={10} className="animate-pulse" /> Live Metrics
        </span>
      </div>

      <div className="flex flex-col items-center justify-center p-2 rounded-2xl bg-slate-50/55 border border-slate-100">
        <svg ref={svgRef} width={280} height={280} className="mx-auto" />
        <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 text-center select-none pb-1">
          💡 Click handles or dots to adjust & diagnose scores
        </p>
      </div>

      {/* Interactive slider adjustments & dynamic opportunities list */}
      <div className="space-y-3 pt-1 border-t border-slate-100">
        <span className="text-xs font-black text-slate-900 uppercase tracking-widest block mb-1">
          Adjust Service Expertise Level
        </span>
        <div className="grid grid-cols-2 gap-3">
          {skills.map((skill, index) => (
            <div 
              key={skill.axis}
              onClick={() => setSelectedSkillIndex(index)}
              className={`p-3 rounded-2xl border transition-all text-left cursor-pointer ${
                selectedSkillIndex === index 
                  ? 'bg-indigo-50/50 border-indigo-200 shadow-sm' 
                  : 'bg-slate-50/40 border-transparent hover:border-slate-100'
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-extrabold text-slate-700">{skill.axis}</span>
                <span className="text-[9.5px] font-black font-mono text-indigo-600">{skill.value}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={skill.value}
                onChange={(e) => handleSliderChange(index, Number(e.target.value))}
                onClick={(e) => e.stopPropagation()}
                className="w-full accent-indigo-600 cursor-ew-resize h-1 bg-slate-200 rounded-lg appearance-none"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100">
        <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-3 flex items-center gap-1">
          <Award size={14} className="text-amber-500" />
          Recommended Training Opportunities
        </h4>
        <div className="space-y-2.5">
          {skills.map((skill, i) => {
            const needsTraining = skill.value < 90;
            return (
              <div 
                key={skill.axis} 
                className={`p-3 px-4 rounded-2xl border transition-colors flex justify-between items-center ${
                  needsTraining 
                    ? 'bg-amber-50/50 border-amber-100' 
                    : 'bg-emerald-50/40 border-emerald-100/30'
                }`}
              >
                <div className="flex-1 mr-2 text-left">
                  <span className="text-[9.5px] font-black text-slate-400 uppercase tracking-wider block">
                    {skill.axis} • Rating: {skill.value}%
                  </span>
                  <span className={`text-[10.5px] font-extrabold block leading-snug mt-0.5 ${needsTraining ? 'text-slate-800' : 'text-slate-500'}`}>
                    {skill.trainingOpportunity}
                  </span>
                  <span className="text-[8.5px] text-slate-450 font-bold block mt-0.5 font-mono">
                    {needsTraining ? `⏱️ Duration: ${skill.courseDuration}` : '✓ Status: Completed'}
                  </span>
                </div>
                {needsTraining ? (
                  <button
                    onClick={() => handleRegisterCourse(skill.trainingOpportunity)}
                    className="p-2 py-1 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border-none select-none cursor-pointer shrink-0"
                  >
                    Enroll
                  </button>
                ) : (
                  <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider shrink-0 mr-1 select-none">
                    Certified ✓
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
