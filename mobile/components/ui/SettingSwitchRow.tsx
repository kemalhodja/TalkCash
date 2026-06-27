import { Switch } from "react-native";
import { Colors } from "@/constants/theme";
import { ListRow } from "./ListRow";

type Props = {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

export function SettingSwitchRow({ label, value, onValueChange }: Props) {
  return (
    <ListRow
      title={label}
      trailing={
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ true: Colors.accent }}
          accessibilityLabel={label}
        />
      }
    />
  );
}
