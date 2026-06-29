// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { useChangelogNotification } from './useChangelogNotification';
import { CHANGELOG } from '../core/changelog';
import type { ChangelogEntry } from '../core/changelog';

// Mock config variables dynamically
let mockUseChangelogNotifications = true;
let mockChangelogMinImportance = 'normal';
let mockAppVersion = CHANGELOG[0].version;

vi.mock('../core/config', () => {
  return {
    get USE_CHANGELOG_NOTIFICATIONS() {
      return mockUseChangelogNotifications;
    },
    get CHANGELOG_NOTIFICATION_MIN_IMPORTANCE() {
      return mockChangelogMinImportance;
    },
    get APP_VERSION() {
      return mockAppVersion;
    },
  };
});

describe('useChangelogNotification hook', () => {
  let container: HTMLDivElement;
  let root: Root;
  let hookResult: ReturnType<typeof useChangelogNotification> | null = null;

  const TestComponent = () => {
    hookResult = useChangelogNotification();
    return null;
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    localStorage.clear();
    // Reset mocks
    mockUseChangelogNotifications = true;
    mockChangelogMinImportance = 'normal';
    mockAppVersion = CHANGELOG[0].version;
    hookResult = null;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it('does not show notification or have unseen entries on first visit (localStorage empty)', () => {
    act(() => {
      root.render(<TestComponent />);
    });
    expect(hookResult.hasUnseen).toBe(false);
    expect(hookResult.unseenEntries).toEqual([]);
    expect(localStorage.getItem('sketch2mermaid:lastSeenVersion')).toBeNull();
  });

  it('shows notification when returning user has an older lastSeenVersion', () => {
    localStorage.setItem('sketch2mermaid:lastSeenVersion', CHANGELOG[1].version);
    mockChangelogMinImportance = CHANGELOG[0].importance; // Align min importance with latest release
    act(() => {
      root.render(<TestComponent />);
    });
    expect(hookResult.hasUnseen).toBe(true);
    expect(hookResult.unseenEntries.length).toBeGreaterThan(0);
    expect(hookResult.unseenEntries[0].version).toBe(CHANGELOG[0].version);
  });

  it('verifies the multi-version missed-update scenario where user jumps from 0.5.0 to latest', () => {
    localStorage.setItem('sketch2mermaid:lastSeenVersion', '0.5.0');
    act(() => {
      root.render(<TestComponent />);
    });
    // Automatic changelog toast triggers
    expect(hookResult.hasUnseen).toBe(true);
    
    // Displays all entries newer than 0.5.0, but does not display 0.5.0
    const versions = hookResult.unseenEntries.map((e: ChangelogEntry) => e.version);
    expect(versions).toContain(CHANGELOG[0].version);
    expect(versions).toContain(CHANGELOG[1].version);
    expect(versions).toContain('0.7.0');
    expect(versions).toContain('0.6.0');
    expect(versions).not.toContain('0.5.0');
    
    // Sort order should be descending
    expect(versions[0]).toBe(CHANGELOG[0].version);
    expect(versions[1]).toBe(CHANGELOG[1].version);
    expect(versions[2]).toBe(CHANGELOG[2].version);
    expect(versions[3]).toBe(CHANGELOG[3].version);
  });

  it('triggers toast only if an entry matches min importance, but displays all unseen entries regardless of importance', () => {
    localStorage.setItem('sketch2mermaid:lastSeenVersion', CHANGELOG[1].version);
    
    // Set min importance to 'normal', but temporarily make latest 'minor'
    mockChangelogMinImportance = 'normal';
    
    const originalImportance = CHANGELOG[0].importance;
    CHANGELOG[0].importance = 'minor';
    
    try {
      act(() => {
        root.render(<TestComponent />);
      });
      // Toast should not trigger because the only new version is minor, which is below normal
      expect(hookResult.hasUnseen).toBe(false);
      // But it is still listed in unseenEntries
      expect(hookResult.unseenEntries.map((e: ChangelogEntry) => e.version)).toContain(CHANGELOG[0].version);
    } finally {
      CHANGELOG[0].importance = originalImportance;
    }
  });

  it('does not show notification when USE_CHANGELOG_NOTIFICATIONS is false', () => {
    mockUseChangelogNotifications = false;
    localStorage.setItem('sketch2mermaid:lastSeenVersion', '0.7.0');
    act(() => {
      root.render(<TestComponent />);
    });
    expect(hookResult.hasUnseen).toBe(false);
    expect(hookResult.unseenEntries).toEqual([]);
  });

  it('does not show notification when current version is already seen', () => {
    localStorage.setItem('sketch2mermaid:lastSeenVersion', CHANGELOG[0].version);
    act(() => {
      root.render(<TestComponent />);
    });
    expect(hookResult.hasUnseen).toBe(false);
    expect(hookResult.unseenEntries).toEqual([]);
  });

  it('marks changelog as seen when calling markChangelogSeen', () => {
    localStorage.setItem('sketch2mermaid:lastSeenVersion', CHANGELOG[1].version);
    mockChangelogMinImportance = CHANGELOG[0].importance; // Align min importance with latest release
    act(() => {
      root.render(<TestComponent />);
    });
    expect(hookResult.hasUnseen).toBe(true);

    act(() => {
      hookResult.markChangelogSeen();
    });

    expect(localStorage.getItem('sketch2mermaid:lastSeenVersion')).toBe(CHANGELOG[0].version);
    expect(hookResult.hasUnseen).toBe(false);
  });

  it('behaves defensively when localStorage throws errors', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Access denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Access denied');
    });

    act(() => {
      root.render(<TestComponent />);
    });

    expect(hookResult.hasUnseen).toBe(false);
    expect(hookResult.unseenEntries).toEqual([]);
    
    expect(() => {
      act(() => {
        hookResult.markChangelogSeen();
      });
    }).not.toThrow();
  });
});
