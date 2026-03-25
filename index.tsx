import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { 
  Leaf, 
  Camera, 
  LayoutDashboard, 
  AlertTriangle, 
  Loader2, 
  ClipboardList,
  UploadCloud,
  Zap,
  Plus,
  Skull,
  ShieldCheck,
  AlertCircle,
  X,
  Settings,
  FileSpreadsheet,
  Trash2,
  Pencil,
  FlaskConical,
  CheckSquare,
  Square,
  Sun,
  Moon,
  Undo,
  Redo,
  CheckCircle,
  Circle,
  Check,
  BarChart3,
  MapPin,
  Facebook,
  Twitter,
  Instagram,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  Globe,
  SlidersHorizontal,
  PlusCircle,
  Layers,
  Calendar,
  Archive,
  History,
  Database,
  Download
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

// --- Types & Constants ---

type SeverityLevel = 0 | 1 | 2 | 3;

interface SeverityRule {
  disease: string;
  level2: number; // Threshold for Level 2 (Treatment Required)
  level3: number; // Threshold for Level 3 (Dangerous)
}

interface DiseaseFinding {
  name: string;
  severity: SeverityLevel;
  count: number;
}

interface ScoutRecord {
  id: string;
  blocId: string;
  massaId: string;
  findings: DiseaseFinding[];
  timestamp: string;
}

interface TreatmentAction {
  id: string;
  blocId: string;
  disease: string;
  severity: number;
  product: string;
  activeIngredient: string;
  dosage: string;
  unit: string;
  reasoning: string;
  status: 'pending' | 'completed';
  date: string;
  time: string;
  stage: string;
  applicationType: string;
}

// Full History State now tracks structure (diseases) as well as data
interface HistoryState {
  records: ScoutRecord[];
  treatmentPlan: TreatmentAction[];
  diseases: string[];
  severityRules: Record<string, SeverityRule>;
}

const DEFAULT_DISEASES = [
  "Puceron", "Ceci", "Thrips", "Noc", "Coch", 
  "Bot", "Oid", "Stem", "Anth", "rust"
];

const DEFAULT_RULES: Record<string, SeverityRule> = DEFAULT_DISEASES.reduce((acc, d) => {
  return {
    ...acc,
    [d]: { 
      disease: d, 
      level2: 2, // Standard Severity 2
      level3: 3  // Standard Severity 3
    }
  };
}, {});

const DEMO_PRODUCTS = `Product,ActiveIngredient,Dosage,Unit,DAR,Target
Ortiva,Azoxystrobin,0.8,L/ha,3,Oidium/Mildew/Alternaria
Score 250 EC,Difenoconazole,0.5,L/ha,14,Alternaria/Oidium/Rouille
Movento,Spirotetramat,0.75,L/ha,7,Puceron/Cochinelle/Thrips
Oberon,Spiromesifen,0.6,L/ha,3,Acariens/Aleurodes
Voliam Targo,Chlorantraniliprole+Abamectin,0.8,L/ha,7,Mineuse/Acariens/Thrips
Affirm,Emamectin benzoate,1.5,kg/ha,3,Noctuelle/Tuta
Decis Expert,Deltamethrin,0.075,L/ha,3,Thrips/Puceron/Noctuelle
Benevia,Cyantraniliprole,0.75,L/ha,7,Mouche blanche/Thrips
Luna Privilege,Fluopyram,0.5,L/ha,3,Botrytis/Oidium
Ridomil Gold,Mefenoxam,2.0,kg/ha,14,Mildiou
Signum,Boscalid+Pyraclostrobin,1.5,kg/ha,7,Botrytis/Sclerotinia`.trim();

const SEVERITY_CONFIG = {
  0: { 
    label: 'None', 
    color: 'text-slate-500', 
    dayColor: 'text-slate-400',
    bg: 'bg-slate-500/5', 
    border: 'border-slate-500/10',
    icon: ShieldCheck,
  },
  1: { 
    label: 'Safe', 
    color: 'text-emerald-400', 
    dayColor: 'text-emerald-600',
    bg: 'bg-emerald-500/10', 
    border: 'border-emerald-500/20',
    icon: ShieldCheck,
  },
  2: { 
    label: 'Treatment', 
    color: 'text-amber-400', 
    dayColor: 'text-amber-600',
    bg: 'bg-amber-500/10', 
    border: 'border-amber-500/20',
    icon: AlertCircle,
  },
  3: { 
    label: 'Critical', 
    color: 'text-red-400', 
    dayColor: 'text-red-600',
    bg: 'bg-red-500/10', 
    border: 'border-red-500/20',
    icon: Skull,
  }
};

const App = () => {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [step, setStep] = useState<'landing' | 'about' | 'contact' | 'pricing' | 'upload' | 'preview' | 'analyzing' | 'dashboard' | 'results' | 'treatment' | 'matrix'>('landing');
  
  // Data State
  const [records, setRecords] = useState<ScoutRecord[]>([]);
  const [treatmentPlan, setTreatmentPlan] = useState<TreatmentAction[]>([]);
  // Digital Memory of treatments (Parsed from CSV + Appended by User)
  const [digitalHistory, setDigitalHistory] = useState<TreatmentAction[]>([]);
  
  // Configuration State
  const [diseases, setDiseases] = useState<string[]>(DEFAULT_DISEASES);
  const [severityRules, setSeverityRules] = useState<Record<string, SeverityRule>>(DEFAULT_RULES);
  const [parcelPlan, setParcelPlan] = useState<string | null>(null);
  const [treatmentHistoryCSV, setTreatmentHistoryCSV] = useState<string | null>(null);
  const [homologatedProducts, setHomologatedProducts] = useState<string | null>(null);
  const [harvestDate, setHarvestDate] = useState<string>("");

  // New Disease Input State
  const [newDiseaseName, setNewDiseaseName] = useState('');
  const [newL2Threshold, setNewL2Threshold] = useState('');
  const [newL3Threshold, setNewL3Threshold] = useState('');
  
  // Manual History Input State
  const [manualHistory, setManualHistory] = useState({ bloc: '', disease: '', date: '', product: '' });
  
  // Input/File State
  const [pendingImages, setPendingImages] = useState<{id: string, name: string, data: string}[]>([]);
  const [processingErrors, setProcessingErrors] = useState<{name: string, message: string}[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReferenceOpen, setIsReferenceOpen] = useState(false);
  
  // Progress State for Batch Processing
  const [analysisProgress, setAnalysisProgress] = useState<{current: number, total: number, currentFile?: string} | null>(null);
  
  // Notification State
  const [toast, setToast] = useState<{message: string, type: 'success' | 'info'} | null>(null);
  
  // UI State
  const [isDragging, setIsDragging] = useState(false);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  
  // Enhanced History Stack
  const [historyStack, setHistoryStack] = useState<{past: HistoryState[], future: HistoryState[]}>({ past: [], future: [] });
  
  const [sortConfig, setSortConfig] = useState<{ key: string | null; direction: 'asc' | 'desc' | null }>({ key: null, direction: null });
  
  const [editingRecord, setEditingRecord] = useState<ScoutRecord | null>(null);
  const [tempRecord, setTempRecord] = useState<ScoutRecord | null>(null);
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [tempAction, setTempAction] = useState<TreatmentAction | null>(null);
  const [editingProtocol, setEditingProtocol] = useState<{ originalName: string, name: string, level2: number, level3: number } | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const historyInputRef = useRef<HTMLInputElement>(null);
  const productsInputRef = useRef<HTMLInputElement>(null);

  // Persistence
  useEffect(() => {
    const loadLocal = (key: string, setter: (val: any) => void, parser?: (v: string) => any) => {
      const saved = localStorage.getItem(key);
      if (saved) {
        try { setter(parser ? parser(saved) : saved); } 
        catch (e) { console.error(`Error loading ${key}`, e); }
      }
    };

    loadLocal('scout_ai_rules', setSeverityRules, JSON.parse);
    loadLocal('scout_ai_diseases', setDiseases, JSON.parse);
    loadLocal('scout_ai_plan', setParcelPlan);
    loadLocal('scout_ai_history', setTreatmentHistoryCSV);
    loadLocal('scout_ai_products', setHomologatedProducts);
    loadLocal('scout_ai_harvest_date', setHarvestDate);
    loadLocal('scout_ai_digital_history', setDigitalHistory, JSON.parse);
  }, []);

  // Migration for rule changes
  useEffect(() => {
     const checkAndMigrate = () => {
         const saved = localStorage.getItem('scout_ai_rules');
         if (saved) {
             const r = JSON.parse(saved);
             let modified = false;
             Object.keys(r).forEach(key => {
                 if (r[key].level2 > 3 || r[key].level3 > 5) {
                     r[key].level2 = 2;
                     r[key].level3 = 3;
                     modified = true;
                 }
             });
             if (modified) {
                 setSeverityRules(r);
                 localStorage.setItem('scout_ai_rules', JSON.stringify(r));
             }
         }
     };
     checkAndMigrate();
  }, []);

  useEffect(() => {
    if (toast) {
        const timer = setTimeout(() => setToast(null), 3000);
        return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
  };

  // --- HISTORY MANAGEMENT ---

  const saveToHistory = useCallback(() => {
    setHistoryStack(prev => ({
        past: [...prev.past.slice(-19), { 
            records, 
            treatmentPlan, 
            diseases, 
            severityRules 
        }],
        future: []
    }));
  }, [records, treatmentPlan, diseases, severityRules]);

  const handleUndo = () => {
      if (historyStack.past.length === 0) return;
      const previous = historyStack.past[historyStack.past.length - 1];
      
      setHistoryStack(prev => ({
          past: prev.past.slice(0, -1),
          future: [{ records, treatmentPlan, diseases, severityRules }, ...prev.future]
      }));

      setRecords(previous.records);
      setTreatmentPlan(previous.treatmentPlan);
      setDiseases(previous.diseases);
      setSeverityRules(previous.severityRules);
      
      localStorage.setItem('scout_ai_diseases', JSON.stringify(previous.diseases));
      localStorage.setItem('scout_ai_rules', JSON.stringify(previous.severityRules));
      
      showToast("Undone");
  };

  const handleRedo = () => {
      if (historyStack.future.length === 0) return;
      const next = historyStack.future[0];
      
      setHistoryStack(prev => ({
          past: [...prev.past, { records, treatmentPlan, diseases, severityRules }],
          future: prev.future.slice(1)
      }));

      setRecords(next.records);
      setTreatmentPlan(next.treatmentPlan);
      setDiseases(next.diseases);
      setSeverityRules(next.severityRules);

      localStorage.setItem('scout_ai_diseases', JSON.stringify(next.diseases));
      localStorage.setItem('scout_ai_rules', JSON.stringify(next.severityRules));
      
      showToast("Redone");
  };

  // --- DISEASE / PROTOCOL MANAGEMENT ---

  const handleAddDisease = () => {
    const name = newDiseaseName.trim();
    if (!name) return;
    if (diseases.some(d => d.toLowerCase() === name.toLowerCase())) {
        showToast("Disease already exists", 'info');
        return;
    }

    saveToHistory();

    const l2 = parseInt(newL2Threshold) || 2;
    const l3 = parseInt(newL3Threshold) || 3;

    const updatedDiseases = [...diseases, name];
    setDiseases(updatedDiseases);
    localStorage.setItem('scout_ai_diseases', JSON.stringify(updatedDiseases));

    const newRule: SeverityRule = { disease: name, level2: l2, level3: l3 };
    const updatedRules = { ...severityRules, [name]: newRule };
    setSeverityRules(updatedRules);
    localStorage.setItem('scout_ai_rules', JSON.stringify(updatedRules));

    setRecords(prev => prev.map(r => ({
        ...r,
        findings: [...r.findings, { name: name, count: 0, severity: 0 as SeverityLevel }]
    })));

    setNewDiseaseName('');
    setNewL2Threshold('');
    setNewL3Threshold('');
    showToast(`${name} added to protocol`);
  };

  const handleDeleteDisease = (e: React.MouseEvent, diseaseName: string) => {
    e.preventDefault();
    e.stopPropagation();
        
    saveToHistory();

    const updatedDiseases = diseases.filter(d => d !== diseaseName);
    setDiseases(updatedDiseases);
    localStorage.setItem('scout_ai_diseases', JSON.stringify(updatedDiseases));
    
    const newRules = { ...severityRules };
    delete newRules[diseaseName];
    setSeverityRules(newRules);
    localStorage.setItem('scout_ai_rules', JSON.stringify(newRules));

    setRecords(prevRecords => prevRecords.map(record => ({
        ...record,
        findings: record.findings.filter(f => f.name !== diseaseName)
    })));
    
    setTreatmentPlan(prevPlan => prevPlan.filter(p => p.disease !== diseaseName));

    showToast(`${diseaseName} deleted`, 'info');
  };

  const handleSaveProtocol = () => {
    if (!editingProtocol) return;
    const { originalName, name, level2, level3 } = editingProtocol;
    if (!name.trim()) return;
    
    saveToHistory();

    if (name !== originalName && diseases.some(d => d.toLowerCase() === name.toLowerCase())) {
        showToast("Disease name already exists", "info");
        return;
    }

    if (name !== originalName) {
        const newDiseases = diseases.map(d => d === originalName ? name : d);
        setDiseases(newDiseases);
        localStorage.setItem('scout_ai_diseases', JSON.stringify(newDiseases));
        
        const newRules = { ...severityRules };
        delete newRules[originalName];
        newRules[name] = { disease: name, level2, level3 };
        setSeverityRules(newRules);
        localStorage.setItem('scout_ai_rules', JSON.stringify(newRules));

        setRecords(prev => prev.map(r => ({
            ...r,
            findings: r.findings.map(f => f.name === originalName ? { ...f, name: name } : f)
        })));

        setTreatmentPlan(prev => prev.map(p => p.disease === originalName ? { ...p, disease: name } : p));
    } else {
        const newRules = { ...severityRules, [name]: { disease: name, level2, level3 } };
        setSeverityRules(newRules);
        localStorage.setItem('scout_ai_rules', JSON.stringify(newRules));
    }
    
    setEditingProtocol(null);
    showToast("Protocol updated");
  };

  const calculateSeverity = useCallback((diseaseName: string, count: number): SeverityLevel => {
    const rule = severityRules[diseaseName] || { disease: diseaseName, level2: 2, level3: 3 };
    if (count >= rule.level3) return 3;
    if (count >= rule.level2) return 2;
    if (count > 0) return 1;
    return 0;
  }, [severityRules]);

  const startEditingAction = (action: TreatmentAction) => {
    setTempAction({ ...action });
    setEditingActionId(action.id);
  };

  const handleSaveAction = () => {
    if (!tempAction) return;
    saveToHistory();
    setTreatmentPlan(prev => prev.map(a => a.id === tempAction.id ? tempAction : a));
    setEditingActionId(null);
    setTempAction(null);
  };

  const handleDeleteAction = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    saveToHistory();
    setTreatmentPlan(prev => prev.filter(a => a.id !== id));
    showToast("Treatment removed from plan", 'info');
  };

  const handleToggleStatus = (id: string) => {
    saveToHistory();
    setTreatmentPlan(prev => prev.map(a => 
        a.id === id ? { ...a, status: a.status === 'completed' ? 'pending' : 'completed' } : a
    ));
  };
  
  // New Feature: Archive Completed Treatments to Persistent History
  const handleArchiveCompleted = () => {
      const completed = treatmentPlan.filter(a => a.status === 'completed');
      if (completed.length === 0) {
          showToast("No completed treatments to archive.", "info");
          return;
      }
      
      const newHistory = [...digitalHistory, ...completed];
      setDigitalHistory(newHistory);
      localStorage.setItem('scout_ai_digital_history', JSON.stringify(newHistory));
      
      // Optional: Remove from current plan view or keep them? Keeping them for now but marked.
      showToast(`${completed.length} treatments archived to History.`);
  };

  const handleAddManualHistory = () => {
      if (!manualHistory.bloc || !manualHistory.product || !manualHistory.date) {
          showToast("Missing fields for manual history", "info");
          return;
      }

      const newEntry: TreatmentAction = {
          id: `man-${Date.now()}`,
          blocId: manualHistory.bloc,
          disease: manualHistory.disease || 'General',
          product: manualHistory.product,
          date: manualHistory.date,
          status: 'completed',
          activeIngredient: '', // AI will infer or user can leave blank
          severity: 0,
          dosage: '-',
          unit: '-',
          reasoning: 'Manual Entry',
          time: '12:00',
          stage: 'Unknown',
          applicationType: 'Spray'
      };

      const newHistory = [...digitalHistory, newEntry];
      setDigitalHistory(newHistory);
      localStorage.setItem('scout_ai_digital_history', JSON.stringify(newHistory));
      setManualHistory({ bloc: '', disease: '', date: '', product: '' });
      showToast("Manual record added to history");
  };

  const handleDeleteHistoryItem = (id: string) => {
      if(!window.confirm("Remove this entry from memory?")) return;
      const newHistory = digitalHistory.filter(h => h.id !== id);
      setDigitalHistory(newHistory);
      localStorage.setItem('scout_ai_digital_history', JSON.stringify(newHistory));
  };

  const handleLoadDemoProducts = () => {
      setHomologatedProducts(DEMO_PRODUCTS);
      localStorage.setItem('scout_ai_products', DEMO_PRODUCTS);
      showToast("Demo Products loaded! You can now generate plans.");
  };
  
  const handleBulkDelete = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (selectedRecordIds.size === 0) return;
      
      const count = selectedRecordIds.size;
      if (window.confirm(`Permanently delete ${count} records?`)) {
          saveToHistory();
          
          const idsToDelete = new Set(selectedRecordIds);
          setRecords(prev => prev.filter(r => !idsToDelete.has(r.id)));
          
          setSelectedRecordIds(new Set()); // Clear selection
          showToast(`${count} records deleted`);
      }
  };

  const startEditingRecord = (record: ScoutRecord) => {
    setTempRecord(JSON.parse(JSON.stringify(record))); // Deep copy
    setEditingRecord(record);
  };

  const handleSaveRecord = () => {
    if (!tempRecord) return;
    saveToHistory();
    setRecords(prev => prev.map(r => r.id === tempRecord.id ? tempRecord : r));
    setEditingRecord(null);
    setTempRecord(null);
  };

  // --- BATCH PROCESSING LOGIC ---
  const processFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    
    if (validFiles.length === 0) {
        setErrorMessage("Please upload valid image files.");
        return;
    }

    if (validFiles.length > 20) {
        if(!window.confirm(`You are uploading ${validFiles.length} images. This might take a while to process. Continue?`)) return;
    }

    const promises = validFiles.map(file => {
        return new Promise<{id: string, name: string, data: string}>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve({
                id: Math.random().toString(36).substr(2, 9),
                name: file.name,
                data: e.target?.result as string
            });
            reader.readAsDataURL(file);
        });
    });

    Promise.all(promises).then(newImages => {
        setPendingImages(prev => [...prev, ...newImages]); // Append new images
        setStep('preview');
        setErrorMessage(null);
    });
  };

  const analyzeScoutImages = async () => {
    if (pendingImages.length === 0) return;
    setStep('analyzing');
    setAnalysisProgress({ current: 0, total: pendingImages.length, currentFile: pendingImages[0].name });
    setErrorMessage(null);
    setProcessingErrors([]); // Clear previous errors
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const newRecords: ScoutRecord[] = [];
    const errors: {name: string, message: string}[] = [];

    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        blocId: { type: Type.STRING },
        massaId: { type: Type.STRING },
        findings: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              diseaseName: { type: Type.STRING },
              severity: { type: Type.INTEGER }
            }
          }
        }
      }
    };

    for (let i = 0; i < pendingImages.length; i++) {
      const imgObj = pendingImages[i];
      setAnalysisProgress({ current: i + 1, total: pendingImages.length, currentFile: imgObj.name });
      
      try {
        const mimeType = imgObj.data.match(/data:([^;]+);/)?.[1] || 'image/jpeg';
        const base64Data = imgObj.data.split(',')[1];

        const prompt = `You are a strict Data Entry Auditor for an agricultural company.
        Your task is to extracting precise data from the "Scout Suivi" handwritten sheet provided in the image.

        OBJECTIVE:
        Generate a summary row for the sheet.

        STEP 1: IDENTIFY BLOC & MASSA
        - Extract "Bloc" (e.g. 08, B08) and "Massa" (e.g. 01, M12, 1-5).
        - IMPORTANT: Return the raw Massa number/range (e.g. "01"). Do NOT return "Sheet Summary".
        - Use this Parcel Plan to validate: ${parcelPlan ? parcelPlan.slice(0, 50000) : 'None'}.

        STEP 2: EXTRACT DISEASE DATA
        - Columns: Puceron (Puce), Cecidomyie (Ceci), Thrips (Thri), Noctuelle (Noc), etc.
        - CRITICAL: Do not confuse "Thrips" with "Cecidomyie". Check headers carefully.
        - Scan the sheet vertically. Determine the HIGHEST severity level found in that column.

        SEVERITY RULES (Hierarchy):
        1. **Severity 3 (Critical)**: Explicit '3', 'High', Red marks, or 'R+'. If found ANYWHERE -> Result is 3.
        2. **Severity 2 (Treatment)**: Explicit '2', 'Med', or Orange marks. If found (and no 3s) -> Result is 2.
        3. **Severity 1 (Presence)**: Explicit '1', '+', 'X', '✓', dots, or 'Low'. If found (and no 2s or 3s) -> Result is 1.
        4. **Severity 0 (Clean)**: Column is completely empty or contains only '-' or '0'. -> Result is 0.

        Ensure all found diseases are included in the 'findings' array.
        `;

        const response = await ai.models.generateContent({
          model: 'gemini-3-pro-preview', 
          contents: {
            parts: [
              { text: prompt },
              { inlineData: { mimeType: mimeType, data: base64Data } }
            ]
          },
          config: { 
            responseMimeType: 'application/json',
            responseSchema: responseSchema,
            thinkingConfig: { thinkingBudget: 32768 }
          }
        });

        const rawText = response.text || '{}';
        let data;
        try {
            data = JSON.parse(rawText);
        } catch(e) {
            console.error("Parsing Error", rawText);
            throw new Error("AI produced invalid JSON.");
        }

        // Validate extraction
        if (!data.blocId && !data.massaId && (!data.findings || data.findings.length === 0)) {
            throw new Error("No readable data found in image.");
        }

        // Map findings to configured diseases with fuzzy matching
        const mappedFindings: DiseaseFinding[] = diseases.map(dName => {
             const lowerDName = dName.toLowerCase();
             
             // Try to find a match in the AI returned findings
             const match = data.findings?.find((f: any) => {
                 const fName = (f.diseaseName || "").toLowerCase();
                 return fName.includes(lowerDName) || lowerDName.includes(fName);
             });
             
             const rawVal = match ? match.severity : 0;
             const sev = rawVal > 3 ? 3 : (rawVal < 0 ? 0 : rawVal as SeverityLevel);

             return {
               name: dName,
               count: sev, 
               severity: sev
             };
        });

        const newRecord: ScoutRecord = {
            id: `rec-${Date.now()}-${i}-${Math.random().toString(36).substr(2,5)}`,
            blocId: data.blocId || 'Unknown',
            massaId: data.massaId || 'Sheet Summary', 
            timestamp: new Date().toISOString(),
            findings: mappedFindings
        };
        newRecords.push(newRecord);

      } catch (error: any) {
        console.error(`Error processing image ${imgObj.name}:`, error);
        let msg = "Unknown error";
        if (error.message) msg = error.message;
        if (msg.includes("400")) msg = "Bad Request (Check image format)";
        if (msg.includes("429")) msg = "Rate Limit Exceeded (Too fast)";
        if (msg.includes("500")) msg = "Server Error (Try again)";
        errors.push({ name: imgObj.name, message: msg });
      }
    }

    if (newRecords.length > 0) {
      saveToHistory();
      setRecords(prev => [...newRecords, ...prev]);
    }
    
    setProcessingErrors(errors);

    if (errors.length > 0) {
        showToast(`Processed ${newRecords.length} sheets. ${errors.length} failed. See results for details.`, 'info');
    } else {
        showToast(`Successfully processed ${newRecords.length} sheets`);
    }

    setStep('results');
    setPendingImages([]);
    setAnalysisProgress(null);
  };

  const generateTreatmentPlan = async () => {
    const recordsToProcess = selectedRecordIds.size > 0 
        ? records.filter(r => selectedRecordIds.has(r.id))
        : records;

    if (recordsToProcess.length === 0) {
      setErrorMessage("No records available to process.");
      return;
    }
    
    if (!homologatedProducts) {
      setErrorMessage("Required Files Missing: Please upload 'Products' CSV file in Settings.");
      if (!homologatedProducts) setIsSettingsOpen(true);
      return;
    }

    setIsGeneratingPlan(true);
    setErrorMessage(null);
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        plan: {
           type: Type.ARRAY,
           items: {
             type: Type.OBJECT,
             properties: {
                blocId: { type: Type.STRING },
                disease: { type: Type.STRING },
                severity: { type: Type.INTEGER },
                product: { type: Type.STRING },
                activeIngredient: { type: Type.STRING },
                dosage: { type: Type.STRING },
                unit: { type: Type.STRING },
                reasoning: { type: Type.STRING },
             }
           }
        }
      }
    };

    try {
      const criticalFindings = recordsToProcess.map(r => ({
        bloc: r.blocId,
        massa: r.massaId,
        findings: r.findings.filter(f => f.severity >= 2)
      })).filter(r => r.findings.length > 0);

      if (criticalFindings.length === 0) {
        setErrorMessage("No critical findings (Severity >= 2) found in selected records.");
        setIsGeneratingPlan(false);
        return;
      }

      const today = new Date().toISOString().split('T')[0];

      // Prepare Digital History for AI Context
      const recentDigitalHistory = digitalHistory.slice(-50).map(d => ({
          bloc: d.blocId,
          disease: d.disease,
          date: d.date,
          product: d.product,
          activeIngredient: d.activeIngredient
      }));

      const prompt = `Act as an expert Agronomist. Create a detailed phytosanitary treatment program for Today: ${today}.
      
      TARGET HARVEST DATE: ${harvestDate || 'Not Specified'} (Respect DAR/PHI).

      CRITICAL FINDINGS TO TREAT (Severity >= 2):
      ${JSON.stringify(criticalFindings)}

      AVAILABLE PRODUCTS (Homologated List - Check DAR and AI):
      ${homologatedProducts.slice(0, 30000)}

      TREATMENT HISTORY (Check for recent sprays to avoid redundancy and rotation):
      CSV HISTORY: ${treatmentHistoryCSV ? treatmentHistoryCSV.slice(0, 5000) : 'None'}
      APP DIGITAL HISTORY: ${JSON.stringify(recentDigitalHistory)}

      INSTRUCTIONS:
      1. **CHECK REMANENCE:** If a Bloc was treated for a specific disease within the last 7 days (based on History), DO NOT treat again unless severity is Critical (3). Focus on untreated diseases.
      2. **ROTATION (MoA):** Do NOT recommend the same Active Ingredient used in the last application for a specific Bloc. You MUST rotate chemical families to prevent resistance.
      3. **DAR (Harvest Safety):** If Harvest Date is set, calculate days remaining. Do NOT use products where DAR > Days Remaining.
      4. **Dosage:** Use exact dosage from the product list.
      5. **Multiple Diseases:** If a Bloc has multiple issues (e.g., Thrips & Mildew) and one was recently treated, target the *other* one.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts: [{ text: prompt }] },
        config: { 
          responseMimeType: 'application/json',
          responseSchema: schema,
          thinkingConfig: { thinkingBudget: 32768 }
        }
      });

      const rawText = response.text || '{}';
      const result = JSON.parse(rawText);
      
      const newPlan = (result.plan || []).map((item: any) => ({
        ...item,
        id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        status: 'pending',
        date: today,
        time: "07:00",
        stage: "Croissance",
        applicationType: "Pulvérisation"
      }));
      
      saveToHistory();
      setTreatmentPlan(newPlan);
      setIsGeneratingPlan(false);
      setStep('treatment'); 

    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to generate treatment plan. Please try again.");
      setIsGeneratingPlan(false);
    }
  };

  // UI Helpers
  const t = (d: string, l: string) => isDarkMode ? d : l;
  
  const handleSort = (key: string) => {
    setSortConfig(current => ({
        key,
        direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedRecords = useMemo(() => {
    let sortableItems = [...records];
    if (sortConfig.key && sortConfig.direction) {
      sortableItems.sort((a, b) => {
        // Special case for ID columns
        if (sortConfig.key === 'blocId') return sortConfig.direction === 'asc' ? a.blocId.localeCompare(b.blocId) : b.blocId.localeCompare(a.blocId);
        if (sortConfig.key === 'massaId') return sortConfig.direction === 'asc' ? a.massaId.localeCompare(b.massaId) : b.massaId.localeCompare(a.massaId);
        
        // Disease columns
        const getVal = (r: ScoutRecord) => {
            const f = r.findings.find(x => x.name === sortConfig.key);
            return f ? (f.severity * 10000 + f.count) : 0;
        };
        return sortConfig.direction === 'asc' ? getVal(a) - getVal(b) : getVal(b) - getVal(a);
      });
    }
    return sortableItems;
  }, [records, sortConfig]);

  // Chart Data Preparation
  const severityData = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0 };
    records.forEach(r => {
        let maxSev = 0;
        r.findings.forEach(f => {
            if (f.severity > maxSev) maxSev = f.severity;
        });
        if (maxSev > 0) {
            counts[maxSev as 1|2|3] = (counts[maxSev as 1|2|3] || 0) + 1;
        }
    });

    return [
      { name: 'Safe', value: counts[1], color: '#34d399' },
      { name: 'Treatment', value: counts[2], color: '#fbbf24' },
      { name: 'Critical', value: counts[3], color: '#f87171' },
    ].filter(d => d.value > 0);
  }, [records]);

  const diseaseData = useMemo(() => {
    const counts: Record<string, number> = {};
    records.forEach(r => {
      r.findings.forEach(f => {
          if(f.severity > 0) {
               counts[f.name] = (counts[f.name] || 0) + 1;
          }
      });
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [records]);

  const maxSeverityByDisease = useMemo(() => {
    const maxes: Record<string, number> = {};
    diseases.forEach(d => maxes[d] = 0);
    records.forEach(r => {
      r.findings.forEach(f => {
        if (f.severity > (maxes[f.name] || 0)) {
          maxes[f.name] = f.severity;
        }
      });
    });
    return maxes;
  }, [records, diseases]);

  const handleFileSelect = (ref: React.RefObject<HTMLInputElement | null>, callback: (res: string) => void, successMsg: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
          callback(ev.target?.result as string);
          showToast(successMsg);
      };
      reader.readAsText(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      processFiles(e.target.files);
      e.target.value = ''; // Reset input to allow same file selection
  };

  const LandingHeader = () => (
      <header className="absolute top-0 left-0 w-full z-20 flex justify-between items-center px-6 md:px-10 py-6 md:py-8">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setStep('landing')}>
            <div className="w-10 h-10 flex items-center justify-center bg-emerald-500 rounded-xl shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform duration-300">
                 <Leaf className="w-6 h-6 text-slate-950" strokeWidth={2.5} />
            </div>
            <div>
                 <h1 className="text-xl md:text-2xl font-black text-white tracking-tighter uppercase leading-none drop-shadow-md group-hover:opacity-90 transition-opacity">
                     Agro<span className="text-emerald-400">Vision</span>
                 </h1>
                 <p className="text-[10px] text-white/60 font-bold uppercase tracking-[0.2em]">Pro Tech</p>
            </div>
        </div>
        
        <nav className="hidden md:flex items-center gap-8 bg-black/20 backdrop-blur-md px-8 py-3 rounded-full border border-white/5">
            {['Home', 'About', 'Pricing', 'Contact'].map((item) => {
                const s = item.toLowerCase() as any;
                const isActive = step === (s === 'home' ? 'landing' : s);
                return (
                    <button 
                        key={item}
                        onClick={() => setStep(s === 'home' ? 'landing' : s)} 
                        className={`text-xs font-bold uppercase tracking-widest transition-all ${isActive ? 'text-emerald-400' : 'text-slate-400 hover:text-white'}`}
                    >
                        {item}
                    </button>
                );
            })}
        </nav>
        
        <button onClick={() => setStep('dashboard')} className="hidden md:flex px-6 py-2 rounded-full bg-white text-slate-900 text-xs font-black uppercase tracking-widest hover:bg-emerald-400 hover:text-slate-900 transition-colors">
            Login
        </button>
      </header>
  );

  if (['landing', 'about', 'contact', 'pricing'].includes(step)) {
    return (
      <div className="min-h-screen font-sans relative selection:bg-emerald-400/30 overflow-y-auto">
        <div className="absolute inset-0 z-0 h-full fixed">
             <div className="absolute inset-0 bg-slate-900/40 z-10" />
             <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent z-10" />
             <img 
               src="https://images.unsplash.com/photo-1625246333195-58197bd47d26?q=80&w=2000&auto=format&fit=crop" 
               className="w-full h-full object-cover scale-105"
               alt="Smart Agriculture"
             />
        </div>

        <LandingHeader />

        <div className="relative z-10 container mx-auto px-6 flex flex-col pt-32 pb-20 min-h-screen">
            {step === 'landing' && (
                <div className="flex-1 flex flex-col justify-center items-center text-center max-w-4xl mx-auto space-y-8">
                    <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-500/30 backdrop-blur-md mb-6">
                        <Zap size={16} className="text-emerald-400" fill="currentColor" />
                        <span className="text-emerald-100 text-xs font-bold tracking-widest uppercase">Powered by Gemini 3.0 Pro</span>
                      </div>
                      
                      <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter leading-none drop-shadow-2xl">
                          Precision <br/>
                          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-yellow-400">Agriculture</span>
                      </h1>
                    </div>
                    
                    <p className="text-xl md:text-2xl text-slate-200 font-medium max-w-2xl leading-relaxed drop-shadow-md animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
                        Transform your scout sheets into actionable data. 
                        Detect diseases, analyze severity, and generate treatment protocols in seconds.
                    </p>

                    <div className="flex flex-col md:flex-row gap-4 mt-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
                        <button 
                            onClick={() => setStep('dashboard')}
                            className="group relative px-10 py-5 rounded-full bg-emerald-500 text-slate-950 font-black uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-[0_0_40px_-10px_rgba(16,185,129,0.5)] hover:shadow-[0_0_60px_-15px_rgba(16,185,129,0.6)] hover:scale-105"
                        >
                            Launch App
                            <ChevronRight className="inline-block ml-2 group-hover:translate-x-1 transition-transform" />
                        </button>
                        <button 
                             onClick={() => setStep('about')}
                            className="px-10 py-5 rounded-full border border-white/20 bg-white/5 text-white font-bold uppercase tracking-widest hover:bg-white/10 backdrop-blur-sm transition-all hover:scale-105"
                        >
                            Learn More
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl mt-16 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500">
                        {[
                          { icon: Camera, title: "Instant OCR", desc: "Digitize handwritten sheets" },
                          { icon: BarChart3, title: "Deep Analytics", desc: "Track severity trends" },
                          { icon: FlaskConical, title: "Smart Rx", desc: "Automated treatment plans" }
                        ].map((f, i) => (
                          <div key={i} className="p-6 rounded-2xl bg-slate-900/40 border border-white/10 backdrop-blur-md flex flex-col items-center hover:bg-slate-900/60 transition-colors group">
                              <f.icon className="w-8 h-8 text-emerald-400 mb-3 group-hover:scale-110 transition-transform" />
                              <h3 className="text-white font-bold uppercase tracking-wider text-sm">{f.title}</h3>
                              <p className="text-slate-400 text-xs mt-1">{f.desc}</p>
                          </div>
                        ))}
                    </div>
                </div>
            )}
            
            {step === 'about' && (
              <div className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700">
                  <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter mb-8 text-center uppercase italic">
                      The Future of <br/> <span className="text-emerald-400">Agronomy</span>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                      <div className="space-y-6 text-lg text-slate-300 font-medium leading-relaxed">
                          <p>AgroVision Pro Tech was born from a simple necessity: precision. In the vast fields of modern agriculture, every leaf tells a story, and missing a sign of disease can cost harvest.</p>
                          <p>We leverage Google's Gemini Flash Lite models to process handwritten scout sheets with 99.8% accuracy, translating traditional data collection into real-time digital intelligence.</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div className="p-6 bg-slate-900/50 backdrop-blur-md rounded-3xl border border-white/10">
                              <h4 className="text-4xl font-black text-white mb-2">20k+</h4>
                              <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Sheets Processed</p>
                          </div>
                          <div className="p-6 bg-slate-900/50 backdrop-blur-md rounded-3xl border border-white/10">
                              <h4 className="text-4xl font-black text-white mb-2">99%</h4>
                              <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Accuracy Rate</p>
                          </div>
                          <div className="col-span-2 p-6 bg-emerald-500 rounded-3xl shadow-xl shadow-emerald-500/20">
                              <h4 className="text-4xl font-black text-slate-950 mb-2">24/7</h4>
                              <p className="text-xs font-bold text-slate-900/60 uppercase tracking-widest">AI Availability</p>
                          </div>
                      </div>
                  </div>
              </div>
            )}

            {step === 'pricing' && (
              <div className="flex-1 w-full max-w-6xl mx-auto flex flex-col justify-center animate-in fade-in slide-in-from-bottom-8 duration-700">
                  <div className="text-center mb-16">
                      <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase italic mb-4">Choose Your <span className="text-emerald-400">Power</span></h2>
                      <p className="text-slate-400 font-bold uppercase tracking-widest">Scalable solutions for farms of all sizes</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      {[
                          { name: 'Scout', price: 'Free', features: ['50 Sheets / mo', 'Basic Analytics', 'Standard Support'], color: 'border-white/10 bg-slate-900/50' },
                          { name: 'Agronomist', price: '$49', features: ['Unlimited Sheets', 'Advanced Trends', 'Priority Processing', 'API Access'], color: 'border-emerald-500 bg-emerald-900/20', popular: true },
                          { name: 'Enterprise', price: 'Custom', features: ['Dedicated Server', 'Custom Models', '24/7 Phone Support', 'On-site Training'], color: 'border-white/10 bg-slate-900/50' }
                      ].map((plan, i) => (
                          <div key={i} className={`p-8 rounded-[2.5rem] border backdrop-blur-md flex flex-col relative ${plan.color} ${plan.popular ? 'scale-110 z-10 shadow-2xl shadow-emerald-500/20' : ''}`}>
                              {plan.popular && <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-emerald-500 text-slate-900 font-black px-4 py-1 rounded-full text-xs uppercase tracking-widest">Best Value</div>}
                              <h3 className="text-xl font-black text-white uppercase tracking-widest mb-4">{plan.name}</h3>
                              <div className="text-5xl font-black text-white mb-8">{plan.price}<span className="text-lg text-slate-500 font-bold">/mo</span></div>
                              <ul className="space-y-4 mb-8 flex-1">
                                  {plan.features.map(f => (
                                      <li key={f} className="flex items-center gap-3 text-sm font-bold text-slate-300">
                                          <CheckCircle size={16} className="text-emerald-400" /> {f}
                                      </li>
                                  ))}
                              </ul>
                              <button className={`w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all ${plan.popular ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-900' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
                                  Get Started
                              </button>
                          </div>
                      ))}
                  </div>
              </div>
            )}

            {step === 'contact' && (
              <div className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full animate-in fade-in slide-in-from-bottom-8 duration-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12 w-full">
                      <div className="space-y-8">
                          <div>
                              <h2 className="text-5xl font-black text-white tracking-tighter uppercase italic mb-2">Get in <span className="text-emerald-400">Touch</span></h2>
                              <p className="text-slate-400 font-medium text-lg">Have a question or need a custom integration? We are here to help.</p>
                          </div>
                          <div className="space-y-6">
                              <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400"><Mail /></div>
                                  <div>
                                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Email Us</p>
                                      <p className="text-white font-bold">support@agrovision.pro</p>
                                  </div>
                              </div>
                              <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400"><MapPin /></div>
                                  <div>
                                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">HQ</p>
                                      <p className="text-white font-bold">San Francisco, CA</p>
                                  </div>
                              </div>
                          </div>
                      </div>
                      <div className="p-8 rounded-[2.5rem] bg-slate-900/50 backdrop-blur-md border border-white/10">
                          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); alert('Message sent!'); }}>
                              <div className="space-y-2">
                                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Name</label>
                                  <input type="text" className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white font-bold outline-none focus:border-emerald-500 transition-colors" placeholder="John Doe" />
                              </div>
                              <div className="space-y-2">
                                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Email</label>
                                  <input type="email" className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white font-bold outline-none focus:border-emerald-500 transition-colors" placeholder="john@farm.com" />
                              </div>
                              <div className="space-y-2">
                                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Message</label>
                                  <textarea rows={4} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white font-medium outline-none focus:border-emerald-500 transition-colors resize-none" placeholder="How can we help?"></textarea>
                              </div>
                              <button className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black uppercase tracking-widest rounded-xl transition-all">Send Message</button>
                          </form>
                      </div>
                  </div>
              </div>
            )}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${t('bg-[#020617] text-slate-200', 'bg-slate-50 text-slate-900')}`}>
      {/* Hidden Inputs */}
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" multiple />
      <input type="file" ref={csvInputRef} onChange={handleFileSelect(csvInputRef, (c) => {setParcelPlan(c); localStorage.setItem('scout_ai_plan', c); setIsReferenceOpen(false);}, "Plan de parcelle loaded successfully")} className="hidden" accept=".csv,.txt" />
      <input type="file" ref={historyInputRef} onChange={handleFileSelect(historyInputRef, (c) => {setTreatmentHistoryCSV(c); localStorage.setItem('scout_ai_history', c);}, "History loaded successfully")} className="hidden" accept=".csv,.txt" />
      <input type="file" ref={productsInputRef} onChange={handleFileSelect(productsInputRef, (c) => {setHomologatedProducts(c); localStorage.setItem('scout_ai_products', c);}, "Products list loaded successfully")} className="hidden" accept=".csv,.txt" />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-6 right-6 z-[120] animate-in slide-in-from-right-10 fade-in duration-300">
            <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border ${t('bg-[#1E293B] border-emerald-500/20 text-white', 'bg-white border-emerald-100 text-slate-900')}`}>
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                    <Check size={18} strokeWidth={3} />
                </div>
                <div>
                    <h4 className="text-sm font-black uppercase tracking-wide">Success</h4>
                    <p className="text-xs font-medium text-slate-500">{toast.message}</p>
                </div>
            </div>
        </div>
      )}

      <div className="flex h-screen overflow-hidden">
        
        {/* Sidebar */}
        <aside className={`w-20 flex flex-col items-center py-6 z-50 transition-all ${t('bg-[#0F172A] border-r border-white/5', 'bg-white border-r border-slate-200 shadow-xl')}`}>
          <div className="mb-8 cursor-pointer" onClick={() => setStep('landing')}>
            <div className="w-10 h-10 bg-gradient-to-tr from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Leaf className={`w-6 h-6 ${t('text-slate-950', 'text-white')}`} />
            </div>
          </div>

          <nav className="flex flex-col gap-4 w-full px-3">
            <button onClick={() => setStep('dashboard')} className={`w-full aspect-square flex items-center justify-center rounded-xl transition-all group relative ${step === 'dashboard' ? t('bg-white/10 text-emerald-400', 'bg-slate-100 text-emerald-600') : t('text-slate-500 hover:bg-white/5 hover:text-white', 'text-slate-400 hover:bg-slate-50 hover:text-slate-900')}`}>
               <LayoutDashboard size={20} strokeWidth={step === 'dashboard' ? 2.5 : 2} />
            </button>
            <button onClick={() => setStep('upload')} className={`w-full aspect-square flex items-center justify-center rounded-xl transition-all group shadow-lg hover:scale-105 ${step === 'upload' ? 'bg-emerald-600' : 'bg-emerald-500'}`}>
                 <Plus size={24} className="text-white" strokeWidth={3} />
            </button>
            <div className={`w-full h-px my-1 ${t('bg-white/10', 'bg-slate-200')}`} />
            <button onClick={() => setStep('results')} className={`w-full aspect-square flex items-center justify-center rounded-xl transition-all group relative ${step === 'results' ? t('bg-white/10 text-emerald-400', 'bg-slate-100 text-emerald-600') : t('text-slate-500 hover:bg-white/5 hover:text-white', 'text-slate-400 hover:bg-slate-50 hover:text-slate-900')}`}>
               <ClipboardList size={20} strokeWidth={step === 'results' ? 2.5 : 2} />
            </button>
            <button onClick={() => setStep('treatment')} className={`w-full aspect-square flex items-center justify-center rounded-xl transition-all group relative ${step === 'treatment' ? t('bg-white/10 text-emerald-400', 'bg-slate-100 text-emerald-600') : t('text-slate-500 hover:bg-white/5 hover:text-white', 'text-slate-400 hover:bg-slate-50 hover:text-slate-900')}`}>
               <FlaskConical size={20} strokeWidth={step === 'treatment' ? 2.5 : 2} />
            </button>
             <button onClick={() => setStep('matrix')} className={`w-full aspect-square flex items-center justify-center rounded-xl transition-all group relative ${step === 'matrix' ? t('bg-white/10 text-emerald-400', 'bg-slate-100 text-emerald-600') : t('text-slate-500 hover:bg-white/5 hover:text-white', 'text-slate-400 hover:bg-slate-50 hover:text-slate-900')}`}>
               <SlidersHorizontal size={20} strokeWidth={step === 'matrix' ? 2.5 : 2} />
            </button>
            <div className={`w-full h-px my-1 ${t('bg-white/10', 'bg-slate-200')}`} />
            <button onClick={() => setIsReferenceOpen(true)} className={`w-full aspect-square flex items-center justify-center rounded-xl transition-all group ${t('text-slate-500 hover:bg-white/5 hover:text-white', 'text-slate-400 hover:bg-slate-50 hover:text-slate-900')}`}><FileSpreadsheet size={20} className="text-blue-400" /></button>
            <button onClick={() => setIsSettingsOpen(true)} className={`w-full aspect-square flex items-center justify-center rounded-xl transition-all group ${t('text-slate-500 hover:bg-white/5 hover:text-white', 'text-slate-400 hover:bg-slate-50 hover:text-slate-900')}`}><Settings size={20} className="group-hover:rotate-90 transition-transform duration-500" /></button>
          </nav>
        </aside>

        {/* Main Workspace */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          
          <header className={`h-24 flex items-center justify-between px-10 transition-colors ${t('bg-[#0F172A] border-b border-white/5', 'bg-white border-b border-slate-200')}`}>
            <div>
               <h1 className={`text-2xl font-black tracking-tight uppercase italic ${t('text-white', 'text-slate-900')}`}>
                 {step === 'dashboard' ? 'Dashboard Analytics' : 
                  step === 'results' ? 'Results Analytics' :
                  step === 'treatment' ? 'Treatment Generator' :
                  step === 'matrix' ? 'Protocol Matrix' :
                  step === 'analyzing' ? 'Processing' :
                  step.toUpperCase()}
               </h1>
            </div>

            <div className="flex items-center gap-6">
              {/* Global Undo/Redo */}
              <div className="flex gap-2">
                 <button onClick={handleUndo} disabled={historyStack.past.length === 0} className="p-3 rounded-xl bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-all" title="Undo"><Undo size={18}/></button>
                 <button onClick={handleRedo} disabled={historyStack.future.length === 0} className="p-3 rounded-xl bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-all" title="Redo"><Redo size={18}/></button>
              </div>

              <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-3 rounded-xl transition-all border ${t('bg-white/5 border-white/5 hover:bg-white/10 text-slate-400 hover:text-white', 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-900')}`}>
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>

              <div className={`p-2 pr-5 rounded-2xl border flex items-center gap-4 ${t('bg-[#1E293B] border-white/5', 'bg-slate-100 border-slate-200')}`}>
                <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center font-black text-slate-950 text-xs shadow-lg shadow-emerald-500/20">LIVE</div>
                <div className="hidden sm:block text-left">
                  <p className={`text-xs font-black leading-none uppercase tracking-tighter ${t('text-white', 'text-slate-900')}`}>Technician Hub</p>
                  <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest mt-1">Connected</p>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-10 scrollbar-hide pb-20">
            {step === 'dashboard' && (
              <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className={`p-6 rounded-[2.5rem] relative overflow-hidden group transition-all hover:scale-[1.02] ${t('bg-[#1E293B] border border-white/5', 'bg-gradient-to-br from-slate-100 to-slate-200 shadow-xl')}`}>
                    <div className={`absolute top-0 right-0 p-6 opacity-10 transition-transform group-hover:scale-125 ${t('text-white', 'text-slate-900')}`}><LayoutDashboard size={100} /></div>
                    <p className={`text-xs font-black uppercase tracking-widest mb-2 ${t('text-slate-500', 'text-slate-500')}`}>Total Sheets</p>
                    <h3 className={`text-5xl font-black italic ${t('text-white', 'text-slate-900')}`}>{records.length}</h3>
                  </div>
                  <div className={`p-6 rounded-[2.5rem] relative overflow-hidden group transition-all hover:scale-[1.02] ${t('bg-[#1E293B] border border-white/5', 'bg-gradient-to-br from-slate-100 to-slate-200 shadow-xl')}`}>
                     <div className="absolute top-0 right-0 p-6 opacity-10 text-red-500 transition-transform group-hover:scale-125"><AlertTriangle size={100} /></div>
                    <p className={`text-xs font-black uppercase tracking-widest mb-2 ${t('text-slate-500', 'text-slate-500')}`}>Hazard Hotspots</p>
                    <h3 className="text-5xl font-black text-red-500 italic">{records.reduce((acc, r) => acc + (r.findings.some(f => f.severity === 3) ? 1 : 0), 0)}</h3>
                  </div>
                  <button onClick={() => setStep('upload')} className="bg-[#00C48C] p-6 rounded-[2.5rem] shadow-xl shadow-emerald-500/20 transition-all hover:scale-[1.02] text-left relative overflow-hidden group h-full">
                     <div className="absolute top-1/2 -translate-y-1/2 right-4 opacity-20 text-black transition-transform group-hover:scale-125 group-hover:rotate-12"><Camera size={100} /></div>
                    <p className="text-xs font-black text-black/60 uppercase tracking-widest mb-2">Start Extraction</p>
                    <h3 className="text-4xl font-black text-black italic uppercase leading-none">Scout Suivi</h3>
                  </button>
                </div>
                {records.length > 0 && (
                    <div className="space-y-8">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className={`p-8 rounded-[2.5rem] border shadow-2xl ${t('bg-[#0F172A] border-white/5', 'bg-white border-slate-100')}`}>
                                <h3 className={`text-xl font-black italic uppercase mb-6 ${t('text-white', 'text-slate-900')}`}>Severity Overview</h3>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={severityData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                                {severityData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} stroke="none" />))}
                                            </Pie>
                                            <RechartsTooltip contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderColor: isDarkMode ? '#334155' : '#e2e8f0', borderRadius: '12px', color: isDarkMode ? '#fff' : '#0f172a', fontWeight: 'bold'}} itemStyle={{ color: isDarkMode ? '#fff' : '#0f172a' }}/>
                                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div className={`p-8 rounded-[2.5rem] border shadow-2xl ${t('bg-[#0F172A] border-white/5', 'bg-white border-slate-100')}`}>
                                <h3 className={`text-xl font-black italic uppercase mb-6 ${t('text-white', 'text-slate-900')}`}>Top Disease Prevalence</h3>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={diseaseData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDarkMode ? '#334155' : '#e2e8f0'} />
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12, fontWeight: 'bold' }} width={60} axisLine={false} tickLine={false} />
                                            <RechartsTooltip cursor={{fill: isDarkMode ? '#ffffff10' : '#00000005'}} contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderColor: isDarkMode ? '#334155' : '#e2e8f0', borderRadius: '12px', color: isDarkMode ? '#fff' : '#0f172a', fontWeight: 'bold' }}/>
                                            <Bar dataKey="value" fill="#3b82f6" radius={[0, 10, 10, 0]} barSize={20} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
              </div>
            )}

            {step === 'upload' && (
              <div 
                className="max-w-4xl mx-auto py-20 animate-in zoom-in duration-500"
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); processFiles(e.dataTransfer.files); }}
              >
                <div className={`border-4 border-dashed rounded-[4rem] p-24 text-center transition-all group relative overflow-hidden ${isDragging ? 'border-emerald-500 bg-emerald-500/10' : t('bg-[#0F172A] border-white/5 hover:border-emerald-500/30', 'bg-white border-slate-200 hover:border-emerald-500/30 shadow-2xl')}`}>
                  <UploadCloud size={64} className="mx-auto mb-8 text-emerald-500" />
                  <h2 className={`text-4xl font-black mb-4 tracking-tighter italic uppercase ${t('text-white', 'text-slate-900')}`}>Neural Area Ingestion</h2>
                  <p className="text-slate-500 mb-12 max-w-sm mx-auto font-bold text-lg leading-snug">Drop your scout sheet. AI targets blue "sev" columns.</p>
                  <button onClick={() => fileInputRef.current?.click()} className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-8 py-6 rounded-[2rem] shadow-2xl transition-all uppercase italic text-xl flex items-center justify-center gap-4 hover:scale-105 mx-auto">
                      <Camera size={24} /> SELECT SCOUT IMAGE(S)
                  </button>
                  <p className="text-xs font-bold uppercase text-slate-500 mt-4 tracking-widest">Supports Batch Upload</p>
                </div>
              </div>
            )}
            
            {step === 'preview' && (
              <div className="max-w-7xl mx-auto py-10 space-y-8 animate-in slide-in-from-bottom-10">
                <div className="flex items-center justify-between">
                  <div>
                      <h2 className={`text-3xl font-black italic uppercase ${t('text-white', 'text-slate-900')}`}>Batch Verification</h2>
                      <p className="text-slate-500 font-bold uppercase text-sm mt-1">{pendingImages.length} Sheets Queued for Analysis</p>
                  </div>
                  <button onClick={() => setStep('upload')} className="p-3 bg-red-500/10 text-red-500 rounded-full hover:bg-red-500/20 transition-all"><X size={24} /></button>
                </div>
                {errorMessage && (
                  <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-3xl flex items-center gap-4 text-red-400"><AlertCircle size={24} /><p className="font-bold italic uppercase">{errorMessage}</p></div>
                )}
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {pendingImages.map((img, idx) => (
                        <div key={img.id} className={`aspect-[3/4] rounded-3xl border shadow-xl relative overflow-hidden group ${t('bg-[#0F172A] border-white/5', 'bg-white border-slate-200')}`}>
                            <img src={img.data} className="w-full h-full object-cover transition-transform group-hover:scale-105 brightness-90 group-hover:brightness-100" />
                            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-white text-xs font-black">#{idx + 1}</div>
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                                <p className="text-white text-xs font-bold truncate">{img.name}</p>
                            </div>
                        </div>
                    ))}
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className={`aspect-[3/4] rounded-3xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${t('border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/5', 'border-slate-200 hover:border-emerald-500/50 hover:bg-emerald-500/5')}`}
                    >
                        <PlusCircle className="text-emerald-500 mb-2" size={32} />
                        <span className="text-xs font-black uppercase text-slate-500">Add More</span>
                    </div>
                </div>

                <button onClick={analyzeScoutImages} className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-8 rounded-[2rem] shadow-2xl transition-all uppercase italic text-2xl flex items-center justify-center gap-6 group">
                  <Zap size={32} className="group-hover:text-white transition-colors" /> 
                  EXTRACT DATA FROM {pendingImages.length} SHEETS
                </button>
              </div>
            )}

            {step === 'analyzing' && (
              <div className="flex-1 flex flex-col items-center justify-center h-full relative overflow-hidden">
                {/* Background effects */}
                <div className="absolute inset-0 bg-[#020617] z-0">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/20 rounded-full blur-[100px] animate-pulse" />
                </div>
                
                <div className="z-10 text-center space-y-8 max-w-xl w-full">
                    <div className="relative w-32 h-32 mx-auto">
                         <div className="absolute inset-0 border-4 border-emerald-500/30 rounded-full animate-[spin_3s_linear_infinite]" />
                         <div className="absolute inset-2 border-4 border-t-emerald-400 border-r-transparent border-b-emerald-400 border-l-transparent rounded-full animate-[spin_1.5s_linear_infinite]" />
                         <div className="absolute inset-0 flex items-center justify-center">
                             <Zap className="text-emerald-400 w-12 h-12 animate-pulse" fill="currentColor" />
                         </div>
                    </div>
                    
                    <div>
                        <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-2">Neural Analysis Active</h2>
                        <p className="text-emerald-400 font-bold uppercase tracking-widest text-sm">Processing Sheet {analysisProgress?.current} of {analysisProgress?.total}</p>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-white/10">
                        <div 
                            className="h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all duration-500 ease-out"
                            style={{ width: `${((analysisProgress?.current || 0) / (analysisProgress?.total || 1)) * 100}%` }}
                        />
                    </div>

                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
                         <p className="text-slate-400 text-xs font-mono">{analysisProgress?.currentFile || 'Initializing...'}</p>
                    </div>
                </div>
              </div>
            )}

            {step === 'results' && (
                <div className="max-w-[95vw] mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
                    <div className="flex items-center justify-between">
                        <div>
                             <h2 className={`text-4xl font-black italic uppercase tracking-tighter ${t('text-white', 'text-slate-900')}`}>Scout Results</h2>
                             {isGeneratingPlan && (
                                <div className="flex items-center gap-2 mt-2">
                                     <Loader2 size={16} className="animate-spin text-emerald-500"/>
                                     <p className="text-emerald-500 font-bold uppercase text-xs tracking-widest animate-pulse">Analyzing Data & Generating Plan...</p>
                                </div>
                             )}
                        </div>
                        <div className="flex gap-4">
                             {selectedRecordIds.size > 0 && (
                                <button onClick={handleBulkDelete} className="bg-red-500 hover:bg-red-400 text-white font-black px-6 py-3 rounded-xl uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-red-500/20">
                                    <Trash2 size={18} /> Delete ({selectedRecordIds.size})
                                </button>
                             )}
                             <button 
                                onClick={generateTreatmentPlan} 
                                disabled={isGeneratingPlan}
                                className={`bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-6 py-3 rounded-xl uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 ${isGeneratingPlan ? 'opacity-50 cursor-not-allowed' : ''}`}
                             >
                                {isGeneratingPlan ? <Loader2 size={18} className="animate-spin"/> : <FlaskConical size={18} />} 
                                {isGeneratingPlan ? 'Processing...' : 'Generate Plan'}
                             </button>
                        </div>
                    </div>
                    
                    {/* Error Report Section */}
                    {processingErrors.length > 0 && (
                        <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-3xl space-y-4 animate-in slide-in-from-top-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 text-red-400">
                                    <AlertTriangle size={24} />
                                    <h3 className="text-xl font-black uppercase italic">Analysis Errors ({processingErrors.length})</h3>
                                </div>
                                <button onClick={() => setProcessingErrors([])}><X className="text-red-400/50 hover:text-red-400" /></button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {processingErrors.map((err, idx) => (
                                    <div key={idx} className="bg-red-500/10 p-4 rounded-xl border border-red-500/10">
                                        <div className="text-xs font-black uppercase text-red-400 mb-1 flex items-center gap-2">
                                            <AlertCircle size={12} /> {err.name}
                                        </div>
                                        <div className="text-sm text-red-300 font-medium">{err.message}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    <div className={`rounded-[2.5rem] border overflow-hidden shadow-2xl relative ${t('bg-[#0F172A] border-white/5', 'bg-white border-slate-200')}`}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className={t('bg-white/5', 'bg-slate-50')}>
                                    <tr>
                                        <th className="p-4 w-12 text-center">
                                            <button onClick={() => {if (selectedRecordIds.size === records.length) setSelectedRecordIds(new Set()); else setSelectedRecordIds(new Set(records.map(r => r.id)));}}>
                                                {selectedRecordIds.size === records.length && records.length > 0 ? <CheckSquare className="text-emerald-500" /> : <Square className="text-slate-500" />}
                                            </button>
                                        </th>
                                        <th className="p-4 text-xs font-black uppercase text-slate-500 cursor-pointer hover:text-emerald-500 transition-colors" onClick={() => handleSort('blocId')}>Bloc</th>
                                        <th className="p-4 text-xs font-black uppercase text-slate-500 cursor-pointer hover:text-emerald-500 transition-colors" onClick={() => handleSort('massaId')}>Massa</th>
                                        {diseases.map(d => (
                                            <th key={d} className="p-4 text-center align-top relative min-w-[120px]">
                                                <div className="flex flex-col items-center gap-2 group/header">
                                                    <span onClick={() => handleSort(d)} className="text-xs font-black uppercase text-slate-500 cursor-pointer hover:text-emerald-500 transition-colors select-none py-1 border-b-2 border-transparent hover:border-emerald-500">
                                                        {d.slice(0, 4)}
                                                    </span>
                                                </div>
                                            </th>
                                        ))}
                                        <th className="p-4 text-xs font-black uppercase text-slate-500 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className={`divide-y ${t('divide-white/5', 'divide-slate-200')}`}>
                                    {records.length > 0 && (
                                        <tr className={`${t('bg-white/5', 'bg-slate-100')} font-bold`}>
                                            <td className="p-4 text-center"><BarChart3 size={18} className="mx-auto text-slate-500" /></td>
                                            <td className="p-4 text-xs font-black uppercase text-slate-500 tracking-widest" colSpan={2}>MAX SEVERITY</td>
                                            {diseases.map(d => {
                                                const sev = maxSeverityByDisease[d] as SeverityLevel || 0;
                                                const config = SEVERITY_CONFIG[sev];
                                                return (<td key={`max-${d}`} className="p-2 text-center"><div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border text-xs font-black ${isDarkMode ? config.color : config.dayColor} ${config.bg} ${config.border}`}>{sev}</div></td>);
                                            })}
                                            <td className="p-4"></td>
                                        </tr>
                                    )}

                                    {sortedRecords.map(record => (
                                        <tr key={record.id} className={`group transition-all ${t('hover:bg-white/5', 'hover:bg-slate-50')} ${selectedRecordIds.has(record.id) ? 'bg-emerald-500/5' : ''}`}>
                                            <td className="p-4 text-center">
                                                <button onClick={() => { const newSet = new Set(selectedRecordIds); if (newSet.has(record.id)) newSet.delete(record.id); else newSet.add(record.id); setSelectedRecordIds(newSet); }}>
                                                    {selectedRecordIds.has(record.id) ? <CheckSquare className="text-emerald-500" size={18} /> : <Square className="text-slate-500" size={18} />}
                                                </button>
                                            </td>
                                            <td className={`p-4 font-bold ${t('text-white', 'text-slate-900')}`}>{record.blocId}</td>
                                            <td className="p-4 text-slate-400 font-medium">{record.massaId}</td>
                                            {diseases.map(d => {
                                                const f = record.findings.find(finding => finding.name === d);
                                                if (!f) return <td key={d} className="p-2 text-center text-slate-500">-</td>;
                                                const config = SEVERITY_CONFIG[f.severity];
                                                return (<td key={f.name} className="p-2 text-center"><div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border text-xs font-black ${isDarkMode ? config.color : config.dayColor} ${config.bg} ${config.border}`}>{f.severity}</div></td>);
                                            })}
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => startEditingRecord(record)} className="p-2 hover:bg-blue-500/10 rounded-lg text-blue-400 transition-colors"><Pencil size={16}/></button>
                                                    <button onClick={() => { if(window.confirm('Delete record?')) { saveToHistory(); setRecords(prev => prev.filter(r => r.id !== record.id)); } }} className="p-2 hover:bg-red-500/10 rounded-lg text-red-400 transition-colors"><Trash2 size={16}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {step === 'matrix' && (
                <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in">
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                         <div className={`p-8 rounded-[2.5rem] border ${t('bg-[#1E293B] border-white/5', 'bg-white border-slate-200 shadow-xl')}`}>
                             <h3 className={`text-xl font-black italic uppercase mb-6 ${t('text-white', 'text-slate-900')}`}>Add New Protocol</h3>
                             <div className="space-y-4">
                                 <div className="space-y-2">
                                     <label className="text-xs font-bold uppercase text-slate-500">Disease Name</label>
                                     <input type="text" value={newDiseaseName} onChange={(e) => setNewDiseaseName(e.target.value)} className={`w-full bg-transparent border-b p-3 font-bold outline-none ${t('border-white/10 text-white focus:border-emerald-500', 'border-slate-200 text-slate-900 focus:border-emerald-500')}`} placeholder="e.g. Mildew" />
                                 </div>
                                 <div className="grid grid-cols-2 gap-4">
                                     <div className="space-y-2">
                                         <label className="text-xs font-bold uppercase text-amber-500">L2 Threshold</label>
                                         <input type="number" value={newL2Threshold} onChange={(e) => setNewL2Threshold(e.target.value)} className={`w-full bg-transparent border-b p-3 font-bold outline-none ${t('border-white/10 text-white focus:border-emerald-500', 'border-slate-200 text-slate-900 focus:border-emerald-500')}`} placeholder="2" />
                                     </div>
                                     <div className="space-y-2">
                                         <label className="text-xs font-bold uppercase text-red-500">L3 Threshold</label>
                                         <input type="number" value={newL3Threshold} onChange={(e) => setNewL3Threshold(e.target.value)} className={`w-full bg-transparent border-b p-3 font-bold outline-none ${t('border-white/10 text-white focus:border-emerald-500', 'border-slate-200 text-slate-900 focus:border-emerald-500')}`} placeholder="3" />
                                     </div>
                                 </div>
                                 <button onClick={handleAddDisease} className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl uppercase tracking-widest transition-all mt-4">Add Definition</button>
                             </div>
                         </div>
                         
                         <div className={`p-8 rounded-[2.5rem] border flex flex-col justify-center items-center text-center ${t('bg-[#1E293B] border-white/5', 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-xl')}`}>
                              <ShieldCheck size={64} className="mb-4 text-emerald-300" />
                              <h3 className="text-2xl font-black italic uppercase mb-2">Protocol Standards</h3>
                              <p className="opacity-80 font-medium max-w-sm">Define the thresholds that trigger automated treatment responses. These rules guide the AI decision engine.</p>
                         </div>
                     </div>

                     <h3 className={`text-2xl font-black italic uppercase mb-6 ${t('text-white', 'text-slate-900')}`}>Active Definitions</h3>
                     <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                         {diseases.map(d => {
                             const rule = severityRules[d] || { level2: 2, level3: 3 };
                             return (
                                 <div key={d} onClick={() => setEditingProtocol({ originalName: d, name: d, level2: rule.level2, level3: rule.level3 })} className={`p-6 rounded-3xl border cursor-pointer transition-all hover:scale-105 group relative ${t('bg-[#1E293B] border-white/5 hover:border-emerald-500/50', 'bg-white border-slate-200 hover:border-emerald-500/50 shadow-lg')}`}>
                                     <div className="flex justify-between items-start mb-4">
                                         <div className="w-10 h-10 rounded-xl bg-slate-500/10 flex items-center justify-center font-black text-lg uppercase">{d.slice(0,2)}</div>
                                         <button onClick={(e) => handleDeleteDisease(e, d)} className="opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 size={16} /></button>
                                     </div>
                                     <h4 className={`text-lg font-black uppercase tracking-wide mb-4 ${t('text-white', 'text-slate-900')}`}>{d}</h4>
                                     <div className="space-y-2">
                                         <div className="flex justify-between items-center text-xs font-bold">
                                             <span className="text-amber-500">Treatment (L2)</span>
                                             <span className={`px-2 py-1 rounded-md bg-amber-500/10 ${t('text-amber-400', 'text-amber-600')}`}>≥ {rule.level2}</span>
                                         </div>
                                         <div className="flex justify-between items-center text-xs font-bold">
                                             <span className="text-red-500">Critical (L3)</span>
                                             <span className={`px-2 py-1 rounded-md bg-red-500/10 ${t('text-red-400', 'text-red-600')}`}>≥ {rule.level3}</span>
                                         </div>
                                     </div>
                                 </div>
                             );
                         })}
                     </div>
                </div>
            )}

            {step === 'treatment' && (
               <div className="max-w-7xl mx-auto pb-20 animate-in fade-in">
                   {treatmentPlan.length === 0 ? (
                       <div className="flex flex-col items-center justify-center py-20 text-center">
                           <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center mb-6">
                               <FlaskConical size={48} className="text-slate-600" />
                           </div>
                           <h3 className={`text-2xl font-black uppercase italic ${t('text-white', 'text-slate-900')}`}>No Active Plan</h3>
                           <p className="text-slate-500 font-bold mt-2">Select records in "Results" and click "Generate Plan"</p>
                           <button onClick={() => setStep('results')} className="mt-8 px-8 py-3 bg-emerald-500 text-slate-950 font-black rounded-xl uppercase tracking-widest hover:bg-emerald-400 transition-colors">Go to Results</button>
                       </div>
                   ) : (
                       <div className="space-y-8">
                           <div className="flex justify-between items-center">
                                <h2 className={`text-4xl font-black italic uppercase ${t('text-white', 'text-slate-900')}`}>Treatment Program</h2>
                                <div className="flex gap-2">
                                    <button onClick={handleArchiveCompleted} className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-6 py-3 rounded-xl uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20">
                                        <Archive size={18} /> Archive Completed
                                    </button>
                                    <button onClick={() => window.print()} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 transition-colors"><UploadCloud size={20} /></button>
                                </div>
                           </div>
                           
                           <div className="flex items-center gap-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                               <History className="text-blue-400" />
                               <div>
                                   <p className="text-xs font-bold text-blue-400 uppercase">Context Aware AI</p>
                                   <p className="text-sm font-medium text-slate-400">Plan generated considering {digitalHistory.length} historical treatments and CSV data.</p>
                               </div>
                           </div>

                           <div className="grid grid-cols-1 gap-4">
                               {treatmentPlan.map((action, idx) => (
                                   <div key={action.id} className={`p-6 rounded-3xl border flex flex-col md:flex-row gap-6 relative group transition-all ${t('bg-[#1E293B] border-white/5 hover:border-emerald-500/30', 'bg-white border-slate-200 shadow-lg')}`}>
                                       <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => startEditingAction(action)} className="p-2 bg-blue-500/10 text-blue-400 rounded-lg"><Pencil size={16} /></button>
                                            <button onClick={(e) => handleDeleteAction(e, action.id)} className="p-2 bg-red-500/10 text-red-400 rounded-lg"><Trash2 size={16} /></button>
                                       </div>

                                       <div className="flex-shrink-0 flex flex-col items-center justify-center w-24 border-r border-dashed border-slate-500/20 pr-6">
                                           <div className={`text-3xl font-black italic ${t('text-white', 'text-slate-900')}`}>{idx + 1 < 10 ? `0${idx+1}` : idx+1}</div>
                                           <div className="text-[10px] font-bold uppercase text-slate-500 tracking-widest mt-1">SEQ</div>
                                       </div>

                                       <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-6 items-center">
                                           <div>
                                               <p className="text-[10px] font-bold uppercase text-slate-500 tracking-widest mb-1">Target</p>
                                               <div className="flex items-center gap-2">
                                                   <span className="font-black text-xl text-red-400">{action.disease}</span>
                                                   <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-800 text-slate-400">SEV {action.severity}</span>
                                               </div>
                                               <p className={`text-sm font-bold mt-1 ${t('text-slate-300', 'text-slate-700')}`}>Bloc {action.blocId}</p>
                                           </div>

                                           <div>
                                               <p className="text-[10px] font-bold uppercase text-slate-500 tracking-widest mb-1">Product</p>
                                               <p className={`font-black text-lg ${t('text-white', 'text-slate-900')}`}>{action.product}</p>
                                               <p className="text-xs text-slate-500 font-bold">{action.activeIngredient}</p>
                                           </div>

                                           <div>
                                               <p className="text-[10px] font-bold uppercase text-slate-500 tracking-widest mb-1">Dosage</p>
                                               <p className={`font-black text-lg ${t('text-white', 'text-slate-900')}`}>{action.dosage} <span className="text-sm text-slate-500">{action.unit}</span></p>
                                           </div>
                                            
                                           <div className="flex flex-col items-end gap-2">
                                               <div onClick={() => handleToggleStatus(action.id)} className={`cursor-pointer px-4 py-2 rounded-xl flex items-center gap-2 font-bold uppercase text-xs tracking-wide transition-colors ${action.status === 'completed' ? 'bg-emerald-500 text-slate-900' : 'bg-slate-700 text-slate-400'}`}>
                                                    {action.status === 'completed' ? <CheckCircle size={16} /> : <Circle size={16} />}
                                                    {action.status}
                                               </div>
                                           </div>
                                       </div>
                                       
                                       <div className="w-full md:w-auto md:border-l border-dashed border-slate-500/20 md:pl-6 flex flex-col justify-center">
                                           <p className="text-[10px] font-bold uppercase text-slate-500 tracking-widest mb-1">Rationale</p>
                                           <p className="text-xs text-slate-400 font-medium italic max-w-xs leading-relaxed">"{action.reasoning}"</p>
                                       </div>
                                   </div>
                               ))}
                           </div>
                       </div>
                   )}
               </div>
            )}
          </main>
        </div>
      </div>
      
      <style>{` .scrollbar-hide::-webkit-scrollbar { display: none; } .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; } `}</style>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-black/60 animate-in fade-in">
          <div className={`w-full max-w-4xl rounded-[3rem] p-10 max-h-[85vh] overflow-y-auto ${t('bg-[#0F172A] border border-white/10', 'bg-white shadow-2xl')}`}>
             <div className="flex justify-between items-center mb-8">
                <h2 className={`text-3xl font-black italic uppercase ${t('text-white', 'text-slate-900')}`}>Settings</h2>
                <button onClick={() => setIsSettingsOpen(false)}><X className="text-slate-500" /></button>
             </div>
             <div className="space-y-12">
                {/* File Management */}
                <div className="space-y-4">
                     <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2"><UploadCloud size={16} /> Data Sources</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-6 rounded-2xl border border-dashed border-slate-500/20">
                            <h3 className="text-sm font-bold text-emerald-400 mb-2 uppercase tracking-wide">History File</h3>
                            <button onClick={() => historyInputRef.current?.click()} className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors">
                                {treatmentHistoryCSV ? 'Update CSV' : 'Upload CSV'}
                            </button>
                        </div>
                        <div className="p-6 rounded-2xl border border-dashed border-slate-500/20">
                            <h3 className="text-sm font-bold text-purple-400 mb-2 uppercase tracking-wide">Products List</h3>
                            <div className="flex gap-4 items-center">
                                <button onClick={() => productsInputRef.current?.click()} className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors">
                                    {homologatedProducts ? 'Update CSV' : 'Upload CSV'}
                                </button>
                                <span className="text-slate-600">|</span>
                                <button onClick={handleLoadDemoProducts} className="text-xs font-bold uppercase tracking-widest text-emerald-500 hover:text-emerald-400 transition-colors">
                                    Load Demo
                                </button>
                            </div>
                        </div>
                        <div className="p-6 rounded-2xl border border-dashed border-slate-500/20 md:col-span-2">
                            <h3 className="text-sm font-bold text-blue-400 mb-2 uppercase tracking-wide">Parcel Plan (Blocs & Massas)</h3>
                            <button onClick={() => csvInputRef.current?.click()} className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors">
                                {parcelPlan ? 'Update Reference' : 'Upload CSV Reference'}
                            </button>
                        </div>
                         <div className="p-6 rounded-2xl border border-dashed border-slate-500/20 md:col-span-2">
                            <h3 className="text-sm font-bold text-orange-400 mb-2 uppercase tracking-wide">Target Harvest Date (DAR/PHI)</h3>
                            <div className="flex gap-4">
                                <input 
                                    type="date" 
                                    value={harvestDate} 
                                    onChange={(e) => {
                                        setHarvestDate(e.target.value);
                                        localStorage.setItem('scout_ai_harvest_date', e.target.value);
                                    }}
                                    className={`w-full bg-transparent border-b p-3 font-bold outline-none ${t('border-white/10 text-white', 'border-slate-200 text-slate-900')}`} 
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Digital History Manager */}
                <div className="space-y-6 pt-6 border-t border-slate-500/20">
                     <div className="flex justify-between items-center">
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2"><Database size={16} /> Digital Treatment History</h3>
                        <p className="text-xs font-bold text-slate-500">{digitalHistory.length} Records</p>
                     </div>
                     
                     <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                         {/* Manual Entry Form */}
                         <div className={`p-6 rounded-3xl border ${t('bg-white/5 border-white/5', 'bg-slate-50 border-slate-200')}`}>
                             <h4 className={`text-lg font-black italic uppercase mb-4 ${t('text-white', 'text-slate-900')}`}>Add Manual Record</h4>
                             <div className="space-y-4">
                                 <div>
                                     <label className="text-[10px] font-bold uppercase text-slate-500">Date</label>
                                     <input type="date" value={manualHistory.date} onChange={(e) => setManualHistory({...manualHistory, date: e.target.value})} className={`w-full bg-transparent border-b p-2 font-bold outline-none text-sm ${t('border-white/10 text-white', 'border-slate-200 text-slate-900')}`} />
                                 </div>
                                 <div>
                                     <label className="text-[10px] font-bold uppercase text-slate-500">Bloc ID</label>
                                     <input type="text" value={manualHistory.bloc} onChange={(e) => setManualHistory({...manualHistory, bloc: e.target.value})} placeholder="e.g. 08" className={`w-full bg-transparent border-b p-2 font-bold outline-none text-sm ${t('border-white/10 text-white', 'border-slate-200 text-slate-900')}`} />
                                 </div>
                                 <div>
                                     <label className="text-[10px] font-bold uppercase text-slate-500">Target Disease</label>
                                      <select value={manualHistory.disease} onChange={(e) => setManualHistory({...manualHistory, disease: e.target.value})} className={`w-full bg-transparent border-b p-2 font-bold outline-none text-sm ${t('border-white/10 text-white bg-slate-900', 'border-slate-200 text-slate-900 bg-white')}`}>
                                          <option value="">Select Disease</option>
                                          {diseases.map(d => <option key={d} value={d}>{d}</option>)}
                                      </select>
                                 </div>
                                 <div>
                                     <label className="text-[10px] font-bold uppercase text-slate-500">Product Used</label>
                                     <input type="text" value={manualHistory.product} onChange={(e) => setManualHistory({...manualHistory, product: e.target.value})} placeholder="e.g. Ortiva" className={`w-full bg-transparent border-b p-2 font-bold outline-none text-sm ${t('border-white/10 text-white', 'border-slate-200 text-slate-900')}`} />
                                 </div>
                                 <button onClick={handleAddManualHistory} className="w-full py-3 bg-blue-500 hover:bg-blue-400 text-white font-black rounded-xl uppercase tracking-widest text-xs transition-colors mt-2">Add to Memory</button>
                             </div>
                         </div>

                         {/* List View */}
                         <div className="lg:col-span-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                             <table className="w-full text-left border-collapse">
                                 <thead className="sticky top-0 bg-[#0F172A] z-10">
                                     <tr>
                                         <th className="p-3 text-[10px] font-black uppercase text-slate-500">Date</th>
                                         <th className="p-3 text-[10px] font-black uppercase text-slate-500">Bloc</th>
                                         <th className="p-3 text-[10px] font-black uppercase text-slate-500">Product</th>
                                         <th className="p-3 text-[10px] font-black uppercase text-slate-500 text-right">Action</th>
                                     </tr>
                                 </thead>
                                 <tbody className={`divide-y ${t('divide-white/5', 'divide-slate-200')}`}>
                                     {digitalHistory.slice().reverse().map((h) => (
                                         <tr key={h.id} className="hover:bg-white/5 transition-colors group">
                                             <td className="p-3 text-xs font-bold text-slate-400">{h.date}</td>
                                             <td className={`p-3 text-xs font-black ${t('text-white', 'text-slate-900')}`}>{h.blocId}</td>
                                             <td className="p-3 text-xs font-medium text-slate-300">
                                                 {h.product}
                                                 <span className="block text-[10px] text-slate-500">{h.disease}</span>
                                             </td>
                                             <td className="p-3 text-right">
                                                 <button onClick={() => handleDeleteHistoryItem(h.id)} className="p-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10 rounded-lg"><Trash2 size={14} /></button>
                                             </td>
                                         </tr>
                                     ))}
                                     {digitalHistory.length === 0 && (
                                         <tr>
                                             <td colSpan={4} className="p-8 text-center text-slate-500 text-sm font-bold italic">No history recorded yet.</td>
                                         </tr>
                                     )}
                                 </tbody>
                             </table>
                         </div>
                     </div>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Edit Record Modal */}
      {editingRecord && tempRecord && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-black/60 animate-in fade-in">
            <div className={`w-full max-w-4xl rounded-[3rem] p-10 max-h-[90vh] overflow-y-auto ${t('bg-[#0F172A] border border-white/10', 'bg-white shadow-2xl')}`}>
                <div className="flex justify-between items-center mb-8">
                    <h2 className={`text-3xl font-black italic uppercase ${t('text-white', 'text-slate-900')}`}>Edit Record</h2>
                    <button onClick={() => {setEditingRecord(null); setTempRecord(null);}}><X className="text-slate-500" /></button>
                </div>
                <div className="grid grid-cols-2 gap-6 mb-8">
                     <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-500">Bloc ID</label>
                        <input type="text" value={tempRecord.blocId} onChange={e => setTempRecord({...tempRecord, blocId: e.target.value})} className={`w-full bg-transparent border-b p-2 font-bold outline-none ${t('border-white/10 text-white focus:border-emerald-500', 'border-slate-200 text-slate-900 focus:border-emerald-500')}`} />
                    </div>
                     <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-500">Massa ID</label>
                        <input type="text" value={tempRecord.massaId} onChange={e => setTempRecord({...tempRecord, massaId: e.target.value})} className={`w-full bg-transparent border-b p-2 font-bold outline-none ${t('border-white/10 text-white focus:border-emerald-500', 'border-slate-200 text-slate-900 focus:border-emerald-500')}`} />
                    </div>
                </div>
                <div className="flex overflow-x-auto gap-4 pb-6 scrollbar-hide">
                    {tempRecord.findings.map((f, idx) => (
                        <div key={f.name} className={`flex-shrink-0 w-24 p-4 rounded-xl border ${t('border-white/5 bg-white/5', 'border-slate-200 bg-slate-50')}`}>
                            <label className="text-[10px] font-black uppercase text-slate-500 block mb-2 text-center">{f.name}</label>
                            <input type="number" value={f.count} onChange={e => {
                                    const newCount = parseInt(e.target.value) || 0;
                                    const newFindings = [...tempRecord.findings];
                                    newFindings[idx] = { ...f, count: newCount, severity: calculateSeverity(f.name, newCount) };
                                    setTempRecord({ ...tempRecord, findings: newFindings });
                                }}
                                className={`w-full bg-transparent font-bold outline-none text-center text-lg ${t('text-white', 'text-slate-900')}`} 
                            />
                        </div>
                    ))}
                </div>
                <div className="mt-8 flex justify-end gap-4">
                    <button onClick={() => {setEditingRecord(null); setTempRecord(null);}} className="px-6 py-3 font-bold uppercase text-xs tracking-widest text-slate-500 hover:text-slate-400">Cancel</button>
                    <button onClick={handleSaveRecord} className="bg-emerald-500 text-slate-950 px-8 py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-emerald-400 transition-colors shadow-lg">Save Changes</button>
                </div>
            </div>
        </div>
      )}

      {/* Edit Action Modal */}
      {editingActionId && tempAction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-black/60 animate-in fade-in">
            <div className={`w-full max-w-2xl rounded-[3rem] p-10 ${t('bg-[#0F172A] border border-white/10', 'bg-white shadow-2xl')}`}>
                <div className="flex justify-between items-center mb-8">
                    <h2 className={`text-3xl font-black italic uppercase ${t('text-white', 'text-slate-900')}`}>Edit Action</h2>
                    <button onClick={() => {setEditingActionId(null); setTempAction(null);}}><X className="text-slate-500" /></button>
                </div>
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-500">Date</label>
                        <input type="date" value={tempAction.date} onChange={e => setTempAction({...tempAction, date: e.target.value})} className={`w-full bg-transparent border-b p-2 font-bold outline-none ${t('border-white/10 text-white focus:border-emerald-500', 'border-slate-200 text-slate-900 focus:border-emerald-500')}`} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-500">Time</label>
                        <input type="time" value={tempAction.time} onChange={e => setTempAction({...tempAction, time: e.target.value})} className={`w-full bg-transparent border-b p-2 font-bold outline-none ${t('border-white/10 text-white focus:border-emerald-500', 'border-slate-200 text-slate-900 focus:border-emerald-500')}`} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-500">Product</label>
                        <input type="text" value={tempAction.product} onChange={e => setTempAction({...tempAction, product: e.target.value})} className={`w-full bg-transparent border-b p-2 font-bold outline-none ${t('border-white/10 text-white focus:border-emerald-500', 'border-slate-200 text-slate-900 focus:border-emerald-500')}`} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-500">Dosage</label>
                        <div className="flex gap-2">
                            <input type="text" value={tempAction.dosage} onChange={e => setTempAction({...tempAction, dosage: e.target.value})} className={`w-full bg-transparent border-b p-2 font-bold outline-none ${t('border-white/10 text-white focus:border-emerald-500', 'border-slate-200 text-slate-900 focus:border-emerald-500')}`} />
                            <input type="text" value={tempAction.unit} onChange={e => setTempAction({...tempAction, unit: e.target.value})} className={`w-20 bg-transparent border-b p-2 font-bold outline-none ${t('border-white/10 text-white focus:border-emerald-500', 'border-slate-200 text-slate-900 focus:border-emerald-500')}`} />
                        </div>
                    </div>
                    <div className="col-span-2 space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-500">Reasoning</label>
                        <textarea value={tempAction.reasoning} onChange={e => setTempAction({...tempAction, reasoning: e.target.value})} rows={4} className={`w-full bg-transparent border rounded-xl p-4 font-medium text-sm outline-none resize-none ${t('border-white/10 text-slate-300 focus:border-emerald-500', 'border-slate-200 text-slate-600 focus:border-emerald-500')}`} />
                    </div>
                </div>
                <div className="mt-8 flex justify-end gap-4">
                    <button onClick={() => {setEditingActionId(null); setTempAction(null);}} className="px-6 py-3 font-bold uppercase text-xs tracking-widest text-slate-500 hover:text-slate-400">Cancel</button>
                    <button onClick={handleSaveAction} className="bg-emerald-500 text-slate-950 px-8 py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-emerald-400 transition-colors shadow-lg">Save Changes</button>
                </div>
            </div>
        </div>
      )}

      {/* Edit Protocol Modal */}
      {editingProtocol && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-black/60 animate-in fade-in">
            <div className={`w-full max-w-lg rounded-[3rem] p-10 ${t('bg-[#0F172A] border border-white/10', 'bg-white shadow-2xl')}`}>
                <div className="flex justify-between items-center mb-8">
                    <h2 className={`text-3xl font-black italic uppercase ${t('text-white', 'text-slate-900')}`}>Edit Protocol</h2>
                    <button onClick={() => setEditingProtocol(null)}><X className="text-slate-500" /></button>
                </div>
                <div className="space-y-6">
                     <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-500">Disease Name</label>
                        <input type="text" value={editingProtocol.name} onChange={e => setEditingProtocol({...editingProtocol, name: e.target.value})} className={`w-full bg-transparent border-b p-2 font-bold outline-none ${t('border-white/10 text-white focus:border-emerald-500', 'border-slate-200 text-slate-900 focus:border-emerald-500')}`} />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                         <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-amber-500">L2 Threshold</label>
                            <input type="number" value={editingProtocol.level2} onChange={e => setEditingProtocol({...editingProtocol, level2: parseInt(e.target.value) || 0})} className={`w-full bg-transparent border-b p-2 font-bold outline-none ${t('border-white/10 text-white focus:border-emerald-500', 'border-slate-200 text-slate-900 focus:border-emerald-500')}`} />
                        </div>
                         <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-red-500">L3 Threshold</label>
                            <input type="number" value={editingProtocol.level3} onChange={e => setEditingProtocol({...editingProtocol, level3: parseInt(e.target.value) || 0})} className={`w-full bg-transparent border-b p-2 font-bold outline-none ${t('border-white/10 text-white focus:border-emerald-500', 'border-slate-200 text-slate-900 focus:border-emerald-500')}`} />
                        </div>
                    </div>
                </div>
                <div className="mt-8 flex justify-end gap-4">
                    <button onClick={() => setEditingProtocol(null)} className="px-6 py-3 font-bold uppercase text-xs tracking-widest text-slate-500 hover:text-slate-400">Cancel</button>
                    <button onClick={handleSaveProtocol} className="bg-emerald-500 text-slate-950 px-8 py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-emerald-400 transition-colors shadow-lg">Save</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}