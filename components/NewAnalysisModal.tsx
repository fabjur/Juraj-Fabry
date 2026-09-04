import React, { useState, useEffect } from 'react';
import { useTranslation } from '../i18n/index.tsx';
import { CloseIcon, TagIcon, ChartPieIcon, ClipboardDocumentListIcon, UploadIcon, TrashIcon, RocketLaunchIcon, TableCellsIcon, CpuChipIcon, SparklesIcon, ShieldCheckIcon } from './Icons.tsx';
import type { AnalysisType } from '../hooks/useImageAnalysis.ts';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getCatalogCategories } from '../db.ts';

interface NewAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string, type: AnalysisType, model: string, files: File[], productCategory?: string, qualityCheckId?: string) => void;
  initialFiles: File[];
}

export const NewAnalysisModal: React.FC<NewAnalysisModalProps> = ({ isOpen, onClose, onConfirm, initialFiles }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [selectedType, setSelectedType] = useState<AnalysisType>('both');
  const [selectedModel, setSelectedModel] = useState('gemini-3.6-flash');
  const [files, setFiles] = useState<File[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedQualityCheckId, setSelectedQualityCheckId] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  const qualityChecks = useLiveQuery(() => db.quality_checks.orderBy('createdAt').reverse().toArray()) || [];

  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      const formattedDate = `${today.getDate()}.${today.getMonth() + 1}.${today.getFullYear()}`;
      const formattedTime = `${today.getHours()}:${String(today.getMinutes()).padStart(2, '0')}`;
      setName(`${t('analysis')} ${formattedDate} ${formattedTime}`);
      setSelectedCategory('');
      setSelectedQualityCheckId('');
      
      if (initialFiles && initialFiles.length > 0) {
        setFiles(initialFiles);
      } else {
        setFiles([]);
      }

      // Fetch product categories dynamically from the catalog + standards
      getCatalogCategories()
        .then(cats => setCategories(cats))
        .catch(err => console.error('Failed to load catalog categories', err));
    }
  }, [isOpen, t, initialFiles]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      if (droppedFiles.length > 0) {
        setFiles(prev => [...prev, ...droppedFiles]);
      }
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setFiles([]);
  };

  const handleStart = () => {
    if (name.trim() && files.length > 0) {
      onConfirm(name.trim(), selectedType, selectedModel, files, selectedCategory || undefined, selectedQualityCheckId || undefined);
    }
  };

  const types = [
    { id: 'price', icon: TagIcon, label: t('analysisTypePriceButton'), desc: t('analysisTypePriceDescription') },
    { id: 'shelfShare', icon: ChartPieIcon, label: t('analysisTypeShelfShareButton'), desc: t('analysisTypeShelfShareDescription') },
    { id: 'osa', icon: TableCellsIcon, label: t('analysisTypeOsaButton'), desc: t('analysisTypeOsaDescription') },
    { id: 'both', icon: ClipboardDocumentListIcon, label: t('analysisTypeBothButton'), desc: t('analysisTypeBothDescription') },
    { id: 'qualityCheck', icon: ShieldCheckIcon, label: t('qualityCheck'), desc: t('qualityCheckDesc') || 'Kontrola dodržania správnej formy zobrazenia výrobkov a planogramu.' },
  ];

  const models = [
    { 
      id: 'gemini-3.6-flash', 
      label: t('modelFlash36') || 'Gemini 3.6 Flash', 
      desc: t('modelFlash36Desc') || 'Odporúčaný hlavný model pre bleskové rozpoznávanie regálov, cien (OSP) a podielu na regáli (SOS).', 
      speed: '🚀',
      badge: 'Odporúčaný'
    },
    { 
      id: 'gemini-3.1-flash-lite', 
      label: t('modelFlashLite31') || 'Gemini 3.1 Flash-Lite', 
      desc: t('modelFlashLite31Desc') || 'Ekonomicky najvýhodnejší model s ultra-nízkymi nákladmi na token pre veľkoobjemové OSA audity.', 
      speed: '⚡',
      badge: 'Low-Cost'
    },
    { 
      id: 'gemini-3.6-pro', 
      label: t('modelPro36') || 'Gemini 3.6 Pro', 
      desc: t('modelPro36Desc') || 'Maximálna analytická presnosť pre zložité husté regály, slabé osvetlenie a kontrolu plánogramov.', 
      speed: '🧠',
      badge: 'Pro Presnosť'
    },
    { 
      id: 'gemini-2.5-flash', 
      label: t('modelFlash25') || 'Gemini 2.5 Flash (Legacy)', 
      desc: t('modelFlash25Desc') || 'Tradičný stabilný model predchádzajúcej generácie.', 
      speed: '⏱️',
      badge: 'Legacy'
    }
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in" role="dialog" aria-modal="true">
      <div className="bg-white rounded-[2.25rem] shadow-2xl w-full max-w-4xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/40">
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-lime-600" />
            {t('startNewAnalysis')}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-8">
          {/* Step 1: Name */}
          <section>
            <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">{t('analysisName')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-lime-500 focus:ring-lime-500 text-lg py-3 px-4 bg-gray-50 border"
              placeholder={t('analysisNamePlaceholder')}
            />
          </section>

          {/* Step 2: Model Selection */}
          <section>
            <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                <CpuChipIcon className="w-4 h-4 text-lime-600" />
                {t('selectModel')}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {models.map(m => (
                    <button
                        key={m.id}
                        onClick={() => setSelectedModel(m.id)}
                        className={`text-left p-4 rounded-xl border-2 transition-all flex flex-col justify-between ${
                            selectedModel === m.id 
                            ? 'border-lime-500 bg-lime-50 shadow-md ring-1 ring-lime-500' 
                            : 'border-gray-100 hover:border-gray-300 bg-white'
                        }`}
                    >
                        <div>
                            <div className="flex justify-between items-start mb-2 gap-1">
                                <h4 className={`font-bold text-xs ${selectedModel === m.id ? 'text-lime-900' : 'text-gray-800'}`}>{m.label}</h4>
                                <div className="flex items-center gap-1 shrink-0">
                                    {m.badge && (
                                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                                            selectedModel === m.id ? 'bg-lime-200 text-lime-900' : 'bg-gray-100 text-gray-600'
                                        }`}>
                                            {m.badge}
                                        </span>
                                    )}
                                    <span className="text-xs">{m.speed}</span>
                                </div>
                            </div>
                            <p className="text-[10px] text-gray-500 leading-tight">{m.desc}</p>
                        </div>
                        {selectedModel === m.id && (
                            <div className="mt-2 text-[9px] font-bold text-lime-600 uppercase tracking-widest flex items-center gap-1">
                                <SparklesIcon className="w-3 h-3" /> vybrané
                            </div>
                        )}
                    </button>
                ))}
            </div>
          </section>

          {/* Step 3: Type Selection */}
          <section>
            <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">{t('analysis_mode')}</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {types.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id as AnalysisType)}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                    selectedType === type.id 
                      ? 'border-lime-500 bg-lime-50 ring-1 ring-lime-500' 
                      : 'border-gray-200 hover:border-lime-300 bg-white'
                  }`}
                >
                  <type.icon className={`w-8 h-8 mb-3 ${selectedType === type.id ? 'text-lime-600' : 'text-gray-400'}`} />
                  <h3 className={`font-bold text-sm ${selectedType === type.id ? 'text-lime-900' : 'text-gray-800'}`}>{type.label}</h3>
                  <p className="text-[10px] text-gray-500 mt-1 leading-relaxed line-clamp-2">{type.desc}</p>
                </button>
              ))}
            </div>
          </section>

          {/* Step 3.5: Conditional Configuration Section based on active mode */}
          {selectedType === 'qualityCheck' ? (
            <section className="bg-gradient-to-br from-lime-50/30 to-white p-6 rounded-2xl border border-lime-100 shadow-sm animate-fade-in space-y-4">
              <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                🏠 {t('referencePlanogram') || 'Vzorový Planogram z databázy'}
              </label>
              {qualityChecks.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-semibold leading-relaxed">
                  Zatiaľ nemáte vytvorený žiadny vzorový planogram. Prosím, vytvorte si ho najskôr v paneli <strong>"Planogram Quality Check"</strong> v hlavnom menu, aby ste ho mohli zvoliť pre túto analýzu.
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={selectedQualityCheckId}
                    onChange={(e) => setSelectedQualityCheckId(e.target.value)}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-lime-500 focus:ring-lime-500 text-base py-3 px-4 bg-white border appearance-none cursor-pointer pr-10 font-bold text-gray-800"
                  >
                    <option value="">-- {t('selectPlanogramFallback') || 'Vyberte najnovší / predvolený vzor --'}</option>
                    {qualityChecks.map((qc) => (
                      <option key={qc.id} value={qc.id}>
                        {qc.name} ({qc.description ? qc.description.slice(0, 50) + '...' : 'Len referenčné fotky'})
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                    </svg>
                  </div>
                </div>
              )}
              <p className="text-xs text-gray-400 font-medium">
                Služba automaticky porovná nahrané testované snímky predajní s vybraným špecifikovaným vzorom a slovným manuálom, určí percentuálnu mieru zhody a popíše zistené nedostatky.
              </p>
            </section>
          ) : (
            <section className="bg-gradient-to-br from-gray-50 to-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                <TagIcon className="w-4 h-4 text-lime-600" />
                Kategória auditovaného tovaru
              </label>
              <div className="relative">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-lime-500 focus:ring-lime-500 text-base py-3 px-4 bg-white border appearance-none cursor-pointer pr-10 font-bold text-gray-800"
                >
                  <option value="">Všetky kategórie (Všeobecná analýza)</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2 font-medium">
                Systém automaticky zvolí optimalizovaný prompt pre vybranú kategóriu produktov (napr. káva, nápoje, čokoláda) na zvýšenie presnosti rozpoznávania objektov a cien.
              </p>
            </section>
          )}

          {/* Step 4: Files */}
          <section>
            <div className="flex justify-between items-center mb-3">
              <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider">{t('images')}</label>
              {files.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-500">
                    {files.length} {files.length === 1 ? 'snímka' : files.length < 5 ? 'snímky' : 'snímok'} ({(files.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)).toFixed(1)} MB)
                  </span>
                  <button
                    type="button"
                    onClick={clearAllFiles}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline"
                  >
                    Vymazať všetko
                  </button>
                </div>
              )}
            </div>
            
            {files.length === 0 ? (
              <label 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`w-full py-10 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                  isDragging 
                    ? 'border-lime-500 bg-lime-50/80 scale-[1.01]' 
                    : 'border-slate-300 bg-slate-50/80 hover:bg-slate-100/70 hover:border-lime-400'
                }`}
              >
                <div className="p-3 bg-white rounded-2xl shadow-3xs border border-slate-200/60 mb-2">
                  <UploadIcon className="w-8 h-8 text-lime-600" />
                </div>
                <span className="font-bold text-slate-800 text-sm">{isDragging ? 'Pustite fotky sem' : t('uploadFiles')}</span>
                <span className="text-xs text-slate-400 mt-1 font-medium">{t('fileFormats')} (alebo potiahnite myšou)</span>
                <input type="file" className="hidden" multiple accept="image/*" onChange={handleFileChange} />
              </label>
            ) : (
              <div className="space-y-3">
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-56 overflow-y-auto p-2 rounded-2xl border transition-all ${
                    isDragging ? 'border-lime-500 bg-lime-50/40' : 'border-slate-200/80 bg-slate-50/40'
                  }`}
                >
                  {files.map((file, idx) => {
                    const objectUrl = URL.createObjectURL(file);
                    const sizeKb = Math.round(file.size / 1024);
                    return (
                      <div key={idx} className="relative group bg-white border border-slate-200/80 rounded-xl p-1.5 shadow-3xs hover:shadow-xs transition-all overflow-hidden flex flex-col">
                        <div className="h-20 w-full bg-slate-100 rounded-lg overflow-hidden relative">
                          <img 
                            src={objectUrl} 
                            alt={file.name} 
                            className="w-full h-full object-cover"
                            onLoad={() => URL.revokeObjectURL(objectUrl)}
                          />
                          <span className="absolute bottom-1 left-1 bg-slate-900/80 backdrop-blur-xs text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                            {sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1 px-1">
                          <span className="text-[11px] font-semibold text-slate-700 truncate" title={file.name}>
                            {file.name}
                          </span>
                          <button 
                            type="button" 
                            onClick={() => removeFile(idx)} 
                            className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors"
                            title="Odstrániť snímku"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end">
                  <label 
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-lime-700 bg-lime-50 hover:bg-lime-100 rounded-xl border border-lime-200 transition-colors cursor-pointer"
                  >
                    <UploadIcon className="w-3.5 h-3.5" /> {t('addMore')}
                    <input type="file" className="hidden" multiple accept="image/*" onChange={handleFileChange} />
                  </label>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="p-5 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-3 z-10">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-slate-800 hover:bg-slate-50 text-xs font-black uppercase tracking-wider transition-colors active:scale-95"
          >
            {t('cancelButton')}
          </button>
          <button
            onClick={handleStart}
            disabled={!name.trim() || files.length === 0}
            className="px-6 py-2.5 bg-lime-600 text-white text-xs font-black uppercase tracking-wider rounded-xl hover:bg-lime-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed shadow-md shadow-lime-200/50 transition-all flex items-center gap-2 active:scale-95 hover:-translate-y-0.5"
          >
            <RocketLaunchIcon className="w-4 h-4" />
            {t('startAnalysis')}
          </button>
        </div>
      </div>
    </div>
  );
};
