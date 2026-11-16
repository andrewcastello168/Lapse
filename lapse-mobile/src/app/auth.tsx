import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { Button, Input, Screen } from "@/components/ui";
import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/context/preferences";
import { api } from "@/services/api";
export default function Auth() {
  const { mode = "signin", token = "" } = useLocalSearchParams<{
    mode?: string;
    token?: string;
  }>();
  return <AuthForm key={mode} mode={mode} token={token} />;
}
function AuthForm({ mode, token }: { mode: string; token: string }) {
  const c = useThemeColors();
  const { signIn, signUp, signOut, loading, error, clearError } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setError] = useState("");
  const [message, setMessage] = useState("");
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
    if (forgot || reset) {
      setBusy(true);
      try {
        const result = forgot
          ? await api.forgotPassword(email.trim())
          : await api.resetPassword(token, password);
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
            secureTextEntry={!visible}
            maxLength={128}
            autoComplete={signup || reset ? "new-password" : "current-password"}
            style={{ paddingRight: 52 }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? "Hide password" : "Show password"}
            onPress={() => setVisible(!visible)}
            style={{
              position: "absolute",
              right: 3,
              top: 23,
              width: 46,
              height: 48,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {visible ? (
              <EyeOff size={18} color={c.muted} />
            ) : (
              <Eye size={18} color={c.muted} />
            )}
          </Pressable>
        </View>
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
                ? "Send reset link"
                : reset
                  ? "Update password"
                  : signup
                    ? "Create account"
                    : "Sign in"
          }
          disabled={loading || busy}
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
