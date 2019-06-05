package space.pxls.server

/* Structs */
data class ChatMessage(/*val messageID: Int, */val author: String, val date: Long, val message_raw: String/*, val message_parsed: String*/)

/* Sent by the client to the server */
data class ClientChatMessage(val message: String)
class ClientChatHistory()

/* Sent by the server to the client(s) */
data class ServerChatMessage(val message: ChatMessage) {
    val type = "chat_message"
}

data class ServerChatHistory(val messages: List<ChatMessage>) {
    val type = "chat_history";
}

data class ServerChatMessageDelete(val id: Int) {
    val type = "message_delete";
}

data class ServerChatCooldown(val diff: Int) {
    val type = "message_cooldown";
}

data class ServerChatBan(val length: Long)
