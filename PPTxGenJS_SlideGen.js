const pptxgen = require("pptxgenjs");
const fs = require("fs");

// ── Brand ──────────────────────────────────────────────────────────────────
const C = {
  green:      "1A7A5E",
  greenDark:  "0F5C45",
  greenLight: "2A9D78",
  gold:       "F4B942",
  goldLight:  "FDD574",
  white:      "FFFFFF",
  offWhite:   "F8FAFB",
  lightGray:  "EEF2F0",
  midGray:    "9AADA6",
  darkText:   "1A2E28",
};

const logoData = "image/png;base64," + fs.readFileSync("logo.png").toString("base64");
const makeShadow = () => ({ type: "outer", color: "000000", blur: 8, offset: 3, angle: 135, opacity: 0.10 });

function addHeader(s, title) {
  s.addShape("rect", { x: 0, y: 0, w: 10, h: 1.0, fill: { color: C.green } });
  s.addImage({ data: logoData, x: 0.3, y: 0.22, w: 1.4, h: 0.42 });
  s.addText(title, { x: 2.0, y: 0.12, w: 7.55, h: 0.76, fontSize: 21, bold: true, color: C.white, margin: 0, fontFace: "Trebuchet MS" });
}

function addFooter(s, session = "") {
  s.addShape("rect", { x: 0, y: 5.25, w: 10, h: 0.375, fill: { color: C.green } });
  s.addImage({ data: logoData, x: 0.15, y: 5.27, w: 1.1, h: 0.32 });
  s.addText(`Day 3${session ? " · " + session : ""}`, { x: 3.5, y: 5.27, w: 3, h: 0.32, fontSize: 9, color: C.white, align: "center", margin: 0 });
  s.addText("Lead Expert: Anish Chapagain", { x: 6.5, y: 5.27, w: 3.35, h: 0.32, fontSize: 9, color: C.goldLight, align: "right", margin: 0, bold: true });
}

function addDayBadge(s, current = 3) {
  const startY = 0.56, itemH = 4.5 / 6;
  s.addShape("rect", { x: 9.62, y: startY, w: 0.38, h: 4.5, fill: { color: C.lightGray } });
  ["1","2","3","4","5","6"].forEach((d, i) => {
    const active = (i + 1) === current;
    s.addShape("rect", { x: 9.62, y: startY + i * itemH, w: 0.38, h: itemH - 0.02, fill: { color: active ? C.gold : C.lightGray } });
    s.addText(`D${d}`, { x: 9.62, y: startY + i * itemH, w: 0.38, h: itemH - 0.02, fontSize: 7, color: active ? C.darkText : C.midGray, align: "center", bold: active, margin: 0 });
  });
}

function sessionPill(s, label, color = C.gold) {
  s.addShape("rect", { x: 0.35, y: 1.08, w: 2.6, h: 0.32, fill: { color } });
  s.addText(label, { x: 0.35, y: 1.08, w: 2.6, h: 0.32, fontSize: 9, bold: true, color: C.darkText, align: "center", margin: 0 });
}

function quizSlide(pres, title, subtitle, questions, session) {
  const s = pres.addSlide();
  s.background = { color: C.green };
  s.addShape("ellipse", { x: 7.0, y: -1.0, w: 5.0, h: 5.0, fill: { color: C.greenLight, transparency: 68 } });
  s.addShape("ellipse", { x: -0.8, y: 3.5,  w: 3.8, h: 3.8, fill: { color: C.greenDark,  transparency: 60 } });
  s.addImage({ data: logoData, x: 0.3, y: 0.22, w: 1.4, h: 0.42 });
  s.addShape("rect", { x: 0.35, y: 0.88, w: 1.8, h: 0.36, fill: { color: C.gold } });
  s.addText("QUICK QUIZ", { x: 0.35, y: 0.88, w: 1.8, h: 0.36, fontSize: 11, bold: true, color: C.darkText, align: "center", margin: 0 });
  s.addText(title,    { x: 0.35, y: 1.35, w: 9.3, h: 0.52, fontSize: 24, bold: true, color: C.white, fontFace: "Trebuchet MS", margin: 0 });
  s.addText(subtitle, { x: 0.35, y: 1.84, w: 9.3, h: 0.28, fontSize: 11, color: C.goldLight, italic: true, margin: 0 });
  questions.forEach((item, i) => {
    const y = 2.22 + i * 1.0;
    s.addShape("rect", { x: 0.35, y, w: 9.25, h: 0.9, fill: { color: C.greenDark }, shadow: makeShadow() });
    s.addShape("rect", { x: 0.35, y, w: 0.06, h: 0.9, fill: { color: C.gold } });
    s.addText(item.q,    { x: 0.5,  y: y + 0.04, w: 5.55, h: 0.44, fontSize: 10, bold: true, color: C.white,    margin: 0 });
    s.addText(item.opts, { x: 0.5,  y: y + 0.52, w: 5.55, h: 0.3,  fontSize: 9,              color: C.goldLight, margin: 0 });
    s.addShape("rect",   { x: 6.1,  y: y + 0.06, w: 3.4,  h: 0.76, fill: { color: C.green } });
