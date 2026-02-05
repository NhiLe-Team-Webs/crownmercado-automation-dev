from .value_objects import TimestampRange

class SilenceRule:
    """Domain Service: Quy tắc detect silence (>1.5s lặng -> cắt)"""
    
    @staticmethod
    def get_silence_ranges(audio_metadata: dict) -> list[TimestampRange]:
        # Logic tính toán thuần túy dựa trên quy tắc nghiệp vụ
        return []
