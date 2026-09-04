import React from 'react';
import { useTranslation } from '../i18n/index.tsx';
import { KeyIcon, SalesappVisionBrand } from './Icons.tsx';

interface ApiKeySelectionScreenProps {
  onSelectApiKey: () => void;
}

export const ApiKeySelectionScreen: React.FC<ApiKeySelectionScreenProps> = ({ onSelectApiKey }) => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
            <SalesappVisionBrand className="h-16" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900 sr-only">
            {t('appTitle')}
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center border border-gray-200">
            <KeyIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('apiKeyRequiredTitle')}</h3>
            <p className="text-sm text-gray-500 mb-6">
                {t('apiKeyRequiredDescription')}
            </p>
            
            <button
                onClick={onSelectApiKey}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-lime-600 hover:bg-lime-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lime-500 transition-colors"
            >
                <KeyIcon className="w-5 h-5" />
                {t('selectApiKeyButton')}
            </button>
            
            <div className="mt-6 text-xs text-gray-400">
                <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="hover:text-lime-600 underline">
                    {t('learnMoreAboutBilling')}
                </a>
            </div>
        </div>
      </div>
    </div>
  );
};