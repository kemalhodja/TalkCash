import { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";

interface AgendaItem {
  id: string;
  title: string;
  amount: number;
  due_date: string;
  status: string;
  installment?: string | null;
}

interface Props {
  items: AgendaItem[];
  onSelectItem?: (item: AgendaItem) => void;
}

const WEEKDAYS_TR = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];
const WEEKDAYS_EN = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function AgendaCalendar({ items, onSelectItem }: Props) {
  const { t, locale } = useI18n();
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const weekdays = locale === "en" ? WEEKDAYS_EN : WEEKDAYS_TR;

  const { year, month, days, itemsByDay } = useMemo(() => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const firstDow = (d.getDay() + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const grid: (number | null)[] = Array(firstDow).fill(null);
    for (let i = 1; i <= daysInMonth; i++) grid.push(i);

    const byDay: Record<string, AgendaItem[]> = {};
    items.forEach((item) => {
      const key = item.due_date.slice(0, 10);
      byDay[key] = byDay[key] || [];
      byDay[key].push(item);
    });
    return { year: y, month: m, days: grid, itemsByDay: byDay };
  }, [items, monthOffset]);

  const monthLabel = new Date(year, month).toLocaleDateString(locale === "en" ? "en-US" : "tr-TR", {
    month: "long", year: "numeric",
  });

  const selectedItems = selectedDay ? itemsByDay[selectedDay] || [] : [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setMonthOffset((o) => o - 1)}>
          <Text style={styles.nav}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{monthLabel}</Text>
        <TouchableOpacity onPress={() => setMonthOffset((o) => o + 1)}>
          <Text style={styles.nav}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.weekRow}>
        {weekdays.map((w) => (
          <Text key={w} style={styles.weekday}>{w}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {days.map((day, idx) => {
          if (!day) return <View key={`e-${idx}`} style={styles.cell} />;
          const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const hasItems = !!itemsByDay[key]?.length;
          const isSelected = selectedDay === key;
          const isToday = key === new Date().toISOString().slice(0, 10);
          return (
            <TouchableOpacity key={key} style={[styles.cell, isSelected && styles.cellSelected, isToday && styles.cellToday]}
              onPress={() => setSelectedDay(key)}>
              <Text style={[styles.dayNum, isSelected && styles.dayNumSelected]}>{day}</Text>
              {hasItems && <View style={styles.dot} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedItems.length > 0 && (
        <View style={styles.dayList}>
          <Text style={styles.dayListTitle}>{t.agenda.due}</Text>
          {selectedItems.map((item) => (
            <TouchableOpacity key={item.id} style={styles.dayItem} onPress={() => onSelectItem?.(item)}>
              <Text style={styles.dayItemTitle}>{item.title}</Text>
              <Text style={styles.dayItemAmount}>{item.amount?.toLocaleString()} ₺</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.lg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  nav: { color: Colors.accent, fontSize: 28, paddingHorizontal: Spacing.md },
  monthTitle: { color: Colors.text, fontSize: 16, fontWeight: "700" },
  weekRow: { flexDirection: "row", marginBottom: 4 },
  weekday: { flex: 1, textAlign: "center", color: Colors.textMuted, fontSize: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "14.28%", aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  cellSelected: { backgroundColor: "rgba(0,212,170,0.2)", borderRadius: 8 },
  cellToday: { borderWidth: 1, borderColor: Colors.accent, borderRadius: 8 },
  dayNum: { color: Colors.text, fontSize: 14 },
  dayNumSelected: { fontWeight: "700", color: Colors.accent },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.accent, marginTop: 2 },
  dayList: { marginTop: Spacing.md, padding: Spacing.md, backgroundColor: Colors.card, borderRadius: 10 },
  dayListTitle: { color: Colors.textSecondary, marginBottom: Spacing.sm },
  dayItem: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  dayItemTitle: { color: Colors.text },
  dayItemAmount: { color: Colors.accent, fontWeight: "600" },
});
