import { Catalog } from '../../../core/api';
import { CampusEvent } from '../event.models';

/**
 * DEV ONLY: worst-case data for the "Khám phá sự kiện" screen, swapped in at the data
 * boundary via ?data=worst|empty|one|huge. Never read in production builds (guarded by isDevMode()).
 * Limits come from database/schema/01_schema.sql: title/location varchar(250), description text
 * (form max 20000), organization_units.name varchar(150), capacity integer > 0.
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** ISO timestamp relative to now, so every registration-window state shows up whenever the fixture is opened. */
const at = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

export const FIXTURE_UNITS: Catalog[] = [
  { id: 1, name: 'Phòng Công tác Sinh viên' },
  // 133 chars; organization_units.name allows 150.
  { id: 2, name: 'Đoàn Thanh niên Cộng sản Hồ Chí Minh – Hội Sinh viên Việt Nam Trường Đại học Bách khoa, Đại học Quốc gia Thành phố Hồ Chí Minh' },
  { id: 3, name: 'CLB Tin học' },
];

let nextId = 1000;
function event(partial: Partial<CampusEvent> & Pick<CampusEvent, 'title' | 'startsAt'>): CampusEvent {
  const starts = Date.parse(partial.startsAt);
  return {
    id: nextId++,
    organizerId: 1,
    status: 'PUBLISHED',
    publishedAt: at(-2 * DAY),
    version: 1,
    description: 'Buổi chia sẻ dành cho sinh viên các khóa.',
    location: 'Hội trường A4',
    organizationUnitId: 1,
    registrationOpensAt: new Date(starts - 7 * DAY).toISOString(),
    registrationClosesAt: new Date(starts - 1 * DAY).toISOString(),
    endsAt: new Date(starts + 2 * HOUR).toISOString(),
    capacity: 80,
    departmentIds: [],
    studyYears: [],
    ...partial,
  };
}

/** Demo-looking rows: what the screen was designed against. */
export const DEMO_EVENTS: CampusEvent[] = [
  event({ title: 'Workshop Kỹ năng phỏng vấn', startsAt: at(3 * DAY), registrationOpensAt: at(-2 * DAY), registrationClosesAt: at(2 * DAY) }),
  event({ title: 'Ngày hội việc làm IT', startsAt: at(10 * DAY), location: 'Sân trường cơ sở 2', capacity: 300 }),
  event({ title: 'Seminar Trí tuệ nhân tạo', startsAt: at(14 * DAY), organizationUnitId: 3 }),
];

/** One failure per row, spread across the first screen the way real data mixes them. */
export const WORST_EVENTS: CampusEvent[] = [
  // Title near the 250-char limit, longest unit name, long location, registration open now.
  event({
    title:
      'Hội thảo khoa học sinh viên toàn quốc lần thứ XII về Trí tuệ nhân tạo, Dữ liệu lớn và Chuyển đổi số trong giáo dục đại học: Cơ hội, thách thức và định hướng phát triển giai đoạn 2026–2030 (Phiên toàn thể và các tiểu ban chuyên đề)',
    organizationUnitId: 2,
    location:
      'Hội trường lớn Nhà điều hành, tầng 3, Khu A, Cơ sở Lý Thường Kiệt, 268 Lý Thường Kiệt, Phường Diên Hồng, Thành phố Hồ Chí Minh (cổng số 3, gửi xe tại bãi B1)',
    startsAt: at(5 * DAY),
    registrationOpensAt: at(-1 * DAY),
    registrationClosesAt: at(4 * DAY),
    capacity: 1500,
  }),
  // Online event: the location is an unbreakable URL; description pasted with newlines and markup.
  event({
    title: 'Talkshow trực tuyến: Sinh viên và Khởi nghiệp',
    location: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_ZjE2NTFkYmMtYTk0Ny00NzJmLWE3ZGMtNTc2NjAyOWQxNmQ2%40thread.v2/0',
    description:
      '<b>Miễn phí</b> &amp; có giấy chứng nhận **tham dự**.\nPhần 1: Chia sẻ từ khách mời.\nPhần 2: Hỏi đáp.\n\n' +
      'Sinh viên đăng ký vui lòng chuẩn bị câu hỏi trước. '.repeat(40),
    startsAt: at(9 * DAY),
    organizationUnitId: 3,
    capacity: 2_147_483_647,
  }),
  // Very short title, unit missing from the catalog, capacity of exactly one.
  event({ title: 'AI', description: 'Gặp mặt.', location: 'P.101', organizationUnitId: 999, capacity: 1, startsAt: at(-3 * HOUR), endsAt: at(1 * HOUR) }),
  // A title with no spaces (hashtag-style), registration closed.
  event({
    title: '#HọcLậpTrìnhWebVớiAngularVàSpringBootDànhChoNgườiMớiBắtĐầu',
    startsAt: at(1 * DAY + 2 * HOUR),
    registrationOpensAt: at(-6 * DAY),
    registrationClosesAt: at(-1 * HOUR),
  }),
  // Stacked Vietnamese diacritics in a clamped description; starts at 23:30 and runs past midnight.
  event({
    title: 'Đêm nhạc Hội Sinh viên: Những bản tình ca bất hủ',
    description: 'Đặng Thị Ngọc Hân, Nguyễn Hữu Kiệt và Trịnh Thị Ngọc Diễm trình diễn những ca khúc được yêu thích nhất của thế hệ sinh viên những năm 2000.',
    startsAt: new Date(new Date(at(4 * DAY)).setUTCHours(16, 30, 0, 0)).toISOString(), // 23:30 Vietnam time
    capacity: 450,
  }),
  // Two events with identical titles: the card must still tell them apart.
  event({ title: 'Workshop Kỹ năng phỏng vấn', startsAt: at(12 * DAY), location: 'Phòng B4-201' }),
  event({ title: 'Workshop Kỹ năng phỏng vấn', startsAt: at(19 * DAY), location: 'Phòng B4-305' }),
];

/** Exactly one event. */
export const ONE_EVENT: CampusEvent[] = [DEMO_EVENTS[0]];

/** 1,284 events, to exercise paging copy ("trên trang này") and the hasNext path. */
export const HUGE_EVENTS: CampusEvent[] = Array.from({ length: 1284 }, (_, i) =>
  event({ title: `Sinh hoạt chuyên đề số ${i + 1}`, startsAt: at((i % 60) * DAY + 3 * HOUR), registrationOpensAt: at(-DAY), registrationClosesAt: at(DAY) }),
);

export type FixtureKey = 'demo' | 'worst' | 'empty' | 'one' | 'huge';

export const FIXTURES: Record<FixtureKey, CampusEvent[]> = {
  demo: DEMO_EVENTS,
  worst: WORST_EVENTS,
  empty: [],
  one: ONE_EVENT,
  huge: HUGE_EVENTS,
};
