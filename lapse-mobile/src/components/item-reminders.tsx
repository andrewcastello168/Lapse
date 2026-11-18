import { useEffect, useState } from "react";
import { View } from "react-native";
import { Text } from "./typography";
import { Button } from "./ui";
import { api } from "@/services/api";
import { usePreferences } from "@/context/preferences";
export function ItemReminders({ id }: { id: string }) {
  const { colors: c } = usePreferences();
  const [mode, setMode] = useState("INHERIT"),
    [offsets, setOffsets] = useState<number[]>([7, 1, 0]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void api
      .itemNotificationPreferences(id)
      .then((value) => {
        if (active) {
          setMode(value.mode);
          if (value.offsets.length) setOffsets(value.offsets);
        }
      })
      .catch(() => {
        if (active)
          setError(
            "Item reminder settings need a connection to the updated server",
          );
      });
    return () => {
      active = false;
    };
  }, [id]);
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await api.saveItemNotificationPreferences(id, { mode, offsets });
    } catch {
      setError("Unable to save item reminder settings. Please retry.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ marginTop: 24 }}>
      <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>
        Item reminders
      </Text>
      {["INHERIT", "OVERRIDE", "DISABLED"].map((value) => (
        <Button
          key={value}
          title={`${mode === value ? "? " : ""}${value === "INHERIT" ? "Use account defaults" : value === "OVERRIDE" ? "Custom offsets" : "Disable for this item"}`}
          variant="secondary"
          onPress={() => setMode(value)}
        />
      ))}
      {mode === "OVERRIDE" ? (
        <View>
          {[0, 1, 3, 7, 14, 30].map((n) => (
            <Button
              key={n}
              title={`${offsets.includes(n) ? "? " : ""}${n === 0 ? "Day of" : n + " days before"}`}
              variant="secondary"
              onPress={() =>
                setOffsets((current) =>
                  current.includes(n)
                    ? current.length > 1
                      ? current.filter((x) => x !== n)
                      : current
                    : [...current, n],
                )
              }
            />
          ))}
        </View>
      ) : null}
      <Button
        title={busy ? "Saving?" : "Save item reminders"}
        disabled={busy}
        onPress={() => void save()}
      />
      {error ? <Text style={{ color: c.danger }}>{error}</Text> : null}
    </View>
  );
}
