/**
 * Browser utility for triggering file downloads.
 * Separated from core logic to keep s2mFile.ts pure and testable.
 */

/**
 * Triggers a browser download for the given content string.
 * Creates a temporary Blob URL, clicks a hidden anchor, and cleans up.
 */
export function downloadTextFile(content: string, filename: string, mimeType = 'application/json'): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  // Cleanup after a tick to allow the download to start
  requestAnimationFrame(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  });
}
