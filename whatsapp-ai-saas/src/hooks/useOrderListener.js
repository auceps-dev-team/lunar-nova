import { useState, useEffect, useCallback } from 'react';

export function useOrderListener(instanceId) {
    const [orders, setOrders] = useState([]);
    const [isListening, setIsListening] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState(null);

    // Fetch initial status and load past orders
    useEffect(() => {
        if (!instanceId) return;

        const checkStatus = async () => {
            try {
                // Check if already listening
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
                console.error('[IOL] Error fetching initial status:', err);
            }
        };

        checkStatus();
    }, [instanceId]);

    // Handle Server-Sent Events (SSE) connection
    useEffect(() => {
        if (!isListening || !instanceId) return;

        console.log(`[IOL] Connecting to SSE stream for ${instanceId}...`);
        const eventSource = new EventSource(`http://localhost:3000/api/orders/stream/${instanceId}`);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'order_detected') {
                    console.log('[IOL] Order detected via SSE:', data);
                    setOrders(prev => [data, ...prev].slice(0, 100)); // Keep last 100
                }
            } catch {
                // Ignore parsing errors for heartbeat ":\n\n" lines
            }
        };

        eventSource.onerror = (err) => {
            console.error('[IOL] SSE connection error:', err);
            // Browser will auto-reconnect EventSource automatically
        };

        return () => {
            console.log(`[IOL] Closing SSE stream for ${instanceId}...`);
            eventSource.close();
        };
    }, [isListening, instanceId]);

    const startListening = useCallback(async () => {
        if (!instanceId) return;
        setIsConnecting(true);
        setError(null);

        try {
            const res = await fetch('http://localhost:3000/api/orders/listen/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instance_id: instanceId })
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
    }, [instanceId]);

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
    }, [instanceId]);

    const clearOrders = useCallback(() => {
        setOrders([]);
    }, []);

    return {
        orders,
        isListening,
        isConnecting,
        error,
        startListening,
        stopListening,
        clearOrders
    };
}
