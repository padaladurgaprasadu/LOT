// lib/zipExporter.ts
import { AgentFile } from './lotSuperAgent';

export async function downloadWorkspaceAsZip(
  files: Record<string, AgentFile>,
  projectName: string = 'lot-ai-project'
): Promise<void> {
  if (typeof window === 'undefined') return;

  // Dynamically load JSZip from CDN on demand
  if (!(window as any).JSZip) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src =
        'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load ZIP library'));
      document.head.appendChild(script);
    });
  }

  const zip = new (window as any).JSZip();
  Object.values(files).forEach((file) => {
    zip.file(file.path, file.content);
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName.replace(/[^a-z0-9-_]/gi, '-')}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
