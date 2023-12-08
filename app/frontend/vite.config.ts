import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import postcssNesting from 'postcss-nesting';
import { visualizer } from 'rollup-plugin-visualizer';


// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        visualizer({
            filename: './build-report/stats.html', 
            open: false, 
            gzipSize: true
        })
    ],
    build: {
        rollupOptions: {
            output:{
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        // Chunking Fluent UI into separate chunks
                        if (id.includes('@fluentui')) {
                            // You can create more refined rules here to split into even smaller chunks
                            const packageName = id.split('node_modules/')[1].split('/')[1];
                            return `fluentui-${packageName}`;
                        }
                        return id.toString().split('node_modules/')[1].split('/')[0].toString();
                    }
                }
            }
        },
        outDir: "../backend/static",
        emptyOutDir: true,
        sourcemap: true
    },
    server: {
        proxy: {
            "/chat": "http://localhost:5000"
        }
    },
    css: {
        postcss: {
            plugins: [
                postcssNesting
            ],
        },
    }
});
