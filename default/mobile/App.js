export const DEFAULT_REACT_NATIVE_APP_SOURCE = `import * as React from "react";
import { SafeAreaView, View, Text, StyleSheet, Pressable, ScrollView } from "react-native";

export default function App() {
  const [count, setCount] = React.useState(0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Superblocks Mobile</Text>
        </View>

        <Text style={styles.title}>Hello from Superblocks</Text>
        <Text style={styles.subtitle}>
          This is the default React Native app running in the mobile live preview.
        </Text>

        <View style={styles.counterCard}>
          <Text style={styles.counterLabel}>Tap counter</Text>
          <Text style={styles.counterValue}>{count}</Text>
          <Pressable style={styles.button} onPress={() => setCount((v) => v + 1)}>
            <Text style={styles.buttonText}>Increment</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  container: {
    padding: 20,
    gap: 16,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "600",
  },
  title: {
    color: "#f8fafc",
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34,
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 15,
    lineHeight: 22,
  },
  counterCard: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  counterLabel: {
    color: "#9ca3af",
    fontSize: 13,
  },
  counterValue: {
    color: "#ffffff",
    fontSize: 36,
    fontWeight: "700",
  },
  button: {
    marginTop: 8,
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
});
`;
