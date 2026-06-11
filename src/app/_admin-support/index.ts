import 'server-only';

export { setupAdminPage } from './page-setup';
export {
  buildAdminCrumbs,
  type CrumbSegment,
} from '@/surfaces/admin/server/crumbs';
export { validateAndParseForm, validatePermission } from './action-utils';
