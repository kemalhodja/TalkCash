import { useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";

interface Props {
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
}

export function DueDatePicker({ value, onChange, minimumDate }: Props) {
  const { t, locale } = useI18n();
  const [show, setShow] = useState(Platform.OS === "ios");
  const dateLocale = locale === "en" ? "en-US" : "tr-TR";
  const min = minimumDate || new Date();

  const onPickerChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") setShow(false);
    if (date) onChange(date);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t.agenda.selectDueDate}</Text>
      {Platform.OS === "android" && (
        <TouchableOpacity style={styles.dateBtn} onPress={() => setShow(true)}>
          <Text style={styles.dateText}>{value.toLocaleDateString(dateLocale, {
            weekday: "short", year: "numeric", month: "long", day: "numeric",
          })}</Text>
          <Text style={styles.pickHint}>{t.agenda.pickDate}</Text>
        </TouchableOpacity>
      )}
      {(show || Platform.OS === "ios") && (
        <DateTimePicker
          value={value}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          minimumDate={min}
          locale={dateLocale}
          onChange={onPickerChange}
          themeVariant="dark"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.sm },
  label: { color: Colors.textSecondary, marginBottom: Spacing.sm },
  dateBtn: {
    backgroundColor: Colors.card, borderRadius: 10, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  dateText: { color: Colors.text, fontSize: 16, fontWeight: "600" },
  pickHint: { color: Colors.accent, fontSize: 13, marginTop: 4 },
});
