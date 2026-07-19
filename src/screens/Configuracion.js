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
import { colors, radii, screenPadding, spacing, typography } from '../theme/tokens';

const PRIVACY_POLICY_URL = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || '';
const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL || '';
const ACCOUNT_DELETION_URL =
  process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL || '';

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

export default function Configuracion({
  user,
  enableNotifications,
  deleteAccount,
}) {
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

  const openExternalUrl = async (url, label) => {
    if (!url) return;

    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Enlace no disponible', `No se pudo abrir ${label}.`);
    }
  };

  const handleOpenPrivacyPolicy = () =>
    openExternalUrl(PRIVACY_POLICY_URL, 'la política de privacidad');

  const handleOpenTerms = () =>
    openExternalUrl(TERMS_URL, 'los términos de uso');

  const handleOpenAccountDeletion = () =>
    openExternalUrl(ACCOUNT_DELETION_URL, 'la página de eliminación de cuenta');

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
              setBusyAction('deleteLocal');
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

  const handleDeleteAccount = () => {
    if (!deleteAccount || !user || user.isAnonymous) return;

    Alert.alert(
      'Eliminar cuenta de Lunentra',
      'Se eliminarán tu cuenta, los datos asociados en Firebase y tu perfil de RevenueCat. Esta acción no cancela una suscripción activa de Google Play.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirmación final',
              'La eliminación es permanente. Si tienes Premium, cancela también la suscripción desde Google Play para evitar futuras renovaciones.',
              [
                { text: 'Volver', style: 'cancel' },
                {
                  text: 'Eliminar definitivamente',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      setBusyAction('deleteAccount');
                      await deleteAccount();
                      clearRespuestas();
                      setAiConsent(false);
                      setMonthlyConsent(false);
                      Alert.alert(
                        'Cuenta eliminada',
                        'Tu cuenta y sus datos asociados se han eliminado.'
                      );
                    } catch (error) {
                      const needsRecentLogin =
                        error?.details?.reason === 'recent-login-required' ||
                        error?.message?.includes('Vuelve a iniciar sesion');
                      Alert.alert(
                        needsRecentLogin ? 'Vuelve a iniciar sesión' : 'Error',
                        needsRecentLogin
                          ? 'Por seguridad, cierra sesión, vuelve a entrar y repite la eliminación en los próximos 15 minutos.'
                          : 'No se pudo eliminar la cuenta completa. No se ha cerrado la sesión para que puedas volver a intentarlo.'
                      );
                    } finally {
                      setBusyAction('');
                    }
                  },
                },
              ]
            );
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
          icon="lock"
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
        {!!TERMS_URL && (
          <TouchableOpacity style={styles.linkButton} onPress={handleOpenTerms}>
            <Text style={styles.linkButtonText}>Leer términos de uso</Text>
            <AppIcon name="arrowRight" size={17} color="#4338CA" />
          </TouchableOpacity>
        )}
        {!!ACCOUNT_DELETION_URL && (
          <TouchableOpacity
            style={styles.linkButton}
            onPress={handleOpenAccountDeletion}
          >
            <Text style={styles.linkButtonText}>Eliminación de cuenta en la web</Text>
            <AppIcon name="arrowRight" size={17} color="#4338CA" />
          </TouchableOpacity>
        )}
      </View>

      {user && !user.isAnonymous && (
        <View style={[styles.section, styles.dangerSection]}>
          <Text style={styles.dangerTitle}>Eliminar mi cuenta</Text>
          <Text style={styles.sectionDescription}>
            Elimina la cuenta, sus datos remotos y el contenido local de este
            dispositivo. Una suscripción de Google Play debe cancelarse por separado.
          </Text>
          <TouchableOpacity
            style={styles.dangerButton}
            onPress={handleDeleteAccount}
            disabled={busyAction === 'deleteAccount'}
          >
            {busyAction === 'deleteAccount' ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.dangerButtonText}>Eliminar mi cuenta</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.section, styles.dangerSection]}>
        <Text style={styles.dangerTitle}>Borrar el contenido de este dispositivo</Text>
        <Text style={styles.sectionDescription}>
          Esta acción elimina el diario, contexto, emociones, análisis y
          preferencias locales. No se puede deshacer.
        </Text>
        <TouchableOpacity
          style={styles.dangerButton}
          onPress={handleClearLocalData}
          disabled={busyAction === 'deleteLocal'}
        >
          {busyAction === 'deleteLocal' ? (
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
    backgroundColor: colors.background,
    flex: 1,
  },
  container: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: 36,
  },
  heroCard: {
    marginBottom: spacing.xxl,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.primary,
  },
  heroTitle: {
    ...typography.title,
    color: colors.ink,
    marginTop: spacing.sm,
  },
  heroText: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  section: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    marginBottom: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  sectionTitle: {
    ...typography.sectionTitle,
    color: colors.ink,
  },
  sectionDescription: {
    color: colors.muted,
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
    backgroundColor: colors.primarySoft,
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
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  informationText: {
    color: colors.muted,
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
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  statusBadge: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusBadgeActive: {
    backgroundColor: colors.successSoft,
  },
  statusBadgeText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
  },
  statusBadgeTextActive: {
    color: colors.success,
  },
  outlineButton: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 44,
    paddingHorizontal: 14,
  },
  outlineButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  primaryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.midnight,
    borderRadius: radii.md,
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
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    marginRight: 7,
  },
  pendingPolicyBox: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warm,
    borderRadius: radii.md,
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
    borderBottomColor: colors.danger,
  },
  dangerTitle: {
    color: colors.danger,
    fontSize: 17,
    fontWeight: '800',
  },
  dangerButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.danger,
    borderRadius: radii.md,
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
