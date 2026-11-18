// lib/diff/diffStreamParser.ts
/**
 * Progressive Chunk Diff Stream Parser.
 * State Machine: OUTSIDE -> IN_SEARCH -> IN_REPLACE -> COMPLETE.
 * Handles partial / chunked tokens arriving from streaming LLM responses
 * and emits live progressive diff hunks for real-time UI preview.
 */

import type { DiffHunk } from './diffEngine';

export type DiffStreamState = 'OUTSIDE' | 'IN_SEARCH' | 'IN_REPLACE' | 'COMPLETE';

export type DiffStreamEventType =
  | 'hunk_start'
  | 'hunk_progress'
  | 'hunk_complete'
  | 'stream_complete';

export interface DiffStreamEvent {
  type: DiffStreamEventType;
  state: DiffStreamState;
  hunk?: DiffHunk;
  allHunks: DiffHunk[];
  rawChunk?: string;
}

export type DiffStreamListener = (event: DiffStreamEvent) => void;

export class DiffStreamParser {
  private state: DiffStreamState = 'OUTSIDE';
  private buffer: string = '';
  private currentFilePath: string = '';
  private defaultFilePath: string;
  private hunkCounter: number = 0;
  private activeHunk: DiffHunk | null = null;
  private completedHunks: DiffHunk[] = [];
  private listeners: DiffStreamListener[] = [];

  constructor(defaultFilePath: string = '') {
    this.defaultFilePath = defaultFilePath;
    this.currentFilePath = defaultFilePath;
  }

  /**
   * Registers an event listener for progressive streaming updates.
   */
  public on(listener: DiffStreamListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Emits an event to all registered listeners.
   */
  private emit(type: DiffStreamEventType, hunk?: DiffHunk | null, rawChunk?: string): void {
    const event: DiffStreamEvent = {
      type,
      state: this.state,
      hunk: hunk ? { ...hunk } : undefined,
      allHunks: this.getHunks(),
      rawChunk,
    };
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in DiffStreamParser listener:', err);
      }
    }
  }

  /**
   * Current parser state.
   */
  public getState(): DiffStreamState {
    return this.state;
  }

  /**
   * Currently active (in-progress) hunk, if any.
   */
  public getActiveHunk(): DiffHunk | null {
    return this.activeHunk ? { ...this.activeHunk } : null;
  }

  /**
   * Returns all hunks (completed + active if streaming).
   */
  public getHunks(): DiffHunk[] {
    const list = [...this.completedHunks];
    if (this.activeHunk) {
      list.push({ ...this.activeHunk });
    }
    return list;
  }

  /**
   * Pushes a streaming chunk of tokens into the state machine parser.
   */
  public push(chunk: string): void {
    if (!chunk || this.state === 'COMPLETE') return;

    this.buffer += chunk;
    this.processBuffer(chunk);
  }

  /**
   * Internal processing loop for buffered stream data.
   */
  private processBuffer(rawChunk?: string): void {
    let progressMade = true;

    while (progressMade && this.state !== 'COMPLETE') {
      progressMade = false;

      // Extract file path from <lotFile> or <lotDiff> tags if present
      const lotDiffMatch = this.buffer.match(/<lotDiff\s+path="([^"]+)">/i);
      if (lotDiffMatch) {
        this.currentFilePath = lotDiffMatch[1].trim();
      }

      if (this.state === 'OUTSIDE') {
        const searchMarker = '<<<<<<< SEARCH';
        const markerIdx = this.buffer.indexOf(searchMarker);

        if (markerIdx !== -1) {
          // Look for newline terminating marker line
          const lineEnd = this.buffer.indexOf('\n', markerIdx);
          if (lineEnd !== -1) {
            const markerLine = this.buffer.slice(markerIdx, lineEnd);
            // Check for optional path tag: <<<<<<< SEARCH:src/index.ts or <<<<<<< SEARCH src/index.ts
            const pathTag = markerLine.replace(searchMarker, '').replace(/^[:\s]+/, '').trim();
            if (pathTag) {
              this.currentFilePath = pathTag;
            }

            // Consume buffer up to after the newline
            this.buffer = this.buffer.slice(lineEnd + 1);

            this.hunkCounter++;
            this.activeHunk = {
              id: `stream-hunk-${Date.now()}-${this.hunkCounter}`,
              filePath: this.currentFilePath || this.defaultFilePath,
              hunkIndex: this.completedHunks.length,
              searchBlock: '',
              replaceBlock: '',
              confidence: 1.0,
              status: 'streaming',
            };

            this.state = 'IN_SEARCH';
            this.emit('hunk_start', this.activeHunk, rawChunk);
            progressMade = true;
          }
        }
      } else if (this.state === 'IN_SEARCH') {
        // Look for ======= on its own line
        const dividerRegex = /(?:^|\r?\n)=======[^\r\n]*(?:\r?\n|$)/;
        const match = this.buffer.match(dividerRegex);

        if (match && match.index !== undefined) {
          const matchIdx = match.index;
          // Determine where search content ends
          // If match starts with newline, search content excludes that newline
          const searchContentEnd = matchIdx + (match[0].startsWith('\r\n') ? 0 : match[0].startsWith('\n') ? 0 : 0);
          const searchContent = this.buffer.slice(0, matchIdx);

          if (this.activeHunk) {
            this.activeHunk.searchBlock += searchContent;
          }

          // Consume buffer up to end of divider match
          this.buffer = this.buffer.slice(matchIdx + match[0].length);

          this.state = 'IN_REPLACE';
          this.emit('hunk_progress', this.activeHunk, rawChunk);
          progressMade = true;
        } else {
          // Safe streaming progress: leave trailing characters that might be part of =======
          const safeKeep = 10;
          if (this.buffer.length > safeKeep) {
            const flushLength = this.buffer.length - safeKeep;
            const textToFlush = this.buffer.slice(0, flushLength);
            this.buffer = this.buffer.slice(flushLength);
            if (this.activeHunk) {
              this.activeHunk.searchBlock += textToFlush;
              this.emit('hunk_progress', this.activeHunk, rawChunk);
            }
          }
        }
      } else if (this.state === 'IN_REPLACE') {
        // Look for >>>>>>> REPLACE on its own line
        const endRegex = /(?:^|\r?\n)>>>>>>> REPLACE[^\r\n]*(?:\r?\n|$)/;
        const match = this.buffer.match(endRegex);

        if (match && match.index !== undefined) {
          const matchIdx = match.index;
          const replaceContent = this.buffer.slice(0, matchIdx);

          if (this.activeHunk) {
            this.activeHunk.replaceBlock += replaceContent;
            this.activeHunk.status = 'pending';
            this.completedHunks.push(this.activeHunk);
            const finishedHunk = this.activeHunk;
            this.activeHunk = null;
            this.emit('hunk_complete', finishedHunk, rawChunk);
          }

          // Consume buffer up to end of REPLACE marker
          this.buffer = this.buffer.slice(matchIdx + match[0].length);

          this.state = 'OUTSIDE';
          progressMade = true;
        } else {
          // Safe streaming progress: leave trailing characters that might be part of >>>>>>> REPLACE
          const safeKeep = 18;
          if (this.buffer.length > safeKeep) {
            const flushLength = this.buffer.length - safeKeep;
            const textToFlush = this.buffer.slice(0, flushLength);
            this.buffer = this.buffer.slice(flushLength);
            if (this.activeHunk) {
              this.activeHunk.replaceBlock += textToFlush;
              this.emit('hunk_progress', this.activeHunk, rawChunk);
            }
          }
        }
      }
    }
  }

  /**
   * Finalizes the stream when LLM transmission ends.
   */
  public end(): DiffHunk[] {
    if (this.state === 'COMPLETE') {
      return this.completedHunks;
    }

    // Flush any remaining active hunk if closing marker was reached
    if (this.state === 'IN_REPLACE' && this.activeHunk) {
      const endMarker = '>>>>>>> REPLACE';
      const endIdx = this.buffer.indexOf(endMarker);
      if (endIdx !== -1) {
        this.activeHunk.replaceBlock += this.buffer.slice(0, endIdx);
      } else {
        this.activeHunk.replaceBlock += this.buffer;
      }
      this.activeHunk.status = 'pending';
      this.completedHunks.push(this.activeHunk);
      this.emit('hunk_complete', this.activeHunk);
      this.activeHunk = null;
    }

    this.buffer = '';
    this.state = 'COMPLETE';
    this.emit('stream_complete');

    return [...this.completedHunks];
  }

  /**
   * Resets parser state for reuse.
   */
  public reset(defaultFilePath: string = ''): void {
    this.state = 'OUTSIDE';
    this.buffer = '';
    this.currentFilePath = defaultFilePath;
    this.defaultFilePath = defaultFilePath;
    this.activeHunk = null;
    this.completedHunks = [];
    this.hunkCounter = 0;
  }
}

/**
 * Convenience helper to parse a full or partial diff stream into structured DiffHunks.
 */
export function parseDiffStream(streamText: string, defaultFilePath: string = ''): DiffHunk[] {
  const parser = new DiffStreamParser(defaultFilePath);
  parser.push(streamText);
  return parser.end();
}
