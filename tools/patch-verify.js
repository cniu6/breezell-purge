/* 逐落点校验 v2：锚点按真实文本，覆盖 3 个宿主根 + 插件 */
const fs=require('fs'),path=require('path'),crypto=require('crypto'),os=require('os');
const HOME=os.homedir(), APPDATA=process.env.APPDATA||path.join(HOME,'AppData','Roaming');
const APP=path.join(HOME,'AppData','Local','Programs','Breezell','resources','app');
const HOTROOT=path.join(APPDATA,'Breezell','hot-runtime');
const EXT=path.join(HOME,'.breezell-editor','extensions');
const rd=f=>{try{return fs.readFileSync(f,'utf8');}catch(e){return null;}};
const sha16=f=>{try{return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('base64').replace(/=+$/,'').slice(0,16);}catch(e){return null;}};

const roots=[];
try{ for(const d of fs.readdirSync(HOTROOT)){ const p=path.join(HOTROOT,d); if(fs.statSync(p).isDirectory()&&fs.existsSync(path.join(p,'product.json'))) roots.push({name:'hot '+d.split('-')[0],dir:p}); } }catch(e){}
roots.push({name:'install',dir:APP});

const rows=[]; const add=(root,site,ok,detail)=>rows.push({root,site,ok:!!ok,detail:detail||''});

for(const r of roots){
  const wb=rd(path.join(r.dir,'out','vs','workbench','workbench.desktop.main.js'))||'';
  const eh=rd(path.join(r.dir,'out','vs','workbench','api','node','extensionHostProcess.js'))||'';
  const wk=rd(path.join(r.dir,'out','vs','workbench','api','worker','extensionHostWorkerMain.js'))||'';
  const mapp=rd(path.join(r.dir,'out','main.app.js'))||'';

  add(r.name,'wb 白名单含 entanglement', /\["normal","plan","analyze","agent","entanglement"\]/.test(wb));
  add(r.name,'wb hm-live 模式同步', wb.includes('/*bzl-offline:hm-live*/'));
  add(r.name,'wb hm-gate 按模式门控', wb.includes('/*bzl-offline:hm-gate*/'));
  add(r.name,'wb 门控含 bzl-purge 判定', /bzl-purge"\)<0\)return/.test(wb));
  add(r.name,'wb pSys 调用点', /\.pSys\?[A-Za-z_$][\w$]*\.pSys\(/.test(wb) || /BreezellOffline\.pSys/.test(wb));
  add(r.name,'wb pVars 钩子', wb.includes('pVars:function'));
  add(r.name,'wb 命令桥 → 插件', /bzlPurge\.hostmode/.test(wb), 'hits='+(wb.match(/bzlPurge\.hostmode/g)||[]).length);
  add(r.name,'exhost 白名单含 entanglement', eh.includes('"entanglement"'));
  add(r.name,'worker 白名单含 entanglement', wk.includes('"entanglement"'));
  add(r.name,'main.app 白名单', mapp? mapp.includes('"entanglement"') : null, mapp?'':'无 main.app.js');

  const pj=(()=>{try{return JSON.parse(fs.readFileSync(path.join(r.dir,'product.json'),'utf8'));}catch(e){return null;}})();
  for(const rel of ['vs/workbench/workbench.desktop.main.js','vs/workbench/api/node/extensionHostProcess.js']){
    const d=pj&&pj.checksums&&pj.checksums[rel];
    if(!d){ add(r.name,'校验和 '+path.basename(rel),null,'未登记'); continue; }
    const a=sha16(path.join(r.dir,'out',rel));
    add(r.name,'校验和 '+path.basename(rel), d.slice(0,16)===a, d.slice(0,16)===a?'match':(d.slice(0,16)+'≠'+a));
  }
}

let pd=null;
try{ const d=fs.readdirSync(EXT).find(x=>/cniu6\.breezell-purge-/.test(x)); if(d) pd=path.join(EXT,d); }catch(e){}
if(pd){
  const ext=rd(path.join(pd,'dist','extension.js'))||'';
  const con=rd(path.join(pd,'dist','console.js'))||'';
  const html=rd(path.join(pd,'ui','console.html'))||'';
  const pkg=(()=>{try{return JSON.parse(fs.readFileSync(path.join(pd,'package.json'),'utf8'));}catch(e){return {};}})();
  const t='plugin '+pkg.version;
  add(t,'自注入短路', ext.includes("'self-inject'"));
  add(t,'strict 并入 sysBlock', /pm\s*===\s*'strict'\s*\?\s*sysBlock\(\)/.test(ext));
  add(t,'inject.js', fs.existsSync(path.join(pd,'dist','inject.js')));
  add(t,'lastinject 落盘', ext.includes('bzl-purge-lastinject.json'));
  add(t,'hostModeNow 门控', ext.includes('hostModeNow'));
  add(t,'面板 cSelf / nBudget / selTarget / lastInj', html.includes('cSelf')&&html.includes('nBudget')&&html.includes('selTarget')&&html.includes('lastInj'));
  add(t,'console 三新键', con.includes('selfInject')&&con.includes('ctxBudget')&&con.includes('injectTarget'));
  add(t,'id/version', pkg.publisher==='cniu6'&&pkg.name==='breezell-purge', (pkg.publisher||'')+'.'+(pkg.name||'')+'@'+(pkg.version||''));
  add(t,'三模式声明', ((pkg.contributes&&pkg.contributes.breezell&&pkg.contributes.breezell.ui&&pkg.contributes.breezell.ui.modes)||[]).length===3);
}

const okAll=rows.filter(x=>x.ok).length, total=rows.length;
fs.writeFileSync(path.join(__dirname,'_patch-verify.json'),JSON.stringify({at:new Date().toISOString(),ok:okAll,total,rows},null,2));
const lines=rows.map(r=>`${r.ok===true?'✅':r.ok===false?'❌':'➖'} ${r.root} · ${r.site}${r.detail?'  ('+r.detail+')':''}`);
console.log(lines.join('\n'));
console.log('--- ',okAll+'/'+total,'  ❌='+rows.filter(x=>x.ok===false).length);
