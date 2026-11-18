import { api } from "@/services/api";
import { useState } from "react";
import { Linking, Pressable } from "react-native";
import { router } from "expo-router";
import { Text } from "@/components/typography";
import { Button, Input, Screen } from "@/components/ui";
import { usePreferences } from "@/context/preferences";
const articles = [
  [
    "Getting started",
    "Choose Add, select a category, then a catalog item or custom item. Enter a name and configure expiry. Review the API preview before saving. Custom items inherit category artwork. Use Help & tour on any screen to replay its contextual guide.",
  ],
  [
    "Expiry types and NEVER",
    "ONCE needs a calendar date and stays unchanged until you edit or renew it. RECURRING repeats from its original anchor. NEVER has no date, recurrence or reminders. Example: use NEVER for a lifetime membership.",
  ],
  [
    "Automatic and manual renewal",
    "Automatic shows the next scheduled date; it does not verify payment. Manual stays overdue until you confirm validity. Open item details, choose Renew, review old and new dates, and confirm. Late renewal can remain overdue. If another device changed the item, reload before trying again.",
  ],
  [
    "Combined recurrence",
    "Years, months and days combine. Example: 1 year, 1 month, 2 days from 7 July 2026 gives 9 August 2027 then 11 September 2028. Monthly from 31 January clamps to February then returns to 31 March. Never change the anchor to dismiss a reminder.",
  ],
  [
    "Dashboard, status and filters",
    "Overdue is separate from upcoming filters. Due today means zero days remaining. Expiring soon means 1?7 days. Default window is 3 months. All includes no-expiry items. Item counts differ from repeated scheduled occurrences. Search and category filters narrow the item list.",
  ],
  [
    "Calendar and timeline",
    "Calendar shows date-grouped events; timeline groups by month. Requests cover at most one year. Automatic recurrence can show multiple events. Manual dates show actionable validity; future projections are not confirmation.",
  ],
  [
    "Reminders and notification permissions",
    "Allow OS notifications in Settings. Default server offsets are 7 days, 1 day and day-of at 09:00. Set global offsets/time or item-specific inherit, override or disable. Existing single-offset preferences are preserved. Server push needs configured credentials and a native build; local reminders continue until registration succeeds. Hourly delivery is approximate. Two-hour catch-up avoids stale floods. Device power settings and connectivity affect delivery.",
  ],
  [
    "Timezone and travel",
    "Automatic mode detects your device IANA zone without GPS when the app opens or returns to foreground. Choose a city in Settings to override it. Offsets reflect DST, including fractional-hour zones. Calendar dates stay dates; delivery instants are stored in UTC.",
  ],
  [
    "Account and security",
    "Change password using current, new and confirmation fields. All sessions are invalidated; sign in again. Forgot password sends a single-use 30-minute link if the account exists. Check spam, wait 60 seconds before resending, and use only the newest link. Expired, used or invalid links require a new request. Never share passwords or reset links.",
  ],
  [
    "Troubleshooting and offline use",
    "Help is available offline. Item changes need an API connection. If data fails to load, check connectivity and retry. Missing artwork falls back to category then a placeholder. If an inbox item was deleted, return to the item list. On Android use a matching native build after notification configuration changes; Expo Go cannot verify remote push.",
  ],
] as const;
export default function Help() {
  const [search, setSearch] = useState("");
  const [replayMessage, setReplayMessage] = useState("");
  const { colors: c } = usePreferences();
  const support = process.env.EXPO_PUBLIC_SUPPORT_URL;
  return (
    <Screen title="Help & Support" onBack={() => router.back()}>
      <Input
        label="Search offline help"
        value={search}
        onChangeText={setSearch}
      />
      {articles
        .filter((a) => a.join(" ").toLowerCase().includes(search.toLowerCase()))
        .map(([title, body]) => (
          <Pressable
            key={title}
            style={{
              paddingVertical: 18,
              borderBottomWidth: 1,
              borderColor: c.border,
            }}
          >
            <Text style={{ color: c.text, fontSize: 17, fontWeight: "600" }}>
              {title}
            </Text>
            <Text style={{ color: c.muted, lineHeight: 24, marginTop: 8 }}>
              {body}
            </Text>
          </Pressable>
        ))}
      <Button
        title="Replay welcome slides"
        onPress={() => router.push("/?intro=1")}
      />
      <Button
        title="Replay dashboard tour"
        onPress={() => router.push("/(tabs)?tour=replay")}
      />
      <Button
        title="Replay adding items tour"
        onPress={() => router.push("/add-flow?tour=replay")}
      />
      <Button
        title="Replay calendar tour"
        onPress={() => router.push("/(tabs)/calendar?tour=replay")}
      />
      <Button
        title="Replay notification settings tour"
        onPress={() =>
          router.push("/settings?section=notifications&tour=replay")
        }
      />
      <Button
        title="Replay item details and renewal tour"
        onPress={() => {
          void api
            .userItems()
            .then((items) => {
              if (items[0])
                router.push({
                  pathname: "/item/[id]",
                  params: { id: items[0].id, tour: "replay" },
                });
              else
                setReplayMessage(
                  "Add an item first, then replay its details and renewal guide.",
                );
            })
            .catch(() =>
              setReplayMessage(
                "Open a saved item when connected, then choose Help & tour.",
              ),
            );
        }}
      />
      {replayMessage ? (
        <Text style={{ color: c.muted, lineHeight: 22 }}>{replayMessage}</Text>
      ) : null}
      <Text style={{ color: c.muted, lineHeight: 22 }}>
        Use Help & tour on Dashboard, Add, Item details, Calendar or
        Notification settings to replay each guide.
      </Text>
      {support && /^https:\/\//.test(support) ? (
        <Button
          title="Contact support"
          onPress={() => void Linking.openURL(support)}
        />
      ) : (
        <Text style={{ color: c.muted, marginTop: 20 }}>
          Contact support is not configured.
        </Text>
      )}
    </Screen>
  );
}
