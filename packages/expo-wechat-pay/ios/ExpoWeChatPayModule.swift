import ExpoModulesCore
import WechatOpenSDK

struct WeChatAppPayPayload: Record {
  @Field var appId: String = ""
  @Field var partnerId: String = ""
  @Field var prepayId: String = ""
  @Field var `package`: String = "Sign=WXPay"
  @Field var nonceStr: String = ""
  @Field var timestamp: String = ""
  @Field var sign: String = ""
}

struct WeChatPayOptions: Record {
  @Field var appId: String = ""
  @Field var universalLink: String?
  @Field var payload: WeChatAppPayPayload = WeChatAppPayPayload()
}

public final class ExpoWeChatPayModule: Module {
  static weak var current: ExpoWeChatPayModule?
  private var pendingPayment: Promise?

  public func definition() -> ModuleDefinition {
    Name("ExpoWeChatPay")
    OnCreate { Self.current = self }
    OnDestroy {
      self.rejectPending(code: "ERR_MODULE_DESTROYED", message: "The WeChat Pay module was destroyed.")
      if Self.current === self { Self.current = nil }
    }
    AsyncFunction("isInstalled") { WXApi.isWXAppInstalled() }
    AsyncFunction("pay") { (options: WeChatPayOptions, promise: Promise) in
      guard self.pendingPayment == nil else {
        promise.reject("ERR_PAYMENT_IN_PROGRESS", "Another WeChat payment is already active.")
        return
      }
      guard !options.appId.isEmpty else {
        promise.reject("ERR_INVALID_APP_ID", "A WeChat app ID is required.")
        return
      }
      guard WXApi.registerApp(options.appId, universalLink: options.universalLink ?? "") else {
        promise.reject("ERR_REGISTRATION_FAILED", "The WeChat SDK rejected app registration.")
        return
      }
      guard WXApi.isWXAppInstalled() else {
        promise.reject("ERR_WECHAT_NOT_INSTALLED", "WeChat is not installed.")
        return
      }
      guard let timestamp = UInt32(options.payload.timestamp) else {
        promise.reject("ERR_INVALID_PAYLOAD", "timestamp must be an unsigned integer string.")
        return
      }
      let request = PayReq()
      request.partnerId = options.payload.partnerId
      request.prepayId = options.payload.prepayId
      request.package = options.payload.package
      request.nonceStr = options.payload.nonceStr
      request.timeStamp = timestamp
      request.sign = options.payload.sign
      self.pendingPayment = promise
      WXApi.send(request) { accepted in
        if !accepted { self.rejectPending(code: "ERR_REQUEST_NOT_SENT", message: "WeChat did not accept the payment request.") }
      }
    }
  }

  func completePayment(_ response: PayResp) {
    guard let promise = pendingPayment else { return }
    pendingPayment = nil
    promise.resolve([
      "errorCode": response.errCode,
      "errorMessage": response.errStr as Any,
      "returnKey": response.returnKey as Any,
      "cancelled": response.errCode == -2
    ])
  }

  private func rejectPending(code: String, message: String) {
    guard let promise = pendingPayment else { return }
    pendingPayment = nil
    promise.reject(code, message)
  }
}
