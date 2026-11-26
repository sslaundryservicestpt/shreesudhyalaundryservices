import 'server-only';
import { redirect } from 'next/navigation';
import { DomainError } from '@shree/domain';
import { principal } from './auth';
export async function pageActor() {
  try {
    return await principal();
  } catch (error) {
    if (error instanceof DomainError && [401, 403, 503].includes(error.status))
      redirect(`/login?notice=${error.code.toLowerCase()}`);
    throw error;
  }
}
