import { useEffect } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import Svg, { Circle } from 'react-native-svg';

import { useRestStore } from '@/store/rest';
import {
  cancelRestDoneNotification,
  scheduleRestDoneNotification,
} from '@/lib/notifications';
import { mmss } from '@/lib/format';
import { font, radius, spacing, useTheme } from '@/theme/theme';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const REST_SOUND = require('../../assets/rest-complete.wav');

const RING = 200; // ring diameter
const STROKE = 14;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

/**
 * Full-screen rest-timer takeover. Rendered once on the active-session screen;
 * covers the screen the moment a set is logged so the countdown can't be missed.
 * Plays a sound on completion.
 */
export function RestOverlay() {
  const { colors } = useTheme();
  const {
    active,
    paused,
    remaining,
    total,
    label,
    endsAt,
    justCompleted,
    togglePause,
    extend,
    skip,
    sync,
    clearCompleted,
  } = useRestStore();
  const player = useAudioPlayer(REST_SOUND);

  // Recompute from the wall clock every second while running.
  useEffect(() => {
    if (!active || paused) return;
    sync();
    const id = setInterval(() => sync(), 1000);
    return () => clearInterval(id);
  }, [active, paused, sync]);

  // Resync the moment the app returns to the foreground (interval is frozen while backgrounded).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') sync();
    });
    return () => sub.remove();
  }, [sync]);

  // Schedule (or cancel) the background "rest over" notification as the timer changes.
  useEffect(() => {
    if (active && !paused && endsAt != null) {
      scheduleRestDoneNotification(endsAt, label);
    } else {
      cancelRestDoneNotification();
    }
  }, [active, paused, endsAt, label]);

  // On foreground completion, play the chime and cancel the notification (avoid a double alert).
  useEffect(() => {
    if (justCompleted) {
      cancelRestDoneNotification();
      const soundOn = useRestStore.getState().soundEnabled;
      if (soundOn) {
        try {
          player.seekTo(0);
          player.play();
        } catch {
          // ignore playback errors
        }
      }
      clearCompleted();
    }
  }, [justCompleted, player, clearCompleted]);

  if (!active) return null;

  const pct = total > 0 ? remaining / total : 0;

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing(6),
        gap: spacing(3),
        zIndex: 100,
        elevation: 100,
      }}
    >
      <Text
        style={{
          fontSize: font.small,
          letterSpacing: 2,
          color: colors.textMuted,
          fontWeight: '700',
        }}
      >
        REST
      </Text>

      <View style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={RING} height={RING} style={{ position: 'absolute' }}>
          <Circle cx={RING / 2} cy={RING / 2} r={R} stroke={colors.cardAlt} strokeWidth={STROKE} fill="none" />
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={R}
            stroke={colors.primary}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - pct)}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        </Svg>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 52, fontWeight: '800', color: colors.text }}>
            {mmss(remaining)}
          </Text>
          <Text style={{ fontSize: font.small, color: colors.textMuted }}>of {mmss(total)}</Text>
        </View>
      </View>

      {label ? (
        <Text style={{ fontSize: font.small, color: colors.textMuted }}>Up next · {label}</Text>
      ) : null}

      <View style={{ flexDirection: 'row', gap: spacing(2), marginTop: spacing(2) }}>
        <Pill label="+30s" onPress={() => extend(30)} />
        <Pill label="+60s" onPress={() => extend(60)} />
        <Pill label={paused ? 'Resume' : 'Pause'} onPress={togglePause} />
      </View>

      <Pressable onPress={skip} hitSlop={8} style={{ marginTop: spacing(2), padding: spacing(2) }}>
        <Text style={{ color: colors.primary, fontWeight: '700', fontSize: font.body }}>
          Skip rest
        </Text>
      </Pressable>
    </View>
  );
}

function Pill({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: spacing(2.5),
        paddingHorizontal: spacing(4),
        borderRadius: radius.pill,
        backgroundColor: colors.cardAlt,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.small }}>{label}</Text>
    </Pressable>
  );
}
