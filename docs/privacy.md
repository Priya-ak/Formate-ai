---
title: FormMate Privacy Policy
---

# FormMate Privacy Policy

_Last updated: 25 November 2026_

FormMate is a browser extension that helps you fill online forms by voice. This policy explains what it does with your data. In short: **FormMate has no server and no account, and it does not collect, sell or share your data.**

## What FormMate reads
- When you click FormMate (or if you turn on automatic detection), it reads the form on the current page: field labels, types, options and the values you fill in.
- This happens inside your browser. It is not sent to us or to anyone else.
- FormMate never fills password, one-time-code or payment-card fields, never solves CAPTCHAs, never uploads files for you, and never submits a form.

## Your voice
- FormMate uses your browser's built-in speech recognition (the Web Speech API) to turn your speech into text. In Chrome and Edge, your browser may send the audio to its speech service (Google or Microsoft) to do this. That is done by the browser under its own privacy policy, not by FormMate. FormMate does not record or store audio.
- You can type your answers instead of speaking.

## What is stored on your device
Stored only in your browser (`chrome.storage.local` and IndexedDB):
- Your settings (languages, accessibility options).
- An optional saved profile (for example name, email, phone), only if you create one. You are asked to confirm before it is used.
- A history of forms you worked on (website, form title, progress). Answers are kept only if you press "Save for later".
- If you use optional AI, your Gemini API key.

You can delete the profile, history and all data in **Settings → Privacy & permissions** at any time. Removing the extension deletes everything it stored.

## Optional AI (Gemini)
- Off by default. If you turn it on, add your own Gemini API key and give consent, FormMate may send the text of an answer and the label and options of the field to Google's Gemini API to help understand it.
- It is never used for passwords, one-time codes, payment fields, ID numbers or other sensitive fields.
- Any rewrite or translation is shown to you for confirmation before it is filled in.
- Google's handling of that data is covered by Google's terms and privacy policy.
- Without AI, everything works using rules built into the extension.

## Permissions
- `activeTab`, `scripting`: read the form on the page you are using, only after you click FormMate.
- `storage`: save your settings, profile and history locally.
- `sidePanel`: show the assistant panel.
- `https://generativelanguage.googleapis.com/*`: only used if you enable Gemini.
- Optional access to all websites: only if you turn on automatic form detection. It is off by default and you can turn it off at any time.

## What we do not do
No analytics, no advertising, no tracking, no selling or sharing of data, and no remote code.

## Children
FormMate is not directed at children under 13.

## Changes
If this policy changes, the date above will be updated.

## Contact
Questions: open an issue at https://github.com/Priya-ak/Formate-ai/issues
