export enum RefineMode {
  CLEAN_VERBATIM = 'CLEAN_VERBATIM', // Giữ nguyên ý, chỉ sửa lỗi ngữ pháp cơ bản
  READABLE = 'READABLE', // Làm mượt câu văn, bỏ từ thừa
  STORY_TELLING = 'STORY_TELLING', // Viết lại theo phong cách kể chuyện (như app 1.5)
  PODCAST_DIALOGUE = 'PODCAST_DIALOGUE', // Phân vai hội thoại 2 người
  REWRITE_COPYRIGHT = 'REWRITE_COPYRIGHT', // Viết lại tránh bản quyền
  EXTEND_SCRIPT = 'EXTEND_SCRIPT', // Tính năng mới: Mở rộng hội thoại có sẵn
  BRAINSTORM = 'BRAINSTORM', // Tính năng mới: Brainstorm ý tưởng chi tiết
  HEALTH_SCRIPT = 'HEALTH_SCRIPT', // Viết kịch bản chi tiết từ ý tưởng đã có
  SUMMARIZE = 'SUMMARIZE', // Tóm tắt nội dung
  BULLET_POINTS = 'BULLET_POINTS' // Chuyển thành gạch đầu dòng
}

export enum HealthTopic {
  GENERAL = 'GENERAL', // Sức khỏe chung
  SEXUAL = 'SEXUAL', // Sức khỏe tình dục
  PSYCHOLOGY = 'PSYCHOLOGY', // Tâm lý
  NUTRITION = 'NUTRITION' // Dinh dưỡng
}

export enum HealthScriptFormat {
  STUDIO_PODCAST = 'STUDIO_PODCAST', // Đối thoại trực tiếp tại trường quay
  HOTLINE_CALL = 'HOTLINE_CALL' // Gọi điện tư vấn trực tuyến
}

export interface ProcessingState {
  isProcessing: boolean;
  error: string | null;
  progressStep?: string; // New: Hiển thị bước hiện tại (VD: Đang viết phần 1/5)
}

export interface TranscriptHistory {
  original: string;
  refined: string;
  mode: RefineMode;
  timestamp: number;
}

export interface StoredADN {
  id: string;
  title: string;
  content: string; // Nội dung đã làm sạch
  originalRaw: string; // Nội dung gốc (để tham chiếu nếu cần)
  mode: RefineMode;
  createdAt: number;
}

export interface GeneratedIdea {
  id: number;
  title: string;
  description: string;
  angle: string; // Góc nhìn khai thác
  style: string; // Phong cách đối thoại (New)
}

// New: Cấu trúc cho một phần trong dàn ý
export interface ScriptSection {
  title: string;
  keyPoints: string;
  estimatedChars: number;
}
