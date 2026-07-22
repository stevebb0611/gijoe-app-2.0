// set-card.jsx — multi-pack "set" grouping display (migration 015/016), a fun
// bonus completionist card that lives only in the Special Release section of
// app-inventory.jsx. Purely a display/edit layer over already-ownable figures
// and their already-tracked instance_accessories — no new ownable entity.
//
// Each member figure's retailer-exclusive accessories (hidden from that
// figure's own Detail modal when it belongs to a set — see app-detail.jsx's
// `bp` filter) are edited here instead, per explicitly-tagged instance
// (instances.set_id) — see FIGURE_SETS.md.
import React from 'react';
import { JoeStore, JoeData } from './store.js';
import { AccItem, INV_CAT_BY_ID } from './app-detail.jsx';
import { AccessoryList, orderedBlueprint } from './accessory-groups.jsx';

function SetSlotRow({ figureId, name, version, inst, onOpen, onAdd }) {
  if (!inst) {
    return (
      <button className="setcard__slot setcard__slot--ghost" onClick={onAdd}>
        <span className="setcard__slotname">{name}{version ? ' v' + version : ''}</span>
        <span className="setcard__slotadd">＋ Add</span>
      </button>
    );
  }
  const fig = INV_CAT_BY_ID.get(figureId);
  const bp = ((fig && fig.blueprint) || []).filter((row) => row[4] === 'retailer_exclusive');
  const ordered = orderedBlueprint(bp);
  return (
    <div className="setcard__slot">
      <button className="setcard__slothd" onClick={() => onOpen(figureId, inst.id)}>
        <span className="setcard__slotname">{name}{version ? ' v' + version : ''} <i>No. {inst.id}</i></span>
        {inst.moc && <span className="setcard__slotmoc">MOC</span>}
      </button>
      {!inst.moc && bp.length > 0 && (
        <div className="setcard__slotacc">
          <AccessoryList ordered={ordered}
                         renderSolo={(a, key) => (
                           <AccItem key={key} name={a[0]} req={a[1]} color={a[6]}
                                    checked={Array.from({ length: a[1] }, (_, k) => k < (inst.acc[a[0]] || 0))}
                                    onSet={(n) => JoeStore.setAcc(inst.id, a[0], n)} />
                         )}
                         renderOption={(a) => (
                           <AccItem key={a[0]} name={JoeData.optLabel(a[0])} req={a[1]} color={a[6]} tag={a[5]}
                                    checked={Array.from({ length: a[1] }, (_, k) => k < (inst.acc[a[0]] || 0))}
                                    onSet={(n) => JoeStore.setAcc(inst.id, a[0], n)} />
                         )} />
        </div>
      )}
    </div>
  );
}

export function SetCard({ set, onOpen, onAddInstance }) {
  const [open, setOpen] = React.useState(false);
  const p = JoeData.setProgress(set.setId);
  const members = JoeData.setSlots(set.setId);

  return (
    <section className={"setcard" + (open ? " is-open" : "")}>
      <button className="setcard__hd" onClick={() => setOpen((o) => !o)}>
        <span className="setcard__name">{set.name}</span>
        <span className="setcard__prog">{p.owned}/{p.required} owned</span>
        <span className="setcard__chev">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="setcard__body">
          {set.description && <p className="setcard__desc">{set.description}</p>}
          {members.map((m) => m.slots.map((inst, idx) => (
            <SetSlotRow key={m.figureId + '-' + idx} figureId={m.figureId} name={m.name} version={m.version}
                        inst={inst} onOpen={onOpen} onAdd={() => onAddInstance(m.figureId, null, null, set.setId)} />
          )))}
        </div>
      )}
    </section>
  );
}
