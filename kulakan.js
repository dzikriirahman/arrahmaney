// Tab "Kulakan": dashboard widget, buku kulakan, supplier & pemasukan.
// Mandiri: hapus tombol nav 'kulakan', div #kulakan, dan file ini (+ kulakan.css) bila tidak dipakai lagi.
// Memakai supabaseClient & sesi login dari aplikasi utama. Tabel: supplier, kulakan, pemasukan (lihat kulakan-setup.sql).
(function () {
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rp=n=>'Rp '+Math.round(n||0).toLocaleString('id-ID');
const jt=n=>n>=1e6?(n/1e6).toFixed(2).replace('.',',')+' jt':n>=1e3?Math.round(n/1e3)+' rb':String(Math.round(n));
const rpS=n=>'Rp '+jt(n);
const tc=s=>String(s||'').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
const tgl=d=>new Date(d+'T00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short'});
const pct=(m,d=1)=>(m*100).toFixed(d).replace('.',',')+'%';
const sum=(a,f)=>a.reduce((x,r)=>x+Number(f(r)||0),0);
const mcls=m=>m>=.1?'g':m>=.06?'y':'rd';
const COL=['#0E2A21','#F2B632','#2F7F6B','#C2542D','#4B6A9B','#9DB5A8','#7A4B7A'];
const store=(k,v)=>{try{if(v===undefined)return JSON.parse(localStorage.getItem(k));localStorage.setItem(k,JSON.stringify(v))}catch(e){return null}};



const st={kulakan:[],supplier:[],pemasukan:[],sub:'ringkasan',q:'',kat:'Semua',fk:'Semua',fs:'Semua',panel:false,hidden:store('kx-hidden')||[],loaded:false,error:''};
const root=()=>document.getElementById('kulakan-root');
const $=id=>document.getElementById(id);
const toast=(m,t)=>{ if(window.showToast) window.showToast(m,t||'success'); else alert(m); };
const NUM=['qty','harga_beli','biaya_angkut','harga_jual','isi_per_satuan','pemasukan','keuntungan'];

async function load(){
  if(!window.supabaseClient && typeof supabaseClient==='undefined'){ st.error='Koneksi database belum siap.'; return; }
  const [k,s,p]=await Promise.all([
    supabaseClient.from('kulakan').select('*').order('tanggal').order('id'),
    supabaseClient.from('supplier_kulakan').select('*').order('nama'),
    supabaseClient.from('pemasukan').select('*').order('tanggal')]);
  const err=k.error||s.error||p.error;
  if(err){ st.error=/relation|does not exist|schema cache/i.test(err.message)?'Tabel kulakan belum dibuat. Jalankan kulakan-setup.sql di Supabase SQL Editor.':err.message; return; }
  st.error='';Object.assign(st,{kulakan:k.data,supplier:s.data,pemasukan:p.data,loaded:true});
}

/* ---------- chart helpers ---------- */
function donut(items,label){
  const tot=sum(items,i=>i.v)||1,R=52,C=2*Math.PI*R;let off=0;
  const seg=items.map((i,x)=>{const len=i.v/tot*C,s=`<circle r="${R}" cx="70" cy="70" fill="none" stroke="${COL[x%COL.length]}" stroke-width="22" stroke-dasharray="${len} ${C-len}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"/>`;off+=len;return s}).join('');
  return `<div class="dn"><svg viewBox="0 0 140 140" width="150" height="150" role="img" aria-label="${esc(label)}">${seg}<text x="70" y="66" text-anchor="middle" font-size="11" fill="#3E5A4D">Total</text><text x="70" y="84" text-anchor="middle" font-size="15" font-weight="700" fill="#0E2A21">${jt(tot)}</text></svg>
  <div class="leg">${items.map((i,x)=>`<div><span><i style="background:${COL[x%COL.length]}"></i>${esc(i.l)}</span><b>${pct(i.v/tot,0)}</b></div>`).join('')}</div></div>`;
}
function vbars(groups,label,series,W=560){
  const H=210,pad=28,max=Math.max(1,...groups.flatMap(g=>g.vals)),gw=(W-20)/groups.length,bw=Math.min(46,(gw-14)/series.length);
  let s=`<line x1="0" x2="${W}" y1="${H-pad}" y2="${H-pad}" stroke="#DCE2DA"/>`;
  groups.forEach((g,gi)=>{const x0=10+gi*gw+(gw-bw*series.length)/2;
    g.vals.forEach((v,si)=>{const h=v/max*(H-pad-24);s+=`<rect x="${x0+si*bw}" y="${H-pad-h}" width="${bw-4}" height="${h}" rx="6" fill="${series[si].c}"/><text x="${x0+si*bw+(bw-4)/2}" y="${H-pad-h-6}" text-anchor="middle" font-size="11" font-weight="700" fill="#0E2A21">${g.fmt?g.fmt(v):jt(v)}</text>`});
    s+=`<text x="${10+gi*gw+gw/2}" y="${H-8}" text-anchor="middle" font-size="12" fill="#3E5A4D">${esc(g.l)}</text>`});
  const lg=series.length>1?`<div style="display:flex;gap:16px;font-size:13px;color:#3E5A4D">${series.map(x=>`<span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${x.c};margin-right:6px"></i>${x.n}</span>`).join('')}</div>`:'';
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="${esc(label)}">${s}</svg>${lg}`;
}
const hrow=(l,v,w,extra='')=>`<div class="row"><div class="l"><b>${esc(l)}</b><span>${v}</span></div><div class="bar"><i style="width:${Math.max(2,w*100)}%;${extra}"></i></div></div>`;

/* ---------- analytics ---------- */
function compute(){
  let k=st.kulakan.filter(r=>(st.fk==='Semua'||r.kategori===st.fk)&&(st.fs==='Semua'||r.supplier===st.fs));
  k=k.map(r=>({...r,rev:r.harga_jual*r.qty,laba:r.harga_jual*r.qty-r.total_modal,hpp:r.total_modal/r.qty}));
  const group=(key)=>{const m={};k.forEach(r=>m[r[key]]=(m[r[key]]||0)+Number(r.total_modal));return Object.entries(m).map(([l,v])=>({l,v})).sort((a,b)=>b.v-a.v)};
  const tot=sum(k,r=>r.total_modal),rev=sum(k,r=>r.rev),laba=rev-tot,angkut=sum(k,r=>r.biaya_angkut);
  const masuk=sum(st.pemasukan,r=>r.pemasukan),hari=st.pemasukan.length;
  const bySup=group('supplier'),byKat=group('kategori');
  const katM=byKat.map(c=>{const rr=k.filter(r=>r.kategori===c.l);const rv=sum(rr,r=>r.rev);return{l:c.l,m:rv?(rv-c.v)/rv:0,v:c.v}}).sort((a,b)=>a.m-b.m);
  const dates=[...new Set([...k.map(r=>r.tanggal),...st.pemasukan.map(p=>p.tanggal)])].sort();
  const harian=dates.map(d=>({d,belanja:sum(k.filter(r=>r.tanggal===d),r=>r.total_modal),masuk:sum(st.pemasukan.filter(p=>p.tanggal===d),p=>p.pemasukan)}));
  const bk=[[0,.06,'< 6%','#C2542D'],[.06,.10,'6–10%','#F2B632'],[.10,.15,'10–15%','#2F7F6B'],[.15,.25,'15–25%','#0E2A21'],[.25,9,'> 25%','#4B6A9B']].map(([a,b,l,c])=>({l,c,n:k.filter(r=>r.margin>=a&&r.margin<b).length}));
  const notaM={};k.forEach(r=>{const key=r.supplier+'|'+r.tanggal+'|'+r.no_nota;(notaM[key]=notaM[key]||{sup:r.supplier,tgl:r.tanggal,no:r.no_nota,v:0,n:0});notaM[key].v+=Number(r.total_modal);notaM[key].n++});
  const notas=Object.values(notaM).sort((a,b)=>b.v-a.v);
  const low=k.filter(r=>r.margin<.06).sort((a,b)=>a.margin-b.margin).map(r=>{const target=Math.ceil(r.hpp/.9/500)*500;return{...r,target,gain:(target-r.harga_jual)*r.qty}});
  const topLaba=[...k].sort((a,b)=>b.laba-a.laba).slice(0,8);
  const topM=[...k].filter(r=>r.laba>0).sort((a,b)=>b.margin-a.margin).slice(0,6);
  return{k,tot,rev,laba,angkut,masuk,hari,bySup,byKat,katM,harian,bk,notas,low,topLaba,topM,barang:sum(k,r=>r.qty*r.harga_beli),mw:rev?laba/rev:0};
}

/* ---------- widgets ---------- */
const W=[
 {id:'k1',t:'Total belanja kulakan',s:3,r:c=>`<div class="kpi"><small>Total belanja kulakan</small><b style="margin:12px 0 8px">${rpS(c.tot)}</b><span>${c.k.length} barang · ${c.bySup.length} pemasok</span></div>`},
 {id:'k2',t:'Pemasukan tercatat',s:3,r:c=>`<div class="kpi"><small>Pemasukan tercatat</small><b style="margin:12px 0 8px">${rpS(c.masuk)}</b><span>${c.hari} hari · rata-rata ${rpS(c.hari?c.masuk/c.hari:0)}/hari</span></div>`},
 {id:'k3',t:'Potensi laba kotor',s:3,r:c=>`<div class="kpi"><small>Potensi laba kotor</small><b style="margin:12px 0 8px">${rpS(c.laba)}</b><span>Margin rata-rata tertimbang ${pct(c.mw)}</span></div>`},
 {id:'k4',t:'Belanja vs pemasukan',s:3,r:c=>{const x=c.masuk?c.tot/c.masuk:0;return `<div class="kpi"><small>Belanja ÷ pemasukan</small><b style="margin:12px 0 8px">${pct(x,0)}</b><span>${x>.9?'Hampir seluruh uang masuk tertanam di stok':'Arus kas masih longgar'}</span></div>`}},
 {id:'arus',t:'Pemasukan vs belanja harian',s:8,r:c=>`<h3>Pemasukan vs belanja harian</h3><div class="sub">Garis dasar: apakah uang masuk menutup kulakan</div>${vbars(c.harian.map(h=>({l:tgl(h.d),vals:[h.masuk,h.belanja]})),'Grafik batang pemasukan dan belanja per hari',[{n:'Pemasukan',c:'#0E2A21'},{n:'Belanja kulakan',c:'#F2B632'}])}`},
 {id:'sup',t:'Pangsa supplier',s:4,r:c=>`<h3>Pangsa supplier</h3><div class="sub">Siapa yang menerima uang belanja</div>${donut([...c.bySup.slice(0,5).map(x=>({l:tc(x.l),v:x.v})),...(c.bySup.length>5?[{l:'Lainnya',v:sum(c.bySup.slice(5),x=>x.v)}]:[])],'Pangsa belanja per supplier')}`},
 {id:'kat',t:'Pangsa kategori',s:4,r:c=>`<h3>Belanja per kategori</h3><div class="sub">Sebaran modal di tiap jenis barang</div>${donut(c.byKat.map(x=>({l:x.l,v:x.v})),'Pangsa belanja per kategori')}`},
 {id:'katm',t:'Margin per kategori',s:4,r:c=>`<h3>Margin per kategori</h3><div class="sub">Tertimbang, dari laba ÷ nilai jual</div>${c.katM.map(x=>hrow(x.l,`<b class="pill ${mcls(x.m)}">${pct(x.m)}</b>`,Math.min(1,x.m/.25))).join('')}`},
 {id:'hist',t:'Sebaran margin',s:4,r:c=>`<h3>Sebaran margin barang</h3><div class="sub">Jumlah barang tiap rentang</div>${vbars(c.bk.map(b=>({l:b.l,vals:[b.n],fmt:v=>v})),'Histogram jumlah barang menurut margin',[{n:'Barang',c:'#2F7F6B'}],300)}`},
 {id:'laba',t:'Penyumbang laba terbesar',s:6,r:c=>{const m=c.topLaba[0]?.laba||1;return `<h3>Penyumbang laba terbesar</h3><div class="sub">Potensi laba kotor per barang</div>${c.topLaba.map(r=>hrow(tc(r.barang),rp(r.laba),r.laba/m,'background:#2F7F6B')).join('')}`}},
 {id:'low',t:'Margin tipis',s:6,r:c=>`<h3>Margin di bawah 6%</h3><div class="sub">Saran harga agar margin 10%${c.low.length?` · tambahan laba ${rp(sum(c.low,r=>r.gain))}`:''}</div>${c.low.length?`<div class="sc"><table style="min-width:420px"><tbody>${c.low.slice(0,6).map(r=>`<tr><td><b>${esc(tc(r.barang))}</b><div style="font-size:12px;color:#4D6B5D">${esc(tc(r.supplier))}</div></td><td class="r"><span class="pill rd">${pct(r.margin)}</span></td><td class="r" style="font-size:13px">${rp(r.harga_jual)} → <b>${rp(r.target)}</b></td></tr>`).join('')}</tbody></table></div>`:'<span class="pill g">Tidak ada</span>'}`},
 {id:'top',t:'Margin tertinggi',s:4,r:c=>`<h3>Margin tertinggi</h3><div class="sub">Barang paling menguntungkan per rupiah</div>${c.topM.map(r=>`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding-bottom:10px;border-bottom:1px solid var(--bg)"><div><b>${esc(tc(r.barang))}</b><div style="font-size:12px;color:#4D6B5D">${esc(tc(r.supplier))}</div></div><span class="pill g">${pct(r.margin)}</span></div>`).join('')}`},
 {id:'nota',t:'Nota terbesar',s:4,r:c=>{const m=c.notas[0]?.v||1;return `<h3>Nota terbesar</h3><div class="sub">${c.notas.length} nota/pengiriman tercatat</div>${c.notas.slice(0,6).map(n=>hrow(`${tc(n.sup)} · ${tgl(n.tgl)}`,rp(n.v),n.v/m,'background:#4B6A9B')).join('')}`}},
 {id:'konsen',t:'Ketergantungan supplier',s:4,r:c=>{const t1=c.bySup[0],t3=sum(c.bySup.slice(0,3),x=>x.v);const a=c.tot?t1?.v/c.tot:0;return `<h3>Ketergantungan supplier</h3><div class="sub">Makin tinggi, makin rapuh bila pemasok bermasalah</div><div class="kpi"><b>${pct(a,0)}</b><span>${t1?esc(tc(t1.l)):'-'} · 3 terbesar ${pct(c.tot?t3/c.tot:0,0)}</span></div><span class="pill ${a>.5?'rd':a>.35?'y':'g'}" style="align-self:flex-start">${a>.5?'Tinggi':a>.35?'Sedang':'Sehat'}</span>`}},
 {id:'saran',t:'Catatan pengelola',s:8,dark:1,r:c=>{const a=[];const t1=c.bySup[0];
   if(t1&&c.tot&&t1.v/c.tot>.4)a.push(`${tc(t1.l)} memegang ${pct(t1.v/c.tot,0)} belanja. Minta tempo bayar atau bandingkan harga dengan satu pemasok pembanding.`);
   if(c.low.length)a.push(`${c.low.length} barang bermargin di bawah 6% (${c.low.slice(0,3).map(r=>tc(r.barang)).join(', ')}). Menaikkan ke margin 10% menambah laba ${rp(sum(c.low,r=>r.gain))} bila terjual habis.`);
   const kr=c.katM[0];if(kr)a.push(`Kategori ${kr.l} bermargin paling tipis (${pct(kr.m)}). Pantau harga beli tiap kulakan.`);
   if(c.masuk&&c.tot/c.masuk>.9)a.push(`Belanja setara ${pct(c.tot/c.masuk,0)} pemasukan. Pastikan stok lama terjual sebelum kulakan berikutnya.`);
   if(c.angkut&&c.tot&&c.angkut/c.tot>.002)a.push(`Biaya angkut ${rp(c.angkut)} (${pct(c.angkut/c.tot,2)} dari modal). Gabungkan pengiriman bila bisa.`);
   return `<div class="eyebrow" style="color:var(--gold)">Catatan pengelola</div><h3 style="font-size:24px">Yang layak dibenahi</h3><ul class="adv" style="color:#DCE8E0">${a.map(x=>`<li>${x}</li>`).join('')||'<li>Belum ada temuan.</li>'}</ul>`}},
 {id:'data',t:'Kualitas data',s:4,r:c=>{const all=st.kulakan,nm=new Set(st.supplier.map(s=>s.nama));
   const items=[
    [all.filter(r=>!r.no_nota||r.no_nota==='-').length,'baris tanpa nomor nota'],
    [[...new Set(all.map(r=>r.supplier))].filter(n=>!nm.has(n)).length,'supplier belum ada di Master Supplier'],
    [st.supplier.filter(s=>!s.telp).length,'supplier tanpa nomor telepon'],
    [st.pemasukan.filter(p=>!p.keuntungan).length,'hari pemasukan tanpa angka keuntungan']];
   return `<h3>Kualitas data</h3><div class="sub">Lengkapi agar laporan akurat</div>${items.map(([n,t])=>`<div class="chk"><em class="${n?'y':'g'}">${n?n:'✓'}</em><span>${t}</span></div>`).join('')}`}}
];


function vRingkasan(){
  const c=compute(),kats=['Semua',...new Set(st.kulakan.map(r=>r.kategori))],sups=['Semua',...new Set(st.kulakan.map(r=>r.supplier))];
  const vis=W.filter(w=>!st.hidden.includes(w.id));
  return `<div class="top"><div><div class="eyebrow">${new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div><h1>Ringkasan usaha</h1></div>
   <div class="tools"><label style="position:absolute;left:-9999px" for="kx-fk">Kategori</label><select id="kx-fk">${kats.map(x=>`<option ${x===st.fk?'selected':''}>${esc(x)}</option>`).join('')}</select>
   <label style="position:absolute;left:-9999px" for="kx-fs">Supplier</label><select id="kx-fs">${sups.map(x=>`<option ${x===st.fs?'selected':''} value="${esc(x)}">${esc(x==='Semua'?x:tc(x))}</option>`).join('')}</select>
   <button class="ghost" id="kx-tp" aria-expanded="${st.panel}">Atur widget</button></div></div>
   <div id="kx-panel" class="${st.panel?'open':''}">${W.map(w=>`<label><input type="checkbox" data-w="${w.id}" ${st.hidden.includes(w.id)?'':'checked'} style="min-height:auto"> ${w.t}</label>`).join('')}</div>
   <div class="wg">${vis.map(w=>`<section class="w s${w.s}${w.dark?' dark':''}">${w.r(c)}</section>`).join('')}</div>
   <div style="font-size:12px;color:#4D6B5D">Total modal = jumlah × harga beli + biaya angkut. Margin = (harga jual − modal per unit) ÷ harga jual. Filter kategori/supplier berlaku untuk widget kulakan.</div>`;
}
function vBuku(){
  const kats=['Semua',...new Set(st.kulakan.map(r=>r.kategori))];
  const rows=st.kulakan.filter(r=>(st.kat==='Semua'||r.kategori===st.kat)&&(r.barang+r.no_nota).toLowerCase().includes(st.q.toLowerCase()));
  return `<header><div class="eyebrow">Buku Kulakan</div><h1>Semua barang yang masuk</h1></header>
  <div class="w"><form id="kx-f">
   <label>Tanggal<input type="date" name="tanggal" required value="${new Date().toISOString().slice(0,10)}"></label>
   <label>Barang<input name="barang" required></label>
   <label>Supplier<input name="supplier" list="kx-sl" required><datalist id="kx-sl">${st.supplier.map(s=>`<option>${esc(s.nama)}</option>`).join('')}</datalist></label>
   <label>Kategori<input name="kategori"></label>
   <label>Jumlah<input name="qty" type="number" step="any" required></label>
   <label>Satuan<input name="satuan"></label>
   <label>Harga beli / unit<input name="harga_beli" type="number" required></label>
   <label>Biaya angkut<input name="biaya_angkut" type="number" value="0"></label>
   <label>Harga jual / unit<input name="harga_jual" type="number"></label>
   <button class="btn">Simpan</button></form></div>
  <div style="display:flex;flex-wrap:wrap;gap:12px"><input id="kx-q" placeholder="Cari barang atau nota" value="${esc(st.q)}" style="flex:1 1 260px" aria-label="Cari">
   <select id="kx-kat" aria-label="Kategori">${kats.map(c=>`<option ${c===st.kat?'selected':''}>${esc(c)}</option>`).join('')}</select></div>
  <div class="w" style="padding:0;overflow:hidden"><div class="sc"><table style="min-width:900px"><thead><tr><th>Tanggal</th><th>Barang</th><th>Supplier</th><th class="r">Jumlah</th><th class="r">Total modal</th><th class="r">Harga jual</th><th class="r">Margin</th></tr></thead><tbody>
   ${rows.map(r=>`<tr><td>${tgl(r.tanggal)}</td><td><b>${esc(r.barang)}</b><div style="font-size:12px;color:#4D6B5D">${esc(r.kategori)}</div></td><td>${esc(tc(r.supplier))}</td><td class="r">${r.qty} ${esc((r.satuan||'').toLowerCase())}</td><td class="r"><b>${rp(r.total_modal)}</b></td><td class="r">${rp(r.harga_jual)}</td><td class="r"><span class="pill ${mcls(r.margin)}">${pct(r.margin)}</span></td></tr>`).join('')}
  </tbody></table></div><div style="padding:16px;font-size:13px;color:var(--mut)">${rows.length} barang · total modal <b>${rp(sum(rows,r=>r.total_modal))}</b></div></div>`;
}
function vSupplier(){
  return `<header><div class="eyebrow">Supplier & Pemasukan</div><h1>Pemasok dan uang masuk</h1></header>
  <section class="wg">${st.supplier.map(s=>{const t=st.kulakan.filter(r=>r.supplier===s.nama);return `<div class="w s4"><h3>${esc(tc(s.nama))}</h3><div class="sub">${esc(tc(s.kategori))}</div><p style="line-height:1.6;margin:0">${esc(tc(s.lokasi))||'Alamat belum diisi'}<br>${esc(s.telp)||'Nomor belum diisi'}</p><div><span class="pill ${s.pembayaran==='CASH'?'g':s.pembayaran?'y':'n'}">${esc(s.pembayaran)||'Syarat bayar belum diisi'}</span></div><div style="margin-top:auto;border-top:1px solid var(--bg);padding-top:12px;font-size:13px;display:flex;justify-content:space-between"><span>${t.length} barang</span><b>${rp(sum(t,r=>r.total_modal))}</b></div></div>`}).join('')}</section>
  <div class="w"><h3>Pemasukan harian</h3>
   <form id="kx-fp"><label>Tanggal<input type="date" name="tanggal" required></label><label>Pemasukan<input name="pemasukan" type="number" required></label><label>Keuntungan<input name="keuntungan" type="number"></label><button class="btn">Catat</button></form>
   <div class="sc"><table><thead><tr><th>Tanggal</th><th class="r">Pemasukan</th><th class="r">Keuntungan</th></tr></thead><tbody>${st.pemasukan.map(p=>`<tr><td>${tgl(p.tanggal)}</td><td class="r"><b>${rp(p.pemasukan)}</b></td><td class="r">${p.keuntungan?rp(p.keuntungan):'—'}</td></tr>`).join('')}</tbody></table></div></div>`;
}


const SUBS=[['ringkasan','Ringkasan'],['buku','Buku Kulakan'],['supplier','Supplier & Pemasukan']];
function draw(){
  const r=root(); if(!r) return;
  const head=`<div class="kx-sub">${SUBS.map(([k,l])=>`<button data-sub="${k}" class="${k===st.sub?'on':''}">${l}</button>`).join('')}<span style="flex:1"></span><label class="ghost kx-imp">Impor Excel<input id="kx-file" type="file" accept=".xlsx,.xls" hidden></label></div>`;
  let body;
  if(st.error) body=`<div class="w">${esc(st.error)}</div>`;
  else if(!st.loaded) body='<div class="w">Memuat…</div>';
  else body=st.sub==='ringkasan'?vRingkasan():st.sub==='buku'?vBuku():vSupplier();
  const empty=st.loaded&&!st.kulakan.length&&!st.error?'<div class="w">Belum ada data kulakan. Klik <b>Impor Excel</b> (file BELANJA KULAKAN) atau tambah lewat Buku Kulakan.</div>':'';
  r.innerHTML=head+empty+body;
  r.querySelectorAll('[data-sub]').forEach(b=>b.onclick=()=>{st.sub=b.dataset.sub;draw()});
  $('kx-file').onchange=e=>importExcel(e.target.files[0]);
  if($('kx-q')){ $('kx-q').oninput=e=>{st.q=e.target.value;const p=e.target.selectionStart;draw();const n=$('kx-q');n.focus();n.setSelectionRange(p,p)}; $('kx-kat').onchange=e=>{st.kat=e.target.value;draw()}; }
  if($('kx-f')) $('kx-f').onsubmit=e=>save(e,'kulakan');
  if($('kx-fp')) $('kx-fp').onsubmit=e=>save(e,'pemasukan');
  if($('kx-fk')){ $('kx-fk').onchange=e=>{st.fk=e.target.value;draw()}; $('kx-fs').onchange=e=>{st.fs=e.target.value;draw()};
    $('kx-tp').onclick=()=>{st.panel=!st.panel;draw()};
    $('kx-panel').onchange=e=>{const id=e.target.dataset.w;st.hidden=e.target.checked?st.hidden.filter(x=>x!==id):[...st.hidden,id];store('kx-hidden',st.hidden);draw()}; }
}
async function save(e,table){
  e.preventDefault();
  const o=Object.fromEntries(new FormData(e.target));
  for(const k in o){ if(o[k]==='') o[k]=null; else if(NUM.includes(k)) o[k]=Number(o[k]); }
  if(o.supplier) o.supplier=o.supplier.trim().toUpperCase();
  const {error}=table==='pemasukan'?await supabaseClient.from(table).upsert(o):await supabaseClient.from(table).insert(o);
  if(error){toast(error.message,'error');return}
  toast('Tersimpan');await load();draw();
}

/* ---------- Impor dari Excel BELANJA KULAKAN ---------- */
const ALIAS={'SALES BOWO':'GUDANG GARAM','PLASTIK PASAR JTB':'TOKO PLASTIK','SALES PANDEMAS':'PANDEMAS'};
function ymd(serial){const d=XLSX.SSF.parse_date_code(serial);return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`}
function sheetRows(wb,name){const ws=wb.Sheets[name];return ws?XLSX.utils.sheet_to_json(ws,{header:1,range:'A1:T400',defval:null}):[]}
async function importExcel(file){
  if(!file) return;
  try{
    const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});
    let kul=sheetRows(wb,'Detail Kulakan').filter(r=>typeof r[0]==='number'&&typeof r[1]==='number'&&r[5]).map(r=>({tanggal:ymd(r[1]),no_nota:String(r[2]??'-'),kategori:r[3],supplier:ALIAS[String(r[4]).trim().toUpperCase()]||String(r[4]).trim().toUpperCase(),barang:r[5],qty:r[6],satuan:r[7],harga_beli:r[8],biaya_angkut:r[9]||0,harga_jual:r[12],isi_per_satuan:r[13]}));
    const pem=sheetRows(wb,'Pemasukan').filter(r=>typeof r[0]==='number'&&typeof r[2]==='number').map(r=>({tanggal:ymd(r[0]),pemasukan:r[2],keuntungan:r[1]}));
    const sup=sheetRows(wb,'Master Supplier').filter(r=>typeof r[1]==='number'&&r[2]).map(r=>({nama:String(r[2]).trim().toUpperCase(),kategori:r[3],kontak:r[4],telp:r[5]?String(r[5]):null,lokasi:r[6],pembayaran:r[7]}));
    if(!kul.length) return toast('Sheet "Detail Kulakan" tidak berisi data.','error');
    // supplier yang belum ada di master ikut dibuat
    const have=new Set(sup.map(s=>s.nama));
    [...new Set(kul.map(r=>r.supplier))].filter(n=>!have.has(n)).forEach(n=>sup.push({nama:n,kategori:[...new Set(kul.filter(r=>r.supplier===n).map(r=>r.kategori))].join(', ').toUpperCase(),kontak:null,telp:null,lokasi:null,pembayaran:null}));
    // bulan nota tidak sama dengan bulan pemasukan -> tawarkan koreksi
    const mk=a=>a.map(r=>r.tanggal).sort().pop()?.slice(0,7), mkK=mk(kul), mkP=mk(pem);
    if(mkP&&mkK&&mkK!==mkP&&confirm(`Tanggal nota tercatat bulan ${mkK}, sedangkan pemasukan bulan ${mkP}. Samakan tanggal nota ke bulan ${mkP}?`)) kul=kul.map(r=>({...r,tanggal:mkP+r.tanggal.slice(7)}));
    if(!confirm(`Impor ${kul.length} baris kulakan, ${pem.length} hari pemasukan, ${sup.length} supplier?`+(st.kulakan.length?`\n\nTabel kulakan sudah berisi ${st.kulakan.length} baris dan akan DIGANTI.`:''))) return;
    if(st.kulakan.length){const d=await supabaseClient.from('kulakan').delete().gt('id',0);if(d.error)throw d.error}
    let r1=await supabaseClient.from('supplier_kulakan').upsert(sup,{onConflict:'nama'});if(r1.error)throw r1.error;
    r1=await supabaseClient.from('kulakan').insert(kul);if(r1.error)throw r1.error;
    if(pem.length){r1=await supabaseClient.from('pemasukan').upsert(pem,{onConflict:'tanggal'});if(r1.error)throw r1.error}
    toast('Impor selesai');await load();draw();
  }catch(err){toast('Impor gagal: '+(err.message||err),'error')}
}

/* ---------- pasang ke sistem tab aplikasi ---------- */
let opened=false;
function open_(){ if(!opened){opened=true;load().then(draw).catch(e=>{st.error=e.message;draw()});draw();} else {load().then(draw).catch(()=>{});} }
function wrap(){
  const orig=window.switchTab; if(typeof orig!=='function'||orig.__kx) return;
  const w=function(id){ orig.apply(this,arguments); if(id==='kulakan') open_(); }; w.__kx=true; window.switchTab=w;
}
document.addEventListener('DOMContentLoaded',wrap); window.addEventListener('load',wrap);
})();
