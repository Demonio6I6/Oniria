import React, { useContext, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { GlobalContext } from '../GlobalContext';
import { PROFILE_QUESTIONS } from '../domain/profile';

function AutoResizingTextInput({
  value,
  onChangeText,
  placeholder,
  placeholderTextColor,
  style,
  onBlur,
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [contentHeight, setContentHeight] = useState(40);
  const MAX_HEIGHT = 100;

  const inputHeight = isFocused
    ? contentHeight
    : Math.min(contentHeight, MAX_HEIGHT);

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor}
      multiline
      onContentSizeChange={(event) =>
        setContentHeight(event.nativeEvent.contentSize.height)
      }
      onFocus={() => setIsFocused(true)}
      onBlur={() => {
        setIsFocused(false);
        if (onBlur) onBlur();
      }}
      style={[style, { height: Math.max(40, inputHeight) }]}
      textAlignVertical="top"
    />
  );
}

export default function Perfil() {
  const { respuestas, updateRespuestas } = useContext(GlobalContext);

  const handleChange = (key, value) => {
    updateRespuestas({ ...respuestas, [key]: value });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
      >
        {PROFILE_QUESTIONS.map((item, index) => (
          <View key={item.key} style={styles.card}>
            <Text style={styles.question}>{item.pregunta}</Text>
            <AutoResizingTextInput
              placeholder={`Respuesta ${index + 1}`}
              placeholderTextColor="#aaa"
              value={respuestas[item.key]}
              onChangeText={(text) => handleChange(item.key, text)}
              style={styles.input}
            />
          </View>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fefefe',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  question: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#333',
  },
});
