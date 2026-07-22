import { generateMonthCalendar, SaturdayOffMode } from './src/modules/attendance/schedule-engine';

console.log("--- TEST 1: Saturday is in fixedWeeklyOffDays, but Saturday policy is active (mode: CUSTOM [2,3,4]) ---");
const options1 = {
  year: 2026,
  month: 8,
  fixedWeeklyOffDays: ["Saturday", "Sunday"],
  saturdayPolicy: {
    mode: SaturdayOffMode.CUSTOM,
    customOffWeeks: [2, 3, 4]
  },
  holidays: [],
};

const days1 = generateMonthCalendar(options1 as any);
const sats1 = days1.filter(d => d.dayOfWeek === "Saturday");
sats1.forEach(s => {
  console.log(`${s.date}: Week ${s.weekNumber}, Type: ${s.type}, OffReason: ${s.offReason}`);
});

console.log("\n--- TEST 2: Saturday is NOT in fixedWeeklyOffDays, Saturday policy is active (mode: CUSTOM [2,3,4]) ---");
const options2 = {
  year: 2026,
  month: 8,
  fixedWeeklyOffDays: ["Sunday"],
  saturdayPolicy: {
    mode: SaturdayOffMode.CUSTOM,
    customOffWeeks: [2, 3, 4]
  },
  holidays: [],
};

const days2 = generateMonthCalendar(options2 as any);
const sats2 = days2.filter(d => d.dayOfWeek === "Saturday");
sats2.forEach(s => {
  console.log(`${s.date}: Week ${s.weekNumber}, Type: ${s.type}, OffReason: ${s.offReason}`);
});
