/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                "primary": "#10B981", // Vital Green
                "primary-dark": "#059669",
                "background-light": "#F3F4F6", // Cool Gray 100
                "background-dark": "#111827",
                "surface": "#FFFFFF",
                "text-main": "#111827",
                "text-muted": "#6B7280",
                "accent": "#E0F2FE", // Sky 100
                "chat-human": "#D1FAE5", // Light Green
                "chat-ai": "#E0F2FE", // Light Blue
                "chat-customer": "#F3F4F6", // Gray 100
                "sidebar-dark": "#0f2e27", // Dark green sidebar inspired by reference
            },
            fontFamily: {
                "display": ["Plus Jakarta Sans", "sans-serif"],
                "body": ["Inter", "sans-serif"],
                "mono": ["JetBrains Mono", "monospace"],
            },
            boxShadow: {
                "soft": "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(0, 0, 0, 0.01)",
                "card": "0 2px 8px rgba(0,0,0,0.04)",
            },
            borderRadius: {
                "lg": "16px",
                "md": "12px",
                "sm": "8px",
            }
        },
    },
    plugins: [],
}
