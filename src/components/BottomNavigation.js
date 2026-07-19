import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AppIcon from './AppIcon';
import { colors } from '../theme/tokens';

const ITEMS = [
  { route: 'Home', label: 'Inicio', icon: 'moon' },
  { route: 'SuenosGuardados', label: 'Diario', icon: 'bookmark' },
  { route: 'NuevoSueno', label: 'Registrar', icon: 'plus', primary: true },
  { route: 'DiagramaEmocional', label: 'Patrones', icon: 'chart' },
  { route: 'Perfil', label: 'Tú', icon: 'profile' },
];

export default function BottomNavigation({ activeRoute, onNavigate }) {
  return (
    <View style={styles.container} accessibilityRole="tablist">
      {ITEMS.map(item => {
        const active = activeRoute === item.route;
        const color = active ? colors.primary : colors.muted;

        return (
          <TouchableOpacity
            key={item.route}
            style={styles.item}
            onPress={() => onNavigate(item.route)}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active }}
          >
            <View style={item.primary ? styles.primaryIcon : styles.icon}>
              <AppIcon
                name={item.icon}
                size={item.primary ? 25 : 21}
                color={item.primary ? colors.white : color}
                strokeWidth={2.1}
              />
            </View>
            <Text
              style={[
                styles.label,
                active && styles.labelActive,
                item.primary && styles.primaryLabel,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 72,
    paddingBottom: 8,
    paddingHorizontal: 4,
    paddingTop: 7,
  },
  item: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 54,
  },
  icon: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
  },
  primaryIcon: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 18,
    height: 38,
    justifyContent: 'center',
    marginTop: -14,
    width: 52,
  },
  label: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  labelActive: {
    color: colors.primary,
  },
  primaryLabel: {
    color: colors.ink,
    marginTop: 1,
  },
});
