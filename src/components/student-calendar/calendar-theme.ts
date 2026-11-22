import { joinClassNames, type ClassNameGenerator, type PluginInput } from "@fullcalendar/react";
import classicTheme from "@fullcalendar/react/themes/classic";

function appendClass<T>(base: ClassNameGenerator<T>, extra: ClassNameGenerator<T>): ClassNameGenerator<T> {
  return (info) => joinClassNames(
    typeof base === "function" ? base(info) : base,
    typeof extra === "function" ? extra(info) : extra,
  );
}

const defaults = classicTheme.optionDefaults ?? {};
const timeGridView = classicTheme.views?.timeGrid;
const timeGrid = typeof timeGridView === "object" ? timeGridView : {};

// Keep the classic layout and add stable hooks for the marketplace's existing styles.
export const marketplaceCalendarTheme: PluginInput = {
  ...classicTheme,
  name: "theme-universident",
  optionDefaults: {
    ...defaults,
    className: appendClass(defaults.className, "calendar-root"),
    viewClass: appendClass(defaults.viewClass, "calendar-grid"),
    dayHeaderInnerClass: appendClass(defaults.dayHeaderInnerClass, "calendar-day-header"),
    dayLaneClass: appendClass(defaults.dayLaneClass, "calendar-day-lane"),
    columnEventClass: appendClass(defaults.columnEventClass, "calendar-event"),
    columnEventInnerClass: appendClass(defaults.columnEventInnerClass, "calendar-event-inner"),
    eventClass: appendClass(defaults.eventClass, (info) => joinClassNames(
      info.isMirror && "calendar-event-mirror",
      info.isDragging && "calendar-event-dragging",
    )),
    highlightClass: joinClassNames(defaults.highlightClass, "calendar-highlight"),
    slotMinHeight: 18.4,
  },
  views: {
    ...classicTheme.views,
    timeGrid: {
      ...timeGrid,
      slotHeaderInnerClass: appendClass(timeGrid.slotHeaderInnerClass, "calendar-slot-label"),
    },
  },
};
