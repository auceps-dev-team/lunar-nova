import { useEffect, useState, useCallback } from 'react';
import useAppStore from '../store';

let globalEventSource = null;

export function useGlobalOrderListener(isRoot = false) {
    const instanceId = useAppStore(s => s.iolInstanceId);
    const isListening = useAppStore(s => s.isIolActive);
    
    const setIolInstanceId = useAppStore(s => s.setIolInstanceId);
    const setIsListening = useAppStore(s => s.setIsIolActive);
    const setOrders = useAppStore(s => s.setIolOrders);

    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState(null);

    // Initial load of orders and status when instanceId changes
    useEffect(() => {
        if (!isRoot || !instanceId) return;

        const checkStatus = async () => {
            try {
                // Check if already listening globally on the backend
                const statusRes = await fetch('http://localhost:3000/api/orders/listen/status');
                const statusData = await statusRes.json();
                if (statusData.active_listeners?.includes(instanceId)) {
                    setIsListening(true);
                }

                // Fetch recent orders
                const ordersRes = await fetch(`http://localhost:3000/api/orders?instance_id=${instanceId}&limit=50`);
                const ordersData = await ordersRes.json();
                if (ordersData.data) {
                    setOrders(ordersData.data);
                }
            } catch (err) {
                console.error('[IOL Global] Error fetching initial status:', err);
            }
        };

        checkStatus();
    }, [isRoot, instanceId, setIsListening, setOrders]);

    // Handle Server-Sent Events (SSE) connection Globally
    useEffect(() => {
        if (!isRoot) return;

        if (!isListening || !instanceId) {
            if (globalEventSource) {
                console.log(`[IOL Global] Stopping SSE stream...`);
                globalEventSource.close();
                globalEventSource = null;
            }
            return;
        }

        // Keep existing connection alive if it matches
        if (globalEventSource && globalEventSource.url.includes(instanceId) && globalEventSource.readyState !== 2) {
            return;
        }

        // Teardown mismatch
        if (globalEventSource) {
            globalEventSource.close();
        }

        console.log(`[IOL Global] Connecting to SSE stream for ${instanceId}...`);
        globalEventSource = new EventSource(`http://localhost:3000/api/orders/stream/${instanceId}`);

        globalEventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'order_detected') {
                    console.log('[IOL Global] Order detected via SSE:', data);
                    useAppStore.getState().addIolOrder(data);
                } else if (data.type === 'message_received') {
                    console.log('[IOL Global] Message received via SSE:', data);
                    useAppStore.getState().addIolMessage(data);
                }
            } catch {
                // Ignore parsing errors for heartbeat
            }
        };

        globalEventSource.onerror = (err) => {
            console.error('[IOL Global] SSE connection error. Browser will auto-reconnect...', err);
        };

        // We explicitly DO NOT return a cleanup function here.
        // The singleton is only torn down when isListening becomes false.
    }, [isListening, instanceId, isRoot]);

    const startListening = useCallback(async (idToListen = null) => {
        const id = idToListen || instanceId;
        if (!id) return;
        
        if (id !== instanceId) setIolInstanceId(id);
        
        setIsConnecting(true);
        setError(null);

        try {
            const res = await fetch('http://localhost:3000/api/orders/listen/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instance_id: id })
            });

            const data = await res.json();
            if (data.status === 'success') {
                setIsListening(true);
            } else {
                setError(data.error || 'Failed to start listening');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsConnecting(false);
        }
    }, [instanceId, setIolInstanceId, setIsListening]);

    const stopListening = useCallback(async () => {
        if (!instanceId) return;
        setIsConnecting(true);
        setError(null);

        try {
            const res = await fetch('http://localhost:3000/api/orders/listen/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instance_id: instanceId })
            });

            const data = await res.json();
            if (data.status === 'success') {
                setIsListening(false);
            } else {
                setError(data.error || 'Failed to stop listening');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsConnecting(false);
        }
    }, [instanceId, setIsListening]);

    return {
        isConnecting,
        error,
        startListening,
        stopListening
    };
}
