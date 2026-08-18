import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppIcon from './AppIcon';
import { spacing } from '../theme/tokens';
import { useAppTheme, useThemeStyles } from '../theme/ThemeContext';

const ITEMS = [
  { route: 'Home', label: 'Inicio', icon: 'moon' },
  { route: 'SuenosGuardados', label: 'Historial', icon: 'bookmark' },
  { route: 'DiagramaEmocional', label: 'Patrones', icon: 'chart' },
  { route: 'Perfil', label: 'Tú', icon: 'profile' },
];

export default function BottomNavigation({ activeRoute, onNavigate }) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const bottomPadding = Math.max(insets.bottom, spacing.sm);

  return (
    <View
      style={[
        styles.container,
        {
          minHeight: 64 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingLeft: Math.max(insets.left, spacing.xs),
          paddingRight: Math.max(insets.right, spacing.xs),
        },
      ]}
      accessibilityRole="tablist"
    >
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
            <View style={styles.icon}>
              <AppIcon
                name={item.icon}
                size={21}
                color={color}
                strokeWidth={2.1}
              />
            </View>
            <Text
              style={[
                styles.label,
                active && styles.labelActive,
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

const createStyles = colors => StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
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
  label: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  labelActive: {
    color: colors.primary,
  },
});
