import { Image, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';

import { baseAsset, hasFrontArt, overlayAsset } from '@/assets/body';
import { PARTS, type PartKey, type PartLevel } from '@/lib/physique';

type Levels = Record<PartKey, PartLevel>;

const VB_W = 160;
const VB_H = 300;

// Body palette — a person reads better in skin/hair tones than theme grays.
const SKIN = '#E8B48C';
const SHADE = '#C98F63';
const HAIR = '#3A2A20';
const SHORT = '#1B2130';

/**
 * The weekly "body overview" figure. Each body part grows with its level (0..3).
 * Uses layered PNG art when present (see src/assets/body), otherwise draws a
 * react-native-svg figure so the screen works before any art is produced.
 */
export function BodyAvatar({ levels, size = 216 }: { levels: Levels; size?: number }) {
  const width = Math.round((size * VB_W) / VB_H);

  if (hasFrontArt()) {
    return <LayeredBody levels={levels} width={width} height={size} />;
  }
  return <DrawnBody levels={levels} width={width} height={size} />;
}

function LayeredBody({ levels, width, height }: { levels: Levels; width: number; height: number }) {
  const fill = { position: 'absolute' as const, top: 0, left: 0, width, height };
  return (
    <View style={{ width, height }}>
      <Image source={baseAsset()!} style={fill} resizeMode="contain" />
      {PARTS.map((p) => {
        const asset = overlayAsset(p.key, levels[p.key]);
        return asset ? <Image key={p.key} source={asset} style={fill} resizeMode="contain" /> : null;
      })}
    </View>
  );
}

function DrawnBody({ levels, width, height }: { levels: Levels; width: number; height: number }) {
  const g = (k: PartKey) => (levels[k] ?? 0) / 3; // 0..1 growth factor
  const legsTrained = (levels.legs ?? 0) > 0;

  const gLegs = g('legs');
  const gBack = g('back');
  const gShoulders = g('shoulders');
  const gArms = g('arms');
  const gChest = g('chest');
  const gAbs = g('abs');
  const gNeck = g('neck');

  const tw = 20 + 8 * gLegs; // thigh width

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
      {/* lats — widen the torso silhouette with back development */}
      <Ellipse cx={58} cy={150} rx={4 + 9 * gBack} ry={26} fill={SKIN} />
      <Ellipse cx={102} cy={150} rx={4 + 9 * gBack} ry={26} fill={SKIN} />

      {/* thighs (dashed outline until trained) */}
      {legsTrained ? (
        <G fill={SKIN}>
          <Rect x={70 - tw / 2} y={190} width={tw} height={100} rx={tw / 2} />
          <Rect x={92 - tw / 2} y={190} width={tw} height={100} rx={tw / 2} />
        </G>
      ) : (
        <G fill="none" stroke={SHADE} strokeWidth={2} strokeDasharray="5 5">
          <Rect x={70 - 10} y={190} width={20} height={100} rx={10} />
          <Rect x={92 - 10} y={190} width={20} height={100} rx={10} />
        </G>
      )}

      {/* shorts */}
      <Rect x={52} y={184} width={56} height={40} rx={10} fill={SHORT} />

      {/* neck */}
      <Rect x={80 - (7 + 4 * gNeck)} y={70} width={14 + 8 * gNeck} height={30} rx={5} fill={SKIN} />

      {/* torso */}
      <Path d="M50,96 L110,96 L102,190 L58,190 Z" fill={SKIN} />

      {/* traps — the slope from neck to shoulders rises with development */}
      <Path d={`M54,100 Q80,${96 - 18 * gNeck} 106,100 Z`} fill={SKIN} />
      {gNeck > 0 ? (
        <Line
          x1={80}
          y1={78}
          x2={80}
          y2={96}
          stroke={SHADE}
          strokeWidth={1.4}
          opacity={0.3 + 0.5 * gNeck}
        />
      ) : null}

      {/* shoulders / delts */}
      <Ellipse cx={50} cy={100} rx={8 + 10 * gShoulders} ry={7 + 7 * gShoulders} fill={SKIN} />
      <Ellipse cx={110} cy={100} rx={8 + 10 * gShoulders} ry={7 + 7 * gShoulders} fill={SKIN} />

      {/* upper arms + biceps */}
      <Rect x={38} y={100} width={16} height={92} rx={8} fill={SKIN} />
      <Rect x={106} y={100} width={16} height={92} rx={8} fill={SKIN} />
      <Ellipse cx={46} cy={122} rx={6 + 8 * gArms} ry={12 + 6 * gArms} fill={SKIN} />
      <Ellipse cx={114} cy={122} rx={6 + 8 * gArms} ry={12 + 6 * gArms} fill={SKIN} />

      {/* pecs (chest) */}
      <Ellipse cx={72} cy={118} rx={6 + 10 * gChest} ry={6 + 7 * gChest} fill={SKIN} />
      <Ellipse cx={88} cy={118} rx={6 + 10 * gChest} ry={6 + 7 * gChest} fill={SKIN} />
      {gChest > 0 ? (
        <Line x1={80} y1={112} x2={80} y2={128} stroke={SHADE} strokeWidth={1.4} opacity={0.5 * gChest + 0.2} />
      ) : null}

      {/* abs — definition fades in with development */}
      {gAbs > 0 ? (
        <G stroke={SHADE} strokeWidth={1.6} opacity={0.3 + 0.6 * gAbs}>
          <Line x1={80} y1={134} x2={80} y2={178} />
          <Line x1={70} y1={144} x2={90} y2={144} />
          <Line x1={70} y1={156} x2={90} y2={156} />
          <Line x1={70} y1={168} x2={90} y2={168} />
        </G>
      ) : null}

      {/* head */}
      <Circle cx={80} cy={52} r={26} fill={SKIN} />
      <Path d="M56,46 Q80,18 104,46 Q96,34 80,34 Q64,34 56,46 Z" fill={HAIR} />
      <Circle cx={72} cy={50} r={3.2} fill="#2C2C2A" />
      <Circle cx={88} cy={50} r={3.2} fill="#2C2C2A" />
      <Path d="M70,60 Q80,70 90,60" stroke="#2C2C2A" strokeWidth={2.6} fill="none" strokeLinecap="round" />
    </Svg>
  );
}
