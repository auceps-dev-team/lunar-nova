
async function test() {
    try {
        console.log("Checking /api/orders/bulk-delete existence...");
        const res = await fetch('http://localhost:3000/api/orders/bulk-delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: [] })
        });
        const data = await res.json();
        console.log("Response:", data);
        if (data.status === 'success') {
            console.log("✅ Route bulk-delete is working.");
        }
    } catch (e) {
        console.error("❌ Failed to reach backend:", e.message);
    }
}
test();
