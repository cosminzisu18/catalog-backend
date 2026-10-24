import { SetMetadata } from '@nestjs/common';

export const ALLOW_INACTIVE_DIRECTOR_KEY = 'allowInactiveDirector';

// write routes an inactive director can still use (own password, own profile)
export const AllowInactiveDirector = () =>
  SetMetadata(ALLOW_INACTIVE_DIRECTOR_KEY, true);
