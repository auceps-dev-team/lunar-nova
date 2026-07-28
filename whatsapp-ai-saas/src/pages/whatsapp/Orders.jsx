import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../../store';
import { useGlobalOrderListener } from '../../hooks/useGlobalOrderListener';
import '../../styles/global.css';

const Orders = () => {
    const instances = useAppStore(state => state.instances);
    const setInvoiceDraft = useAppStore(state => state.setInvoiceDraft);
    const showAppNotification = useAppStore(state => state.showAppNotification);
    const navigate = useNavigate();

    // IOL Global State
    const selectedInstanceId = useAppStore(s => s.iolInstanceId) || (instances.length > 0 ? instances[0].id : null);
    const setIolInstanceId = useAppStore(s => s.setIolInstanceId);
    const orders = useAppStore(s => s.iolOrders);
    const liveMessages = useAppStore(s => s.iolMessages);
    const isListening = useAppStore(s => s.isIolActive);

    const removeIolMessages = useAppStore(s => s.removeIolMessages);

    // Selection State
    const [selectedIds, setSelectedIds] = useState(new Set());

    // IOL Hook Actions
    const { isConnecting, startListening, stopListening } = useGlobalOrderListener();

    // Find if a message is a detected order
    const getOrderDetails = (msgId) => {
        return orders.find(o => o.id === msgId);
    };

    // Handle "Action" Button to generate Invoice
    const handleGenerateInvoice = (order) => {
        const invoiceData = {
            clientName: order.contactName,
            notes: `Commande WhatsApp détectée: "${order.messageText}"`,
            rawMessage: order.messageText,
            confidence: order.classification?.confidence || 1.0
        };
        setInvoiceDraft(invoiceData);
        navigate('/invoice-builder');
    };

    // Deletion Logic
    const handleDeleteMessage = async (msgId, isOrder) => {
        if (!window.confirm("Supprimer ce message/commande ?")) return;

        try {
            if (isOrder) {
                const res = await fetch(`http://localhost:3000/api/orders/${msgId}`, { method: 'DELETE' });
                const data = await res.json();
                if (data.status !== 'success') throw new Error(data.error);
            }
            removeIolMessages([msgId]);
            setSelectedIds(prev => {
                const next = new Set(prev);
                next.delete(msgId);
                return next;
            });
            showAppNotification('Message supprimé', 'success');
        } catch (err) {
            console.error(err);
            showAppNotification('Erreur de suppression', 'error');
        }
    };

    const handleBulkDelete = async () => {
        const idsArray = Array.from(selectedIds);
        if (!window.confirm(`Supprimer ${idsArray.length} messages ?`)) return;

        try {
            // Filter which IDs are actually orders in DB
            const orderIds = idsArray.filter(id => orders.some(o => o.id === id));
            if (orderIds.length > 0) {
                const res = await fetch(`http://localhost:3000/api/orders/bulk-delete`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: orderIds })
                });
                const data = await res.json();
                if (data.status !== 'success') throw new Error(data.error);
            }

            removeIolMessages(idsArray);
            setSelectedIds(new Set());
            showAppNotification(`${idsArray.length} messages supprimés`, 'success');
        } catch (err) {
            console.error(err);
            showAppNotification('Erreur de suppression groupée', 'error');
        }
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedIds(new Set(liveMessages.map(m => m.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    if (instances.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center p-8 bg-surface">
                <div className="text-center max-w-md">
                    <h2 className="text-2xl font-bold text-text-main mb-2">Aucune instance WhatsApp</h2>
                    <p className="text-text-muted">Veuillez d'abord connecter une instance dans le Dashboard WhatsApp.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-xl shadow-card overflow-hidden">
            {/* Header & Controls */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 shrink-0 bg-white dark:bg-gray-900 z-10">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>
                            Live Message & Order Radar
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Flux en temps réel de tous les messages WhatsApp avec détection IA intelligente.
                        </p>
                    </div>

                    <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-800 p-2 rounded-lg border border-gray-100 dark:border-gray-700">
                        {selectedIds.size > 0 && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 rounded-md mr-2 animate-in fade-in slide-in-from-right-2">
                                <span className="text-xs font-bold text-blue-700 dark:text-blue-300">{selectedIds.size} sélectionnés</span>
                                <button 
                                    onClick={handleBulkDelete}
                                    className="bg-red-600 hover:bg-red-700 text-white text-[10px] py-1 px-3 rounded font-bold transition-colors"
                                >
                                    SUPPRIMER
                                </button>
                            </div>
                        )}

                        <select
                            className="input bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-sm py-1.5"
                            value={selectedInstanceId || ''}
                            onChange={(e) => setIolInstanceId(e.target.value)}
                            disabled={isListening}
                        >
                            {instances.map(inst => (
                                <option key={inst.id} value={inst.id}>{inst.name} ({inst.status})</option>
                            ))}
                        </select>

                        <button
                            className={`btn-primary flex items-center gap-2 py-2 px-4 shadow-sm transition-all duration-300 ${isListening ? 'bg-red-500 hover:bg-red-600 border-red-500' : 'bg-primary hover:bg-primary-hover border-primary'}`}
                            onClick={() => isListening ? stopListening() : startListening(selectedInstanceId)}
                            disabled={isConnecting || !selectedInstanceId}
                        >
                            {isConnecting ? (
                                <>
                                    <span className="pulse w-2 h-2 rounded-full bg-white opacity-50"></span>
                                    Connexion...
                                </>
                            ) : isListening ? (
                                <>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                                    Désactiver le Radar
                                </>
                            ) : (
                                <>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                    Lancer le Radar
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto p-6 bg-gray-50/50 dark:bg-gray-900/50">
                {isListening ? (
                    <div className="flex items-center gap-3 mb-6 bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300 p-3 rounded-lg border border-green-200 dark:border-green-800/50">
                        <span className="pulse w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                        <span className="text-sm font-medium">Flux Live activé. Capture de tous les messages entrants...</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-3 mb-6 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                        <span className="text-sm">Le radar est en pause. Aucun message n'est capturé.</span>
                    </div>
                )}

                <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/80 dark:bg-gray-900/80 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
                                <th className="p-4 w-10">
                                    <input 
                                        type="checkbox" 
                                        className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                                        checked={liveMessages.length > 0 && selectedIds.size === liveMessages.length}
                                        onChange={handleSelectAll}
                                    />
                                </th>
                                <th className="p-4 font-semibold w-1/5">Client & Temps</th>
                                <th className="p-4 font-semibold w-1/4">Message Direct</th>
                                <th className="p-4 font-semibold w-1/3">Analyse IA & Actions</th>
                                <th className="p-4 font-semibold text-right w-32">Statut</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                            {liveMessages.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-gray-500 dark:text-gray-400 italic">
                                        En attente de messages réseau...
                                    </td>
                                </tr>
                            ) : (
                                liveMessages.map((msg) => {
                                    const order = getOrderDetails(msg.id);
                                    const isOrder = !!order;
                                    const isSelected = selectedIds.has(msg.id);
                                    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                                    return (
                                        <tr key={msg.id} className={`group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${isOrder ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''} ${isSelected ? 'bg-blue-50/60 dark:bg-blue-900/30' : ''}`}>
                                            <td className="p-4">
                                                <input 
                                                    type="checkbox" 
                                                    className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelect(msg.id)}
                                                />
                                            </td>
                                            <td className="p-4 align-top">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm ${isOrder ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'}`}>
                                                        {msg.contactName?.charAt(0) || '?'}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-gray-900 dark:text-white truncate max-w-[120px]">
                                                            {msg.contactName}
                                                        </div>
                                                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                                                            {time} • {selectedInstanceId?.substring(0, 6)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 align-top italic text-gray-600 dark:text-gray-400 border-l border-gray-50 dark:border-gray-800">
                                                "{msg.messageText}"
                                            </td>
                                            <td className="p-4 align-top">
                                                {isOrder ? (
                                                    <div className="flex flex-col gap-2">
                                                        <div className="bg-emerald-50 dark:bg-emerald-900/30 p-2 rounded-lg border border-emerald-100 dark:border-emerald-800/40 text-xs">
                                                            <div className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 mb-1">
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                                Commande Détectée ({Math.round(order.classification?.confidence * 100)}%)
                                                            </div>
                                                            <div className="text-emerald-800 dark:text-emerald-300 leading-relaxed">
                                                                {order.classification?.summary || "Traitement en cours..."}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button 
                                                                onClick={() => handleGenerateInvoice(order)}
                                                                className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded shadow-sm transition-colors flex items-center justify-center gap-1"
                                                            >
                                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                                                                CRÉER FACTURE
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-gray-400 py-2 italic flex items-center gap-2">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                                        Observé (Non classifié comme commande)
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 align-top text-right">
                                                <div className="flex flex-col items-end gap-2">
                                                    {isOrder ? (
                                                        <span className="badge badge-warning text-[10px] py-0.5 px-2 font-bold animate-pulse">ACTION REQ</span>
                                                    ) : (
                                                        <span className="text-[10px] text-gray-400 bg-gray-50 dark:bg-gray-800 py-0.5 px-2 rounded-full border border-gray-100 dark:border-gray-700">STREAMING</span>
                                                    )}
                                                    
                                                    <button 
                                                        onClick={() => handleDeleteMessage(msg.id, isOrder)}
                                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors group-hover:opacity-100 opacity-0"
                                                        title="Supprimer ce message"
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Orders;
