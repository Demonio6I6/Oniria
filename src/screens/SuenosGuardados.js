import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Alert,
  DeviceEventEmitter,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { Calendar } from 'react-native-calendars';
import {
  getDreamId,
  getDreamInterpretation,
  getDreamSummary,
  getDreamTimestamp,
} from '../domain/dreams';
import {
  deleteSavedDreamsByIds,
  getDreamCalendarData,
  loadSavedDreams,
} from '../services/dreamRepository';

const RESONANCE_LABELS = {
  yes: 'Me resonó',
  partial: 'Me resonó en parte',
  no: 'No me representó',
};

export default function SuenosGuardados({ navigation }) {
  const [suenos, setSuenos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [calendarMode, setCalendarMode] = useState(false);
  const [selectedDream, setSelectedDream] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedDreamIds, setSelectedDreamIds] = useState([]);
  const [markedDates, setMarkedDates] = useState({});
  const [dreamsByDate, setDreamsByDate] = useState({});
  const [dayDreamsModalVisible, setDayDreamsModalVisible] = useState(false);
  const [dreamsOfTheDay, setDreamsOfTheDay] = useState([]);

  const setDreamState = (dreams) => {
    setSuenos(dreams);
    const calendarData = getDreamCalendarData(dreams);
    setMarkedDates(calendarData.markedDates);
    setDreamsByDate(calendarData.dreamsByDate);
  };

  const loadSuenos = async () => {
    try {
      const savedDreams = await loadSavedDreams();
      setDreamState(savedDreams);
    } catch (error) {
      console.error('Error al cargar los sueños guardados', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setLoading(true);
      loadSuenos();
    });

    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    navigation.setParams({ selectionMode });
  }, [navigation, selectionMode]);

  useEffect(() => {
    const enableListener = DeviceEventEmitter.addListener(
      'enableSelectionMode',
      () => {
        setSelectionMode(true);
      }
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
        if (selectedDreamIds.length === 0) {
          Alert.alert('No hay sueños seleccionados para borrar.');
          return;
        }

        Alert.alert(
          'Confirmar borrado',
          '¿Está seguro de que desea borrar los sueños seleccionados?',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Aceptar',
              onPress: async () => {
                try {
                  const nextDreams = await deleteSavedDreamsByIds(
                    selectedDreamIds
                  );
                  setDreamState(nextDreams);
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
      () => {
        setCalendarMode(prev => !prev);
      }
    );

    return () => {
      enableListener.remove();
      cancelListener.remove();
      confirmListener.remove();
      calendarListener.remove();
    };
  }, [selectedDreamIds]);

  const handlePressDream = (dream) => {
    if (selectionMode) {
      const dreamId = getDreamId(dream);
      if (selectedDreamIds.includes(dreamId)) {
        setSelectedDreamIds(selectedDreamIds.filter(id => id !== dreamId));
      } else {
        setSelectedDreamIds([...selectedDreamIds, dreamId]);
      }
      return;
    }

    setSelectedDream(dream);
    setModalVisible(true);
  };

  const handleDayPress = (day) => {
    const date = day.dateString;
    if (!dreamsByDate[date]) return;

    const dreams = dreamsByDate[date];
    if (dreams.length === 1) {
      setSelectedDream(dreams[0]);
      setModalVisible(true);
    } else {
      setDreamsOfTheDay(dreams);
      setDayDreamsModalVisible(true);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Cargando sueños...</Text>
      </View>
    );
  }

  return (
    <View style={styles.outerContainer}>
      {calendarMode ? (
        <ScrollView contentContainerStyle={styles.container}>
          <Calendar
            onDayPress={handleDayPress}
            markedDates={markedDates}
            theme={{
              calendarBackground: '#ffffff',
              textSectionTitleColor: '#000',
              todayTextColor: '#2e86de',
              dayTextColor: '#000',
              dotColor: '#2e86de',
              arrowColor: 'black',
              monthTextColor: 'black',
              textMonthFontSize: 22,
              textDayFontSize: 18,
              textDayHeaderFontSize: 14,
              textMonthFontWeight: 'bold',
            }}
            style={{
              borderRadius: 12,
              elevation: 3,
              marginBottom: 20,
              padding: 10,
            }}
          />
          <Text style={{ textAlign: 'center', color: '#777' }}>
            Toca un día marcado para ver el sueño guardado.
          </Text>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.container}>
          {suenos.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Tu diario todavía está vacío.</Text>
              <Text style={styles.emptyText}>
                Empieza con una imagen, una emoción o cualquier detalle que aún
                recuerdes.
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => navigation.navigate('NuevoSueno')}
              >
                <Text style={styles.emptyButtonText}>Registrar un sueño</Text>
              </TouchableOpacity>
            </View>
          ) : (
            suenos.map(sueno => {
              const dreamId = getDreamId(sueno);
              const isSelected = selectedDreamIds.includes(dreamId);

              return (
                <TouchableOpacity
                  key={dreamId}
                  style={[
                    styles.suenoContainer,
                    selectionMode && isSelected && {
                      backgroundColor: '#d6eaff',
                    },
                  ]}
                  onPress={() => handlePressDream(sueno)}
                >
                  <Text style={styles.suenoSummary}>
                    {getDreamSummary(sueno)}
                  </Text>
                  {!!sueno.wakingEmotion && (
                    <Text style={styles.dreamMeta}>
                      Al despertar: {sueno.wakingEmotion}
                    </Text>
                  )}
                  {!!sueno.personalReflection && (
                    <Text style={styles.reflectionPreview} numberOfLines={2}>
                      Tu reflexión: {sueno.personalReflection}
                    </Text>
                  )}
                  <Text style={styles.timestamp}>
                    {new Date(getDreamTimestamp(sueno)).toLocaleString()}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      <Modal
        visible={dayDreamsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDayDreamsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Sueños guardados ese día:</Text>
            {dreamsOfTheDay.map(dream => (
              <TouchableOpacity
                key={getDreamId(dream)}
                style={styles.modalOption}
                onPress={() => {
                  setSelectedDream(dream);
                  setDayDreamsModalVisible(false);
                  setModalVisible(true);
                }}
              >
                <Text>{getDreamSummary(dream)}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setDayDreamsModalVisible(false)}>
              <Text style={styles.closeButton}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              {selectedDream && (
                <>
                  <Text style={styles.modalEyebrow}>TU SUEÑO</Text>
                  <Text style={styles.dreamDescription}>
                    {selectedDream.description || getDreamSummary(selectedDream)}
                  </Text>

                  {!!selectedDream.wakingEmotion && (
                    <Text style={styles.detailMeta}>
                      Emoción al despertar: {selectedDream.wakingEmotion}
                    </Text>
                  )}
                  {!!selectedDream.wakingContext && (
                    <View style={styles.personalSection}>
                      <Text style={styles.personalSectionTitle}>
                        Asociación con tu vida
                      </Text>
                      <Text style={styles.personalSectionText}>
                        {selectedDream.wakingContext}
                      </Text>
                    </View>
                  )}

                  {getDreamInterpretation(selectedDream) ? (
                    <>
                      <Text style={[styles.modalTitle, styles.readingTitle]}>
                        Lectura orientativa
                      </Text>
                      <Markdown>{getDreamInterpretation(selectedDream)}</Markdown>
                    </>
                  ) : (
                    <View style={styles.manualDreamNotice}>
                      <Text style={styles.manualDreamNoticeTitle}>
                        Guardado sin lectura de IA
                      </Text>
                      <Text style={styles.manualDreamNoticeText}>
                        Este registro forma parte de tu diario y de tus recuentos,
                        pero no consumió una interpretación.
                      </Text>
                      <TouchableOpacity
                        style={styles.manualDreamAction}
                        onPress={() => {
                          setModalVisible(false);
                          navigation.navigate('NuevoSueno', {
                            manualDream: selectedDream,
                          });
                        }}
                      >
                        <Text style={styles.manualDreamActionText}>
                          Interpretar este sueño
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {(selectedDream.personalReflection || selectedDream.resonance) ? (
                    <View style={styles.reflectionSection}>
                      <Text style={styles.personalSectionTitle}>Tu reflexión</Text>
                      {!!selectedDream.resonance && (
                        <Text style={styles.resonanceLabel}>
                          {RESONANCE_LABELS[selectedDream.resonance] ||
                            selectedDream.resonance}
                        </Text>
                      )}
                      {!!selectedDream.personalReflection && (
                        <Text style={styles.personalSectionText}>
                          {selectedDream.personalReflection}
                        </Text>
                      )}
                    </View>
                  ) : null}
                </>
              )}
            </ScrollView>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.closeButtonContainer}
            >
              <Text style={styles.closeButton}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    padding: 20,
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyState: {
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderRadius: 14,
    borderStyle: 'dashed',
    borderWidth: 1,
    padding: 20,
  },
  emptyTitle: {
    color: '#111827',
    fontSize: 19,
    fontWeight: '800',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 7,
  },
  emptyButton: {
    backgroundColor: '#111827',
    borderRadius: 8,
    marginTop: 16,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  suenoContainer: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  suenoSummary: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  dreamMeta: {
    color: '#4338CA',
    fontSize: 12,
    marginTop: 7,
    textTransform: 'capitalize',
  },
  reflectionPreview: {
    color: '#475569',
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
    marginTop: 7,
  },
  timestamp: {
    fontSize: 12,
    color: 'gray',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: '80%',
    padding: 20,
    elevation: 4,
  },
  modalContent: {
    paddingBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  readingTitle: {
    marginTop: 22,
  },
  manualDreamNotice: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    marginTop: 20,
    padding: 14,
  },
  manualDreamNoticeTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '800',
  },
  manualDreamNoticeText: {
    color: '#4B5563',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  manualDreamAction: {
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 8,
    marginTop: 12,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  manualDreamActionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  modalEyebrow: {
    color: '#6366F1',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  dreamDescription: {
    color: '#111827',
    fontSize: 16,
    lineHeight: 23,
  },
  detailMeta: {
    color: '#4338CA',
    fontSize: 13,
    marginTop: 10,
    textTransform: 'capitalize',
  },
  personalSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    marginTop: 14,
    padding: 13,
  },
  personalSectionTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 5,
  },
  personalSectionText: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 21,
  },
  reflectionSection: {
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    marginTop: 20,
    padding: 14,
  },
  resonanceLabel: {
    color: '#4338CA',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 7,
  },
  modalOption: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#ddd',
  },
  closeButtonContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  closeButton: {
    color: '#007bff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
