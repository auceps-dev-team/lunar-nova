// Manager for multi-tenant WhatsApp instances
class WhatsAppManager {
    constructor() {
        this.instances = new Map();
    }

    addInstance(id, webContentsId) {
        this.instances.set(id, webContentsId);
        console.log(`[WhatsAppManager] Added instance ${id}`);
    }

    removeInstance(id) {
        if (this.instances.has(id)) {
            this.instances.delete(id);
            console.log(`[WhatsAppManager] Removed instance ${id}`);
            return true;
        }
        return false;
    }

    getInstance(id) {
        return this.instances.get(id);
    }
}

module.exports = WhatsAppManager;
