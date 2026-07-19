import React from 'react';
import ReactDOM from 'react-dom/client';
import { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakToggle, TweakColor, TweakButton } from './tweaks-panel.jsx';
import { InventoryView } from './app-inventory.jsx';
import { AddFigureOverlay } from './app-add-figure.jsx';
import { PartsBin } from './parts-bin.jsx';
import { MasterCollectionView } from './master-collection.jsx';
import { JoeStore } from './store.js';
import './app.css';

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "paper": "kraft",
  "accent": "#6b6f39",
  "wobble": false,
  "factionColors": true
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [page, setPage] = React.useState('figures'); // 'figures' | 'parts-bin' | 'master-collection'
  const [overlay, setOverlay] = React.useState(null); // null | { presetId, presetVariant }
  const fileRef = React.useRef(null);

  React.useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--paper', t.paper === 'white' ? '#f6f3ea' : '#f3eee2');
    r.style.setProperty('--card', t.paper === 'white' ? '#ece4d4' : '#e9e2d2');
    r.style.setProperty('--accent', t.accent);
    document.body.classList.toggle('no-faction', !t.factionColors);
  }, [t]);

  const openAdd = () => setOverlay({ presetId: null, presetVariant: null, presetAcc: null });
  const addInstance = (catalogId, variant, presetAcc) => setOverlay({ presetId: catalogId, presetVariant: variant, presetAcc: presetAcc || null });

  const doExport = () => {
    const blob = new Blob([JoeStore.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'gi-joe-collection-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const doExportExcel = () => {
    fetch('/api/export/xlsx')
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = 'gi-joe-catalog-' + new Date().toISOString().slice(0, 10) + '.xlsx'; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      });
  };
  const doImport = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { JoeStore.importJSON(rd.result) ? null : alert('Could not read that backup file.'); };
    rd.readAsText(f); e.target.value = '';
  };
  const doClear = () => { if (window.confirm('Clear your entire collection? This cannot be undone.')) JoeStore.clearAll(); };

  return (
    <React.Fragment>
      {page === 'parts-bin'
        ? <PartsBin onNavigate={setPage} />
        : page === 'master-collection'
        ? <MasterCollectionView onNavigate={setPage} onAddInstance={addInstance} />
        : <InventoryView onAddFigure={openAdd} onAddInstance={addInstance} onNavigate={setPage} />}
      {overlay && <AddFigureOverlay onClose={() => setOverlay(null)} presetCatalogId={overlay.presetId} presetVariant={overlay.presetVariant} presetAcc={overlay.presetAcc} />}
      <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={doImport} />
      <TweaksPanel title="Tweaks & Admin">
        <TweakSection label="Paper & ink" />
        <TweakRadio label="Paper" value={t.paper} options={['kraft', 'white']} onChange={(v) => setTweak('paper', v)} />
        <TweakColor label="Accent" value={t.accent} options={['#6b6f39', '#b8402f', '#c9772f', '#3f6f86']} onChange={(v) => setTweak('accent', v)} />
        <TweakToggle label="Faction colors" value={t.factionColors} onChange={(v) => setTweak('factionColors', v)} />
        <TweakSection label="Collection data" />
        <TweakButton label="⬇ Export backup (.json)" onClick={doExport} />
        <TweakButton label="⬇ Export catalog (.xlsx)" onClick={doExportExcel} />
        <TweakButton label="⬆ Import backup" secondary onClick={() => fileRef.current && fileRef.current.click()} />
        <TweakButton label="✕ Clear collection" secondary onClick={doClear} />
        <TweakSection label="Admin" />
        <div className="twk-note">
          <b>Figure missing from the catalog?</b>
          <p>Run from the project root, then reload this tab — the catalog loads once at page load, not live:</p>
          <code>{'node server/add-figure.mjs --name "NAME" --faction Cobra --year 1993 --series "Series 12"'}</code>
          <p>Look up ids first if you need them:</p>
          <code>node server/add-figure.mjs --search-series 1993</code>
          <code>{'node server/add-figure.mjs --search-accessories "helmet"'}</code>
        </div>
        <div className="twk-note">
          <b>Condition-map zone data</b>
          <p>Hand-authored body-zone grids, one per gender/view, tied 1:1 to the line art. Hand-edit these if a zone needs adjusting — there's no in-app editor:</p>
          <code>web/src/assets/figure-masks.js</code>
          <code>web/src/assets/figure-zones.js</code>
          <code>web/public/assets/fig/*.png</code>
        </div>
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
