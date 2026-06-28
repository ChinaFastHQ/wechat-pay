import { useMemo } from "react";
import { Button, Platform, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { createExpoWeChatPay } from "@chinafast/expo-wechat-pay";
import { useWeChatPay } from "@chinafast/expo-wechat-pay/react";

const appId = process.env.EXPO_PUBLIC_WECHAT_APP_ID || "wx-development-placeholder";
const universalLink =
  process.env.EXPO_PUBLIC_WECHAT_UNIVERSAL_LINK || "https://example.com/wechat/";
const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === "android" ? "http://10.0.2.2:4000" : "http://localhost:4000");

export default function App() {
  const payments = useMemo(() => createExpoWeChatPay({ appId, universalLink, apiBaseUrl }), []);
  const { pay, loading, result, error, status } = useWeChatPay(payments);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>WeChat App Pay</Text>
        <Text style={styles.copy}>
          Creates an order on the Express example server and opens the native WeChat payment sheet.
        </Text>
        <View style={styles.actions}>
          <Button
            title={loading ? "Opening WeChat…" : "Buy coffee · ¥3.00"}
            disabled={loading}
            onPress={() => pay({ productId: "coffee" })}
          />
        </View>
        {error ? (
          <Text style={styles.error}>
            {error.code}: {error.message}
          </Text>
        ) : null}
        <Text style={styles.heading}>SDK result</Text>
        <Text selectable style={styles.code}>
          {JSON.stringify(result ?? null, null, 2)}
        </Text>
        <Text style={styles.heading}>Server status</Text>
        <Text selectable style={styles.code}>
          {JSON.stringify(status ?? null, null, 2)}
        </Text>
        <Text style={styles.note}>
          A native success callback is not proof of payment. The SDK polls the server automatically;
          fulfil only after the server reports paid or processes a verified webhook.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f4f7f5" },
  content: { padding: 24, gap: 14 },
  title: { fontSize: 30, fontWeight: "700", color: "#10231a" },
  copy: { fontSize: 16, lineHeight: 23, color: "#40554a" },
  actions: { gap: 10 },
  heading: { marginTop: 10, fontSize: 17, fontWeight: "700" },
  code: { padding: 14, borderRadius: 8, backgroundColor: "#fff", color: "#183a29" },
  note: { color: "#5e6d65", lineHeight: 20 },
  error: { color: "#b42318" },
});
