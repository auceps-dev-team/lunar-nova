import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../../store';
import { getTranslation as t } from '../../locales';
import { useOrderListener } from '../../hooks/useOrderListener';
import '../../styles/global.css';

const Orders = () => {
    const instances = useAppStore(state => state.instances);
    const setInvoiceDraft = useAppStore(state => state.setInvoiceDraft);
    const appSettings = useAppStore(state => state.appSettings) || {};
    const language = appSettings.language || 'en';
    const navigate = useNavigate();

    // Default to the first instance if available
    const [selectedInstanceId, setSelectedInstanceId] = useState(
        instances.length > 0 ? instances[0].id : null
    );

    // IOL Hook
    const { orders, isListening, isConnecting, startListening, stopListening, clearOrders } = useOrderListener(selectedInstanceId);

    // Handle "Action" Button to generate Invoice
    const handleGenerateInvoice = (order) => {
        // Prepare the payload for InvoiceBuilder
        const invoiceData = {
            clientName: order.contactName,
            notes: `Commande WhatsApp détectée: "${order.messageText}"`,
            // Provide raw text for the user to copy/paste or parse if needed
            rawMessage: order.messageText,
            confidence: order.classification.confidence
        };
        setInvoiceDraft(invoiceData);
        navigate('/invoice-builder');
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
                            Intelligent Order Listener (IOL)
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Détection et classification automatique des commandes sur WhatsApp.
                        </p>
                    </div>

                    <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-800 p-2 rounded-lg border border-gray-100 dark:border-gray-700">
                        <select
                            className="input bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-sm py-1.5"
                            value={selectedInstanceId || ''}
                            onChange={(e) => setSelectedInstanceId(e.target.value)}
                            disabled={isListening}
                        >
                            {instances.map(inst => (
                                <option key={inst.id} value={inst.id}>{inst.name} ({inst.status})</option>
                            ))}
                        </select>

                        <button
                            className={`btn-primary flex items-center gap-2 py-2 px-4 ${isListening ? 'bg-red-500 hover:bg-red-600 border-red-500' : ''}`}
                            onClick={isListening ? stopListening : startListening}
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
                                    Arrêter l'écoute
                                </>
                            ) : (
                                <>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                    Activer Firebase IOL
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
                        <span className="text-sm font-medium">Écoute active sur l'instance sélectionnée. En attente de messages...</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-3 mb-6 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                        <span className="text-sm">Le radar est actuellement en pause. Cliquez sur "Activer l'écoute" pour détecter les commandes entrantes.</span>
                    </div>
                )}

                <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/80 dark:bg-gray-900/80 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
                                <th className="p-4 font-semibold w-1/5">Client</th>
                                <th className="p-4 font-semibold w-1/3">Message Reçu</th>
                                <th className="p-4 font-semibold w-1/4">Réponse Générée (Agent)</th>
                                <th className="p-4 font-semibold text-center w-24">Confiance</th>
                                <th className="p-4 font-semibold text-right w-32">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {orders.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm italic">
                                        Aucune commande détectée pour l'instant. Laissez tourner l'IOL en arrière-plan.
                                    </td>
                                </tr>
                            ) : (
                                orders.map((order, index) => (
                                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                        <td className="p-4 align-top">
                                            <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300 flex items-center justify-center text-xs font-bold">
                                                    {order.contactName?.charAt(0) || '?'}
                                                </div>
                                                {order.contactName || 'Inconnu'}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">Instance: {selectedInstanceId?.substring(0, 8)}...</div>
                                        </td>
                                        <td className="p-4 align-top">
                                            <div className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700 italic">
                                                "{order.messageText}"
                                            </div>
                                        </td>
                                        <td className="p-4 align-top">
                                            <div className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-800/50">
                                                {order.agentReply ? order.agentReply : <span className="text-gray-400 flex items-center gap-1"><span className="pulse w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Génération...</span>}
                                            </div>
                                        </td>
                                        <td className="p-4 align-top text-center">
                                            <div className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                                                {Math.round(order.classification?.confidence * 100)}%
                                            </div>
                                        </td>
                                        <td className="p-4 align-top text-right">
                                            <button
                                                onClick={() => handleGenerateInvoice(order)}
                                                className="inline-flex flex-col items-center justify-center p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors group"
                                                title="Générer une Facture"
                                            >
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                                <span className="text-[10px] mt-1 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">Facturer</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Orders;
