import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { PaywallCard } from "@/components/PaywallCard";
import { ChipPicker } from "@/components/ui/ChipPicker";
import { InputField } from "@/components/ui/InputField";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ScreenShell } from "@/components/ui/ScreenShell";
import { Surface } from "@/components/ui/Surface";
import { TextLink } from "@/components/ui/TextLink";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";
import { getPremiumStatus, hasEntitlement, PremiumStatus, refreshPremiumStatus } from "@/services/premium";

type Invitation = { id: string; email: string; role: string; status: string };

export default function WorkspacesScreen() {
  const { t } = useI18n();
  const [premium, setPremium] = useState<PremiumStatus | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<Record<string, Invitation[]>>({});
  const [name, setName] = useState("");
  const [workspaceType, setWorkspaceType] = useState<"family" | "business">("family");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState<Record<string, string>>({});
  const [inviteRole, setInviteRole] = useState<Record<string, "admin" | "member" | "viewer">>({});
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const typeOptions = [
    { id: "family", label: t.workspaces.typeFamily },
    { id: "business", label: t.workspaces.typeBusiness },
  ];
  const roleOptions = [
    { id: "member", label: t.workspaces.roleMember },
    { id: "admin", label: t.workspaces.roleAdmin },
    { id: "viewer", label: t.workspaces.roleViewer },
  ];

  const loadInvitations = async (workspaces: any[]) => {
    const invMap: Record<string, Invitation[]> = {};
    await Promise.all(
      workspaces
        .filter((w) => w.role === "owner" || w.role === "admin")
        .map(async (w) => {
          invMap[w.id] = await api.getWorkspaceInvitations(w.id);
        }),
    );
    setInvitations(invMap);
  };

  const load = useCallback(async (force = false) => {
    const status = force ? await refreshPremiumStatus() : await getPremiumStatus();
    setPremium(status);
    if (hasEntitlement(status, "shared_workspace")) {
      const workspaces = await api.getWorkspaces();
      setItems(workspaces);
      await loadInvitations(workspaces);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.createWorkspace(name.trim(), workspaceType);
      setName("");
      await load(true);
    } catch (e: any) {
      Alert.alert(t.common.error, e.message || t.common.error);
    } finally {
      setSaving(false);
    }
  };

  const invite = async (workspaceId: string) => {
    const email = (inviteEmail[workspaceId] || "").trim();
    if (!email) return;
    setInvitingId(workspaceId);
    try {
      await api.inviteWorkspaceMember(workspaceId, email, inviteRole[workspaceId] || "member");
      setInviteEmail((prev) => ({ ...prev, [workspaceId]: "" }));
      Alert.alert(t.common.confirm, t.workspaces.inviteSent.replace("{email}", email));
      const fresh = await api.getWorkspaceInvitations(workspaceId);
      setInvitations((prev) => ({ ...prev, [workspaceId]: fresh }));
    } catch (e: any) {
      Alert.alert(t.common.error, e.message || t.common.error);
    } finally {
      setInvitingId(null);
    }
  };

  const cancelInvite = async (workspaceId: string, invitationId: string) => {
    if (cancellingId) return;
    setCancellingId(invitationId);
    try {
      await api.cancelWorkspaceInvitation(workspaceId, invitationId);
      setInvitations((prev) => ({
        ...prev,
        [workspaceId]: (prev[workspaceId] || []).filter((i) => i.id !== invitationId),
      }));
      Alert.alert(t.common.confirm, t.workspaces.inviteCancelled);
    } catch (e: any) {
      Alert.alert(t.common.error, e.message || t.common.error);
    } finally {
      setCancellingId(null);
    }
  };

  if (loading) return <LoadingScreen />;
  const locked = !hasEntitlement(premium, "shared_workspace");

  return (
    <ScreenShell ambient="subtle">
      <ScreenHeader title={t.workspaces.title} subtitle={t.workspaces.subtitle} />
      {locked ? (
        <PaywallCard recommendedPlan="family" onUpgraded={() => load(true)} />
      ) : (
        <>
          <Surface variant="elevated" style={styles.card}>
            <Text style={styles.title}>{t.workspaces.create}</Text>
            <InputField placeholder={t.workspaces.name} value={name} onChangeText={setName} />
            <ChipPicker options={typeOptions} value={workspaceType} onChange={(id) => setWorkspaceType(id as "family" | "business")} />
            <PrimaryButton label={t.common.save} onPress={create} loading={saving} disabled={saving || !name.trim()} />
          </Surface>

          {items.map((item) => (
            <Surface key={item.id} variant="default" style={styles.card}>
              <Text style={styles.title}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.workspace_type} · {item.role} · {t.workspaces.membersCount.replace("{count}", String(item.members_count))}
              </Text>
              {(item.role === "owner" || item.role === "admin") && (
                <>
                  {(invitations[item.id] || []).length > 0 && (
                    <View style={styles.inviteList}>
                      <Text style={styles.inviteLabel}>{t.workspaces.pendingInvites}</Text>
                      {(invitations[item.id] || []).map((inv) => (
                        <View key={inv.id} style={styles.inviteRow}>
                          <Text style={styles.inviteMeta}>
                            {t.workspaces.invitePending.replace("{email}", inv.email).replace("{role}", inv.role)}
                          </Text>
                          <TextLink
                            label={t.workspaces.cancelInvite}
                            onPress={() => cancelInvite(item.id, inv.id)}
                          />
                        </View>
                      ))}
                    </View>
                  )}
                  <View style={styles.inviteBlock}>
                    <Text style={styles.inviteLabel}>{t.workspaces.inviteMember}</Text>
                    <InputField
                      placeholder={t.workspaces.inviteEmail}
                      value={inviteEmail[item.id] || ""}
                      onChangeText={(val) => setInviteEmail((prev) => ({ ...prev, [item.id]: val }))}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    <ChipPicker
                      options={roleOptions}
                      value={inviteRole[item.id] || "member"}
                      onChange={(id) => setInviteRole((prev) => ({ ...prev, [item.id]: id as "admin" | "member" | "viewer" }))}
                    />
                    <PrimaryButton
                      label={t.workspaces.inviteSubmit}
                      onPress={() => invite(item.id)}
                      loading={invitingId === item.id}
                      disabled={invitingId === item.id || !(inviteEmail[item.id] || "").trim()}
                      compact
                    />
                  </View>
                </>
              )}
            </Surface>
          ))}
          {!items.length ? <Text style={styles.empty}>{t.workspaces.empty}</Text> : null}
        </>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.md, marginBottom: Spacing.md },
  title: { color: Colors.text, fontWeight: "800", fontSize: 16, marginBottom: Spacing.sm },
  meta: { color: Colors.textSecondary },
  inviteList: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  inviteBlock: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  inviteLabel: { color: Colors.textMuted, fontSize: 12, fontWeight: "600", marginBottom: Spacing.sm },
  inviteRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.xs },
  inviteMeta: { color: Colors.textSecondary, flex: 1, marginRight: Spacing.sm },
  empty: { color: Colors.textMuted, textAlign: "center", marginTop: Spacing.lg },
});
