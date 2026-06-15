
import { BusinessError } from '@/shared/lib/errors';

export class ActionError extends BusinessError {
  constructor(message: string) {
    super(message);
    this.name = 'ActionError';
  }
}
