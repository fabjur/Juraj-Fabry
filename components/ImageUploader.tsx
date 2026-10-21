

import React, { useState } from 'react';
import { UploadIcon, SpinnerIcon } from './Icons.tsx';
import { useTranslation } from '../i18n/index.tsx';

interface ImageUploaderProps {
  onImageUpload: (files: File[]) => void;
  isLoading: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload, isLoading }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const { t } = useTranslation();

  const handleFiles = async (files: File[]) => {
    setErrorMessage(null);
    const validFiles = files.filter(f => {
       if (f.type.startsWith('video/')) return true;
       if (f.size > 10 * 1024 * 1024) {
         setErrorMessage(`Súbor ${f.name} je príliš veľký. Maximálna povolená veľkosť je 10MB.`);
         return false;
       }
       return true;
    });

    if (validFiles.length > 0) {
      onImageUpload(validFiles);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
    e.target.value = '';
  };

  const handleDragEvents = (e: React.DragEvent<HTMLDivElement>, dragging: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(dragging);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    handleDragEvents(e, false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto text-center font-sans animate-fade-in">
      <div 
        className={`relative block w-full rounded-[2.5rem] border-2 border-dashed p-16 text-center transform transition-all duration-300 ${
          isDragging 
            ? 'border-lime-500 bg-lime-50/50 scale-[1.01] shadow-lg shadow-lime-100/50' 
            : 'border-slate-200 hover:border-lime-400 bg-white hover:shadow-xl hover:shadow-gray-100/80 hover:-translate-y-0.5'
        }`}
        onDragEnter={(e) => handleDragEvents(e, true)}
        onDragLeave={(e) => handleDragEvents(e, false)}
        onDragOver={(e) => handleDragEvents(e, true)}
        onDrop={handleDrop}
      >
        {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-4 py-8">
                <div className="relative">
                  <div className="bg-blue-600/10 p-6 rounded-3xl border border-blue-500/30">
                    <SpinnerIcon className="w-12 h-12 text-blue-600 animate-spin" />
                  </div>
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500"></span>
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="block text-base font-black text-slate-900 dark:text-zinc-100 uppercase tracking-wider flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                    Prebieha analýza fotografií...
                  </p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 font-bold">AI model rozpoznáva produkty, regálové štítky, POS materiály a ceny</p>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-750 rounded-full text-[11px] font-extrabold border border-blue-200">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
                  Spracúvanie na pozadí aktívne
                </div>
            </div>
        ) : (
            <div className="flex flex-col items-center justify-center">
                <div className={`p-6 rounded-3xl mb-6 transition-all duration-300 ${isDragging ? 'bg-lime-100 text-lime-600 scale-110' : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}>
                    <UploadIcon className="h-10 w-10 transition-transform duration-300" />
                </div>
                <h3 className="text-lg font-black text-slate-800 dark:text-zinc-200 mb-2 tracking-tight">
                    <label htmlFor="file-upload" className="relative cursor-pointer rounded-xl font-black text-lime-600 hover:text-lime-700 focus-within:outline-none focus:ring-2 focus:ring-lime-500 transition-colors">
                        <span>{t('uploadFiles')}</span>
                        <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/png, image/jpeg, video/mp4, video/quicktime" multiple />
                    </label>
                    <span className="text-slate-400 dark:text-zinc-500 font-medium">{` ${t('orDragAndDrop')}`}</span>
                </h3>
                <p className="text-xs text-slate-400 dark:text-zinc-500 tracking-wide font-semibold uppercase mt-1 mb-4">{t('fileFormats')} + MP4/MOV</p>
                
                <div className="flex flex-col gap-2 mt-4 max-w-sm mx-auto text-left bg-zinc-50 dark:bg-zinc-800/60 p-4 rounded-2xl border border-zinc-100">
                    <div className="text-xs font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-widest mb-1 flex items-center gap-1">
                       🎥 Pokyny pre video
                    </div>
                    <ul className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1 list-disc pl-4">
                        <li>Dĺžka ideálne <strong>10 až 15 sekúnd</strong></li>
                        <li>Maximálna veľkosť súboru <strong>10 MB</strong></li>
                        <li>Plynulý, pomalý pohyb kamery pozdĺž regálu</li>
                    </ul>
                </div>
                
                <div className="mt-4 flex items-center gap-2 justify-center bg-lime-50/50 border border-lime-100/30 px-4 py-2 rounded-2xl text-[10px] text-lime-800 font-bold uppercase tracking-wider">
                  ⚡ Lokálne spracovanie na zariadení cez AI
                </div>
            </div>
        )}
      </div>
      {errorMessage && (
        <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold flex items-center justify-between animate-fade-in">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-800 font-bold ml-2">✕</button>
        </div>
      )}
    </div>
  );
};