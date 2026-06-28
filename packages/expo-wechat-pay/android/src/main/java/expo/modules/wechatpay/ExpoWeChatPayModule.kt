package expo.modules.wechatpay

import android.content.Intent
import com.tencent.mm.opensdk.modelbase.BaseReq
import com.tencent.mm.opensdk.modelbase.BaseResp
import com.tencent.mm.opensdk.modelpay.PayReq
import com.tencent.mm.opensdk.modelpay.PayResp
import com.tencent.mm.opensdk.openapi.IWXAPI
import com.tencent.mm.opensdk.openapi.IWXAPIEventHandler
import com.tencent.mm.opensdk.openapi.WXAPIFactory
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class WeChatAppPayPayload : Record {
  @Field val appId: String = ""
  @Field val partnerId: String = ""
  @Field val prepayId: String = ""
  @Field val packageValue: String = "Sign=WXPay"
  @Field val nonceStr: String = ""
  @Field val timestamp: String = ""
  @Field val sign: String = ""
}

class WeChatPayOptions : Record {
  @Field val appId: String = ""
  @Field val universalLink: String? = null
  @Field val payload: WeChatAppPayPayload = WeChatAppPayPayload()
}

class ExpoWeChatPayModule : Module(), IWXAPIEventHandler {
  companion object {
    private var current: ExpoWeChatPayModule? = null
    @JvmStatic fun handleIntent(intent: Intent) { current?.api?.handleIntent(intent, current) }
  }
  private var api: IWXAPI? = null
  private var appId: String? = null
  private var pendingPayment: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("ExpoWeChatPay")
    OnCreate { current = this@ExpoWeChatPayModule }
    OnDestroy {
      rejectPending("ERR_MODULE_DESTROYED", "The WeChat Pay module was destroyed.")
      if (current === this@ExpoWeChatPayModule) current = null
      api = null
    }
    AsyncFunction("isInstalled") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      context.packageManager.getLaunchIntentForPackage("com.tencent.mm") != null
    }
    AsyncFunction("pay") { options: WeChatPayOptions, promise: Promise ->
      if (pendingPayment != null) {
        promise.reject("ERR_PAYMENT_IN_PROGRESS", "Another WeChat payment is already active.", null)
        return@AsyncFunction
      }
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("ERR_NO_ACTIVITY", "The React Native context is unavailable.", null)
        return@AsyncFunction
      }
      if (api == null || appId != options.appId) {
        api = WXAPIFactory.createWXAPI(context, options.appId, true)
        if (api?.registerApp(options.appId) != true) {
          api = null
          promise.reject("ERR_REGISTRATION_FAILED", "The WeChat SDK rejected app registration.", null)
          return@AsyncFunction
        }
        appId = options.appId
      }
      if (api?.isWXAppInstalled != true) {
        promise.reject("ERR_WECHAT_NOT_INSTALLED", "WeChat is not installed.", null)
        return@AsyncFunction
      }
      val payload = options.payload
      val request = PayReq().apply {
        appId = payload.appId
        partnerId = payload.partnerId
        prepayId = payload.prepayId
        packageValue = payload.packageValue
        nonceStr = payload.nonceStr
        timeStamp = payload.timestamp
        sign = payload.sign
      }
      pendingPayment = promise
      if (api?.sendReq(request) != true) rejectPending("ERR_REQUEST_NOT_SENT", "WeChat did not accept the payment request.")
    }
  }
  override fun onReq(request: BaseReq?) = Unit
  override fun onResp(response: BaseResp?) {
    val payment = response as? PayResp ?: return
    val promise = pendingPayment ?: return
    pendingPayment = null
    promise.resolve(mapOf(
      "errorCode" to payment.errCode,
      "errorMessage" to payment.errStr,
      "returnKey" to payment.returnKey,
      "cancelled" to (payment.errCode == BaseResp.ErrCode.ERR_USER_CANCEL)
    ))
  }
  private fun rejectPending(code: String, message: String) {
    val promise = pendingPayment ?: return
    pendingPayment = null
    promise.reject(code, message, null)
  }
}
