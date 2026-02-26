import React, { useState } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import WorkArea from './components/WorkArea';

import Dashboard from './pages/Dashboard';
import AgentsHub from './pages/AgentsHub';
import TasksMap from './pages/TasksMap';

// Placeholder Pages for Phase 2
const Profile = () => <div className="page-content"><h2>Account Space</h2><p>Coming Soon...</p></div>;
const InvoiceBuilder = () => <div className="page-content"><h2>Invoice Builder</h2><p>Coming Soon...</p></div>;
const ToolsBox = () => <div className="page-content"><h2>Tools</h2><p>Coming Soon...</p></div>;

import './styles/global.css';

function AppContent() {
  const [instances, setInstances] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const location = useLocation();

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

  const activeInstance = instances.find(inst => inst.id === activeId);

  // Check if we are currently on the WhatsApp route
  const isWhatsApp = location.pathname === '/whatsapp-hub' || location.pathname === '/';

  return (
    <div className="app-container">
      <Sidebar
        instances={instances}
        activeId={activeId}
        onSelect={setActiveId}
        onAdd={handleAddInstance}
        onRemove={handleRemoveInstance}
        currentPath={location.pathname}
      />

      <div className="main-content">
        <Topbar activeInstance={isWhatsApp ? activeInstance : null} currentTitle={location.pathname} />

        {/*
          CRITICAL: We ALWAYS render the WorkArea (which holds the <webview> tags).
          If the user is not on the /whatsapp-hub route, we hide it via CSS to prevent
          memory/DOM destruction in Electron.
        */}
        <div style={{ display: isWhatsApp ? 'block' : 'none', height: '100%' }}>
          <WorkArea instances={instances} activeId={activeId} />
        </div>

        {/* Standard React Routing for text/UI-based pages */}
        {!isWhatsApp && (
          <div className="scrollable-content" style={{ height: '100%', padding: '24px' }}>
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
