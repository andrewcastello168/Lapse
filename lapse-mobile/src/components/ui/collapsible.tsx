import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ChevronDown } from "lucide-react-native";

import { ThemedText } from "../themed-text";

type CollapsibleProps = {
  title: string;
  children: ReactNode;
};

export function Collapsible({ title, children }: CollapsibleProps) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => setOpen((current) => !current)}
        style={styles.header}
      >
        {/* <ThemedText type="defaultSemiBold">{title}</ThemedText> */}
        <ThemedText type="smallBold">{title}</ThemedText>
        <ChevronDown
          size={20}
          color="#829096"
          style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}
        />
      </Pressable>

      {open ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  content: {
    paddingVertical: 8,
    gap: 8,
  },
});
