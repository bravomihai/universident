import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import FullCalendar from "@fullcalendar/react";
import roLocale from "@fullcalendar/react/locales/ro";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import { marketplaceCalendarTheme } from "../../components/student-calendar/calendar-theme";

test("FullCalendar day and week views render the marketplace theme and event states", (context) => {
  // FullCalendar schedules clock updates during SSR; keep them inside this test.
  context.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  try {
    for (const initialView of ["timeGridDay", "timeGridWeek"]) {
      const html = renderToStaticMarkup(createElement(FullCalendar, {
        plugins: [marketplaceCalendarTheme, timeGridPlugin],
        locale: roLocale,
        initialView,
        initialDate: "2026-11-23",
        headerToolbar: false,
        allDaySlot: false,
        slotMinTime: "07:00:00",
        slotMaxTime: "21:00:00",
        slotHeaderInterval: "01:00:00",
        slotHeaderFormat: { hour: "2-digit", minute: "2-digit", hour12: false },
        events: ["available", "pending", "confirmed", "exception", "selected"].map((state, index) => ({
          id: state,
          title: "Igienizare",
          start: `2026-11-23T${String(9 + index).padStart(2, "0")}:00:00`,
          end: `2026-11-23T${String(10 + index).padStart(2, "0")}:00:00`,
          className: `calendar-event-${state}`,
        })),
      }));
      for (const hook of ["calendar-root", "calendar-grid", "calendar-day-header", "calendar-slot-label", "calendar-event-inner"]) {
        assert.match(html, new RegExp(`class="[^"]*\\b${hook}\\b`), `${initialView} must retain ${hook}`);
      }
      for (const state of ["available", "pending", "confirmed", "exception", "selected"]) {
        assert.match(html, new RegExp(`class="[^"]*\\bcalendar-event-${state}\\b`));
      }
      assert.match(html, /09:00/);
      assert.match(html, /Igienizare/);
      assert.match(html, /noiembrie/);
    }
  } finally {
    context.mock.timers.reset();
  }
});
