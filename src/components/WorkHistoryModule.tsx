import { useState, useEffect } from 'react';
import { 
  Briefcase, Plus, Trash2, Check, Award, Calendar, Sparkles, Building, 
  ChevronDown, MapPin, Hammer, CheckCircle2, Star, Clock, FolderGit, RefreshCw
} from 'lucide-react';
import { haptics } from '../utils/haptics';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

// Local speech helper
const playTTS = (text: string) => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const s = new SpeechSynthesisUtterance(text);
    s.rate = 1.0;
    window.speechSynthesis.speak(s);
  }
};

export interface WorkHistoryEntry {
  title: string;
  employer: string;
  duration: string;
  details: string;
}

export interface ProjectEntry {
  projectName: string;
  clientName: string;
  completionDate: string;
  projectCost: string;
  projectDetails: string;
}

const AVAILABLE_SKILLS = [
  "Deep Cleaning", "Standard Cleaning", "Emergency Plumbing", "Leak Repair", 
  "Fuse Board Replacement", "Rewiring", "Lawn Mowing", "Weeding", "Hedge Trimming",
  "SIA Security Guarding", "Close Protection", "CCTV Monitoring", "Event Stewarding"
];

export function WorkHistoryModule({ onSave }: { onSave?: (history: WorkHistoryEntry[], skills: string[]) => void }) {
  const { profile } = useAuth();
  
  // Work History State
  const [history, setHistory] = useState<WorkHistoryEntry[]>(() => {
    try {
      const stored = localStorage.getItem('konnects_work_history');
      if (stored) return JSON.parse(stored);
    } catch {}
    return [
      { title: 'Senior Cleaner & Supervisor', employer: 'EcoClean Ltd, London', duration: '2 Years (2023 - 2025)', details: 'Supervised deep commercial and residential post-tenancy cleaning projects.' }
    ];
  });

  // Past Projects State
  const [projects, setProjects] = useState<ProjectEntry[]>(() => {
    try {
      const stored = localStorage.getItem('konnects_past_projects');
      if (stored) return JSON.parse(stored);
    } catch {}
    return [
      { projectName: 'Commercial Office Renovation Clean', clientName: 'Innovate Workspace', completionDate: 'May 2025', projectCost: '£1,250', projectDetails: 'Post-construction heavy scrubbing of 3 floor office complex in central London.' }
    ];
  });

  // Skills & Certifications State
  const [selectedSkills, setSelectedSkills] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('konnects_specialized_skills');
      if (stored) return JSON.parse(stored);
    } catch {}
    return ["Deep Cleaning", "Standard Cleaning"];
  });

  const [certifications, setCertifications] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('konnects_certifications');
      if (stored) return JSON.parse(stored);
    } catch {}
    return ["City & Guilds Practical Cleaning Service Standards", "DBS Certified Clean Certificate"];
  });

  // Form State for Adding New History
  const [newJob, setNewJob] = useState<WorkHistoryEntry>({
    title: '',
    employer: '',
    duration: '',
    details: ''
  });

  // Form State for Adding New Projects
  const [newProj, setNewProj] = useState<ProjectEntry>({
    projectName: '',
    clientName: '',
    completionDate: '',
    projectCost: '',
    projectDetails: ''
  });

  const [newSkill, setNewSkill] = useState('');
  const [newCert, setNewCert] = useState('');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'synced'>('idle');

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('konnects_work_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('konnects_past_projects', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('konnects_specialized_skills', JSON.stringify(selectedSkills));
  }, [selectedSkills]);

  useEffect(() => {
    localStorage.setItem('konnects_certifications', JSON.stringify(certifications));
  }, [certifications]);

  // Methods
  const addHistoryEntry = () => {
    if (!newJob.title || !newJob.employer || !newJob.duration) {
      alert("Please fill in Job Title, Employer, and Duration to add an entry.");
      return;
    }
    haptics.light();
    setHistory(prev => [...prev, newJob]);
    setNewJob({ title: '', employer: '', duration: '', details: '' });
  };

  const removeHistoryEntry = (index: number) => {
    haptics.light();
    setHistory(prev => prev.filter((_, i) => i !== index));
  };

  const addProjectEntry = () => {
    if (!newProj.projectName || !newProj.completionDate || !newProj.projectCost) {
      alert("Please fill in Project Name, Completion Date, and Project Cost.");
      return;
    }
    haptics.light();
    setProjects(prev => [...prev, newProj]);
    setNewProj({ projectName: '', clientName: '', completionDate: '', projectCost: '', projectDetails: '' });
  };

  const removeProjectEntry = (index: number) => {
    haptics.light();
    setProjects(prev => prev.filter((_, i) => i !== index));
  };

  const toggleSkill = (skill: string) => {
    haptics.light();
    setSelectedSkills(prev => 
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  const addCustomSkill = () => {
    if (!newSkill.trim()) return;
    haptics.light();
    if (!selectedSkills.includes(newSkill.trim())) {
      setSelectedSkills(prev => [...prev, newSkill.trim()]);
    }
    setNewSkill('');
  };

  const addCertification = () => {
    if (!newCert.trim()) return;
    haptics.light();
    if (!certifications.includes(newCert.trim())) {
      setCertifications(prev => [...prev, newCert.trim()]);
    }
    setNewCert('');
  };

  const removeCertification = (index: number) => {
    haptics.light();
    setCertifications(prev => prev.filter((_, i) => i !== index));
  };

  // Save everything to Firestore Profile
  const handleSaveToProfile = async () => {
    if (!profile?.uid) return;
    setSyncStatus('saving');
    haptics.heavy();

    setTimeout(async () => {
      try {
        await updateDoc(doc(db, 'users', profile.uid), {
          workHistory: history,
          pastProjects: projects,
          skills: selectedSkills,
          certifications: certifications,
          updatedAt: serverTimestamp()
        });
        setSyncStatus('synced');
        setTimeout(() => setSyncStatus('idle'), 3000);
        playTTS("Your professional work history, skills checklist, and past projects timeline have been updated and synchronized with your profile database.");
        if (onSave) {
          onSave(history, selectedSkills);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`);
        setSyncStatus('idle');
      }
    }, 1000);
  };

  return (
    <div className="space-y-6 text-left">
      
      {/* 1. TRADE & SPECIALISED SKILLS */}
      <div className="bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
          <Hammer size={15} className="text-indigo-500" />
          <span>Specialised Capabilities</span>
        </h3>
        
        <p className="text-[10.5px] text-slate-500 leading-relaxed font-bold">
          Check the capability filters that apply to your services. Search or enter custom tags to expand your skill radar.
        </p>

        <div className="flex flex-wrap gap-2 pt-1">
          {AVAILABLE_SKILLS.map(skill => {
            const isSelected = selectedSkills.includes(skill);
            return (
              <button
                key={skill}
                type="button"
                onClick={() => toggleSkill(skill)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border flex items-center gap-1 cursor-pointer ${
                  isSelected 
                    ? 'bg-indigo-600 border-indigo-600 text-white' 
                    : 'bg-slate-50 border-slate-200 text-slate-650 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400'
                }`}
              >
                {isSelected && <Check size={10} />}
                <span>{skill}</span>
              </button>
            );
          })}
        </div>

        <div className="flex gap-2 pt-2">
          <input
            type="text"
            placeholder="Add custom skill (e.g. Tile Fitting)"
            value={newSkill}
            onChange={e => setNewSkill(e.target.value)}
            className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 focus:ring-brand text-xs font-bold"
          />
          <button
            type="button"
            onClick={addCustomSkill}
            className="px-4 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all hover:bg-slate-800"
          >
            Add
          </button>
        </div>
      </div>

      {/* 2. DYNAMIC WORK HISTORY FORM */}
      <div className="bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
          <Briefcase size={15} className="text-indigo-500" />
          <span>Professional Experience History</span>
        </h3>

        {/* Existing History entries */}
        {history.length > 0 && (
          <div className="space-y-3">
            {history.map((item, index) => (
              <div key={index} className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-150/50 dark:border-slate-800 flex justify-between items-start">
                <div className="space-y-1 truncate pr-2">
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">{item.title}</h4>
                  <p className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                    <Building size={11} /> {item.employer}
                  </p>
                  <p className="text-[9px] font-mono text-slate-400 flex items-center gap-1">
                    <Calendar size={11} /> {item.duration}
                  </p>
                  {item.details && <p className="text-[10px] text-slate-500 leading-relaxed pt-1 italic">{item.details}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => removeHistoryEntry(index)}
                  className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-all border-none bg-transparent cursor-pointer"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add Entry inputs */}
        <div className="border-t border-slate-100 dark:border-slate-850 pt-4 space-y-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Add Past Employment Record</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Job Title (e.g. Master Plumber)"
              value={newJob.title}
              onChange={e => setNewJob({ ...newJob, title: e.target.value })}
              className="px-3.5 py-3 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none text-xs font-bold"
            />
            <input
              type="text"
              placeholder="Employer / Location"
              value={newJob.employer}
              onChange={e => setNewJob({ ...newJob, employer: e.target.value })}
              className="px-3.5 py-3 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none text-xs font-bold"
            />
          </div>
          <div className="grid grid-cols-1 gap-2">
            <input
              type="text"
              placeholder="Duration (e.g. 2021 - 2023)"
              value={newJob.duration}
              onChange={e => setNewJob({ ...newJob, duration: e.target.value })}
              className="px-3.5 py-3 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none text-xs font-bold"
            />
            <textarea
              placeholder="Concisely outline your primary tasks & highlights..."
              value={newJob.details}
              onChange={e => setNewJob({ ...newJob, details: e.target.value })}
              rows={2}
              className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none text-xs font-bold leading-relaxed resize-none"
            />
          </div>
          <button
            type="button"
            onClick={addHistoryEntry}
            className="w-full py-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1 border-none cursor-pointer shadow-sm active:scale-95"
          >
            <Plus size={14} />
            <span>Add Employment Record</span>
          </button>
        </div>
      </div>

      {/* 3. DYNAMIC PAST PROJECTS FORM */}
      <div className="bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
          <FolderGit size={15} className="text-indigo-500" />
          <span>Past Job Projects</span>
        </h3>

        {projects.length > 0 && (
          <div className="space-y-3">
            {projects.map((item, index) => (
              <div key={index} className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-150/50 dark:border-slate-800 flex justify-between items-start">
                <div className="space-y-1 pr-2 truncate">
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">{item.projectName}</h4>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-extrabold text-slate-500">
                    <span className="text-emerald-600 font-mono">{item.projectCost}</span>
                    <span>Client: {item.clientName || 'Private'}</span>
                    <span>Date: {item.completionDate}</span>
                  </div>
                  {item.projectDetails && <p className="text-[10px] text-slate-400 leading-normal pt-1">{item.projectDetails}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => removeProjectEntry(index)}
                  className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-all border-none bg-transparent cursor-pointer"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-slate-100 dark:border-slate-850 pt-4 space-y-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Add Past Highlight Project</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Project Name / Brief"
              value={newProj.projectName}
              onChange={e => setNewProj({ ...newProj, projectName: e.target.value })}
              className="px-3.5 py-3 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none text-xs font-bold"
            />
            <input
              type="text"
              placeholder="Client Name"
              value={newProj.clientName}
              onChange={e => setNewProj({ ...newProj, clientName: e.target.value })}
              className="px-3.5 py-3 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none text-xs font-bold"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Cost/Earnings (e.g. £450)"
              value={newProj.projectCost}
              onChange={e => setNewProj({ ...newProj, projectCost: e.target.value })}
              className="px-3.5 py-3 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none text-xs font-bold"
            />
            <input
              type="text"
              placeholder="Completion Date"
              value={newProj.completionDate}
              onChange={e => setNewProj({ ...newProj, completionDate: e.target.value })}
              className="px-3.5 py-3 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none text-xs font-bold"
            />
          </div>
          <textarea
            placeholder="Outline special tools used, techniques, and final feedback..."
            value={newProj.projectDetails}
            onChange={e => setNewProj({ ...newProj, projectDetails: e.target.value })}
            rows={2}
            className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none text-xs font-bold leading-normal resize-none"
          />
          <button
            type="button"
            onClick={addProjectEntry}
            className="w-full py-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1 border-none cursor-pointer shadow-sm active:scale-95"
          >
            <Plus size={14} />
            <span>Add Project Record</span>
          </button>
        </div>
      </div>

      {/* 4. CERTIFICATIONS & SPECIAL SERVICE PERMITS */}
      <div className="bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
          <Award size={15} className="text-indigo-500" />
          <span>Certifications & Permits</span>
        </h3>

        {certifications.length > 0 && (
          <div className="space-y-2">
            {certifications.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-2.5 bg-indigo-50/40 dark:bg-indigo-950/10 rounded-xl border border-indigo-100/30 text-xs font-extrabold text-indigo-950 dark:text-indigo-300">
                <span className="flex items-center gap-2">
                  <Award size={14} className="text-brand shrink-0" />
                  <span className="truncate max-w-[200px]">{item}</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeCertification(index)}
                  className="p-1 text-slate-400 hover:text-red-500 rounded-lg transition-all border-none bg-transparent cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add Certificate (e.g. City & Guilds Lvl 3)"
            value={newCert}
            onChange={e => setNewCert(e.target.value)}
            className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none text-xs font-bold"
          />
          <button
            type="button"
            onClick={addCertification}
            className="px-4 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
          >
            Add
          </button>
        </div>
      </div>

      {/* 5. VISUAL PROFESSIONAL TIMELINE VIEW */}
      <div className="bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
          <Sparkles size={15} className="text-indigo-500" />
          <span>Professional Resume Timeline</span>
        </h3>

        <div className="relative pl-6 border-l-2 border-slate-100 dark:border-slate-800 space-y-6 pt-2 text-xs">
          {history.map((item, index) => (
            <div key={index} className="relative">
              {/* Timeline circle icon */}
              <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-indigo-600 border-4 border-white dark:border-slate-950 shadow-sm" />
              
              <div className="space-y-1 text-left">
                <span className="text-[9px] font-mono text-slate-400 bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded-md font-bold uppercase tracking-widest">
                  {item.duration}
                </span>
                <h4 className="font-extrabold text-slate-900 dark:text-white pt-1">{item.title}</h4>
                <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">{item.employer}</p>
                {item.details && <p className="text-[10.5px] text-slate-500 leading-relaxed font-semibold">{item.details}</p>}
              </div>
            </div>
          ))}

          {projects.map((item, index) => (
            <div key={`p-${index}`} className="relative">
              {/* Project circle icon */}
              <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-emerald-500 border-4 border-white dark:border-slate-950 shadow-sm" />
              
              <div className="space-y-1 text-left">
                <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-md font-bold uppercase tracking-widest">
                  Completed {item.completionDate}
                </span>
                <h4 className="font-extrabold text-slate-900 dark:text-white pt-1">🛠 Project: {item.projectName}</h4>
                <p className="text-[10px] font-bold text-slate-450">Client: {item.clientName || 'Private client'} • <span className="text-emerald-600 font-black">{item.projectCost}</span></p>
                {item.projectDetails && <p className="text-[10.5px] text-slate-400 leading-relaxed font-semibold">{item.projectDetails}</p>}
              </div>
            </div>
          ))}

          {history.length === 0 && projects.length === 0 && (
            <div className="text-slate-400 italic text-center py-4 font-bold">
              Add employment history or completed projects above to visualize your timeline.
            </div>
          )}
        </div>
      </div>

      {/* SAVE TRIGGERS */}
      <button
        onClick={handleSaveToProfile}
        disabled={syncStatus === 'saving'}
        className="w-full bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 py-4 uppercase tracking-widest font-black text-xs rounded-2xl shadow-xl hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 border-none cursor-pointer"
      >
        {syncStatus === 'saving' ? (
          <div className="flex items-center gap-2">
            <RefreshCw className="animate-spin" size={14} />
            <span>Synchronizing Resume...</span>
          </div>
        ) : syncStatus === 'synced' ? (
          <div className="flex items-center gap-1.5 text-emerald-400 dark:text-emerald-600">
            <Check size={14} />
            <span>Sync Complete!</span>
          </div>
        ) : (
          <span>Save Professional Resume & Capabilities</span>
        )}
      </button>

    </div>
  );
}
