import React, { useState } from 'react';
import {
  Image,
  ImageBackground,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AppIcon from './AppIcon';

const ONBOARDING_IMAGE = require('../../assets/2.png');
const ONBOARDING_MARK = require('../../assets/icon.png');

const PAGES = [
  {
    eyebrow: 'RECUERDA Y REGISTRA',
    icon: 'bookmark',
    title: 'Guarda tus sueños antes de que desaparezcan.',
    text: 'Crea un diario privado con los lugares, personas, emociones y escenas que recuerdes.',
  },
  {
    eyebrow: 'EXPLORA, NO ADIVINES',
    icon: 'search',
    title: 'Una lectura es una posibilidad, no una verdad absoluta.',
    text: 'Lunentra conecta el sueño con tu contexto personal y te propone preguntas para reflexionar.',
  },
  {
    eyebrow: 'RECONOCE PATRONES',
    icon: 'chart',
    title: 'Lo valioso aparece con el tiempo.',
    text: 'Al sumar registros puedes observar emociones y temas que se repiten o cambian.',
  },
  {
    eyebrow: 'TU INTIMIDAD IMPORTA',
    icon: 'shield',
    title: 'Tu diario sigue estando bajo tu control.',
    text: 'Los registros se guardan cifrados en el dispositivo. Solo se envían a la IA cuando solicitas una lectura.',
  },
];

export default function OnboardingScreen({ onFinish }) {
  const [pageIndex, setPageIndex] = useState(0);
  const page = PAGES[pageIndex];
  const isLastPage = pageIndex === PAGES.length - 1;

  const handleNext = () => {
    if (isLastPage) {
      onFinish();
      return;
    }

    setPageIndex(currentIndex => currentIndex + 1);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ImageBackground
        source={ONBOARDING_IMAGE}
        style={styles.background}
        imageStyle={styles.backgroundImage}
      >
        <View style={styles.scrim} />

        <View style={styles.topRow}>
          <View style={styles.brandRow}>
            <Image source={ONBOARDING_MARK} style={styles.brandMark} />
            <Text style={styles.brandName}>Lunentra</Text>
          </View>
          {!isLastPage ? (
            <Pressable onPress={onFinish} hitSlop={8}>
              <Text style={styles.skipText}>Omitir</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.contentCard}>
          <View style={styles.iconContainer}>
            <AppIcon name={page.icon} size={24} color="#E0E7FF" />
          </View>
          <Text style={styles.eyebrow}>{page.eyebrow}</Text>
          <Text style={styles.title}>{page.title}</Text>
          <Text style={styles.body}>{page.text}</Text>

          <View style={styles.dotsRow}>
            {PAGES.map((item, index) => (
              <View
                key={item.eyebrow}
                style={[styles.dot, index === pageIndex && styles.dotActive]}
              />
            ))}
          </View>

          <Pressable style={styles.primaryButton} onPress={handleNext}>
            <Text style={styles.primaryButtonText}>
              {isLastPage ? 'Empezar mi diario' : 'Siguiente'}
            </Text>
            <AppIcon name="arrowRight" size={19} color="#111827" />
          </Pressable>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#07111F',
    flex: 1,
  },
  background: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingBottom: 26,
    paddingTop: 18,
  },
  backgroundImage: {
    opacity: 0.92,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3, 9, 20, 0.48)',
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  brandMark: {
    backgroundColor: '#fff',
    borderRadius: 8,
    height: 38,
    marginRight: 10,
    width: 38,
  },
  brandName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  skipText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
  },
  contentCard: {
    alignSelf: 'center',
    backgroundColor: 'rgba(7, 17, 31, 0.9)',
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 18,
    borderWidth: 1,
    maxWidth: 520,
    padding: 22,
    width: '100%',
  },
  iconContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(79, 70, 229, 0.3)',
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    marginBottom: 18,
    width: 48,
  },
  eyebrow: {
    color: '#A5B4FC',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  title: {
    color: '#fff',
    fontSize: 29,
    fontWeight: '800',
    lineHeight: 35,
  },
  body: {
    color: '#CBD5E1',
    fontSize: 15,
    lineHeight: 23,
    marginTop: 12,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 7,
    marginBottom: 20,
    marginTop: 24,
  },
  dot: {
    backgroundColor: '#475569',
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  dotActive: {
    backgroundColor: '#C7D2FE',
    width: 24,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
    marginRight: 8,
  },
});
