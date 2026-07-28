import { useState } from 'react';
import { ActionSheetIOS, Alert, Image, Platform, Pressable, View } from 'react-native';

import { addPhoto, deletePhoto, listPhotos, type PhotoRow } from '@/db/queries';
import { useQuery } from '@/db/useQuery';
import { Body, Button, Card, Caption, EmptyState, H3, Loading, Row, Screen } from '@/components/ui';
import { capturePhoto, deletePhotoFile, pickPhoto } from '@/lib/photos';
import { fromISODate, mondayOf, toISODate, weekLabel } from '@/lib/week';
import { spacing, useTheme } from '@/theme/theme';

export default function Photos() {
  const { colors } = useTheme();
  const { data } = useQuery(() => listPhotos(), []);
  const [busy, setBusy] = useState(false);

  const thisWeekISO = toISODate(mondayOf(new Date()));

  const add = async (source: 'camera' | 'library') => {
    setBusy(true);
    try {
      const uri = source === 'camera' ? await capturePhoto(thisWeekISO) : await pickPhoto(thisWeekISO);
      if (uri) await addPhoto(thisWeekISO, uri);
      else if (uri === null) {
        // permission denial vs cancel is indistinguishable here; keep quiet on cancel
      }
    } finally {
      setBusy(false);
    }
  };

  const promptAdd = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Take photo', 'Choose from library', 'Cancel'], cancelButtonIndex: 2 },
        (i) => {
          if (i === 0) add('camera');
          if (i === 1) add('library');
        }
      );
    } else {
      Alert.alert('Add progress photo', undefined, [
        { text: 'Take photo', onPress: () => add('camera') },
        { text: 'Choose from library', onPress: () => add('library') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const remove = (p: PhotoRow) =>
    Alert.alert('Delete photo?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          deletePhotoFile(p.uri);
          await deletePhoto(p.id);
        },
      },
    ]);

  if (!data) return <Loading />;

  const hasThisWeek = data.some((p) => p.weekStart === thisWeekISO);

  return (
    <Screen>
      <Button
        title={busy ? 'Adding…' : hasThisWeek ? '+ Add another this week' : '+ Add this week’s photo'}
        onPress={promptAdd}
        disabled={busy}
      />

      {data.length === 0 ? (
        <EmptyState
          emoji="📸"
          title="No photos yet"
          subtitle="Add a weekly progress photo to see your transformation over time."
        />
      ) : (
        data.map((p) => (
          <Card key={p.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <H3>{weekLabel(fromISODate(p.weekStart))}</H3>
                <Caption>{new Date(p.takenAt).toLocaleDateString()}</Caption>
              </View>
              <Pressable onPress={() => remove(p)} hitSlop={8}>
                <Body style={{ color: colors.danger }}>Delete</Body>
              </Pressable>
            </Row>
            <Image
              source={{ uri: p.uri }}
              style={{
                width: '100%',
                aspectRatio: 3 / 4,
                borderRadius: 12,
                backgroundColor: colors.cardAlt,
              }}
              resizeMode="cover"
            />
          </Card>
        ))
      )}
      <View style={{ height: spacing(4) }} />
    </Screen>
  );
}
