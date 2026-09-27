import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { comparisonScreens } from '../render/comparison.mjs';
import { comparisonHtml } from '../render/report.mjs';

test('comparison pairs only the same page, device dimensions and existing captures', () => {
 const dir=mkdtempSync(join(tmpdir(),'sitemaxxing-compare-'));
 try {
  const file=join(dir,'screen.jpg'); writeFileSync(file,'fixture');
  const audit=(url,width=375)=>({finalUrl:url,screens:[{id:'iphone',label:'Phone <test>',width,height:667,foldJpeg:file,score:90}]});
  const before=audit('https://example.com/a'); const now=audit('https://example.com/a');
  const screens=comparisonScreens(before,now);
  assert.equal(screens.length,1);
  assert.equal(comparisonScreens(before,audit('https://example.com/b')).length,0);
  assert.equal(comparisonScreens(before,audit('https://example.com/a',393)).length,0);
  const html=comparisonHtml({screens,since:null,changes:{fixed:['<script>'],stillThere:[],new:[]}});
  assert.match(html,/Phone &lt;test&gt;/); assert.ok(!html.includes('<script>'));
  assert.match(html,/measured findings establish fixes/);
  assert.equal(comparisonHtml(null),'');
  rmSync(file); assert.equal(comparisonScreens(before,now).length,0);
 } finally { rmSync(dir,{recursive:true,force:true}); }
});
