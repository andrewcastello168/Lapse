import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { Text } from "@/components/typography";
import { Button, Input, Screen } from "@/components/ui";
import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/context/preferences";
import { api } from "@/services/api";
export default function Auth() {
  const {
    mode = "signin",
    token = "",
    passwordChanged = "",
  } = useLocalSearchParams<{
    mode?: string;
    token?: string;
    passwordChanged?: string;
  }>();
  return (
    <AuthForm
      key={mode}
      mode={mode}
      token={token}
      passwordChanged={passwordChanged}
    />
  );
}
function AuthForm({
  mode,
  token,
  passwordChanged,
}: {
  mode: string;
  token: string;
  passwordChanged: string;
}) {
  const c = useThemeColors();
  const { signIn, signUp, signOut, loading, error, clearError } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  const [busy, setBusy] = useState(false);
  const [localError, setError] = useState("");
  const [message, setMessage] = useState(
    passwordChanged === "1"
      ? "Password changed. Sign in again with your new password."
      : "",
  );
  const signup = mode === "signup";
  const forgot = mode === "forgot";
  const reset = mode === "reset";

  async function submit() {
    setError("");
    setMessage("");
    if (!reset && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address");
      return;
    }
    if (!forgot && password.length < 8) {
      setError("Use at least 8 characters for your password");
      return;
    }
    if (signup && !name.trim()) {
      setError("Enter your name");
      return;
    }
    if (reset && password !== confirm) {
      setError("Passwords must match");
      return;
    }
    if (forgot || reset) {
      setBusy(true);
      try {
        const result = forgot
          ? await api.forgotPassword(email.trim())
          : await api.resetPassword(token, password);
        if (forgot) setCooldown(60);
        if (reset) await signOut();
        setMessage(result.message);
        setPassword("");
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Please try again");
      } finally {
        setBusy(false);
      }
      return;
    }
    const success = signup
      ? await signUp(name.trim(), email.trim(), password)
      : await signIn(email.trim(), password);
    if (success) router.replace("/(tabs)");
  }
  return (
    <Screen
      onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      title=" "
    >
      <View
        style={{
          paddingTop: 38,
          paddingBottom: 24,
          flexDirection: "row",
          alignItems: "center",
          gap: 7,
        }}
      >
        <Image
          source={require("@/assets/images/branding/logo-mark.png")}
          style={{ width: 32, height: 32 }}
        />
        <Text
          style={{
            color: c.text,
            fontSize: 27,
            fontWeight: "800",
            letterSpacing: -1,
          }}
        >
          lapse.
        </Text>
      </View>
      <Text
        style={{
          color: c.text,
          fontSize: 29,
          fontWeight: "700",
          letterSpacing: -0.8,
        }}
      >
        {forgot
          ? "Reset password"
          : reset
            ? "Choose a new password"
            : signup
              ? "Create account"
              : "Welcome back"}
      </Text>
      <Text
        style={{
          color: c.muted,
          fontSize: 14,
          lineHeight: 21,
          marginTop: 9,
          marginBottom: 30,
        }}
      >
        {forgot
          ? "Enter your email and we’ll send you a reset link."
          : reset
            ? "Choose a secure password for your account."
            : signup
              ? "Start tracking your important dates."
              : "Sign in to your account"}
      </Text>
      {signup ? (
        <Input
          label="Name"
          value={name}
          onChangeText={setName}
          autoComplete="name"
          maxLength={100}
        />
      ) : null}
      {!reset ? (
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          maxLength={254}
        />
      ) : null}
      {!forgot ? (
        <View>
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            maxLength={128}
            autoComplete={signup || reset ? "new-password" : "current-password"}
            style={{ paddingRight: 52 }}
          />
        </View>
      ) : null}
      {reset ? (
        <Input
          label="Confirm new password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoComplete="new-password"
        />
      ) : null}
      {!signup && !forgot && !reset ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            clearError();
            router.setParams({ mode: "forgot" });
          }}
          style={{
            alignSelf: "flex-end",
            paddingVertical: 12,
            marginBottom: 12,
          }}
        >
          <Text
            style={{ color: c.accentDark, fontSize: 13, fontWeight: "600" }}
          >
            Forgot password?
          </Text>
        </Pressable>
      ) : null}
      {localError || error ? (
        <Text
          accessibilityRole="alert"
          style={{ color: c.danger, marginBottom: 16, lineHeight: 21 }}
        >
          {localError || error}
        </Text>
      ) : null}
      {message ? (
        <View
          style={{
            padding: 18,
            borderRadius: 14,
            backgroundColor: c.accentTint,
            marginBottom: 18,
          }}
        >
          <Text style={{ color: c.accentDark, lineHeight: 22 }}>{message}</Text>
        </View>
      ) : null}
      {message && reset ? (
        <Button
          title="Back to sign in"
          onPress={() => router.setParams({ mode: "signin", token: "" })}
        />
      ) : (
        <Button
          title={
            loading || busy
              ? "Please wait…"
              : forgot
                ? cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : "Send reset link"
                : reset
                  ? "Update password"
                  : signup
                    ? "Create account"
                    : "Sign in"
          }
          disabled={loading || busy || (forgot && cooldown > 0)}
          onPress={() => void submit()}
        />
      )}
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          clearError();
          router.setParams({
            mode: signup || forgot || reset ? "signin" : "signup",
            token: "",
          });
        }}
        style={{ padding: 22, alignItems: "center" }}
      >
        <Text style={{ color: c.muted, fontSize: 13 }}>
          {signup
            ? "Already have an account? "
            : forgot || reset
              ? "Remember your password? "
              : "New to Lapse? "}
          <Text style={{ color: c.accentDark, fontWeight: "700" }}>
            {signup || forgot || reset ? "Sign in" : "Create account"}
          </Text>
        </Text>
      </Pressable>
    </Screen>
  );
}
