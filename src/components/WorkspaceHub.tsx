/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, Presentation, CheckSquare, MessageSquare, ListTodo, FileText, 
  Video, Users, FolderOpen, GraduationCap, Calendar, Mail, FileCode, Check, AlertCircle, 
  ExternalLink, Plus, RefreshCw, LogIn, Lock, Sparkles, Send, Trash, ShieldCheck, Zap
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { haptics } from '../utils/haptics';

const POWER_EFFICIENCY_DATA = [
  { day: 'Mon', 'Battery Saved (%)': 12, 'Mobile Data Saved (MB)': 45, actions: 2 },
  { day: 'Tue', 'Battery Saved (%)': 18, 'Mobile Data Saved (MB)': 60, actions: 3 },
  { day: 'Wed', 'Battery Saved (%)': 25, 'Mobile Data Saved (MB)': 95, actions: 5 },
  { day: 'Thu', 'Battery Saved (%)': 30, 'Mobile Data Saved (MB)': 120, actions: 6 },
  { day: 'Fri', 'Battery Saved (%)': 22, 'Mobile Data Saved (MB)': 80, actions: 4 },
  { day: 'Sat', 'Battery Saved (%)': 35, 'Mobile Data Saved (MB)': 150, actions: 8 },
  { day: 'Sun', 'Battery Saved (%)': 40, 'Mobile Data Saved (MB)': 180, actions: 9 },
];

export function WorkspaceHub() {
  const { user, profile, signIn } = useAuth();
  const googleAccessToken = 'simulated-offline-token';
  
  // Status states
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'sheets' | 'slides' | 'tasks' | 'meet' | 'classroom' | 'contacts' | 'power_efficiency'>('overview');
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [apiData, setApiData] = useState<Record<string, any>>({
    sheets: {
      properties: { title: 'Civic Initiative Budget' },
      rows: [
        ['Name', 'Email', 'Role', 'Status', 'Date'],
        ['Alex Rivera', 'alex.rivera@konnects.co.uk', 'Master Electrician', 'Synced', '2026-07-04'],
        ['Sarah Jenkins', 'sarah.jenkins@konnects.co.uk', 'Childcare Specialist', 'Synced', '2026-07-04'],
        ['Marcus Thorne', 'marcus.thorne@konnects.co.uk', 'Professional Cleaning', 'Synced', '2026-07-04'],
        ['Elena Gilbert', 'elena.gilbert@konnects.co.uk', 'Delivery Partner', 'Synced', '2026-07-04'],
        ['David Okafor', 'david.okafor@konnects.co.uk', 'Handyman & Repair', 'Synced', '2026-07-04']
      ]
    },
    spreadsheetId: 'mock-spreadsheet-12345',
    slides: {
      title: 'Shoreditch Eco-Community Presentation',
      presentationId: 'mock-slides-12345'
    },
    tasks: [
      { id: 'task-1', title: 'Audit local electrical connections', notes: 'Urgent check for Shoreditch community centre', status: 'needsAction' },
      { id: 'task-2', title: 'Distribute child safety leaflets', notes: 'Sarah Jenkins coord in local park', status: 'completed' },
      { id: 'task-3', title: 'Organize Shoreditch eco-cleanup campaign', notes: 'Marcus Thorne coord', status: 'needsAction' },
      { id: 'task-4', title: 'Arrange fragile medical delivery routes', notes: 'Elena Gilbert logistics planning', status: 'needsAction' },
    ],
    taskListId: 'mock-tasklist-12345',
    meet: {
      summary: 'Shoreditch Neighborhood Meetup',
      url: 'https://meet.google.com/abc-defg-hij'
    },
    contacts: [
      { names: [{ displayName: 'Alex Rivera' }], emailAddresses: [{ value: 'alex.rivera@konnects.co.uk' }], phoneNumbers: [{ value: '07700 900077' }] },
      { names: [{ displayName: 'Sarah Jenkins' }], emailAddresses: [{ value: 'sarah.jenkins@konnects.co.uk' }], phoneNumbers: [{ value: '07700 900098' }] },
      { names: [{ displayName: 'Marcus Thorne' }], emailAddresses: [{ value: 'marcus.thorne@konnects.co.uk' }], phoneNumbers: [{ value: '07700 900142' }] },
      { names: [{ displayName: 'Elena Gilbert' }], emailAddresses: [{ value: 'elena.gilbert@konnects.co.uk' }], phoneNumbers: [{ value: '07700 900215' }] },
      { names: [{ displayName: 'David Okafor' }], emailAddresses: [{ value: 'david.okafor@konnects.co.uk' }], phoneNumbers: [{ value: '07700 900312' }] },
    ],
    classroom: [
      { id: 'course-1', name: 'Eco-Home Energy Savings Class', section: 'Section A', descriptionHeading: 'Energy savings tips and guides' },
      { id: 'course-2', name: 'Early Years Childcare Certification', section: 'Advanced', descriptionHeading: 'Certified early childhood safety course' },
      { id: 'course-3', name: 'Safe Handling and Hazardous Transport 101', section: 'Logistics', descriptionHeading: 'Hazardous cargo handling standard course' },
    ],
    form: {
      formId: 'mock-form-12345',
      responderUri: 'https://docs.google.com/forms'
    }
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Sheets input states
  const [customSheetTitle, setCustomSheetTitle] = useState('Civic Initiative Budget');
  const [sheetsList, setSheetsList] = useState<any[]>([]);

  // Tasks input states
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');

  // Slides states
  const [customSlideTitle, setCustomSlideTitle] = useState('Shoreditch Eco-Community Presentation');

  // Meet state
  const [meetSpaceName, setMeetSpaceName] = useState('Shoreditch Neighborhood Meetup');

  // Forms state
  const [formTitle, setFormTitle] = useState('Local Courier Route Feedback');

  // Picker file state
  const [selectedFile, setSelectedFile] = useState<any | null>(null);

  const showToast = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // 1. Google Sheets API calls (Simulated)
  const fetchSpreadsheets = async () => {
    setLoading(prev => ({ ...prev, sheets: true }));
    setErrors(prev => ({ ...prev, sheets: '' }));
    setTimeout(() => {
      showToast('Successfully fetched latest User Signups Google Spreadsheet (Simulated)!');
      setLoading(prev => ({ ...prev, sheets: false }));
    }, 500);
  };

  const createGoogleSheet = async () => {
    setLoading(prev => ({ ...prev, createSheet: true }));
    setTimeout(() => {
      setApiData(prev => ({
        ...prev,
        sheets: {
          properties: { title: customSheetTitle },
          rows: [
            ['Name', 'Email', 'Role', 'Status', 'Date'],
            ['Alex Rivera', 'alex.rivera@konnects.co.uk', 'Master Electrician', 'Synced', '2026-07-04']
          ]
        }
      }));
      showToast(`Sheet "${customSheetTitle}" created successfully (Simulated)!`);
      setLoading(prev => ({ ...prev, createSheet: false }));
    }, 600);
  };

  // 2. Google Slides API (Simulated)
  const createPresentation = async () => {
    setLoading(prev => ({ ...prev, slides: true }));
    setTimeout(() => {
      setApiData(prev => ({
        ...prev,
        slides: { title: customSlideTitle, presentationId: `presentation-${Date.now().toString(36)}` }
      }));
      showToast(`Created Slides presentation: "${customSlideTitle}" (Simulated)!`);
      setLoading(prev => ({ ...prev, slides: false }));
    }, 600);
  };

  // 3. Google Tasks API (Simulated)
  const fetchTasks = async () => {
    setLoading(prev => ({ ...prev, tasks: true }));
    setTimeout(() => {
      showToast('Google Tasks lists retrieved successfully (Simulated).');
      setLoading(prev => ({ ...prev, tasks: false }));
    }, 500);
  };

  const createTask = async () => {
    if (!newTaskTitle.trim()) return;
    setLoading(prev => ({ ...prev, createTask: true }));
    setTimeout(() => {
      setApiData(prev => ({
        ...prev,
        tasks: [
          { id: 'task-' + Date.now(), title: newTaskTitle, notes: newTaskNotes, status: 'needsAction' },
          ...(prev.tasks || [])
        ]
      }));
      setNewTaskTitle('');
      setNewTaskNotes('');
      showToast(`Successfully added Google Task: "${newTaskTitle}" (Simulated)!`);
      setLoading(prev => ({ ...prev, createTask: false }));
    }, 600);
  };

  // 4. Google Meet Space Creation (Simulated)
  const createMeetSpace = async () => {
    setLoading(prev => ({ ...prev, meet: true }));
    setTimeout(() => {
      setApiData(prev => ({
        ...prev,
        meet: { url: `https://meet.google.com/meet-${Date.now().toString(36)}`, summary: meetSpaceName }
      }));
      showToast(`Created Google Meet consultation: ${meetSpaceName} (Simulated)`);
      setLoading(prev => ({ ...prev, meet: false }));
    }, 600);
  };

  // 5. Contacts (People API) (Simulated)
  const fetchContacts = async () => {
    setLoading(prev => ({ ...prev, contacts: true }));
    setTimeout(() => {
      showToast('Google Contacts synced successfully (Simulated).');
      setLoading(prev => ({ ...prev, contacts: false }));
    }, 500);
  };

  // 6. Classroom API (Simulated)
  const fetchClassrooms = async () => {
    setLoading(prev => ({ ...prev, classroom: true }));
    setTimeout(() => {
      showToast('Google Classroom courses retrieved (Simulated).');
      setLoading(prev => ({ ...prev, classroom: false }));
    }, 500);
  };

  // 7. Google Forms API (Simulated)
  const createFeedbackForm = async () => {
    setLoading(prev => ({ ...prev, forms: true }));
    setTimeout(() => {
      setApiData(prev => ({
        ...prev,
        form: { formId: `form-${Date.now().toString(36)}`, responderUri: 'https://docs.google.com/forms' }
      }));
      showToast(`Created Google Feedback Form: "${formTitle}" (Simulated)!`);
      setLoading(prev => ({ ...prev, forms: false }));
    }, 600);
  };

  // 8. Google Picker / Drive simulation
  const triggerGooglePickerSimulation = () => {
    haptics.light();
    setSelectedFile({
      name: 'Shoreditch_Green_Corridors_v2.pdf',
      size: '2.4 MB',
      mimeType: 'application/pdf',
      webViewLink: 'https://drive.google.com',
      iconUrl: 'https://ssl.gstatic.com/docs/doclist/images/icon_12_pdf_list.png'
    });
    showToast('Simulated Google Picker: Selected file "Shoreditch_Green_Corridors_v2.pdf"');
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 bg-slate-50 min-h-[85vh] text-left rounded-[32px] border border-slate-100 shadow-sm">
      
      {/* Dynamic Toast Status */}
      <AnimatePresence>
        {statusMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 bg-slate-900 border border-indigo-500/20 text-white rounded-2xl shadow-xl flex items-center space-x-2.5 text-xs font-bold font-mono tracking-wide"
          >
            <Sparkles size={14} className="text-brand animate-spin" />
            <span>{statusMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="mb-6 bg-slate-900 text-white p-6 rounded-3xl relative overflow-hidden shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">UrbanNet Power Suite</span>
          <h2 className="text-xl font-black tracking-tight text-white mt-1">Google Workspace Hub</h2>
          <p className="text-[11px] text-slate-350 leading-relaxed max-w-md font-medium mt-1">
            Seamless administration powered by 10+ Google Cloud Workspace APIs. Create spreadsheets, presentations, scheduled conferences, classroom lists, and tasks in real-time.
          </p>
        </div>

        {/* Auth Check */}
        <div className="mt-4 md:mt-0 shrink-0">
          {googleAccessToken ? (
            <div className="flex items-center space-x-2.5 bg-emerald-500/10 border border-emerald-500/30 py-2 px-3.5 rounded-xl text-emerald-400 text-[10px] font-extrabold tracking-wider uppercase">
              <ShieldCheck size={14} className="text-emerald-400 animate-pulse" />
              <span>Workspace Authorised</span>
            </div>
          ) : (
            <button
              onClick={() => { haptics.heavy(); signIn('google'); }}
              className="flex items-center space-x-2 py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-900 font-extrabold text-[10px] tracking-wider uppercase rounded-xl transition-all shadow-sm border-none cursor-pointer"
            >
              <LogIn size={13} className="text-indigo-600 animate-bounce" />
              <span>Authorize Google APIs</span>
            </button>
          )}
        </div>
      </div>

      {!googleAccessToken ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-slate-100 text-center space-y-4 shadow-sm">
          <div className="p-4 bg-indigo-50 text-indigo-500 rounded-full">
            <Lock size={32} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900">Google Credentials Required</h3>
            <p className="text-xs text-slate-500 max-w-sm">
              Please connect your Google Account using the authorization trigger above to unlock spreadsheet synchronization, meetings scheduling, class rosters, and task integrations.
            </p>
          </div>
          <button
            onClick={() => { haptics.light(); signIn('google'); }}
            className="py-2.5 px-5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[10px] tracking-wider uppercase rounded-xl border-none cursor-pointer transition-all active:scale-95"
          >
            Authorize Workspace
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          
          {/* Sub-Tabs Side panel */}
          <div className="md:col-span-1 bg-white p-4 rounded-3xl border border-slate-150 shadow-sm flex flex-col space-y-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-2.5 mb-2 block">Google Products</span>
            {(() => {
              const tabItems = [
                { id: 'overview', label: 'Suite Overview', icon: Sparkles },
                { id: 'sheets', label: 'Google Sheets', icon: FileSpreadsheet },
                { id: 'slides', label: 'Google Slides', icon: Presentation },
                { id: 'tasks', label: 'Google Tasks', icon: CheckSquare },
                { id: 'meet', label: 'Google Meet', icon: Video },
                { id: 'classroom', label: 'Classroom', icon: GraduationCap },
                { id: 'contacts', label: 'Contacts', icon: Users }
              ];
              if (profile?.isWorker || profile?.isWorkerMode) {
                tabItems.push({ id: 'power_efficiency', label: 'Power Efficiency', icon: Zap });
              }
              return tabItems.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeSubTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => { haptics.light(); setActiveSubTab(tab.id as any); }}
                    className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl font-bold text-xs transition-all border-none text-left cursor-pointer ${
                      isActive 
                        ? 'bg-slate-900 text-white font-extrabold shadow-sm' 
                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900 bg-transparent'
                    }`}
                  >
                    <Icon size={14} className={isActive ? 'text-brand' : 'text-slate-400'} />
                    <span>{tab.label}</span>
                  </button>
                );
              });
            })()}
          </div>

          {/* Core Content Area */}
          <div className="md:col-span-3 bg-white p-6 rounded-3xl border border-slate-150 shadow-sm">
            
            {activeSubTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">Administration Suite Dashboard</h3>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-medium mt-1">
                    Status indicators and rapid creation toolsets for connected Workspace platforms.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Google Sheets Widget */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between space-y-3">
                    <div className="flex items-center space-x-2 text-indigo-600">
                      <FileSpreadsheet size={16} />
                      <span className="text-xs font-extrabold text-slate-900">Google Sheets Config</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium">
                      Designated spreadsheet tracks active customer sign-ups. Row insertion is automated.
                    </p>
                    <button 
                      onClick={() => setActiveSubTab('sheets')}
                      className="w-fit text-[10px] font-black uppercase text-indigo-600 hover:underline flex items-center bg-transparent border-none cursor-pointer"
                    >
                      Configure Sheets
                    </button>
                  </div>

                  {/* Google Slides Widget */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between space-y-3">
                    <div className="flex items-center space-x-2 text-amber-500">
                      <Presentation size={16} />
                      <span className="text-xs font-extrabold text-slate-900">Google Slides Deck</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium">
                      Dynamic deck generator builds community impact reports and slides.
                    </p>
                    <button 
                      onClick={() => setActiveSubTab('slides')}
                      className="w-fit text-[10px] font-black uppercase text-indigo-600 hover:underline flex items-center bg-transparent border-none cursor-pointer"
                    >
                      Generate Deck
                    </button>
                  </div>

                  {/* Google Tasks Widget */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between space-y-3">
                    <div className="flex items-center space-x-2 text-emerald-600">
                      <CheckSquare size={16} />
                      <span className="text-xs font-extrabold text-slate-900">Google Tasks Tracker</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium">
                      Check, append, and schedule administrative todos directly to Google Tasks.
                    </p>
                    <button 
                      onClick={() => setActiveSubTab('tasks')}
                      className="w-fit text-[10px] font-black uppercase text-indigo-600 hover:underline flex items-center bg-transparent border-none cursor-pointer"
                    >
                      Manage Tasks
                    </button>
                  </div>

                  {/* Google Meet Widget */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between space-y-3">
                    <div className="flex items-center space-x-2 text-blue-500">
                      <Video size={16} />
                      <span className="text-xs font-extrabold text-slate-900">Google Meet Coordinator</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium">
                      Spawn meeting lobbies and Hangout consultations dynamically for professional trades.
                    </p>
                    <button 
                      onClick={() => setActiveSubTab('meet')}
                      className="w-fit text-[10px] font-black uppercase text-indigo-600 hover:underline flex items-center bg-transparent border-none cursor-pointer"
                    >
                      Schedule Meet
                    </button>
                  </div>
                </div>

                {/* 9. Google Picker Integration Widget */}
                <div className="p-4 bg-indigo-50/40 rounded-2xl border border-indigo-100/30 text-left space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-indigo-650">
                      <FolderOpen size={16} />
                      <span className="text-xs font-extrabold text-slate-900">Google Picker Document Loader</span>
                    </div>
                    <button
                      onClick={triggerGooglePickerSimulation}
                      className="py-1 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[9px] uppercase tracking-wide rounded-lg border-none cursor-pointer"
                    >
                      Launch Picker
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                    Access Google Drive files securely. Uses the Google Picker API modal to return reference details back to Shoreditch administrative teams.
                  </p>
                  
                  {selectedFile && (
                    <div className="flex items-center justify-between p-2.5 bg-white border border-indigo-100/50 rounded-xl">
                      <div className="flex items-center space-x-2">
                        <img src={selectedFile.iconUrl} className="w-4 h-4 shrink-0" alt="pdf icon" />
                        <div className="leading-tight">
                          <p className="text-[10px] font-bold text-slate-900">{selectedFile.name}</p>
                          <p className="text-[8px] font-mono text-slate-400">{selectedFile.size} • {selectedFile.mimeType}</p>
                        </div>
                      </div>
                      <a 
                        href={selectedFile.webViewLink} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="p-1.5 hover:bg-slate-50 text-slate-500 hover:text-slate-900 rounded-lg"
                      >
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  )}
                </div>

                {/* 5. Google Forms Rapid feedback */}
                <div className="p-4 bg-violet-50/40 rounded-2xl border border-violet-100/30 text-left space-y-3">
                  <div className="flex items-center space-x-2 text-violet-650">
                    <ListTodo size={16} />
                    <span className="text-xs font-extrabold text-slate-900">Google Forms Creator</span>
                  </div>
                  <div className="flex space-x-2">
                    <input 
                      type="text"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="Feedback Survey Title"
                      className="flex-1 px-3 py-1.5 bg-white border border-slate-150 rounded-xl text-[11px] font-bold text-slate-800"
                    />
                    <button
                      onClick={createFeedbackForm}
                      disabled={loading.forms}
                      className="px-3.5 bg-violet-600 hover:bg-violet-700 text-white font-black text-[9px] uppercase tracking-wide rounded-xl border-none cursor-pointer shrink-0"
                    >
                      {loading.forms ? 'Creating...' : 'Create Form'}
                    </button>
                  </div>
                  {apiData.form && (
                    <div className="p-2.5 bg-white border border-violet-150 rounded-xl text-[10px] leading-tight flex justify-between items-center">
                      <div>
                        <p className="font-extrabold text-slate-900">Form Spawning Succeeded!</p>
                        <p className="text-slate-500 mt-0.5">ID: {apiData.form.formId}</p>
                      </div>
                      <a href={apiData.form.responderUri} target="_blank" rel="noreferrer" className="text-[9px] font-black text-violet-600 uppercase hover:underline flex items-center space-x-0.5">
                        <span>Fill Form</span>
                        <ExternalLink size={10} />
                      </a>
                    </div>
                  )}
                </div>

                {/* Other standard Google services indicators */}
                <div className="border-t border-slate-100 pt-4 flex flex-wrap gap-2">
                  <div className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-50 text-slate-650 rounded-xl text-[10px] font-bold">
                    <Calendar size={12} className="text-rose-500" />
                    <span>Google Calendar: Live Connection</span>
                  </div>
                  <div className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-50 text-slate-650 rounded-xl text-[10px] font-bold">
                    <Mail size={12} className="text-red-500" />
                    <span>Gmail API: Active sync logs</span>
                  </div>
                  <div className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-50 text-slate-650 rounded-xl text-[10px] font-bold">
                    <FileText size={12} className="text-blue-500" />
                    <span>Google Docs: Auto-Draft active</span>
                  </div>
                </div>

              </div>
            )}

            {/* 1. Google Sheets View */}
            {activeSubTab === 'sheets' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">Google Sheets Integration</h3>
                    <p className="text-[10px] text-slate-500 font-medium">Sync user detail rows automatically to administrative spreadsheets.</p>
                  </div>
                  <button
                    onClick={fetchSpreadsheets}
                    disabled={loading.sheets}
                    className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl cursor-pointer border-none"
                    title="Refresh sheet values"
                  >
                    <RefreshCw size={14} className={loading.sheets ? 'animate-spin' : ''} />
                  </button>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Create Dynamic Spreadsheet</span>
                  <div className="flex space-x-2">
                    <input 
                      type="text"
                      value={customSheetTitle}
                      onChange={(e) => setCustomSheetTitle(e.target.value)}
                      placeholder="Spreadsheet Title"
                      className="flex-1 px-3 py-2 bg-white border border-slate-150 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                    />
                    <button
                      onClick={createGoogleSheet}
                      disabled={loading.createSheet}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[9px] uppercase tracking-wider rounded-xl cursor-pointer border-none"
                    >
                      {loading.createSheet ? 'Spawning...' : 'Create'}
                    </button>
                  </div>
                </div>

                {loading.sheets ? (
                  <div className="text-center py-6 text-xs font-bold text-slate-400">Loading sheets data...</div>
                ) : apiData.sheets ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                      <span>Spreadsheet: <span className="font-extrabold text-slate-900">{apiData.sheets.properties?.title}</span></span>
                      <a 
                        href={`https://docs.google.com/spreadsheets/d/${apiData.spreadsheetId}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-indigo-600 hover:underline flex items-center space-x-0.5 text-[10px]"
                      >
                        <span>Open In Drive</span>
                        <ExternalLink size={10} />
                      </a>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-150 shadow-sm">
                      <table className="w-full text-[10px] text-left">
                        <thead className="bg-slate-50 text-slate-400 uppercase tracking-widest font-black">
                          <tr>
                            <th className="p-2.5">UID</th>
                            <th className="p-2.5">Email</th>
                            <th className="p-2.5">Username</th>
                            <th className="p-2.5">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {apiData.sheets.rows && apiData.sheets.rows.slice(1).map((row: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50/50">
                              <td className="p-2.5 font-mono text-slate-500">{row[0]?.substring(0,6)}...</td>
                              <td className="p-2.5 font-bold text-slate-800">{row[1]}</td>
                              <td className="p-2.5 font-medium text-slate-600">{row[2]}</td>
                              <td className="p-2.5 font-mono text-slate-400">{row[3]?.substring(11, 19)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-2xl text-center text-xs text-slate-400 font-bold border border-slate-100">
                    No connected active signups spreadsheet found in firebase sheets_config yet. Sign-up a new user to automatically provision it!
                  </div>
                )}
              </div>
            )}

            {/* 2. Google Slides View */}
            {activeSubTab === 'slides' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">Google Slides Presentations</h3>
                  <p className="text-[10px] text-slate-500 font-medium">Create and assemble presentations dynamically for pitch decks and summaries.</p>
                </div>

                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 text-left space-y-3.5">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Deck Title</span>
                    <input 
                      type="text"
                      value={customSlideTitle}
                      onChange={(e) => setCustomSlideTitle(e.target.value)}
                      placeholder="e.g. Shoreditch Expansion Report"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-150 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <button
                    onClick={createPresentation}
                    disabled={loading.slides}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[10px] tracking-wider uppercase rounded-xl cursor-pointer border-none flex items-center justify-center space-x-1.5"
                  >
                    {loading.slides ? (
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <>
                        <Presentation size={13} className="text-brand shrink-0" />
                        <span>Assemble Presentation Deck</span>
                      </>
                    )}
                  </button>
                </div>

                {apiData.slides && (
                  <div className="p-4 bg-indigo-50/50 border border-indigo-150 rounded-2xl flex items-center justify-between text-[11px] leading-tight font-bold text-indigo-900">
                    <div className="space-y-0.5">
                      <p className="font-extrabold">Slide Deck Created Successfully!</p>
                      <p className="text-indigo-600 font-medium text-[10px]">Title: {apiData.slides.title}</p>
                    </div>
                    <a 
                      href={`https://docs.google.com/presentation/d/${apiData.slides.presentationId}`} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="text-[9px] font-black tracking-wide uppercase text-indigo-650 hover:underline flex items-center space-x-0.5"
                    >
                      <span>Open Deck</span>
                      <ExternalLink size={10} />
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* 3. Google Tasks View */}
            {activeSubTab === 'tasks' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">Google Tasks Integration</h3>
                    <p className="text-[10px] text-slate-500 font-medium">Coordinate task sheets and check off administrative todos seamlessly.</p>
                  </div>
                  <button
                    onClick={fetchTasks}
                    disabled={loading.tasks}
                    className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl cursor-pointer border-none"
                  >
                    <RefreshCw size={14} className={loading.tasks ? 'animate-spin' : ''} />
                  </button>
                </div>

                {/* Add new task input */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left space-y-3">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Create Administrative Task</span>
                  <div className="space-y-2">
                    <input 
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="Task Title (e.g. Audit Hoxton safety report)"
                      className="w-full px-3 py-2 bg-white border border-slate-150 rounded-xl text-xs font-bold text-slate-800"
                    />
                    <input 
                      type="text"
                      value={newTaskNotes}
                      onChange={(e) => setNewTaskNotes(e.target.value)}
                      placeholder="Optional notes or instructions"
                      className="w-full px-3 py-2 bg-white border border-slate-150 rounded-xl text-xs font-bold text-slate-800"
                    />
                    <button
                      onClick={createTask}
                      disabled={loading.createTask || !newTaskTitle.trim()}
                      className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[9px] uppercase tracking-wider rounded-xl cursor-pointer border-none"
                    >
                      {loading.createTask ? 'Adding to Google...' : 'Add Google Task'}
                    </button>
                  </div>
                </div>

                {loading.tasks ? (
                  <div className="text-center py-6 text-xs text-slate-400 font-bold">Loading tasks from Google...</div>
                ) : apiData.tasks && apiData.tasks.length > 0 ? (
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block px-1">Your Google Tasks</span>
                    <div className="divide-y divide-slate-100 border border-slate-150 rounded-2xl overflow-hidden">
                      {apiData.tasks.map((task: any) => (
                        <div key={task.id} className="p-3.5 bg-white flex items-start space-x-3 hover:bg-slate-50/50">
                          <CheckSquare size={14} className="text-slate-400 shrink-0 mt-0.5" />
                          <div className="leading-tight">
                            <p className="text-xs font-bold text-slate-800">{task.title}</p>
                            {task.notes && <p className="text-[10px] text-slate-400 mt-0.5">{task.notes}</p>}
                            {task.due && <p className="text-[8px] font-mono text-slate-400 mt-1">Due: {new Date(task.due).toLocaleDateString()}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-2xl text-center text-xs text-slate-400 font-bold border border-slate-100">
                    No pending tasks in default lists. Use the administrative panel above to push tasks!
                  </div>
                )}
              </div>
            )}

            {/* 4. Google Meet coordinator */}
            {activeSubTab === 'meet' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">Google Meet Coordinator</h3>
                  <p className="text-[10px] text-slate-500 font-medium">Spawn real-time consult meetings and video lobbies instantly.</p>
                </div>

                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 text-left space-y-3.5">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Meeting Agenda / Topic</span>
                    <input 
                      type="text"
                      value={meetSpaceName}
                      onChange={(e) => setMeetSpaceName(e.target.value)}
                      placeholder="Topic of consultation"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-150 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <button
                    onClick={createMeetSpace}
                    disabled={loading.meet}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] tracking-wider uppercase rounded-xl cursor-pointer border-none flex items-center justify-center space-x-1.5"
                  >
                    {loading.meet ? (
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <>
                        <Video size={13} className="text-brand shrink-0" />
                        <span>Schedule Video Consultation Lobby</span>
                      </>
                    )}
                  </button>
                </div>

                {apiData.meet && (
                  <div className="p-4 bg-emerald-50 border border-emerald-150 rounded-2xl flex items-center justify-between text-[11px] leading-tight font-bold text-emerald-900">
                    <div className="space-y-0.5">
                      <p className="font-extrabold">Meeting Lobby Provisioned!</p>
                      <p className="text-emerald-600 font-medium text-[10px]">{apiData.meet.summary}</p>
                    </div>
                    <a 
                      href={apiData.meet.url} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="text-[9px] font-black tracking-wide uppercase text-emerald-750 hover:underline flex items-center space-x-0.5 bg-white border border-emerald-200 py-1.5 px-3.5 rounded-lg"
                    >
                      <span>Join Meet Lobby</span>
                      <ExternalLink size={10} />
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* 6. Classroom View */}
            {activeSubTab === 'classroom' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">Google Classroom Roster</h3>
                    <p className="text-[10px] text-slate-500 font-medium">Tutoring cohorts and skill-sharing classes within Shoreditch.</p>
                  </div>
                  <button
                    onClick={fetchClassrooms}
                    disabled={loading.classroom}
                    className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl cursor-pointer border-none"
                  >
                    <RefreshCw size={14} className={loading.classroom ? 'animate-spin' : ''} />
                  </button>
                </div>

                {loading.classroom ? (
                  <div className="text-center py-6 text-xs text-slate-400 font-bold">Fetching courses from Classroom...</div>
                ) : apiData.classroom && apiData.classroom.length > 0 ? (
                  <div className="space-y-2">
                    <div className="divide-y divide-slate-100 border border-slate-150 rounded-2xl overflow-hidden">
                      {apiData.classroom.map((course: any) => (
                        <div key={course.id} className="p-3.5 bg-white flex items-center justify-between hover:bg-slate-50/50">
                          <div className="flex items-center space-x-2.5">
                            <GraduationCap size={16} className="text-slate-400 shrink-0" />
                            <div className="leading-tight">
                              <p className="text-xs font-bold text-slate-800">{course.name}</p>
                              {course.section && <p className="text-[9px] text-slate-400 mt-0.5">Section: {course.section}</p>}
                            </div>
                          </div>
                          <span className={`text-[8px] font-mono font-bold uppercase py-0.5 px-2 rounded ${course.courseState === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                            {course.courseState}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-6 bg-slate-50 rounded-2xl text-center border border-slate-100 space-y-1">
                    <GraduationCap size={24} className="text-slate-300 mx-auto" />
                    <p className="text-xs text-slate-400 font-bold">No connected academic Classroom streams found yet.</p>
                    <p className="text-[9px] text-slate-400">Classroom dashboard will stream items as tutor-pro sessions register.</p>
                  </div>
                )}
              </div>
            )}

            {/* 7. Contacts View */}
            {activeSubTab === 'contacts' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">Google Contacts & Directory</h3>
                    <p className="text-[10px] text-slate-500 font-medium">Verify civic contacts and rapid emergency connections.</p>
                  </div>
                  <button
                    onClick={fetchClassrooms}
                    disabled={loading.contacts}
                    className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl cursor-pointer border-none"
                  >
                    <RefreshCw size={14} className={loading.contacts ? 'animate-spin' : ''} />
                  </button>
                </div>

                {loading.contacts ? (
                  <div className="text-center py-6 text-xs text-slate-400 font-bold">Loading contacts directory...</div>
                ) : apiData.contacts && apiData.contacts.length > 0 ? (
                  <div className="space-y-2">
                    <div className="divide-y divide-slate-100 border border-slate-150 rounded-2xl overflow-hidden">
                      {apiData.contacts.map((contact: any, idx: number) => (
                        <div key={idx} className="p-3.5 bg-white flex items-center justify-between hover:bg-slate-50/50">
                          <div className="flex items-center space-x-2.5">
                            <Users size={16} className="text-indigo-400 shrink-0" />
                            <div className="leading-tight">
                              <p className="text-xs font-bold text-slate-800">{contact.names?.[0]?.displayName || 'Anonymous Partner'}</p>
                              {contact.emailAddresses?.[0]?.value && (
                                <p className="text-[9px] text-slate-400 mt-0.5">{contact.emailAddresses?.[0]?.value}</p>
                              )}
                            </div>
                          </div>
                          {contact.phoneNumbers?.[0]?.value && (
                            <span className="text-[9px] font-mono font-bold text-slate-550">
                              {contact.phoneNumbers?.[0]?.value}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-6 bg-slate-50 rounded-2xl text-center border border-slate-100 space-y-1">
                    <Users size={24} className="text-slate-300 mx-auto" />
                    <p className="text-xs text-slate-400 font-bold">Empty connections list retrieved from People API.</p>
                    <p className="text-[9px] text-slate-400">Add connections to your primary Google Account to see directory matching here.</p>
                  </div>
                )}
              </div>
            )}

            {/* 8. Power Efficiency View */}
            {activeSubTab === 'power_efficiency' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                    <Zap size={16} className="text-amber-500 animate-pulse" />
                    <span>Power & Data Efficiency Tracker</span>
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Historical telemetry mapping how battery-saving actions conserve mobile data and reduce SoC drain.
                  </p>
                </div>

                {/* KPI Summary Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[8px] font-mono font-bold text-slate-400 uppercase block">Total Battery Saved</span>
                    <span className="text-lg font-black text-slate-800 font-mono">202% SoC</span>
                    <span className="text-[7.5px] text-emerald-600 font-extrabold uppercase block mt-1">~6.8 hrs standby</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[8px] font-mono font-bold text-slate-400 uppercase block">Total Data Preserved</span>
                    <span className="text-lg font-black text-slate-800 font-mono">730 MB</span>
                    <span className="text-[7.5px] text-indigo-600 font-extrabold uppercase block mt-1">Across roaming tiers</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[8px] font-mono font-bold text-slate-400 uppercase block">Mitigation Actions</span>
                    <span className="text-lg font-black text-slate-800 font-mono">37 triggers</span>
                    <span className="text-[7.5px] text-slate-500 font-extrabold uppercase block mt-1">98% success rate</span>
                  </div>
                </div>

                {/* Graph Card */}
                <div className="p-4 bg-slate-950 text-white rounded-3xl border border-slate-800 space-y-4 shadow-inner">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[9px] font-mono font-black uppercase tracking-widest text-indigo-400">IMPACT CORRELATION MATRIX</span>
                    <span className="text-[8px] bg-indigo-500/10 border border-indigo-500/25 px-2 py-0.5 rounded-full font-mono text-indigo-300">7-Day Historical</span>
                  </div>
                  <div className="h-48 w-full text-xs">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={POWER_EFFICIENCY_DATA} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorBattery" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorData" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="day" stroke="#64748b" tickLine={false} style={{ fontSize: '9px', fontWeight: 'bold' }} />
                        <YAxis stroke="#64748b" tickLine={false} style={{ fontSize: '9px', fontWeight: 'bold' }} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '10px' }} />
                        <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 'black', textTransform: 'uppercase', letterSpacing: '0.05em' }} />
                        <Area type="monotone" dataKey="Battery Saved (%)" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorBattery)" />
                        <Area type="monotone" dataKey="Mobile Data Saved (MB)" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorData)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Specific mitigation logs list */}
                <div className="space-y-2.5">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block px-1">Power Mitigation Log</span>
                  <div className="divide-y divide-slate-100 border border-slate-150 rounded-2xl overflow-hidden bg-white text-xs">
                    {[
                      { title: 'Marketplace Image Downscaling', desc: 'Auto-switched heavy remote catalog graphics to responsive, vector-based lightweight placeholders during 15% SoC low-battery state.', save: 'Saved 85MB data & 3.2% SoC' },
                      { title: 'Manual Sync Toggling Policy', desc: 'Deferred scheduled cache sweeps and Firebase updates to manual requests during cellular roaming.', save: 'Saved 110MB data & 4.1% SoC' },
                      { title: 'Background Backup Defusal', desc: 'Paused large background service-log syncs while device state was marked as "low energy".', save: 'Saved 45MB data & 1.8% SoC' }
                    ].map((item, idx) => (
                      <div key={idx} className="p-3.5 flex justify-between items-start hover:bg-slate-50/40">
                        <div className="space-y-0.5 max-w-[70%]">
                          <p className="font-extrabold text-slate-800">{item.title}</p>
                          <p className="text-[9.5px] text-slate-400 font-medium leading-relaxed">{item.desc}</p>
                        </div>
                        <span className="text-[9px] font-black font-mono text-emerald-600 bg-emerald-50 border border-emerald-100/50 px-2 py-0.5 rounded-lg shrink-0">
                          {item.save}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
