package space.pxls.server

import space.pxls.auth.AuthService

class Notification(val id: Number, val title: String, val body: String, val time: Long, val expiry: Long, val who: String)

data class CanvasInfo (
        val canvasCode: String,
        val width: Int,
        val height: Int,
        val palette: List<String>,
        val captchaKey: String,
        val heatmapCooldown: Int,
        val maxStacked: Int,
        val authServices: Map<String, AuthService>,
        val registrationEnabled: Boolean,
        val chatCharacterLimit: Int
)

data class WhoAmI(
        val username: String,
        val id: Int
)

data class SignInResponse(val url: String)

data class SignUpResponse(val token: String)

data class AuthResponse(val token: String, val signup: Boolean)

data class Error(val error: String, val message: String)

data class Notifications(val notifications: List<Notification>)

class EmptyResponse()
