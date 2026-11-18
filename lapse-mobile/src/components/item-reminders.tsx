import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Text } from "./typography";
import { Button } from "./ui";
import { SelectionRow, offsetLabel } from "./selection-row";
import { api } from "@/services/api";
import { usePreferences } from "@/context/preferences";
const keyOf = (v: { mode: string; offsets: number[] }) =>
  JSON.stringify([
    v.mode,
    v.mode === "OVERRIDE" ? [...v.offsets].sort((a, b) => a - b) : [],
  ]);
export function ItemReminders({ id }: { id: string }) {
  const { colors: c } = usePreferences();
  const [value, setValue] = useState({ mode: "INHERIT", offsets: [7, 1, 0] });
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    void api
      .itemNotificationPreferences(id)
      .then((result) => {
        if (!active) return;
        const next = {
          mode: result.mode,
          offsets: result.offsets.length ? result.offsets : [7, 1, 0],
        };
        setValue(next);
        setSaved(keyOf(next));
      })
      .catch(() => {
        if (active)
          setError(
            "Unable to load item reminders. Check your connection and retry.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, retry]);
  const dirty = keyOf(value) !== saved;
  async function save() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await api.saveItemNotificationPreferences(id, value);
      setSaved(keyOf(value));
    } catch {
      setError(
        "Unable to save item reminders. Your choices are kept; please retry.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <View
      style={{
        marginTop: 24,
        paddingTop: 20,
        borderTopWidth: 1,
        borderColor: c.border,
      }}
    >
      <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>
        Item reminders
      </Text>
      {loading ? (
        <ActivityIndicator
          accessibilityLabel="Loading item reminders"
          color={c.accent}
        />
      ) : null}
      {saved ? (
        <>
          {[
            [
              "INHERIT",
              "Use account defaults",
              "Follow your default reminder times.",
            ],
            [
              "OVERRIDE",
              "Choose reminders",
              "Set reminder times just for this item.",
            ],
            [
              "DISABLED",
              "Off for this item",
              "Keep tracking this item without reminders.",
            ],
          ].map(([mode, label, description]) => (
            <SelectionRow
              key={mode}
              label={label}
              description={description}
              selected={value.mode === mode}
              disabled={busy || loading}
              onPress={() => setValue({ ...value, mode })}
            />
          ))}
          {value.mode === "OVERRIDE"
            ? [0, 1, 3, 7, 14, 30].map((n) => (
                <SelectionRow
                  key={n}
                  label={offsetLabel(n)}
                  multiple
                  selected={value.offsets.includes(n)}
                  disabled={busy || loading}
                  onPress={() =>
                    setValue((old) => ({
                      ...old,
                      offsets: old.offsets.includes(n)
                        ? old.offsets.length > 1
                          ? old.offsets.filter((x) => x !== n)
                          : old.offsets
                        : [...old.offsets, n],
                    }))
                  }
                />
              ))
            : null}
          <Button
            title={
              busy
                ? "Saving…"
                : dirty
                  ? "Save item reminders"
                  : "Reminders saved"
            }
            variant="secondary"
            disabled={busy || loading || !dirty}
            onPress={() => void save()}
          />
        </>
      ) : null}
      {error ? (
        <>
          <Text
            accessibilityRole="alert"
            style={{ color: c.danger, marginTop: 12 }}
          >
            {error}
          </Text>
          {!saved ? (
            <Button
              title="Retry"
              variant="secondary"
              disabled={loading}
              onPress={() => {
                setLoading(true);
                setError("");
                setRetry((n) => n + 1);
              }}
            />
          ) : null}
        </>
      ) : null}
    </View>
  );
}
