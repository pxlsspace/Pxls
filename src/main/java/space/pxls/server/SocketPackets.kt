package space.pxls.server

data class ClientPlace(val type: String, val x: Int, val y: Int, val color: Int)
data class ClientCaptcha(val token: String)
data class ClientAdminCooldownOverride(val override: Boolean)
data class ClientAdminMessage(val username: String, val message: String)
class ClientShadowBanMe()
class ClientBanMe()
class ClientUndo()

class ServerCaptchaRequired

data class ServerCaptchaStatus(val success: Boolean)

data class ServerPlace(val pixels: Collection<Pixel>) {
    data class Pixel(val x: Int, val y: Int, val color: Int)
}

data class ServerCooldown(val wait: Float)

data class ServerUsers(val count: Int)

data class ServerUserInfo(
        val username: String,
        val role: String,
        val banned: Boolean,
        val banExpiry: Long,
        val ban_reason: String,
        val method: String)

data class ServerCanUndo(val time: Long)

data class ServerAlert(val message: String)

data class ServerStack(val count: Int, val cause: String)

data class ServerACK(val ackFor: String, val x: Int, val y: Int)
