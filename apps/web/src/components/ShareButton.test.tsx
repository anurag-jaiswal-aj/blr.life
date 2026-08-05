import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { ShareButton } from './ShareButton';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('ShareButton', () => {
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const mockClipboard = { writeText: vi.fn() };
    Object.defineProperty(navigator, 'clipboard', {
      value: mockClipboard,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
      writable: true,
    });
  });

  it('handles successful clipboard operation', async () => {
    vi.mocked(navigator.clipboard.writeText).mockResolvedValueOnce(undefined);
    
    render(<ShareButton />);
    
    const button = screen.getByRole('button', { name: /share results/i });
    expect(button).toHaveTextContent('Share');
    
    fireEvent.click(button);
    
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(window.location.href);
    
    await waitFor(() => {
      expect(button).toHaveTextContent('Copied');
    });
    
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    
    expect(button).toHaveTextContent('Share');
  });

  it('handles failed clipboard operation', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('Not allowed'));
    
    render(<ShareButton />);
    
    const button = screen.getByRole('button', { name: /share results/i });
    
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(button).toHaveTextContent('Copy failed');
    });
    expect(button).not.toHaveTextContent('Copied');
    
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    
    expect(button).toHaveTextContent('Share');
  });

  it('handles fallback when clipboard API is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    
    render(<ShareButton />);
    
    const button = screen.getByRole('button', { name: /share results/i });
    
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(button).toHaveTextContent('Copy failed');
    });
  });

  it('allows recovery from failure to success', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('Denied'));
    vi.mocked(navigator.clipboard.writeText).mockResolvedValueOnce(undefined);
    
    render(<ShareButton />);
    
    const button = screen.getByRole('button', { name: /share results/i });
    
    fireEvent.click(button);
    await waitFor(() => {
      expect(button).toHaveTextContent('Copy failed');
    });
    
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(button).toHaveTextContent('Share');
    
    fireEvent.click(button);
    await waitFor(() => {
      expect(button).toHaveTextContent('Copied');
    });
  });
});
