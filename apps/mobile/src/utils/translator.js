export const autoTranslate = async (text, targetLangCode) => {
  // Nếu không có text hoặc là tiếng Việt thì trả về luôn
  if (!text || !targetLangCode || targetLangCode === 'vi') return text;
  
  try {
    // Gọi trực tiếp API Google Translate miễn phí
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=${targetLangCode}&dt=t&q=${encodeURI(text)}`;
    
    const response = await fetch(url);
    const result = await response.json();
    
    // Google trả về mảng, ta cần gộp các mảnh dịch lại
    if (result && result[0]) {
      return result[0].map(item => item[0]).join("");
    }
    return text;
  } catch (error) {
    console.log("Translator Error:", error);
    return text; // Trả về text gốc nếu có lỗi mạng
  }
};