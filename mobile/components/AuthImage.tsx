import { useEffect, useState } from "react";
import { Image, ImageResizeMode, ImageStyle, StyleProp, StyleSheet, View } from "react-native";
import { resolveMediaUrl } from "@/services/api";

type Props = {
  path?: string | null;
  style?: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
};

export function AuthImage({ path, style, resizeMode = "cover" }: Props) {
  const [source, setSource] = useState<{ uri: string; headers?: Record<string, string> } | null>(null);

  useEffect(() => {
    let active = true;
    if (!path) {
      setSource(null);
      return;
    }
    resolveMediaUrl(path).then((resolved) => {
      if (active) setSource(resolved.uri ? resolved : null);
    });
    return () => { active = false; };
  }, [path]);

  if (!source?.uri) {
    return <View style={[styles.placeholder, style]} />;
  }

  return <Image source={source} style={style} resizeMode={resizeMode} />;
}

const styles = StyleSheet.create({
  placeholder: { backgroundColor: "rgba(255,255,255,0.05)" },
});
