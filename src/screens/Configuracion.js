import React, { useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AppIcon from '../components/AppIcon';
import { GlobalContext } from '../GlobalContext';
import {
  hasAcceptedAiPrivacyNotice,
  hasAcceptedMonthlyAnalysisPrivacyNotice,
  revokeAiPrivacyNotice,
  revokeMonthlyAnalysisPrivacyNotice,
} from '../services/privacyRepository';
import { clearCurrentUserLocalData } from '../services/userStorage';

const PRIVACY_POLICY_URL = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || '';

function InformationRow({ icon, title, text }) {
  return (
    <View style={styles.informationRow}>
      <View style={styles.informationIcon}>
        <AppIcon name={icon} size={19} color="#4338CA" />
      </View>
      <View style={styles.informationCopy}>
        <Text style={styles.informationTitle}>{title}</Text>
        <Text style={styles.informationText}>{text}</Text>
      </View>
    </View>
  );
}

export default function Configuracion({ enableNotifications }) {
  const { clearRespuestas } = useContext(GlobalContext);
  const [aiConsent, setAiConsent] = useState(false);
  const [monthlyConsent, setMonthlyConsent] = useState(false);
  const [busyAction, setBusyAction] = useState('');

  const loadConsentState = async () => {
    const [hasAiConsent, hasMonthlyConsent] = await Promise.all([
      hasAcceptedAiPrivacyNotice(),
      hasAcceptedMonthlyAnalysisPrivacyNotice(),
    ]);

    setAiConsent(hasAiConsent);
    setMonthlyConsent(hasMonthlyConsent);
  };

  useEffect(() => {
    loadConsentState().catch(error => {
      console.error('Error cargando preferencias de privacidad:', error);
    });
  }, []);

  const handleRevokeAiConsent = () => {
    Alert.alert(
      'Revocar consentimiento de IA',
      'Lunentra volverá a pedirte permiso antes de enviar un sueño o un análisis mensual a la IA.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Revocar',
          onPress: async () => {
            try {
              setBusyAction('consent');
              await Promise.all([
                revokeAiPrivacyNotice(),
                revokeMonthlyAnalysisPrivacyNotice(),
              ]);
              setAiConsent(false);
              setMonthlyConsent(false);
            } catch (error) {
              console.error('Error revocando consentimiento:', error);
              Alert.alert('Error', 'No se pudo cambiar esta preferencia.');
            } finally {
              setBusyAction('');
            }
          },
        },
      ]
    );
  };

  const handleEnableNotifications = async () => {
    if (!enableNotifications || busyAction) return;

    try {
      setBusyAction('notifications');
      const token = await enableNotifications();
      if (token) {
        Alert.alert(
          'Recordatorios activados',
          'Lunentra podrá enviarte recordatorios y reflexiones cuando corresponda.'
        );
      }
    } catch (error) {
      console.error('Error activando notificaciones:', error);
      Alert.alert('No se pudieron activar', 'Revisa los permisos del dispositivo.');
    } finally {
      setBusyAction('');
    }
  };

  const handleOpenPrivacyPolicy = async () => {
    if (!PRIVACY_POLICY_URL) return;

    const supported = await Linking.canOpenURL(PRIVACY_POLICY_URL);
    if (supported) {
      await Linking.openURL(PRIVACY_POLICY_URL);
    } else {
      Alert.alert('Enlace no disponible', 'No se pudo abrir la política de privacidad.');
    }
  };

  const handleClearLocalData = () => {
    Alert.alert(
      'Borrar datos locales',
      'Se eliminarán de este dispositivo tus sueños, perfil, emociones, análisis y preferencias de privacidad.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            try {
              setBusyAction('delete');
              await clearCurrentUserLocalData();
              clearRespuestas();
              setAiConsent(false);
              setMonthlyConsent(false);
              Alert.alert('Datos borrados', 'El contenido local de Lunentra fue eliminado.');
            } catch (error) {
              console.error('Error borrando datos locales:', error);
              Alert.alert('Error', 'No se pudieron borrar los datos locales.');
            } finally {
              setBusyAction('');
            }
          },
        },
      ]
    );
  };

  const hasAnyAiConsent = aiConsent || monthlyConsent;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>TU INTIMIDAD IMPORTA</Text>
        <Text style={styles.heroTitle}>Tus sueños siguen bajo tu control.</Text>
        <Text style={styles.heroText}>
          Aquí puedes entender qué se guarda, qué se envía y cambiar tus
          decisiones cuando quieras.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cómo se usan tus datos</Text>
        <InformationRow
          icon="shield"
          title="Guardado local cifrado"
          text="Tu diario, contexto y patrones se almacenan protegidos en este dispositivo."
        />
        <InformationRow
          icon="send"
          title="Envío solo cuando lo solicitas"
          text="Para generar una lectura se envía el sueño y el contexto relevante a nuestro servidor y al proveedor de IA."
        />
        <InformationRow
          icon="profile"
          title="Tú eliges el contexto"
          text="Las preguntas personales son opcionales y puedes modificarlas o eliminarlas."
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Consentimiento de IA</Text>
            <Text style={styles.sectionMeta}>
              {hasAnyAiConsent ? 'Aceptado' : 'Se pedirá antes de usar la IA'}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              hasAnyAiConsent && styles.statusBadgeActive,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                hasAnyAiConsent && styles.statusBadgeTextActive,
              ]}
            >
              {hasAnyAiConsent ? 'ACTIVO' : 'INACTIVO'}
            </Text>
          </View>
        </View>
        {hasAnyAiConsent ? (
          <TouchableOpacity
            style={styles.outlineButton}
            onPress={handleRevokeAiConsent}
            disabled={busyAction === 'consent'}
          >
            {busyAction === 'consent' ? (
              <ActivityIndicator color="#4338CA" size="small" />
            ) : (
              <Text style={styles.outlineButtonText}>Revocar consentimiento</Text>
            )}
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recordatorios</Text>
        <Text style={styles.sectionDescription}>
          Actívalos cuando tú decidas. Lunentra ya no solicita este permiso al abrir
          la aplicación por primera vez.
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleEnableNotifications}
          disabled={busyAction === 'notifications'}
        >
          {busyAction === 'notifications' ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>Activar recordatorios</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Información y límites</Text>
        <Text style={styles.sectionDescription}>
          Lunentra es una herramienta de reflexión. No es un dispositivo médico y
          no diagnostica, trata, cura ni previene ninguna condición. Si necesitas
          consejo, diagnóstico o tratamiento, consulta a un profesional sanitario.
        </Text>
        {PRIVACY_POLICY_URL ? (
          <TouchableOpacity
            style={styles.linkButton}
            onPress={handleOpenPrivacyPolicy}
          >
            <Text style={styles.linkButtonText}>Leer política de privacidad</Text>
            <AppIcon name="arrowRight" size={17} color="#4338CA" />
          </TouchableOpacity>
        ) : (
          <View style={styles.pendingPolicyBox}>
            <Text style={styles.pendingPolicyText}>
              Falta configurar la URL pública de la política de privacidad antes
              de publicar la app.
            </Text>
          </View>
        )}
      </View>

      <View style={[styles.section, styles.dangerSection]}>
        <Text style={styles.dangerTitle}>Borrar el contenido de este dispositivo</Text>
        <Text style={styles.sectionDescription}>
          Esta acción elimina el diario, contexto, emociones, análisis y
          preferencias locales. No se puede deshacer.
        </Text>
        <TouchableOpacity
          style={styles.dangerButton}
          onPress={handleClearLocalData}
          disabled={busyAction === 'delete'}
        >
          {busyAction === 'delete' ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.dangerButtonText}>Borrar datos locales</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#F8FAFC',
    flex: 1,
  },
  container: {
    padding: 20,
    paddingBottom: 36,
  },
  heroCard: {
    backgroundColor: '#07111F',
    borderRadius: 16,
    marginBottom: 14,
    padding: 20,
  },
  eyebrow: {
    color: '#A5B4FC',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
    marginTop: 8,
  },
  heroText: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  section: {
    backgroundColor: '#fff',
    borderColor: '#E2E8F0',
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '800',
  },
  sectionDescription: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 7,
  },
  informationRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    marginTop: 15,
  },
  informationIcon: {
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 9,
    height: 38,
    justifyContent: 'center',
    marginRight: 11,
    width: 38,
  },
  informationCopy: {
    flex: 1,
  },
  informationTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '800',
  },
  informationText: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  sectionHeaderRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionMeta: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },
  statusBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusBadgeActive: {
    backgroundColor: '#ECFDF5',
  },
  statusBadgeText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
  },
  statusBadgeTextActive: {
    color: '#047857',
  },
  outlineButton: {
    alignItems: 'center',
    borderColor: '#C7D2FE',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 44,
    paddingHorizontal: 14,
  },
  outlineButtonText: {
    color: '#4338CA',
    fontSize: 13,
    fontWeight: '800',
  },
  primaryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#4338CA',
    borderRadius: 8,
    justifyContent: 'center',
    marginTop: 13,
    minHeight: 44,
    paddingHorizontal: 15,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  linkButton: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 14,
  },
  linkButtonText: {
    color: '#4338CA',
    fontSize: 13,
    fontWeight: '800',
    marginRight: 7,
  },
  pendingPolicyBox: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 13,
    padding: 11,
  },
  pendingPolicyText: {
    color: '#9A3412',
    fontSize: 12,
    lineHeight: 18,
  },
  dangerSection: {
    borderColor: '#FECACA',
  },
  dangerTitle: {
    color: '#991B1B',
    fontSize: 17,
    fontWeight: '800',
  },
  dangerButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#991B1B',
    borderRadius: 8,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 44,
    paddingHorizontal: 15,
  },
  dangerButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
});
