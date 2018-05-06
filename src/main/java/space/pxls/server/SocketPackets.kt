package space.pxls.server

import space.pxls.auth.AuthService

data class ClientPlace(val type: String, val x: Int, val y: Int, val color: Int)
data class ClientPlaceMaybe(val x: Int, val y: Int, val color: Int)
data class ClientCaptcha(val token: String)
data class ClientAdminCooldownOverride(val override: Boolean)
data class ClientAdminMessage(val username: String, val message: String)
class ClientShadowBanMe()
class ClientBanMe()
class ClientUndo()

class ServerCaptchaRequired {
    val type = "captcha_required"
}

data class ServerCaptchaStatus(val success: Boolean) {
    val type = "captcha_status"
}

data class ServerPlace(val pixels: Collection<Pixel>) {
    val type = "pixel"
    data class Pixel(val x: Int, val y: Int, val color: Int)
}

data class ServerCooldown(val wait: Float) {
    val type = "cooldown"
}

data class ServerUsers(val count: Int) {
    val type = "users"
}

data class ServerUserInfo(
        val username: String,
        val role: String,
        val banned: Boolean,
        val banExpiry: Long,
        val ban_reason: String,
        val method: String) {
    val type = "userinfo"
}

data class ServerCanUndo(val time: Long) {
    val type = "can_undo"
}

data class ServerAlert(val message: String) {
    val type = "alert"
}

data class ServerStack(val count: Int, val cause: String) {
    val type = "stack"
}

data class ServerACK(val ackFor: String, val x: Int, val y: Int) {
    val type="ACK"
}

data class ServerPixels(val count: Int, val cause: String) {
    val type="pixels"
}