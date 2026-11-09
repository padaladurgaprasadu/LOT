// public/workers/pyodide.worker.js
// Client-side Python WASM Runner
let pyodideInstance = null;

async function initPyodideRuntime() {
  if (!pyodideInstance) {
    importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js");
    pyodideInstance = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/",
    });
  }
  return pyodideInstance;
}

self.onmessage = async (event) => {
  const { id, code } = event.data || {};
  try {
    const pyodide = await initPyodideRuntime();
    let stdoutBuffer = "";
    pyodide.setStdout({
      batched: (msg) => {
        stdoutBuffer += msg + "\n";
      },
    });
    const result = await pyodide.runPythonAsync(code || "");
    self.postMessage({ id, status: "SUCCESS", stdout: stdoutBuffer, result: String(result ?? "") });
  } catch (err) {
    self.postMessage({ id, status: "ERROR", error: err?.message || String(err) });
  }
};
