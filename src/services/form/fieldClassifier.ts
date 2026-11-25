import type { SemanticType } from '@/types/form';
import { humanizeIdentifier, normalize } from '@/utils/text';

export interface FieldSignals {
  autocomplete: string;
  htmlType: string; // input type or 'textarea' | 'select' | 'contenteditable'
  name: string;
  id: string;
  label: string;
  ariaLabel: string;
  placeholder: string;
  context: string; // section heading / help text / nearby text
  isCheckbox: boolean;
  isRadio: boolean;
  isSelect: boolean;
}

export interface Classification {
  type: SemanticType;
  confidence: number;
  by: string;
  sensitive: boolean;
  manualOnly: boolean;
  legal: boolean;
}

interface Rule { type: SemanticType; re: RegExp }

// Order matters: specific rules first. Includes common native-language label words
// (Tamil, Hindi, Telugu, Kannada, Malayalam, Bengali, Marathi) for Indian government/education sites.
const RULES: Rule[] = [
  { type: 'captcha', re: /captcha|recaptcha|hcaptcha|security (code|question)|i am not a robot|verification image/ },
  { type: 'otp', re: /\botp\b|one.?time (pass|code)|verification code|sms code|ஒரு முறை|ओटीपी/ },
  { type: 'password', re: /pass(word|wd|code)\b|\bpwd\b|கடவுச்சொல்|पासवर्ड/ },
  { type: 'payment', re: /card ?(number|no)|credit ?card|debit ?card|\bcvv\b|\bcvc\b|expiry|expiration|\biban\b|account ?(number|no)|\bifsc\b|\bupi\b|routing number/ },
  { type: 'id_number', re: /aadhaar|aadhar|ஆதார்|आधार|\bpan ?(card|number|no)?\b|passport|\bssn\b|social security|voter ?id|driving ?licen[cs]e|national id|\bid ?(number|no|proof)\b|enrol(l)?ment ?(no|number)|ration ?card/ },
  { type: 'email', re: /e.?mail|மின்னஞ்சல்|ईमेल|ఇమెయిల్|ಇಮೇಲ್|ഇമെയിൽ|ইমেইল/ },
  { type: 'phone', re: /phone|mobile|\btel\b|telephone|whats ?app|contact ?(no|number|num)|\bcell\b|தொலைபேசி|கைபேசி|மொபைல்|फ़ोन|फोन|मोबाइल|ఫోన్|ಫೋನ್|ഫോൺ|ফোন|মোবাইল/ },
  { type: 'linkedin', re: /linked ?in/ },
  { type: 'website', re: /web ?site|portfolio|github|homepage|personal (site|url|link)|\burl\b/ },
  { type: 'postal_code', re: /pin ?code|postal|zip|post ?code|பின்கோடு|அஞ்சல்|पिन|पिनकोड/ },
  { type: 'dob', re: /date of birth|\bdob\b|birth ?date|birthday|பிறந்த|जन्म|పుట్టిన|ಜನ್ಮ|ജനന|জন্ম/ },
  { type: 'gender', re: /gender|\bsex\b|பாலினம்|लिंग|లింగ|ಲಿಂಗ|ലിംഗ|লিঙ্গ/ },
  { type: 'generic_text', re: /(father|mother|parent|guardian|spouse|husband|wife|emergency contact|referee|reference)('?s)? ?(full ?)?name|தந்தை|தாய்|पिता|माता/ },
  { type: 'company', re: /company|employer|organi[sz]ation|firm\b|நிறுவனம்|कंपनी|संस्था/ },
  { type: 'institution', re: /school|college|university|institut|\bboard\b|பள்ளி|கல்லூரி|பல்கலை|विद्यालय|कॉलेज|विश्वविद्यालय/ },
  { type: 'graduation_year', re: /(graduat|passing|passed|completion|pass ?out).*(year)|year of (passing|graduation|completion)|batch/ },
  { type: 'education', re: /education|qualification|degree|course|highest|studies|படிப்பு|கல்வி|शिक्षा|योग्यता|విద్య|ಶಿಕ್ಷಣ|വിദ്യാഭ്യാസ|শিক্ষা/ },
  { type: 'years_experience', re: /(years?|yrs).*(experience|exp)\b|experience.*(years?|yrs)|total experience/ },
  { type: 'experience', re: /experience|work history|employment history|previous (job|work|employer)|அனுபவம்|अनुभव|అనుభవం|ಅನುಭವ|പരിചയം|অভিজ্ঞতা/ },
  { type: 'skills', re: /skill|expertise|technolog|proficien|திறன்|कौशल|నైపుణ్య|ಕೌಶಲ|വൈദഗ്ധ്യ|দক্ষতা/ },
  { type: 'salary_expectation', re: /salary|\bctc\b|compensation|expected pay|ஊதியம்|वेतन/ },
  { type: 'start_date', re: /start date|joining date|date of joining|available from|earliest start/ },
  { type: 'availability', re: /availab|notice period|when can you (start|join)|joining|full.?time|part.?time/ },
  { type: 'why_apply', re: /why.*(hire|apply|want|interested|join|should we|this (job|role|position))|motivation|cover letter|statement of purpose|\bsop\b/ },
  { type: 'summary', re: /summary|about (you|yourself|me)|\bbio\b|objective|describe yourself|introduce|additional (info|comments)|comments|remarks|message/ },
  { type: 'job_role', re: /position|job (title|role)|designation|role applying|applying for|post applied/ },
  { type: 'language', re: /languages?( known| spoken)?\b|மொழி|भाषा/ },
  { type: 'city', re: /\bcity\b|\btown\b|district|நகரம்|மாவட்டம்|शहर|जिला|ज़िला/ },
  { type: 'state', re: /\bstate\b|province|மாநிலம்|राज्य/ },
  { type: 'country', re: /country|nationality|நாடு|देश/ },
  { type: 'street', re: /street|address ?line|addr ?(1|2)|locality|landmark|\barea\b/ },
  { type: 'address', re: /address|முகவரி|पता|చిరునామా|ವಿಳಾಸ|വിലാസം|ঠিকানা/ },
  { type: 'first_name', re: /first ?name|given ?name|\bfname\b|forename|முதல் பெயர்|पहला नाम/ },
  { type: 'last_name', re: /last ?name|sur ?name|family ?name|\blname\b|उपनाम|कुलनाम/ },
  { type: 'full_name', re: /full ?name|your name|candidate|applicant|student name|\bname\b|பெயர்|नाम|పేరు|ಹೆಸರು|പേര്|নাম/ },
];

const CONSENT_RE = /agree|consent|accept|terms|conditions|privacy|declaration|declare|certify|i hereby|undertaking|ஒப்புக்|सहमत/;
const LEGAL_RE = /terms|conditions|privacy|declaration|declare|certify|hereby|undertaking|agree|consent|accept/;

const AUTOCOMPLETE: Record<string, SemanticType> = {
  name: 'full_name', 'given-name': 'first_name', 'family-name': 'last_name', email: 'email',
  tel: 'phone', 'tel-national': 'phone', 'street-address': 'address', 'address-line1': 'street',
  'address-line2': 'street', 'address-level2': 'city', 'address-level1': 'state', 'postal-code': 'postal_code',
  country: 'country', 'country-name': 'country', bday: 'dob', sex: 'gender', organization: 'company',
  'organization-title': 'job_role', url: 'website', 'cc-number': 'payment', 'cc-csc': 'payment',
  'cc-exp': 'payment', 'cc-name': 'payment', 'new-password': 'password', 'current-password': 'password',
  'one-time-code': 'otp',
};

const MANUAL: SemanticType[] = ['password', 'otp', 'payment', 'captcha'];
const SENSITIVE: SemanticType[] = ['password', 'otp', 'payment', 'captcha', 'id_number'];

function finish(type: SemanticType, confidence: number, by: string): Classification {
  return {
    type,
    confidence,
    by,
    sensitive: SENSITIVE.includes(type),
    manualOnly: MANUAL.includes(type),
    legal: false,
  };
}

function firstMatch(text: string): SemanticType | null {
  if (!text) return null;
  const n = normalize(text);
  for (const r of RULES) if (r.re.test(n)) return r.type;
  return null;
}

export function classifyField(s: FieldSignals): Classification {
  const ac = (s.autocomplete || '').split(/\s+/).pop() || '';
  if (AUTOCOMPLETE[ac]) return finish(AUTOCOMPLETE[ac], 0.99, 'autocomplete');

  if (s.htmlType === 'password') return finish('password', 1, 'type');

  // Checkboxes that read as agreement / consent.
  if (s.isCheckbox) {
    const t = normalize(`${s.label} ${s.ariaLabel} ${s.name} ${s.id}`);
    if (CONSENT_RE.test(t)) {
      const c = finish(LEGAL_RE.test(t) ? 'terms' : 'consent', 0.9, 'label');
      c.legal = true;
      return c;
    }
  }

  // Label-like tiers, strongest first. Name/id attributes are split from camelCase first.
  const tiers: [string, string, number][] = [
    [s.label, 'label', 0.95],
    [s.ariaLabel, 'aria-label', 0.93],
    [s.placeholder, 'placeholder', 0.85],
    [humanizeIdentifier(s.name), 'name', 0.86],
    [humanizeIdentifier(s.id), 'id', 0.8],
    [s.context, 'context', 0.6],
  ];
  for (const [text, by, conf] of tiers) {
    const t = firstMatch(text);
    if (t) {
      const c = finish(t, conf, by);
      if (t === 'terms' || t === 'consent') c.legal = true;
      return c;
    }
  }

  // Fall back to the HTML input type.
  switch (s.htmlType) {
    case 'email': return finish('email', 0.97, 'type');
    case 'tel': return finish('phone', 0.95, 'type');
    case 'url': return finish('website', 0.8, 'type');
    case 'file': return finish('generic_file', 0.7, 'type');
    case 'date': return finish('generic_date', 0.7, 'type');
    case 'number': return finish('generic_number', 0.6, 'type');
  }
  if (s.isCheckbox) return finish('generic_boolean', 0.5, 'fallback');
  if (s.isRadio || s.isSelect) return finish('generic_choice', 0.5, 'fallback');
  return finish('generic_text', 0.4, 'fallback');
}

/** Upgrade a generic file field to resume_upload when its text says so. */
export function refineFileType(c: Classification, text: string): Classification {
  if (/resume|\bcv\b|curriculum/.test(normalize(text))) return { ...c, type: 'resume_upload', confidence: 0.9, by: 'label' };
  return c;
}

export function guessFormKind(text: string): 'job' | 'education' | 'government' | 'healthcare' | 'registration' | 'contact' | 'other' {
  const t = normalize(text);
  if (/job|career|apply|application for|position|resume|candidate|vacancy|recruit/.test(t)) return 'job';
  if (/admission|student|college|university|scholarship|course|exam/.test(t)) return 'education';
  if (/government|gov\b|aadhaar|ration|certificate|e.?service|ministry|department|passport|tax/.test(t)) return 'government';
  if (/patient|hospital|clinic|medical|appointment|health|insurance/.test(t)) return 'healthcare';
  if (/register|registration|sign ?up|create account|enrol/.test(t)) return 'registration';
  if (/contact|enquiry|inquiry|feedback|message us/.test(t)) return 'contact';
  return 'other';
}
