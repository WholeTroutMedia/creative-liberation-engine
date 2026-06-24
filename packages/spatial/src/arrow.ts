/**
 * ArrowJS Zero-Build Dynamic UI Builder
 * Enables Creative Liberation Engine agents to dynamically generate lightweight, reactive,
 * and disposable browser interfaces without any build steps.
 */

export interface ArrowJSPageOptions {
    title: string;
    state: Record<string, any>;
    /**
     * The reactive HTML template function body as a string.
     * Example: "html`<div>Count: ${state.count} <button @click=${() => state.count++}>+</button></div>`"
     */
    template: string;
    /**
     * Optional raw CSS styling to embed.
     */
    css?: string;
    /**
     * Enable modern styling (Tailwind CSS, Outfit/Inter typography, dark glassmorphic theme).
     */
    premiumTheme?: boolean;
}

export class ArrowJSBuilder {
    /**
     * Generates a fully functional, self-contained HTML page loading ArrowJS from CDN
     * and binding the reactive state to the template.
     */
    static buildPage(options: ArrowJSPageOptions): string {
        const { title, state, template, css = '', premiumTheme = true } = options;

        const tailwindScript = premiumTheme 
            ? '<script src="https://cdn.tailwindcss.com"></script>'
            : '';

        const premiumStyles = premiumTheme
            ? `
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Space+Grotesk:wght@400;700&display=swap');
                body {
                    font-family: 'Outfit', sans-serif;
                    background: radial-gradient(circle at top right, #1e1b4b, #09090b);
                    color: #f4f4f5;
                }
                .glass-card {
                    background: rgba(15, 23, 42, 0.65);
                    backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.7);
                }
                .accent-glow {
                    background: linear-gradient(135deg, #a855f7 0%, #6366f1 100%);
                    box-shadow: 0 0 30px -5px rgba(99, 102, 241, 0.5);
                }
            `
            : '';

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    ${tailwindScript}
    <style>
        ${premiumStyles}
        ${css}
    </style>
</head>
<body class="min-h-screen flex items-center justify-center p-6">
    <div id="app" class="w-full max-w-2xl p-8 rounded-2xl glass-card transition-all duration-300">
        <!-- Render target -->
    </div>

    <!-- Load ArrowJS v1.0.0 from CDN -->
    <script type="module">
        import { r, html } from 'https://esm.sh/@arrow-js/core';

        // 1. Initialize reactive state
        const state = r(${JSON.stringify(state, null, 2)});

        // 2. Define the template
        const appTemplate = html\`
            ${template}
        \`;

        // 3. Mount the template to the #app element
        appTemplate(document.getElementById('app'));

        // Expose state to window for console experimentation/debugging if needed
        window._state = state;
    </script>
</body>
</html>`;
    }

    /**
     * Builds a standard disposable interface for an agent task.
     * Renders a premium control panel showing running tasks and execution metrics.
     */
    static buildDisposableInterface(agentId: string, taskName: string, metrics: Record<string, any>): string {
        const state = {
            status: 'Executing',
            progress: 15,
            logs: ['[System] Initializing sovereign sandbox...', `[${agentId}] Starting ${taskName}...`],
            metrics
        };

        const template = `
            <div class="space-y-6">
                <!-- Header -->
                <div class="flex justify-between items-center border-b border-white/10 pb-4">
                    <div>
                        <h1 class="text-2xl font-bold text-white tracking-tight">CLE Agent Portal</h1>
                        <p class="text-xs text-zinc-400">Agent ID: <span class="font-mono text-indigo-400">${agentId}</span></p>
                    </div>
                    <span class="px-3 py-1 rounded-full text-xs font-semibold accent-glow text-white">\${state.status}</span>
                </div>

                <!-- Metrics Grid -->
                <div class="grid grid-cols-2 gap-4">
                    <div class="p-4 rounded-xl bg-white/5 border border-white/5">
                        <span class="text-xs text-zinc-400 block mb-1">Target Task</span>
                        <span class="text-sm font-semibold text-zinc-200">${taskName}</span>
                    </div>
                    <div class="p-4 rounded-xl bg-white/5 border border-white/5">
                        <span class="text-xs text-zinc-400 block mb-1">Progress</span>
                        <span class="text-sm font-mono font-semibold text-indigo-300">\${state.progress}%</span>
                    </div>
                </div>

                <!-- Progress Bar -->
                <div class="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                    <div class="bg-indigo-500 h-1.5 rounded-full transition-all duration-300" style="width: \${state.progress}%"></div>
                </div>

                <!-- Interactive Controls -->
                <div class="flex gap-4">
                    <button class="px-4 py-2 rounded-lg accent-glow text-white text-sm font-medium hover:opacity-90 active:scale-95 transition-all"
                        @click=\${() => {
                            state.progress = Math.min(state.progress + 15, 100);
                            state.logs.push('[User] Triggered incremental validation check.');
                            if (state.progress === 100) {
                                state.status = 'Complete';
                                state.logs.push('[System] Task completed successfully.');
                            }
                        }}>
                        Progress Task
                    </button>
                    <button class="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-white text-sm font-medium transition-all"
                        @click=\${() => {
                            state.progress = 0;
                            state.status = 'Executing';
                            state.logs = ['[System] Sandbox reset.'];
                        }}>
                        Reset
                    </button>
                </div>

                <!-- Logs Terminal -->
                <div class="space-y-2">
                    <span class="text-xs font-semibold text-zinc-400 block">Live Logs</span>
                    <div class="p-4 rounded-xl bg-zinc-950 border border-white/5 font-mono text-xs text-green-400 h-32 overflow-y-auto space-y-1">
                        \${state.logs.map(log => html\`<div>\${log}</div>\`)}
                    </div>
                </div>
            </div>
        `;

        return this.buildPage({
            title: `Agent Portal — ${agentId}`,
            state,
            template
        });
    }
}
