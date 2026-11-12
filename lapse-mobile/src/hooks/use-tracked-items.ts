import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { api } from "@/services/api";
import type { UserItem } from "@/types/models";
export function useTrackedItems() {
    const [items, setItems] = useState<UserItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const generation = useRef(0);
    const reload = useCallback(() => {
        const request = ++generation.current;
        setLoading(true);
        setError("");
        api.userItems()
            .then((data) => {
                if (generation.current === request) setItems(data);
            })
            .catch((reason: unknown) => {
                if (generation.current === request)
                    setError(
                        reason instanceof Error
                            ? reason.message
                            : "Unable to load items.",
                    );
            })
            .finally(() => {
                if (generation.current === request) setLoading(false);
            });
    }, []);
    useFocusEffect(
        useCallback(() => {
            reload();
            return () => {
                generation.current++;
            };
        }, [reload]),
    );
    return { items, loading, error, reload };
}
