import { redirect } from 'next/navigation';

export default function NewPickup() {
  redirect('/workspace/crm?new=1');
}
