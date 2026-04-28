
import { GoogleGenAI } from "@google/genai";
import { RefineMode, ScriptSection } from "../types";

// --- HELPERS ---

const cleanJson = (text: string) => {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '');
  else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```/, '').replace(/```$/, '');
  return cleaned.trim();
};

const isQuotaError = (error: any): boolean => {
  if (!error) return false;
  const code = error.status || error.code || error.statusCode;
  if (code === 429 || code === 'RESOURCE_EXHAUSTED') return true;
  const msg = (error.message || JSON.stringify(error)).toLowerCase();
  return (msg.includes('429') || msg.includes('quota') || msg.includes('rate limit'));
};

async function generateWithFallback(
  contents: string,
  systemInstruction: string,
  primaryModel: string = 'gemini-2.5-flash-lite',
  configOverrides: any = {}
): Promise<string> {
  if (!process.env.API_KEY) throw new Error("API Key chưa được cấu hình.");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const baseConfig = {
    systemInstruction,
    temperature: 0.7,
    ...configOverrides
  };

  const callApi = async (model: string, isFlash: boolean) => {
    const specificConfig = { ...baseConfig };
    if (!isFlash && model.includes('pro')) {
       specificConfig.maxOutputTokens = 65536; 
       specificConfig.thinkingConfig = { thinkingBudget: 4096 }; 
    } else {
       specificConfig.maxOutputTokens = 8192; 
    }

    try {
      const result = await ai.models.generateContent({
        model: model,
        contents: contents,
        config: specificConfig
      });
      return result.text || "";
    } catch (e) {
      throw e;
    }
  };

  try {
    return await callApi(primaryModel, false);
  } catch (err) {
    if (isQuotaError(err)) {
        return await callApi('gemini-2.5-flash-lite', true);
    }
    throw err;
  }
}

const getSystemInstruction = (mode: RefineMode, previousContext: string = ""): string => {
  const DIALOGUE_ONLY_RULES = `
  === QUY TẮC PHÂN VAI RADIO NGHIÊM NGẶT ===
  1. MC (DẪN CHUYỆN): CHỈ chào hỏi, thấu cảm, tóm tắt ý thính giả và ĐẶT CÂU HỎI. TUYỆT ĐỐI KHÔNG ĐƯỢC TƯ VẤN Y KHOA.
  2. CHUYÊN GIA/BÁC SĨ (TƯ VẤN): Là người duy nhất được quyền đưa ra giải pháp, lời khuyên và phân tích bệnh lý.
  3. CHỈ VIẾT LỜI THOẠI: Không có lời dẫn, không bối cảnh.
  4. CẤM CHỈ DẪN SÂN KHẤU: Không dùng ngoặc đơn như (Cười), (Nói khẽ)... Xóa bỏ hoàn toàn!
  5. KHÔNG TIÊU ĐỀ: Không ghi "Phần 1", "Phần 2".
  `;

  switch (mode) {
    case RefineMode.HEALTH_SCRIPT:
      return `BẠN LÀ BIÊN KỊCH RADIO SỨC KHỎE. ${DIALOGUE_ONLY_RULES}`;
    default: return `Biên tập viên kịch bản. ${DIALOGUE_ONLY_RULES}`;
  }
};

export const generateScriptOutline = async (
  prompt: string,
  targetChars: number
): Promise<ScriptSection[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const estimatedParts = Math.max(3, Math.ceil(targetChars / 4500));
  const charsPerPart = Math.floor(targetChars / estimatedParts);

  const systemPrompt = `
    DỰ KIẾN DÀN Ý KỊCH BẢN RADIO. Tổng ${targetChars} ký tự. Chia làm ${estimatedParts} phần.
    YÊU CẦU DÀN Ý TUẦN TỰ (CẤM LẶP Ý):
    - Phần 1: Mở đầu, MC chào thính giả theo đúng bối cảnh, thính giả nêu vấn đề.
    - Các phần giữa: Đi sâu vào từng khía cạnh, Bác sĩ phân tích, MC hỏi xoáy thêm. KHÔNG CHÀO LẠI.
    - Phần cuối: Lời khuyên chốt hạ của Bác sĩ và MC chào kết.
    JSON: [ { "title": "...", "keyPoints": "...", "estimatedChars": ${charsPerPart} } ]
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
      config: { systemInstruction: systemPrompt, responseMimeType: "application/json" }
    });
    return JSON.parse(cleanJson(response.text || "[]"));
  } catch (error) {
     return [{ title: "Hội thoại chính", keyPoints: "Phát triển đối thoại sâu sắc theo dữ liệu nguồn.", estimatedChars: targetChars }];
  }
};

export const generateScriptSection = async (
  section: ScriptSection,
  fullContextPrompt: string, 
  previousContent: string, 
  partIndex: number,
  totalParts: number,
  fullOutline: ScriptSection[]
): Promise<string> => {
  
  const isFirstPart = partIndex === 0;
  
  const systemPrompt = `
    VIẾT KỊCH BẢN THOẠI RADIO. PHẦN ${partIndex + 1}/${totalParts}.
    
    === QUY TẮC NỐI TIẾP (QUAN TRỌNG NHẤT) ===
    ${!isFirstPart ? 'ĐÂY LÀ PHẦN TIẾP THEO. CẤM CHÀO HỎI LẠI. CẤM GIỚI THIỆU LẠI NHÂN VẬT. CẤM NHẮC LẠI VẤN ĐỀ ĐÃ NÓI. Bắt đầu ngay bằng lời thoại nối tiếp nội dung trước.' : 'ĐÂY LÀ PHẦN MỞ ĐẦU. Thực hiện màn chào hỏi và nêu vấn đề.'}
    
    === PHÂN VAI TUYỆT ĐỐI ===
    1. MC: Dẫn dắt, hỏi thâm nhập, thấu cảm. TUYỆT ĐỐI KHÔNG TƯ VẤN.
    2. BÁC SĨ/CHUYÊN GIA: Duy nhất người này mới được khuyên "Bạn nên...", "Giải pháp là...".
    
    === ĐỊNH DẠNG ===
    - Tên (Vai trò): Lời thoại.
    - CẤM ngoặc đơn chỉ dẫn sân khấu (cười), (khóc)...
    - CẤM ghi "Phần ${partIndex + 1}".

    Nội dung phần này: ${section.title} - ${section.keyPoints}
    Lịch sử cuộc hội thoại trước đó: 
    """
    ${previousContent.slice(-2500)}
    """
  `;

  try {
      return await generateWithFallback(fullContextPrompt, systemPrompt, 'gemini-2.5-flash-lite');
  } catch (error: any) {
      return `[Lỗi biên tập phần ${partIndex + 1}]`;
  }
};

export const finalizeHealthScript = async (
  fullScript: string,
  config: any
): Promise<string> => {
  const systemPrompt = `
    BẠN LÀ TỔNG BIÊN TẬP RADIO CAO CẤP. 
    Nhiệm vụ của bạn là RÀ SOÁT và SỬA LỖI kịch bản Radio sức khỏe bên dưới.

    === LỆNH CẤM QUAN TRỌNG (SỐNG CÒN) ===
    1. TUYỆT ĐỐI CẤM TÓM TẮT: Không được làm ngắn kịch bản. Nếu kịch bản gốc dài, kịch bản sau rà soát PHẢI dài tương đương.
    2. TUYỆT ĐỐI CẤM VIẾT LẠI THEO Ý RIÊNG: Chỉ được sửa những lỗi sai quy tắc dưới đây, giữ nguyên mọi câu thoại hợp lệ khác.
    3. TUYỆT ĐỐI CẤM XÓA NỘI DUNG: Không được lược bỏ bất kỳ ý chính hay đoạn hội thoại nào của thính giả và bác sĩ.

    === QUY TẮC RÀ SOÁT ===
    1. KIỂM TRA PHÂN VAI: MC tuyệt đối không khuyên bảo. Nếu thấy MC khuyên "Bạn hãy...", hãy sửa thành MC hỏi Bác sĩ: "Thưa bác sĩ, trường hợp này có nên làm vậy không?".
    2. KIỂM TRA XƯNG HÔ: Đảm bảo nhân vật gọi nhau đúng tên đã thiết lập (MC: ${config.hostName}, BS: ${config.doctorName}, Thính giả: ${config.callerName}).
    3. KIỂM TRA CÂU CHÀO: Nếu bối cảnh là địa danh, phải giữ câu: "Alo, ${config.callerName} mình đâu ạ?".
    4. LÀM SẠCH TRIỆT ĐỂ: Xóa sạch mọi chỉ dẫn trong ngoặc đơn (Cười), (Nói trầm),...
    5. NHẤT QUÁN: Đảm bảo không có sự lặp lại màn chào hỏi ở giữa kịch bản (do ghép các phần). Nếu thấy câu chào ở giữa, hãy xóa câu chào đó và nối lời thoại.

    ĐẦU RA: Trả về toàn bộ nội dung kịch bản đã được tinh chỉnh, giữ nguyên mọi chi tiết và độ dài ban đầu.
  `;

  try {
      // Sử dụng temperature thấp (0.2) để AI bám sát văn bản gốc nhất có thể, tránh sáng tạo làm mất nội dung.
      return await generateWithFallback(fullScript, systemPrompt, 'gemini-2.5-flash-lite', { temperature: 0.2 });
  } catch (error) {
      console.error("Finalization error:", error);
      return fullScript; 
  }
};

export const refineTranscript = async (
  text: string, 
  mode: RefineMode,
  previousContext: string = "" 
): Promise<string> => {
  const primaryModel = 'gemini-2.5-flash-lite';
  return await generateWithFallback(text, getSystemInstruction(mode, previousContext), primaryModel);
};
