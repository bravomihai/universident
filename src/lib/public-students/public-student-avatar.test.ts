import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PublicStudentAvatar } from "@/components/public-students/public-student-avatar";

test("public student avatars use initials without loading an external image", () => {
  const markup = renderToStaticMarkup(
    createElement(PublicStudentAvatar, { name: "Ana Maria Popescu" }),
  );

  assert.match(markup, />AM</);
  assert.doesNotMatch(markup, /<img|https?:\/\//);
});
