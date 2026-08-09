export const LUT_DISPLAY_NAMES = {
  BLUESKETCH: '蓝色刮画',
  BW: '伊尔福 HP5',
  BWHC: '禄来 Retro 80S',
  BWIR: '红外黑白',
  BWLC: '柔和黑白',
  C41: '柯达 C-41 色调',
  CYBERWARM: '赛博暖调',
  EMBER: '余烬暖调',
  FADE: '怀旧褪色',
  FJ200: '富士 C200',
  FJDISP: '富士一次性相机',
  FJEXP: '过期富士 C200',
  FJVIVID: '富士鲜艳',
  GL200: '柯达金 200',
  GLDISP: '柯达金一次性相机',
  GLEXP: '八十年代柯达金 200',
  GLLC: '柯达金 200 柔和版',
  GLVIVID: '柯达金 200 鲜艳版',
  GRNSKETCH: '绿色刮画',
  HBLUE: '深海蓝调',
  INSTCOOL: '冷调拍立得',
  INSTWARM: '暖调拍立得',
  IRCOLOR: '彩色红外',
  LCLOOK: '徕卡纪实',
  NEWSPAPER: '老报纸',
  OLDWEST: '旧西部',
  PINK: '粉红马卡龙',
  PT400: '柯达 Portra 400',
  PT400LC: '柯达 Portra 400 柔和版',
  PURPLE: '紫色洛莫',
  REDSCALE: '红调洛莫',
  REDSKETCH: '红色刮画',
  RETROCINE: '复古电影',
  SABATTIER: '萨巴蒂尔反转',
  THEHOTEL: '布达佩斯饭店',
  VS200: '爱克发 Vista 200',
} as const satisfies Record<string, string>

export const LUT_DISPLAY_NAMES_EN = {
  BLUESKETCH: 'Blue Sketch', BW: 'Ilford HP5', BWHC: 'Rollei Retro 80S', BWIR: 'Infrared B&W', BWLC: 'Soft B&W',
  C41: 'Kodak C-41 Tone', CYBERWARM: 'Cyber Warm', EMBER: 'Ember Warm', FADE: 'Vintage Fade', FJ200: 'Fujifilm C200',
  FJDISP: 'Fujifilm Disposable', FJEXP: 'Expired Fujifilm C200', FJVIVID: 'Fujifilm Vivid', GL200: 'Kodak Gold 200',
  GLDISP: 'Kodak Gold Disposable', GLEXP: '80s Kodak Gold 200', GLLC: 'Kodak Gold 200 Soft', GLVIVID: 'Kodak Gold 200 Vivid',
  GRNSKETCH: 'Green Sketch', HBLUE: 'Deep Ocean Blue', INSTCOOL: 'Cool Instant', INSTWARM: 'Warm Instant', IRCOLOR: 'Color Infrared',
  LCLOOK: 'Leica Documentary', NEWSPAPER: 'Old Newspaper', OLDWEST: 'Old West', PINK: 'Pink Macaron', PT400: 'Kodak Portra 400',
  PT400LC: 'Kodak Portra 400 Soft', PURPLE: 'Purple Lomo', REDSCALE: 'Redscale Lomo', REDSKETCH: 'Red Sketch', RETROCINE: 'Retro Cinema',
  SABATTIER: 'Sabattier', THEHOTEL: 'The Grand Budapest', VS200: 'Agfa Vista 200',
} as const satisfies Record<keyof typeof LUT_DISPLAY_NAMES, string>

export function lutDisplayName(id: string, language: 'zh-CN' | 'en' = 'zh-CN'): string {
  const names = language === 'en' ? LUT_DISPLAY_NAMES_EN : LUT_DISPLAY_NAMES
  return names[id as keyof typeof names] ?? (language === 'en' ? 'Untitled Film' : '未命名胶片')
}
