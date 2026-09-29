// The house style for every print: the original minimal paper-and-acrylic prompt, word for word, with three
// small changes for the printing effect (marked below): the 3–4 inks come from the print's set and must be
// vivid; the background is transparent (the card on the page is the paper, and lib/separate.js splits the
// inks into layers); the card layout rules.
// Changing this? Bump STYLE_VERSION in lib/store.js so every city is redrawn in the new style.

export function printPrompt(subjectZh, inks) {
  const n = inks.length;
  return `你是一名擅长极简插画、纸张媒介、丙烯色块绘画与视觉提炼的封面插画师。根据物体进行再创作，生成极简纸感手绘封面插图。
提取最具识别性的主体、轮廓、姿态、动作、空间关系与叙事关系，高度提炼并删减复杂细节，只保留最关键的视觉特征。不要写实复刻照片，也不要简单转成线稿，而是用纤细、轻微不稳定的手绘线条和少量明确的丙烯平涂色块重新表达，让人一眼能识别原始主题。主体应小而集中，只占纸张约 10%–20%，四周保留大面积留白。背景完全透明，仅用极少量线条或色面暗示环境。
只使用以下 ${n} 种鲜艳、饱和、干净的颜色：${inks.join("、")}。每种颜色都是完整的平涂色块，不要混色、不要渐变，颜色要明亮纯净，不要浑浊、灰暗或发脏。色块应鲜明、完整、克制，具有手工丙烯平涂感，保留涂抹痕迹和轻微不规则边缘。线条负责提示结构，色块负责建立主体。整体具有艺术书封、独立出版物和儿童绘本式设计感，呈现小主体、大留白、强提炼、高识别度、安静、童趣、轻松、诗意而高级的视觉气质。
负面提示词：写实摄影感、照片复刻、复杂细节、完整背景、画面过满、主体过大、商业卡通感、电商感、模板感、3D 渲染感、光滑数字插画感、AI 式精致堆砌感、厚重油画感、水彩晕染、彩铅质感、蜡笔质感、纯线稿、只有勾线没有色块、颜色太轻太虚、颜色浑浊灰暗、色彩超过 ${n} 种、过度装饰、复杂透视、密集阴影、精细排线、过度拟真、过度可爱化。

主体：${subjectZh}

画面要求：竖版比例；主体位于画面正中略偏上，下方留出一段空白；画面中不要出现任何文字、字母、数字或签名；背景完全透明，不要纸张、不要底色、不要纸纹、不要边框、不要阴影或桌面。`;
}
