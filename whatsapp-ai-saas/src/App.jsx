import React, { useState } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import WorkArea from './components/WorkArea';

import Dashboard from './pages/Dashboard';
import AgentsHub from './pages/AgentsHub';
import TasksMap from './pages/TasksMap';

import InvoiceBuilder from './pages/InvoiceBuilder';
import Profile from './pages/Profile';
import ToolsBox from './pages/ToolsBox';
import Settings from './pages/Settings';

// Placeholder Pages for Phase 2

import useAppStore from './store';
import './styles/global.css';

function AppContent() {
  const instances = useAppStore(state => state.instances);
  const setInstances = useAppStore(state => state.setInstances);

  const [activeId, setActiveId] = useState(null);
  const location = useLocation();

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

  const appSettings = useAppStore(state => state.appSettings) || { theme: 'light', language: 'en' };

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
            <div className="flex-1 min-h-0 flex flex-col" style={{ display: isWhatsApp ? 'flex' : 'none' }}>
              <WorkArea instances={instances} activeId={activeId} />
            </div>

            {/* Standard React Routing for text/UI-based pages */}
            {!isWhatsApp && (
              <div className="overflow-y-auto p-6 flex-1 bg-surface dark:bg-gray-900">
                <Routes>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/agents" element={<AgentsHub />} />
                  <Route path="/tasks" element={<TasksMap />} />
                  <Route path="/invoice-builder" element={<InvoiceBuilder />} />
                  <Route path="/tools" element={<ToolsBox />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </div>
            )}
          </main>
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
