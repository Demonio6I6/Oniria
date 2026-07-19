import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import AppIcon from '../components/AppIcon';
import { getDreamId, getDreamSummary, getDreamTimestamp } from '../domain/dreams';
import {
  deleteSavedDreamsByIds,
  getDreamCalendarData,
  loadSavedDreams,
} from '../services/dreamRepository';
import { colors, radii, screenPadding, spacing, typography } from '../theme/tokens';

const getDayKey = timestamp => new Date(timestamp).toISOString().split('T')[0];

const groupDreamsByDay = dreams => {
  const groups = [];

  dreams.forEach(dream => {
    const key = getDayKey(getDreamTimestamp(dream));
    const lastGroup = groups[groups.length - 1];

    if (lastGroup?.key === key) {
      lastGroup.dreams.push(dream);
    } else {
      groups.push({ key, date: new Date(getDreamTimestamp(dream)), dreams: [dream] });
    }
  });

  return groups;
};

export default function SuenosGuardados({ navigation }) {
  const [dreams, setDreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calendarMode, setCalendarMode] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedDreamIds, setSelectedDreamIds] = useState([]);
  const [markedDates, setMarkedDates] = useState({});
  const [dreamsByDate, setDreamsByDate] = useState({});
  const [dayDreamsModalVisible, setDayDreamsModalVisible] = useState(false);
  const [dreamsOfTheDay, setDreamsOfTheDay] = useState([]);
  const groupedDreams = useMemo(() => groupDreamsByDay(dreams), [dreams]);

  const setDreamState = nextDreams => {
    setDreams(nextDreams);
    const calendarData = getDreamCalendarData(nextDreams);
    setMarkedDates(
      Object.fromEntries(
        Object.entries(calendarData.markedDates).map(([date, value]) => [
          date,
          { ...value, dotColor: colors.primary },
        ])
      )
    );
    setDreamsByDate(calendarData.dreamsByDate);
  };

  const loadDreams = async () => {
    try {
      setDreamState(await loadSavedDreams());
    } catch (error) {
      console.error('Error al cargar los sueños guardados', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDreams();
    const unsubscribe = navigation.addListener('focus', loadDreams);
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    navigation.setParams({ selectionMode });
  }, [navigation, selectionMode]);

  useEffect(() => {
    const enableListener = DeviceEventEmitter.addListener(
      'enableSelectionMode',
      () => setSelectionMode(true)
    );
    const cancelListener = DeviceEventEmitter.addListener(
      'cancelSelectionMode',
      () => {
        setSelectionMode(false);
        setSelectedDreamIds([]);
      }
    );
    const confirmListener = DeviceEventEmitter.addListener(
      'confirmDeletion',
      () => {
        if (!selectedDreamIds.length) {
          Alert.alert('Selecciona al menos un sueño para borrarlo.');
          return;
        }

        Alert.alert(
          'Borrar registros',
          `Se ${selectedDreamIds.length === 1 ? 'borrará este sueño' : `borrarán ${selectedDreamIds.length} sueños`}. Esta acción no se puede deshacer.`,
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Borrar',
              style: 'destructive',
              onPress: async () => {
                try {
                  setDreamState(await deleteSavedDreamsByIds(selectedDreamIds));
                  setSelectionMode(false);
                  setSelectedDreamIds([]);
                } catch (error) {
                  console.error('Error al borrar sueños:', error);
                }
              },
            },
          ]
        );
      }
    );
    const calendarListener = DeviceEventEmitter.addListener(
      'toggleCalendarView',
      () => setCalendarMode(current => !current)
    );

    return () => {
      enableListener.remove();
      cancelListener.remove();
      confirmListener.remove();
      calendarListener.remove();
    };
  }, [selectedDreamIds]);

  const openDream = dream => {
    if (selectionMode) {
      const dreamId = getDreamId(dream);
      setSelectedDreamIds(current =>
        current.includes(dreamId)
          ? current.filter(id => id !== dreamId)
          : [...current, dreamId]
      );
      return;
    }

    navigation.navigate('DetalleSueno', { dreamId: getDreamId(dream) });
  };

  const handleDayPress = day => {
    const dayDreams = dreamsByDate[day.dateString];
    if (!dayDreams?.length) return;

    if (dayDreams.length === 1) {
      openDream(dayDreams[0]);
      return;
    }

    setDreamsOfTheDay(dayDreams);
    setDayDreamsModalVisible(true);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>TU HISTORIA, EN ORDEN</Text>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Mi diario</Text>
          <Text style={styles.count}>{dreams.length}</Text>
        </View>
        <Text style={styles.subtitle}>
          Vuelve a tus sueños, asociaciones y reflexiones cuando lo necesites.
        </Text>

        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segment, !calendarMode && styles.segmentActive]}
            onPress={() => setCalendarMode(false)}
          >
            <Text style={[styles.segmentText, !calendarMode && styles.segmentTextActive]}>
              Lista
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, calendarMode && styles.segmentActive]}
            onPress={() => setCalendarMode(true)}
          >
            <Text style={[styles.segmentText, calendarMode && styles.segmentTextActive]}>
              Calendario
            </Text>
          </TouchableOpacity>
        </View>

        {calendarMode ? (
          <View style={styles.calendarSurface}>
            <Calendar
              onDayPress={handleDayPress}
              markedDates={markedDates}
              theme={{
                calendarBackground: colors.surface,
                textSectionTitleColor: colors.muted,
                selectedDayBackgroundColor: colors.primary,
                todayTextColor: colors.primary,
                dayTextColor: colors.ink,
                textDisabledColor: colors.line,
                dotColor: colors.primary,
                selectedDotColor: colors.white,
                arrowColor: colors.primary,
                monthTextColor: colors.ink,
                textMonthFontSize: 18,
                textDayFontSize: 14,
                textDayHeaderFontSize: 12,
                textMonthFontWeight: '800',
              }}
            />
            <Text style={styles.calendarHint}>
              Los puntos marcan los días con recuerdos guardados.
            </Text>
          </View>
        ) : dreams.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <AppIcon name="moon" size={25} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Todavía no hay recuerdos guardados.</Text>
            <Text style={styles.emptyText}>
              Empieza con una imagen, una emoción o cualquier detalle que aún recuerdes.
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => navigation.navigate('NuevoSueno')}
            >
              <Text style={styles.emptyButtonText}>Registrar mi primer sueño</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            {groupedDreams.map(group => (
              <View key={group.key} style={styles.dayGroup}>
                <Text style={styles.dayLabel}>
                  {group.date.toLocaleDateString('es-ES', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </Text>
                {group.dreams.map(dream => {
                  const id = getDreamId(dream);
                  const selected = selectedDreamIds.includes(id);
                  return (
                    <TouchableOpacity
                      key={id}
                      style={[styles.dreamRow, selected && styles.dreamRowSelected]}
                      onPress={() => openDream(dream)}
                    >
                      <View style={styles.dreamMarker}>
                        {selectionMode ? (
                          <View style={[styles.selectionCircle, selected && styles.selectionCircleActive]}>
                            {selected ? <AppIcon name="check" size={14} color={colors.white} /> : null}
                          </View>
                        ) : (
                          <View style={styles.emotionDot} />
                        )}
                      </View>
                      <View style={styles.dreamCopy}>
                        <Text style={styles.dreamTitle} numberOfLines={2}>
                          {getDreamSummary(dream)}
                        </Text>
                        <View style={styles.metaRow}>
                          {dream.wakingEmotion ? (
                            <Text style={styles.dreamMeta}>{dream.wakingEmotion}</Text>
                          ) : null}
                          {dream.personalReflection ? (
                            <Text style={styles.reflectionMeta}>Con reflexión</Text>
                          ) : null}
                          {!dream.fullInterpretation && !dream.interpretation ? (
                            <Text style={styles.manualMeta}>Sin IA</Text>
                          ) : null}
                        </View>
                      </View>
                      {!selectionMode ? (
                        <AppIcon name="arrowRight" size={17} color={colors.subtle} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={dayDreamsModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDayDreamsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Sueños de este día</Text>
            {dreamsOfTheDay.map(dream => (
              <TouchableOpacity
                key={getDreamId(dream)}
                style={styles.modalRow}
                onPress={() => {
                  setDayDreamsModalVisible(false);
                  navigation.navigate('DetalleSueno', { dreamId: getDreamId(dream) });
                }}
              >
                <Text style={styles.modalRowText} numberOfLines={2}>
                  {getDreamSummary(dream)}
                </Text>
                <AppIcon name="arrowRight" size={17} color={colors.muted} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setDayDreamsModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  container: {
    flexGrow: 1,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: screenPadding,
    paddingTop: spacing.lg,
  },
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
  eyebrow: { ...typography.eyebrow, color: colors.primary },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  title: { ...typography.title, color: colors.ink },
  count: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    marginLeft: spacing.sm,
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  subtitle: { ...typography.body, color: colors.muted, marginTop: spacing.sm },
  segmentedControl: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.md,
    flexDirection: 'row',
    marginTop: spacing.xxl,
    padding: 4,
  },
  segment: {
    alignItems: 'center',
    borderRadius: 9,
    flex: 1,
    minHeight: 40,
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: colors.surface },
  segmentText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  segmentTextActive: { color: colors.ink, fontWeight: '800' },
  calendarSurface: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
    overflow: 'hidden',
    padding: spacing.sm,
  },
  calendarHint: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    padding: spacing.md,
    textAlign: 'center',
  },
  list: { marginTop: spacing.xxl },
  dayGroup: { marginBottom: spacing.xxl },
  dayLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: spacing.sm,
    textTransform: 'capitalize',
  },
  dreamRow: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 76,
    paddingVertical: spacing.md,
  },
  dreamRowSelected: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
  },
  dreamMarker: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    width: 24,
  },
  emotionDot: {
    backgroundColor: colors.warm,
    borderRadius: 6,
    height: 10,
    width: 10,
  },
  selectionCircle: {
    borderColor: colors.subtle,
    borderRadius: 11,
    borderWidth: 1,
    height: 22,
    width: 22,
  },
  selectionCircleActive: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    justifyContent: 'center',
  },
  dreamCopy: { flex: 1, marginRight: spacing.sm },
  dreamTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 5,
  },
  dreamMeta: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  reflectionMeta: { color: colors.success, fontSize: 11, fontWeight: '700' },
  manualMeta: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  emptyState: {
    alignItems: 'center',
    marginTop: 54,
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 25,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: colors.midnight,
    borderRadius: radii.md,
    marginTop: spacing.xl,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  emptyButtonText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  modalOverlay: {
    backgroundColor: 'rgba(16, 24, 39, 0.42)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34,
    paddingHorizontal: screenPadding,
    paddingTop: spacing.md,
  },
  modalHandle: {
    alignSelf: 'center',
    backgroundColor: colors.line,
    borderRadius: 3,
    height: 5,
    marginBottom: spacing.xl,
    width: 42,
  },
  modalTitle: { ...typography.sectionTitle, color: colors.ink },
  modalRow: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 64,
  },
  modalRowText: {
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginRight: spacing.sm,
  },
  closeButton: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: 48,
  },
  closeButtonText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
});
