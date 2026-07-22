'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from 'lucide-react';

import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;
type AudioLoadState = 'loading' | 'ready' | 'buffering';

function formatAudioTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

function audioErrorMessage(code: number | undefined): string {
  if (code === 2) return 'The browser could not reach the recording URL.';
  if (code === 3) return 'The recording file could not be decoded by the browser.';
  if (code === 4) return 'The recording URL is unavailable, expired, or in an unsupported format.';
  return 'The recording could not be loaded.';
}

export function validRecordingUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/')) return trimmed;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:' ? trimmed : null;
  } catch {
    return null;
  }
}

export function RecordingPlayer({
  recordingUrl,
  label = 'Recording',
  onPlay,
  className,
}: {
  recordingUrl: string;
  label?: string;
  onPlay?: () => void;
  className?: string;
}): React.JSX.Element {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loadState, setLoadState] = useState<AudioLoadState>('loading');
  const [pendingPlay, setPendingPlay] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState('1');
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setError(null);
    setPlaying(false);
    setLoadState('loading');
    setPendingPlay(false);
    setDuration(0);
    setCurrentTime(0);
    setPlaybackRate('1');
    setVolume(1);
    setMuted(false);
  }, [recordingUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = Number(playbackRate);
  }, [playbackRate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = muted;
  }, [volume, muted]);

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      return;
    }

    if (loadState === 'loading') {
      setPendingPlay(true);
      audio.load();
      return;
    }

    setPendingPlay(true);
    void audio.play().catch(() => {
      setPendingPlay(false);
      setError('The recording could not be played by this browser.');
    });
  };

  const seek = (nextTime: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(nextTime)) return;
    const clamped = Math.min(Math.max(nextTime, 0), duration || nextTime);
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  };

  const skip = (deltaSeconds: number) => {
    seek(currentTime + deltaSeconds);
  };

  if (error) {
    return (
      <div className={cn('rounded-md border border-destructive/30 bg-destructive/10 p-3', className)}>
        <p className="text-sm font-medium text-foreground">Recording cannot be played</p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  const speedOptions = PLAYBACK_SPEEDS.map((speed) => ({
    value: String(speed),
    label: speed === 1 ? '1×' : `${speed}×`,
  }));

  const isPreparing = loadState === 'loading' || pendingPlay;
  const controlsDisabled = loadState === 'loading';
  const statusLabel = loadState === 'loading'
    ? 'Loading recording...'
    : pendingPlay
      ? 'Preparing audio...'
      : loadState === 'buffering'
        ? 'Buffering...'
        : null;

  return (
    <div className={cn('flex flex-col gap-3 rounded-md border border-border bg-card p-3', className)}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlayback}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={isPreparing ? `Preparing ${label}` : `${playing ? 'Pause' : 'Play'} ${label}`}
          aria-busy={isPreparing}
        >
          {isPreparing ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" aria-hidden="true" />
          ) : playing ? (
            <Pause className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Play className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(currentTime, duration || currentTime)}
            onChange={(event) => seek(Number(event.target.value))}
            disabled={controlsDisabled || duration <= 0}
            aria-label={`Seek ${label}`}
            className="h-1.5 w-full cursor-pointer accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
          />
          <div className="flex items-center justify-between gap-2 text-xs tabular-nums text-muted-foreground">
            <span>{formatAudioTime(currentTime)}</span>
            <span>{statusLabel ?? (duration > 0 ? formatAudioTime(duration) : '--:--')}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => skip(-10)}
          disabled={controlsDisabled}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`Rewind ${label} 10 seconds`}
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          10s
        </button>
        <button
          type="button"
          onClick={() => skip(10)}
          disabled={controlsDisabled}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`Forward ${label} 10 seconds`}
        >
          <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
          10s
        </button>

        <Select
          value={playbackRate}
          onValueChange={setPlaybackRate}
          options={speedOptions}
          aria-label="Playback speed"
          className="h-8 min-w-[5.5rem] text-xs"
          disabled={controlsDisabled}
        />

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMuted((value) => !value)}
            disabled={controlsDisabled}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={muted ? 'Unmute recording' : 'Mute recording'}
          >
            {muted || volume === 0 ? (
              <VolumeX className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Volume2 className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(event) => {
              const next = Number(event.target.value);
              setVolume(next);
              if (next > 0) setMuted(false);
            }}
            disabled={controlsDisabled}
            aria-label="Recording volume"
            className="h-1.5 w-24 cursor-pointer accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </div>

      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        preload="auto"
        src={recordingUrl}
        onLoadStart={() => setLoadState('loading')}
        onLoadedMetadata={(event) => {
          const nextDuration = event.currentTarget.duration;
          setDuration(Number.isFinite(nextDuration) ? nextDuration : 0);
          setLoadState('ready');
        }}
        onCanPlay={(event) => {
          setLoadState('ready');
          if (pendingPlay) {
            void event.currentTarget.play().catch(() => {
              setPendingPlay(false);
              setError('The recording could not be played by this browser.');
            });
          }
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => {
          setPendingPlay(true);
        }}
        onPlaying={() => {
          setLoadState('ready');
          setPendingPlay(false);
          setPlaying(true);
          onPlay?.();
        }}
        onWaiting={() => {
          if (playing || pendingPlay) setLoadState('buffering');
        }}
        onPause={() => {
          setPendingPlay(false);
          setPlaying(false);
        }}
        onEnded={() => {
          setPendingPlay(false);
          setPlaying(false);
        }}
        onError={(event) => {
          setPlaying(false);
          setPendingPlay(false);
          setError(audioErrorMessage(event.currentTarget.error?.code));
        }}
        className="hidden"
      />
    </div>
  );
}
