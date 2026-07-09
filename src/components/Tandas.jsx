import { useState } from 'react'
import { formatMoney } from './ExpenseList'
import { tandaDerived } from '../utils/useTandas'
import { useConfirm } from '../contexts/ConfirmContext'
import { formatDayLabel, todayISO } from '../utils/dates'

const sortByDateDesc = (a, b) => (a.date < b.date ? 1 : -1)

const FREQUENCIES = [
  { id: 'semanal', label: 'Semanal', unit: 'semana' },
  { id: 'quincenal', label: 'Quincenal', unit: 'quincena' },
  { id: 'mensual', label: 'Mensual', unit: 'mes' },
]

const freqUnit = (id) => FREQUENCIES.find((f) => f.id === id)?.unit ?? 'periodo'

export function TandaCard({ tanda, accounts, movements, onEdit, onContribute, onUndoContribute, onPayout, onUndoPayout }) {
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

      {movements && movements.length > 0 && (
        <div className="tanda-history">
          <p className="tanda-history-title">Historial</p>
          {[...movements].sort(sortByDateDesc).map((m) => (
            <div key={m.id} className="tanda-history-item">
              <span className="tanda-history-label">
                {m.type === 'income' ? 'Cobro del pozo' : 'Aportación'}
              </span>
              <span className="tanda-history-date">{formatDayLabel(m.date)}</span>
              <span className={`tanda-history-amount ${m.type === 'income' ? 'income-text' : 'expense-text'}`}>
                {m.type === 'income' ? '+' : '−'}{formatMoney(m.amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      {sheet === 'contribute' && (
        <RegisterSheet
          title="Registrar aportación"
          amount={tanda.amount}
          defaultDate={d.nextDate ?? todayISO()}
          defaultAccount={tanda.account}
          accounts={accounts}
          confirmText="Registrar"
          onConfirm={(date, accountId) => {
            onContribute(date, accountId)
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
          defaultAccount={tanda.account}
          accounts={accounts}
          confirmText="Cobrar"
          onConfirm={(date, accountId) => {
            onPayout(date, accountId)
            setSheet(null)
          }}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  )
}

// Hojita para registrar aportación/cobro con fecha y cuenta seleccionables.
function RegisterSheet({ title, amount, defaultDate, defaultAccount, accounts, confirmText, onConfirm, onClose }) {
  const [date, setDate] = useState(defaultDate)
  const [accountId, setAccountId] = useState(defaultAccount ?? '')

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className="register-amount">{formatMoney(amount)}</div>

        {accounts && accounts.length > 0 && (
          <>
            <p className="picker-label">Cuenta</p>
            <div className="subcategory-picker">
              {accounts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`subcategory-chip ${accountId === a.id ? 'selected' : ''}`}
                  onClick={() => setAccountId(accountId === a.id ? '' : a.id)}
                >
                  {a.icon} {a.name}
                </button>
              ))}
            </div>
          </>
        )}

        <p className="picker-label">Fecha</p>
        <input
          className="date-input"
          type="date"
          value={date}
          max={todayISO()}
          onChange={(e) => setDate(e.target.value)}
        />

        <div className="sheet-actions">
          <button className="btn-primary" disabled={!date} onClick={() => onConfirm(date, accountId || null)}>
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

  // Mensaje de validación explícito: en vez de solo deshabilitar el botón,
  // le decimos al usuario qué falta o qué está mal.
  const error =
    myNumber !== '' && totalCount !== '' && myNum > totalNum
      ? `Tu turno (${myNum}) no puede ser mayor que el número de participantes (${totalNum}).`
      : myNumber !== '' && (!Number.isInteger(myNum) || myNum < 1)
        ? 'Tu turno debe ser un número mayor o igual a 1.'
        : ''

  // Resumen en vivo: traduce la configuración a lenguaje simple para que el
  // usuario confirme de un vistazo qué está creando (cuánto da, cuánto cobra
  // y cuándo). Solo se calcula cuando los datos ya son válidos.
  const previewValid =
    amountNum > 0 &&
    Number.isInteger(totalNum) &&
    totalNum >= 1 &&
    Number.isInteger(myNum) &&
    myNum >= 1 &&
    myNum <= totalNum &&
    startDate
  const preview = previewValid
    ? tandaDerived({
        amount: amountNum,
        totalCount: totalNum,
        myNumber: myNum,
        frequency,
        startDate,
        paysOnOwnTurn,
        paidCount: 0,
      })
    : null

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
            <p className="picker-label">¿Cuántas personas participan?</p>
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
            <p className="picker-label">¿En qué turno cobras?</p>
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
        <p className="piggy-hint">
          Cada participante cobra el pozo una vez, por turnos. Tu turno es el número que te tocó para cobrar.
        </p>

        <p className="picker-label">El día que cobras tu pozo, ¿también das tu aportación?</p>
        <div className="type-toggle">
          <button
            type="button"
            className={`type-toggle-btn ${paysOnOwnTurn ? 'selected' : ''}`}
            onClick={() => setPaysOnOwnTurn(true)}
          >
            Sí, aporto igual
          </button>
          <button
            type="button"
            className={`type-toggle-btn ${!paysOnOwnTurn ? 'selected' : ''}`}
            onClick={() => setPaysOnOwnTurn(false)}
          >
            No, ese día no
          </button>
        </div>
        <p className="piggy-hint">
          {paysOnOwnTurn
            ? 'Aportas en todos los turnos, incluido el tuyo (lo más común).'
            : 'No aportas el turno en que cobras, así que haces una aportación menos.'}
        </p>

        <p className="picker-label">¿Cuándo es la primera aportación?</p>
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

        {error && <p className="tanda-error">⚠️ {error}</p>}

        {preview && (
          <div className="tanda-summary">
            <p className="tanda-summary-title">Resumen</p>
            <ul className="tanda-summary-lines">
              <li>
                Aportas <strong>{formatMoney(amountNum)}</strong> cada <strong>{freqUnit(frequency)}</strong>.
              </li>
              <li>
                Harás <strong>{preview.totalContributions}</strong> aportaciones en total
                {!paysOnOwnTurn && ' (no aportas tu turno)'}.
              </li>
              <li>
                Cobras tu pozo de <strong>{formatMoney(preview.pot)}</strong> el{' '}
                <strong>{formatDayLabel(preview.payoutDate)}</strong>.
              </li>
              <li className="tanda-summary-net">
                Das {formatMoney(preview.commitment)} en total y recibes {formatMoney(preview.pot)} (neto $0).
              </li>
            </ul>
          </div>
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

export function TandaMovementEditor({ expense, accounts, onSave, onClose }) {
  const [date, setDate] = useState(expense.date)
  const [note, setNote] = useState(expense.note ?? '')
  const [accountId, setAccountId] = useState(expense.account ?? '')
  const isIncome = expense.type === 'income'

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>{isIncome ? 'Editar cobro de tanda' : 'Editar aportación de tanda'}</h2>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className="register-amount" style={{ color: isIncome ? '#22c55e' : '#ef4444' }}>
          {isIncome ? '+' : '−'}{formatMoney(expense.amount)}
        </div>

        {accounts && accounts.length > 0 && (
          <>
            <p className="picker-label">Cuenta</p>
            <div className="subcategory-picker">
              {accounts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`subcategory-chip ${accountId === a.id ? 'selected' : ''}`}
                  onClick={() => setAccountId(accountId === a.id ? '' : a.id)}
                >
                  {a.icon} {a.name}
                </button>
              ))}
            </div>
          </>
        )}

        <p className="picker-label">Fecha</p>
        <input
          className="date-input"
          type="date"
          value={date}
          max={todayISO()}
          onChange={(e) => setDate(e.target.value)}
        />

        <p className="picker-label">Nota</p>
        <input
          className="note-input"
          type="text"
          placeholder="Nota (opcional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="sheet-actions">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button
            className="btn-primary"
            disabled={!date}
            onClick={() => onSave({ date, note: note.trim() || null, account: accountId || null })}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
