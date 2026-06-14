import { useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Surface } from "@/components/ui/Surface";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { getDateLocale } from "@/utils/format";

interface Props {
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
}

export function DueDatePicker({ value, onChange, minimumDate }: Props) {
  const { t, locale } = useI18n();
  const [show, setShow] = useState(Platform.OS === "ios");
  const dateLocale = getDateLocale(locale);
  const min = minimumDate || new Date();

  const onPickerChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") setShow(false);
    if (date) onChange(date);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t.agenda.selectDueDate}</Text>
      {Platform.OS === "android" && (
        <TouchableOpacity activeOpacity={0.85} onPress={() => setShow(true)}>
          <Surface variant="elevated" style={styles.dateBtn}>
            <Text style={styles.dateText}>{value.toLocaleDateString(dateLocale, {
              weekday: "short", year: "numeric", month: "long", day: "numeric",
            })}</Text>
            <Text style={styles.pickHint}>{t.agenda.pickDate}</Text>
          </Surface>
        </TouchableOpacity>
      )}
      {(show || Platform.OS === "ios") && (
        <Surface variant="glass" style={styles.pickerWrap}>
          <DateTimePicker
            value={value}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            minimumDate={min}
            locale={dateLocale}
            onChange={onPickerChange}
            themeVariant="dark"
          />
        </Surface>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.sm },
  label: { color: Colors.textMuted, fontSize: 12, fontWeight: "600", marginBottom: Spacing.sm, letterSpacing: 0.5 },
  dateBtn: { padding: Spacing.md },
  pickerWrap: { padding: Spacing.sm, marginTop: Spacing.xs },
  dateText: { color: Colors.text, fontSize: 16, fontWeight: "600" },
  pickHint: { color: Colors.accent, fontSize: 13, marginTop: 4 },
});
