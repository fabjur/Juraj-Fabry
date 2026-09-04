import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { QualityCheck, QualityCheckSubmission } from '../types';
import { analyzeQualityCheck } from '../services/geminiService';
import { useTranslation } from '../i18n/index';
import { TranslatedText } from './TranslatedText';
import { 
  Upload, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Eye, 
  ChevronRight, 
  RotateCw, 
  Trash2, 
  MapPin, 
  ArrowLeft,
  ClipboardList,
  Layers,
  FileCheck2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Store,
  ArrowRightLeft,
  Check,
  Maximize2,
  X,
  FileText,
  Pencil,
  Sparkles,
  RefreshCw
} from 'lucide-react';

const createSamplePlanogramSvg = (): string => {
  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
    <rect width="800" height="450" fill="#f8fafc"/>
    <rect x="40" y="20" width="720" height="410" fill="#f1f5f9" rx="16" stroke="#cbd5e1" stroke-width="4"/>
    
    <!-- Header banner -->
    <rect x="60" y="35" width="680" height="40" fill="#0284c7" rx="8"/>
    <text x="400" y="61" font-family="sans-serif" font-size="16" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="1">VZOROVÝ PLANOGRAM - AKCIOVÝ REGÁL NÁPOJE 2L</text>
    
    <!-- Shelf 1 -->
    <rect x="60" y="160" width="680" height="14" fill="#64748b" rx="3"/>
    <text x="70" y="100" font-family="sans-serif" font-size="11" font-weight="bold" fill="#0f172a">1. POLICA: COCA-COLA REGULAR &amp; ZERO (50:50)</text>
    <rect x="180" y="85" width="45" height="75" fill="#dc2626" rx="6"/>
    <rect x="235" y="85" width="45" height="75" fill="#dc2626" rx="6"/>
    <rect x="290" y="85" width="45" height="75" fill="#dc2626" rx="6"/>
    <rect x="345" y="85" width="45" height="75" fill="#18181b" rx="6"/>
    <rect x="400" y="85" width="45" height="75" fill="#18181b" rx="6"/>
    <rect x="455" y="85" width="45" height="75" fill="#18181b" rx="6"/>
    <rect x="510" y="85" width="45" height="75" fill="#ea580c" rx="6"/>
    <rect x="565" y="85" width="45" height="75" fill="#ea580c" rx="6"/>
    <!-- Red promo price tags -->
    <rect x="180" y="162" width="40" height="10" fill="#ef4444" rx="2"/>
    <rect x="345" y="162" width="40" height="10" fill="#ef4444" rx="2"/>
    <rect x="510" y="162" width="40" height="10" fill="#ef4444" rx="2"/>

    <!-- Shelf 2 -->
    <rect x="60" y="290" width="680" height="14" fill="#64748b" rx="3"/>
    <text x="70" y="200" font-family="sans-serif" font-size="11" font-weight="bold" fill="#0f172a">2. POLICA: FANTA &amp; SPRITE (3 RADY + AKČNÉ CENA)</text>
    <rect x="180" y="205" width="50" height="85" fill="#16a34a" rx="6"/>
    <rect x="240" y="205" width="50" height="85" fill="#16a34a" rx="6"/>
    <rect x="300" y="205" width="50" height="85" fill="#16a34a" rx="6"/>
    <rect x="370" y="205" width="50" height="85" fill="#0284c7" rx="6"/>
    <rect x="430" y="205" width="50" height="85" fill="#0284c7" rx="6"/>
    <rect x="490" y="205" width="50" height="85" fill="#0284c7" rx="6"/>
    <rect x="560" y="205" width="50" height="85" fill="#eab308" rx="6"/>
    <!-- Yellow price tags -->
    <rect x="180" y="292" width="40" height="10" fill="#eab308" rx="2"/>
    <rect x="370" y="292" width="40" height="10" fill="#eab308" rx="2"/>

    <!-- Shelf 3 -->
    <rect x="60" y="410" width="680" height="14" fill="#64748b" rx="3"/>
    <text x="70" y="325" font-family="sans-serif" font-size="11" font-weight="bold" fill="#0f172a">3. POLICA: MINERÁLNE VODY &amp; BALENIA 6-PACK</text>
    <rect x="180" y="335" width="80" height="75" fill="#2563eb" rx="6"/>
    <rect x="270" y="335" width="80" height="75" fill="#2563eb" rx="6"/>
    <rect x="370" y="335" width="80" height="75" fill="#7c3aed" rx="6"/>
    <rect x="460" y="335" width="80" height="75" fill="#7c3aed" rx="6"/>
    <rect x="560" y="335" width="80" height="75" fill="#db2777" rx="6"/>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svgString)}`;
};

export const QualityCheckPanel: React.FC = () => {
  const { language, t } = useTranslation();
  const templates = useLiveQuery(() => db.quality_checks.orderBy('createdAt').reverse().toArray()) || [];
  const stores = useLiveQuery(() => db.stores.toArray()) || [];

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  
  // Template Creation form state
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');
  const [refImages, setRefImages] = useState<string[]>([]);
  const [isUploadingRef, setIsUploadingRef] = useState(false);

  // Template Editing state
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [editTemplateName, setEditTemplateName] = useState('');
  const [editTemplateDesc, setEditTemplateDesc] = useState('');
  const [editRefImages, setEditRefImages] = useState<string[]>([]);
  const [isUploadingEditRef, setIsUploadingEditRef] = useState(false);

  // Re-analysis state
  const [reanalyzingSubId, setReanalyzingSubId] = useState<string | null>(null);
  const [isBulkReanalyzing, setIsBulkReanalyzing] = useState(false);

  // Evaluation form state
  const [selectedStoreName, setSelectedStoreName] = useState('');
  const [customStoreName, setCustomStoreName] = useState('');
  const [searchStoreTerm, setSearchStoreTerm] = useState('');
  const [isStoreSelectOpen, setIsStoreSelectOpen] = useState(false);
  const [storeImage, setStoreImage] = useState<string | null>(null);
  const [storeImageName, setStoreImageName] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Active filter for submissions report
  const [scoreFilter, setScoreFilter] = useState<'all' | 'compliant' | 'noncompliant'>('all');
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  
  // Modal viewer for full-resolution side-by-side comparison
  const [comparisonModalSubmission, setComparisonModalSubmission] = useState<QualityCheckSubmission | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const activeTemplate = templates.find(t => t.id === selectedTemplateId);

  // Helper: File to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // Master image upload
  const handleRefImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setIsUploadingRef(true);
    try {
      const base64s: string[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        const b64 = await fileToBase64(file);
        base64s.push(b64);
      }
      setRefImages(prev => [...prev, ...base64s]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploadingRef(false);
    }
  };

  // Edit mode master image upload
  const handleEditRefImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setIsUploadingEditRef(true);
    try {
      const base64s: string[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        const b64 = await fileToBase64(file);
        base64s.push(b64);
      }
      setEditRefImages(prev => [...prev, ...base64s]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploadingEditRef(false);
    }
  };

  // Store image upload for Quality check
  const handleStoreImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setStoreImageName(file.name);
    try {
      const b64 = await fileToBase64(file);
      setStoreImage(b64);
    } catch (err) {
      console.error(err);
    }
  };

  // Create Template
  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) {
      alert('Zadajte názov planogramu.');
      return;
    }
    if (refImages.length === 0) {
      alert('Nahrajte aspoň jeden vzorový obrázok.');
      return;
    }

    const template: QualityCheck = {
      id: `qc-${Date.now()}`,
      name: newTemplateName,
      description: newTemplateDesc,
      referenceImages: refImages,
      submissions: [],
      createdAt: new Date().toISOString()
    };

    await db.quality_checks.add(template);
    
    // Clear & close
    setNewTemplateName('');
    setNewTemplateDesc('');
    setRefImages([]);
    setIsCreatingTemplate(false);
    setSelectedTemplateId(template.id);
  };

  // Create Sample Template automatically
  const handleCreateSampleTemplate = async () => {
    const sampleSvg = createSamplePlanogramSvg();
    const sampleTemplate: QualityCheck = {
      id: `qc-${Date.now()}`,
      name: 'Vzorový Planogram - Akciový Nápojový Regál 2L',
      description: `Pravidlá vystavenia pre audit:\n1. Horná polica: 2L fľaše Coca-Cola Regular a Zero striedavo v pomere 50:50.\n2. Stredná polica: Fanta Orange a Sprite v 3 radách. Návestné červené akčné cenovky musia byť viditeľne umiestnené pod každou sekciou.\n3. Dolná polica: Minerálne vody a balenia v 6-packoch. Nie sú povolené žiadne neidentifikovateľné produkty ani medzery v regáli.`,
      referenceImages: [sampleSvg],
      submissions: [],
      createdAt: new Date().toISOString()
    };

    await db.quality_checks.add(sampleTemplate);
    setSelectedTemplateId(sampleTemplate.id);
  };

  // Start Editing Template
  const handleStartEditTemplate = () => {
    if (!activeTemplate) return;
    setEditTemplateName(activeTemplate.name);
    setEditTemplateDesc(activeTemplate.description || '');
    setEditRefImages([...activeTemplate.referenceImages]);
    setIsEditingTemplate(true);
  };

  // Save Edits to Active Template
  const handleSaveEditTemplate = async () => {
    if (!activeTemplate) return;
    if (!editTemplateName.trim()) {
      alert('Zadajte názov planogramu.');
      return;
    }
    if (editRefImages.length === 0) {
      alert('Planogram musí obsahovať aspoň jeden vzorový obrázok.');
      return;
    }

    await db.quality_checks.update(activeTemplate.id, {
      name: editTemplateName.trim(),
      description: editTemplateDesc.trim(),
      referenceImages: editRefImages
    });

    setIsEditingTemplate(false);
  };

  // Delete Template
  const handleDeleteTemplate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Naozaj chcete natrvalo vymazať tento planogram vrátane všetkých reportov?')) {
      await db.quality_checks.delete(id);
      if (selectedTemplateId === id) {
        setSelectedTemplateId(null);
      }
    }
  };

  // Run Store compliance audit
  const handleAnalyzeStore = async () => {
    if (!activeTemplate) return;
    
    const finalStoreName = selectedStoreName === 'custom' 
      ? customStoreName.trim() 
      : selectedStoreName;

    if (!finalStoreName) {
      alert('Vyberte alebo zadajte názov predajne.');
      return;
    }
    if (!storeImage) {
      alert('Nahrajte fotografiu z predajne.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);

    const submissionId = `sub-${Date.now()}`;
    const newSubmission: QualityCheckSubmission = {
      id: submissionId,
      storeName: finalStoreName,
      imageUrl: storeImage,
      fileName: storeImageName,
      status: 'analyzing',
      createdAt: new Date().toISOString()
    };

    // Save pending status
    const updatedSubmissions = [...activeTemplate.submissions, newSubmission];
    await db.quality_checks.update(activeTemplate.id, { submissions: updatedSubmissions });

    try {
      // Call Gemini multi-modal compliance service
      const result = await analyzeQualityCheck(
        activeTemplate.referenceImages,
        activeTemplate.description,
        storeImage,
        'gemini-3.6-flash',
        language
      );

      // Save success status
      const completedSubmissions = updatedSubmissions.map(sub => {
        if (sub.id === submissionId) {
          return {
            ...sub,
            status: 'success' as const,
            complianceScore: result.complianceScore,
            reason: result.reason
          };
        }
        return sub;
      });

      await db.quality_checks.update(activeTemplate.id, { submissions: completedSubmissions });
      
      // Auto expand newly audited item
      setExpandedSubmissionId(submissionId);

      // Clear analysis fields
      setStoreImage(null);
      setStoreImageName('');
      setSelectedStoreName('');
      setCustomStoreName('');
      setSearchStoreTerm('');
    } catch (err: any) {
      console.error(err);
      const errorMessage = err?.message || 'Nastala chyba pri porovnávaní.';
      setAnalysisError(errorMessage);

      // Save error status
      const failedSubmissions = updatedSubmissions.map(sub => {
        if (sub.id === submissionId) {
          return {
            ...sub,
            status: 'error' as const,
            error: errorMessage
          };
        }
        return sub;
      });

      await db.quality_checks.update(activeTemplate.id, { submissions: failedSubmissions });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Re-analyze a single submission with current updated template and description
  const handleReanalyzeSubmission = async (submission: QualityCheckSubmission) => {
    if (!activeTemplate || !submission.imageUrl) return;

    setReanalyzingSubId(submission.id);

    const updatedSubmissions = activeTemplate.submissions.map(sub => {
      if (sub.id === submission.id) {
        return { ...sub, status: 'analyzing' as const };
      }
      return sub;
    });
    await db.quality_checks.update(activeTemplate.id, { submissions: updatedSubmissions });

    try {
      const result = await analyzeQualityCheck(
        activeTemplate.referenceImages,
        activeTemplate.description,
        submission.imageUrl,
        'gemini-3.6-flash',
        language
      );

      const completedSubmissions = updatedSubmissions.map(sub => {
        if (sub.id === submission.id) {
          return {
            ...sub,
            status: 'success' as const,
            complianceScore: result.complianceScore,
            reason: result.reason
          };
        }
        return sub;
      });

      await db.quality_checks.update(activeTemplate.id, { submissions: completedSubmissions });
      setExpandedSubmissionId(submission.id);
    } catch (err: any) {
      console.error(err);
      const errorMessage = err?.message || 'Nastala chyba pri opätovnej analýze.';
      const failedSubmissions = updatedSubmissions.map(sub => {
        if (sub.id === submission.id) {
          return {
            ...sub,
            status: 'error' as const,
            error: errorMessage
          };
        }
        return sub;
      });
      await db.quality_checks.update(activeTemplate.id, { submissions: failedSubmissions });
    } finally {
      setReanalyzingSubId(null);
    }
  };

  // Re-analyze all submissions for active template
  const handleReanalyzeAllSubmissions = async () => {
    if (!activeTemplate || activeTemplate.submissions.length === 0) return;
    if (!confirm(`Naozaj chcete spustiť novú analýzu pre všetkých ${activeTemplate.submissions.length} auditovaných predajní podľa aktuálne upraveného planogramu?`)) {
      return;
    }

    setIsBulkReanalyzing(true);
    try {
      let currentSubmissions = [...activeTemplate.submissions];

      for (const sub of currentSubmissions) {
        if (!sub.imageUrl) continue;

        setReanalyzingSubId(sub.id);
        const pendingSubs = currentSubmissions.map(s => s.id === sub.id ? { ...s, status: 'analyzing' as const } : s);
        await db.quality_checks.update(activeTemplate.id, { submissions: pendingSubs });

        try {
          const result = await analyzeQualityCheck(
            activeTemplate.referenceImages,
            activeTemplate.description,
            sub.imageUrl,
            'gemini-3.6-flash',
            language
          );

          currentSubmissions = currentSubmissions.map(s => {
            if (s.id === sub.id) {
              return {
                ...s,
                status: 'success' as const,
                complianceScore: result.complianceScore,
                reason: result.reason
              };
            }
            return s;
          });
        } catch (err: any) {
          currentSubmissions = currentSubmissions.map(s => {
            if (s.id === sub.id) {
              return {
                ...s,
                status: 'error' as const,
                error: err?.message || 'Chyba re-analýzy'
              };
            }
            return s;
          });
        }

        await db.quality_checks.update(activeTemplate.id, { submissions: currentSubmissions });
      }
    } finally {
      setIsBulkReanalyzing(false);
      setReanalyzingSubId(null);
    }
  };

  // Delete Individual submission
  const handleDeleteSubmission = async (subId: string) => {
    if (!activeTemplate) return;
    if (confirm('Naozaj chcete vymazať tento report predajne?')) {
      const filtered = activeTemplate.submissions.filter(sub => sub.id !== subId);
      await db.quality_checks.update(activeTemplate.id, { submissions: filtered });
      if (expandedSubmissionId === subId) setExpandedSubmissionId(null);
    }
  };

  // Filtered store list
  const filteredStoresList = stores.filter(st => {
    const term = searchStoreTerm.toLowerCase();
    return st.name.toLowerCase().includes(term) || (st.city && st.city.toLowerCase().includes(term));
  });

  // Filtered submissions
  const filteredSubmissions = activeTemplate 
    ? activeTemplate.submissions.filter(sub => {
        if (scoreFilter === 'compliant') return (sub.complianceScore ?? 0) >= 80 && sub.status === 'success';
        if (scoreFilter === 'noncompliant') return (sub.complianceScore ?? 0) < 80 && sub.status === 'success';
        return true;
      })
    : [];

  return (
    <div className="space-y-8 animate-fade-in text-left">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-lime-100 to-emerald-100 rounded-2xl shadow-xs border border-lime-200/50">
              <FileCheck2 className="w-6 h-6 text-lime-700" />
            </div>
            {t('qc_title')}
          </h2>
          <p className="text-xs text-gray-500 font-bold mt-1 max-w-2xl">
            {t('qc_subtitle')}
          </p>
        </div>

        {!selectedTemplateId && !isCreatingTemplate && (
          <div className="flex items-center gap-2 self-start flex-wrap">
            <button
              onClick={handleCreateSampleTemplate}
              className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200 active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-blue-200" />
              {t('qc_loadSamplePlanogram')}
            </button>
            <button
              onClick={() => setIsCreatingTemplate(true)}
              className="px-5 py-2.5 bg-lime-600 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 hover:bg-lime-700 hover:shadow-lg hover:shadow-lime-200 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              {t('qc_newPlanogram')}
            </button>
          </div>
        )}

        {selectedTemplateId && (
          <button
            onClick={() => setSelectedTemplateId(null)}
            className="px-4 py-2.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all self-start"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('qc_backToPlanograms')}
          </button>
        )}
      </div>

      {/* PROCESS INFOGRAPHIC GUIDE */}
      <div className="bg-gradient-to-r from-lime-50/60 via-emerald-50/40 to-teal-50/30 rounded-3xl p-6 border border-lime-200/60 shadow-xs">
        <div 
          onClick={() => setIsGuideOpen(!isGuideOpen)}
          className="flex justify-between items-center cursor-pointer select-none"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-lime-600 rounded-2xl text-white shadow-xs">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-lime-950 uppercase tracking-wider">
                {t('qc_howItWorks')}
              </h3>
              <p className="text-xs text-lime-700 font-bold mt-0.5">
                {t('qc_howItWorksSub')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text-lime-800 bg-lime-100/80 px-2.5 py-1 rounded-lg">
              {isGuideOpen ? t('qc_hideSteps') : t('qc_showSteps')}
            </span>
            {isGuideOpen ? (
              <ChevronUp className="w-4 h-4 text-lime-800" />
            ) : (
              <ChevronDown className="w-4 h-4 text-lime-800" />
            )}
          </div>
        </div>

        {isGuideOpen && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-5 pt-5 border-t border-lime-200/50">
            {/* Step 1 */}
            <div className="bg-white p-5 rounded-2xl border border-lime-100 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-widest bg-lime-100 text-lime-800 px-2.5 py-1 rounded-lg font-black">
                  {t('qc_partALabel')}
                </span>
                <h4 className="font-black text-xs text-gray-900 mt-3 mb-1">{t('qc_partA_title')}</h4>
                <p className="text-[11px] text-gray-600 leading-relaxed font-semibold">
                  {t('qc_partA_desc')}
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-widest bg-blue-100 text-blue-800 px-2.5 py-1 rounded-lg font-black">
                  {t('qc_partBLabel')}
                </span>
                <h4 className="font-black text-xs text-gray-900 mt-3 mb-1">{t('qc_partB_title')}</h4>
                <p className="text-[11px] text-gray-600 leading-relaxed font-semibold">
                  {t('qc_partB_desc')}
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-white p-5 rounded-2xl border border-purple-100 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-widest bg-purple-100 text-purple-800 px-2.5 py-1 rounded-lg font-black">
                  {t('qc_partCLabel')}
                </span>
                <h4 className="font-black text-xs text-gray-900 mt-3 mb-1">{t('qc_partC_title')}</h4>
                <p className="text-[11px] text-gray-600 leading-relaxed font-semibold">
                  {t('qc_partC_desc')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- DASHBOARD / TEMPLATES LIST --- */}
      {!selectedTemplateId && !isCreatingTemplate && (
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="font-black text-gray-900 text-sm uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-lime-600" />
              {t('qc_planogramsList', { count: templates.length })}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.length === 0 ? (
              <div className="col-span-full bg-white rounded-3xl p-12 border border-gray-100 flex flex-col items-center text-center">
                <div className="p-4 bg-lime-50 rounded-2xl text-lime-600 mb-4 animate-bounce">
                  <ClipboardList className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-gray-900 text-sm">{t('qc_noPlanograms')}</h3>
                <p className="text-xs text-gray-500 mt-2 max-w-sm">
                  {t('qc_noPlanogramsDesc')}
                </p>
                <button
                  onClick={() => setIsCreatingTemplate(true)}
                  className="mt-6 px-5 py-2.5 bg-lime-600 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 hover:bg-lime-700 transition-all duration-200 shadow-md shadow-lime-200"
                >
                  <Plus className="w-4 h-4" />
                  {t('qc_createFirst')}
                </button>
              </div>
            ) : (
              templates.map(tpl => {
                const auditCount = tpl.submissions.length;
                const compliantsCount = tpl.submissions.filter(s => s.status === 'success' && (s.complianceScore ?? 0) >= 80).length;
                const nonCompliantsCount = tpl.submissions.filter(s => s.status === 'success' && (s.complianceScore ?? 0) < 80).length;

                return (
                  <div
                    key={tpl.id}
                    onClick={() => setSelectedTemplateId(tpl.id)}
                    className="bg-white rounded-3xl border border-gray-150 hover:border-lime-400 shadow-xs p-5 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      {/* Thumbnail of first ref image */}
                      {tpl.referenceImages?.[0] && (
                        <div className="mb-4 aspect-video w-full rounded-2xl overflow-hidden bg-gray-100 relative">
                          <img 
                            src={tpl.referenceImages[0]} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            alt={tpl.name}
                          />
                          <div className="absolute top-2.5 right-2.5 px-2.5 py-1 bg-black/70 backdrop-blur-xs rounded-lg text-[9px] text-white font-black uppercase tracking-wider">
                            {tpl.referenceImages.length} {tpl.referenceImages.length === 1 ? 'Foto' : 'Fotky'}
                          </div>
                          <div className="absolute top-2.5 left-2.5 px-2.5 py-1 bg-lime-600 text-white rounded-lg text-[9px] font-black uppercase tracking-wider shadow-xs">
                            {t('qc_goldStandard')}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-black text-gray-900 text-base group-hover:text-lime-700 transition-colors line-clamp-1">{tpl.name}</h4>
                        <button
                          onClick={(e) => handleDeleteTemplate(tpl.id, e)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all shrink-0"
                          title={t('qc_deletePlanogram')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 h-9 overflow-hidden font-medium">
                        {tpl.description || t('qc_noExtraDesc')}
                      </p>
                    </div>

                    <div className="border-t border-gray-100 pt-3 mt-4 flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-gray-800 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100">{t('qc_auditsCount', { count: auditCount })}</span>
                        {auditCount > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" title="Vyhovujúce"></span>
                            <span className="font-black text-emerald-700">{compliantsCount}</span>
                            <span className="h-2 w-2 rounded-full bg-rose-500" title="Nevyhovujúce"></span>
                            <span className="font-black text-rose-700">{nonCompliantsCount}</span>
                          </div>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* --- FORM FOR CREATING A NEW PLANOGRAM REFERENCE --- */}
      {isCreatingTemplate && (
        <div className="bg-white rounded-3xl border border-gray-150 shadow-md overflow-hidden p-6 max-w-4xl mx-auto space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-gray-100">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-lime-700 bg-lime-50 border border-lime-100 px-2.5 py-0.5 rounded-md">
                {t('qc_partACreateHeader')}
              </span>
              <h3 className="text-base font-black text-gray-900 mt-1 flex items-center gap-2">
                <Layers className="w-5 h-5 text-lime-600" />
                {t('qc_createPlanogramTitle')}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5 font-medium">{t('qc_createPlanogramSubtitle')}</p>
            </div>
            <button
              onClick={() => setIsCreatingTemplate(false)}
              className="text-gray-400 hover:text-gray-800 text-xs font-bold bg-gray-100 px-3 py-1.5 rounded-xl transition-all"
            >
              {t('qc_cancel')}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Col inputs */}
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1.5">{t('qc_planogramNameLabel')}</label>
                <input
                  type="text"
                  placeholder={t('qc_planogramNamePlaceholder')}
                  value={newTemplateName}
                  onChange={e => setNewTemplateName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl text-xs p-3 font-bold text-gray-800 focus:ring-2 focus:ring-lime-500 focus:bg-white transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1.5">{t('qc_manualLabel')}</label>
                <textarea
                  rows={6}
                  placeholder={t('qc_manualPlaceholder')}
                  value={newTemplateDesc}
                  onChange={e => setNewTemplateDesc(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl text-xs p-3 font-medium text-gray-800 focus:ring-2 focus:ring-lime-500 focus:bg-white transition-all outline-none resize-none leading-relaxed"
                />
              </div>
            </div>

            {/* Right Col Image uploads */}
            <div className="space-y-4">
              <label className="block text-[10px] font-black uppercase text-gray-500 tracking-wider">{t('qc_refPhotosLabel')}</label>
              
              <div className="border-2 border-dashed border-gray-250 rounded-2xl p-6 hover:border-lime-500 hover:bg-lime-50/20 transition-all flex flex-col items-center justify-center text-center cursor-pointer relative bg-gray-50/50">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleRefImagesUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <Upload className="w-8 h-8 text-lime-600 mb-2" />
                <span className="text-xs font-black text-gray-800">{t('qc_selectRefPhotos')}</span>
                <span className="text-[10px] text-gray-400 font-bold mt-1">{t('qc_uploadRefHint')}</span>
              </div>

              {/* Uploaded references list */}
              {refImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {refImages.map((img, idx) => (
                    <div key={idx} className="aspect-square rounded-xl overflow-hidden bg-gray-100 relative group border border-gray-200">
                      <img src={img} className="w-full h-full object-cover" />
                      <button
                        onClick={() => setRefImages(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-150 scale-75 shadow-sm"
                        title={t('qc_deletePlanogram')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {isUploadingRef && (
                <div className="flex items-center gap-2 justify-center py-2 text-xs text-lime-700 font-bold bg-lime-50 rounded-xl">
                  <RotateCw className="w-4 h-4 animate-spin" />
                  {t('qc_processingPhotos')}
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
            <button
              onClick={() => setIsCreatingTemplate(false)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all"
            >
              {t('qc_cancel')}
            </button>
            <button
              onClick={handleSaveTemplate}
              disabled={!newTemplateName.trim() || refImages.length === 0}
              className="px-5 py-2.5 bg-lime-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-lime-700 shadow-md shadow-lime-200 transition-all"
            >
              {t('qc_saveRefPlanogram')}
            </button>
          </div>
        </div>
      )}

      {/* --- ACTIVE PLANOGRAM VIEW: 3 LOGICAL BLOCKS --- */}
      {selectedTemplateId && activeTemplate && (
        <div className="space-y-8">
          
          {/* TOP SECTION: CLEARLY DISPLAYING LOGICAL BLOCKS A & B */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* ======================================================== */}
            {/* LOGICAL BLOCK A: REFERENČNÝ ŠTANDARD (VOČI ČOMU SA POROVNÁVA) */}
            {/* ======================================================== */}
            <div className="lg:col-span-5 bg-gradient-to-br from-white to-lime-50/20 rounded-3xl border-2 border-lime-300/80 shadow-xs p-6 space-y-5">
              {isEditingTemplate ? (
                /* Inline Template Edit Form */
                <div className="space-y-4 animate-fade-in">
                  <div className="flex justify-between items-center border-b border-lime-200 pb-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-lime-600 text-white shadow-2xs">
                      <Pencil className="w-3.5 h-3.5" />
                      {t('qc_editTemplateTitle')}
                    </span>
                    <button
                      onClick={() => setIsEditingTemplate(false)}
                      className="text-xs font-bold text-gray-500 hover:text-gray-900 px-2.5 py-1 rounded-lg hover:bg-lime-100 transition-colors"
                    >
                      {t('qc_cancel')}
                    </button>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-600 tracking-wider mb-1">
                      {t('qc_editTemplateNameLabel')}
                    </label>
                    <input
                      type="text"
                      value={editTemplateName}
                      onChange={e => setEditTemplateName(e.target.value)}
                      className="w-full bg-white border border-lime-300 rounded-xl text-xs p-2.5 font-bold text-gray-900 focus:ring-2 focus:ring-lime-500 outline-none"
                      placeholder="Napr. Akciový Regál Nápoje 2L..."
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-600 tracking-wider mb-1">
                      {t('qc_editTemplateDescLabel')}
                    </label>
                    <textarea
                      rows={5}
                      value={editTemplateDesc}
                      onChange={e => setEditTemplateDesc(e.target.value)}
                      className="w-full bg-white border border-lime-300 rounded-xl text-xs p-2.5 font-semibold text-gray-900 focus:ring-2 focus:ring-lime-500 outline-none resize-none leading-relaxed"
                      placeholder="Doplňte pravidlá vystavenia, rozloženia, cenoviek..."
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-[10px] font-black uppercase text-gray-600 tracking-wider">
                        {t('qc_photosCountLabel', { count: editRefImages.length })}
                      </label>
                      <label className="text-[10px] font-black uppercase text-lime-800 hover:text-lime-900 cursor-pointer flex items-center gap-1 bg-lime-100 hover:bg-lime-200 px-2.5 py-1 rounded-lg transition-colors">
                        <Upload className="w-3 h-3" />
                        {t('qc_addPhotoBtn')}
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handleEditRefImagesUpload}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {editRefImages.map((img, idx) => (
                        <div key={idx} className="aspect-video rounded-xl overflow-hidden bg-gray-100 border border-lime-300 relative group shadow-2xs">
                          <img src={img} className="w-full h-full object-cover" alt={`Edit ref ${idx}`} />
                          <button
                            type="button"
                            onClick={() => setEditRefImages(prev => prev.filter((_, i) => i !== idx))}
                            className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-90 hover:opacity-100 transition-opacity scale-90 shadow-xs"
                            title={t('qc_deletePlanogram')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    {isUploadingEditRef && (
                      <div className="text-[10px] text-lime-700 font-bold mt-1 flex items-center gap-1">
                        <RotateCw className="w-3 h-3 animate-spin" /> {t('qc_processingPhotos')}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-lime-200 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingTemplate(false)}
                      className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors"
                    >
                      {t('qc_cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEditTemplate}
                      disabled={!editTemplateName.trim() || editRefImages.length === 0}
                      className="px-4 py-2 bg-lime-600 hover:bg-lime-700 disabled:opacity-50 text-white font-black uppercase text-xs rounded-xl shadow-md shadow-lime-200 transition-all flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      {t('qc_saveTemplateEdits')}
                    </button>
                  </div>
                </div>
              ) : (
                /* Normal Active Template Display */
                <>
                  <div className="flex justify-between items-start gap-2 border-b border-lime-100 pb-4">
                    <div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-lime-600 text-white shadow-2xs">
                        <CheckCircle2 className="w-3 h-3" />
                        {t('qc_partATitle')}
                      </span>
                      <h3 className="font-black text-gray-900 text-xl mt-2 tracking-tight">{activeTemplate.name}</h3>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                        {t('qc_singleSourceTruth')}
                      </p>
                    </div>

                    <button
                      onClick={handleStartEditTemplate}
                      className="px-3 py-1.5 bg-lime-100 hover:bg-lime-200 text-lime-800 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shrink-0 border border-lime-300/70"
                      title={t('qc_editUpdate')}
                    >
                      <Pencil className="w-3.5 h-3.5 text-lime-700" />
                      {t('qc_editUpdate')}
                    </button>
                  </div>

                  {/* Master Reference Photo gallery */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="block text-[10px] font-black uppercase text-gray-400 tracking-wider">
                        {t('qc_samplePhotoHeader')}
                      </span>
                      <span className="text-[10px] font-bold text-lime-700 bg-lime-100/80 px-2 py-0.5 rounded-md">
                        {activeTemplate.referenceImages.length} {activeTemplate.referenceImages.length === 1 ? 'obrázok' : 'obrázky'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {activeTemplate.referenceImages.map((img, idx) => (
                        <div key={idx} className="aspect-video rounded-2xl overflow-hidden bg-gray-100 border border-lime-200 relative group shadow-2xs">
                          <img src={img} className="w-full h-full object-cover" alt={`Ref ${idx}`} />
                          <button 
                            onClick={() => setPreviewImage(img)}
                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs font-black text-white gap-1.5 transition-opacity duration-200"
                          >
                            <Maximize2 className="w-4 h-4" />
                            {t('qc_zoomSample')}
                          </button>
                          <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/70 backdrop-blur-xs rounded-md text-[8px] font-black uppercase text-white">
                            Vzor #{idx + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Verified Verbal Guidelines Manual */}
                  <div className="space-y-2 bg-white/90 p-4 rounded-2xl border border-lime-200/60 shadow-2xs">
                    <span className="text-[10px] font-black uppercase text-lime-800 tracking-wider flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-lime-600" />
                      {t('qc_rulesAndManual')}
                    </span>
                    <p className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed font-semibold">
                      {activeTemplate.description || 'Nie sú zadané dodatočné slovné inštrukcie. Porovnáva sa výhradne vizuálna zhoda s fotografiou.'}
                    </p>
                  </div>

                  {/* Re-analyze All Stores Action */}
                  {activeTemplate.submissions.length > 0 && (
                    <div className="pt-2">
                      <button
                        onClick={handleReanalyzeAllSubmissions}
                        disabled={isBulkReanalyzing || isAnalyzing}
                        className="w-full py-2.5 bg-gradient-to-r from-lime-600 to-emerald-600 hover:from-lime-700 hover:to-emerald-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md shadow-lime-200 transition-all flex items-center justify-center gap-2"
                      >
                        <RefreshCw className={`w-4 h-4 ${isBulkReanalyzing ? 'animate-spin' : ''}`} />
                        <span>{isBulkReanalyzing ? t('qc_reanalyzingStores') : t('qc_reanalyzeAllStores')}</span>
                      </button>
                    </div>
                  )}

                  <div className="text-[10px] text-gray-400 font-bold border-t border-lime-100 pt-3 flex justify-between">
                    <span>{t('qc_createdOn', { date: new Date(activeTemplate.createdAt).toLocaleDateString() })}</span>
                    <span>{t('qc_totalAudits', { count: activeTemplate.submissions.length })}</span>
                  </div>
                </>
              )}
            </div>

            {/* ======================================================== */}
            {/* LOGICAL BLOCK B: POROVNÁVANÝ AUDIT Z PREDAJNE (ČO SA POROVNÁVA) */}
            {/* ================================================= grand total */}
            <div className="lg:col-span-7 bg-white rounded-3xl border-2 border-blue-200/80 shadow-xs p-6 space-y-5">
              <div className="border-b border-blue-100 pb-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-blue-600 text-white shadow-2xs">
                  <Store className="w-3 h-3" />
                  {t('qc_partBTitle')}
                </span>
                <h3 className="font-black text-gray-900 text-xl mt-2 tracking-tight">{t('qc_addStorePhotoTitle')}</h3>
                <p className="text-xs text-blue-700/80 font-bold mt-0.5">
                  {t('qc_addStorePhotoSubtitle', { name: activeTemplate.name })}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Store selection dropdown */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase text-gray-500 tracking-wider">
                    {t('qc_selectStoreStep')}
                  </label>
                  
                  <div className="relative">
                    <div 
                      onClick={() => setIsStoreSelectOpen(!isStoreSelectOpen)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-2xl text-xs p-3.5 flex justify-between items-center cursor-pointer hover:bg-gray-100/70 transition-colors font-bold text-gray-800"
                    >
                      <span>
                        {selectedStoreName === 'custom' 
                          ? `Ručne: ${customStoreName || 'Nepomenovaná'}` 
                          : selectedStoreName || t('qc_selectStorePlaceholder')
                        }
                      </span>
                      <MapPin className="w-4 h-4 text-blue-600" />
                    </div>

                    {isStoreSelectOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-2xl shadow-2xl z-30 overflow-hidden text-xs max-h-60 flex flex-col">
                        <div className="p-2 border-b border-gray-100 bg-gray-50">
                          <input
                            type="text"
                            placeholder={t('qc_searchStore')}
                            value={searchStoreTerm}
                            onChange={e => setSearchStoreTerm(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-xl p-2 text-xs font-bold outline-none"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="overflow-y-auto divide-y divide-gray-50 max-h-40">
                          {filteredStoresList.map(st => (
                            <div
                              key={st.id}
                              onClick={() => {
                                setSelectedStoreName(st.name);
                                setIsStoreSelectOpen(false);
                              }}
                              className="p-3 hover:bg-blue-50/70 cursor-pointer transition-colors flex items-center justify-between"
                            >
                              <span className="font-bold text-gray-900">{st.name}</span>
                              <span className="text-[10px] text-gray-400 font-bold uppercase">{st.chain} • {st.city}</span>
                            </div>
                          ))}
                          {filteredStoresList.length === 0 && (
                            <div className="p-3 text-center text-gray-400 text-[11px] font-bold">
                              {t('qc_searchStore')}
                            </div>
                          )}
                        </div>
                        <div 
                          onClick={() => {
                            setSelectedStoreName('custom');
                            setIsStoreSelectOpen(false);
                          }}
                          className="p-3 bg-blue-50 text-blue-800 font-black text-center border-t border-gray-100 hover:bg-blue-100 cursor-pointer transition-colors uppercase tracking-wider text-[10px]"
                        >
                          {t('qc_enterStoreManually')}
                        </div>
                      </div>
                    )}
                  </div>

                  {selectedStoreName === 'custom' && (
                    <div className="pt-2">
                      <input
                        type="text"
                        placeholder={t('qc_enterStoreNamePlaceholder')}
                        value={customStoreName}
                        onChange={e => setCustomStoreName(e.target.value)}
                        className="w-full bg-white border border-blue-300 rounded-xl text-xs p-3 outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                      />
                    </div>
                  )}
                </div>

                {/* Upload Target store photo */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase text-gray-500 tracking-wider">
                    {t('qc_actualShelfPhotoStep')}
                  </label>
                  
                  {!storeImage ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-2xl p-4 hover:border-blue-500 hover:bg-blue-50/30 transition-all text-center cursor-pointer relative bg-gray-50/50 h-[104px] flex flex-col justify-center items-center">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleStoreImageUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <Upload className="w-6 h-6 text-blue-600 mb-1" />
                      <span className="text-xs font-black text-gray-800">{t('qc_uploadStorePhoto')}</span>
                      <span className="text-[9px] text-gray-400 font-bold">{t('qc_clickOrDrag')}</span>
                    </div>
                  ) : (
                    <div className="relative rounded-2xl overflow-hidden border border-blue-200 aspect-video group shadow-xs">
                      <img src={storeImage} className="w-full h-full object-cover" alt="Store preview" />
                      <button
                        onClick={() => setStoreImage(null)}
                        className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-xl shadow-lg hover:bg-red-700 transition-all"
                        title={t('qc_deletePlanogram')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <div className="absolute inset-x-0 bottom-0 bg-black/70 backdrop-blur-xs p-1.5 text-[10px] text-white font-bold truncate text-center">
                        {storeImageName}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action trigger button */}
              <div className="pt-2 border-t border-blue-100">
                <button
                  onClick={handleAnalyzeStore}
                  disabled={isAnalyzing || !storeImage || (!selectedStoreName || (selectedStoreName === 'custom' && !customStoreName))}
                  className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-400 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex justify-center items-center gap-2 hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200 active:scale-[0.99]"
                >
                  {isAnalyzing ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      {t('qc_comparingWithPlanogram', { name: activeTemplate.name })}
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="w-4 h-4" />
                      {t('qc_runAiComparison')}
                    </>
                  )}
                </button>

                {analysisError && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2 leading-relaxed font-bold">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>{analysisError}</div>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* ======================================================== */}
          {/* LOGICAL BLOCK C: VÝSLEDKY AUDITOV & POROVNANIE SIDE-BY-SIDE */}
          {/* ======================================================== */}
          <div className="bg-white rounded-3xl border border-gray-150 shadow-xs p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-purple-600 text-white shadow-2xs">
                  <ClipboardList className="w-3 h-3" />
                  {t('qc_partCTitle')}
                </span>
                <h3 className="font-black text-gray-900 text-lg mt-1 tracking-tight">
                  {t('qc_complianceEvaluationTitle', { count: filteredSubmissions.length })}
                </h3>
              </div>

              {/* Filter tabs */}
              <div className="flex bg-gray-100 p-1.5 rounded-2xl border border-gray-200 text-xs font-black">
                <button
                  onClick={() => setScoreFilter('all')}
                  className={`px-3.5 py-1.5 rounded-xl transition-all ${scoreFilter === 'all' ? 'bg-gray-900 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  {t('qc_allFilter', { count: activeTemplate.submissions.length })}
                </button>
                <button
                  onClick={() => setScoreFilter('compliant')}
                  className={`px-3.5 py-1.5 rounded-xl transition-all ${scoreFilter === 'compliant' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-700 hover:bg-emerald-50'}`}
                >
                  {t('qc_compliantFilter')}
                </button>
                <button
                  onClick={() => setScoreFilter('noncompliant')}
                  className={`px-3.5 py-1.5 rounded-xl transition-all ${scoreFilter === 'noncompliant' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-700 hover:bg-rose-50'}`}
                >
                  {t('qc_nonCompliantFilter')}
                </button>
              </div>
            </div>

            {/* Submissions list */}
            {filteredSubmissions.length === 0 ? (
              <div className="py-16 text-center text-gray-400 text-xs flex flex-col items-center justify-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                <ClipboardList className="w-10 h-10 text-gray-300 mb-2" />
                <p className="font-extrabold text-gray-700 text-sm">{t('qc_noAuditsFilter')}</p>
                <p className="text-gray-400 mt-1">{t('qc_noAuditsFilterSub')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredSubmissions.map(sub => {
                  const isSuccess = sub.status === 'success';
                  const isAnalyzingSub = sub.status === 'analyzing';
                  const isError = sub.status === 'error';
                  const isLowCompliance = isSuccess && (sub.complianceScore ?? 0) < 80;
                  const isExpanded = expandedSubmissionId === sub.id;

                  return (
                    <div
                      key={sub.id}
                      className={`rounded-3xl border transition-all overflow-hidden ${
                        isAnalyzingSub ? 'bg-blue-50/30 border-blue-200 animate-pulse' :
                        isError ? 'bg-red-50/30 border-red-200' :
                        isLowCompliance ? 'bg-rose-50/20 border-rose-200 shadow-2xs' : 
                        'bg-white border-gray-200 hover:border-gray-300 shadow-2xs'
                      }`}
                    >
                      {/* Compact Header row */}
                      <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                          {/* Image preview thumbnail */}
                          <div className="w-14 h-14 rounded-2xl bg-gray-100 border border-gray-200 overflow-hidden relative shrink-0">
                            {sub.imageUrl ? (
                              <img src={sub.imageUrl} className="w-full h-full object-cover" alt={sub.storeName} />
                            ) : (
                              <Upload className="w-5 h-5 text-gray-400 m-4" />
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-extrabold text-gray-900 text-sm">{sub.storeName}</h4>
                              <span className="text-[10px] text-gray-400 font-bold bg-gray-100 px-2 py-0.5 rounded-md">
                                {new Date(sub.createdAt).toLocaleDateString()} {new Date(sub.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 font-medium mt-0.5">
                              Porovnávané voči vzoru: <strong className="text-gray-800">{activeTemplate.name}</strong>
                            </p>
                          </div>
                        </div>

                        {/* Status/Compliance Badge results */}
                        <div className="flex items-center gap-3 self-end sm:self-center">
                          {isAnalyzingSub && (
                            <div className="flex items-center gap-1.5 text-xs text-blue-700 font-black bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl animate-pulse">
                              <RotateCw className="w-3.5 h-3.5 animate-spin" />
                              {t('qc_evaluatingCompliance')}
                            </div>
                          )}

                          {isError && (
                            <div className="flex items-center gap-1.5 text-xs text-red-700 font-black bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl">
                              <XCircle className="w-4 h-4 text-red-600" />
                              Chyba
                            </div>
                          )}

                          {isSuccess && (
                            <div className="flex items-center gap-2">
                              {/* Compliance score pill */}
                              <div className={`px-4 py-1.5 rounded-xl text-xs font-black tracking-wide flex items-center gap-1.5 shadow-xs ${
                                isLowCompliance 
                                  ? 'bg-rose-600 text-white shadow-rose-200' 
                                  : 'bg-emerald-600 text-white shadow-emerald-200'
                              }`}>
                                {isLowCompliance ? (
                                  <AlertTriangle className="w-4 h-4" />
                                ) : (
                                  <Check className="w-4 h-4" />
                                )}
                                <span>{t('qc_complianceScore', { score: sub.complianceScore })}</span>
                                <span className="opacity-80 text-[10px] font-extrabold uppercase border-l border-white/30 pl-1.5 ml-0.5">
                                  {isLowCompliance ? t('qc_nonCompliantBadge') : t('qc_compliantBadge')}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Control actions */}
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleReanalyzeSubmission(sub)}
                              disabled={reanalyzingSubId === sub.id || isAnalyzing || isBulkReanalyzing}
                              className="p-2 text-lime-800 bg-lime-50 hover:bg-lime-100 disabled:opacity-50 rounded-xl transition-all font-bold text-xs flex items-center gap-1.5"
                              title="Preanalyzovať znova s aktuálnym planogramom a manuálom"
                            >
                              <RotateCw className={`w-3.5 h-3.5 ${reanalyzingSubId === sub.id ? 'animate-spin text-lime-600' : ''}`} />
                              <span className="hidden md:inline">{t('qc_runAgain')}</span>
                            </button>
                            <button
                              onClick={() => setComparisonModalSubmission(sub)}
                              className="p-2 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all font-bold text-xs flex items-center gap-1"
                              title={t('qc_compare')}
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                              <span className="hidden md:inline">{t('qc_compare')}</span>
                            </button>
                            <button
                              onClick={() => setExpandedSubmissionId(isExpanded ? null : sub.id)}
                              className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
                              title={t('qc_details')}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSubmission(sub.id)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                              title={t('qc_deleteReport')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Report Panel Details with Side-By-Side Visual Comparison */}
                      {isExpanded && (
                        <div className="border-t border-gray-150 p-6 bg-gradient-to-b from-gray-50 to-white animate-fade-in space-y-6">
                          
                          {/* VISUAL SIDE BY SIDE COMPARISON PREVIEW */}
                          {isSuccess && (
                            <div className="space-y-4">
                              <h5 className="text-xs font-black uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                                <ArrowRightLeft className="w-4 h-4 text-lime-600" />
                                {t('qc_sideBySideTitle')}
                              </h5>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* LEFT: Reference Planogram */}
                                <div className="bg-white p-4 rounded-2xl border-2 border-lime-300 shadow-xs space-y-2">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-lime-800 bg-lime-100 px-2.5 py-0.5 rounded-md">
                                      {t('qc_sampleA')}
                                    </span>
                                    <span className="text-[10px] text-gray-400 font-bold">{t('qc_goldStandard')}</span>
                                  </div>
                                  <div className="aspect-video rounded-xl overflow-hidden bg-gray-100 border border-gray-200 relative group">
                                    {activeTemplate.referenceImages?.[0] && (
                                      <img 
                                        src={activeTemplate.referenceImages[0]} 
                                        className="w-full h-full object-cover cursor-zoom-in" 
                                        onClick={() => setPreviewImage(activeTemplate.referenceImages[0])}
                                        alt="Reference planogram"
                                      />
                                    )}
                                  </div>
                                  <p className="text-[11px] text-gray-600 font-semibold line-clamp-2">
                                    <strong>Manuál:</strong> {activeTemplate.description || 'Bez textových pokynov'}
                                  </p>
                                </div>

                                {/* RIGHT: Store photo */}
                                <div className={`p-4 rounded-2xl border-2 shadow-xs space-y-2 bg-white ${isLowCompliance ? 'border-rose-300' : 'border-emerald-300'}`}>
                                  <div className="flex justify-between items-center">
                                    <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md ${
                                      isLowCompliance ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                                    }`}>
                                      {t('qc_sampleB', { store: sub.storeName })}
                                    </span>
                                    <span className="text-[10px] font-black text-gray-500">
                                      Zhoda: {sub.complianceScore}%
                                    </span>
                                  </div>
                                  <div className="aspect-video rounded-xl overflow-hidden bg-gray-100 border border-gray-200 relative group">
                                    <img 
                                      src={sub.imageUrl} 
                                      className="w-full h-full object-cover cursor-zoom-in" 
                                      onClick={() => setPreviewImage(sub.imageUrl)}
                                      alt="Store sample"
                                    />
                                  </div>
                                  <p className="text-[11px] text-gray-600 font-semibold">
                                    <strong>Snímka:</strong> {sub.fileName || 'Fotografia z terénu'}
                                  </p>
                                </div>
                              </div>

                              {/* AI Reason & Discrepancy analysis */}
                              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-2">
                                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">
                                  {t('qc_aiReasonHeader')}
                                </span>
                                <div className="text-xs text-gray-800 leading-relaxed font-medium whitespace-pre-wrap">
                                  <TranslatedText text={sub.reason || 'Slovné hodnotenie nebolo k dispozícii.'} targetLanguage={language} />
                                </div>
                              </div>
                            </div>
                          )}

                          {isError && (
                            <div className="text-xs text-red-700 bg-red-50 border border-red-200 p-4 rounded-2xl font-bold">
                              Analýza zlyhala: <span>{sub.error || 'Neznáma chyba pri porovnávaní.'}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* FULL RESOLUTION COMPARISON MODAL */}
      {comparisonModalSubmission && activeTemplate && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-8 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-6xl w-full max-h-[92vh] overflow-y-auto p-6 md:p-8 space-y-6 text-left shadow-2xl relative border border-gray-200">
            <button
              onClick={() => setComparisonModalSubmission(null)}
              className="absolute top-5 right-5 p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-gray-100 pb-4 pr-10">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 border border-purple-100 px-3 py-1 rounded-lg">
                {t('qc_detailedSideBySide')}
              </span>
              <h3 className="text-xl font-black text-gray-900 mt-2">
                {t('qc_auditVsPlanogram', { store: comparisonModalSubmission.storeName, name: activeTemplate.name })}
              </h3>
              <p className="text-xs text-gray-500 font-bold mt-0.5">
                {t('qc_calculatedMatch', { score: comparisonModalSubmission.complianceScore, date: new Date(comparisonModalSubmission.createdAt).toLocaleString() })}
              </p>
            </div>

            {/* SIDE BY SIDE IMAGES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Standard */}
              <div className="space-y-3 bg-lime-50/30 p-4 rounded-2xl border border-lime-200">
                <div className="flex justify-between items-center">
                  <h4 className="font-extrabold text-xs uppercase tracking-wider text-lime-900">1. {t('qc_sampleA')}</h4>
                  <span className="text-[10px] font-black text-lime-700 bg-lime-100 px-2 py-0.5 rounded-md">Referencia</span>
                </div>
                {activeTemplate.referenceImages?.[0] && (
                  <div className="rounded-xl overflow-hidden bg-black/5 border border-gray-200 aspect-video">
                    <img src={activeTemplate.referenceImages[0]} className="w-full h-full object-contain" alt="Reference" />
                  </div>
                )}
                <div className="bg-white p-3 rounded-xl border border-lime-200 text-xs text-gray-700 font-medium">
                  <strong>Akceptovaný Manuál:</strong> {activeTemplate.description || 'Bez sprievodného textu.'}
                </div>
              </div>

              {/* Right: Store Photo */}
              <div className="space-y-3 bg-blue-50/30 p-4 rounded-2xl border border-blue-200">
                <div className="flex justify-between items-center">
                  <h4 className="font-extrabold text-xs uppercase tracking-wider text-blue-900">2. {t('qc_sampleB', { store: comparisonModalSubmission.storeName })}</h4>
                  <span className="text-[10px] font-black text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">Auditovaný regál</span>
                </div>
                <div className="rounded-xl overflow-hidden bg-black/5 border border-gray-200 aspect-video">
                  <img src={comparisonModalSubmission.imageUrl} className="w-full h-full object-contain" alt="Store audit" />
                </div>
                <div className="bg-white p-3 rounded-xl border border-blue-200 text-xs text-gray-700 font-medium">
                  <strong>Súbor:</strong> {comparisonModalSubmission.fileName}
                </div>
              </div>
            </div>

            {/* Detailed commentary */}
            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 space-y-2">
              <h5 className="text-xs font-black uppercase text-gray-700 tracking-wider">{t('qc_aiReasonHeader')}</h5>
              <div className="text-xs text-gray-800 leading-relaxed font-medium whitespace-pre-wrap">
                <TranslatedText text={comparisonModalSubmission.reason || 'Bez popisu.'} targetLanguage={language} />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setComparisonModalSubmission(null)}
                className="px-6 py-2.5 bg-gray-900 text-white font-black text-xs uppercase tracking-wider rounded-xl hover:bg-black transition-all"
              >
                {t('qc_closeComparison')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN SINGLE IMAGE PREVIEW */}
      {previewImage && (
        <div 
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 cursor-zoom-out animate-fade-in"
        >
          <img src={previewImage} className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" alt="Preview" />
          <button 
            onClick={() => setPreviewImage(null)}
            className="absolute top-5 right-5 p-3 bg-white/20 text-white hover:bg-white/40 rounded-full transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

    </div>
  );
};
