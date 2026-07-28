import { useEffect, useRef, useState } from 'react';
import { AppState, Image, Pressable, Text, View } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import Svg, { Circle } from 'react-native-svg';

import { toggleMobility, updateMobilityItem, type SessionMobilityRow } from '@/db/queries';
import { Button, Caption } from '@/components/ui';
import { CuesField } from '@/components/CuesField';
import { mmss } from '@/lib/format';
import { font, radius, spacing, useTheme } from '@/theme/theme';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const CHIME = require('../../assets/rest-complete.wav');

/**
 * Guided, one-movement-at-a-time warm-up. Shows a single movement with its
 * target; timed holds get a big countdown ring that flashes + chimes on
 * completion but waits for the user to tap "Done". "Done" checks the movement
 * and advances; the last movement starts training via onDone().
 */
export function WarmupGuide({
  warmup,
  sessionId,
  onDone,
}: {
  warmup: SessionMobilityRow[];
  sessionId: number;
  onDone: () => void;
}) {
  const { colors } = useTheme();
  const [index, setIndex] = useState(() => {
    const first = warmup.findIndex((w) => !w.checked);
    return first === -1 ? 0 : first;
  });

  const safeIndex = Math.min(index, warmup.length - 1);
  const current = warmup[safeIndex];
  const isLast = safeIndex === warmup.length - 1;

  const advance = () => {
    if (!current.checked) toggleMobility(sessionId, current.mobilityItemId, true);
    if (isLast) onDone();
    else setIndex(safeIndex + 1);
  };

  return (
    <View style={{ gap: spacing(4) }}>
      {/* header */}
      <Row style={{ justifyContent: 'space-between' }}>
        <Caption>
          Warm-up · {safeIndex + 1} of {warmup.length}
        </Caption>
        <Pressable onPress={onDone} hitSlop={8}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>Skip ›</Text>
        </Pressable>
      </Row>

      {/* progress dots */}
      <Row style={{ gap: 5 }}>
        {warmup.map((w, i) => (
          <Pressable
            key={w.mobilityItemId}
            onPress={() => setIndex(i)}
            hitSlop={6}
            style={{ flex: 1 }}
          >
            <View
              style={{
                height: 4,
                borderRadius: 2,
                backgroundColor:
                  i === safeIndex ? colors.primary : w.checked ? colors.success : colors.border,
              }}
            />
          </Pressable>
        ))}
      </Row>

      {/* current movement */}
      <View style={{ gap: spacing(3) }}>
        {current.imageUri ? (
          <Image
            source={{ uri: current.imageUri }}
            style={{ width: '100%', height: 170, borderRadius: radius.lg, backgroundColor: colors.cardAlt }}
            resizeMode="cover"
          />
        ) : null}
        <View style={{ alignItems: 'center', gap: spacing(1.5) }}>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center' }}>
            {current.name}
          </Text>
          {current.bodyPart ? (
            <View
              style={{
                backgroundColor: colors.accent + '22',
                borderRadius: radius.pill,
                paddingVertical: 4,
                paddingHorizontal: spacing(3),
              }}
            >
              <Text
                style={{
                  color: colors.accent,
                  fontSize: font.tiny,
                  fontWeight: '700',
                  letterSpacing: 0.5,
                }}
              >
                {current.bodyPart.toUpperCase()}
              </Text>
            </View>
          ) : null}
          {current.targetReps ? (
            <Caption style={{ fontSize: 15 }}>{current.targetReps}</Caption>
          ) : null}
        </View>

        <CuesField
          value={current.cues}
          onCommit={(v) => updateMobilityItem(current.mobilityItemId, { cues: v })}
        />

        {current.holdSeconds ? (
          <View style={{ alignItems: 'center' }}>
            <HoldRing key={current.mobilityItemId} seconds={current.holdSeconds} />
          </View>
        ) : null}
      </View>

      <Button title={isLast ? '✓ Done — start training ›' : '✓ Done — next'} onPress={advance} />
    </View>
  );
}

function Row({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing(2) }, style]}>
      {children}
    </View>
  );
}

const RING = 150;
const STROKE = 12;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

function HoldRing({ seconds }: { seconds: number }) {
  const { colors } = useTheme();
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const endsAt = useRef<number | null>(null);
  const player = useAudioPlayer(CHIME);

  const finish = () => {
    setDone(true);
    try {
      player.seekTo(0);
      player.play();
    } catch {
      // ignore playback errors
    }
  };

  const recompute = () => {
    if (endsAt.current == null) return;
    const r = Math.max(0, Math.ceil((endsAt.current - Date.now()) / 1000));
    setRemaining(r);
    if (r <= 0) {
      endsAt.current = null;
      setRunning(false);
      finish();
    }
  };

  // Reset if the movement (and thus its hold length) changes.
  useEffect(() => {
    setRemaining(seconds);
    setRunning(false);
    setDone(false);
    endsAt.current = null;
  }, [seconds]);

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

  const pct = seconds > 0 ? remaining / seconds : 0;
  const ringColor = done ? colors.success : colors.primary;

  const onPress = () => {
    if (done) {
      setDone(false);
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
  };

  const hint = done
    ? 'Hold complete ✓'
    : running
      ? 'Tap to pause'
      : remaining < seconds
        ? 'Tap to resume'
        : 'Tap to start hold';

  return (
    <Pressable onPress={onPress} style={{ alignItems: 'center', gap: spacing(1.5) }}>
      <View style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={RING} height={RING} style={{ position: 'absolute' }}>
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={R}
            stroke={colors.cardAlt}
            strokeWidth={STROKE}
            fill="none"
          />
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={R}
            stroke={ringColor}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - pct)}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        </Svg>
        <Text style={{ fontSize: 34, fontWeight: '800', color: colors.text }}>
          {mmss(remaining)}
        </Text>
      </View>
      <Caption style={{ color: done ? colors.success : colors.textMuted }}>{hint}</Caption>
    </Pressable>
  );
}
