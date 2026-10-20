// Tab "Kulakan": dashboard widget, buku kulakan, supplier.
// Mandiri: hapus tombol nav 'kulakan', div #kulakan, dan file ini (+ kulakan.css) bila tidak dipakai lagi.
// Memakai supabaseClient & sesi login dari aplikasi utama. Tabel: supplier_kulakan, kulakan (lihat kulakan-setup.sql).
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



const st={kulakan:[],supplier:[],sub:'ringkasan',q:'',kat:'Semua',bookSupplier:'',dateFrom:'',dateTo:'',fk:'Semua',fs:'Semua',editId:null,panel:false,hidden:store('kx-hidden2'),loaded:false,error:''};
const root=()=>document.getElementById('kulakan-root');
const $=id=>document.getElementById(id);
const toast=(m,t)=>{ if(window.showToast) window.showToast(m,t||'success'); else alert(m); };
const NUM=['qty','harga_beli','biaya_angkut','harga_jual','isi_per_satuan'];

async function load(){
  if(!window.supabaseClient && typeof supabaseClient==='undefined'){ st.error='Koneksi database belum siap.'; return; }
  const [k,s]=await Promise.all([
    supabaseClient.from('kulakan').select('*').order('tanggal').order('id'),
    supabaseClient.from('supplier_kulakan').select('*').order('nama')]);
  const err=k.error||s.error;
  if(err){ st.error=/relation|does not exist|schema cache/i.test(err.message)?'Tabel kulakan belum dibuat. Jalankan kulakan-setup.sql di Supabase SQL Editor.':err.message; return; }
  st.error='';Object.assign(st,{kulakan:k.data,supplier:s.data,loaded:true});return true;
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
function rowEconomics(row){
  const qty=Number(row.qty);
  const hargaBeli=Number(row.harga_beli);
  const sellingPrice=row.harga_jual==null||row.harga_jual===''?null:Number(row.harga_jual);
  const satuan=String(row.satuan||'').toLowerCase();
  
  // Total Modal = Jumlah (PCS/KG) x Harga Beli
  const totalModal=Number.isFinite(qty)&&qty>0&&Number.isFinite(hargaBeli)&&hargaBeli>0 ? qty * hargaBeli : 0;
  
  // HPP per unit = total modal / jumlah (jika jumlah > 1), jika tidak maka harga beli itu sendiri
  const hpp=qty>1 && totalModal>0 ? totalModal/qty : hargaBeli;
  
  const hasSellingPrice=Number.isFinite(sellingPrice)&&sellingPrice>0;
  const rev=hasSellingPrice ? (qty * sellingPrice) : 0;
  
  // Laba kotor = (harga jual per unit - HPP per unit) x jumlah
  const laba=hasSellingPrice ? (sellingPrice - hpp) * qty : null;
  
  // Margin = laba kotor / (harga jual per unit x jumlah)
  const margin=hasSellingPrice && rev>0 ? laba/rev : null;
  
  return {...row,qty,total_modal:totalModal,rev,laba,hpp,margin};
}
function compute(){
  let k=st.kulakan.filter(r=>(st.fk==='Semua'||r.kategori===st.fk)&&(st.fs==='Semua'||r.supplier===st.fs));
  k=k.map(rowEconomics);
  const group=(key)=>{const m={};k.forEach(r=>m[r[key]]=(m[r[key]]||0)+Number(r.total_modal));return Object.entries(m).map(([l,v])=>({l,v})).sort((a,b)=>b.v-a.v)};
  const tot=sum(k,r=>r.total_modal),rev=sum(k,r=>r.rev),laba=sum(k,r=>r.laba),angkut=sum(k,r=>r.biaya_angkut);
  const bySup=group('supplier'),byKat=group('kategori');
  const katM=byKat.map(c=>{const rr=k.filter(r=>r.kategori===c.l&&r.margin!=null);const rv=sum(rr,r=>r.rev);return{l:c.l,m:rv?sum(rr,r=>r.laba)/rv:null,v:c.v}}).filter(c=>c.m!=null).sort((a,b)=>a.m-b.m);
  const bk=[[0,.06,'< 6%','#C2542D'],[.06,.10,'6–10%','#F2B632'],[.10,.15,'10–15%','#2F7F6B'],[.15,.25,'15–25%','#0E2A21'],[.25,9,'> 25%','#4B6A9B']].map(([a,b,l,c])=>({l,c,n:k.filter(r=>r.margin!=null&&r.margin>=a&&r.margin<b).length}));
  const notaM={};k.forEach(r=>{const key=r.supplier+'|'+r.tanggal+'|'+r.no_nota;(notaM[key]=notaM[key]||{sup:r.supplier,tgl:r.tanggal,no:r.no_nota,v:0,n:0});notaM[key].v+=Number(r.total_modal);notaM[key].n++});
  const notas=Object.values(notaM).sort((a,b)=>b.v-a.v);
  const low=k.filter(r=>r.margin!=null&&r.margin<.06).sort((a,b)=>a.margin-b.margin).map(r=>{const target=Math.ceil(r.hpp/.9/500)*500;return{...r,target,gain:(target-r.harga_jual)*r.qty}});
  const topLaba=[...k].filter(r=>r.laba!=null).sort((a,b)=>b.laba-a.laba).slice(0,8);
  const topM=[...k].filter(r=>r.laba>0).sort((a,b)=>b.margin-a.margin).slice(0,6);
  const exM={};k.forEach(r=>{const e=exM[r.supplier]=exM[r.supplier]||{l:r.supplier,n:0,v:0};e.n++;e.v+=Number(r.qty)*Number(r.harga_beli)});
  const exSup=Object.values(exM).sort((a,b)=>b.v-a.v);
  const transport={n:k.filter(r=>Number(r.biaya_angkut)>0).length,v:angkut};
  const allTot=sum(st.kulakan,r=>r.total_modal);
  const barang=sum(k,r=>Number(r.qty)*Number(r.harga_beli));
  const modalBeli=barang;
  return{k,exSup,transport,allTot,modalBeli,tot,rev,laba,angkut,bySup,byKat,katM,bk,notas,low,topLaba,topM,barang,mw:rev?laba/rev:0};
}

/* ---------- widgets ---------- */
const W=[
 {id:'k_modal',t:'TOTAL MODAL BARANG',s:4,r:c=>`<div class="kpi"><small>TOTAL MODAL BARANG</small><b style="margin:12px 0 8px">${rp(c.modalBeli)}</b><span>Jumlah × harga beli per unit (belum termasuk ongkos)</span></div>`},
 {id:'k_ops',t:'TOTAL BIAYA OPERASIONAL',s:4,r:c=>`<div class="kpi"><small>TOTAL BIAYA OPERASIONAL</small><b style="margin:12px 0 8px">${rp(c.angkut)}</b><span>Jumlah kolom Biaya Angkut/Lain (J)</span></div>`},
 {id:'k_out',t:'TOTAL PENGELUARAN',s:4,r:c=>`<div class="kpi"><small>TOTAL PENGELUARAN</small><b style="margin:12px 0 8px">${rp(c.tot)}</b><span>Total Modal Barang + Biaya Transport Harian</span></div>`},
 {id:'k_laba',t:'POTENSI KEUNTUNGAN',s:4,r:c=>`<div class="kpi"><small>POTENSI KEUNTUNGAN</small><b style="margin:12px 0 8px">${rp(c.laba)}</b><span>Laba kotor = nilai jual − total modal. Margin minus berarti harga jual di bawah HPP.</span></div>`},
 {id:'supx',t:'Ringkasan pembelian per supplier',s:6,r:c=>`<h3>Ringkasan pembelian per supplier</h3><div class="sub">Total Pembelian = Jumlah × Harga Beli (tanpa angkut). Angkut tampil di baris TRANSPORT.</div><div class="sc"><table style="min-width:360px"><thead><tr><th>Supplier / Toko</th><th class="r">Transaksi</th><th class="r">Total Pembelian</th></tr></thead><tbody>${c.exSup.map(e=>`<tr><td>${esc(tc(e.l))}</td><td class="r">${e.n}</td><td class="r">${rp(e.v)}</td></tr>`).join('')}${c.transport.v?`<tr><td>Transport</td><td class="r">${c.transport.n}</td><td class="r">${rp(c.transport.v)}</td></tr>`:''}<tr><td><b>Total</b></td><td class="r"><b>${c.exSup.reduce((a,e)=>a+e.n,0)}</b></td><td class="r"><b>${rp(c.exSup.reduce((a,e)=>a+e.v,0)+c.transport.v)}</b></td></tr></tbody></table></div>`},
 {id:'sup',x:1,t:'Pangsa supplier',s:4,r:c=>`<h3>Pangsa supplier</h3><div class="sub">Siapa yang menerima uang belanja</div>${donut([...c.bySup.slice(0,5).map(x=>({l:tc(x.l),v:x.v})),...(c.bySup.length>5?[{l:'Lainnya',v:sum(c.bySup.slice(5),x=>x.v)}]:[])],'Pangsa belanja per supplier')}`},
 {id:'kat',x:1,t:'Pangsa kategori',s:4,r:c=>`<h3>Belanja per kategori</h3><div class="sub">Sebaran modal di tiap jenis barang</div>${donut(c.byKat.map(x=>({l:x.l,v:x.v})),'Pangsa belanja per kategori')}`},
 {id:'katm',x:1,t:'Margin per kategori',s:4,r:c=>`<h3>Margin per kategori</h3><div class="sub">Tertimbang, dari laba ÷ nilai jual</div>${c.katM.map(x=>hrow(x.l,`<b class="pill ${mcls(x.m)}">${pct(x.m)}</b>`,Math.min(1,x.m/.25))).join('')}`},
 {id:'hist',x:1,t:'Sebaran margin',s:4,r:c=>`<h3>Sebaran margin barang</h3><div class="sub">Jumlah barang tiap rentang</div>${vbars(c.bk.map(b=>({l:b.l,vals:[b.n],fmt:v=>v})),'Histogram jumlah barang menurut margin',[{n:'Barang',c:'#2F7F6B'}],300)}`},
 {id:'laba',t:'Penyumbang laba terbesar',s:6,r:c=>{const m=c.topLaba[0]?.laba||1;return `<h3>Penyumbang laba terbesar</h3><div class="sub">Potensi laba kotor per barang</div>${c.topLaba.map(r=>hrow(tc(r.barang),rp(r.laba),r.laba/m,'background:#2F7F6B')).join('')}`}},
 {id:'low',x:1,t:'Margin tipis',s:6,r:c=>`<h3>Margin di bawah 6%</h3><div class="sub">Saran harga agar margin 10%${c.low.length?` · tambahan laba ${rp(sum(c.low,r=>r.gain))}`:''}</div>${c.low.length?`<div class="sc"><table style="min-width:420px"><tbody>${c.low.slice(0,6).map(r=>`<tr><td><b>${esc(tc(r.barang))}</b><div style="font-size:12px;color:#4D6B5D">${esc(tc(r.supplier))}</div></td><td class="r"><span class="pill rd">${pct(r.margin)}</span></td><td class="r" style="font-size:13px">${rp(r.harga_jual)} → <b>${rp(r.target)}</b></td></tr>`).join('')}</tbody></table></div>`:'<span class="pill g">Tidak ada</span>'}`},
 {id:'top',t:'Margin tertinggi',s:4,r:c=>`<h3>Margin tertinggi</h3><div class="sub">Barang paling menguntungkan per rupiah</div>${c.topM.map(r=>`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding-bottom:10px;border-bottom:1px solid var(--bg)"><div><b>${esc(tc(r.barang))}</b><div style="font-size:12px;color:#4D6B5D">${esc(tc(r.supplier))}</div></div><span class="pill n">${pct(r.margin)}</span></div>`).join('')}`},
 {id:'rendah',t:'Margin terendah',s:4,r:c=>`<h3>Margin terendah</h3><div class="sub">Kolom Margin (%) diurutkan naik</div>${[...c.k].filter(r=>r.margin!=null).sort((a,b)=>a.margin-b.margin).slice(0,6).map(r=>`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding-bottom:10px;border-bottom:1px solid var(--bg)"><div><b>${esc(tc(r.barang))}</b><div style="font-size:12px;color:#4D6B5D">${esc(tc(r.supplier))}</div></div><span class="pill n">${pct(r.margin)}</span></div>`).join('')}`},
 {id:'nota',x:1,t:'Nota terbesar',s:4,r:c=>{const m=c.notas[0]?.v||1;return `<h3>Nota terbesar</h3><div class="sub">${c.notas.length} nota/pengiriman tercatat</div>${c.notas.slice(0,6).map(n=>hrow(`${tc(n.sup)} · ${tgl(n.tgl)}`,rp(n.v),n.v/m,'background:#4B6A9B')).join('')}`}},
 {id:'konsen',x:1,t:'Ketergantungan supplier',s:4,r:c=>{const t1=c.bySup[0],t3=sum(c.bySup.slice(0,3),x=>x.v);const a=c.tot?t1?.v/c.tot:0;return `<h3>Ketergantungan supplier</h3><div class="sub">Makin tinggi, makin rapuh bila pemasok bermasalah</div><div class="kpi"><b>${pct(a,0)}</b><span>${t1?esc(tc(t1.l)):'-'} · 3 terbesar ${pct(c.tot?t3/c.tot:0,0)}</span></div><span class="pill ${a>.5?'rd':a>.35?'y':'g'}" style="align-self:flex-start">${a>.5?'Tinggi':a>.35?'Sedang':'Sehat'}</span>`}},
 {id:'saran',x:1,t:'Catatan pengelola',s:8,dark:1,r:c=>{const a=[];const t1=c.bySup[0];
   if(t1&&c.tot&&t1.v/c.tot>.4)a.push(`${tc(t1.l)} memegang ${pct(t1.v/c.tot,0)} belanja. Minta tempo bayar atau bandingkan harga dengan satu pemasok pembanding.`);
   if(c.low.length)a.push(`${c.low.length} barang bermargin di bawah 6% (${c.low.slice(0,3).map(r=>tc(r.barang)).join(', ')}). Menaikkan ke margin 10% menambah laba ${rp(sum(c.low,r=>r.gain))} bila terjual habis.`);
   const kr=c.katM[0];if(kr)a.push(`Kategori ${kr.l} bermargin paling tipis (${pct(kr.m)}). Pantau harga beli tiap kulakan.`);
   if(c.angkut&&c.tot&&c.angkut/c.tot>.002)a.push(`Biaya angkut ${rp(c.angkut)} (${pct(c.angkut/c.tot,2)} dari modal). Gabungkan pengiriman bila bisa.`);
   return `<div class="eyebrow" style="color:var(--gold)">Catatan pengelola</div><h3 style="font-size:24px">Yang layak dibenahi</h3><ul class="adv" style="color:#DCE8E0">${a.map(x=>`<li>${x}</li>`).join('')||'<li>Belum ada temuan.</li>'}</ul>`}},
 {id:'data',t:'Kualitas data',s:4,r:c=>{const all=st.kulakan,nm=new Set(st.supplier.map(s=>s.nama));
   const items=[
    [all.filter(r=>!r.no_nota||r.no_nota==='-').length,'baris tanpa nomor nota'],
    [[...new Set(all.map(r=>r.supplier))].filter(n=>!nm.has(n)).length,'supplier belum ada di Master Supplier'],
    [st.supplier.filter(s=>!s.telp).length,'supplier tanpa nomor telepon'],
    ];
   return `<h3>Kualitas data</h3><div class="sub">Pemeriksaan kelengkapan isi, bukan rumus</div>${items.map(([n,t])=>`<div class="chk"><em class="${n?'y':'g'}">${n?n:'✓'}</em><span>${t}</span></div>`).join('')}`}}
];


if(!st.hidden) st.hidden=W.filter(w=>w.x).map(w=>w.id);
function vRingkasan(){
  const c=compute(),kats=['Semua',...new Set(st.kulakan.map(r=>r.kategori))],sups=['Semua',...new Set(st.kulakan.map(r=>r.supplier))];
  const vis=W.filter(w=>!st.hidden.includes(w.id));
  return `<div class="top"><div><div class="eyebrow">${new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div><h1>Ringkasan usaha</h1></div>
   <div class="tools"><label style="position:absolute;left:-9999px" for="kx-fk">Kategori</label><select id="kx-fk">${kats.map(x=>`<option ${x===st.fk?'selected':''}>${esc(x)}</option>`).join('')}</select>
   <label style="position:absolute;left:-9999px" for="kx-fs">Supplier</label><select id="kx-fs">${sups.map(x=>`<option ${x===st.fs?'selected':''} value="${esc(x)}">${esc(x==='Semua'?x:tc(x))}</option>`).join('')}</select>
   <button class="ghost" id="kx-tp" aria-expanded="${st.panel}">Atur widget</button></div></div>
   <div id="kx-panel" class="${st.panel?'open':''}">${W.map(w=>`<label><input type="checkbox" data-w="${w.id}" ${st.hidden.includes(w.id)?'':'checked'} style="min-height:auto"> ${w.t}${w.x?' <span class="pill n" style="font-size:11px">Tambahan</span>':''}</label>`).join('')}</div>
   <div class="wg">${vis.map(w=>`<section class="w s${w.s}${w.dark?' dark':''}">${w.x?'<span class="pill n" style="align-self:flex-start;font-size:11px">Tambahan · bukan rumus Excel</span>':''}${w.r(c)}</section>`).join('')}</div>
   <div style="font-size:12px;color:#4D6B5D">Rumus: total modal = jumlah × harga beli; HPP/unit = total modal ÷ jumlah (jika jumlah > 1); laba kotor = (harga jual − HPP/unit) × jumlah; margin kotor = laba kotor ÷ nilai jual. Ongkos transport diinput manual melalui Pengeluaran Pilihan Transport. Margin negatif berarti harga jual di bawah HPP. Widget bertanda &quot;Tambahan&quot; dapat diatur; angka mengikuti filter kategori/supplier.</div>`;
}
function kulakanForm(editing,id){
  return `<form id="${id}">
   <label>Tanggal<input type="date" name="tanggal" required value="${esc(editing?.tanggal||new Date().toISOString().slice(0,10))}"></label>
   <label>No. Nota<input name="no_nota" value="${esc(editing?.no_nota||'')}"></label>
   <label>Barang<input name="barang" required value="${esc(editing?.barang||'')}"></label>
   <label>Supplier<input name="supplier" list="kx-sl" required value="${esc(editing?.supplier||'')}"><datalist id="kx-sl">${st.supplier.map(s=>`<option>${esc(s.nama)}</option>`).join('')}</datalist></label>
   <label>Kategori<input name="kategori" value="${esc(editing?.kategori||'')}"></label>
   <label>Jumlah<input name="qty" type="number" min="0.000001" step="any" required value="${editing?esc(editing.qty):''}"></label>
   <label>Satuan<input name="satuan" value="${esc(editing?.satuan||'')}"></label>
   <label>Harga beli / unit<input name="harga_beli" type="number" min="0.01" step="any" required value="${editing?esc(editing.harga_beli):''}"></label>
   <label>Biaya angkut<input name="biaya_angkut" type="number" min="0" step="any" value="${editing?esc(editing.biaya_angkut||0):'0'}"></label>
   <label>Harga jual / unit<input name="harga_jual" type="number" min="0.01" step="any" value="${editing&&editing.harga_jual!=null?esc(editing.harga_jual):''}"></label>
   <div class="k-form-actions"><button class="btn" type="submit">${editing?'Simpan perubahan':'Tambah barang'}</button>${editing?'<button class="ghost" type="button" id="kx-cancel-edit">Batal</button>':''}</div></form>`;
}
function vBuku(){
  const kats=['Semua',...new Set(st.kulakan.map(r=>r.kategori))];
  const bookSuppliers=[...new Set(st.kulakan.map(r=>r.supplier).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const rows=st.kulakan.filter(r=>(st.kat==='Semua'||r.kategori===st.kat)&&(!st.bookSupplier||r.supplier===st.bookSupplier)&&(!st.dateFrom||r.tanggal>=st.dateFrom)&&(!st.dateTo||r.tanggal<=st.dateTo)&&(r.barang+r.no_nota).toLowerCase().includes(st.q.toLowerCase())).map(rowEconomics);
  return `<header><div class="eyebrow">Buku Kulakan</div><h1>Semua barang yang masuk</h1></header>
  <div class="w"><h3>Tambah barang kulakan</h3><div class="sub">Isi data barang baru untuk menambahkannya ke buku kulakan.</div>${kulakanForm(null,'kx-f')}</div>
  <div class="k-book-filters" role="search" aria-label="Filter Buku Kulakan">
   <label class="k-book-search">Cari barang / nota<input id="kx-q" placeholder="Nama barang atau nomor nota" value="${esc(st.q)}" aria-label="Cari barang atau nota"></label>
   <label>Supplier<select id="kx-book-supplier" aria-label="Filter supplier"><option value="">Semua supplier</option>${bookSuppliers.map(s=>`<option value="${esc(s)}" ${s===st.bookSupplier?'selected':''}>${esc(tc(s))}</option>`).join('')}</select></label>
   <label>Dari tanggal<input id="kx-date-from" type="date" value="${esc(st.dateFrom)}" aria-label="Tanggal mulai"></label>
   <label>Sampai tanggal<input id="kx-date-to" type="date" value="${esc(st.dateTo)}" aria-label="Tanggal akhir"></label>
   <label>Kategori<select id="kx-kat" aria-label="Filter kategori">${kats.map(c=>`<option ${c===st.kat?'selected':''}>${esc(c)}</option>`).join('')}</select></label>
   <button class="ghost k-book-filter-reset" type="button" id="kx-filter-reset" ${st.q||st.bookSupplier||st.dateFrom||st.dateTo||st.kat!=='Semua'?'':'disabled'}>Reset filter</button>
  </div>
  <div class="w" style="padding:0;overflow:hidden"><div class="sc"><table style="min-width:1430px"><thead><tr><th>Tanggal</th><th>No. Nota</th><th>Kategori</th><th>Supplier</th><th>Nama Barang</th><th class="r">Jumlah</th><th>Satuan</th><th class="r">Harga Beli/Unit</th><th class="r">Biaya Angkut</th><th class="r">Total Modal</th><th class="r">HPP/Unit</th><th class="r">Harga Jual/Unit</th><th class="r">Margin (%)</th><th class="r">Potensi Profit</th><th data-owner-only>Aksi</th></tr></thead><tbody>
  ${rows.length?rows.map(r=>`<tr><td>${tgl(r.tanggal)}</td><td>${esc(r.no_nota)}</td><td>${esc(r.kategori)}</td><td>${esc(tc(r.supplier))}</td><td><b>${esc(r.barang)}</b></td><td class="r">${r.qty}</td><td>${esc(r.satuan)}</td><td class="r">${rp(r.harga_beli)}</td><td class="r">${r.biaya_angkut?rp(r.biaya_angkut):'—'}</td><td class="r"><b>${rp(r.total_modal)}</b></td><td class="r">${r.hpp==null?'—':rp(r.hpp)}</td><td class="r">${r.harga_jual==null?'—':rp(r.harga_jual)}</td><td class="r">${r.margin==null?'—':pct(r.margin,2)}</td><td class="r">${r.laba==null?'—':rp(r.laba)}</td><td data-owner-only><div class="k-row-actions"><button type="button" class="ghost" data-kulakan-edit="${esc(r.id)}" aria-label="Edit ${esc(r.barang)}"><i class="fas fa-pen"></i><span>Edit</span></button><button type="button" class="ghost" data-kulakan-delete="${esc(r.id)}" aria-label="Hapus ${esc(r.barang)}"><i class="fas fa-trash"></i><span>Hapus</span></button></div></td></tr>`).join(''):`<tr><td colspan="15" style="text-align:center;color:var(--mut);padding:28px">Tidak ada barang yang cocok dengan filter ini.</td></tr>`}
  <tr style="font-weight:700;background:#F6F8F5"><td colspan="5">TOTAL</td><td class="r">${sum(rows,r=>r.qty)}</td><td></td><td class="r" title="Harga satuan tidak dijumlahkan">—</td><td class="r">${rp(sum(rows,r=>r.biaya_angkut))}</td><td class="r">${rp(sum(rows,r=>r.total_modal))}</td><td colspan="3"></td><td class="r">${rp(sum(rows,r=>r.laba))}</td></tr>
  </tbody></table></div><div style="padding:16px;font-size:13px;color:var(--mut)">Menampilkan ${rows.length} dari ${st.kulakan.length} baris. Harga beli/unit tidak dijumlahkan karena merupakan harga satuan; total modal sudah menghitung jumlah × harga beli ditambah ongkos.</div></div>`;
}
function vSupplier(){
  return `<header><div class="eyebrow">Supplier</div><h1>Pemasok</h1></header>
  <section class="wg">${st.supplier.map(s=>{const t=st.kulakan.filter(r=>r.supplier===s.nama);return `<div class="w s4"><h3>${esc(tc(s.nama))}</h3><div class="sub">${esc(tc(s.kategori))}</div><p style="line-height:1.6;margin:0">${esc(tc(s.lokasi))||'Alamat belum diisi'}<br>${esc(s.telp)||'Nomor belum diisi'}</p><div><span class="pill ${s.pembayaran==='CASH'?'g':s.pembayaran?'y':'n'}">${esc(s.pembayaran)||'Syarat bayar belum diisi'}</span></div><div style="margin-top:auto;border-top:1px solid var(--bg);padding-top:12px;font-size:13px;display:flex;justify-content:space-between"><span>${t.length} barang</span><b>${rp(sum(t,r=>Number(r.qty)*Number(r.harga_beli)))}</b></div></div>`}).join('')}</section>`;
}

const SUBS=[['ringkasan','Ringkasan'],['buku','Buku Kulakan'],['supplier','Supplier']];
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
  $('kx-file').onchange=e=>{const input=e.currentTarget;importExcel(input.files[0]).finally(()=>{input.value=''});};
  if($('kx-q')){ $('kx-q').oninput=e=>{st.q=e.target.value;const p=e.target.selectionStart;draw();const n=$('kx-q');n.focus();n.setSelectionRange(p,p)}; $('kx-kat').onchange=e=>{st.kat=e.target.value;draw()}; }
  if($('kx-book-supplier')) $('kx-book-supplier').onchange=e=>{st.bookSupplier=e.target.value;draw()};
  if($('kx-date-from')) $('kx-date-from').onchange=e=>{st.dateFrom=e.target.value;draw()};
  if($('kx-date-to')) $('kx-date-to').onchange=e=>{st.dateTo=e.target.value;draw()};
  if($('kx-filter-reset')) $('kx-filter-reset').onclick=()=>{st.q='';st.bookSupplier='';st.dateFrom='';st.dateTo='';st.kat='Semua';draw()};
  if($('kx-f'))$('kx-f').onsubmit=e=>save(e,'kulakan');
  r.querySelectorAll('[data-kulakan-edit]').forEach(button=>button.onclick=()=>startEdit(button.dataset.kulakanEdit));
  r.querySelectorAll('[data-kulakan-delete]').forEach(button=>button.onclick=()=>deleteKulakan(button.dataset.kulakanDelete));
  if($('kx-fk')){ $('kx-fk').onchange=e=>{st.fk=e.target.value;draw()}; $('kx-fs').onchange=e=>{st.fs=e.target.value;draw()};
    $('kx-tp').onclick=()=>{st.panel=!st.panel;draw()};
    $('kx-panel').onchange=e=>{const id=e.target.dataset.w;st.hidden=e.target.checked?st.hidden.filter(x=>x!==id):[...st.hidden,id];store('kx-hidden2',st.hidden);draw()}; }
}
async function save(e,table){
  e.preventDefault();
  if(!window.isAppOwner||!window.isAppOwner()){toast('Hanya pemilik yang dapat mengubah data.','error');return}
  const o=Object.fromEntries(new FormData(e.target));
  for(const k in o){ if(o[k]==='') o[k]=null; else if(NUM.includes(k)) o[k]=Number(o[k]); }
  if(!o.qty||o.qty<=0||!o.harga_beli||o.harga_beli<=0||o.biaya_angkut<0||(o.harga_jual!=null&&o.harga_jual<=0)){toast('Jumlah dan harga beli wajib lebih besar dari nol; biaya angkut tidak boleh negatif.','error');return}
  if(o.supplier) o.supplier=o.supplier.trim().toUpperCase();
  const updating=table==='kulakan'&&st.editId!=null;
  const response=updating
    ? await supabaseClient.from(table).update(o).eq('id',st.editId).select('id')
    : await supabaseClient.from(table).insert(o);
  if(response.error){toast((updating?'Gagal memperbarui':'Gagal menyimpan')+': '+response.error.message,'error');return}
  if(updating&&!response.data?.length){toast('Data kulakan tidak diperbarui. Baris mungkin sudah dihapus atau akses Anda berubah.','error');return}
  st.editId=null;
  if(updating)closeEditDialog();
  const loaded=await load();
  draw();
  if(!loaded){toast('Perubahan tersimpan, tetapi daftar kulakan gagal dimuat ulang. Muat ulang halaman.','error');return}
  toast(updating?'Perubahan kulakan berhasil disimpan.':'Barang kulakan berhasil ditambahkan.');
}

function closeEditDialog(){
  const dialog=$('kx-edit-overlay');
  if(dialog)dialog.remove();
  st.editId=null;
}
function startEdit(id){
  if(!window.isAppOwner||!window.isAppOwner()){toast('Hanya pemilik yang dapat mengubah data.','error');return}
  const row=st.kulakan.find(item=>String(item.id)===String(id));
  if(!row){toast('Baris kulakan tidak ditemukan. Muat ulang data lalu coba lagi.','error');return}
  closeEditDialog();
  st.editId=row.id;
  const dialog=document.createElement('div');
  dialog.id='kx-edit-overlay';
  dialog.className='k-edit-overlay';
  dialog.innerHTML=`<section class="k-edit-modal" role="dialog" aria-modal="true" aria-labelledby="kx-edit-title"><div class="k-edit-heading"><div><div class="eyebrow">Buku Kulakan</div><h2 id="kx-edit-title">Edit barang</h2><p>Perbarui data tanpa meninggalkan posisi daftar.</p></div><button type="button" class="ghost" id="kx-close-edit" aria-label="Tutup edit"><i class="fas fa-times"></i></button></div>${kulakanForm(row,'kx-edit-f')}</section>`;
  document.getElementById('kulakan').appendChild(dialog);
  $('kx-edit-f').onsubmit=e=>save(e,'kulakan');
  $('kx-cancel-edit').onclick=closeEditDialog;
  $('kx-close-edit').onclick=closeEditDialog;
  dialog.onclick=e=>{if(e.target===dialog)closeEditDialog()};
  $('kx-close-edit').focus({preventScroll:true});
}

async function deleteKulakan(id){
  if(!window.isAppOwner||!window.isAppOwner()){toast('Hanya pemilik yang dapat mengubah data.','error');return}
  const row=st.kulakan.find(item=>String(item.id)===String(id));
  if(!row){toast('Baris kulakan tidak ditemukan. Muat ulang data lalu coba lagi.','error');return}
  if(!confirm(`Hapus "${row.barang}" dari Buku Kulakan? Tindakan ini tidak dapat dibatalkan. Arsip detail pengeluaran struk tidak ikut dihapus.`))return;
  try{
    const {data,error}=await supabaseClient.from('kulakan').delete().eq('id',row.id).select('id');
    if(error)throw error;
    if(!data?.length){toast('Baris tidak dihapus. Data mungkin sudah berubah atau akses Anda ditolak.','error');return}
    if(String(st.editId)===String(row.id))st.editId=null;
    const loaded=await load();
    draw();
    if(!loaded){toast('Baris berhasil dihapus, tetapi daftar gagal dimuat ulang. Muat ulang halaman.','error');return}
    toast('Baris kulakan berhasil dihapus. Arsip pengeluaran tetap tersimpan.');
  }catch(error){
    console.error('Gagal menghapus baris kulakan:',error);
    toast('Gagal menghapus baris kulakan: '+(error.message||'kesalahan database'),'error');
  }
}

/* ---------- Impor dari Excel BELANJA KULAKAN ---------- */
const ALIAS={'SALES BOWO':'GUDANG GARAM','PLASTIK PASAR JTB':'TOKO PLASTIK','SALES PANDEMAS':'PANDEMAS'};
function ymd(serial){const d=XLSX.SSF.parse_date_code(serial);return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`}
function sheetRows(wb,name){const ws=wb.Sheets[name];return ws?XLSX.utils.sheet_to_json(ws,{header:1,range:'A1:T400',defval:null}):[]}
async function makeReceiptTransactions(rows){
  const groups=new Map();
  rows.forEach(row=>{
    const key=JSON.stringify([row.tanggal,row.supplier.trim().toLowerCase(),row.no_nota.trim()]);
    if(!groups.has(key))groups.set(key,{key,date:row.tanggal,invoice:row.no_nota,supplier:row.supplier,rows:[]});
    groups.get(key).rows.push(row);
  });
  const receipts=[];
  for(const group of groups.values()){
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(group.key));
    const sourceKey=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
    const id='KULAKAN-'+sourceKey;
    const old=typeof transactions==='undefined'?null:transactions.find(row=>String(row.id)===id);
    const goods=group.rows.map(row=>{
      const qty=Number(row.qty),unitPrice=Number(row.harga_beli);
      return{name:String(row.barang),qty,unit:row.satuan||'unit',unitPrice,amount:Math.round(qty*unitPrice),needsReview:false,reviewFlags:[],rawLine:'Impor Excel Kulakan'};
    });
    const freight=Math.round(group.rows.reduce((total,row)=>total+Number(row.biaya_angkut||0),0));
    if(freight>0)goods.push({name:'Biaya angkut/lain-lain',qty:1,unit:'biaya',unitPrice:freight,amount:freight,needsReview:false,reviewFlags:[],rawLine:'Impor Excel Kulakan'});
    const total=goods.reduce((amount,item)=>amount+Number(item.amount||0),0);
    const detail={type:'receipt_expense_v1',invoice:group.invoice==='-'?'':group.invoice,supplier:group.supplier,items:goods,source:'kulakan_excel_import_v1',sourceKey,savedAt:new Date().toISOString()};
    receipts.push({id,jenis:'pengeluaran',tanggal:group.date,kategori:'Pembelian Barang (Kulakan Stok)',nominal:total,keterangan:'[DETAIL_STRUK] '+JSON.stringify(detail),timestamp:old&&old.timestamp||new Date().toISOString()});
  }
  return receipts;
}
async function importExcel(file){
  if(!window.isAppOwner||!window.isAppOwner()){toast('Hanya pemilik yang dapat mengubah data.','error');return}
  if(!file) return;
  let kulakanCleared=false,kulakanSaved=false;
  try{
    const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});
    const detailRows=sheetRows(wb,'Detail Kulakan').filter(r=>r[5]&&String(r[0]).toLowerCase()!=='no');
    const invalidRows=detailRows.filter(r=>typeof r[1]!=='number'||!Number.isFinite(Number(r[6]))||Number(r[6])<=0||!Number.isFinite(Number(r[8]))||Number(r[8])<=0||!String(r[4]||'').trim()||(r[9]!=null&&(!Number.isFinite(Number(r[9]))||Number(r[9])<0))||(r[12]!=null&&!Number.isFinite(Number(r[12]))));
    if(invalidRows.length)return toast(`Impor dibatalkan: ${invalidRows.length} baris memiliki tanggal, supplier, jumlah, atau harga yang tidak valid. Periksa sheet "Detail Kulakan".`,'error');
    let kul=detailRows.map(r=>{
      const qty=Number(r[6]), hargaBeli=Number(r[8]), pcsKg=r[13];
      // Logika Kolom N (PCS/KG): Jika bukan PCS, RT, RTG, atau KG, maka nilai Kolom N adalah pengali Total Modal
      const isStandardUnit=[ 'PCS', 'RT', 'RTG', 'KG' ].includes(String(pcsKg).toUpperCase());
      const multiplier = (isStandardUnit || !Number.isFinite(num(pcsKg))) ? 1 : Number(pcsKg);
      
      // Total Modal = (Nilai Kolom N x Qty) x Harga Beli (jika N bukan satuan standar)
      // Namun sesuai instruksi user: Total Modal = (jumlah kolom PCS/KG) x (harga beli)
      // Jika Kolom N adalah pengali, maka harga_beli di excel dianggap harga per unit terkecil
      const finalHargaBeli = hargaBeli;
      const finalQty = (isStandardUnit || !Number.isFinite(num(pcsKg))) ? qty : qty * multiplier;

      return {
        tanggal:ymd(r[1]),
        no_nota:String(r[2]??'-').trim()||'-',
        kategori:String(r[3]||'').trim(),
        supplier:ALIAS[String(r[4]).trim().toUpperCase()]||String(r[4]).trim().toUpperCase(),
        barang:String(r[5]).trim(),
        qty: finalQty,
        satuan:String(r[7]||'unit').trim(),
        harga_beli: finalHargaBeli,
        biaya_angkut:r[9]==null?0:Number(r[9]),
        harga_jual:r[12]==null?null:Number(r[12]),
        isi_per_satuan: multiplier > 0 ? multiplier : 1
      };
    });
    const supplierRows=sheetRows(wb,'Master Supplier').filter(r=>typeof r[1]==='number'&&r[2]).map(r=>({nama:String(r[2]).trim().toUpperCase(),kategori:r[3],kontak:r[4],telp:r[5]?String(r[5]):null,lokasi:r[6],pembayaran:r[7]}));
    if(!kul.length) return toast('Sheet "Detail Kulakan" tidak berisi data.','error');
    const supplierByName=new Map(supplierRows.map(s=>[s.nama,s]));
    const sup=[...supplierByName.values()];
    // supplier yang belum ada di master ikut dibuat
    const have=new Set(sup.map(s=>s.nama));
    [...new Set(kul.map(r=>r.supplier))].filter(n=>!have.has(n)).forEach(n=>sup.push({nama:n,kategori:[...new Set(kul.filter(r=>r.supplier===n).map(r=>r.kategori))].join(', ').toUpperCase(),kontak:null,telp:null,lokasi:null,pembayaran:null}));
    // Tanggal nota di Excel lebih maju dari bulan ini (typo)? tawarkan koreksi, boleh ditolak
    const mkK=kul.map(r=>r.tanggal).sort().pop()?.slice(0,7), now=new Date().toISOString().slice(0,7);
    if(mkK&&mkK>now&&confirm(`Tanggal nota di Excel tertulis bulan ${mkK}, lebih maju dari bulan ini (${now}). Ubah ke bulan ${now}? Pilih Batal untuk memakai tanggal persis seperti di Excel.`)) kul=kul.map(r=>({...r,tanggal:now+r.tanggal.slice(7)}));
    const receipts=await makeReceiptTransactions(kul);
    if(!confirm(`Impor ${kul.length} baris kulakan, ${sup.length} supplier, dan ${receipts.length} nota ke Detail Pengeluaran? Nota yang sama akan diperbarui, bukan digandakan.`+(st.kulakan.length?`\n\nTabel kulakan berisi ${st.kulakan.length} baris dan akan DIGANTI. Arsip pengeluaran lain tidak dihapus.`:''))) return;
    let r1=await supabaseClient.from('supplier_kulakan').upsert(sup,{onConflict:'nama'});if(r1.error)throw r1.error;
    if(st.kulakan.length){const d=await supabaseClient.from('kulakan').delete().gt('id',0);if(d.error)throw d.error;kulakanCleared=true}
    r1=await supabaseClient.from('kulakan').insert(kul);if(r1.error)throw r1.error;
    kulakanSaved=true;
    r1=await supabaseClient.from('transactions').upsert(receipts,{onConflict:'id'});if(r1.error)throw r1.error;
    const historyLoaded=await window.loadDataFromSupabase({silent:true});
    await load();draw();
    if(!historyLoaded){toast('Impor tersimpan, tetapi daftar pengeluaran belum diperbarui di layar. Muat ulang halaman untuk melihat hasilnya.','error');return}
    toast(`Impor selesai: ${kul.length} barang dan ${receipts.length} nota pengeluaran tersimpan.`);
  }catch(err){
    console.error('Impor Excel Kulakan gagal:',err);
    const partial=kulakanSaved?'Data kulakan berhasil diperbarui, tetapi arsip struk gagal disimpan.':kulakanCleared?'Data kulakan lama sudah dihapus, tetapi data baru belum dipastikan tersimpan.':'Impor gagal.';
    toast(partial+' '+(err.message||err),'error');
  }
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
