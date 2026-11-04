export interface NavItem {
  path: string;
  icon: string;
  label: string;
}

/** Sidebar menu per role (mockup `menu`). Keep in sync with app.routes.ts. */
export const NAV_BY_ROLE: Record<string, NavItem[]> = {
  STUDENT: [
    { path: '/events', icon: 'grid', label: 'Khám phá sự kiện' },
    { path: '/my-events', icon: 'calendar', label: 'Sự kiện của tôi' },
    { path: '/scan', icon: 'qr', label: 'Điểm danh QR' },
  ],
  ORGANIZER: [
    { path: '/manage', icon: 'grid', label: 'Sự kiện quản lý' },
    { path: '/participants', icon: 'users', label: 'Người tham gia' },
    { path: '/attendance', icon: 'qr', label: 'Điểm danh' },
    { path: '/reports', icon: 'chart', label: 'Báo cáo' },
  ],
  ADMIN: [{ path: '/admin/accounts', icon: 'users', label: 'Quản lý tài khoản' }],
};

export const SPACE_CAPTION: Record<string, string> = {
  STUDENT: 'KHÔNG GIAN CỦA BẠN',
  ORGANIZER: 'KHÔNG GIAN TỔ CHỨC',
  ADMIN: 'QUẢN TRỊ HỆ THỐNG',
};
