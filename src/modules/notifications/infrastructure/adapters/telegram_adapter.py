import asyncio
import structlog
from telegram import Bot
from src.shared.config.settings import settings

logger = structlog.get_logger()

class TelegramAdapter:
    """
    Adapter để gửi thông báo qua Telegram Bot.
    Sử dụng python-telegram-bot.
    """

    def __init__(self):
        self.bot_token = settings.TELEGRAM_BOT_TOKEN
        self.chat_id = settings.TELEGRAM_CHAT_ID

    async def send_message(self, message: str) -> bool:
        """
        Gửi tin nhắn text tới CHAT_ID được cấu hình.
        Hỗ trợ HTML parse mode.
        """
        if not self.bot_token or not self.chat_id:
            logger.warning("TelegramAdapter: Thiếu BOT_TOKEN hoặc CHAT_ID, bỏ qua thông báo.")
            return False

        try:
            bot = Bot(token=self.bot_token)
            await bot.send_message(chat_id=self.chat_id, text=message, parse_mode="HTML")
            logger.info("TelegramAdapter: Đã gửi thông báo thành công.")
            return True
        except Exception as e:
            logger.error("TelegramAdapter: Lỗi khi gửi tin nhắn", error=str(e))
            return False

    async def send_video_link(self, video_id: str, file_name: str, presigned_url: str) -> bool:
        """
        Tạo template tin nhắn đẹp mắt cho video đã render xong và gửi đi.
        """
        msg = (
            f"🎉 <b>Render Hoàn Tất!</b>\n\n"
            f"📹 <b>Video ID:</b> <code>{video_id}</code>\n"
            f"📁 <b>Tên gốc:</b> {file_name}\n\n"
            f"📥 <a href='{presigned_url}'><b>Tải Video Tại Đây (Hạn 1 ngày)</b></a>\n\n"
            f"<i>Powered by One Click Video & AWS Lambda 🚀</i>"
        )
        return await self.send_message(msg)
