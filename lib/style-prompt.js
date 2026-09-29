// The house style for every print: a minimal, freehand (写意) stencil/woodcut print in 3–4 flat spot inks on a
// transparent background. The card on the page supplies the paper; lib/separate.js splits the inks into layers.
// Changing this? Bump STYLE_VERSION in lib/store.js so every city is re-picked and redrawn in the new style.

export function printPrompt(subjectZh, inks) {
  const n = inks.length;
  return `你是一名擅长新版画、浮世绘木刻、孔版印刷与现代海报构成的插画师。根据给定主题进行再创作，生成一幅极简、写意的孔版印刷风格插图，像是刚从印刷机里印出来的一层层专色油墨。

提取主题最具识别度的主体轮廓、姿态、动作、空间关系与叙事关系，以及最让人会心一笑的记忆点。高度提炼，删减复杂细节，不要写实复刻，也不要机械描边或纯线稿。用纤细、轻微不稳定的手绘线条提示结构，用少量明确的平涂色块建立主体，笔意松弛、写意，有呼吸感。主体小而集中，只占画面约 15%–25%，四周保留大量空白。

只使用以下 ${n} 种专色油墨：${inks.join("、")}。每种专色都是均匀的纯色平涂，不要渐变、不要明暗过渡、不要半透明叠色，也不要因叠印混合出新的颜色。最后一种深色专色只用于纤细的结构线条和少量点睛。色块之间保留轻微的错位套印，油墨内部带有细小的颗粒网点、轻微漏墨和不均匀的着墨感，边缘略有手工裁切般的不规则。

背景必须完全透明：不要纸张、不要底色、不要纸纹、不要边框、不要阴影、不要地面或桌面。画面中不要出现任何文字、字母、数字、伪文字、签名或水印。

整体气质像独立出版物封面、艺术展览海报或收藏级视觉研究页：安静、现代、克制、童趣而高级。

负面提示：背景色、纸张纹理、写实摄影感、照片复刻、商业旅游海报、电商模板、3D 渲染、光滑数字插画、渐变、厚重油画感、水彩晕染、彩铅或蜡笔质感、纯线稿、只有勾线没有色块、色彩超过 ${n} 种、画面过满、主体过大、复杂透视、密集阴影、精细排线、廉价卡通、过度可爱化、文字乱码、比例失衡。

主体：${subjectZh}`;
}
