import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { EmptyState } from "@/components/ui/EmptyState";
import { InputField } from "@/components/ui/InputField";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ScreenShell } from "@/components/ui/ScreenShell";
import { Surface } from "@/components/ui/Surface";
import { Colors, Spacing } from "@/constants/theme";
import { usePullRefresh } from "@/hooks/usePullRefresh";
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
  const { refreshing, onRefresh } = usePullRefresh(load);

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

  if (loading) return <LoadingScreen />;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenShell scroll={false} ambient="subtle" style={styles.flex}>
        <ScreenHeader title={t.mentor.title} subtitle={t.mentor.subtitle} />

        <ScrollView
          ref={scrollRef}
          style={styles.chat}
          contentContainerStyle={styles.chatContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
          }
        >
          {messages.length === 0 ? (
            <EmptyState message={t.mentor.empty} icon="💬" />
          ) : null}
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
          <InputField
            placeholder={t.mentor.placeholder}
            value={input}
            onChangeText={setInput}
            multiline
            containerStyle={styles.inputWrap}
            style={styles.input}
          />
          <PrimaryButton
            label={sending ? t.mentor.sending : t.mentor.send}
            onPress={send}
            disabled={sending || !input.trim()}
            loading={sending}
            compact
            style={styles.sendBtn}
          />
        </View>
      </ScreenShell>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chat: { flex: 1 },
  chatContent: { paddingBottom: Spacing.md, flexGrow: 1 },
  bubble: { padding: Spacing.md, marginBottom: Spacing.sm, maxWidth: "85%" },
  userBubble: { alignSelf: "flex-end" },
  aiBubble: { alignSelf: "flex-start" },
  bubbleText: { color: Colors.text, lineHeight: 20 },
  inputRow: { flexDirection: "row", gap: Spacing.sm, alignItems: "flex-end", paddingBottom: Spacing.md },
  inputWrap: { flex: 1, marginBottom: 0 },
  input: { maxHeight: 100 },
  sendBtn: { minWidth: 88 },
});
