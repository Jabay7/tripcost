/**
 * Translations for the driver's copy of the brief.
 *
 * Scope is deliberate: the *screen* stays English because a dispatcher uses it,
 * and the *shared text* is translated because that is what reaches the driver.
 * Translating the dispatch UI would be a much larger job for much less benefit.
 *
 * What gets translated is chosen the same way. Labels, headings and the
 * safety-critical phrases are translated. Place names, unit numbers, road
 * designations (I-80), state codes and NWS alert text are left alone — a driver
 * needs to match those against road signs, paperwork and a weather radio, and a
 * translated highway name is worse than useless.
 */

export type Lang = 'en' | 'es' | 'ar';

export const LANGUAGES: { code: Lang; label: string; native: string; rtl: boolean }[] = [
  { code: 'en', label: 'English', native: 'English', rtl: false },
  { code: 'es', label: 'Spanish', native: 'Español', rtl: false },
  { code: 'ar', label: 'Arabic', native: 'العربية', rtl: true },
];

export const isRtl = (lang: Lang) => LANGUAGES.find((l) => l.code === lang)?.rtl ?? false;

type Dict = {
  // Headings
  driverBrief: string;
  fromDispatch: string;
  bottomLine: string;
  theRun: string;
  timeline: string;
  fuel: string;
  weather: string;
  traffic: string;
  restrictions: string;
  dispatch: string;

  // Run fields
  distance: string;
  deadhead: string;
  states: string;
  depart: string;
  eta: string;
  appointment: string;
  equipment: string;
  weight: string;
  hazmat: string;
  oversize: string;
  oversizeNote: string;

  // Schedule
  slack: string;
  lateBy: string;
  doNotRunIllegal: string;
  mile: string;
  stopKind: Record<string, string>;

  // Fuel
  fillHere: string;
  expensive: string;
  perGal: string;
  cheapestIs: (state: string, price: string) => string;
  costlierBy: (state: string, delta: string) => string;
  needAFill: (miles: string, range: string) => string;
  oneTank: (range: string) => string;
  pricesAreRegional: string;

  // Risk
  risk: Record<'GREEN' | 'AMBER' | 'RED', string>;
  bottomLineText: Record<'GREEN' | 'AMBER' | 'RED', string>;

  // Footer
  minutes: string;
  blocking: string;
  modeledDataNote: string;
};

const en: Dict = {
  driverBrief: 'DRIVER BRIEF',
  fromDispatch: 'FROM DISPATCH',
  bottomLine: 'BOTTOM LINE',
  theRun: 'THE RUN',
  timeline: 'TIMELINE',
  fuel: 'FUEL',
  weather: 'WEATHER',
  traffic: 'TRAFFIC',
  restrictions: 'RESTRICTIONS',
  dispatch: 'DISPATCH',

  distance: 'Distance',
  deadhead: 'deadhead',
  states: 'States',
  depart: 'Depart',
  eta: 'ETA',
  appointment: 'Appointment',
  equipment: 'Equipment',
  weight: 'Weight',
  hazmat: 'HAZMAT',
  oversize: 'OVERSIZE',
  oversizeNote: 'permits and escort required',

  slack: 'of slack',
  lateBy: 'LATE by',
  doNotRunIllegal: 'DO NOT RUN ILLEGAL',
  mile: 'mile',
  stopKind: {
    'delivery': 'dock',
    '30-min-break': '30-minute break',
    '10-hr-reset': '10-hour reset',
    'fuel': 'fuel stop',
  },

  fillHere: 'FILL HERE',
  expensive: 'expensive',
  perGal: '/gal',
  cheapestIs: (s, p) => `Cheapest diesel on this route is ${s} at ${p}/gal. Fill there.`,
  costlierBy: (s, d) => `${s} runs ${d}/gal higher — buy only what you need to get through it.`,
  needAFill: (m, r) =>
    `This run is ${m} mi and your range on a full tank is about ${r} mi. You will need at least one fill.`,
  oneTank: (r) =>
    `Your range on a full tank is about ${r} mi, so this run can be made on one tank if you leave full.`,
  pricesAreRegional:
    'Prices are regional averages, not per-station. Check your fuel network app before pulling in.',

  risk: { GREEN: 'GREEN', AMBER: 'AMBER', RED: 'RED' },
  bottomLineText: {
    GREEN: 'No significant obstacles. Run your normal pre-trip and standard checks.',
    AMBER: 'Runnable with care. Read the items below, build in extra time, and check in with dispatch.',
    RED: 'Do not run this as planned. Call dispatch before you move.',
  },

  minutes: 'min',
  blocking: 'BLOCKING',
  modeledDataNote:
    'NOTE: parts of this brief use modeled data, not live feeds. Verify before you roll.',
};

const es: Dict = {
  driverBrief: 'RESUMEN DEL CONDUCTOR',
  fromDispatch: 'DE DESPACHO',
  bottomLine: 'LO ESENCIAL',
  theRun: 'EL VIAJE',
  timeline: 'CRONOGRAMA',
  fuel: 'COMBUSTIBLE',
  weather: 'CLIMA',
  traffic: 'TRÁFICO',
  restrictions: 'RESTRICCIONES',
  dispatch: 'DESPACHO',

  distance: 'Distancia',
  deadhead: 'en vacío',
  states: 'Estados',
  depart: 'Salida',
  eta: 'Llegada',
  appointment: 'Cita',
  equipment: 'Equipo',
  weight: 'Peso',
  hazmat: 'MATERIALES PELIGROSOS',
  oversize: 'SOBREDIMENSIONADO',
  oversizeNote: 'se requieren permisos y escolta',

  slack: 'de margen',
  lateBy: 'TARDE por',
  doNotRunIllegal: 'NO CONDUZCA ILEGALMENTE',
  mile: 'milla',
  stopKind: {
    'delivery': 'muelle',
    '30-min-break': 'descanso de 30 minutos',
    '10-hr-reset': 'reinicio de 10 horas',
    'fuel': 'parada de combustible',
  },

  fillHere: 'LLENE AQUÍ',
  expensive: 'caro',
  perGal: '/galón',
  cheapestIs: (s, p) =>
    `El diésel más barato en esta ruta está en ${s} a ${p}/galón. Llene ahí.`,
  costlierBy: (s, d) =>
    `${s} cuesta ${d}/galón más — compre solo lo necesario para cruzarlo.`,
  needAFill: (m, r) =>
    `Este viaje es de ${m} millas y su alcance con el tanque lleno es de unas ${r} millas. Necesitará llenar al menos una vez.`,
  oneTank: (r) =>
    `Su alcance con el tanque lleno es de unas ${r} millas, así que puede hacer este viaje con un solo tanque si sale lleno.`,
  pricesAreRegional:
    'Los precios son promedios regionales, no por estación. Verifique en su app de combustible antes de entrar.',

  risk: { GREEN: 'VERDE', AMBER: 'ÁMBAR', RED: 'ROJO' },
  bottomLineText: {
    GREEN: 'Sin obstáculos importantes. Haga su inspección previa habitual.',
    AMBER:
      'Se puede hacer con cuidado. Lea los puntos de abajo, deje tiempo extra y comuníquese con despacho.',
    RED: 'No haga este viaje como está planeado. Llame a despacho antes de moverse.',
  },

  minutes: 'min',
  blocking: 'BLOQUEANTE',
  modeledDataNote:
    'NOTA: partes de este resumen usan datos estimados, no en vivo. Verifique antes de salir.',
};

const ar: Dict = {
  driverBrief: 'موجز السائق',
  fromDispatch: 'من قسم الإرسال',
  bottomLine: 'الخلاصة',
  theRun: 'الرحلة',
  timeline: 'الجدول الزمني',
  fuel: 'الوقود',
  weather: 'الطقس',
  traffic: 'حركة المرور',
  restrictions: 'القيود',
  dispatch: 'قسم الإرسال',

  distance: 'المسافة',
  deadhead: 'فارغ',
  states: 'الولايات',
  depart: 'المغادرة',
  eta: 'الوصول المتوقع',
  appointment: 'الموعد',
  equipment: 'المقطورة',
  weight: 'الوزن',
  hazmat: 'مواد خطرة',
  oversize: 'حمولة زائدة الأبعاد',
  oversizeNote: 'يلزم تصاريح ومرافقة',

  slack: 'وقت فائض',
  lateBy: 'متأخر بمقدار',
  doNotRunIllegal: 'لا تقد بشكل مخالف للقانون',
  mile: 'ميل',
  stopKind: {
    'delivery': 'رصيف التحميل',
    '30-min-break': 'استراحة 30 دقيقة',
    '10-hr-reset': 'راحة 10 ساعات',
    'fuel': 'محطة وقود',
  },

  fillHere: 'تزود بالوقود هنا',
  expensive: 'مرتفع السعر',
  perGal: '/جالون',
  cheapestIs: (s, p) => `أرخص ديزل على هذا الطريق في ${s} بسعر ${p}/جالون. تزود هناك.`,
  costlierBy: (s, d) => `${s} أغلى بمقدار ${d}/جالون — اشترِ ما يكفيك لعبوره فقط.`,
  needAFill: (m, r) =>
    `طول هذه الرحلة ${m} ميل، ومداك بخزان ممتلئ حوالي ${r} ميل. ستحتاج إلى التزود بالوقود مرة واحدة على الأقل.`,
  oneTank: (r) =>
    `مداك بخزان ممتلئ حوالي ${r} ميل، لذا يمكن إتمام هذه الرحلة بخزان واحد إذا غادرت ممتلئاً.`,
  pricesAreRegional:
    'الأسعار متوسطات إقليمية وليست لكل محطة. تحقق من تطبيق شبكة الوقود قبل الدخول.',

  risk: { GREEN: 'أخضر', AMBER: 'أصفر', RED: 'أحمر' },
  bottomLineText: {
    GREEN: 'لا توجد عوائق تُذكر. نفّذ الفحص المعتاد قبل الرحلة.',
    AMBER: 'يمكن تنفيذها بحذر. اقرأ النقاط أدناه، خصص وقتاً إضافياً، وتواصل مع قسم الإرسال.',
    RED: 'لا تنفّذ هذه الرحلة كما هي مخططة. اتصل بقسم الإرسال قبل التحرك.',
  },

  minutes: 'دقيقة',
  blocking: 'مانع',
  modeledDataNote:
    'ملاحظة: بعض أجزاء هذا الموجز تعتمد على بيانات تقديرية وليست مباشرة. تحقق قبل الانطلاق.',
};

const DICTS: Record<Lang, Dict> = { en, es, ar };

export const t = (lang: Lang): Dict => DICTS[lang] ?? en;

/**
 * Locale for date and number formatting. Arabic uses the Latin-digit locale on
 * purpose: a driver cross-references these times against a dispatch text, a
 * BOL and a clock in the truck, and Eastern Arabic numerals make that harder,
 * not easier.
 */
export const localeFor = (lang: Lang): string =>
  lang === 'es' ? 'es-US' : lang === 'ar' ? 'ar-u-nu-latn' : 'en-US';
