import { useEffect, useState } from 'react';
import { EMPTY_PROFILE, type Settings, type UserProfile } from '@/types/session';
import { clearProfile, loadProfile, saveProfile } from '@/services/storage/profileRepository';
import { Button, Card, TextInput, Toggle } from '@/components/ui';

export default function ProfileSettings({ s, update }: { s: Settings; update: (p: Partial<Settings>) => void }) {
  const [p, setP] = useState<UserProfile>(EMPTY_PROFILE);
  const [saved, setSaved] = useState(false);
  useEffect(() => { void loadProfile().then(setP); }, []);
  const set = (k: keyof UserProfile) => (v: string) => { setSaved(false); setP((x) => ({ ...x, [k]: v })); };
  return (
    <Card className="space-y-1">
      <h2 className="text-lg font-bold">My profile</h2>
      <p className="fm-muted text-xs text-slate-500">Optional. Stored only in this browser. FormMate offers these values while filling and always asks you to confirm before using them.</p>
      <Toggle label="Offer my saved profile while filling forms" checked={s.profileEnabled} onChange={(v) => update({ profileEnabled: v })} />
      <div className="grid gap-x-3 sm:grid-cols-2">
        <TextInput label="Full name" value={p.fullName} onChange={set('fullName')} />
        <TextInput label="Email" type="email" value={p.email} onChange={set('email')} />
        <TextInput label="Phone" type="tel" value={p.phone} onChange={set('phone')} />
        <TextInput label="Languages" value={p.languages} onChange={set('languages')} />
      </div>
      <TextInput label="Address" value={p.address} onChange={set('address')} multiline />
      <TextInput label="Education" value={p.education} onChange={set('education')} multiline />
      <TextInput label="Skills" value={p.skills} onChange={set('skills')} multiline />
      <TextInput label="Experience" value={p.experience} onChange={set('experience')} multiline />
      <TextInput label="Short summary" value={p.summary} onChange={set('summary')} multiline />
      <details className="py-1"><summary className="cursor-pointer text-sm font-medium">Sensitive details (optional, always confirmed before use)</summary>
        <div className="grid gap-x-3 sm:grid-cols-2">
          <TextInput label="Date of birth" value={p.dob} onChange={set('dob')} placeholder="YYYY-MM-DD" />
          <TextInput label="Gender" value={p.gender} onChange={set('gender')} />
        </div>
      </details>
      <div className="flex flex-wrap gap-2 pt-2">
        <Button variant="primary" onClick={() => void saveProfile(p).then(() => setSaved(true))}>Save profile</Button>
        <Button variant="danger" onClick={() => { if (confirm('Delete your saved profile?')) void clearProfile().then(() => { setP(EMPTY_PROFILE); setSaved(false); }); }}>Delete profile</Button>
        {saved && <span role="status" className="self-center text-sm font-semibold text-ok">✔ Saved</span>}
      </div>
    </Card>
  );
}
