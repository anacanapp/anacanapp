import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import VoiceMessage from './VoiceMessage';

vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('shows a recoverable error instead of pretending a rejected play request is playing', async () => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new DOMException('Unsupported', 'NotSupportedError'));
  render(<VoiceMessage src="https://media.example.invalid/audio.mp4" />);
  fireEvent.click(screen.getByRole('button', { name: 'Səsi dinlə' }));
  await screen.findByRole('button', { name: 'Səsi yenidən yüklə' });
  expect(screen.getByRole('status')).toHaveTextContent('Səs açılmadı');
  expect(screen.queryByRole('button', { name: 'Səsi dayandır' })).not.toBeInTheDocument();
});

it('renews an expired media URL before a new user-gesture playback attempt', async () => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('Expired'));
  const renew = vi.fn().mockResolvedValue('https://media.example.invalid/fresh.mp4');
  const { container } = render(<VoiceMessage src="https://media.example.invalid/old.mp4" onRenew={renew} />);
  fireEvent.click(screen.getByRole('button', { name: 'Səsi dinlə' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Səsi yenidən yüklə' }));
  await waitFor(() => expect(container.querySelector('audio')).toHaveAttribute('src', 'https://media.example.invalid/fresh.mp4'));
  expect(renew).toHaveBeenCalledOnce();
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Səsi dinlə' }));
  await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2));
  expect(container.querySelector('audio')).toHaveAttribute('src', 'https://media.example.invalid/fresh.mp4');
});

it('reloads an identical renewed lease once without an automatic error loop', async () => {
  const url = 'https://media.example.invalid/same-lease.webm';
  const renew = vi.fn().mockResolvedValue(url);
  const { container } = render(<VoiceMessage src={url} onRenew={renew} />);
  fireEvent.error(container.querySelector('audio')!);
  await waitFor(() => expect(HTMLMediaElement.prototype.load).toHaveBeenCalledOnce());
  fireEvent.error(container.querySelector('audio')!);
  await screen.findByRole('button', { name: 'Səsi yenidən yüklə' });
  expect(renew).toHaveBeenCalledOnce();
});

it('uses media events for playback state and does not create an invalid seek range for unknown duration', async () => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  const { container } = render(<VoiceMessage src="https://media.example.invalid/audio.webm" />);
  const audio = container.querySelector('audio')!;
  Object.defineProperty(audio, 'duration', { configurable: true, value: Infinity });
  fireEvent.loadedMetadata(audio);
  expect(screen.getByRole('slider')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Səsi dinlə' }));
  fireEvent.play(audio);
  await screen.findByRole('button', { name: 'Səsi dayandır' });
  fireEvent.ended(audio);
  expect(screen.getByRole('button', { name: 'Səsi dinlə' })).toBeInTheDocument();
});
