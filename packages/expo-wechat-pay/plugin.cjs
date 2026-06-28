const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
  withDangerousMod,
  withEntitlementsPlist,
  withInfoPlist,
} = require("@expo/config-plugins");
const { mkdir, writeFile } = require("node:fs/promises");
const path = require("node:path");

function withPlugin(config, options = {}) {
  const appId = options.appId;
  const universalLink = options.universalLink;
  if (options.androidPackageName)
    config.android = { ...config.android, package: options.androidPackageName };
  if (options.iosBundleIdentifier)
    config.ios = { ...config.ios, bundleIdentifier: options.iosBundleIdentifier };
  config = withInfoPlist(config, (next) => {
    const types = next.modResults.CFBundleURLTypes || [];
    if (appId && !types.some((type) => type.CFBundleURLSchemes?.includes(appId))) {
      types.push({ CFBundleURLName: "wechat-pay", CFBundleURLSchemes: [appId] });
    }
    next.modResults.CFBundleURLTypes = types;
    next.modResults.LSApplicationQueriesSchemes = Array.from(
      new Set([
        ...(next.modResults.LSApplicationQueriesSchemes || []),
        "weixin",
        "weixinULAPI",
        "weixinURLParamsAPI",
      ]),
    );
    return next;
  });
  config = withEntitlementsPlist(config, (next) => {
    if (universalLink) {
      try {
        const host = new URL(universalLink).host;
        if (host)
          next.modResults["com.apple.developer.associated-domains"] = Array.from(
            new Set([
              ...(next.modResults["com.apple.developer.associated-domains"] || []),
              `applinks:${host}`,
            ]),
          );
      } catch {}
    }
    return next;
  });
  config = withAndroidManifest(config, (next) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(next.modResults);
    const packageName = options.androidPackageName || next.android?.package;
    application.activity = application.activity || [];
    if (packageName) {
      const name = `${packageName}.wxapi.WXPayEntryActivity`;
      if (!application.activity.some((activity) => activity.$?.["android:name"] === name))
        application.activity.push({
          $: {
            "android:name": name,
            "android:exported": "true",
            "android:launchMode": "singleTask",
            "android:taskAffinity": packageName,
          },
        });
    }
    next.modResults.manifest.queries = next.modResults.manifest.queries || [];
    if (
      !next.modResults.manifest.queries.some((query) =>
        query.package?.some((entry) => entry.$?.["android:name"] === "com.tencent.mm"),
      )
    )
      next.modResults.manifest.queries.push({
        package: [{ $: { "android:name": "com.tencent.mm" } }],
      });
    return next;
  });
  config = withDangerousMod(config, [
    "android",
    async (next) => {
      const packageName = options.androidPackageName || next.android?.package;
      if (!packageName) return next;
      const directory = path.join(
        next.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "java",
        ...packageName.split("."),
        "wxapi",
      );
      await mkdir(directory, { recursive: true });
      const source = `package ${packageName}.wxapi;\n\nimport android.app.Activity;\nimport android.os.Bundle;\nimport expo.modules.wechatpay.ExpoWeChatPayModule;\n\npublic class WXPayEntryActivity extends Activity {\n  @Override protected void onCreate(Bundle state) { super.onCreate(state); ExpoWeChatPayModule.handleIntent(getIntent()); finish(); }\n  @Override protected void onNewIntent(android.content.Intent intent) { super.onNewIntent(intent); setIntent(intent); ExpoWeChatPayModule.handleIntent(intent); finish(); }\n}\n`;
      await writeFile(path.join(directory, "WXPayEntryActivity.java"), source, "utf8");
      return next;
    },
  ]);
  return config;
}

module.exports = createRunOncePlugin(withPlugin, "@chinafast/expo-wechat-pay", "0.1.0");
