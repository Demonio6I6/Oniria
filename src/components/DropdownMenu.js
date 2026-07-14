// src/components/DropdownMenu.js
import React, { useRef, useEffect, useState } from 'react';
import {
  Alert,
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { navigationRef } from '../utils/navigationRef';
import AppIcon from './AppIcon';
import { trackProductEvent } from '../services/productAnalytics';

export default function DropdownMenu({ isVisible, onClose, signOut, user }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-10)).current;
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -10,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [fadeAnim, isVisible, translateY]);

  const handleNavigate = (screen) => {
    if (screen === 'Cuenta' && user?.isAnonymous) {
      trackProductEvent('account_cta_clicked', { reason: 'menu' });
    }
    navigationRef.navigate(screen);
    onClose();
  };

  const completeSignOut = async () => {
    if (isSigningOut) return;

    setIsSigningOut(true);

    try {
      await signOut();
      navigationRef.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    } catch (error) {
      console.error('Error al cerrar sesion desde el menu:', error);
      Alert.alert(
        'No se pudo cerrar sesión',
        user?.isAnonymous
          ? 'No se pudieron borrar los datos de la cuenta invitada. Inténtalo de nuevo.'
          : 'Inténtalo de nuevo.'
      );
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleSignOutPress = () => {
    onClose();

    if (!user?.isAnonymous) {
      completeSignOut();
      return;
    }

    Alert.alert(
      'Salir como invitado',
      'Esta cuenta invitada no se puede recuperar después. Puedes crear una cuenta para continuar o borrar la sesión.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Crear cuenta',
          onPress: () => handleNavigate('Cuenta'),
        },
        {
          text: 'Borrar y salir',
          style: 'destructive',
          onPress: completeSignOut,
        },
      ],
      { cancelable: true }
    );
  };

  if (!isVisible) return null;

  return (
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.menuContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => handleNavigate('Home')}
          >
            <AppIcon name="moon" size={20} />
            <Text style={styles.menuText}>Inicio</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => handleNavigate('Perfil')}
          >
            <AppIcon name="profile" size={20} />
            <Text style={styles.menuText}>Mi contexto</Text>
          </TouchableOpacity>

          {user?.isAnonymous ? (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleNavigate('Cuenta')}
            >
              <AppIcon name="check" size={20} />
              <Text style={styles.menuText}>Crear cuenta</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => handleNavigate('SuenosGuardados')}
          >
            <AppIcon name="bookmark" size={20} />
            <Text style={styles.menuText}>Mi diario</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => handleNavigate('DiagramaEmocional')}
          >
            <AppIcon name="chart" size={20} />
            <Text style={styles.menuText}>Mis patrones</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => handleNavigate('Configuracion')}
          >
            <AppIcon name="shield" size={20} />
            <Text style={styles.menuText}>Privacidad y control</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => handleNavigate('PlanPremium')}
          >
            <AppIcon name="bookmark" size={20} />
            <Text style={styles.menuText}>Plan y Premium</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleSignOutPress}
            disabled={isSigningOut}
          >
            <AppIcon name="logout" size={20} />
            <Text style={styles.menuText}>Cerrar sesión</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
  },
  menuContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 200,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 5,
    zIndex: 1001,
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  menuText: {
    marginLeft: 10,
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#ccc',
    marginVertical: 6,
  },
});
