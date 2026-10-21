

import React, { useEffect, useRef } from 'react';
import type { ProductHistoryPoint } from '../types.ts';
import { useTranslation } from '../i18n/index.tsx';
import Chart from '../utils/chartSetup.ts';

// Define types locally to remove module dependency, relying on the global Chart object
type ChartJS = any;
type ChartConfiguration = any;

interface PriceHistoryChartProps {
    data: ProductHistoryPoint[];
    onPointClick: (pointData: ProductHistoryPoint) => void;
}

export const PriceHistoryChart: React.FC<PriceHistoryChartProps> = ({ data, onPointClick }) => {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstanceRef = useRef<ChartJS | null>(null);
    const { t } = useTranslation();

    useEffect(() => {
        if (!chartRef.current || !data) return;

        const regularData = data.filter(p => p.type === 'REGULAR').map(p => ({ x: p.date, y: p.price, store: p.storeName, originalPoint: p }));
        const promoData = data.filter(p => p.type === 'PROMO').map(p => ({ x: p.date, y: p.price, store: p.storeName, originalPoint: p }));
        
        const ctx = chartRef.current.getContext('2d');
        if (!ctx) return;
        
        // Destroy previous chart instance if it exists
        if (chartInstanceRef.current) {
            chartInstanceRef.current.destroy();
        }

        const config: ChartConfiguration = {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: t('regularPrice'),
                        data: regularData,
                        borderColor: 'rgb(59, 130, 246)',
                        backgroundColor: 'rgba(59, 130, 246, 0.5)',
                        tension: 0.1,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                    },
                    {
                        label: t('promoPrice'),
                        data: promoData,
                        borderColor: 'rgb(239, 68, 68)',
                        backgroundColor: 'rgba(239, 68, 68, 0.5)',
                        tension: 0.1,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                 onClick: (event: any, elements: any[]) => {
                    if (elements.length > 0) {
                        const element = elements[0];
                        const dataset = config.data.datasets[element.datasetIndex];
                        const dataPoint = dataset.data[element.index];
                        if (dataPoint && dataPoint.originalPoint) {
                            onPointClick(dataPoint.originalPoint);
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: t('priceTrend'),
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context: any) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += `${context.parsed.y}`;
                                }
                                return label;
                            },
                            afterLabel: function(context: any) {
                                if (context.raw.store) {
                                    return `${t('in')}: ${context.raw.store}`;
                                }
                                return '';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'month',
                            tooltipFormat: 'dd.MM.yyyy',
                            displayFormats: {
                                month: 'MMM yyyy'
                            }
                        },
                        title: {
                            display: true,
                            text: t('date')
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: t('priceValue')
                        }
                    }
                },
            },
        };

        chartInstanceRef.current = new Chart(ctx, config);

        return () => {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
                chartInstanceRef.current = null;
            }
        };
    }, [data, t, onPointClick]);

    if (!data || data.length === 0) {
        return (
            <div className="text-center py-10 text-sm text-gray-500">
                {t('noPriceHistory')}
            </div>
        );
    }

    return (
        <div className="relative h-64">
            <canvas ref={chartRef}></canvas>
        </div>
    );
};
