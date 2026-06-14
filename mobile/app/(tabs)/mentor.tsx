import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { Surface } from "@/components/ui/Surface";
import { Colors, Radius, Spacing, Typography } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";

type ChatMsg = { id: string; role: string; content: string; created_at?: string };

export default function MentorScreen() {
  const { t } = useI18n();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const load = async () => {
    try {
      setMessages(await api.getChatHistory());
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    const optimistic: ChatMsg = { id: `local-${Date.now()}`, role: "user", content: text };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const reply = await api.sendChatMessage(text);
      setMessages((prev) => [...prev.filter((m) => m.id !== optimistic.id), optimistic, reply]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimistic.id),
        optimistic,
        { id: `err-${Date.now()}`, role: "assistant", content: e.message || t.common.error },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>;
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Text style={styles.brand}>TalkCash</Text>
      <Text style={styles.title}>{t.mentor.title}</Text>
      <Text style={styles.subtitle}>{t.mentor.subtitle}</Text>
      <ScrollView ref={scrollRef} style={styles.chat} contentContainerStyle={styles.chatContent}>
        {messages.length === 0 && (
          <Surface variant="accent" style={styles.emptyCard}>
            <Text style={styles.empty}>{t.mentor.empty}</Text>
          </Surface>
        )}
        {messages.map((m) => (
          <Surface
            key={m.id}
            variant={m.role === "user" ? "accent" : "elevated"}
            style={[styles.bubble, m.role === "user" ? styles.userBubble : styles.aiBubble]}
          >
            <Text style={styles.bubbleText}>{m.content}</Text>
          </Surface>
        ))}
      </ScrollView>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={t.mentor.placeholder}
          placeholderTextColor={Colors.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
        />
        <TouchableOpacity style={styles.sendBtn} onPress={send} disabled={sending}>
          <Text style={styles.sendText}>{sending ? "..." : t.mentor.send}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, padding: Spacing.md },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg },
  brand: { color: Colors.accent, ...Typography.label, marginBottom: 4 },
  title: { color: Colors.text, ...Typography.title },
  subtitle: { color: Colors.textSecondary, marginBottom: Spacing.md },
  chat: { flex: 1 },
  chatContent: { paddingBottom: Spacing.md },
  emptyCard: { padding: Spacing.lg },
  empty: { color: Colors.textSecondary, textAlign: "center" },
  bubble: { padding: Spacing.md, marginBottom: Spacing.sm, maxWidth: "85%" },
  userBubble: { alignSelf: "flex-end" },
  aiBubble: { alignSelf: "flex-start" },
  bubbleText: { color: Colors.text, lineHeight: 20 },
  inputRow: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  input: {
    flex: 1, backgroundColor: Colors.cardElevated, borderRadius: Radius.md, padding: Spacing.md,
    color: Colors.text, borderWidth: 1, borderColor: Colors.border, maxHeight: 100,
  },
  sendBtn: { backgroundColor: Colors.accent, padding: Spacing.md, borderRadius: Radius.md },
  sendText: { color: Colors.bg, fontWeight: "700" },
});
