const { generateMonthCalendar, SaturdayOffMode } = require('./src/modules/attendance/schedule-engine');

const options = {
  year: 2026,
  month: 8,
  fixedWeeklyOffDays: ["Sunday"],
  saturdayPolicy: {
    mode: SaturdayOffMode.CUSTOM,
    customOffWeeks: [2, 3, 4]
  },
  holidays: [],
};

const days = generateMonthCalendar(options);
const saturdays = days.filter(d => d.dayOfWeek === "Saturday");
console.log("Saturdays in August 2026:");
saturdays.forEach(s => {
  console.log(`${s.date}: Week ${s.weekNumber}, Type: ${s.type}, OffReason: ${s.offReason}`);
});
