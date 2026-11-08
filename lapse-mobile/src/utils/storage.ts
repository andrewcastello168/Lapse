import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { supabase, storageBucket } from "@/services/supabase";
import type { AuthSession } from "@/types/models";

const sessionKey = "lapse.auth.session";

export function storageUrl(path?: string | null) {
    if (!path) {
        return undefined;
    }
    const normalized = path
        .replace(/^\/+/, "")
        .replace(/^master-categories-images\//, "master-categories/")
        .replace(/^master-items-images\//, "master-items/");
    return supabase.storage.from(storageBucket).getPublicUrl(normalized).data
        .publicUrl;
}

export async function readSession(): Promise<AuthSession | null> {
    try {
        if (Platform.OS === "web") {
            const value = globalThis.localStorage?.getItem(sessionKey);
            return value ? (JSON.parse(value) as AuthSession) : null;
        }
        const value = await SecureStore.getItemAsync(sessionKey);
        return value ? (JSON.parse(value) as AuthSession) : null;
    } catch {
        return null;
    }
}

export async function writeSession(session: AuthSession): Promise<void> {
    if (Platform.OS === "web") {
        globalThis.localStorage?.setItem(sessionKey, JSON.stringify(session));
        return;
    }
    await SecureStore.setItemAsync(sessionKey, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
    if (Platform.OS === "web") {
        globalThis.localStorage?.removeItem(sessionKey);
        return;
    }
    await SecureStore.deleteItemAsync(sessionKey);
}
