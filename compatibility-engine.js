
(function(){
  const fallback = {
    shimano: null, sram: null, brakes: null, standards: null, bikes: null
  };
  const DB = { loaded:false, data:{} };
  const DATA_FILES = {
    shimano:'data/shimano.json',
    sram:'data/sram.json',
    brakes:'data/brakes.json',
    standards:'data/standards.json',
    bikes:'data/bikes.json'
  };

  function norm(v){ return String(v||'').trim().toUpperCase().replace(/\s+/g,' '); }
  function byId(id){ return document.getElementById(id); }
  function setVal(id,v){ const el=byId(id); if(el) el.value=v; }

  async function loadDb(){
    const entries = await Promise.all(Object.entries(DATA_FILES).map(async ([key,url])=>{
      try{
        const res = await fetch(url, {cache:'no-store'});
        if(!res.ok) throw new Error(res.status+' '+url);
        return [key, await res.json(), null];
      }catch(e){ return [key, null, e]; }
    }));
    entries.forEach(([k,data])=>{ DB.data[k]=data; });
    DB.loaded = Object.values(DB.data).some(Boolean);
    const st=byId('compatDbStatus');
    if(st){
      const ok = Object.values(DB.data).filter(Boolean).length;
      st.textContent = ok ? `Base chargée : ${ok}/5 fichiers JSON` : 'Base non chargée : vérifier les dossiers /data et /js sur GitHub Pages';
      st.style.color = ok ? 'var(--green)' : '#ef4444';
    }
  }

  function getBrandDb(){
    const b = byId('cpBrand')?.value || 'shimano';
    return DB.data[b] || {derailleurs:[], shifters:[], cassettes:[], chains:[]};
  }

  function findRef(list, ref){
    const n=norm(ref);
    if(!n) return null;
    return (list||[]).find(x => norm(x.ref)===n || n.includes(norm(x.ref)) || norm(x.ref).includes(n));
  }

  function parseCassette(input){
    const n=norm(input);
    const m=n.match(/(\d{2})\s*[-/]\s*(\d{2})/);
    if(!m) return null;
    return {smallest:+m[1], largest:+m[2], range:m[1]+'-'+m[2]};
  }

  function resultBox(id, status, title, lines){
    const el=byId(id); if(!el) return;
    let cls = status==='ok'?'ok':status==='ko'?'ko':'warn';
    let label = status==='ok'?'COMPATIBLE':status==='ko'?'NON COMPATIBLE':'COMPATIBLE SOUS CONDITIONS';
    el.innerHTML = `
      <div class="compat-pro-status ${cls}">${label} · ${escapeHtml(title||'Analyse')}</div>
      <div class="compat-pro-list">
        ${(lines||[]).map(l=>`<div class="compat-pro-line ${l.type||''}">${l.html||escapeHtml(l.text||'')}</div>`).join('')}
      </div>`;
    el.classList.add('show');
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  window.compatProTab = function(name, btn){
    document.querySelectorAll('.compat-pro-tab').forEach(b=>b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    document.querySelectorAll('.compat-pro-panel').forEach(p=>p.classList.remove('active'));
    const map={transmission:'compatPanelTransmission', freinage:'compatPanelFreinage', standards:'compatPanelStandards', velo:'compatPanelVelo'};
    byId(map[name])?.classList.add('active');
  };

  window.compatFillDemo = function(type){
    if(type==='transmission'){
      setVal('cpBrand','shimano'); setVal('cpFreehub','HG'); setVal('cpShifter','ST-R7000'); setVal('cpRearDerailleur','RD-R7000-GS'); setVal('cpCassette','CS-HG700 11-34'); setVal('cpChain','CN-HG601');
    }
    if(type==='brakes'){
      setVal('cpBrakeLever','ST-RX400'); setVal('cpBrakeCaliper','BR-RX400'); setVal('cpRotor','160'); setVal('cpBrakeMount','Flat mount');
    }
    if(type==='standards'){
      setVal('cpBbStandard','BSA'); setVal('cpCrankAxle','24mm Shimano'); setVal('cpFrameAxle','QR 100/135'); setVal('cpWheelAxle','12x100 / 12x142');
    }
    if(type==='bike'){
      setVal('cpBikeBrand','Genesis'); setVal('cpBikeModel','Croix de Fer 20'); setVal('cpBikeYear','2024');
    }
  };

  window.compatRunTransmission = function(){
    const db=getBrandDb();
    const sh=findRef(db.shifters, byId('cpShifter')?.value);
    const rd=findRef(db.derailleurs, byId('cpRearDerailleur')?.value);
    const cas=findRef(db.cassettes, byId('cpCassette')?.value);
    const chain=findRef(db.chains, byId('cpChain')?.value);
    const freehub=norm(byId('cpFreehub')?.value);
    const parsed=parseCassette(byId('cpCassette')?.value);
    const lines=[]; let errors=0, warns=0;

    if(!sh){ lines.push({type:'warn',text:'Commande non trouvée dans la base. Vérifier la référence ou enrichir le JSON.'}); warns++; }
    else lines.push({type:'ok',html:`Commande reconnue : <strong>${escapeHtml(sh.ref)}</strong> · ${escapeHtml(sh.speeds)}v · tirage ${escapeHtml(sh.cablePull)}`});
    if(!rd){ lines.push({type:'warn',text:'Dérailleur arrière non trouvé dans la base.'}); warns++; }
    else lines.push({type:'ok',html:`Dérailleur reconnu : <strong>${escapeHtml(rd.ref)}</strong> · max pignon ${rd.maxSprocket}D · capacité ${rd.capacity}D`});
    if(!cas && !parsed){ lines.push({type:'warn',text:'Cassette non trouvée et plage non lisible. Format conseillé : CS-HG700 11-34.'}); warns++; }
    else {
      const largest=(cas&&cas.largest)||(parsed&&parsed.largest);
      const smallest=(cas&&cas.smallest)||(parsed&&parsed.smallest);
      lines.push({type:'ok',html:`Cassette analysée : <strong>${escapeHtml((cas&&cas.ref)||byId('cpCassette')?.value)}</strong> · ${smallest}-${largest}`});
      if(rd && largest > rd.maxSprocket){ lines.push({type:'ko',html:`Grand pignon ${largest}D supérieur au maximum constructeur du dérailleur (${rd.maxSprocket}D).`}); errors++; }
      if(rd && smallest < rd.minSprocket){ lines.push({type:'warn',html:`Petit pignon ${smallest}D inférieur à la plage renseignée (${rd.minSprocket}D). À vérifier constructeur.`}); warns++; }
    }
    if(!chain){ lines.push({type:'warn',text:'Chaîne non trouvée dans la base.'}); warns++; }
    else lines.push({type:'ok',html:`Chaîne reconnue : <strong>${escapeHtml(chain.ref)}</strong> · ${chain.speeds}v · ${escapeHtml(chain.type)}`});
    if(sh && rd){
      if(sh.speeds !== rd.speeds){ lines.push({type:'ko',html:`Nombre de vitesses incohérent : commande ${sh.speeds}v / dérailleur ${rd.speeds}v.`}); errors++; }
      if(sh.cablePull !== rd.cablePull){ lines.push({type:'ko',html:`Tirage câble incompatible : ${escapeHtml(sh.cablePull)} ≠ ${escapeHtml(rd.cablePull)}.`}); errors++; }
      if(sh.speeds === rd.speeds && sh.cablePull === rd.cablePull) lines.push({type:'ok',text:'Commande et dérailleur : vitesses et tirage câble cohérents.'});
    }
    if(chain && sh && chain.speeds !== sh.speeds){ lines.push({type:'ko',html:`Chaîne ${chain.speeds}v non cohérente avec commande ${sh.speeds}v.`}); errors++; }
    if(cas && sh && cas.speeds !== sh.speeds){ lines.push({type:'ko',html:`Cassette ${cas.speeds}v non cohérente avec commande ${sh.speeds}v.`}); errors++; }
    if(cas && freehub && norm(cas.freehub)!==freehub){
      lines.push({type:'ko',html:`Corps roue libre requis : ${escapeHtml(cas.freehub)}. Sélection actuelle : ${escapeHtml(freehub)}.`}); errors++;
    } else if(cas) {
      lines.push({type:'ok',html:`Corps roue libre : ${escapeHtml(freehub)} compatible avec la cassette.`});
    }
    const status = errors ? 'ko' : warns ? 'warn' : 'ok';
    resultBox('compatTransmissionResult', status, 'Transmission', lines);
  };

  window.compatRunBrakes = function(){
    const db=DB.data.brakes || {levers:[],calipers:[]};
    const lever=findRef(db.levers, byId('cpBrakeLever')?.value);
    const cal=findRef(db.calipers, byId('cpBrakeCaliper')?.value);
    const rotor=Number(byId('cpRotor')?.value||0);
    const mount=String(byId('cpBrakeMount')?.value||'');
    const lines=[]; let errors=0, warns=0;
    if(!lever){ lines.push({type:'warn',text:'Levier non trouvé dans la base.'}); warns++; } else lines.push({type:'ok',html:`Levier reconnu : <strong>${escapeHtml(lever.ref)}</strong> · ${escapeHtml(lever.type)}`});
    if(!cal){ lines.push({type:'warn',text:'Étrier non trouvé dans la base.'}); warns++; } else lines.push({type:'ok',html:`Étrier reconnu : <strong>${escapeHtml(cal.ref)}</strong> · ${escapeHtml(cal.type)} · montage ${escapeHtml(cal.mount||'n/c')}`});
    if(lever && cal){
      if(lever.type !== cal.type){ lines.push({type:'ko',html:`Type de commande incompatible : levier ${escapeHtml(lever.type)} / étrier ${escapeHtml(cal.type)}.`}); errors++; }
      else lines.push({type:'ok',text:'Type levier / étrier cohérent.'});
      if(lever.fluid || cal.fluid){
        if(lever.fluid !== cal.fluid){ lines.push({type:'ko',html:`Fluide incompatible : levier ${escapeHtml(lever.fluid)} / étrier ${escapeHtml(cal.fluid)}.`}); errors++; }
        else lines.push({type:'ok',html:`Fluide hydraulique cohérent : ${escapeHtml(lever.fluid)}.`});
      }
    }
    if(cal && Array.isArray(cal.rotors)){
      if(!cal.rotors.includes(rotor)){ lines.push({type:'warn',html:`Rotor ${rotor} mm non listé pour cet étrier dans la base. Adaptateur ou limite cadre/fourche à vérifier.`}); warns++; }
      else lines.push({type:'ok',html:`Rotor ${rotor} mm listé compatible côté étrier.`});
    }
    if(cal && cal.mount && !norm(cal.mount).includes(norm(mount).split(' ')[0])){ lines.push({type:'warn',html:`Montage cadre/fourche ${escapeHtml(mount)} : vérifier adaptateur avec étrier ${escapeHtml(cal.mount)}.`}); warns++; }
    const status=errors?'ko':warns?'warn':'ok';
    resultBox('compatBrakeResult', status, 'Freinage', lines);
  };

  window.compatRunStandards = function(){
    const db=DB.data.standards || {bottomBrackets:[], axles:[]};
    const bb=byId('cpBbStandard')?.value;
    const axle=byId('cpCrankAxle')?.value;
    const frame=byId('cpFrameAxle')?.value;
    const wheel=byId('cpWheelAxle')?.value;
    const lines=[]; let warns=0, errors=0;
    const bbObj=(db.bottomBrackets||[]).find(x=>x.standard===bb);
    if(bbObj){
      const comp=(bbObj.compatibleAxles||[]).some(a=>norm(a).includes(norm(axle).split(' ')[0]) || norm(axle).includes(norm(a).split(' ')[0]));
      lines.push({type:'ok',html:`Boîtier ${escapeHtml(bb)} : ${bbObj.thread?escapeHtml(bbObj.thread):'Ø '+escapeHtml(bbObj.diameter)+' mm'} · largeurs ${escapeHtml((bbObj.shellWidths||[]).join('/'))} mm.`});
      if(comp) lines.push({type:'ok',html:`Axe pédalier ${escapeHtml(axle)} : compatible direct ou avec cuvettes adaptées selon la base.`});
      else { lines.push({type:'warn',html:`Axe ${escapeHtml(axle)} non listé pour ${escapeHtml(bb)}. Adaptateur spécifique à vérifier.`}); warns++; }
    } else { lines.push({type:'warn',text:'Standard de boîtier absent de la base.'}); warns++; }
    const ax=(db.axles||[]).find(x=>x.frame===frame && x.wheel===wheel);
    if(ax){
      const t=norm(ax.result).includes('NON')?'ko':norm(ax.result).includes('SEULEMENT')||norm(ax.result).includes('SAUF')?'warn':'ok';
      if(t==='ko') errors++; if(t==='warn') warns++;
      lines.push({type:t,html:`Axes roues : cadre <strong>${escapeHtml(frame)}</strong> / roue <strong>${escapeHtml(wheel)}</strong> → ${escapeHtml(ax.result)}.`});
    } else { lines.push({type:'warn',text:'Combinaison axe non trouvée dans la base. Vérifier entraxes et end caps.'}); warns++; }
    const status=errors?'ko':warns?'warn':'ok';
    resultBox('compatStandardsResult', status, 'Standards atelier', lines);
  };

  window.compatSearchBike = function(){
    const db=DB.data.bikes || {models:[]};
    const brand=norm(byId('cpBikeBrand')?.value);
    const model=norm(byId('cpBikeModel')?.value);
    const year=norm(byId('cpBikeYear')?.value);
    const matches=(db.models||[]).filter(b=>{
      return (!brand || norm(b.brand).includes(brand)) && (!model || norm(b.model).includes(model) || model.includes(norm(b.model))) && (!year || norm(b.year).includes(year) || year.includes(norm(b.year)));
    });
    const lines=[];
    if(!matches.length){
      resultBox('compatBikeResult','warn','Recherche vélo',[{type:'warn',text:'Aucun vélo trouvé dans /data/bikes.json. Ajouter la fiche modèle ou élargir la recherche.'}]);
      return;
    }
    matches.forEach(b=>{
      lines.push({type:'ok',html:`<div class="compat-pro-bike-head">${escapeHtml(b.brand)} ${escapeHtml(b.model)} · ${escapeHtml(b.year)}</div><div class="compat-pro-bike-meta">${escapeHtml(b.category||'')}</div>`});
      ['drivetrain','brakes','wheelAxles','bottomBracket','headset','seatpost','tireClearance'].forEach(k=>{
        if(b[k]) lines.push({html:`<strong>${escapeHtml(label(k))}</strong> : ${escapeHtml(b[k])}`});
      });
      (b.notes||[]).forEach(n=>lines.push({type:'warn',html:`Note atelier : ${escapeHtml(n)}`}));
    });
    resultBox('compatBikeResult','ok','Fiche vélo',lines);
  };

  function label(k){
    return {drivetrain:'Transmission origine', brakes:'Freinage', wheelAxles:'Axes / roues', bottomBracket:'Boîtier', headset:'Jeu de direction', seatpost:'Tige de selle', tireClearance:'Passage pneus'}[k] || k;
  }

  window.addEventListener('DOMContentLoaded', loadDb);
})();
