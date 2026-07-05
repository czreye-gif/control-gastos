import { useState } from 'react'
import { formatMoney } from './ExpenseList'
import { tandaDerived } from '../utils/useTandas'
import { useConfirm } from '../contexts/ConfirmContext'
import { formatDayLabel, todayISO } from '../utils/dates'

const FREQUENCIES = [
  { id: 'semanal', label: 'Semanal', unit: 'semana' },
  { id: 'quincenal', label: 'Quincenal', unit: 'quincena' },
  { id: 'mensual', label: 'Mensual', unit: 'mes' },
]

const freqUnit = (id) => FREQUENCIES.find((f) => f.id === id)?.unit ?? 'periodo'

export function TandaCard({ tanda, accounts, onEdit, onContribute, onUndoContribute, onPayout, onUndoPayout }) {
  const confirm = useConfirm()
  const [sheet, setSheet] = useState(null) // null | 'contribute' | 'payout'
  const d = tandaDerived(tanda)
  const account = tanda.account ? accounts.find((a) => a.id === tanda.account) : null
  const isMyTurn = d.myTurnReached && !tanda.payoutReceived

  const askUndoContribute = async () => {
    const ok = await confirm({
      title: 'Deshacer aportación',
      message: 'Se elimina la última aportación registrada y su traspaso.',
      confirmText: 'Deshacer',
    })
    if (ok) onUndoContribute()
  }

  const askUndoPayout = async () => {
    const ok = await confirm({
      title: 'Deshacer cobro',
      message: 'Se elimina el cobro del pozo y su traspaso.',
      confirmText: 'Deshacer',
    })
    if (ok) onUndoPayout()
  }

  return (
    <div className={`tanda-card ${isMyTurn ? 'my-turn' : ''}`}>
      <button className="tanda-head" onClick={onEdit}>
        <span className="tanda-name">{tanda.name}</span>
        <span className="tanda-meta">
          {formatMoney(tanda.amount)} / {freqUnit(tanda.frequency)} · {tanda.totalCount} números · tu #
          {tanda.myNumber}
        </span>
      </button>

      {isMyTurn && (
        <div className="tanda-turn-banner">🎉 ¡Es tu turno! Cobra tu pozo de {formatMoney(d.pot)}</div>
      )}

      <div className="tanda-progress-label">
        {d.done ? 'Aportaciones completadas ✓' : `Vas ${d.paid} de ${d.totalContributions} aportaciones`}
      </div>
      <div className="tanda-dots">
        {Array.from({ length: d.totalContributions }).map((_, i) => (
          <span key={i} className={`tanda-dot ${i < d.paid ? 'done' : ''}`} />
        ))}
      </div>

      <div className="tanda-info">
        {d.nextDate && (
          <span>
            Próxima aportación: <strong>{formatDayLabel(d.nextDate)}</strong>
          </span>
        )}
        <span>
          {tanda.payoutReceived
            ? 'Pozo cobrado ✓'
            : `Cobras el ${formatDayLabel(d.payoutDate)}: ${formatMoney(d.pot)}`}
        </span>
        <span className="tanda-net">
          Das {formatMoney(d.commitment)} en total · recibes {formatMoney(d.pot)} (neto $0)
        </span>
      </div>

      <div className="tanda-actions">
        {!d.done && (
          <button className="btn-primary" onClick={() => setSheet('contribute')}>
            Registrar aportación
          </button>
        )}
        {!tanda.payoutReceived && (
          <button className={isMyTurn ? 'btn-primary' : 'btn-ghost'} onClick={() => setSheet('payout')}>
            Cobrar pozo
          </button>
        )}
      </div>

      {(d.paid > 0 || tanda.payoutReceived) && (
        <div className="tanda-undo">
          {d.paid > 0 && (
            <button className="link-btn" onClick={askUndoContribute}>
              Deshacer aportación
            </button>
          )}
          {tanda.payoutReceived && (
            <button className="link-btn" onClick={askUndoPayout}>
              Deshacer cobro
            </button>
          )}
        </div>
      )}

      {sheet === 'contribute' && (
        <RegisterSheet
          title="Registrar aportación"
          amount={tanda.amount}
          defaultDate={d.nextDate ?? todayISO()}
          accountName={account?.name}
          confirmText="Registrar"
          onConfirm={(date) => {
            onContribute(date)
            setSheet(null)
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'payout' && (
        <RegisterSheet
          title="Registrar cobro del pozo"
          amount={d.pot}
          defaultDate={d.payoutDate <= todayISO() ? d.payoutDate : todayISO()}
          accountName={account?.name}
          confirmText="Cobrar"
          onConfirm={(date) => {
            onPayout(date)
            setSheet(null)
          }}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  )
}

// Hojita para registrar aportación/cobro con fecha ajustable.
function RegisterSheet({ title, amount, defaultDate, accountName, confirmText, onConfirm, onClose }) {
  const [date, setDate] = useState(defaultDate)

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className="register-amount">
          {formatMoney(amount)}
          {accountName && <span className="register-account"> · {accountName}</span>}
        </div>

        <p className="picker-label">Fecha</p>
        <input
          className="date-input"
          type="date"
          value={date}
          max={todayISO()}
          onChange={(e) => setDate(e.target.value)}
        />

        <div className="sheet-actions">
          <button className="btn-primary" disabled={!date} onClick={() => onConfirm(date)}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

export function TandaEditor({ initial, accounts, onSave, onDelete, onClose }) {
  const confirm = useConfirm()
  const [name, setName] = useState(initial?.name ?? '')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [frequency, setFrequency] = useState(initial?.frequency ?? 'semanal')
  const [totalCount, setTotalCount] = useState(initial ? String(initial.totalCount) : '')
  const [myNumber, setMyNumber] = useState(initial ? String(initial.myNumber) : '')
  const [startDate, setStartDate] = useState(initial?.startDate ?? todayISO())
  const [account, setAccount] = useState(initial?.account ?? '')
  const [paysOnOwnTurn, setPaysOnOwnTurn] = useState(initial ? initial.paysOnOwnTurn !== false : true)

  const amountNum = Number(amount)
  const totalNum = Number(totalCount)
  const myNum = Number(myNumber)
  const canSave =
    name.trim() &&
    amountNum > 0 &&
    Number.isInteger(totalNum) &&
    totalNum >= 1 &&
    Number.isInteger(myNum) &&
    myNum >= 1 &&
    myNum <= totalNum

  const handleSave = () => {
    if (!canSave) return
    onSave({
      name: name.trim(),
      amount: amountNum,
      frequency,
      totalCount: totalNum,
      myNumber: myNum,
      startDate,
      account: account || null,
      paysOnOwnTurn,
    })
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>{initial ? 'Editar tanda' : 'Nueva tanda'}</h2>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <input
          className="note-input"
          type="text"
          placeholder="Nombre (ej. Tanda de la oficina)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <p className="picker-label">Monto por aportación</p>
        <div className="amount-input-wrap">
          <span className="amount-prefix">$</span>
          <input
            className="amount-input-field"
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <p className="picker-label">Frecuencia</p>
        <div className="type-toggle">
          {FREQUENCIES.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`type-toggle-btn ${frequency === f.id ? 'selected' : ''}`}
              onClick={() => setFrequency(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="tanda-fields">
          <div>
            <p className="picker-label">Números (participantes)</p>
            <input
              className="note-input"
              type="number"
              inputMode="numeric"
              min="1"
              placeholder="Ej. 10"
              value={totalCount}
              onChange={(e) => setTotalCount(e.target.value)}
            />
          </div>
          <div>
            <p className="picker-label">Tu número</p>
            <input
              className="note-input"
              type="number"
              inputMode="numeric"
              min="1"
              max={totalCount || undefined}
              placeholder="Ej. 4"
              value={myNumber}
              onChange={(e) => setMyNumber(e.target.value)}
            />
          </div>
        </div>

        <p className="picker-label">El día que te toca cobrar…</p>
        <div className="type-toggle">
          <button
            type="button"
            className={`type-toggle-btn ${paysOnOwnTurn ? 'selected' : ''}`}
            onClick={() => setPaysOnOwnTurn(true)}
          >
            También aporto
          </button>
          <button
            type="button"
            className={`type-toggle-btn ${!paysOnOwnTurn ? 'selected' : ''}`}
            onClick={() => setPaysOnOwnTurn(false)}
          >
            No aporto ese día
          </button>
        </div>
        <p className="piggy-hint">
          {paysOnOwnTurn
            ? 'Estilo tanda de 10: aportas en todos los periodos, incluido tu turno.'
            : 'Estilo tanda de 11: no aportas el periodo que cobras (una aportación menos).'}
        </p>

        <p className="picker-label">Fecha de la primera aportación</p>
        <input
          className="date-input"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />

        {accounts.length > 0 && (
          <>
            <p className="picker-label">Cuenta de origen (opcional)</p>
            <div className="subcategory-picker">
              {accounts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`subcategory-chip ${account === a.id ? 'selected' : ''}`}
                  onClick={() => setAccount(account === a.id ? '' : a.id)}
                >
                  {a.icon} {a.name}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="sheet-actions">
          {initial && (
            <button
              className="btn-danger"
              onClick={async () => {
                const ok = await confirm({
                  title: `Eliminar "${initial.name}"`,
                  message: 'Se elimina la tanda. Los traspasos ya registrados se conservan.',
                })
                if (ok) onDelete(initial.id)
              }}
            >
              Eliminar
            </button>
          )}
          <button className="btn-primary" disabled={!canSave} onClick={handleSave}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
