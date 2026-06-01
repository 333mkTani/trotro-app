import React, { useRef, useCallback } from 'react';
import { View, TextInput, StyleSheet, Platform } from 'react-native';
import Colors from '@/constants/colors';

const VALID_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

interface CodeInputCellsProps {
  code: string[];
  onCodeChange: (code: string[]) => void;
}

export const CodeInputCells = React.memo(function CodeInputCells({
  code,
  onCodeChange,
}: CodeInputCellsProps) {
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const handleChange = useCallback(
    (text: string, index: number) => {
      const char = text.toUpperCase().slice(-1);
      if (char && !VALID_CHARS.includes(char)) return;

      const newCode = [...code];
      newCode[index] = char;
      onCodeChange(newCode);

      if (char && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [code, onCodeChange]
  );

  const handleKeyPress = useCallback(
    (key: string, index: number) => {
      if (key === 'Backspace' && !code[index] && index > 0) {
        const newCode = [...code];
        newCode[index - 1] = '';
        onCodeChange(newCode);
        inputRefs.current[index - 1]?.focus();
      }
    },
    [code, onCodeChange]
  );

  return (
    <View style={styles.container} testID="code-input">
      {Array.from({ length: 6 }).map((_, index) => (
        <TextInput
          key={index}
          ref={(ref) => {
            inputRefs.current[index] = ref;
          }}
          style={[styles.cell, code[index] ? styles.cellFilled : null]}
          value={code[index]}
          onChangeText={(text) => handleChange(text, index)}
          onKeyPress={(e) => handleKeyPress(e.nativeEvent.key, index)}
          maxLength={1}
          autoCapitalize="characters"
          autoCorrect={false}
          keyboardType={Platform.OS === 'web' ? 'default' : 'default'}
          testID={`code-cell-${index}`}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cell: {
    flex: 1,
    maxWidth: 56,
    height: 64,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    fontSize: 24,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
    color: Colors.textPrimary,
  },
  cellFilled: {
    borderColor: Colors.primary,
    backgroundColor: '#EBF4FF',
  },
});
