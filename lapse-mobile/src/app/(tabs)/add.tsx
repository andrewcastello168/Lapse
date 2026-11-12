import { Redirect } from "expo-router";

// The Add tab is an entry point, not a second category picker.
export default function Add() {
    return <Redirect href="/add-flow" />;
}
