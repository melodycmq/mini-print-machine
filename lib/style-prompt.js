// The house style for every print. Sent to the image model verbatim, followed by one print's subject.
export const STYLE_PROMPT_ZH = `你是一名擅长极简插画、纸张媒介、丙烯色块绘画与视觉提炼的封面插画师。根据物体进行再创作，生成极简纸感手绘封面插图。
提取最具识别性的主体、轮廓、姿态、动作、空间关系与叙事关系，高度提炼并删减复杂细节，只保留最关键的视觉特征。不要写实复刻照片，也不要简单转成线稿，而是用纤细、轻微不稳定的手绘线条和少量明确的丙烯平涂色块重新表达，让人一眼能识别原始主题。主体应小而集中，只占纸张约 10%–20%，四周保留大面积留白。背景以粗糙白纸或浅色纸张为主，带清晰纸张纹理，仅用极少量线条或色面暗示环境。
配色从照片中提取并压缩为不超过 4 种主要颜色。色块应鲜明、完整、克制，具有手工丙烯平涂感，保留纸张颗粒、涂抹痕迹和轻微不规则边缘。线条负责提示结构，色块负责建立主体。文字排版疏朗克制，与留白和插画自然融合。整体具有艺术书封、独立出版物和儿童绘本式设计感，呈现小主体、大留白、强提炼、高识别度、安静、童趣、轻松、诗意而高级的视觉气质。
负面提示词：写实摄影感、照片复刻、复杂细节、完整背景、画面过满、主体过大、商业卡通感、电商感、模板感、3D 渲染感、光滑数字插画感、AI 式精致堆砌感、厚重油画感、水彩晕染、彩铅质感、蜡笔质感、纯线稿、只有勾线没有色块、颜色太轻太虚、色彩超过 4 种、过度装饰、复杂透视、密集阴影、精细排线、过度拟真、过度可爱化。`;

// Layout rules for the vending-machine card: portrait, subject a little above center, no lettering
// (the page writes the location underneath in its own type).
export const CARD_RULES_ZH = `画面要求：竖版比例；主体位于画面正中略偏上，下方留出一段空白；画面中不要出现任何文字、字母、数字或签名；纸张铺满整个画面，不要边框，不要画出纸张的阴影或桌面。`;

export function printPrompt(subjectZh) {
  return `${STYLE_PROMPT_ZH}\n\n主体：${subjectZh}\n\n${CARD_RULES_ZH}`;
}
