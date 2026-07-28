import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';

import { mmss } from '@/lib/format';
import { font, radius, spacing, useTheme } from '@/theme/theme';

/**
 * Inline countdown for a timed mobility hold (e.g. a 10s glute-bridge hold).
 * Time-based (anchored to an end timestamp) so it stays correct after the app
 * is backgrounded; resyncs on foreground. Tap to start/pause; fires onComplete
 * when it reaches zero.
 */
export function HoldTimer({
  seconds,
  onComplete,
}: {
  seconds: number;
  onComplete?: () => void;
}) {
  const { colors } = useTheme();
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);
  const endsAt = useRef<number | null>(null);
  const completed = useRef(false);

  const recompute = () => {
    if (endsAt.current == null) return;
    const r = Math.max(0, Math.ceil((endsAt.current - Date.now()) / 1000));
    setRemaining(r);
    if (r <= 0) {
      endsAt.current = null;
      setRunning(false);
      if (!completed.current) {
        completed.current = true;
        onComplete?.();
      }
    }
  };

  useEffect(() => {
    if (!running) return;
    const id = setInterval(recompute, 1000);
    return () => clearInterval(id);
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resync when returning to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && running) recompute();
    });
    return () => sub.remove();
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset if the hold length changes.
  useEffect(() => {
    setRemaining(seconds);
    setRunning(false);
    endsAt.current = null;
    completed.current = false;
  }, [seconds]);

  const done = remaining === 0;

  return (
    <Pressable
      onPress={() => {
        if (done) {
          completed.current = false;
          setRemaining(seconds);
          endsAt.current = Date.now() + seconds * 1000;
          setRunning(true);
        } else if (running) {
          if (endsAt.current != null) {
            setRemaining(Math.max(0, Math.ceil((endsAt.current - Date.now()) / 1000)));
          }
          endsAt.current = null;
          setRunning(false);
        } else {
          endsAt.current = Date.now() + remaining * 1000;
          setRunning(true);
        }
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing(1),
        paddingVertical: spacing(1),
        paddingHorizontal: spacing(2.5),
        borderRadius: radius.pill,
        backgroundColor: running ? colors.warning + '22' : colors.cardAlt,
        borderWidth: 1,
        borderColor: running ? colors.warning : colors.border,
      }}
    >
      <Text style={{ fontSize: font.small }}>{running ? '⏸' : done ? '↻' : '⏱'}</Text>
      <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.small }}>
        {mmss(remaining)}
      </Text>
    </Pressable>
  );
}

/** Tiny presentational timer used for the rest bar. */
export function TimerText({ seconds, color }: { seconds: number; color: string }) {
  return <Text style={{ color, fontWeight: '800', fontSize: 34 }}>{mmss(seconds)}</Text>;
}

export function Spacer({ size = 2 }: { size?: number }) {
  return <View style={{ height: spacing(size) }} />;
}
