import React, { useState, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import WorkArea from './components/WorkArea';
import OnboardingModal from './components/OnboardingModal';
import ErrorBoundary from './components/ErrorBoundary';

const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const AdvancedAnalytics = React.lazy(() => import('./pages/AdvancedAnalytics'));
const AgentPipeline = React.lazy(() => import('./pages/AgentPipeline'));
const TasksMap = React.lazy(() => import('./pages/TasksMap'));

const InvoiceBuilder = React.lazy(() => import('./pages/InvoiceBuilder'));
const Profile = React.lazy(() => import('./pages/Profile'));
const Settings = React.lazy(() => import('./pages/Settings'));
const AgentManager = React.lazy(() => import('./pages/AgentManager'));
const Support = React.lazy(() => import('./pages/Support'));
const AiChat = React.lazy(() => import('./pages/AiChat'));

const AiWriter = React.lazy(() => import('./pages/AiWriter'));
const MyDocuments = React.lazy(() => import('./pages/MyDocuments'));

// WhatsApp Plugin Pages (Phase 13)
const ContactLists = React.lazy(() => import('./pages/whatsapp/ContactLists'));
const Prospection = React.lazy(() => import('./pages/whatsapp/Prospection'));
const Segments = React.lazy(() => import('./pages/whatsapp/Segments'));
const Contacts = React.lazy(() => import('./pages/whatsapp/Contacts'));
const Orders = React.lazy(() => import('./pages/whatsapp/Orders'));
const ContactAdd = React.lazy(() => import('./pages/whatsapp/ContactAdd'));
const ContactImport = React.lazy(() => import('./pages/whatsapp/ContactImport'));
import { useGlobalOrderListener } from './hooks/useGlobalOrderListener';

import useAppStore from './store';
import { API_BASE_URL } from './config';
import './styles/global.css';

function AppContent() {
  const instances = useAppStore(state => state.instances);
  const setInstances = useAppStore(state => state.setInstances);

  // Mount the Global Order Listener so IOL stays alive regardless of current page
  useGlobalOrderListener(true);

  const [activeId, setActiveId] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  const appSettings = useAppStore(state => state.appSettings) || { theme: 'light', language: 'en' };
  const appNotification = useAppStore(state => state.appNotification);
  const { i18n, t } = useTranslation();

  const updateAvailable = useAppStore(state => state.updateAvailable);
  const setUpdateAvailable = useAppStore(state => state.setUpdateAvailable);
  const fetchAndSyncBackendSettings = useAppStore(state => state.fetchAndSyncBackendSettings);
  const fetchGlobalModels = useAppStore(state => state.fetchGlobalModels);
  const syncDefaultChatModel = useAppStore(state => state.syncDefaultChatModel);
  const fetchInvoices = useAppStore(state => state.fetchInvoices);
  const [showPostUpdateModal, setShowPostUpdateModal] = useState(null);


  React.useEffect(() => {
    if (appSettings?.language && i18n.language !== appSettings.language) {
      i18n.changeLanguage(appSettings.language);
    }
  }, [appSettings?.language, i18n]);

  // Comptes restaurés (store persisté, réhydraté de façon asynchrone) mais aucun
  // onglet actif : le premier est sélectionné pendant le rendu. React relance
  // aussitôt le rendu avec la nouvelle valeur, sans afficher d'abord un écran
  // sans onglet comme le faisait l'effet précédent.
  if (instances.length > 0 && !activeId) {
    setActiveId(instances[0].id);
  }

  // Update UX Initialization
  React.useEffect(() => {
    const initUpdateUX = async () => {
      if (!window.electronAPI || !window.updaterAPI) return;

      try {
        // 1. POST UPDATE CHECK
        const pendingUpdateStr = await window.electronAPI.storeGet('pendingUpdateInfo');
        if (pendingUpdateStr) {
          const currentVersion = await window.updaterAPI.getVersion();
          if (pendingUpdateStr.version === currentVersion) {
            setShowPostUpdateModal(pendingUpdateStr);
          }
          await window.electronAPI.storeSet('pendingUpdateInfo', null); // clear it
        }
        // Safety: always clear any stale persisted update state on mount
        setUpdateAvailable(null);

        // 2. SILENT BACKGROUND CHECK
        const checkResult = await window.updaterAPI.checkForUpdates();
        if (checkResult && checkResult.hasUpdate) {
          // Double-check: ensure the remote version is strictly greater than the running version.
          // This prevents the banner from showing when remote == current.
          const currentVersion = await window.updaterAPI.getVersion();
          const remoteVersion = checkResult.version;
          const compareVersions = (v1, v2) => {
            const p1 = String(v1).split('.').map(Number);
            const p2 = String(v2).split('.').map(Number);
            for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
              const n1 = p1[i] || 0;
              const n2 = p2[i] || 0;
              if (n1 > n2) return 1;
              if (n1 < n2) return -1;
            }
            return 0;
          };
          if (compareVersions(remoteVersion, currentVersion) > 0) {
            setUpdateAvailable(checkResult);
          }
        } else if (checkResult && checkResult.error) {
          // Le check silencieux ne doit pas déranger l'utilisateur, mais
          // l'erreur doit rester traçable — l'écran Réglages affiche le détail.
          console.warn('[Updater] Vérification silencieuse impossible:', checkResult.errorCode || '', checkResult.error);
        }
      } catch (e) {
        console.error("Update UX init error:", e);
      }
    };
    initUpdateUX();
    fetchAndSyncBackendSettings().then(async () => {
      await fetchGlobalModels();
      // Le modèle choisi dans les Paramètres sert aussi aux appels qui n'en
      // précisent pas (Rédaction, prospection, MCP, CLI) : voir settingsSlice.
      await syncDefaultChatModel();
    });
    fetchInvoices();
  }, [setUpdateAvailable, fetchAndSyncBackendSettings, fetchGlobalModels, syncDefaultChatModel, fetchInvoices]);


  const handleAddInstance = () => {
    const id = `wa-tab-${Date.now()}`;
    const newInstance = { id, name: `Instance ${instances.length + 1}`, status: 'offline' };
    setInstances([...instances, newInstance]);
    setActiveId(id);
    if (window.electronAPI) window.electronAPI.createInstance(id);
    // Miroir en écriture côté backend (table wa_instances) pour que le CLI/MCP
    // puisse lister les instances sans dépendre du store Zustand du renderer.
    fetch(API_BASE_URL + '/api/wa/instances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: newInstance.name, status: newInstance.status })
    }).catch(() => { });
  };

  const handleRemoveInstance = (id) => {
    const newInstances = instances.filter(inst => inst.id !== id);
    setInstances(newInstances);
    if (activeId === id) setActiveId(newInstances.length > 0 ? newInstances[0].id : null);
    if (window.electronAPI) window.electronAPI.removeInstance(id);
    fetch(API_BASE_URL + '/api/wa/instances/' + id, { method: 'DELETE' }).catch(() => { });
  };
  const handleUpdateInstance = (id, updates) => {
    if (id === '__reorder__') {
      setInstances(updates);
      return;
    }
    setInstances(instances.map(inst => inst.id === id ? { ...inst, ...updates } : inst));
  };
  const activeInstance = instances.find(inst => inst.id === activeId);

  // Check if we are currently on the WhatsApp route
  const isWhatsApp = location.pathname === '/whatsapp-hub' || location.pathname === '/';

  return (
      <div className={`font-body h-screen w-screen overflow-hidden p-4 relative ${appSettings.theme === 'dark' ? 'dark bg-gray-950 text-gray-100' : 'bg-background-light text-text-main'}`} dir={appSettings.language === 'ar' ? 'rtl' : 'ltr'}>

        {/* Onboarding Modal (Language Selection) */}
        {!appSettings?.hasCompletedOnboarding && (
            <OnboardingModal />
        )}

        {/* Update Banner */}
        {updateAvailable && location.pathname !== '/settings' && location.pathname !== '/support' && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-500">
            <button
              onClick={() => navigate('/settings')}
              className="bg-gradient-to-r from-emerald-600 to-teal-800 text-white px-6 py-3 rounded-full flex items-center gap-3 shadow-xl hover:shadow-emerald-900/30 hover:scale-105 transition-all outline-none"
            >
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-200 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
              </span>
              <span className="font-medium text-sm">{t('updaterBanner', { version: updateAvailable.version })}</span>
            </button>
          </div>
        )}

        {/* Post-Update Welcome Modal */}
        {showPostUpdateModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-3xl shadow-2xl p-8 border border-gray-100 dark:border-gray-800 animate-in zoom-in-95 duration-500">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="size-10 bg-emerald-500/10 text-emerald-600 rounded-xl flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('updaterSuccessTitle')}</h2>
                </div>
                <button onClick={() => setShowPostUpdateModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-2">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-8 whitespace-pre-wrap leading-relaxed">
                {t('updaterSuccessDesc', { version: showPostUpdateModal.version })}
              </p>
              <button onClick={() => {
                if (window.electronAPI) window.electronAPI.openExternalUrl('https://auceps-digital.agency/projects/saas/wacopilote/release-wacopilote/');
                setShowPostUpdateModal(null);
              }} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-emerald-600/20 flex justify-center items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                {t('updaterSuccessBtn')}
              </button>
            </div>
          </div>
        )}

        <div className="flex h-full w-full gap-4 max-w-[1800px] mx-auto relative z-10">

          <Sidebar
            instances={instances}
            activeId={activeId}
            onSelect={setActiveId}
            onAdd={handleAddInstance}
            onRemove={handleRemoveInstance}
            onUpdate={handleUpdateInstance}
            currentPath={location.pathname}
          />

          <main className="flex-1 flex flex-col bg-surface dark:bg-gray-900 rounded-lg shadow-soft dark:shadow-none border border-transparent dark:border-gray-800 overflow-hidden min-w-[400px] relative">
            <Topbar activeInstance={isWhatsApp ? activeInstance : null} currentTitle={location.pathname} />

            {/*
            CRITICAL: We ALWAYS render the WorkArea (which holds the <webview> tags).
            If the user is not on the /whatsapp-hub route, we hide it via CSS to prevent
            memory/DOM destruction in Electron.
          */}
            <div
              className="flex-1 min-h-0 flex flex-col"
              style={{
                position: isWhatsApp ? 'relative' : 'absolute',
                opacity: isWhatsApp ? 1 : 0,
                zIndex: isWhatsApp ? 1 : -1,
                pointerEvents: isWhatsApp ? 'auto' : 'none',
                top: 0, left: 0, right: 0, bottom: 0
              }}
            >
              <WorkArea instances={instances} activeId={activeId} />
            </div>

            {/* Standard React Routing for text/UI-based pages */}
            {!isWhatsApp && (
              <div className="overflow-y-auto p-6 flex-1 bg-surface dark:bg-gray-900">
                <ErrorBoundary>
                  <Suspense fallback={<div className="h-full w-full flex items-center justify-center text-primary/60"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div></div>}>
                    <Routes>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/analytics" element={<AdvancedAnalytics />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/agent-pipeline" element={<AgentPipeline activeId={activeId} />} />
                  <Route path="/agents-manager" element={<AgentManager />} />
                  <Route path="/ai-chat" element={<AiChat />} />
                  <Route path="/ai-writer" element={<AiWriter />} />
                  <Route path="/my-documents" element={<MyDocuments />} />
                  <Route path="/tasks" element={<TasksMap />} />
                  <Route path="/invoice-builder" element={<InvoiceBuilder activeId={activeId} />} />
                  <Route path="/settings" element={<Settings />} />

                  {/* WhatsApp Pages */}
                  <Route path="/wa/prospection" element={<Prospection />} />
                  <Route path="/wa/contact-lists" element={<ContactLists />} />
                  <Route path="/wa/segments" element={<Segments />} />
                  <Route path="/wa/contacts" element={<Contacts activeId={activeId} />} />
                  <Route path="/wa/orders" element={<Orders />} />
                  <Route path="/wa/contacts/add" element={<ContactAdd />} />
                  <Route path="/wa/contacts/edit/:id" element={<ContactAdd />} />
                  <Route path="/wa/contacts/import" element={<ContactImport />} />
                  <Route path="/support" element={<Support />} />

                  {/* Adresse inconnue — notamment les pages retirées (génération
                      d'image : /agents, /fashion/*), qu'Electron rouvre telles
                      quelles au rechargement : retour au tableau de bord. */}
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                  </Suspense>
                </ErrorBoundary>
              </div>
            )}
          </main>

          {/* Global App Notification Toast */}
          {appNotification && (
            <div className={`absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-3 px-6 py-4 rounded-xl shadow-xl z-[9999] transition-all animate-bounce-slight border ${appNotification.type === 'error' ? 'bg-red-50 text-red-900 border-red-200 dark:bg-red-900/90 dark:text-red-50 dark:border-red-800' : 'bg-green-50 text-emerald-900 border-green-200 dark:bg-emerald-900/90 dark:text-emerald-50 dark:border-emerald-800'}`}>
              {appNotification.type === 'success' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              )}
              <span className="font-semibold text-sm">{appNotification.msg}</span>
            </div>
          )}

        </div>
      </div>
  );
}

function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
}

export default App;
