import { GoogleGenAI } from "@google/genai";
import type { FormData } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function generateLessonPlan(formData: FormData): Promise<string> {
  const prompt = `
    Hãy soạn một giáo án hoàn chỉnh cho môn Tin học THCS theo mẫu và các thông tin dưới đây. Trình bày toàn bộ bằng tiếng Việt, sử dụng định dạng Markdown.

    **THÔNG TIN CƠ BẢN**
    - **Trường:** ${formData.ten_truong}
    - **Tổ chuyên môn:** ${formData.to_chuyen_mon}
    - **Giáo viên soạn:** ${formData.ten_giao_vien}
    - **Môn học:** ${formData.mon_hoc}
    - **Lớp:** ${formData.lop}
    - **Bộ sách:** ${formData.bo_sach}
    - **Tên bài học:** ${formData.ten_bai}
    - **Chuẩn soạn giáo án:** ${formData.chuan_thong_tu}
    
    ---

    **YÊU CẦU ĐỊNH DẠNG GIÁO ÁN (RẤT QUAN TRỌNG):**
    Hãy tuân thủ nghiêm ngặt cấu trúc và định dạng sau đây.

    **PHẦN ĐẦU (HEADER):**
    Sử dụng bảng Markdown 2 cột để tạo header:
    | Trường THCS ${formData.ten_truong} <br> Tổ ${formData.to_chuyen_mon} | Họ và tên giáo viên: <br> ${formData.ten_giao_vien} |
    | :--- | :--- |
    
    **TÊN BÀI DẠY (TITLE):**
    - Căn giữa, IN HOA toàn bộ.
    - Định dạng:
    # TÊN BÀI DẠY:
    # ${formData.ten_bai.toUpperCase()}
    ## Môn học: ${formData.mon_hoc} | Lớp: ${formData.lop}
    ## Thời gian thực hiện: 1 tiết

    ---
    **NỘI DUNG CHI TIẾT:**
    Sử dụng các đề mục La Mã (I, II, III, IV, V) cho các phần chính.

    **I. MỤC TIÊU**
    (Dựa trên "Yêu cầu cần đạt" người dùng nhập, hãy phân tích và viết chi tiết thành 3 mục nhỏ):
    **1. Về kiến thức:**
       - (Gạch đầu dòng các kiến thức học sinh cần nắm)
    **2. Về năng lực:**
       - **Năng lực chung:** (Ghi rõ các năng lực chung như tự chủ và tự học, giao tiếp và hợp tác, giải quyết vấn đề và sáng tạo)
       - **Năng lực tin học:** (Ghi rõ các năng lực đặc thù của môn học)
    **3. Về phẩm chất:**
       - (Gạch đầu dòng các phẩm chất cần hình thành như chăm chỉ, trách nhiệm, trung thực)

    **II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU**
    **1. Giáo viên:** (Liệt kê các thiết bị, tài liệu tham khảo, phần mềm cần thiết)
    **2. Học sinh:** (Liệt kê đồ dùng học tập, SGK, nhiệm vụ cần chuẩn bị trước)

    **III. TIẾN TRÌNH DẠY HỌC**
    (Tập trung soạn chi tiết phần **"${formData.hoat_dong}"** theo yêu cầu của người dùng. Nếu là "Toàn bộ tiến trình", hãy soạn đầy đủ cả 4 hoạt động).

    **Mỗi hoạt động phải có cấu trúc:**
    ### **[TÊN HOẠT ĐỘNG, VÍ DỤ: 1. HOẠT ĐỘNG MỞ ĐẦU (KHỞI ĐỘNG)]**
    **a) Mục tiêu:** (Nêu rõ mục tiêu của hoạt động)
    **b) Nội dung:** (Mô tả nội dung chính, câu hỏi, bài tập...)
    **c) Sản phẩm:** (Mô tả sản phẩm học tập học sinh cần hoàn thành)
    **d) Tổ chức thực hiện:**
    (Phần này trình bày dưới dạng bảng Markdown 2 cột như sau. Sử dụng thẻ <br> để xuống dòng trong một ô. In đậm các đề mục nhỏ).

    | Hoạt động của GV và HS | Nội dung/Sản phẩm dự kiến |
    | :--- | :--- |
    | **1. Giao nhiệm vụ học tập** <br> (Mô tả hoạt động của GV: nêu câu hỏi, yêu cầu...) | **Gợi ý đáp án / Kiến thức cần nhớ:** <br> (Trình bày nội dung, đáp án, hoặc kiến thức cốt lõi tương ứng với hoạt động của GV) |
    | **2. Thực hiện nhiệm vụ** <br> (Mô tả hoạt động của HS: suy nghĩ, thảo luận, làm bài...) | (Kết quả làm việc, thảo luận của HS) |
    | **3. Báo cáo, thảo luận** <br> (Mô tả hoạt động của GV và HS: mời HS trình bày, nhận xét...) | (Phần trình bày của HS, nhận xét của các bạn và GV) |
    | **4. Kết luận, nhận định** <br> (Mô tả hoạt động của GV: chốt lại kiến thức, chuyển giao nhiệm vụ mới...) | (Kiến thức trọng tâm được rút ra) |

    **IV. HƯỚNG DẪN HỌC SINH TỰ HỌC**
    **a) Hướng dẫn học bài cũ:**
    **b) Hướng dẫn chuẩn bị bài mới:**

    **V. RÚT KINH NGHIỆM**
    (Để trống phần này).

    ---
    **ĐẦU VÀO CỦA NGƯỜI DÙNG:**
    - **Yêu cầu cần đạt / Mục tiêu bài học:**
      \`\`\`
      ${formData.muc_tieu}
      \`\`\`
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating lesson plan:", error);
    throw new Error("Không thể tạo giáo án. Vui lòng thử lại.");
  }
}
