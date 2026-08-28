const fs = require('fs');
const path = require('path');

class PersonaOrchestrator {
    constructor() {
        this.personas = new Map();
        this.loadPersonas();
    }

    // Load all persona files from the personas directory
    loadPersonas() {
        const personasDir = path.join(__dirname, 'personas');

        try {
            if (!fs.existsSync(personasDir)) {
                console.warn(`[Orchestrator] Personas directory not found at ${personasDir}`);
                return;
            }

            const files = fs.readdirSync(personasDir);

            for (const file of files) {
                if (file.endsWith('.js')) {
                    try {
                        const personaData = require(path.join(personasDir, file));
                        if (personaData && personaData.id) {
                            this.personas.set(personaData.id, personaData);
                            // stderr, pas stdout : le CLI (--json) et le serveur MCP (JSON-RPC
                            // sur stdout) ne doivent recevoir que leur propre sortie protocolaire.
                            console.error(`[Orchestrator] Loaded persona: ${personaData.id} (${personaData.name})`);
                        }
                    } catch (err) {
                        console.error(`[Orchestrator] Failed to load persona file ${file}:`, err.message);
                    }
                }
            }
        } catch (err) {
            console.error('[Orchestrator] Initialization error:', err);
        }
    }

    /**
     * Retrieves a specific persona by ID
     * @param {string} id The persona ID (e.g., 'copywriter', 'creative')
     * @returns {object|null} The persona configuration object, or null if not found
     */
    getPersona(id) {
        if (!this.personas.has(id)) {
            console.warn(`[Orchestrator] Persona '${id}' requested but not found. Falling back to default if applicable.`);
            return null;
        }
        return this.personas.get(id);
    }

    /**
     * Lists all available personas
     * @returns {Array<object>} Array of persona configurations
     */
    getAllPersonas() {
        return Array.from(this.personas.values());
    }

    /**
     * Helper logic to determine if a persona requires JSON output based on its config
     * @param {string} id 
     * @returns {boolean}
     */
    requiresJsonFormat(id) {
        const persona = this.getPersona(id);
        return persona && persona.outputFormat === 'json';
    }
}

// Export as a singleton instance so it only loads files once on startup
const orchestrator = new PersonaOrchestrator();
module.exports = orchestrator;
