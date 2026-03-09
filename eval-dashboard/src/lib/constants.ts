export const ROUTES = {
  OVERVIEW: '/',
  MISCLASSIFICATIONS: '/misclassifications',
  ROOT_CAUSE: '/root-cause',
} as const;

export const NAV_ITEMS = [
  { path: ROUTES.OVERVIEW, label: 'Overview' },
  { path: ROUTES.MISCLASSIFICATIONS, label: 'Misclassifications' },
  { path: ROUTES.ROOT_CAUSE, label: 'Root Cause' },
] as const;
