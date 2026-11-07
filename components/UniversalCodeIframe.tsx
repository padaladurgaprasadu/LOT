"use client";

import React, { useMemo } from "react";

interface UniversalCodeIframeProps {
  rawCode: string;
}

export const UniversalCodeIframe: React.FC<UniversalCodeIframeProps> = ({ rawCode }) => {
  const iframeSrcDoc = useMemo(() => {
    // Generate an isolated, responsive HTML preview with Tailwind CDN & React
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
        <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
        <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
        <style>
          body { margin: 0; background-color: #09090b; color: #f4f4f5; font-family: ui-sans-serif, system-ui, sans-serif; }
        </style>
      </head>
      <body>
        <div id="root"></div>
        <script type="text/babel">
          try {
            ${rawCode}
            const rootElement = document.getElementById('root');
            if (typeof App !== 'undefined') {
              ReactDOM.render(<App />, rootElement);
            } else {
              rootElement.innerHTML = '<div class="p-6 text-zinc-400 font-mono text-xs">Awaiting React App() export...</div>';
            }
          } catch (err) {
            document.getElementById('root').innerHTML = '<div class="p-6 text-rose-400 font-mono text-xs">Runtime Error: ' + err.message + '</div>';
          }
        </script>
      </body>
      </html>
    `;
  }, [rawCode]);

  return (
    <div className="w-full h-full rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-2xl flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/80 border-b border-zinc-800 text-xs text-zinc-400 font-mono">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Live Sandbox Viewport
        </span>
        <span>HTML5 / React 18 Sandbox</span>
      </div>
      <iframe
        srcDoc={iframeSrcDoc}
        sandbox="allow-scripts allow-modals"
        title="Universal Live Sandbox Preview"
        className="w-full flex-1 border-0 bg-zinc-950"
      />
    </div>
  );
};
