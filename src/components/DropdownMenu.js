// src/components/DropdownMenu.js
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { navigationRef } from '../utils/navigationRef';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons'; // o la librería de íconos que uses

export default function DropdownMenu({ isVisible, onClose, signOut }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-10)).current;

  useEffect(() => {
    if (isVisible) {
      // fade in + slide down
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
      // fade out + slide up
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
  }, [isVisible]);

  const handleNavigate = (screen) => {
    navigationRef.navigate(screen);
    onClose();
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
            onPress={() => handleNavigate('Perfil')}
          >
            <Ionicons name="person-circle-outline" size={20} />
            <Text style={styles.menuText}>Perfil</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => handleNavigate('SuenosGuardados')}
          >
            <FontAwesome5 name="bookmark" size={20} />
            <Text style={styles.menuText}>Sueños guardados</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => handleNavigate('DiagramaEmocional')}
          >
            <MaterialCommunityIcons name="chart-areaspline" size={20} />
            <Text style={styles.menuText}>Diagrama Emocional</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => handleNavigate('Configuracion')}
          >
            <Ionicons name="settings-outline" size={20} />
            <Text style={styles.menuText}>Configuración</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              onClose();         // primero cierro el menú
              signOut();         // luego ejecuto el logout
              // opcional: reset para limpiar el stack y quirar "back"
              navigationRef.reset({
                index: 0,
                routes: [{ name: 'Home' }], // o la pantalla de login si la tienes aparte
              });
            }}
          >
            <Ionicons name="log-out-outline" size={20} />
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
  },
  menuContainer: {
    position: 'absolute',
    top: 50,          // ajusta según la altura de tu header
    left: 20,         // margen desde el borde izquierdo
    width: 200,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 5,
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
