import React, { useState } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import WorkArea from './components/WorkArea';

import Dashboard from './pages/Dashboard';
import AgentsHub from './pages/AgentsHub';
import TasksMap from './pages/TasksMap';

import InvoiceBuilder from './pages/InvoiceBuilder';
import Profile from './pages/Profile';

// Placeholder Pages for Phase 2
const ToolsBox = () => <div className="page-content"><h2>Tools</h2><p>Coming Soon...</p></div>;

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

  return (
    <div className="bg-background-light text-text-main font-body h-screen w-screen overflow-hidden p-4">
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

        <main className="flex-1 flex flex-col bg-surface rounded-lg shadow-soft overflow-hidden min-w-[400px] relative">
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
            <div className="overflow-y-auto p-6 flex-1 bg-surface">
              <Routes>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/agents" element={<AgentsHub />} />
                <Route path="/tasks" element={<TasksMap />} />
                <Route path="/invoice-builder" element={<InvoiceBuilder />} />
                <Route path="/tools" element={<ToolsBox />} />
              </Routes>
            </div>
          )}

        </main>
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
