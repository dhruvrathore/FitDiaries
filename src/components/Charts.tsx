import { useState } from 'react';
import { LayoutChangeEvent, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { compactNumber } from '@/lib/format';
import { font, radius, spacing, useTheme } from '@/theme/theme';

function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(0);
  return [w, (e) => setW(e.nativeEvent.layout.width)];
}

/** Vertical bar chart — used for weekly volume. */
export function BarChart({
  data,
  height = 160,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  const { colors } = useTheme();
  const [width, onLayout] = useWidth();
  const max = Math.max(1, ...data.map((d) => d.value));
  const pad = 8;
  const gap = 8;
  const n = data.length || 1;
  const barW = width > 0 ? (width - pad * 2 - gap * (n - 1)) / n : 0;

  return (
    <View onLayout={onLayout}>
      <Svg width="100%" height={height}>
        {width > 0 &&
          data.map((d, i) => {
            const h = (d.value / max) * (height - 28);
            const x = pad + i * (barW + gap);
            const y = height - 20 - h;
            return (
              <Rect
                key={i}
                x={x}
                y={y}
                width={barW}
                height={Math.max(2, h)}
                rx={4}
                fill={i === data.length - 1 ? colors.primary : colors.primary + '66'}
              />
            );
          })}
      </Svg>
      <View style={{ flexDirection: 'row', paddingHorizontal: pad }}>
        {data.map((d, i) => (
          <Text
            key={i}
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: font.tiny,
              color: colors.textFaint,
            }}
            numberOfLines={1}
          >
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Horizontal bars — used for volume by muscle. */
export function HBars({ data }: { data: { label: string; value: number }[] }) {
  const { colors } = useTheme();
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={{ gap: spacing(2) }}>
      {data.map((d) => (
        <View key={d.label} style={{ gap: 3 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.text, fontSize: font.small, fontWeight: '600' }}>
              {d.label}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: font.small }}>
              {compactNumber(d.value)}
            </Text>
          </View>
          <View
            style={{
              height: 10,
              borderRadius: radius.sm,
              backgroundColor: colors.cardAlt,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${(d.value / max) * 100}%`,
                height: '100%',
                backgroundColor: colors.accent,
                borderRadius: radius.sm,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Line chart — used for per-exercise progression. */
export function LineChart({
  values,
  height = 160,
  color,
}: {
  values: number[];
  height?: number;
  color?: string;
}) {
  const { colors } = useTheme();
  const [width, onLayout] = useWidth();
  const stroke = color ?? colors.primary;
  const pad = 10;

  let path = '';
  let points: { x: number; y: number }[] = [];
  if (width > 0 && values.length > 0) {
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;
    const stepX = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
    points = values.map((v, i) => {
      const x = pad + i * stepX;
      const y = pad + (1 - (v - min) / range) * (height - pad * 2);
      return { x, y };
    });
    path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  }

  return (
    <View onLayout={onLayout}>
      <Svg width="100%" height={height}>
        {width > 0 && (
          <>
            <Line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke={colors.border} strokeWidth={1} />
            {path ? <Path d={path} stroke={stroke} strokeWidth={2.5} fill="none" /> : null}
            {points.map((p, i) => (
              <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill={stroke} />
            ))}
          </>
        )}
      </Svg>
    </View>
  );
}
