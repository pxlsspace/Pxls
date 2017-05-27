package space.pxls.server

import space.pxls.auth.AuthService

data class CanvasInfo (
        val width: Int,
        val height: Int,
        val palette: List<String>,
        val captchaKey: String,
        val heatmapCooldown: Int,
        val authServices: Map<String, AuthService>
)

data class SignInResponse(val url: String)

data class SignUpResponse(val token: String)

data class AuthResponse(val token: String, val signup: Boolean)

data class Error(val error: String, val message: String)