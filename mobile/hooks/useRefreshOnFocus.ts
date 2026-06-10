import { useCallback, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";

export function useRefreshOnFocus(callback: () => void) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useFocusEffect(
    useCallback(() => {
      savedCallback.current();
    }, []),
  );
}
