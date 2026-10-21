import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { StoreCentricSummary, ProductInStore, PriceInfo } from '../types.ts';
import { getProductHistory } from '../db.ts';
import { useTranslation } from '../i18n/index.tsx';
import { 
  TrendingUp, 
  Store, 
  Package, 
  Calendar, 
  RefreshCw, 
  ChevronRight, 
  ChevronDown, 
  Search, 
  SlidersHorizontal,
  FileSpreadsheet,
  LineChart,
  Grid3X3,
  FileText,
  Image as ImageIcon,
  Edit as EditIcon
} from 'lucide-react';
import { exportToPDF } from '../utils/export.ts';
import Chart from '../utils/chartSetup.ts';

const parsePrice = (priceValue: string): number | null => {
  if (!priceValue) return null;
  const cleaned = priceValue.replace(',', '.').replace(/[^\d.]/g, '');
  const value = parseFloat(cleaned);
  return isNaN(value) ? null : value;
};

const formatPrice = (value: number | null): string => {
  if (value === null) return '-';
  return value.toLocaleString('sk-SK', { style: 'currency', currency: 'EUR' });
};

interface PriceTrendReportBuilderProps {
  _images: any[];
  storeData: StoreCentricSummary[];
  onZoomImage: (url: string) => void;
  _filters: any;
  onCorrectProduct?: (imageId: string, originalName: string, newName: string, prices: PriceInfo[], count: number) => void;
}

export const PriceTrendReportBuilder: React.FC<PriceTrendReportBuilderProps> = ({ 
  storeData, 
  onZoomImage, 
  onCorrectProduct
}) => {
  const { t, language } = useTranslation();
  // Sub-tabs: 'stores' (original view), 'products' (new unique product view)
  // Submenu 'trends' (Trend analyzer & Report Builder) hidden per user request
  const [subTab, setSubTab] = useState<'stores' | 'products'>('stores');
  
  const [editingProductKey, setEditingProductKey] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingRegular, setEditingRegular] = useState('');
  const [editingPromo, setEditingPromo] = useState('');
  const [editingCount, setEditingCount] = useState(0);

  const handleEditClick = (product: ProductInStore, storeName: string) => {
    setEditingProductKey(`${storeName}-${product.type}-${product.name}-${product.isGhost}`);
    setEditingName(product.name);
    
    const regularPrice = product.priceHistory.find(ph => ph.price.type?.toUpperCase() === 'REGULAR')?.price.value || 
                         product.priceHistory.find(ph => ph.price.type && ['regular', 'regular_price', 'regularprice'].includes(ph.price.type.toLowerCase()))?.price.value;
    const promoPrice = product.priceHistory.find(ph => ph.price.type?.toUpperCase() === 'PROMO')?.price.value || 
                       product.priceHistory.find(ph => ph.price.type && ['promo', 'promo_price', 'promoprice', 'action', 'action_price', 'akcia'].includes(ph.price.type.toLowerCase()))?.price.value;
    
    setEditingRegular(regularPrice ? regularPrice.replace('€', '').trim() : '');
    setEditingPromo(promoPrice ? promoPrice.replace('€', '').trim() : '');
    setEditingCount(product.count);
  };

  const handleEditSubmit = (product: ProductInStore) => {
    if (editingName.trim() && onCorrectProduct && product.imageId) {
      const updatedPrices: PriceInfo[] = [];
      const regNum = parsePrice(editingRegular);
      if (regNum !== null && regNum > 0) {
        updatedPrices.push({
          value: `${regNum.toFixed(2)} €`,
          type: 'REGULAR'
        });
      }
      const promoNum = parsePrice(editingPromo);
      if (promoNum !== null && promoNum > 0) {
        updatedPrices.push({
          value: `${promoNum.toFixed(2)} €`,
          type: 'PROMO'
        });
      }
      onCorrectProduct(product.imageId, product.name, editingName.trim(), updatedPrices, editingCount);
    }
    setEditingProductKey(null);
  };

  // Product Centric View States
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [productCampaignHistory, setProductCampaignHistory] = useState<Record<string, any[]>>({});
  const [loadingCampHistory, setLoadingCampHistory] = useState<Record<string, boolean>>({});
  const [campaignToggles, setCampaignToggles] = useState<Record<string, boolean>>({});

  // Trend Builder Workspace States
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedChains, setSelectedChains] = useState<string[]>([]);
  const [compareScope, setCompareScope] = useState<'batch' | 'campaign'>('batch');
  const [selectedMetric, setSelectedMetric] = useState<'all' | 'regular' | 'promo'>('all');
  const [prodSearchTerm, setProdSearchTerm] = useState('');
  
  // Chart and loading states for Campaign Trend Comparison
  const [loadingCampaignData, setLoadingCampaignData] = useState(false);
  const [campaignPoints, setCampaignPoints] = useState<any[]>([]);

  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<any>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const matrixContainerRef = useRef<HTMLDivElement>(null);

  // 1. EXTRACT UNIQUE PRODUCTS IN BATCH (AFTER BASIC FILTERS ARE APPLIED)
  const uniqueProductsInBatch = useMemo(() => {
    const pMap = new Map<string, {
      name: string;
      category: string;
      type: string;
      isGhost?: boolean;
      catalogProductId?: number;
      occurrences: { storeName: string; count: number; priceHistory: any[]; uploadDate: Date; imageUrl: string; imageId: string }[];
    }>();

    storeData.forEach(store => {
      store.products.forEach(p => {
        if (p.isGhost) return;
        const key = p.name;
        if (!pMap.has(key)) {
          pMap.set(key, {
            name: p.name,
            category: p.category,
            type: p.type,
            catalogProductId: p.catalogProductId,
            occurrences: []
          });
        }
        
        const entry = pMap.get(key)!;
        entry.occurrences.push({
          storeName: store.storeName,
          count: p.count,
          priceHistory: p.priceHistory,
          uploadDate: p.priceHistory[0]?.date ? new Date(p.priceHistory[0].date) : new Date(),
          imageUrl: p.imageUrl || '',
          imageId: p.priceHistory[0]?.imageId || ''
        });
      });
    });

    return Array.from(pMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [storeData]);

  // 2. COMPUTE BATCH STATISTICS FOR UNIQUE PRODUCTS
  const productStats = useMemo(() => {
    const stats: Record<string, {
      min: number | null;
      max: number | null;
      avg: number | null;
      totalCount: number;
      storeCount: number;
      prices: { val: number; type: string; date: Date; store: string; imageUrl: string; imageId: string }[];
    }> = {};

    uniqueProductsInBatch.forEach(prod => {
      const allPrices: { val: number; type: string; date: Date; store: string; imageUrl: string; imageId: string }[] = [];
      let totalCount = 0;

      prod.occurrences.forEach(occ => {
        totalCount += occ.count;
        occ.priceHistory.forEach(ph => {
          const numValue = parsePrice(ph.price.value);
          if (numValue !== null) {
            allPrices.push({
              val: numValue,
              type: ph.price.type || 'REGULAR',
              date: ph.date ? new Date(ph.date) : occ.uploadDate,
              store: occ.storeName,
              imageUrl: ph.imageUrl || occ.imageUrl,
              imageId: ph.imageId || ''
            });
          }
        });
      });

      const numericValues = allPrices.map(p => p.val);
      const min = numericValues.length > 0 ? Math.min(...numericValues) : null;
      const max = numericValues.length > 0 ? Math.max(...numericValues) : null;
      const avg = numericValues.length > 0 ? numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length : null;

      stats[prod.name] = {
        min,
        max,
        avg,
        totalCount,
        storeCount: prod.occurrences.length,
        prices: allPrices.sort((a, b) => a.date.getTime() - b.date.getTime())
      };
    });

    return stats;
  }, [uniqueProductsInBatch]);

  // Seed default selections for Report Builder on startup
  useEffect(() => {
    if (uniqueProductsInBatch.length > 0 && selectedProducts.length === 0) {
      // Pick first 3 products as a helpful starting example
      const initialSelection = uniqueProductsInBatch.slice(0, 3).map(p => p.name);
      setSelectedProducts(initialSelection);
    }
  }, [uniqueProductsInBatch, selectedProducts.length]);

  // 3. FETCH FULL STRIPPED DB HISTORICAL TRENDS (CAMPAIGN-WIDE) FOR SINGLE VISUALS OR EXPANDABLES
  const loadSingleProductHistory = async (prodName: string) => {
    if (productCampaignHistory[prodName] || loadingCampHistory[prodName]) return;
    setLoadingCampHistory(prev => ({ ...prev, [prodName]: true }));
    try {
      const historyPoints = await getProductHistory(prodName);
      setProductCampaignHistory(prev => ({ ...prev, [prodName]: historyPoints }));
    } catch (err) {
      console.error("Failed to load history for " + prodName, err);
    } finally {
      setLoadingCampHistory(prev => ({ ...prev, [prodName]: false }));
    }
  };

  // 4. BATCH CAMPAIGN HOOKS FOR MULTI-LINE REPORT WORKSPACE
  useEffect(() => {
    if (compareScope !== 'campaign' || selectedProducts.length === 0) {
      setCampaignPoints([]);
      return;
    }

    let isMounted = true;
    const fetchAllCampaignPoints = async () => {
      setLoadingCampaignData(true);
      try {
        const merged: any[] = [];
        for (const prodName of selectedProducts) {
          const pts = await getProductHistory(prodName);
          pts.forEach(p => {
            merged.push({
              ...p,
              productName: prodName
            });
          });
        }
        if (isMounted) {
          setCampaignPoints(merged);
        }
      } catch (err) {
        console.error("Failed loading multi campaign trends", err);
      } finally {
        if (isMounted) {
          setLoadingCampaignData(false);
        }
      }
    };

    fetchAllCampaignPoints();
    return () => { isMounted = false; };
  }, [selectedProducts, compareScope]);

  // 5. CHART RE-DRAW CONTROLLER (DYNAMIC CHART.JS INJECTOR)
  useEffect(() => {
    if (subTab !== 'trends' || !chartCanvasRef.current) return;

    // Filter points to display inside chart
    const datasets: any[] = [];
    const colors = [
      '#EF4444', // Red-500
      '#3B82F6', // Blue-500
      '#10B981', // Emerald-500
      '#F59E0B', // Amber-500
      '#8B5CF6', // Violet-500
      '#EC4899', // Pink-500
      '#06B6D4', // Cyan-500
      '#F97316', // Orange-500
      '#14B8A6', // Teal-500
      '#6366F1'  // Indigo-500
    ];

    selectedProducts.forEach((prodName, idx) => {
      let pts: { val: number; type: string; date: Date; store: string }[] = [];

      if (compareScope === 'batch') {
        const batchStats = productStats[prodName];
        if (batchStats) {
          pts = batchStats.prices.map(p => ({
            val: p.val,
            type: p.type,
            date: p.date,
            store: p.store
          }));
        }
      } else {
        pts = campaignPoints
          .filter(p => p.productName === prodName)
          .map(p => ({
            val: p.price,
            type: p.type,
            date: new Date(p.date),
            store: p.storeName
          }));
      }

      // Filter by metrics selected
      if (selectedMetric === 'regular') {
        pts = pts.filter(p => p.type === 'REGULAR');
      } else if (selectedMetric === 'promo') {
        pts = pts.filter(p => p.type === 'PROMO');
      }

      if (selectedChains.length > 0) {
        pts = pts.filter(p => selectedChains.some(sc => p.store.toLowerCase().includes(sc.toLowerCase())));
      }

      pts.sort((a, b) => a.date.getTime() - b.date.getTime());

      if (pts.length > 0) {
        datasets.push({
          label: prodName,
          data: pts.map(p => ({ x: p.date, y: p.val, store: p.store, type: p.type })),
          borderColor: colors[idx % colors.length],
          backgroundColor: `${colors[idx % colors.length]}15`,
          borderWidth: 2.5,
          tension: 0.15,
          pointRadius: 5,
          pointHoverRadius: 8,
          pointStyle: 'circle'
        });
      }
    });

    const ctx = chartCanvasRef.current.getContext('2d');
    if (!ctx) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    if (datasets.length === 0) {
      // Clear chart
      return;
    }

    const config = {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 10,
              padding: 12,
              font: { family: 'Inter', weight: 'bold', size: 10 }
            }
          },
          tooltip: {
            padding: 12,
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleFont: { family: 'Inter', weight: 'black', size: 11 },
            bodyFont: { family: 'Inter', size: 11 },
            callbacks: {
              label: function (context: any) {
                const valueStr = context.parsed.y.toLocaleString(language === 'sk' ? 'sk-SK' : 'en-US', { style: 'currency', currency: 'EUR' });
                const typeText = context.raw.type === 'PROMO' ? ` (${t('promoPriceShort') || 'Akcia'})` : '';
                return ` ${context.dataset.label}: ${valueStr}${typeText}`;
              },
              afterLabel: function (context: any) {
                return ` ${t('colStore') || 'Predajňa'}: ${context.raw.store}`;
              }
            }
          }
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: compareScope === 'batch' ? 'day' : 'month',
              tooltipFormat: 'dd.MM.yyyy',
              displayFormats: {
                day: 'dd.MM',
                week: 'dd.MM',
                month: 'MM.yyyy'
              }
            },
            grid: { color: '#f1f5f9' },
            ticks: { font: { family: 'JetBrains Mono', size: 9 }, color: '#64748b' }
          },
          y: {
            grid: { color: '#f1f5f9' },
            ticks: {
              font: { family: 'JetBrains Mono', size: 9 },
              color: '#64748b',
              callback: function (val: any) {
                return val.toLocaleString('sk-SK') + '';
              }
            }
          }
        }
      }
    };

    chartInstanceRef.current = new Chart(ctx, config as any);

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [subTab, selectedProducts, selectedChains, selectedMetric, compareScope, campaignPoints, productStats, language, t]);

  // 6. CSV REPORT GENERATOR EXPORTER (SEMICOLON SEPARATED, SLOVAK EXCEL MATURED)
  const exportCsvReport = () => {
    const rows: string[][] = [];
    rows.push([
      t('colProductName') || 'Produkt',
      t('colCategory') || 'Kategória',
      t('colStore') || 'Predajňa',
      t('colAnalysisDate') || 'Dátum merania',
      t('priceType') || 'Typ ceny',
      `${t('price') || 'Cena'} (EUR)`
    ]);

    selectedProducts.forEach(prodName => {
      let pts: any[];
      const category = uniqueProductsInBatch.find(p => p.name === prodName)?.category || (t('other') || 'Iné');

      if (compareScope === 'batch') {
        pts = productStats[prodName]?.prices.map(p => ({
          val: p.val,
          type: p.type,
          date: p.date,
          store: p.store
        })) || [];
      } else {
        pts = campaignPoints
          .filter(p => p.productName === prodName)
          .map(p => ({
            val: p.price,
            type: p.type,
            date: new Date(p.date),
            store: p.storeName
          }));
      }

      if (selectedMetric === 'regular') {
        pts = pts.filter(p => p.type === 'REGULAR');
      } else if (selectedMetric === 'promo') {
        pts = pts.filter(p => p.type === 'PROMO');
      }

      if (selectedChains.length > 0) {
        pts = pts.filter(p => selectedChains.some(sc => p.store.toLowerCase().includes(sc.toLowerCase())));
      }

      pts.forEach(p => {
        rows.push([
          prodName,
          category,
          p.store,
          p.date.toLocaleDateString(language === 'sk' ? 'sk-SK' : 'en-US'),
          p.type === 'PROMO' ? (t('promoPriceShort') || 'Akciová') : (t('regularPriceShort') || 'Bežná'),
          p.val.toFixed(2).replace('.', ',')
        ]);
      });
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(";")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const dateStr = new Date().toISOString().slice(0,10);
    link.setAttribute("download", `OSP_Pricing_Report_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportMatrixToCsv = () => {
    const rows: string[][] = [];
    rows.push([t('colProductName') || 'Produkt', ...priceGridData.columns]);

    priceGridData.rows.forEach(row => {
      const rowCells = [row.productName];
      priceGridData.columns.forEach(col => {
        const dataCell = row.stores[col];
        if (!dataCell || (dataCell.regular === null && dataCell.promo === null)) {
          rowCells.push('-');
        } else if (dataCell.promo !== null) {
          const promoStr = `${dataCell.promo.toFixed(2).replace('.', ',')}  (${t('promoPriceShort') || 'Akcia'})`;
          const regStr = dataCell.regular !== null ? ` (${t('regularPriceShort') || 'Bežná'}: ${dataCell.regular.toFixed(2).replace('.', ',')} )` : '';
          rowCells.push(`${promoStr}${regStr}`);
        } else {
          rowCells.push(`${dataCell.regular!.toFixed(2).replace('.', ',')} `);
        }
      });
      rows.push(rowCells);
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(";")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const dateStr = new Date().toISOString().slice(0,10);
    link.setAttribute("download", `Cenova_Porovnavacia_Matica_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportMatrixToPdf = () => {
    if (matrixContainerRef.current) {
      exportToPDF(matrixContainerRef.current);
    }
  };

  const exportChartToPdf = () => {
    if (chartContainerRef.current) {
      exportToPDF(chartContainerRef.current);
    }
  };

  const exportChartToPng = () => {
    if (!chartCanvasRef.current) return;
    const imageURI = chartCanvasRef.current.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `Cenova_Krivka_${new Date().toISOString().slice(0,15)}.png`;
    link.href = imageURI;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Unique lists computed for filters in Trend Builder checkboxes
  const uniqueStoreNamesFromStats = useMemo(() => {
    const list = new Set<string>();
    uniqueProductsInBatch.forEach(p => {
      p.occurrences.forEach(occ => list.add(occ.storeName));
    });
    return Array.from(list).sort();
  }, [uniqueProductsInBatch]);

  const filteredTrendProductsList = useMemo(() => {
    return uniqueProductsInBatch.filter(p => 
      p.name.toLowerCase().includes(prodSearchTerm.toLowerCase())
    );
  }, [uniqueProductsInBatch, prodSearchTerm]);

  // 7. MULTI-STORE PRICE COMPARE MATRIX GRID VALUES
  const priceGridData = useMemo(() => {
    const activeProducts = selectedProducts.length > 0 
      ? selectedProducts 
      : uniqueProductsInBatch.map(p => p.name).slice(0, 10); // fallback first 10 for grid

    const activeChains = selectedChains.length > 0
      ? selectedChains
      : uniqueStoreNamesFromStats;

    const gridRows = activeProducts.map(prodName => {
      const storePrices: Record<string, { regular: number | null; promo: number | null; isCheapest?: boolean; isExpensive?: boolean }> = {};

      activeChains.forEach(chain => {
        // Collect points
        let pList: any[];
        if (compareScope === 'batch') {
          pList = (productStats[prodName]?.prices || []).filter(p => p.store === chain);
        } else {
          pList = campaignPoints
            .filter(p => p.productName === prodName && p.storeName === chain)
            .map(p => ({ val: p.price, type: p.type }));
        }

        // Extract regular vs promo
        const regularPoint = pList.filter(p => p.type === 'REGULAR');
        const promoPoint = pList.filter(p => p.type === 'PROMO');

        storePrices[chain] = {
          regular: regularPoint.length > 0 ? regularPoint[regularPoint.length - 1].val : null,
          promo: promoPoint.length > 0 ? promoPoint[promoPoint.length - 1].val : null
        };
      });

      return {
        productName: prodName,
        stores: storePrices
      };
    });

    // Color/highlight lowest vs highest prices for each row
    gridRows.forEach(row => {
      let minVal = Infinity;
      let maxVal = -Infinity;
      
      activeChains.forEach(chain => {
        const pricesObj = row.stores[chain];
        const val = pricesObj.promo !== null ? pricesObj.promo : pricesObj.regular;
        if (val !== null) {
          if (val < minVal) minVal = val;
          if (val > maxVal) maxVal = val;
        }
      });

      if (minVal !== Infinity && maxVal !== -Infinity && minVal !== maxVal) {
        activeChains.forEach(chain => {
          const pricesObj = row.stores[chain];
          const val = pricesObj.promo !== null ? pricesObj.promo : pricesObj.regular;
          if (val === minVal) pricesObj.isCheapest = true;
          if (val === maxVal) pricesObj.isExpensive = true;
        });
      }
    });

    return {
      columns: activeChains,
      rows: gridRows
    };
  }, [selectedProducts, selectedChains, uniqueProductsInBatch, uniqueStoreNamesFromStats, compareScope, campaignPoints, productStats]);

  return (
    <div className="space-y-5">
      {/* Dynamic Sub-tab switcher panel */}
      <div className="flex bg-zinc-100/80 p-1 rounded-xl w-fit gap-1 no-print">
        <button
          onClick={() => setSubTab('stores')}
          className={`px-4 py-2 text-xs font-bold leading-none rounded-lg transition-all flex items-center gap-1.5 ${subTab === 'stores' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 dark:text-zinc-100 shadow-xs' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-100'}`}
        >
          <Store className="w-4 h-4" />
          {t('storeOverview')} ({storeData.length})
        </button>
        <button
          onClick={() => setSubTab('products')}
          className={`px-4 py-2 text-xs font-bold leading-none rounded-lg transition-all flex items-center gap-1.5 ${subTab === 'products' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 dark:text-zinc-100 shadow-xs' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-100'}`}
        >
          <Package className="w-4 h-4" />
          {t('productOverview')} ({uniqueProductsInBatch.length})
        </button>
      </div>

      {/* SUB-TAB 1: STORE-CENTRIC VIEW */}
      {subTab === 'stores' && (
        <div className="space-y-4 max-h-[calc(100vh-420px)] overflow-y-auto pr-3 custom-scrollbar">
          {storeData.length > 0 ? storeData.map(store => {
              return (
                <div key={store.storeName} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 dark:text-zinc-100 shadow-xs overflow-hidden hover:shadow-md transition-all">
                  {/* Store Header */}
                  <div className="bg-zinc-50/80 px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                    <h3 className="font-extrabold text-zinc-900 dark:text-zinc-100 text-sm flex items-center gap-2">
                      <span className="text-sm">🏪</span>
                      {store.storeName}
                      {store.storeCode && (
                        <span className="bg-blue-50 text-blue-700 text-[9px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border border-blue-100">
                          #{store.storeCode}
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center gap-3">
                      {store.products.find(p => p.imageUrl) && (
                        <button
                          type="button"
                          onClick={() => onZoomImage(store.products.find(p => p.imageUrl)!.imageUrl!)}
                          className="text-[10px] font-black text-lime-700 hover:text-lime-800 bg-lime-50 hover:bg-lime-100 border border-lime-200 px-3 py-1 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          📷 {t('viewCameraBtn')}
                        </button>
                      )}
                      <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 border px-2 py-1 rounded-lg">
                        {store.products.length} {t('itemsCount')}
                      </span>
                    </div>
                  </div>
                  
                  {/* Store content list */}
                  <div className="bg-white dark:bg-zinc-900 overflow-x-auto">
                          <table className="w-full text-left border-collapse text-[11px] font-sans">
                            <thead>
                              <tr className="bg-zinc-50/80 text-[9px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider border-b border-zinc-100 select-none">
                                <th className="px-4 py-2 text-left">{t('productName')}</th>
                                <th className="px-4 py-2 text-center w-24">{t('quantity')}</th>
                                <th className="px-4 py-2 text-right w-28">{t('regularPriceCol')}</th>
                                <th className="px-4 py-2 text-right w-28">{t('promoPriceCol')}</th>
                                {onCorrectProduct && <th className="px-4 py-2 text-center w-16">{t('editCol')}</th>}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                              {store.products.map((product, idx) => {
                                const regularPrice = product.priceHistory.find(ph => ph.price.type?.toUpperCase() === 'REGULAR')?.price.value;
                                const promoPrice = product.priceHistory.find(ph => ph.price.type?.toUpperCase() === 'PROMO')?.price.value;
                                const isEditing = editingProductKey === `${store.storeName}-${product.type}-${product.name}-${product.isGhost}`;

                                if (isEditing) {
                                  return (
                                    <tr key={`edit-${idx}`} className="bg-zinc-50/80 border-y border-zinc-200 dark:border-zinc-800">
                                      <td colSpan={onCorrectProduct ? 5 : 4} className="p-2.5">
                                        <div className="flex flex-col gap-2">
                                          <div className="flex flex-col sm:flex-row items-end gap-2">
                                            {/* Name */}
                                            <div className="flex-grow flex flex-col min-w-[150px] w-full">
                                              <label className="text-[9px] text-zinc-500 dark:text-zinc-400 font-bold uppercase mb-0.5">{t('productName')}</label>
                                              <input
                                                type="text"
                                                value={editingName}
                                                onChange={(e) => setEditingName(e.target.value)}
                                                className="bg-white dark:bg-zinc-900 border text-xs font-bold rounded px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-lime-500 font-sans w-full"
                                                autoFocus
                                              />
                                            </div>
                                            {/* Regular Price */}
                                            <div className="w-24 flex flex-col shrink-0">
                                              <label className="text-[9px] text-zinc-500 dark:text-zinc-400 font-bold uppercase mb-0.5">{t('regularPriceCol')}</label>
                                              <input
                                                type="text"
                                                placeholder="1.25"
                                                value={editingRegular}
                                                onChange={(e) => setEditingRegular(e.target.value)}
                                                className="bg-white dark:bg-zinc-900 border text-xs font-bold rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-lime-500 font-sans text-right"
                                              />
                                            </div>
                                            {/* Promo Price */}
                                            <div className="w-24 flex flex-col shrink-0">
                                              <label className="text-[9px] text-red-500 font-bold uppercase mb-0.5">{t('promoActionLabel')}</label>
                                              <input
                                                type="text"
                                                placeholder="0.99"
                                                value={editingPromo}
                                                onChange={(e) => setEditingPromo(e.target.value)}
                                                className="bg-white dark:bg-zinc-900 border text-xs font-bold rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-lime-500 font-sans text-right text-red-650"
                                              />
                                            </div>
                                            {/* Count (ks) */}
                                            <div className="w-28 flex flex-col shrink-0">
                                              <label className="text-[9px] text-zinc-500 dark:text-zinc-400 font-bold uppercase mb-0.5">{t('countPcs')}</label>
                                              <div className="flex items-center border rounded bg-white dark:bg-zinc-900 overflow-hidden h-6.5">
                                                <button 
                                                  type="button"
                                                  onClick={() => setEditingCount(c => Math.max(0, c - 1))}
                                                  className="px-2 h-full bg-zinc-50/80 hover:bg-slate-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold border-r text-xs leading-none"
                                                >-</button>
                                                <input
                                                  type="number"
                                                  value={editingCount}
                                                  onChange={(e) => setEditingCount(Math.max(0, parseInt(e.target.value) || 0))}
                                                  className="w-full text-center border-none text-xs font-bold p-0 focus:ring-0 focus:outline-none h-full outline-hidden bg-transparent"
                                                />
                                                <button 
                                                  type="button"
                                                  onClick={() => setEditingCount(c => c + 1)}
                                                  className="px-2 h-full bg-zinc-50/80 hover:bg-slate-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold border-l text-xs leading-none"
                                                >+</button>
                                              </div>
                                            </div>
                                          </div>

                                          {/* Action buttons */}
                                          <div className="flex justify-end gap-1.5 mt-0.5">
                                            <button
                                              type="button"
                                              onClick={() => setEditingProductKey(null)}
                                              className="px-2 py-0.5 bg-white dark:bg-zinc-900 border rounded text-[9px] font-black uppercase text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                                            >
                                              {t('cancel')}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleEditSubmit(product)}
                                              className="px-2 py-0.5 bg-lime-600 text-white rounded text-[9px] font-black uppercase hover:bg-lime-700"
                                            >
                                              {t('save')}
                                            </button>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                }

                                return (
                                  <tr key={idx} className="group hover:bg-lime-50/15 transition-all text-zinc-700 dark:text-zinc-300">
                                    {/* Product Name */}
                                    <td className="px-4 py-2 font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-[150px] sm:max-w-md">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className={product.isGhost ? 'text-zinc-400 italic font-medium' : ''}>{product.name}</span>
                                        {product.isGhost && (
                                          <span className="bg-amber-50 text-amber-700 text-[8px] px-1 py-0.2 rounded font-bold border border-amber-100/60 shadow-2xs">GHOST</span>
                                        )}
                                        {product.isCorrected && (
                                          <span className="bg-indigo-50 px-1 py-0.2 rounded border border-indigo-100 shadow-2xs text-[8px] font-black text-indigo-700">UPDATED</span>
                                        )}
                                      </div>
                                    </td>

                                    {/* Product count */}
                                    <td className="px-4 py-2 text-center whitespace-nowrap">
                                      <span className="bg-slate-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-extrabold text-[10px] px-1.5 py-0.5 rounded">
                                        {product.count} {t('pcs')}
                                      </span>
                                    </td>

                                    {/* Regular pricing */}
                                    <td className="px-4 py-2 text-right font-mono font-bold text-slate-800 dark:text-zinc-200 whitespace-nowrap">
                                      {regularPrice ? (
                                        <span className={promoPrice ? 'line-through text-zinc-400 font-normal text-[10px]' : 'text-slate-905 font-extrabold'}>
                                          {regularPrice}
                                        </span>
                                      ) : (
                                        <span className="text-zinc-400 italic">-</span>
                                      )}
                                    </td>

                                    {/* Promo pricing */}
                                    <td className="px-4 py-2 text-right font-mono text-red-650 font-black whitespace-nowrap">
                                      {promoPrice ? (
                                        <span className="bg-red-50 border border-red-100 px-1.5 py-0.5 rounded shadow-2xs animate-pulse">
                                          {promoPrice}
                                        </span>
                                      ) : (
                                        <span className="text-zinc-400 italic">-</span>
                                      )}
                                    </td>

                                    {/* Edit triggering actions */}
                                    {onCorrectProduct && product.imageId && (
                                      <td className="px-4 py-2 text-center whitespace-nowrap">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleEditClick(product, store.storeName);
                                          }}
                                          className="p-1 text-zinc-400 hover:text-lime-600 hover:bg-lime-50 rounded border border-transparent hover:border-lime-200 transition-all active:scale-95"
                                          title={t('editProductTooltip')}
                                        >
                                          <EditIcon className="w-3.5 h-3.5" />
                                        </button>
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                  </div>
                </div>
              );
            })
          : (
            <div className="text-center py-16 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
              <span className="text-3xl">🏪</span>
              <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mt-3">{t('noStoresForFilter')}</p>
            </div>
          )}
        </div>
      )}

      {subTab === 'products' && (
        <div className="space-y-4 max-h-[calc(100vh-420px)] overflow-y-auto pr-3 custom-scrollbar">
          {uniqueProductsInBatch.length > 0 ? (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse text-[11px] font-sans">
                <thead>
                  <tr className="bg-zinc-50/80 text-[9px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider border-b border-zinc-100 select-none">
                    <th className="px-4 py-2 text-left">{t('productName')}</th>
                    <th className="px-4 py-2 text-center w-24">{t('photo')}</th>
                    <th className="px-4 py-2 text-center w-28">{t('storeCountCol')}</th>
                    <th className="px-4 py-2 text-center w-24">{t('quantity')}</th>
                    <th className="px-4 py-2 text-right w-24">{t('minPriceCol')}</th>
                    <th className="px-4 py-2 text-right w-24">{t('maxPriceCol')}</th>
                    <th className="px-4 py-2 text-right w-24">{t('avgPriceCol')}</th>
                    <th className="px-4 py-2 text-center w-24">{t('detailsCol')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                  {uniqueProductsInBatch.map((product) => {
                    const stats = productStats[product.name];
                    const isExpanded = expandedProduct === product.name;
                    const fullHistoryToggle = campaignToggles[product.name] || false;
                    const firstImgUrl = product.occurrences[0]?.imageUrl || '';

                    return (
                      <React.Fragment key={product.name}>
                        <tr className="group hover:bg-lime-50/15 transition-all text-zinc-700 dark:text-zinc-300">
                          {/* Product Name */}
                          <td className="px-4 py-2 font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-[150px] sm:max-w-md">
                            {product.name}
                          </td>

                          {/* Photo View Link */}
                          <td className="px-4 py-2 text-center whitespace-nowrap">
                            {firstImgUrl ? (
                              <button
                                type="button"
                                onClick={() => onZoomImage(firstImgUrl)}
                                className="text-lime-600 hover:text-lime-700 hover:underline font-extrabold flex items-center justify-center gap-1 mx-auto"
                                title={t('viewPreview')}
                              >
                                <span>{t('viewCameraBtn')}</span>
                              </button>
                            ) : (
                              <span className="text-zinc-400 italic text-[10px]">{t('noPhoto')}</span>
                            )}
                          </td>

                          {/* Počet predajní */}
                          <td className="px-4 py-2 text-center text-zinc-500 dark:text-zinc-400 font-bold whitespace-nowrap">
                            {stats.storeCount} {t('storesCount')}
                          </td>

                          {/* Product count */}
                          <td className="px-4 py-2 text-center whitespace-nowrap">
                            <span className="bg-slate-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-extrabold text-[10px] px-2 py-0.5 rounded">
                              {stats.totalCount} {t('pcs')}
                            </span>
                          </td>

                          {/* MIN Pricing */}
                          <td className="px-4 py-2 text-right font-mono font-bold text-slate-800 dark:text-zinc-200 whitespace-nowrap">
                            {stats.min !== null ? formatPrice(stats.min) : <span className="text-zinc-400 italic">-</span>}
                          </td>

                          {/* MAX Pricing */}
                          <td className="px-4 py-2 text-right font-mono font-bold text-slate-800 dark:text-zinc-200 whitespace-nowrap">
                            {stats.max !== null ? formatPrice(stats.max) : <span className="text-zinc-400 italic">-</span>}
                          </td>

                          {/* Avg Pricing */}
                          <td className="px-4 py-2 text-right font-mono text-emerald-600 font-black whitespace-nowrap">
                            {stats.avg !== null ? (
                              <span className="bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded shadow-2xs">
                                {formatPrice(stats.avg)}
                              </span>
                            ) : (
                              <span className="text-zinc-400 italic">-</span>
                            )}
                          </td>

                          {/* Expand trigger actions (Detaily) */}
                          <td className="px-4 py-2 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                const nextState = !isExpanded;
                                setExpandedProduct(nextState ? product.name : null);
                                if (nextState) {
                                  loadSingleProductHistory(product.name);
                                }
                              }}
                              className="px-2 py-0.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded text-[9px] font-black uppercase text-slate-600 dark:text-zinc-400 hover:bg-zinc-50/80 flex items-center justify-center gap-1 mx-auto transition-colors"
                            >
                              {isExpanded ? <ChevronDown className="w-3 h-3 text-zinc-700 dark:text-zinc-300" /> : <ChevronRight className="w-3 h-3 text-zinc-700 dark:text-zinc-300" />}
                              {isExpanded ? t('closeDetails') : t('detailsCol')}
                            </button>
                          </td>
                        </tr>

                        {/* Collapsed Section - expanded inside a full-width row */}
                        {isExpanded && (
                          <tr className="bg-zinc-50/80/50">
                            <td colSpan={8} className="p-4 border-t border-b border-zinc-200 dark:border-zinc-800">
                              <div className="space-y-3.5">
                                {/* Header with DB campaign wide timeline switch toggle */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                  <div>
                                    <p className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                                      <Calendar className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                                      {t('productDemandHistory')}
                                    </p>
                                    <p className="text-[10px] text-zinc-400">{t('visualizePriceTimeline')}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
                                      {t('loadFullDbHistory')}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nextT = !fullHistoryToggle;
                                        setCampaignToggles(prev => ({ ...prev, [product.name]: nextT }));
                                        if (nextT) {
                                          loadSingleProductHistory(product.name);
                                        }
                                      }}
                                      className={`w-11 h-6 rounded-full p-1 transition-colors leading-none duration-250 focus:outline-hidden ${fullHistoryToggle ? 'bg-lime-600' : 'bg-slate-300'}`}
                                    >
                                      <div className={`bg-white dark:bg-zinc-900 w-4 h-4 rounded-full shadow-xs transform transition-transform duration-250 ${fullHistoryToggle ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* Left: Dynamic SVG Mini TimeSeries Sparkline visualization */}
                                  <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between h-48">
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                      <TrendingUp className="w-3.5 h-3.5 text-lime-600" /> {t('priceChartTitle')}
                                    </p>
                                    
                                    <div className="flex-1 flex items-end h-28 relative bg-zinc-50/80/50 rounded-lg p-2 overflow-hidden border border-slate-100 dark:border-zinc-800 border-dashed">
                                      {/* Get active points */}
                                      {(() => {
                                        const activePoints = fullHistoryToggle
                                          ? (productCampaignHistory[product.name] || []).map(p => ({ val: p.price, date: new Date(p.date), type: p.type }))
                                          : stats.prices;

                                        if (activePoints.length === 0) {
                                          return (
                                            <div className="absolute inset-0 flex items-center justify-center text-[10px] text-zinc-400 italic">
                                              {loadingCampHistory[product.name] ? t('loadingDbData') : t('noPriceData')}
                                            </div>
                                          );
                                        }

                                        // Sort active points chronologically
                                        const sortedPoints = [...activePoints].sort((a,b) => a.date.getTime() - b.date.getTime());
                                        const minPrice = Math.min(...sortedPoints.map(p => p.val)) * 0.9;
                                        const maxPrice = Math.max(...sortedPoints.map(p => p.val)) * 1.1;
                                        const range = maxPrice - minPrice || 1;

                                        // Inline SVG sparkline path
                                        const width = 360;
                                        const height = 90;
                                        const coords = sortedPoints.map((p, i) => {
                                          const x = sortedPoints.length > 1 ? (i / (sortedPoints.length - 1)) * (width - 24) + 12 : width / 2;
                                          const y = height - ((p.val - minPrice) / range) * (height - 24) - 12;
                                          return { x, y, val: p.val, date: p.date, type: p.type };
                                        });

                                        const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');

                                        return (
                                          <div className="w-full h-full flex flex-col justify-between relative">
                                            <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                                              {/* Grid Lines */}
                                              <line x1="0" y1={height/2} x2={width} y2={height/2} stroke="#f1f5f9" strokeDasharray="3 3" />
                                              
                                              {/* Line path */}
                                              <path d={linePath} fill="none" stroke="#a3e635" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                              
                                              {/* Points */}
                                              {coords.map((c, idx) => (
                                                <g key={idx} className="group/dot cursor-pointer">
                                                  <circle 
                                                    cx={c.x} 
                                                    cy={c.y} 
                                                    r="4" 
                                                    fill={c.type === 'PROMO' ? '#EF4444' : '#3B82F6'} 
                                                    stroke="#ffffff" 
                                                    strokeWidth="1.5"
                                                  />
                                                  <title>{`${c.date.toLocaleDateString()}: ${c.val.toFixed(2)} (${c.type})`}</title>
                                                </g>
                                              ))}
                                            </svg>
                                            
                                            {/* Labels with min and max points indicator */}
                                            <div className="flex justify-between text-[8px] font-mono font-black text-zinc-400 mt-1 uppercase border-t pt-1 border-slate-100 dark:border-zinc-800">
                                              <span>{t('fromLabel')} {sortedPoints[0].date.toLocaleDateString()}</span>
                                              <span className="text-zinc-500 dark:text-zinc-400 font-extrabold bg-slate-100 dark:bg-zinc-800 px-1.5 rounded">{sortedPoints.length} {t('pointsCount')}</span>
                                              <span>{t('toLabel')} {sortedPoints[sortedPoints.length - 1].date.toLocaleDateString()}</span>
                                            </div>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>

                                  {/* Right: Detailed transaction / log table */}
                                  <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden h-48 flex flex-col justify-between">
                                    <div className="overflow-y-auto flex-1 custom-scrollbar">
                                      <table className="w-full text-left border-collapse">
                                        <thead>
                                          <tr className="bg-slate-100/80 sticky top-0 text-[8px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest border-b border-zinc-100">
                                            <th className="p-2 py-2.5">{t('storeCol')}</th>
                                            <th className="p-2">{t('dateCol')}</th>
                                            <th className="p-2 text-right">{t('regularShort')}</th>
                                            <th className="p-2 text-right">{t('promoShort')}</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-[10px] font-sans font-bold">
                                          {(() => {
                                            const list = fullHistoryToggle
                                              ? (productCampaignHistory[product.name] || []).map(p => ({
                                                  store: p.storeName,
                                                  date: new Date(p.date),
                                                  type: p.type,
                                                  val: p.price
                                                }))
                                              : stats.prices.map(p => ({
                                                  store: p.store,
                                                  date: p.date,
                                                  type: p.type,
                                                  val: p.val
                                                }));

                                            if (list.length === 0) {
                                              return (
                                                <tr>
                                                  <td colSpan={4} className="p-4 text-center text-zinc-400 italic">
                                                    {t('noPriceRecords')}
                                                  </td>
                                                </tr>
                                              );
                                            }

                                            return list.map((item, keyIdx) => (
                                              <tr key={keyIdx} className="hover:bg-zinc-50/80/70 transition-colors">
                                                <td className="p-2 truncate max-w-[110px] text-slate-800 dark:text-zinc-200 font-extrabold">{item.store}</td>
                                                <td className="p-2 text-zinc-500 dark:text-zinc-400 font-mono text-[9px]">{item.date.toLocaleDateString()}</td>
                                                <td className="p-2 text-right font-mono text-zinc-700 dark:text-zinc-300">
                                                  {item.type === 'REGULAR' ? formatPrice(item.val) : '-'}
                                                </td>
                                                <td className="p-2 text-right font-semibold font-mono text-red-650">
                                                  {item.type === 'PROMO' ? formatPrice(item.val) : '-'}
                                                </td>
                                              </tr>
                                            ));
                                          })()}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-16 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
              <span className="text-3xl">📦</span>
              <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mt-3">{t('noMatchingProducts')}</p>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: THE COMPREHENSIVE OSP TREND COMPARATOR & REPORT BUILDER */}
      {subTab === 'trends' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-fade-in max-h-[calc(100vh-420px)] overflow-y-auto pr-2 custom-scrollbar">
          
          {/* LEFT: SECTOR FILTERS & SELECTIONS (4 Columns) */}
          <div className="lg:col-span-4 bg-zinc-50/80 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 no-print">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 flex items-center gap-1.5 border-b pb-2">
              <SlidersHorizontal className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
              {t('reportBuilderSettings')}
            </h4>

            {/* Scope selection toggle */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{t('dataBatchScope')}</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setCompareScope('batch')}
                  className={`py-1.5 px-2.5 text-[10px] font-black uppercase tracking-wider rounded-lg border text-center transition-all ${compareScope === 'batch' ? 'bg-slate-900 border-slate-900 text-white shadow-xs' : 'bg-white dark:bg-zinc-900 border-slate-250 text-zinc-700 hover:bg-zinc-50/80'}`}
                >
                  {t('photoBatch')}
                </button>
                <button
                  onClick={() => setCompareScope('campaign')}
                  className={`py-1.5 px-2.5 text-[10px] font-black uppercase tracking-wider rounded-lg border text-center transition-all ${compareScope === 'campaign' ? 'bg-slate-900 border-slate-900 text-white shadow-xs' : 'bg-white dark:bg-zinc-900 border-slate-250 text-zinc-700 hover:bg-zinc-50/80'}`}
                >
                  {t('allFromDb')}
                </button>
              </div>
            </div>

            {/* Metric select */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{t('analyzedPriceType')}</label>
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value as any)}
                className="w-full bg-white dark:bg-zinc-900 border border-slate-250 font-bold text-xs p-2 rounded-lg text-slate-800 dark:text-zinc-200"
              >
                <option value="all">{t('allPricesOption')}</option>
                <option value="regular">{t('regularPricesOnly')}</option>
                <option value="promo">{t('promoPricesOnly')}</option>
              </select>
            </div>

            {/* PRODUCT MULTI-SELECT CHECKBOXLIST SECTION */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{t('selectProductsLabel')} ({selectedProducts.length})</label>
                {selectedProducts.length > 0 && (
                  <button 
                    onClick={() => setSelectedProducts([])} 
                    className="text-[9px] font-black text-red-600 hover:underline uppercase"
                  >
                    {t('clearSelection')}
                  </button>
                )}
              </div>

              {/* Instant list product search bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder={t('searchInProductList')}
                  value={prodSearchTerm}
                  onChange={(e) => setProdSearchTerm(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-900 border border-slate-250 rounded-lg pl-8 p-1.5 py-1.8 text-xs font-semibold focus:outline-hidden"
                />
              </div>

              {/* Scrolling checkbox list */}
              <div className="max-h-44 overflow-y-auto border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg p-2.5 space-y-1.5 custom-scrollbar text-[11px] font-bold">
                {filteredTrendProductsList.length > 0 ? filteredTrendProductsList.map(prod => {
                  const isChecked = selectedProducts.includes(prod.name);
                  return (
                    <label key={prod.name} className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-zinc-50/80">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedProducts(prev => prev.filter(p => p !== prod.name));
                          } else {
                            setSelectedProducts(prev => [...prev, prod.name]);
                          }
                        }}
                        className="rounded text-lime-600 focus:ring-lime-500 w-3.5 h-3.5"
                      />
                      <span className="truncate text-slate-800 dark:text-zinc-200" title={prod.name}>{prod.name}</span>
                    </label>
                  );
                }) : (
                  <div className="text-center p-4 text-zinc-400 italic">{t('noMatches')}</div>
                )}
              </div>
            </div>

            {/* STORES MULTI-SELECT FILTER CHECKBOXLIST */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{t('selectStoresLabel')} ({selectedChains.length || t('allStoresOption')})</label>
                {selectedChains.length > 0 && (
                  <button 
                    onClick={() => setSelectedChains([])} 
                    className="text-[9px] font-black text-zinc-500 dark:text-zinc-400 hover:underline uppercase"
                  >
                    {t('allStoresOption')}
                  </button>
                )}
              </div>
              <div className="max-h-24 overflow-y-auto border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg p-2 space-y-1 custom-scrollbar text-[10px] font-bold">
                {uniqueStoreNamesFromStats.map(storeName => {
                  const isChecked = selectedChains.includes(storeName);
                  return (
                    <label key={storeName} className="flex items-center gap-2 cursor-pointer p-0.5 rounded hover:bg-zinc-50/80">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedChains(prev => prev.filter(c => c !== storeName));
                          } else {
                            setSelectedChains(prev => [...prev, storeName]);
                          }
                        }}
                        className="rounded text-zinc-900 dark:text-zinc-100 border-slate-300 dark:border-zinc-700 w-3.5 h-3.5"
                      />
                      <span className="truncate text-zinc-700 dark:text-zinc-300">{storeName}</span>
                    </label>
                  );
                })}
              </div>
            </div>

          </div>

          {/* RIGHT: DYNAMIC VISUALIZATIONS, GRID & TABLE EXPORTER (8 Columns) */}
          <div className="lg:col-span-8 space-y-5">
            
            {/* Header toolbar stats */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-905 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <div>
                <h3 className="text-sm font-extrabold text-slate-950 dark:text-zinc-100 flex items-center gap-1.5">
                  <TrendingUp className="text-lime-600 w-5 h-5" />
                  {t('outputAndReporting')}
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{t('visualizeDeviations')}</p>
              </div>

              <div className="flex items-center gap-2 no-print">
                <button
                  onClick={exportCsvReport}
                  disabled={selectedProducts.length === 0}
                  className={`flex items-center gap-2 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${(selectedProducts.length === 0) ? 'bg-slate-100 text-zinc-400 cursor-not-allowed border' : 'bg-lime-600 text-white hover:bg-lime-700 shadow-md shadow-lime-200'}`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  {t('exportCsvReport')}
                </button>
              </div>
            </div>

            {/* CHART CONTAINER WITH TIMELINE VISIONS */}
            <div ref={chartContainerRef} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 border-b pb-2 gap-2">
                <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                  <LineChart className="w-4 h-4 text-lime-600" />
                  {t('priceTrendChartTitle')}
                </h4>
                <div className="flex items-center gap-2 flex-wrap">
                  {loadingCampaignData && (
                    <span className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mr-2">
                      <RefreshCw className="w-3 h-3 animate-spin text-zinc-400" />
                      {t('downloadingDb')}
                    </span>
                  )}
                  <button
                    onClick={exportChartToPng}
                    disabled={selectedProducts.length === 0}
                    className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-slate-600 hover:text-zinc-900 dark:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50/80 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors no-print duration-150"
                    title={t('imagePng')}
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                    {t('imagePng')}
                  </button>
                  <button
                    onClick={exportChartToPdf}
                    disabled={selectedProducts.length === 0}
                    className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-slate-600 hover:text-zinc-900 dark:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50/80 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors no-print duration-150"
                    title="PDF"
                  >
                    <FileText className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                    PDF
                  </button>
                </div>
              </div>

              {selectedProducts.length > 0 ? (
                <div className="relative h-64 w-full">
                  <canvas ref={chartCanvasRef}></canvas>
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-zinc-400 italic text-xs bg-zinc-50/80/50 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                  <LineChart className="w-8 h-8 text-slate-300 stroke-1 mb-2" />
                  {t('selectProductToAnalyze')}
                </div>
              )}
            </div>

            {/* DYNAMIC PRICE MATRIX PIVOT ROW GRID (Store vs Product Matrix) */}
            <div ref={matrixContainerRef} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 border-b pb-2 border-slate-100 dark:border-zinc-800 gap-2">
                <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Grid3X3 className="w-4 h-4 text-emerald-600" />
                  {t('priceComparisonMatrixTitle')}
                </h4>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={exportMatrixToCsv}
                    disabled={priceGridData.rows.length === 0}
                    className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-slate-600 hover:text-zinc-900 dark:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50/80 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors no-print duration-150"
                    title={t('excelXls')}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                    {t('excelXls')}
                  </button>
                  <button
                    onClick={exportMatrixToPdf}
                    disabled={priceGridData.rows.length === 0}
                    className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-slate-600 hover:text-zinc-900 dark:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50/80 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors no-print duration-150"
                    title="PDF"
                  >
                    <FileText className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                    PDF
                  </button>
                </div>
              </div>

              {priceGridData.columns.length > 0 && priceGridData.rows.length > 0 ? (
                <div className="overflow-x-auto border border-zinc-100 rounded-xl shadow-2xs custom-scrollbar">
                  <table className="w-full text-left border-collapse text-[10px] font-sans font-bold">
                    <thead>
                      <tr className="bg-zinc-50/80 text-[8px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-widest border-b border-zinc-100 divide-x divide-zinc-100">
                        <th className="p-3">{t('productCol')}</th>
                        {priceGridData.columns.map(col => (
                          <th key={col} className="p-3 text-center min-w-[100px]" title={col}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 text-[10px] font-medium font-mono text-zinc-700 dark:text-zinc-300">
                      {priceGridData.rows.map(row => (
                        <tr key={row.productName} className="hover:bg-zinc-50/80/30 divide-x divide-zinc-100">
                          <td className="p-2.5 font-bold font-sans text-zinc-900 dark:text-zinc-100 bg-zinc-50/80/20">{row.productName}</td>
                          {priceGridData.columns.map(col => {
                            const dataCell = row.stores[col];
                            if (!dataCell || (dataCell.regular === null && dataCell.promo === null)) {
                              return <td key={col} className="p-2.5 text-center text-slate-300 font-sans italic">-</td>;
                            }

                            // Highlight color bindings
                            let bgHighlightClass = '';
                            if (dataCell.isCheapest) bgHighlightClass = 'bg-emerald-50/80 hover:bg-emerald-100/90 text-emerald-800 transition-colors border-2 border-emerald-300/40 rounded-lg';
                            else if (dataCell.isExpensive) bgHighlightClass = 'bg-orange-50/80 hover:bg-orange-100/90 text-orange-850 transition-colors';

                            return (
                              <td key={col} className={`p-2.5 text-center ${bgHighlightClass}`}>
                                <div className="space-y-0.5">
                                  {dataCell.promo !== null ? (
                                    <>
                                      {dataCell.regular !== null && (
                                        <div className="text-[8px] text-zinc-400 line-through leading-none">
                                          {formatPrice(dataCell.regular)}
                                        </div>
                                      )}
                                      <div className="text-red-600 font-extrabold leading-tight text-[11px] animate-pulse">
                                        {t('promoActionLabel')} {formatPrice(dataCell.promo)}
                                      </div>
                                    </>
                                  ) : (
                                    <div className="font-extrabold text-slate-800 dark:text-zinc-200 leading-normal">
                                      {formatPrice(dataCell.regular)}
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-xs text-slate-450 italic bg-zinc-50/80 rounded-lg">
                  {t('noMatrixResults')}
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

    </div>
  );
};
