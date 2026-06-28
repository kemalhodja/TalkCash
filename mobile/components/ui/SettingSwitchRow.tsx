import { Switch } from "react-native";
import { Colors } from "@/constants/theme";
import { ListRow } from "./ListRow";

type Props = {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  testID?: string;
};

export function SettingSwitchRow({ label, value, onValueChange, testID }: Props) {
  return (
    <ListRow
      title={label}
      trailing={
        <Switch
          testID={testID}
          value={value}
          onValueChange={onValueChange}
          trackColor={{ true: Colors.accent }}
          accessibilityLabel={label}
        />
      }
    />
  );
}
