// Shared, offline aerospace branding for every card and PDF renderer.
// Resolve relative to the module so this also works outside /opt/ro.
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";

const assets = fileURLToPath(new URL("../assets/report/", import.meta.url));
export const reportIcon = join(assets, "mascot.png");
const background = pathToFileURL(join(assets, "orbital.webp")).href;
export const brand = `<div class="report-brand"><span>SITEMAXXING</span><img alt="" src="${pathToFileURL(process.env.RO_ICON || reportIcon).href}"></div>`;
export const brandFooter = `<div class="brand-footer"><span>SITEMAXXING</span><span>BETTER WEBSITES FOR A BRIGHTER TOMORROW</span></div>`;

export const CARD_THEME = `
  body { background: linear-gradient(180deg, #040e1940, #040e1999 48%, #040e19f5 78%), url("${background}") center top / cover; color: #f3f6fc; padding: 38px 48px 35px; }
  .report-brand { display: flex; align-items: center; gap: 18px; margin-bottom: 24px; height: 46px; flex: none; }
  .report-brand span { font-size: 27px; letter-spacing: .3em; font-weight: 500; }
  .report-brand img { width: 50px; height: 46px; object-fit: contain; }
  header { gap: 0; }
  header > img { display: none; }
  .label { color: #ff866c; font-size: 19px; letter-spacing: .17em; margin-bottom: 8px; }
  h1 { color: #f3f6fc; letter-spacing: -.025em; }
  .scores { margin-top: 24px; gap: 16px; }
  .score { background: linear-gradient(125deg,#142940dd,#17293cc9); border: 1px solid #6d90b49c; box-shadow: inset 0 1px 2px #c8e3ff26; border-radius: 17px; padding: 18px; }
  .score b { font-size: 59px; font-weight: 700; }
  .score span { font-size: 19px; text-transform: uppercase; letter-spacing: .19em; color: #bfcee5; }
  .devices { height: 355px; margin-top: 25px; }
  .frame { border: 2px solid #8aa1b685; box-shadow: 0 15px 40px #0009; background: #040a13; }
  .laptop { left: 142px; width: 700px; height: 340px; border-radius: 16px; }
  .tablet { width: 216px; height: 286px; }
  .phone { width: 143px; height: 310px; }
  body > ul { margin: 22px 0 20px; padding: 17px 24px; background: #08192dde; border: 1px solid #6288ae80; border-radius: 16px; gap: 9px; }
  body > ul::before { content: 'PRIORITY FINDINGS'; display: block; color: #ff947b; font-size: 18px; letter-spacing: .17em; padding-bottom: 10px; border-bottom: 1px solid #536e8d66; }
  body > ul li { font-size: 25px; line-height: 1.28; gap: 18px; }
  .dot { width: 17px; height: 17px; }
  li .dot { margin-top: 6px; }
  .google { background: #0b1b30ed; border: 1px solid #6c8bac8c; border-radius: 15px; padding: 18px 24px; }
  .google::before { content: 'GOOGLE PREVIEW / SIMULATION'; display: block; margin-bottom: 10px; color: #adbfdb; font-size: 16px; letter-spacing: .13em; }
  .google .site { font-size: 19px; color: #a8bbd8; }
  .google .t { font-size: 27px; color: #7eb4ff; }
  .google .d { font-size: 20px; line-height: 1.3; color: #d1dcee; }
  .ai { font-size: 19px; color: #aabdD7; margin-top: 15px; gap: 8px 18px; max-height: 60px; }
  .brand-footer { display: flex; justify-content: space-between; gap: 20px; border-top: 1px solid #6b87a459; padding-top: 17px; margin-top: 20px; flex: none; font-size: 10px; color: #9db0ce; letter-spacing: .2em; }
  .rows { margin-top: 24px; gap: 12px; }
  .row { background: #0d2037df; border: 1px solid #688caf7d; border-radius: 14px; height: 180px; }
  .row .scores { margin-top: 0; color: #b9c9df; }
  .rows .shots { height: 150px; }
  .rows .lap, .rows .ph { height: 150px; }
  .rows .lap { width: 266px; }.rows .ph { width: 70px; }
  .rows .path { font-size: 26px; }.rows .scores { font-size: 20px; gap: 12px; }
  .rows li { font-size: 18px; }.rows ul { gap: 4px; }
  .why { color: #b9c9df; }
  .lap, .ph { border-color: #7d96af85; }
`;

export const PDF_THEME = `
  html, body { background: #050e1b; color: #edf3fe; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .report-backdrop { position: fixed; inset: 0; z-index: 0; background: linear-gradient(180deg,#050e1b80,#050e1bcf 48%,#050e1bf0), url("${background}") center / cover; }
  .page { z-index: 1; padding: .42in .45in .5in; }
  .page:not(.cover)::before { content: 'S I T E M A X X I N G   /   F I T   C H E C K'; display: block; color: #ff9279; font-size: 10px; letter-spacing: .08em; padding-bottom: 17px; margin-bottom: 24px; border-bottom: 1px solid #58739280; }
  .cover { padding: 0; background: #050e1b; }
  h2 { color: #f3f6ff; font-size: 27px; line-height: 1.2; letter-spacing: -.025em; margin-bottom: 22px; break-after: avoid; }
  h3 { color: #ff967b; font-size: 13px; letter-spacing: .17em; margin: 24px 0 10px; break-after: avoid; }
  .muted { color: #b0c0d8; font-size: 12px; line-height: 1.5; }
  .issue { background: #10243bbb; border: 1px solid #59799870; border-radius: 8px; padding: 13px 16px; margin-bottom: 7px; gap: 13px; line-height: 1.4; }
  .issue > div { min-width: 0; overflow-wrap: anywhere; }
  .issue b { font-size: 15px; font-weight: 600; }
  .dot.high { background: #ff7d68; }.dot.medium { background: #ffbc49; }.dot.low { background: #91a5c0; }
  figure { background: #102139cc; border-color: #617f9e80; border-radius: 9px; padding: 8px; }
  figcaption { color: #ccd8eb; font-size: 10px; min-height: 30px; flex-wrap: wrap; }
  .shot { background: #040b14; height: 226px; }.shot img { max-height: 226px; }
  .google { padding: 15px; background: #10223acf; border: 1px solid #688caf80; border-radius: 10px; }
  .google::before { content: 'GOOGLE PREVIEW / SIMULATION'; display: block; color: #b4c6df; font-size: 10px; letter-spacing: .13em; margin-bottom: 12px; }
  .google img { display: block; border-color: #597593; border-radius: 6px; }
  table { background: #0c1d30df; border: 1px solid #5a789773; }
  td { padding: 10px 12px; border-color: #50678370; } tr { break-inside: avoid; }
  .ok { color: #54e3ab; }.bad { color: #ff907d; }
  .facts { background: #10243ba8; border: 1px solid #5a78975e; border-radius: 8px; padding: 16px; line-height: 1.75; color: #b9c9e0; }
  .facts b { color: #edf3ff; }
  .pair img, .full img { border-color: #617f9e80; border-radius: 7px; }
  pre { background: #0b192cd9; border: 1px solid #56769480; border-radius: 8px; padding: 18px; font-size: 11px; line-height: 1.6; color: #dbe6f7; box-decoration-break: clone; }
  .foot { color: #93a8c5; font-size: 9px; }
  .page.flow .foot { position: static; margin-top: 24px; border-top: 1px solid #58739280; padding-top: 12px; }
`;

export const themeCard = html => html.replace("</style>", `${CARD_THEME}</style>`).replace("<body>", `<body>${brand}`).replace("</body>", `${brandFooter}</body>`);
export const themePdf = html => html.replace("</style>", `${PDF_THEME}</style>`).replace("<body>", '<body><div class="report-backdrop"></div>');
