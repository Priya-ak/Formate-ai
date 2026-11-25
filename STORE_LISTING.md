# Store listing text (Edge Add-ons / Chrome Web Store)

**Name:** FormMate — Voice Form Filler
**Category:** Productivity  (alternative: Accessibility)

## Short description (max 132 chars)
Fill online forms by voice in Tamil, Hindi, English and more. FormMate verifies each field and never submits for you.

## Detailed description
FormMate helps you fill online forms by speaking. It finds the form on the page you are using, asks one question at a time in your language, fills the real fields, checks that each value was accepted, and shows you a final review.

Speak in English, Tamil, Hindi, Telugu, Kannada, Malayalam, Bengali or Marathi.

WHAT IT DOES
• Detects forms on the page and asks you each question aloud, or by text
• Understands spoken emails, phone numbers, dates, dropdown choices, checkboxes and radio buttons
• Fills the actual page fields and verifies each value, and tells you if the website rejects it
• Works with multi-step forms, shows your progress, and lets you skip, go back, pause, or change an earlier answer
• Review screen: completed, missing, needs attention, and fields left for you
• Optional saved profile, offered only with your confirmation
• Easy Mode, high contrast, large text and reduced motion for accessibility
• Works without any account or API key

YOU STAY IN CONTROL
• FormMate never submits a form. You press the website's own submit button.
• It never fills passwords, one-time codes or card details, never solves CAPTCHAs, and never uploads files for you. It tells you when a field needs you.
• No account, no FormMate server, no tracking. Your data stays in your browser.

OPTIONAL AI
Add your own free Gemini API key in Settings to help understand harder answers. It is off by default, needs your consent, and is never used on sensitive fields. Rewrites and translations are always shown for your confirmation.

PRIVACY
Everything is stored locally. Voice recognition uses your browser's built-in speech service. Read the full policy at the link in the listing.

Tip: click the FormMate icon on a page with a form, then press "Start voice fill". Automatic detection on all websites is optional and off by default.

## Search terms (keywords)
voice form filler, autofill by voice, speech to text forms, Tamil, Hindi, accessibility, form assistant

## Notes for certification (reviewers)
How to test: open any page with a form (or the demo at http://localhost:5173 from the project's demo folder), click the FormMate icon, press Start voice fill, and type or speak answers. The extension never submits forms. No account or API key is needed.

## Permission justifications
- activeTab / scripting: read the form on the current page only after the user clicks FormMate.
- storage: save settings, optional profile and history locally.
- sidePanel: show the voice assistant panel.
- generativelanguage.googleapis.com: optional calls to Google's Gemini API with the user's own key and consent.
- Optional access to http(s) sites: only if the user turns on automatic form detection in Settings.
- Single purpose: help users fill online forms by voice on pages they choose.
- Remote code: none. All code is bundled in the package.
