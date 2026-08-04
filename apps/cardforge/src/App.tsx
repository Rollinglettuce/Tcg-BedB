import { useMemo, useState } from 'react';
import { ESSENCE_ELEMENTS, CONJURING_SUBTYPES } from '@essence/game-rules';
import { getCostTier, validateConjuring } from '@essence/balance-engine';

export default function App() {
  const [name, setName] = useState('');
  const [element, setElement] = useState<(typeof ESSENCE_ELEMENTS)[number]>('Fire');
  const [subtype, setSubtype] = useState<(typeof CONJURING_SUBTYPES)[number]>('Elemental');
  const [essenceCost, setEssenceCost] = useState(3);
  const [attack, setAttack] = useState(5);
  const [health, setHealth] = useState(8);
  const [rulesText, setRulesText] = useState('');

  const tier = useMemo(() => getCostTier(essenceCost), [essenceCost]);
  const warnings = useMemo(
    () => validateConjuring({ name, essenceCost, attack, health }),
    [name, essenceCost, attack, health],
  );

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">ESSENCE CCG PLATFORM</p>
        <h1>Conjuring CardForge</h1>
        <p>Create and validate Conjurings against one shared canonical rules engine.</p>
      </header>

      <section className="workspace">
        <form className="panel" onSubmit={(event) => event.preventDefault()}>
          <h2>Card details</h2>
          <label>
            Card name
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Flame Warden" />
          </label>

          <div className="grid-two">
            <label>
              Element
              <select value={element} onChange={(event) => setElement(event.target.value as typeof element)}>
                {ESSENCE_ELEMENTS.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              Subtype
              <select value={subtype} onChange={(event) => setSubtype(event.target.value as typeof subtype)}>
                {CONJURING_SUBTYPES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
          </div>

          <div className="grid-three">
            <label>
              Essence cost
              <input type="number" min="1" max="15" value={essenceCost} onChange={(event) => setEssenceCost(Number(event.target.value))} />
            </label>
            <label>
              Attack
              <input type="number" min="0" value={attack} onChange={(event) => setAttack(Number(event.target.value))} />
            </label>
            <label>
              Health
              <input type="number" min="1" value={health} onChange={(event) => setHealth(Number(event.target.value))} />
            </label>
          </div>

          <label>
            Rules text
            <textarea value={rulesText} onChange={(event) => setRulesText(event.target.value)} placeholder="Describe the card ability..." />
          </label>
        </form>

        <aside className="panel preview" aria-live="polite">
          <div className="card-preview">
            <span className="cost">{essenceCost}</span>
            <p className="element">{element}</p>
            <h2>{name || 'Unnamed Conjuring'}</h2>
            <p>{subtype} • Conjuring</p>
            <div className="art">Card artwork</div>
            <p className="rules">{rulesText || 'Rules text will appear here.'}</p>
            <div className="stats"><strong>{attack} ATK</strong><strong>{health} HP</strong></div>
          </div>

          <div className="validation">
            <h3>{tier ? `${tier.tier} baseline` : 'Cost validation'}</h3>
            {tier && <p>Expected ATK {tier.attack[0]}–{tier.attack[1]} · HP {tier.health[0]}–{tier.health[1]}</p>}
            {warnings.length === 0 ? <p className="success">No baseline warnings.</p> : (
              <ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}
