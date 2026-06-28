import { useState, useCallback } from 'react';
import { APP_VERSION, USE_CHANGELOG_NOTIFICATIONS, CHANGELOG_NOTIFICATION_MIN_IMPORTANCE } from '../core/config';
import { CHANGELOG } from '../core/changelog';
import { compareSemver } from '../utils/semver';

const STORAGE_KEY = 'sketch2mermaid:lastSeenVersion';

const IMPORTANCE_LEVELS = {
  minor: 1,
  normal: 2,
  major: 3,
};

function getLocalStorageValue(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn('localStorage is not accessible:', e);
    return null;
  }
}

function setLocalStorageValue(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn('Failed to write to localStorage:', e);
  }
}

export function useChangelogNotification() {
  const [lastSeenVersion, setLastSeenVersion] = useState<string | null>(() => {
    return getLocalStorageValue(STORAGE_KEY);
  });

  const markChangelogSeen = useCallback(() => {
    setLocalStorageValue(STORAGE_KEY, APP_VERSION);
    setLastSeenVersion(APP_VERSION);
  }, []);

  if (!USE_CHANGELOG_NOTIFICATIONS) {
    return {
      hasUnseen: false,
      unseenEntries: [],
      markChangelogSeen,
    };
  }

  // If lastSeenVersion is absent (null), it's a first visit:
  // - No automatic notification
  // - No automatic write on load
  if (lastSeenVersion === null) {
    return {
      hasUnseen: false,
      unseenEntries: [],
      markChangelogSeen,
    };
  }

  // Filter all entries newer than lastSeenVersion
  const unseenEntries = CHANGELOG.filter((entry) => {
    return compareSemver(entry.version, lastSeenVersion) > 0;
  });

  // Determine if we should trigger the notification toast:
  // Trigger if at least one unseen entry meets the minimum importance threshold.
  const hasUnseen = unseenEntries.some((entry) => {
    const entryImportance = IMPORTANCE_LEVELS[entry.importance] || 2;
    const minImportance = IMPORTANCE_LEVELS[CHANGELOG_NOTIFICATION_MIN_IMPORTANCE] || 2;
    return entryImportance >= minImportance;
  });

  return {
    hasUnseen,
    unseenEntries,
    markChangelogSeen,
  };
}
