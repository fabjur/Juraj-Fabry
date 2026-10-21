import React from 'react';
import type { ImageState } from '../hooks/useImageAnalysis';
import { UploadIcon, CircleStackIcon, AppIcon, ArrowPathIcon } from './Icons';
import { useTranslation } from '../i18n/index';

export interface ImagesProductsSidebarProps {
  sidebarView: 'images' | 'products';
  setSidebarView: (view: 'images' | 'products') => void;
  imageStatusFilter: 'all' | 'success' | 'analyzing' | 'error';
  setImageStatusFilter: (filter: 'all' | 'success' | 'analyzing' | 'error') => void;
  imageStats: { all: number; success: number; analyzing: number; error: number };
  retryFailedImages: () => void;
  retrySingleImage: (id: string) => void;
  productSearchTerm: string;
  setProductSearchTerm: (term: string) => void;
  filteredSidebarImages: ImageState[];
  selectedImageId: string | null;
  onSelectImage: (id: string) => void;
  productList: Array<{ name: string; count: number; category: string }>;
  selectedProductName: string | null;
  onSelectProduct: (name: string) => void;
  onOpenUploadOverlay: () => void;
}

export const ImagesProductsSidebar: React.FC<ImagesProductsSidebarProps> = ({
  sidebarView,
  setSidebarView,
  imageStatusFilter,
  setImageStatusFilter,
  imageStats,
  retryFailedImages,
  retrySingleImage,
  productSearchTerm,
  setProductSearchTerm,
  filteredSidebarImages,
  selectedImageId,
  onSelectImage,
  productList,
  selectedProductName,
  onSelectProduct,
  onOpenUploadOverlay,
}) => {
  const { t } = useTranslation();

  return (
    <aside className="lg:col-span-1 bg-white dark:bg-zinc-900 p-3 rounded-xl shadow-2xs border border-zinc-200/80 dark:border-zinc-800 flex flex-col gap-2.5 self-start no-print transition-all duration-200">
      <div className="flex justify-between items-center px-0.5">
        <h3 className="font-bold text-zinc-900 dark:text-zinc-100 uppercase text-[11px] tracking-wider">
          {sidebarView === 'images' ? t('images') : t('products')}
        </h3>
        <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-md">
          <button
            onClick={() => setSidebarView('images')}
            className={`p-1 rounded transition-colors cursor-pointer ${sidebarView === 'images' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs' : 'text-zinc-400 hover:text-zinc-700'}`}
            title={t('images')}
          >
            <AppIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setSidebarView('products')}
            className={`p-1 rounded transition-colors cursor-pointer ${sidebarView === 'products' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs' : 'text-zinc-400 hover:text-zinc-700'}`}
            title={t('products')}
          >
            <CircleStackIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {sidebarView === 'images' && (
        <div className="grid grid-cols-4 gap-0.5 p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-[10px] font-semibold text-center">
          <button
            onClick={() => setImageStatusFilter('all')}
            className={`py-1 rounded-md transition-colors cursor-pointer tabular-nums ${imageStatusFilter === 'all' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs' : 'text-zinc-500 hover:text-zinc-800'}`}
          >
            {t('all') || 'All'} ({imageStats.all})
          </button>
          <button
            onClick={() => setImageStatusFilter('success')}
            className={`py-1 rounded-md transition-colors cursor-pointer tabular-nums ${imageStatusFilter === 'success' ? 'bg-white dark:bg-zinc-900 text-emerald-800 shadow-2xs' : 'text-zinc-500 hover:text-zinc-800'}`}
          >
            OK ({imageStats.success})
          </button>
          <button
            onClick={() => setImageStatusFilter('analyzing')}
            className={`py-1 rounded-md transition-colors cursor-pointer tabular-nums ${imageStatusFilter === 'analyzing' ? 'bg-white dark:bg-zinc-900 text-sky-800 shadow-2xs' : 'text-zinc-500 hover:text-zinc-800'}`}
          >
            AI ({imageStats.analyzing})
          </button>
          <button
            onClick={() => setImageStatusFilter('error')}
            className={`py-1 rounded-md transition-colors cursor-pointer tabular-nums ${imageStatusFilter === 'error' ? 'bg-white dark:bg-zinc-900 text-rose-700 shadow-2xs font-bold' : imageStats.error > 0 ? 'text-rose-600 font-bold' : 'text-zinc-400'}`}
          >
            {t('errors') || 'Errors'} ({imageStats.error})
          </button>
        </div>
      )}

      {sidebarView === 'images' && imageStats.error > 0 && (
        <button
          onClick={retryFailedImages}
          className="w-full py-1 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <ArrowPathIcon className="w-3 h-3" />
          <span>{t('retryFailed') || 'Retry failed'} ({imageStats.error})</span>
        </button>
      )}

      <div className="relative">
        <input
          type="text"
          className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs py-1.5 pl-2.5 pr-7 text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-zinc-900 focus:bg-white dark:focus:bg-zinc-800 transition-colors"
          placeholder={sidebarView === 'images' ? (t('filterPhotosPlaceholder') || 'Filter photos...') : (t('searchProduct') || 'Search product...')}
          value={productSearchTerm}
          onChange={e => setProductSearchTerm(e.target.value)}
        />
        {productSearchTerm && (
          <button
            onClick={() => setProductSearchTerm('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs"
          >
            ✕
          </button>
        )}
      </div>

      <div className="max-h-[calc(100vh-380px)] overflow-y-auto space-y-1 custom-scrollbar pr-0.5">
        {sidebarView === 'images' ? (
          filteredSidebarImages.length === 0 ? (
            <div className="py-6 text-center text-xs text-zinc-400">
              {t('noPhotos') || 'No photos'}
            </div>
          ) : (
            filteredSidebarImages.map(img => (
              <div
                key={img.id}
                onClick={() => onSelectImage(img.id)}
                className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer border transition-colors ${
                  selectedImageId === img.id
                    ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 shadow-2xs'
                    : img.status === 'error'
                    ? 'bg-rose-50/40 border-rose-200 hover:bg-rose-50'
                    : 'bg-white dark:bg-zinc-900/60 border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <div className="relative w-8 h-8 flex-shrink-0">
                  <img
                    src={img.imageUrl}
                    loading="lazy"
                    decoding="async"
                    alt={img.file.name}
                    className="w-8 h-8 object-cover rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-800"
                  />
                  {img.status === 'success' && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border border-white flex items-center justify-center text-white text-[7px] font-bold">
                      ✓
                    </span>
                  )}
                  {img.status === 'error' && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-rose-500 rounded-full border border-white flex items-center justify-center text-white text-[7px] font-bold">
                      !
                    </span>
                  )}
                  {(img.status === 'analyzing' || img.status === 'pending') && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-sky-500 rounded-full border border-white flex items-center justify-center text-white text-[7px] animate-spin">
                      ⟳
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate text-zinc-900 dark:text-zinc-100 leading-tight" title={img.file.name}>
                    {img.file.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {img.status === 'analyzing' ? (
                      <span className="text-[10px] text-sky-600 font-medium">
                        {t('analyzing')}...
                      </span>
                    ) : img.status === 'pending' ? (
                      <span className="text-[10px] text-zinc-400">
                        {t('pendingInQueue') || 'In Queue'}
                      </span>
                    ) : img.status === 'error' ? (
                      <span className="text-[10px] text-rose-600 font-medium truncate max-w-[110px]" title={img.error || (t('error') || 'Error')}>
                        {t('error') || 'Error'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-400 tabular-nums">
                        {img.analysisResult?.products?.length || 0} {t('itemsShort') || 'items'}
                      </span>
                    )}
                  </div>
                </div>
                {img.status === 'error' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      retrySingleImage(img.id);
                    }}
                    className="p-1 px-1.5 my-auto bg-rose-100 hover:bg-rose-200 text-rose-800 rounded text-[10px] font-bold uppercase transition-colors"
                    title={t('retryAnalysis') || 'Retry analysis'}
                  >
                    <ArrowPathIcon className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            ))
          )
        ) : (
          productList.map(p => (
            <button
              key={p.name}
              onClick={() => onSelectProduct(p.name)}
              className={`flex justify-between items-center w-full px-2.5 py-1.5 rounded-lg border text-left transition-colors cursor-pointer ${
                selectedProductName === p.name
                  ? 'bg-zinc-100 border-zinc-300'
                  : 'bg-white dark:bg-zinc-900/60 border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
              }`}
            >
              <span className="text-xs font-medium truncate pr-2 text-zinc-800 dark:text-zinc-200 dark:text-zinc-200">{p.name}</span>
              <span className="text-[10px] font-mono tabular-nums text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 rounded">{p.count}</span>
            </button>
          ))
        )}
      </div>

      <button
        onClick={onOpenUploadOverlay}
        className="w-full h-8 bg-zinc-900 text-white rounded-lg text-xs font-semibold flex justify-center items-center gap-1.5 hover:bg-zinc-800 transition-colors shadow-2xs active:scale-98 cursor-pointer mt-0.5"
      >
        <UploadIcon className="w-3.5 h-3.5" />
        <span>{t('addMoreImages')}</span>
      </button>
    </aside>
  );
};
