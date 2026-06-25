import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { EmptyState } from "@/components/ui/EmptyState";
import { InputField } from "@/components/ui/InputField";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { PaywallCard } from "@/components/PaywallCard";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ScreenShell } from "@/components/ui/ScreenShell";
import { Surface } from "@/components/ui/Surface";
import { Colors, Spacing } from "@/constants/theme";
import { usePullRefresh } from "@/hooks/usePullRefresh";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";
import { getPremiumStatus, hasEntitlement, PremiumStatus, refreshPremiumStatus } from "@/services/premium";

type ChatMsg = { id: string; role: string; content: string; created_at?: string };

export default function MentorScreen() {
  const { t } = useI18n();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [premium, setPremium] = useState<PremiumStatus | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const load = async () => {
    try {
      const [history, status] = await Promise.all([
        api.getChatHistory(),
        getPremiumStatus(),
      ]);
      setMessages(history);
      setPremium(status);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  const { refreshing, onRefresh } = usePullRefresh(load);

  const aiEnt = premium?.entitlements?.ai_coach;
  const aiLocked = premium ? !hasEntitlement(premium, "ai_coach") : false;
  const usageLabel = aiEnt?.limit != null
    ? t.mentor.usage
      .replace("{used}", String(aiEnt.used ?? 0))
      .replace("{limit}", String(aiEnt.limit))
    : null;

  const send = async () => {
    const text = input.trim();
    if (!text || sending || aiLocked) return;
    setSending(true);
    setInput("");
    const optimistic: ChatMsg = { id: `local-${Date.now()}`, role: "user", content: text };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const reply = await api.sendChatMessage(text);
      setMessages((prev) => [...prev.filter((m) => m.id !== optimistic.id), optimistic, reply]);
      setPremium(await refreshPremiumStatus());
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
        <ScreenHeader title={t.mentor.title} subtitle={usageLabel || t.mentor.subtitle} />

        {aiLocked ? (
          <PaywallCard
            title={t.mentor.limitReached}
            message={t.premium.lockedMessage}
            onUpgraded={() => refreshPremiumStatus().then(setPremium)}
          />
        ) : null}

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
            editable={!aiLocked}
          />
          <PrimaryButton
            label={sending ? t.mentor.sending : t.mentor.send}
            onPress={send}
            disabled={sending || !input.trim() || aiLocked}
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
  bubbleText: { color: Colors.text, lineHeight: 21 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: Spacing.sm, paddingTop: Spacing.sm },
  inputWrap: { flex: 1, marginBottom: 0 },
  input: { minHeight: 44, maxHeight: 120 },
  sendBtn: { marginBottom: Spacing.sm },
});
