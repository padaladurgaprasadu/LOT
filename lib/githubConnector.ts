// lib/githubConnector.ts
import { AgentFile } from './lotSuperAgent';

// Ignore heavy binary files, lockfiles, and build folders so LOT stays ultra-fast
const IGNORED_PATHS_REGEX =
  /(^|\/)(node_modules|\.git|\.next|dist|build|out|coverage|\.vercel|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|\.DS_Store)($|\/)/i;

const ALLOWED_CODE_EXTENSIONS =
  /\.(ts|tsx|js|jsx|py|html|css|scss|json|md|sql|prisma|sh|yml|yaml|toml|v|sv|c|cpp|h|rs|go|java|kt)$/i;

export function parseGitHubInput(input: string): {
  owner: string;
  repo: string;
  branch?: string;
} | null {
  const cleaned = input.trim().replace(/\/+$/, '').replace(/\.git$/, '');

  // Match full URL: https://github.com/owner/repo or https://github.com/owner/repo/tree/branch
  const urlMatch = cleaned.match(
    /github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+))?/i
  );
  if (urlMatch) {
    return {
      owner: urlMatch[1],
      repo: urlMatch[2],
      branch: urlMatch[3],
    };
  }

  // Match shorthand: owner/repo
  const shortMatch = cleaned.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (shortMatch) {
    return { owner: shortMatch[1], repo: shortMatch[2] };
  }

  return null;
}

export async function importGitHubRepoToWorkspace(
  repoUrlOrSlug: string,
  githubToken?: string,
  maxFiles: number = 35
): Promise<{
  files: Record<string, AgentFile>;
  repoFullName: string;
  branch: string;
}> {
  const parsed = parseGitHubInput(repoUrlOrSlug);
  if (!parsed) {
    throw new Error(
      'Invalid GitHub URL. Use format: https://github.com/username/repo'
    );
  }

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  // 1. Get default branch if not specified in URL
  let branch = parsed.branch;
  if (!branch) {
    const repoRes = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`,
      { headers }
    );
    if (!repoRes.ok) {
      throw new Error(
        `Repository not found or private (${repoRes.status}). Add a GitHub token for private repos.`
      );
    }
    const repoMeta = await repoRes.json();
    branch = repoMeta.default_branch || 'main';
  }

  // 2. Fetch the entire repository file tree in 1 single API call
  const treeRes = await fetch(
    `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${branch}?recursive=1`,
    { headers }
  );
  if (!treeRes.ok) {
    throw new Error('Failed to read repository file tree from GitHub.');
  }

  const treeData = await treeRes.json();
  const allBlobs = (treeData.tree || []).filter(
    (item: any) =>
      item.type === 'blob' &&
      !IGNORED_PATHS_REGEX.test(item.path) &&
      ALLOWED_CODE_EXTENSIONS.test(item.path) &&
      (item.size || 0) < 120000 // Skip files larger than 120KB
  );

  // Prioritize entry files (app/, src/, components/, lib/, README, package.json)
  const selectedBlobs = allBlobs.slice(0, maxFiles);
  const files: Record<string, AgentFile> = {};

  // 3. Download raw file contents in parallel via raw.githubusercontent.com (Zero API rate limit!)
  await Promise.all(
    selectedBlobs.map(async (blob: any) => {
      try {
        const rawUrl = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${branch}/${blob.path}`;
        const rawRes = await fetch(
          rawUrl,
          githubToken
            ? { headers: { Authorization: `Bearer ${githubToken}` } }
            : undefined
        );

        if (rawRes.ok) {
          const content = await rawRes.text();
          const ext = blob.path.split('.').pop() || 'txt';
          files[blob.path] = {
            path: blob.path,
            language: ext,
            content,
            lastModified: Date.now(),
          };
        }
      } catch {
        // Safely skip individual unreadable files
      }
    })
  );

  return {
    files,
    repoFullName: `${parsed.owner}/${parsed.repo}`,
    branch: branch || 'main',
  };
}

// 4. Push modified files from LOT directly back to GitHub
export async function pushFileToGitHub(params: {
  repoFullName: string;
  branch: string;
  filePath: string;
  content: string;
  commitMessage: string;
  githubToken: string;
}): Promise<void> {
  const { repoFullName, branch, filePath, content, commitMessage, githubToken } =
    params;

  const apiUrl = `https://api.github.com/repos/${repoFullName}/contents/${filePath}`;
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    Authorization: `Bearer ${githubToken}`,
    'Content-Type': 'application/json',
  };

  // Get existing file SHA if updating an existing file
  let sha: string | undefined;
  const existingRes = await fetch(`${apiUrl}?ref=${branch}`, { headers });
  if (existingRes.ok) {
    const existingData = await existingRes.json();
    sha = existingData.sha;
  }

  // Encode UTF-8 string safely to Base64
  const base64Content = btoa(unescape(encodeURIComponent(content)));

  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: commitMessage,
      content: base64Content,
      branch,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!putRes.ok) {
    const err = await putRes.json().catch(() => ({}));
    throw new Error(err.message || `Failed to push ${filePath}`);
  }
}

// 5. Batch Push entire workspace or modified files to GitHub
export async function pushWorkspaceToGitHub(
  repoFullName: string,
  files: Record<string, { path?: string; content?: string; language?: string }>,
  commitMessage: string,
  branch?: string,
  token?: string
): Promise<{ success: boolean; commitUrl?: string; error?: string; filesCommitted?: number }> {
  if (!repoFullName || typeof repoFullName !== 'string' || !repoFullName.includes('/')) {
    return {
      success: false,
      error: 'Invalid repository name. Format must be owner/repo.',
    };
  }

  if (!token || typeof token !== 'string' || !token.trim()) {
    return {
      success: false,
      error: 'GitHub Personal Access Token is required to push changes.',
    };
  }

  const fileEntries = Object.entries(files || {}).filter(
    ([_, fileObj]) => fileObj && typeof fileObj.content === 'string'
  );

  if (fileEntries.length === 0) {
    return {
      success: false,
      error: 'No files to commit in workspace.',
    };
  }

  const targetBranch = branch?.trim() || 'main';
  const msg = commitMessage?.trim() || 'Update workspace via LOT Super-Agent';
  let filesCommitted = 0;

  try {
    for (const [pathKey, fileObj] of fileEntries) {
      const filePath = fileObj.path || pathKey;
      const content = fileObj.content ?? '';
      await pushFileToGitHub({
        repoFullName: repoFullName.trim(),
        branch: targetBranch,
        filePath,
        content,
        commitMessage: `${msg} (${filePath})`,
        githubToken: token.trim(),
      });
      filesCommitted++;
    }

    return {
      success: true,
      commitUrl: `https://github.com/${repoFullName.trim()}/tree/${targetBranch}`,
      filesCommitted,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to push workspace to GitHub',
      filesCommitted,
    };
  }
}

