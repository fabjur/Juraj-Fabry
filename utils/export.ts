
import type { StoreCentricSummary } from '../components/BatchSummaryPanel.tsx';
import type { DistributionMatrix, PromoAlertItem } from '../types.ts';
import { getImageStoreName } from './helpers.ts';

declare const html2canvas: any;

interface ShelfShareData {
    category: string;
    share: number;
    count?: number;
}

/**
 * Escapes a value for CSV format.
 * - Wraps in double quotes if it contains a semicolon, double quote, or newline.
 * - Escapes double quotes inside the value by doubling them.
 * @param value The value to escape.
 * @returns A CSV-safe string.
 */
const escapeCsvValue = (value: any): string => {
    if (value === null || value === undefined) {
        return '';
    }
    const str = String(value);
    if (str.includes(';') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

/**
 * Converts an array of objects to a CSV string.
 * @param headers An array of header strings.
 * @param data An array of data rows, where each row is an array of values.
 * @returns A CSV formatted string with a semicolon delimiter.
 */
const convertToCSV = (headers: string[], data: (string | number | undefined)[][]): string => {
    const headerRow = headers.map(escapeCsvValue).join(';');
    const dataRows = data.map(row => row.map(escapeCsvValue).join(';'));
    return [headerRow, ...dataRows].join('\n');
};

const triggerDownload = (content: string, filename: string, mimeType: string) => {
    const link = document.createElement('a');
    // Add BOM for UTF-8 to ensure Excel opens it with correct encoding
    const blob = new Blob(['\uFEFF' + content], { type: mimeType });
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};


export const exportPriceMonitoringToXLS = (
    storeData: StoreCentricSummary[],
    t: (key: string, params?: Record<string, string | number>) => string
) => {
    const title = t('priceMonitoring');
    const headers = [
        t('storeInfo'),
        t('category'),
        t('products'),
        t('date'),
        t('priceValue'),
        t('priceType'),
        t('item_count_header'),
    ];

    const data: (string | number | undefined)[][] = [];

    storeData.forEach(store => {
        store.products.forEach(product => {
            if (product.priceHistory.length > 0) {
                // If there are prices, create a row for each price entry
                product.priceHistory.forEach(priceEntry => {
                    const priceValue = priceEntry.price.value.replace(/[^\d.,]/g, '').replace(',', '.');
                    const priceTypeKey = priceEntry.price.type === 'PROMO' ? 'promoPrice' : 'regularPrice';
                    const priceTypeText = t(priceTypeKey);

                    data.push([
                        store.storeName,
                        product.category,
                        product.name,
                        priceEntry.date.toLocaleDateString(),
                        priceValue,
                        priceTypeText,
                        product.count,
                    ]);
                });
            } else {
                // If there are no prices, create one row with empty price info
                data.push([
                    store.storeName,
                    product.category,
                    product.name,
                    '', // empty date
                    '', // empty price value
                    '', // empty price type
                    product.count,
                ]);
            }
        });
    });

    const csvContent = convertToCSV(headers, data);
    const date = new Date().toISOString().slice(0, 10);
    triggerDownload(csvContent, `${title}_${date}.csv`, 'text/csv;charset=utf-8;');
};


export const exportShelfShareToXLS = (
    shelfShareData: ShelfShareData[],
    selectedChain: string,
    shareMode: 'area' | 'count',
    t: (key: string, params?: Record<string, string | number>) => string
) => {
    const title = t('shelfShare');
    
    const headers = [t('category'), `${t('shelfShare')} (%)`];
    if (shareMode === 'count') {
        headers.push(t('item_count_header'));
    }

    const data: (string | number | undefined)[][] = shelfShareData.map(item => {
        const row: (string | number | undefined)[] = [item.category, item.share.toFixed(2).replace('.', ',')]; // Use comma for decimal separator for european locales
        if (shareMode === 'count') {
            row.push(item.count || 0);
        }
        return row;
    });

    const csvContent = convertToCSV(headers, data);
    const date = new Date().toISOString().slice(0, 10);
    triggerDownload(csvContent, `${title}_${shareMode}_${date}.csv`, 'text/csv;charset=utf-8;');
};

export const exportDistributionToXLS = (
    matrix: DistributionMatrix,
    t: (key: string, params?: Record<string, string | number>) => string
) => {
    const title = t('distributionModule');
    
    // Headers: Store Name | Product 1 | Product 2 | ... | Fulfillment
    // FIX: Using selectedEntities instead of selectedProducts as per types.ts
    const headers = [t('storeName'), ...matrix.selectedEntities, t('storeFulfillment')];

    const data: (string | number | undefined)[][] = matrix.rows.map(row => {
        // FIX: Using selectedEntities instead of selectedProducts
        const productValues = matrix.selectedEntities.map(p => {
            const cell = row.presence[p];
            // FIX: Using count > 0 instead of isPresent as per types.ts
            if (cell && cell.count > 0) {
                 return `${t('presenceYes')} (${Math.round(cell.maxConfidence * 100)}%)`;
            }
            return `${t('presenceNo')} (0%)`;
        });
        
        // FIX: Calculating fulfillment manually as it does not exist on current DistributionRow
        const presentCount = Object.values(row.presence).filter(c => c.count > 0).length;
        const fulfillment = matrix.selectedEntities.length > 0 ? (presentCount / matrix.selectedEntities.length) * 100 : 0;

        return [
            row.storeName,
            ...productValues,
            `${Math.round(fulfillment)}%`
        ];
    });

    // Add Summary Row
    const summaryRow = [
        t('distributionShare'),
        // FIX: Using selectedEntities instead of selectedProducts
        ...matrix.selectedEntities.map(p => `${Math.round(matrix.columnSummaries[p] || 0)}%`),
        '-'
    ];
    data.push(summaryRow);

    const csvContent = convertToCSV(headers, data);
    const date = new Date().toISOString().slice(0, 10);
    triggerDownload(csvContent, `${title}_${date}.csv`, 'text/csv;charset=utf-8;');
};

export const exportPromoAlertToXLS = (
    alerts: PromoAlertItem[],
    t: (key: string, params?: Record<string, string | number>) => string
) => {
    const title = t('promoAlert');
    // Headers: Alert Type | Product | Brand | Store | Regular Price | Promo Price
    const headers = [
        t('category'), // Using 'category' loosely for 'Alert Type' column header or create a new key if preferred
        t('product'),
        t('ourBrands'), // Using existing key for Brand column
        t('storeName'),
        t('avgRegularPrice'), // Using existing keys for price headers
        t('avgPromoPrice')
    ];

    const data: (string | number | undefined)[][] = alerts.map(alert => {
        let typeLabel = '';
        switch (alert.type) {
            case 'competitor_promo': typeLabel = t('promoAlertCompetitorTitle'); break;
            case 'our_promo': typeLabel = t('promoAlertOurActiveTitle'); break;
            case 'missing_promo': typeLabel = t('promoAlertMissingTitle'); break;
        }

        const regularPrice = alert.product.prices?.find(p => p.type === 'REGULAR')?.value || '';
        const promoPrice = alert.product.prices?.find(p => p.type === 'PROMO')?.value || '';

        return [
            typeLabel,
            alert.product.name,
            alert.product.brand || '',
            alert.store,
            regularPrice,
            promoPrice
        ];
    });

    const csvContent = convertToCSV(headers, data);
    const date = new Date().toISOString().slice(0, 10);
    triggerDownload(csvContent, `${title}_${date}.csv`, 'text/csv;charset=utf-8;');
}

export const exportQualityCheckToXLS = (
    images: any[],
    t: (key: string, params?: Record<string, string | number>) => string
) => {
    const title = t('qualityCheck') || 'Kontrola kvality';
    const headers = [
        t('storeInfo') || 'Predajňa',
        t('date') || 'Dátum',
        `${t('compliance') || 'Zhoda'} (%)`,
        t('status') || 'Stav',
        t('complianceExplanation') || 'Odôvodnenie auditóra'
    ];

    const data: (string | number | undefined)[][] = [];

    images.filter(img => img.analysisType === 'qualityCheck').forEach(img => {
        const storeName = getImageStoreName(img, t('unknownStore'), null);

        const dateStr = img.uploadDate ? new Date(img.uploadDate).toLocaleDateString() : '';
        const score = img.analysisResult?.complianceScore ?? 0;
        const isLow = score < 80;
        const statusText = isLow 
            ? (t('complianceFailedBadge') || 'CHYBA V SÚLADE (<80%)') 
            : (t('compliancePassedBadge') || 'V SÚLADE SO VZOROM (OK)');
        
        const reason = img.analysisResult?.reason || 'Snímka plne vyhovuje požiadavkám referenčného manuálu a rozloženiu výrobkov.';

        data.push([
            storeName,
            dateStr,
            score,
            statusText,
            reason
        ]);
    });

    const csvContent = convertToCSV(headers, data);
    const date = new Date().toISOString().slice(0, 10);
    triggerDownload(csvContent, `${title}_${date}.csv`, 'text/csv;charset=utf-8;');
};

export const exportToPDF = (elementToPrint: HTMLElement | null) => {
    if (!elementToPrint) {
      console.error("Element to print was not provided.");
      return;
    }
  
    if (typeof html2canvas === 'undefined') {
        console.error("html2canvas library is not loaded.");
        alert("PDF export functionality is currently unavailable. Please try again later.");
        return;
    }

    // To capture full scrollable content, temporarily make it visible
    const scrollableElements = Array.from(elementToPrint.querySelectorAll<HTMLElement>('.overflow-y-auto'));
    // Identify elements to hide (e.g. buttons, filters, tabs) that have 'no-print' class
    const noPrintElements = Array.from(elementToPrint.querySelectorAll<HTMLElement>('.no-print'));

    const elementsToModify = [elementToPrint, ...scrollableElements];
    const originalStyles = new Map<HTMLElement, { overflow: string; maxHeight: string; height: string }>();
    const originalDisplayStyles = new Map<HTMLElement, string>();

    elementsToModify.forEach(el => {
        originalStyles.set(el, {
            overflow: el.style.overflow,
            maxHeight: el.style.maxHeight,
            height: el.style.height,
        });
        el.style.overflow = 'visible';
        el.style.maxHeight = 'none';
        el.style.height = 'auto'; // Allow element to expand to its full content height
    });

    noPrintElements.forEach(el => {
        originalDisplayStyles.set(el, el.style.display);
        el.style.display = 'none';
    });

    html2canvas(elementToPrint, {
        scale: 2, // Improves resolution for better quality PDF
        useCORS: true,
        backgroundColor: '#ffffff', // Ensure a white background for consistency
        windowWidth: elementToPrint.scrollWidth,
        windowHeight: elementToPrint.scrollHeight,
    }).then((canvas: HTMLCanvasElement) => {
        const imgData = canvas.toDataURL('image/png');
        
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Export to PDF</title>
                        <style>
                            @page { size: a4 portrait; margin: 0; }
                            body { margin: 0; }
                            img { width: 100%; display: block; }
                        </style>
                    </head>
                    <body>
                        <img src="${imgData}" alt="Export Preview" />
                    </body>
                </html>
            `);
            printWindow.document.close();
            
            printWindow.onload = () => {
                setTimeout(() => {
                    printWindow.focus();
                    printWindow.print();
                    // Let the user close the print preview window
                }, 250);
            };
        } else {
            alert("Could not open print window. Please disable your pop-up blocker.");
        }
    }).catch(err => {
        console.error("Failed to generate PDF screenshot:", err);
        alert("An error occurred while generating the PDF.");
    }).finally(() => {
        // Crucially, restore the original styles after the operation
        originalStyles.forEach((styles, el) => {
            el.style.overflow = styles.overflow;
            el.style.maxHeight = styles.maxHeight;
            el.style.height = styles.height;
        });
        
        noPrintElements.forEach(el => {
            el.style.display = originalDisplayStyles.get(el) || '';
        });
    });
};
