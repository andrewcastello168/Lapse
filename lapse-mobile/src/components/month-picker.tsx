import { useState } from "react";
import { View } from "react-native";
import { Text } from "./typography";
import { BottomSheet } from "./bottom-sheet";
import { Button } from "./ui";
import { SelectionRow } from "./selection-row";
import { useThemeColors } from "@/context/preferences";
export function MonthPicker({
  value,
  onChange,
  onClose,
}: {
  value: Date;
  onChange: (date: Date) => void;
  onClose: () => void;
}) {
  const c = useThemeColors();
  const [year, setYear] = useState(value.getFullYear());
  const [choosingYear, setChoosingYear] = useState(false);
  const [startYear, setStartYear] = useState(Math.floor(year / 20) * 20);
  return (
    <BottomSheet visible onClose={onClose}>
      <Text style={{ color: c.text, fontSize: 20, fontWeight: "600" }}>
        Choose month and year
      </Text>
      <Button
        title={String(year)}
        variant="secondary"
        onPress={() => setChoosingYear(!choosingYear)}
      />
      {choosingYear ? (
        <>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button
                title="Earlier years"
                variant="secondary"
                disabled={startYear <= 1}
                onPress={() => setStartYear(Math.max(1, startYear - 20))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Later years"
                variant="secondary"
                disabled={startYear >= 9980}
                onPress={() => setStartYear(Math.min(9980, startYear + 20))}
              />
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {Array.from({ length: 20 }, (_, n) => startYear + n)
              .filter((n) => n >= 1 && n <= 9998)
              .map((n) => (
                <View key={n} style={{ width: "25%", padding: 3 }}>
                  <Button
                    title={String(n)}
                    variant={n === year ? "primary" : "secondary"}
                    onPress={() => {
                      setYear(n);
                      setChoosingYear(false);
                    }}
                  />
                </View>
              ))}
          </View>
        </>
      ) : (
        Array.from({ length: 12 }, (_, n) => (
          <SelectionRow
            key={n}
            label={new Date(2000, n, 1).toLocaleDateString("en", {
              month: "long",
            })}
            selected={value.getFullYear() === year && value.getMonth() === n}
            onPress={() => {
              const next = new Date(value);
              next.setFullYear(year, n, 1);
              onChange(next);
              onClose();
            }}
          />
        ))
      )}
      <Button title="Cancel" variant="secondary" onPress={onClose} />
    </BottomSheet>
  );
}
