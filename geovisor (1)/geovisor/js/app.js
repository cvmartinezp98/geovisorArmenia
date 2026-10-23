/* Geovisor de la red hídrica de Armenia, Quindío
   Los datos están en data/*.js (GeoJSON en WGS84 dentro de variables globales),
   así el visor funciona abriendo index.html directamente o con Live Server. */

(function () {
  'use strict';

  const fmt = (n, d = 0) => n.toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d });
  const COLORS = { river: '#1f6f9c', strip: '#e3c58a', alert: '#c8372d', hot: '#ff7a00', border: '#10303a' };

  /* ---------- Mapa ---------- */
  const map = L.map('map', { preferCanvas: true, zoomControl: true, minZoom: 9, maxZoom: 19 });
  L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(map);
  map.createPane('franja').style.zIndex = 410;
  map.createPane('red').style.zIndex = 420;
  map.createPane('tramos').style.zIndex = 430;
  map.createPane('constr').style.zIndex = 440;

  const esri = (svc, opts = {}) => L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/' + svc + '/MapServer/tile/{z}/{y}/{x}',
    Object.assign({ maxZoom: 19, attribution: 'Tiles &copy; Esri' }, opts));
  const basemaps = {
    claro: { label: 'Claro', layer: esri('Canvas/World_Light_Gray_Base', { maxNativeZoom: 16 }) },
    satelite: { label: 'Satélite', layer: esri('World_Imagery') },
    calles: { label: 'Calles', layer: esri('World_Street_Map') }
  };
  let currentBase = 'claro';
  basemaps.claro.layer.addTo(map);

  /* ---------- Capas ---------- */
  const canvas = L.canvas({ padding: 0.3 });

  const limite = L.geoJSON(DATA_LIMITE, {
    interactive: false,
    style: { color: COLORS.border, weight: 2, fill: false, dashArray: '6 4' }
  });

  const franja = L.geoJSON(DATA_FRANJA, {
    pane: 'franja', interactive: false, renderer: canvas,
    style: { color: COLORS.strip, weight: 0, fillColor: COLORS.strip, fillOpacity: 0.65 }
  });

  const popRed = (f) => {
    const p = f.properties;
    return `<b>Tramo de cauce</b><br><span class="pop-k">Longitud</span> ${fmt(p.l)} m<br>` +
      (p.c > 0
        ? `<span class="pop-k">Construcciones a 30 m o menos</span> <b style="color:${COLORS.alert}">${fmt(p.c)}</b>`
        : `<span class="pop-k">Sin construcciones en la franja</span>`);
  };

  const red = L.geoJSON(DATA_RED, {
    pane: 'red', renderer: canvas,
    style: { color: COLORS.river, weight: 1.3, opacity: 0.9 },
    onEachFeature: (f, l) => l.bindPopup(() => popRed(f))
  });

  const tramos = L.geoJSON(DATA_RED, {
    pane: 'tramos', renderer: canvas,
    filter: f => f.properties.c > 0,
    style: { color: COLORS.hot, weight: 2.4, opacity: 0.95 },
    onEachFeature: (f, l) => l.bindPopup(() => popRed(f))
  });

  const popConstr = (f) =>
    `<b>Construcción dentro de la franja</b><br><span class="pop-k">Huella</span> ${fmt(f.properties.a)} m²`;

  let constr = null;
  let minArea = 0;
  function buildConstr() {
    const wasOn = constr ? map.hasLayer(constr) : true;
    const op = 0.95;
    if (constr) map.removeLayer(constr);
    constr = L.geoJSON(DATA_CONSTR, {
      pane: 'constr', renderer: canvas,
      filter: f => f.properties.a >= minArea,
      style: { color: '#8f1d16', weight: 0.8, fillColor: COLORS.alert, fillOpacity: 0.95 },
      onEachFeature: (f, l) => l.bindPopup(() => popConstr(f))
    });
    layers.constr.layer = constr;
    if (wasOn) constr.addTo(map);
    if (typeof op === 'number') constr.setStyle({ fillOpacity: layers.constr.opacity });
  }

  /* Para sumar otra capa (por ejemplo el IOT), agregue un objeto aquí
     con su GeoJSON, su estilo y una entrada en la leyenda. */
  const layers = {
    constr: { name: 'Construcciones en la franja', desc: 'Huella física de edificaciones dentro de los 30 m', on: true, opacity: 0.95, swatch: COLORS.alert, layer: null },
    tramos: { name: 'Cauces con construcciones', desc: 'Tramos con al menos una huella a 30 m o menos', on: false, opacity: 0.95, swatch: COLORS.hot, line: true, layer: tramos },
    red: { name: 'Red hídrica', desc: 'Quebradas, drenajes y ríos, 809,45 km', on: true, opacity: 0.9, swatch: COLORS.river, line: true, layer: red },
    franja: { name: 'Franja analítica de 30 m', desc: 'Buffer a cada lado del cauce, 4.098 ha', on: true, opacity: 0.65, swatch: COLORS.strip, layer: franja },
    limite: { name: 'Límite municipal', desc: 'Municipio de Armenia, 121,6 km²', on: true, opacity: 1, swatch: 'transparent', border: COLORS.border, layer: limite }
  };
  buildConstr();
  ['limite', 'franja', 'red', 'tramos'].forEach(k => { if (layers[k].on) layers[k].layer.addTo(map); });

  function setOpacity(key, v) {
    const L_ = layers[key];
    L_.opacity = v;
    if (!L_.layer) return;
    if (key === 'red' || key === 'tramos') L_.layer.setStyle({ opacity: v });
    else if (key === 'limite') L_.layer.setStyle({ opacity: v });
    else L_.layer.setStyle({ fillOpacity: v });
  }

  /* ---------- Panel: capas ---------- */
  const list = document.getElementById('layerList');
  Object.entries(layers).forEach(([key, cfg]) => {
    const li = document.createElement('li');
    li.className = 'layer';
    const sw = cfg.line
      ? `<i class="sw line" style="border-top-color:${cfg.swatch}"></i>`
      : `<i class="sw" style="background:${cfg.swatch};${cfg.border ? 'border:2px dashed ' + cfg.border : ''}"></i>`;
    li.innerHTML = `
      <label><input type="checkbox" ${cfg.on ? 'checked' : ''} data-k="${key}">
        <span class="txt"><span class="name">${sw}${cfg.name}</span><span class="desc">${cfg.desc}</span></span></label>
      <div class="op"><span>Opacidad</span><input type="range" min="0.1" max="1" step="0.05" value="${cfg.opacity}" data-o="${key}" aria-label="Opacidad de ${cfg.name}"></div>`;
    list.appendChild(li);
  });
  list.addEventListener('change', e => {
    const k = e.target.dataset.k;
    if (!k) return;
    e.target.checked ? layers[k].layer.addTo(map) : map.removeLayer(layers[k].layer);
    layers[k].on = e.target.checked;
    updateLegend();
  });
  list.addEventListener('input', e => {
    const k = e.target.dataset.o;
    if (k) setOpacity(k, parseFloat(e.target.value));
  });

  /* Mapa base */
  const bm = document.getElementById('basemaps');
  Object.entries(basemaps).forEach(([k, b]) => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.textContent = b.label;
    btn.setAttribute('role', 'radio'); btn.setAttribute('aria-checked', k === currentBase);
    btn.addEventListener('click', () => {
      map.removeLayer(basemaps[currentBase].layer);
      basemaps[k].layer.addTo(map).bringToBack();
      currentBase = k;
      bm.querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', x === btn));
    });
    bm.appendChild(btn);
  });

  /* ---------- Leyenda ---------- */
  const legend = document.getElementById('legend');
  function updateLegend() {
    const rows = Object.values(layers).filter(c => c.on).map(c => {
      const sw = c.line
        ? `<i class="sw line" style="border-top-color:${c.swatch}"></i>`
        : `<i class="sw" style="background:${c.swatch};${c.border ? 'border:2px dashed ' + c.border : ''}"></i>`;
      return `<div>${sw}<span>${c.name}</span></div>`;
    });
    legend.innerHTML = rows.length ? `<b>Leyenda</b>${rows.join('')}` : '';
    legend.hidden = rows.length === 0;
  }
  updateLegend();

  /* ---------- Pestañas ---------- */
  const tabs = document.querySelectorAll('.tabs [role=tab]');
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => {
      const on = x === t;
      x.setAttribute('aria-selected', on);
      document.getElementById(x.getAttribute('aria-controls')).hidden = !on;
    });
  }));

  /* ---------- Gráficos de barras (datos del artículo) ---------- */
  function bars(id, rows, { unit = '%', max = null, color = COLORS.river, dec = 2 } = {}) {
    const m = max ?? Math.max(...rows.map(r => r[1]));
    document.getElementById(id).innerHTML = rows.map(([lab, v, c]) =>
      `<div class="bar"><span class="lab">${lab}</span>
        <span class="trk"><span class="fil" style="width:${(v / m * 100).toFixed(1)}%;background:${c || color}"></span></span>
        <span class="val">${fmt(v, dec)}${unit}</span></div>`).join('');
  }
  bars('barsPend', [
    ['Plano', 23.83], ['Ligeramente inclinado', 19.84], ['Moderadamente inclinado', 19.76],
    ['Fuertemente inclinado', 25.03], ['Ligeramente escarpado', 9.74], ['Moderadamente escarpado', 1.59], ['Fuertemente escarpado', 0.21]
  ], { max: 30 });
  bars('barsCob', [
    ['Cultivos permanentes', 81.74], ['Mosaico de pastos', 12.92], ['Mosaico de cultivos', 3.55],
    ['Vegetación secundaria', 0.87], ['Tejido urbano discontinuo', 0.55], ['Ríos', 0.20],
    ['Bosque de galería', 0.12], ['Pastos enmalezados', 0.04], ['Aeropuertos', 0.01]
  ], { max: 100, color: '#3f7d4e' });
  bars('barsAhp', [['Proximidad al cauce', 54], ['Uso del suelo', 29.7], ['Pendiente', 16.3]], { max: 60, color: '#10303a', dec: 1 });

  /* ---------- Conflictos ---------- */
  const feats = DATA_CONSTR.features;                  // ya vienen ordenadas por área
  const totalHa = feats.reduce((s, f) => s + f.properties.a, 0) / 1e4;
  const kmTotal = 809.45;
  const kmConf = DATA_RED.features.reduce((s, f) => s + (f.properties.c > 0 ? f.properties.l : 0), 0) / 1000;
  const nTramos = DATA_RED.features.filter(f => f.properties.c > 0).length;
  document.getElementById('confKpis').innerHTML = `
    <div class="hot"><dt>Huellas construidas</dt><dd>${fmt(feats.length)}</dd><dd class="sub">${fmt(totalHa, 2)} ha en total</dd></div>
    <div><dt>Cauces afectados</dt><dd>${fmt(kmConf, 1)} <small>km</small></dd><dd class="sub">${fmt(kmConf / kmTotal * 100, 1)} % de la red, ${fmt(nTramos)} tramos</dd></div>`;

  const flash = L.geoJSON(null, { pane: 'constr', style: { color: '#000', weight: 3, fillOpacity: 0, dashArray: '4 3' } }).addTo(map);
  const top = document.getElementById('topList');
  feats.slice(0, 15).forEach((f, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<button type="button"><span>Huella ${i + 1}</span><span class="m">${fmt(f.properties.a)} m²</span></button>`;
    li.firstChild.addEventListener('click', () => {
      flash.clearLayers().addData(f);
      map.fitBounds(flash.getBounds(), { maxZoom: 18, padding: [80, 80] });
      L.popup().setLatLng(flash.getBounds().getCenter()).setContent(popConstr(f)).openOn(map);
    });
    top.appendChild(li);
  });

  const slider = document.getElementById('minArea');
  const sVal = document.getElementById('minAreaVal');
  const sCnt = document.getElementById('minAreaCount');
  const count = () => feats.filter(f => f.properties.a >= minArea).length;
  const refresh = () => { sVal.textContent = fmt(minArea) + ' m²'; sCnt.textContent = `Se muestran ${fmt(count())} de ${fmt(feats.length)} huellas.`; };
  let timer;
  slider.addEventListener('input', () => {
    minArea = +slider.value; refresh();
    clearTimeout(timer);
    timer = setTimeout(() => { const on = map.hasLayer(constr); buildConstr(); if (!on) map.removeLayer(constr); }, 120);
  });
  refresh();

  /* ---------- Controles del mapa ---------- */
  const bounds = limite.getBounds();
  map.fitBounds(bounds, { padding: [20, 20] });
  document.getElementById('fitBtn').addEventListener('click', () => map.fitBounds(bounds, { padding: [20, 20] }));
  const ro = document.getElementById('readout');
  map.on('mousemove', e => { ro.textContent = `${e.latlng.lat.toFixed(5)}° N, ${Math.abs(e.latlng.lng).toFixed(5)}° O`; });
  map.on('zoomend', () => {
    // Las huellas son pequeñas: con zoom bajo se engrosa el borde para que se vean
    const z = map.getZoom();
    if (constr) constr.setStyle({ weight: z < 14 ? 1.6 : 0.8 });
  });
  map.whenReady(() => document.getElementById('loading').classList.add('done'));
})();
