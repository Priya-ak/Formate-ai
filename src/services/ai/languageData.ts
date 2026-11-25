/** Multilingual lexicons used by the rule-based (offline) understanding layer. */

export const ZERO_CODEPOINTS = [0x30, 0x660, 0x6f0, 0x966, 0x9e6, 0xa66, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6, 0xd66];

/** Convert any Unicode decimal digits (Tamil, Devanagari, Bengali...) to ASCII digits. */
export function toAsciiDigits(s: string): string {
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    const zero = ZERO_CODEPOINTS.find((z) => cp >= z && cp <= z + 9);
    out += zero !== undefined ? String(cp - zero) : ch;
  }
  return out;
}

export const DIGIT_WORDS: Record<string, string> = {
  // English
  zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
  // Hindi / Marathi
  'शून्य': '0', 'जीरो': '0', 'एक': '1', 'दो': '2', 'तीन': '3', 'चार': '4', 'पांच': '5', 'पाँच': '5', 'छह': '6', 'छः': '6', 'छे': '6',
  'सात': '7', 'आठ': '8', 'नौ': '9', 'नाइन': '9', 'दोन': '2', 'पाच': '5', 'सहा': '6', 'नऊ': '9',
  // Tamil
  'பூஜ்யம்': '0', 'ஜீரோ': '0', 'ஒன்று': '1', 'ஒன்னு': '1', 'இரண்டு': '2', 'மூன்று': '3', 'நான்கு': '4', 'நாலு': '4', 'ஐந்து': '5',
  'ஆறு': '6', 'ஏழு': '7', 'எட்டு': '8', 'ஒன்பது': '9',
  // Telugu
  'సున్నా': '0', 'ఒకటి': '1', 'రెండు': '2', 'మూడు': '3', 'నాలుగు': '4', 'ఐదు': '5', 'ఆరు': '6', 'ఏడు': '7', 'ఎనిమిది': '8', 'తొమ్మిది': '9',
  // Kannada
  'ಸೊನ್ನೆ': '0', 'ಒಂದು': '1', 'ಎರಡು': '2', 'ಮೂರು': '3', 'ನಾಲ್ಕು': '4', 'ಐದು': '5', 'ಆರು': '6', 'ಏಳು': '7', 'ಎಂಟು': '8', 'ಒಂಬತ್ತು': '9',
  // Malayalam
  'പൂജ്യം': '0', 'ഒന്ന്': '1', 'രണ്ട്': '2', 'മൂന്ന്': '3', 'നാല്': '4', 'അഞ്ച്': '5', 'ആറ്': '6', 'ഏഴ്': '7', 'എട്ട്': '8', 'ഒമ്പത്': '9',
  // Bengali
  'শূন্য': '0', 'এক': '1', 'দুই': '2', 'তিন': '3', 'চার': '4', 'পাঁচ': '5', 'ছয়': '6', 'সাত': '7', 'আট': '8', 'নয়': '9',
};

export const REPEAT_WORDS: Record<string, string> = {
  double: '2', triple: '3', 'डबल': '2', 'ट्रिपल': '3', 'டபிள்': '2', 'டிரிபிள்': '3',
};

export const YES_WORDS = new Set([
  'yes', 'yeah', 'yep', 'yup', 'correct', 'right', 'ok', 'okay', 'sure', 'confirm', 'confirmed', 'agree', 'agreed', 'true', 'affirmative',
  'ஆம்', 'ஆமா', 'ஆமாம்', 'சரி', 'சரிதான்', 'ஒப்புக்கொள்கிறேன்',
  'हाँ', 'हां', 'जी', 'सही', 'ठीक', 'बिल्कुल', 'हो', 'होय', 'बरोबर', 'सहमत',
  'అవును', 'సరే', 'ಹೌದು', 'ಸರಿ', 'അതെ', 'ശരി', 'হ্যাঁ', 'হ্যা', 'ঠিক',
]);

export const NO_WORDS = new Set([
  'no', 'nope', 'nah', 'wrong', 'incorrect', 'false', 'negative', 'disagree', "don't", 'dont',
  'இல்லை', 'இல்ல', 'வேண்டாம்', 'தவறு',
  'नहीं', 'नही', 'ना', 'गलत', 'नाही',
  'కాదు', 'లేదు', 'ಇಲ್ಲ', 'ಅಲ್ಲ', 'ഇല്ല', 'അല്ല', 'না', 'ভুল',
]);

export type IntentType = 'repeat' | 'skip' | 'back' | 'pause' | 'stop' | 'review' | 'explain' | 'change' | 'slower' | 'help';

export const INTENT_PHRASES: Record<IntentType, string[]> = {
  repeat: ['repeat', 'say again', 'say that again', 'once more', 'again please', 'repeat that', 'repeat the question', 'மீண்டும்', 'மறுபடியும்', 'திரும்ப சொல்லுங்கள்', 'फिर से', 'दोबारा', 'दुबारा', 'फिर बोलो', 'మళ్ళీ', 'ಮತ್ತೆ', 'വീണ്ടും', 'আবার', 'पुन्हा'],
  skip: ['skip', 'skip this', 'next question', 'pass', 'not applicable', 'தவிர்', 'தவிர்க்கவும்', 'அடுத்து', 'छोड़', 'छोड़ो', 'छोड़ें', 'अगला', 'वगळा', 'దాటవేయి', 'ಬಿಡಿ', 'ഒഴിവാക്കുക', 'এড়িয়ে যান'],
  back: ['go back', 'back', 'previous', 'previous question', 'பின்னால்', 'முந்தைய', 'पीछे', 'पिछला', 'मागे'],
  pause: ['pause', 'wait', 'hold on', 'நிறுத்து', 'காத்திரு', 'रुको', 'रुकिए', 'थांबा'],
  stop: ['stop', 'cancel', 'quit', 'exit', 'நிறுத்துங்கள்', 'रोको', 'बंद करो', 'बंद'],
  review: ['review', 'summary', 'show summary', 'finish', 'done', 'மதிப்பாய்வு', 'முடிந்தது', 'समीक्षा', 'हो गया', 'खत्म'],
  explain: ['what does this mean', 'explain', 'what is this', 'help me understand', 'என்ன அர்த்தம்', 'விளக்குங்கள்', 'इसका मतलब', 'समझाओ', 'समझाइए', 'मतलब क्या'],
  change: ['change', 'correct', 'edit', 'update', 'fix', 'மாற்று', 'மாற்றவும்', 'திருத்து', 'बदल', 'बदलो', 'सुधार', 'ठीक करो'],
  slower: ['slower', 'slow down', 'speak slowly', 'மெதுவாக', 'धीरे', 'धीमे'],
  help: ['help', 'what can i say', 'உதவி', 'मदद', 'सहायता'],
};

export const MONTHS: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4, may: 5, june: 6, jun: 6, july: 7, jul: 7,
  august: 8, aug: 8, september: 9, sep: 9, sept: 9, october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
  'जनवरी': 1, 'फरवरी': 2, 'फ़रवरी': 2, 'मार्च': 3, 'अप्रैल': 4, 'मई': 5, 'जून': 6, 'जुलाई': 7, 'अगस्त': 8,
  'सितंबर': 9, 'सितम्बर': 9, 'अक्टूबर': 10, 'नवंबर': 11, 'नवम्बर': 11, 'दिसंबर': 12, 'दिसम्बर': 12,
  'ஜனவரி': 1, 'பிப்ரவரி': 2, 'மார்ச்': 3, 'ஏப்ரல்': 4, 'மே': 5, 'ஜூன்': 6, 'ஜூலை': 7, 'ஆகஸ்ட்': 8,
  'செப்டம்பர்': 9, 'அக்டோபர்': 10, 'நவம்பர்': 11, 'டிசம்பர்': 12,
};

export const SYNONYM_GROUPS: Record<string, string[]> = {
  male: ['male', 'man', 'boy', 'gentleman', 'purush', 'ஆண்', 'ஆண்', 'पुरुष', 'मर्द', 'लड़का', 'పురుషుడు', 'ಪುರುಷ', 'പുരുഷൻ', 'পুরুষ'],
  female: ['female', 'woman', 'girl', 'lady', 'mahila', 'பெண்', 'महिला', 'स्त्री', 'औरत', 'लड़की', 'స్త్రీ', 'ಮಹಿಳೆ', 'സ്ത്രീ', 'মহিলা'],
  other: ['other', 'others', 'transgender', 'third', 'non-binary', 'अन्य', 'दूसरा'],
  yes: ['yes', 'yeah', 'ஆம்', 'हाँ', 'हां', 'అవును', 'ಹೌದು', 'അതെ', 'হ্যাঁ'],
  no: ['no', 'nope', 'இல்லை', 'नहीं', 'కాదు', 'ಇಲ್ಲ', 'ഇല്ല', 'না'],
  immediate: ['immediately', 'immediate', 'now', 'asap', 'right away', 'today', 'உடனே', 'உடனடியாக', 'तुरंत', 'अभी', 'ఇప్పుడే', 'ತಕ್ಷಣ', 'ഉടൻ', 'এখনই'],
  fulltime: ['full', 'fulltime', 'full-time', 'முழு', 'पूर्णकालिक', 'फुल'],
  parttime: ['part', 'parttime', 'part-time', 'பகுதி', 'अंशकालिक', 'पार्ट'],
  remote: ['remote', 'wfh', 'home', 'வீட்டில்', 'घर'],
  graduate: ['graduate', 'graduation', 'bachelor', 'bachelors', 'degree', 'btech', 'b.tech', 'be', 'bsc', 'bca', 'ba', 'bcom', 'பட்டதாரி', 'स्नातक'],
  postgraduate: ['postgraduate', 'masters', 'master', 'mtech', 'm.tech', 'msc', 'mca', 'mba', 'ma', 'முதுகலை', 'स्नातकोत्तर'],
  diploma: ['diploma', 'polytechnic', 'டிப்ளமோ', 'डिप्लोमा'],
  school: ['school', 'hsc', 'sslc', '12th', '10th', 'higher secondary', 'பள்ளி', 'स्कूल'],
};

export const FILLER_PREFIXES: RegExp[] = [
  /^(please\s+)?(my\s+)?(full\s+|first\s+|last\s+)?name\s+is\s+/i,
  /^(hi|hello|hey)[,!\s]+/i,
  /^(i\s*am|i'm|this\s+is|it\s*is|it's|call\s+me|myself)\s+/i,
  /^(என்|எனது)\s+(முழு\s+)?பெயர்\s+/u,
  /^(मेरा|मेरी)\s+(पूरा\s+)?(नाम|नाम है)\s*/u,
  /^(मैं|मै)\s+/u,
  /^(माझे|माझं)\s+(पूर्ण\s+)?नाव\s+/u,
  /^(నా)\s+పేరు\s+/u,
  /^(ನನ್ನ)\s+ಹೆಸರು\s+/u,
  /^(എന്റെ)\s+പേര്\s+/u,
  /^(আমার)\s+নাম\s+/u,
];

export const FILLER_SUFFIXES: RegExp[] = [
  /\s+(is\s+my\s+name|is\s+my\s+\w+)$/i,
  /\s*(ஆகும்|என்பது|ஆகிறது|என்று\s+பெயர்)$/u,
  /\s*(है|हूँ|हूं|हैं|हे|आहे)$/u,
  /\s*(అని|ಆಗಿದೆ|ആണ്|হয়)$/u,
];
