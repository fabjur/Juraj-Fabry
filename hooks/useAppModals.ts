import { useState } from 'react';

export const useAppModals = () => {
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isMissingPriceModalOpen, setIsMissingPriceModalOpen] = useState(false);
  const [isNewAnalysisModalOpen, setIsNewAnalysisModalOpen] = useState(false);
  const [isImageUploadOverlayOpen, setIsImageUploadOverlayOpen] = useState(false);

  return {
    isAnalysisModalOpen, setIsAnalysisModalOpen,
    isClearConfirmOpen, setIsClearConfirmOpen,
    isBrandModalOpen, setIsBrandModalOpen,
    isSearchModalOpen, setIsSearchModalOpen,
    isMissingPriceModalOpen, setIsMissingPriceModalOpen,
    isNewAnalysisModalOpen, setIsNewAnalysisModalOpen,
    isImageUploadOverlayOpen, setIsImageUploadOverlayOpen
  };
};
