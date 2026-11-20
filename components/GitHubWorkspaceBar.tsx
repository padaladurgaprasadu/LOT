// components/GitHubWorkspaceBar.tsx
"use client";

import React, { useState } from 'react';
import { AgentFile } from '@/lib/lotSuperAgent';
import {
  importGitHubRepoToWorkspace,
  pushFileToGitHub,
  pushWorkspaceToGitHub,
} from '@/lib/githubConnector';
import { downloadWorkspaceAsZip } from '@/lib/zipExporter';

interface GitHubWorkspaceBarProps {
  files: Record<string, AgentFile>;
  activeFilePath: string;
  onRepoImported: (
    importedFiles: Record<string, AgentFile>,
    repoSummaryPrompt: string
  ) => void;
}

export function GitHubWorkspaceBar({
  files,
  activeFilePath,
  onRepoImported,
}: GitHubWorkspaceBarProps) {
  const [repoInput, setRepoInput] = useState('');
  const [connectedRepo, setConnectedRepo] = useState<{
    name: string;
    branch: string;
  } | null>(null);
  const [ghToken, setGhToken] = useState('');
  const [showTokenBox, setShowTokenBox] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState('Update workspace via LOT Super-Agent');
  const [showCommitBox, setShowCommitBox] = useState(false);

  const fileCount = Object.keys(files || {}).length;

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoInput.trim() || loading) return;

    setLoading(true);
    setStatus('Fetching repo tree...');
    try {
      const {
        files: importedFiles,
        repoFullName,
        branch,
      } = await importGitHubRepoToWorkspace(repoInput, ghToken || undefined);

      const fileCount = Object.keys(importedFiles).length;
      setConnectedRepo({ name: repoFullName, branch });
      setStatus(`✓ Imported ${fileCount} files from ${repoFullName}`);

      onRepoImported(
        importedFiles,
        `I just imported the GitHub repository "${repoFullName}" (${fileCount} files) into the workspace. Analyze its architecture and tell me what improvements or bug fixes we can make.`
      );
    } catch (err: any) {
      setStatus(`⚠️ ${err?.message || 'Import failed'}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePushActiveFile = async () => {
    if (!connectedRepo || !files[activeFilePath]) return;
    if (!ghToken) {
      setShowTokenBox(true);
      setStatus('Enter your GitHub Personal Access Token (repo scope) to push.');
      return;
    }

    setLoading(true);
    setStatus(`Pushing ${activeFilePath} to ${connectedRepo.name}...`);
    try {
      await pushFileToGitHub({
        repoFullName: connectedRepo.name,
        branch: connectedRepo.branch,
        filePath: activeFilePath,
        content: files[activeFilePath].content,
        commitMessage: `Update ${activeFilePath} via LOT Super-Agent`,
        githubToken: ghToken,
      });
      setStatus(`✓ Pushed ${activeFilePath} to ${connectedRepo.branch}!`);
    } catch (err: any) {
      setStatus(`⚠️ Push error: ${err?.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePushWorkspace = async () => {
    if (!connectedRepo) {
      setStatus('⚠️ Connect or import a GitHub repository first to push changes.');
      return;
    }
    if (fileCount === 0) {
      setStatus('⚠️ No files in workspace to push.');
      return;
    }
    if (!ghToken) {
      setShowTokenBox(true);
      setStatus('Enter your GitHub Personal Access Token (repo scope) to push.');
      return;
    }

    setLoading(true);
    setStatus(`Pushing ${fileCount} files to ${connectedRepo.name}...`);
    try {
      const res = await pushWorkspaceToGitHub(
        connectedRepo.name,
        files,
        commitMessage,
        connectedRepo.branch,
        ghToken
      );
      if (res.success) {
        setStatus(`✓ Pushed ${res.filesCommitted ?? fileCount} files to ${connectedRepo.branch}!`);
        setShowCommitBox(false);
      } else {
        setStatus(`⚠️ Push error: ${res.error || 'Failed to push workspace'}`);
      }
    } catch (err: any) {
      setStatus(`⚠️ Push error: ${err?.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-b border-neutral-800 bg-neutral-950 px-4 py-2 text-xs text-neutral-200 space-y-2 shrink-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* GitHub Repo URL Input & Changed Files Badge */}
        <div className="flex flex-1 items-center gap-2 min-w-[280px]">
          <form onSubmit={handleImport} className="flex flex-1 items-center gap-2">
            <input
              type="text"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              placeholder="Import GitHub Repo (e.g. owner/repo or https://github.com/...)"
              className="flex-1 min-w-[180px] rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-white placeholder-neutral-500 outline-none focus:border-neutral-600"
            />
            <button
              type="submit"
              disabled={loading || !repoInput.trim()}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-neutral-200 disabled:opacity-40 transition"
            >
              {loading ? 'Loading...' : '⬇ Import Repo'}
            </button>
          </form>

          {fileCount > 0 && (
            <span
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 font-mono text-[11px] shrink-0"
              title={`${fileCount} files in active workspace`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>● {fileCount} modified file{fileCount !== 1 ? 's' : ''}</span>
            </span>
          )}
        </div>

        {/* Export ZIP & Push to GitHub Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTokenBox(!showTokenBox)}
            className="rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-neutral-300 hover:text-white"
            title="Configure GitHub Token for Private Repos & Direct Push"
          >
            🔑 Token
          </button>

          {connectedRepo && (
            <>
              <button
                type="button"
                onClick={() => setShowCommitBox(!showCommitBox)}
                className="rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-neutral-300 hover:text-white"
                title="Edit Commit Message"
              >
                💬 Commit Msg
              </button>

              <button
                type="button"
                onClick={handlePushActiveFile}
                disabled={loading || !files[activeFilePath]}
                className="rounded-lg bg-neutral-800 border border-neutral-700 px-2.5 py-1.5 font-medium text-neutral-200 hover:bg-neutral-700 transition"
                title={`Push only active file (${activeFilePath})`}
              >
                ⬆ Push File
              </button>

              <button
                type="button"
                onClick={handlePushWorkspace}
                disabled={loading || fileCount === 0}
                className="rounded-lg bg-emerald-500 px-3 py-1.5 font-semibold text-black hover:bg-emerald-400 transition"
                title="Push all modified files in workspace in one batch commit"
              >
                ⬆ Push All Changes
              </button>
            </>
          )}

          {fileCount > 0 && (
            <button
              type="button"
              onClick={() =>
                downloadWorkspaceAsZip(
                  files,
                  connectedRepo?.name.split('/')[1] || 'lot-workspace'
                )
              }
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 font-medium text-neutral-200 hover:bg-neutral-800 transition"
            >
              📦 Export ZIP
            </button>
          )}
        </div>
      </div>

      {/* Optional Commit Message Input */}
      {showCommitBox && connectedRepo && (
        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Commit message (e.g. Update features via LOT Super-Agent)"
            className="flex-1 rounded-lg border border-neutral-800 bg-black px-3 py-1 text-xs text-neutral-200 outline-none focus:border-neutral-600"
          />
          <button
            type="button"
            onClick={handlePushWorkspace}
            disabled={loading}
            className="rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-black hover:bg-emerald-400 transition"
          >
            Push Now
          </button>
        </div>
      )}

      {/* Optional GitHub Token Input for Private Repos / Pushing Commits */}
      {showTokenBox && (
        <div className="flex items-center gap-2 pt-1">
          <input
            type="password"
            value={ghToken}
            onChange={(e) => setGhToken(e.target.value)}
            placeholder="Paste GitHub Token (ghp_...) for private repos or pushing commits"
            className="flex-1 rounded-lg border border-neutral-800 bg-black px-3 py-1 text-xs text-emerald-400 outline-none"
          />
        </div>
      )}

      {/* Status Bar */}
      {status && (
        <div className="text-[11px] text-neutral-400 truncate">{status}</div>
      )}
    </div>
  );
}

export default GitHubWorkspaceBar;
