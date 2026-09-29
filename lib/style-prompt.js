// The house style for every print: the original minimal paper-and-acrylic prompt, adjusted to draw one or two
// simple objects (no scenes, few details, medium size), inked like a hand-pulled mini print in the print's 1-3
// palette inks with the white paper showing through, on a transparent
// background (the card on the page is the paper, and lib/separate.js splits the inks into layers).
// Changing this? Bump STYLE_VERSION in lib/store.js so every city is redrawn in the new style.

export function printPrompt(subjectZh, inks) {
  const n = inks.length;
  return `你是一名擅长极简插画、纸张媒介、丙烯色块绘画与视觉提炼的封面插画师。根据物体进行再创作，生成极简纸感手绘封面插图。
画面只画一个主要物体（最多两个），不画场景、不画环境、不画人群。提取物体最具识别性的轮廓、姿态和一个会心一笑的小细节，高度提炼并删减复杂细节，只保留最关键的视觉特征，形状简单、概括、大方。不要写实复刻照片，也不要简单转成线稿，而是用纤细、轻微不稳定的手绘线条和少量明确的丙烯平涂色块重新表达，让人一眼能识别原始主题。物体大小适中、居中，约占画面宽度的一半，四周留有适度空白。背景完全透明，不要任何环境或背景元素。
像一张手工拓印的迷你版画（凸版或丝网印刷）：只使用以下 ${n} 种油墨颜色：${inks.join("、")}，大部分画面只用一种颜色完成，其余颜色只作少量点缀。纸张的白色从画面中透出，作为高光、刻痕和留白的细节，油墨不必铺满，墨色略有不均匀、轻微斑驳的手工拓印感。不要黑色描边，线条使用画面中最深的那种油墨颜色。每种颜色都是完整的平涂色块，不要混色、不要渐变、不要叠色。整体可爱、柔和、有温度，像独立小店里的手作版画和儿童绘本插图，高度提炼、高识别度、安静、轻松、诗意而高级。
负面提示词：波普艺术感、霓虹色、荧光色、黑色粗描边、颜色过多过艳、画面铺满颜色、写实摄影感、照片复刻、复杂细节、完整场景、多个物体堆砌、人物群像、背景环境、画面过满、细碎的小装饰、商业卡通感、电商感、模板感、3D 渲染感、光滑数字插画感、AI 式精致堆砌感、厚重油画感、水彩晕染、彩铅质感、蜡笔质感、纯线稿、只有勾线没有色块、颜色太轻太虚、颜色浑浊灰暗、使用上述以外的颜色、色彩超过 ${n} 种、过度装饰、复杂透视、密集阴影、精细排线、过度拟真、过度可爱化。

主体：${subjectZh}

画面要求：竖版比例；主体位于画面正中略偏上，下方留出一段空白；画面中不要出现任何文字、字母、数字或签名；背景完全透明，不要纸张、不要底色、不要纸纹、不要边框、不要阴影或桌面。`;
}
