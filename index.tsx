

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { LanguageProvider } from './i18n/index.tsx';
import './index.css';

// FIX: Global types are now handled via inline casting (`as any`) for window properties,
// as the global.d.ts file has been intentionally wiped to prevent build-related runtime SyntaxErrors.
// This is a nuclear workaround for a critical build pipeline misconfiguration.

const mountApplication = () => {
  console.log("Attempting to mount React application using Defensive Try-Catch Strategy...");

  // 1. DEFENSIVE CLEANUP (The Fix for #310)
  // Check if a previous React root exists in the global scope.
  if ((window as any).__SAI_ROOT__) { 
    try {
      console.warn('♻️ Unmounting previous React root to prevent Error #310...');
      (window as any).__SAI_ROOT__.unmount();
      console.log('Previous React root unmounted.');
    } catch (err) {
      console.warn('⚠️ Warning: Failed to unmount previous root (ignoring and proceeding):', err);
    }
    (window as any).__SAI_ROOT__ = undefined; // Always clear the global reference
  }

  // 2. NUCLEAR DOM WIPE: Wipe the body completely to remove old app instances and any visual remnants.
  // This is done AFTER trying to unmount, to ensure React's internal state is handled first.
  document.body.innerHTML = '';
  console.log('Document body cleared.');

  // 3. CREATE FRESH CONTAINER: Use a random ID to prevent #310 collisions and guarantee a pristine mount point.
  const rootId = 'sai-root-' + Math.random().toString(36).slice(2);
  const container = document.createElement('div');
  container.id = rootId; // Assign the unique ID to the new container
  document.body.appendChild(container); // Append this new, clean container to the body

  console.log(`Created and appended a new #${rootId} element to the document body.`);

  // 4. MOUNT NEW APP & SAVE REFERENCE: Create the new React root and save its reference globally.
  // This new root is then used to render the application.
  try {
    const root = createRoot(container); // Use createRoot directly from 'react-dom/client'
    (window as any).__SAI_ROOT__ = root; // IMPORTANT: Save the new root instance globally for future unmounts
    
    root.render(
      <React.StrictMode>
        {/* LanguageProvider is correctly here to ensure context is available from the start */}
        <LanguageProvider> 
          <App />
        </LanguageProvider>
      </React.StrictMode>
    );
    console.log(`✅ App mounted successfully on #${rootId}.`);
  } catch (error) {
    // If createRoot or render fails, log the error and display a fallback message.
    console.error("CRITICAL: Failed to mount React application.", error);
    
    // --- Fallback Error Display (Clean up body first to ensure only error message is visible) ---
    // Ensure body is clean before appending the error message, in case previous clear was partial.
    document.body.innerHTML = ''; 
    const errorDisplay = document.createElement('div');
    errorDisplay.style.cssText = `
      font-family: 'Inter', sans-serif;
      color: #b91c1c; /* Tailwind red-700 */
      background-color: #fee2e2; /* Tailwind red-100 */
      border: 1px solid #ef4444; /* Tailwind red-500 */
      padding: 20px;
      margin: 20px;
      border-radius: 8px;
      text-align: center;
      max-width: 600px;
      margin-left: auto;
      margin-right: auto;
    `;
    errorDisplay.innerHTML = `
      <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 10px;">Application Startup Error</h2>
      <p style="font-size: 1rem; margin-bottom: 15px;">A critical error occurred during application startup.</p>
      <p style="font-size: 0.875rem; color: #dc2626;"><strong>Error Details:</strong> ${error instanceof Error ? error.message : String(error)}</p>
      <p style="font-size: 0.875rem; margin-top: 15px;">Please refresh your page. If the issue persists, consider clearing your browser's site data (cache and cookies) for this application or contact support.</p>
    `;
    document.body.appendChild(errorDisplay);
  }
};

// Execute the mount logic
mountApplication();