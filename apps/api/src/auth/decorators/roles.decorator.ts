import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'fuse:roles';

/** Papel mínimo exigido (hierárquico): VIEWER < SUPPORT < MANAGER < TENANT_ADMIN < SUPER_ADMIN. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
