// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ChangelogToast } from './ChangelogToast';
import { ChangelogModal } from './ChangelogModal';
import { CHANGELOG } from '../core/changelog';

describe('Changelog UI Components', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  describe('ChangelogToast', () => {
    it('renders correct messages and buttons', () => {
      const onOpenChangelog = vi.fn();
      const onDismiss = vi.fn();

      act(() => {
        root.render(
          <ChangelogToast
            onOpenChangelog={onOpenChangelog}
            onDismiss={onDismiss}
          />
        );
      });

      expect(container.textContent).toContain('Sketch2Mermaid has been updated');
      expect(container.textContent).toContain("What's New");
      expect(container.textContent).toContain('Dismiss');

      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBe(2);

      // Click What's New
      act(() => {
        buttons[1].click();
      });
      expect(onOpenChangelog).toHaveBeenCalledTimes(1);

      // Click Dismiss
      act(() => {
        buttons[0].click();
      });
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('ChangelogModal', () => {
    it('renders only unseen entries in auto mode', () => {
      const onClose = vi.fn();
      const unseenEntries = [CHANGELOG[0]]; // Only 0.8.0

      act(() => {
        root.render(
          <ChangelogModal
            mode="auto"
            unseenEntries={unseenEntries}
            onClose={onClose}
          />
        );
      });

      expect(container.textContent).toContain("What's New in Sketch2Mermaid");
      expect(container.textContent).toContain('v0.9.0');
      // Should NOT contain v0.8.0 in auto mode with only v0.9.0 unseen
      expect(container.textContent).not.toContain('v0.8.0');

      const closeButton = container.querySelector('.modal-btn--confirm');
      expect(closeButton).not.toBeNull();
      act(() => {
        (closeButton as HTMLButtonElement).click();
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('renders all entries in manual mode', () => {
      const onClose = vi.fn();

      act(() => {
        root.render(
          <ChangelogModal
            mode="manual"
            unseenEntries={[]}
            onClose={onClose}
          />
        );
      });

      expect(container.textContent).toContain('Release Changelog');
      expect(container.textContent).toContain('v0.8.0');
      expect(container.textContent).toContain('v0.7.0');
      expect(container.textContent).toContain('v0.6.0');
      expect(container.textContent).toContain('v0.5.0');
    });

    it('handles Escape key to close', () => {
      const onClose = vi.fn();

      act(() => {
        root.render(
          <ChangelogModal
            mode="manual"
            unseenEntries={[]}
            onClose={onClose}
          />
        );
      });

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
