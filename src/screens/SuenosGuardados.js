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
            <Text>No hay sueños guardados.</Text>
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
                  <Text style={styles.modalTitle}>
                    Interpretación del sueño
                  </Text>
                  <Markdown>{getDreamInterpretation(selectedDream)}</Markdown>
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
    marginBottom: 12,
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
