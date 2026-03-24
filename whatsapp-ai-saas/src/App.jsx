import React, { useState } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import WorkArea from './components/WorkArea';

import Dashboard from './pages/Dashboard';
import AdvancedAnalytics from './pages/AdvancedAnalytics';
import AgentsHub from './pages/AgentsHub';
import TasksMap from './pages/TasksMap';

import InvoiceBuilder from './pages/InvoiceBuilder';
import Profile from './pages/Profile';
import ToolsBox from './pages/ToolsBox';
import Settings from './pages/Settings';
import PhotoShoot from './pages/PhotoShoot';
import AgentManager from './pages/AgentManager';
import AiChat from './pages/AiChat';
import { ImageWorkspace } from './components/image-editor/ImageWorkspace';

// WhatsApp Plugin Pages (Phase 13)
import ContactLists from './pages/whatsapp/ContactLists';
import Segments from './pages/whatsapp/Segments';
import Contacts from './pages/whatsapp/Contacts';
import Orders from './pages/whatsapp/Orders';
import ContactAdd from './pages/whatsapp/ContactAdd';
import ContactImport from './pages/whatsapp/ContactImport';
import { useGlobalOrderListener } from './hooks/useGlobalOrderListener';

// Placeholder Pages for Phase 2

import useAppStore from './store';
import './styles/global.css';

function AppContent() {
  const instances = useAppStore(state => state.instances);
  const setInstances = useAppStore(state => state.setInstances);

  // Mount the Global Order Listener so IOL stays alive regardless of current page
  useGlobalOrderListener(true);

  const [activeId, setActiveId] = useState(null);
  const location = useLocation();

  const appSettings = useAppStore(state => state.appSettings) || { theme: 'light', language: 'en' };
  const currentLang = appSettings?.language || 'fr';
  const appNotification = useAppStore(state => state.appNotification);

  // On mount, if instances exist from persist but no active tab is selected, select the first
  React.useEffect(() => {
    if (instances.length > 0 && !activeId) {
      setActiveId(instances[0].id);
    }
  }, [instances, activeId]);

  const handleAddInstance = () => {
    const id = `wa-tab-${Date.now()}`;
    const newInstance = { id, name: `Instance ${instances.length + 1}`, status: 'offline' };
    setInstances([...instances, newInstance]);
    setActiveId(id);
    if (window.electronAPI) window.electronAPI.createInstance(id);
  };

  const handleRemoveInstance = (id) => {
    const newInstances = instances.filter(inst => inst.id !== id);
    setInstances(newInstances);
    if (activeId === id) setActiveId(newInstances.length > 0 ? newInstances[0].id : null);
    if (window.electronAPI) window.electronAPI.removeInstance(id);
  };

  const handleUpdateInstance = (id, updates) => {
    setInstances(instances.map(inst => inst.id === id ? { ...inst, ...updates } : inst));
  };

  const activeInstance = instances.find(inst => inst.id === activeId);

  // Check if we are currently on the WhatsApp route
  const isWhatsApp = location.pathname === '/whatsapp-hub' || location.pathname === '/';

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID_HERE"}>
      <div className={`font-body h-screen w-screen overflow-hidden p-4 ${appSettings.theme === 'dark' ? 'dark bg-gray-950 text-gray-100' : 'bg-background-light text-text-main'}`} dir={appSettings.language === 'ar' ? 'rtl' : 'ltr'}>
        <div className="flex h-full w-full gap-4 max-w-[1800px] mx-auto">
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
                <Routes>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/analytics" element={<AdvancedAnalytics />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/agents" element={<AgentsHub activeId={activeId} />} />
                  <Route path="/agents-manager" element={<AgentManager />} />
                  <Route path="/ai-chat" element={<AiChat />} />
                  <Route path="/tasks" element={<TasksMap />} />
                  <Route path="/invoice-builder" element={<InvoiceBuilder activeId={activeId} />} />
                  <Route path="/tools" element={<ToolsBox />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/fashion/photoshoot" element={<PhotoShoot activeId={activeId} />} />
                  <Route path="/fashion/edit" element={<ImageWorkspace />} />

                  {/* WhatsApp Pages */}
                  <Route path="/wa/contact-lists" element={<ContactLists />} />
                  <Route path="/wa/segments" element={<Segments />} />
                  <Route path="/wa/contacts" element={<Contacts activeId={activeId} />} />
                  <Route path="/wa/orders" element={<Orders />} />
                  <Route path="/wa/contacts/add" element={<ContactAdd />} />
                  <Route path="/wa/contacts/edit/:id" element={<ContactAdd />} />
                  <Route path="/wa/contacts/import" element={<ContactImport />} />
                </Routes>
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
    </GoogleOAuthProvider>
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
