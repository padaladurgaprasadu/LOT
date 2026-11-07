// workers/pyodide.worker.ts
/// <reference lib="webworker" />

declare function importScripts(...urls: string[]): void;
declare function loadPyodide(options?: any): Promise<any>;

let pyodideInstance: any = null;

async function initPyodideRuntime() {
  if (!pyodideInstance) {
    importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js");
    pyodideInstance = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/",
    });
  }
  return pyodideInstance;
}

self.onmessage = async (event: MessageEvent<{ id: string; code: string }>) => {
  const { id, code } = event.data;
  try {
    const pyodide = await initPyodideRuntime();
    let stdoutBuffer = "";
    pyodide.setStdout({
      batched: (msg: string) => {
        stdoutBuffer += msg + "\n";
      },
    });
    const result = await pyodide.runPythonAsync(code);
    self.postMessage({ id, status: "SUCCESS", stdout: stdoutBuffer, result: String(result ?? "") });
  } catch (err: any) {
    self.postMessage({ id, status: "ERROR", error: err.message });
  }
};
