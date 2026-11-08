/** One shared formatter: creating an Intl.NumberFormat is costly, formatting with it is cheap. */
const VIETNAMESE_COUNT_FORMAT = new Intl.NumberFormat('vi-VN');

/** 1500 -> "1.500": counts with Vietnamese thousands separators. */
export function formatCount(value: number): string {
  return VIETNAMESE_COUNT_FORMAT.format(value);
}
