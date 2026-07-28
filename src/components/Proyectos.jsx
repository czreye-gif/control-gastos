import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatMoney } from './ExpenseList'
import { useExpenses } from '../utils/useExpenses'
import { useAccounts } from '../utils/useAccounts'
import { useCategories } from '../contexts/CategoriesContext'
import { useProjects, projectDerived, KIND_LABEL } from '../utils/useProjects'
import { useConfirm } from '../contexts/ConfirmContext'
import { formatDayLabel, todayISO } from '../utils/dates'

const sortByDateDesc = (a, b) => (a.date < b.date ? 1 : -1)

// Agrupa los movimientos por projectId.
function useProjectMovements(expenses) {
  return useMemo(() => {
    const map = new Map()
    for (const e of expenses) {
      if (!e.projectId) continue
      if (!map.has(e.projectId)) map.set(e.projectId, [])
      map.get(e.projectId).push(e)
    }
    return map
  }, [expenses])
}

export default function Proyectos() {
  const navigate = useNavigate()
  const { expenses, loading: loadingExp } = useExpenses()
  const { accounts } = useAccounts()
  const {
    projects,
    loading,
    addProject,
    updateProject,
    deleteProject,
    addMovement,
    updateMovement,
    deleteMovement,
  } = useProjects()

  const [selectedId, setSelectedId] = useState(null)
  const [editing, setEditing] = useState(null) // null | 'new' | proyecto

  const movementsByProject = useProjectMovements(expenses)
  const payAccounts = useMemo(() => accounts.filter((a) => !a.piggy), [accounts])
  const selected = projects.find((p) => p.id === selectedId) ?? null

  const saveProject = async (data) => {
    if (editing && editing !== 'new') await updateProject(editing.id, data)
    else await addProject(data)
    setEditing(null)
  }

  const removeProject = async (id) => {
    await deleteProject(id)
    setEditing(null)
    setSelectedId(null)
  }

  if (loading || loadingExp) return <p className="loading-text">Cargando...</p>

  // --- Detalle de un proyecto (libro diario + rendición de cuentas) ---
  if (selected) {
    return (
      <ProjectDetail
        project={selected}
        movements={movementsByProject.get(selected.id) ?? []}
        accounts={payAccounts}
        onBack={() => setSelectedId(null)}
        onEdit={() => setEditing(selected)}
        onAddMovement={(data) => addMovement(selected, data)}
        onUpdateMovement={updateMovement}
        onDeleteMovement={deleteMovement}
        editor={
          editing && (
            <ProjectEditor
              initial={editing === 'new' ? null : editing}
              onSave={saveProject}
              onDelete={removeProject}
              onClose={() => setEditing(null)}
            />
          )
        }
      />
    )
  }

  const active = projects.filter((p) => p.status !== 'closed')
  const closed = projects.filter((p) => p.status === 'closed')

  const renderList = (items) =>
    items.map((p) => {
      const d = projectDerived(movementsByProject.get(p.id) ?? [])
      return (
        <button key={p.id} className="project-card" onClick={() => setSelectedId(p.id)}>
          <span className="project-card-head">
            <span className="project-card-name">{p.name}</span>
            {p.status === 'closed' && <span className="project-tag">Cerrado</span>}
          </span>
          {p.partner && <span className="project-card-partner">👤 {p.partner}</span>}
          <span className="project-card-figures">
            <span className="project-fig">
              <span className="project-fig-label">Caja</span>
              <span className={`project-fig-value ${d.cash < 0 ? 'expense-text' : ''}`}>
                {formatMoney(d.cash)}
              </span>
            </span>
            <span className="project-fig">
              <span className="project-fig-label">Me deben</span>
              <span className={`project-fig-value ${d.owedToMe > 0 ? 'income-text' : ''}`}>
                {formatMoney(d.owedToMe)}
              </span>
            </span>
            <span className="project-fig">
              <span className="project-fig-label">Mi utilidad</span>
              <span className="project-fig-value income-text">{formatMoney(d.profit)}</span>
            </span>
          </span>
        </button>
      )
    })

  return (
    <div className="page">
      <header className="sub-header">
        <button className="icon-btn" onClick={() => navigate('/')} aria-label="Volver">←</button>
        <h1>Proyectos</h1>
      </header>

      <p className="page-subtitle">
        Libro diario de los proyectos que operas con capital de tus socios. Registra el día a día y ten lista la
        rendición de cuentas.
      </p>

      {projects.length === 0 ? (
        <button className="budget-cta" onClick={() => setEditing('new')}>
          Crea tu primer proyecto para llevar el control del dinero →
        </button>
      ) : (
        <>
          <div className="project-list">{renderList(active)}</div>
          {closed.length > 0 && (
            <>
              <h3 className="section-title">Cerrados</h3>
              <div className="project-list">{renderList(closed)}</div>
            </>
          )}
        </>
      )}

      <button className="fab" onClick={() => setEditing('new')} aria-label="Nuevo proyecto">+</button>

      {editing && (
        <ProjectEditor
          initial={editing === 'new' ? null : editing}
          onSave={saveProject}
          onDelete={removeProject}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function ProjectDetail({
  project,
  movements,
  accounts,
  onBack,
  onEdit,
  onAddMovement,
  onUpdateMovement,
  onDeleteMovement,
  editor,
}) {
  const [adding, setAdding] = useState(false)
  const [editingMov, setEditingMov] = useState(null)
  const d = projectDerived(movements)
  const ordered = [...movements].sort(sortByDateDesc)

  return (
    <div className="page">
      <header className="sub-header">
        <button className="icon-btn" onClick={onBack} aria-label="Volver">←</button>
        <h1>{project.name}</h1>
        <button className="icon-btn" onClick={onEdit} aria-label="Editar proyecto">⚙️</button>
      </header>

      {project.partner && <p className="page-subtitle">👤 Socio: {project.partner}</p>}

      {/* Rendición de cuentas */}
      <div className="project-summary">
        <div className="project-block">
          <p className="project-block-title">Caja del fondo</p>
          <div className="project-row">
            <span>Recibido del socio</span>
            <span>{formatMoney(d.received)}</span>
          </div>
          <div className="project-row">
            <span>Gastado del fondo</span>
            <span className="expense-text">−{formatMoney(d.chargedFund)}</span>
          </div>
          {d.feesFromFund > 0 && (
            <div className="project-row">
              <span>Mi honorario (del fondo)</span>
              <span className="expense-text">−{formatMoney(d.feesFromFund)}</span>
            </div>
          )}
          {d.reimbursedFromFund > 0 && (
            <div className="project-row">
              <span>Me reembolsé del fondo</span>
              <span className="expense-text">−{formatMoney(d.reimbursedFromFund)}</span>
            </div>
          )}
          {d.refunded > 0 && (
            <div className="project-row">
              <span>Devuelto al socio</span>
              <span className="expense-text">−{formatMoney(d.refunded)}</span>
            </div>
          )}
          <div className="project-row total">
            <span>Queda en caja</span>
            <span className={d.cash < 0 ? 'expense-text' : 'income-text'}>{formatMoney(d.cash)}</span>
          </div>
        </div>

        <div className="project-block">
          <p className="project-block-title">Me deben reembolsar</p>
          <div className="project-row">
            <span>Adelanté de mi bolsa</span>
            <span>{formatMoney(d.chargedAdvanced)}</span>
          </div>
          {d.reimbursed > 0 && (
            <div className="project-row">
              <span>Ya me reembolsaron</span>
              <span className="expense-text">−{formatMoney(d.reimbursed)}</span>
            </div>
          )}
          <div className="project-row total">
            <span>Me deben</span>
            <span className={d.owedToMe > 0 ? 'income-text' : ''}>{formatMoney(d.owedToMe)}</span>
          </div>
        </div>

        <div className="project-block">
          <p className="project-block-title">Mi utilidad</p>
          <div className="project-row">
            <span>Honorarios</span>
            <span>{formatMoney(d.fees)}</span>
          </div>
          <div className="project-row">
            <span>Margen en compras</span>
            <span>{formatMoney(d.margin)}</span>
          </div>
          <div className="project-row total">
            <span>Total ganado</span>
            <span className="income-text">{formatMoney(d.profit)}</span>
          </div>
        </div>
      </div>

      <p className="project-cost-line">
        Costo total del proyecto: <strong>{formatMoney(d.totalCost)}</strong>
        {d.margin > 0 && <> · cobrado al socio: <strong>{formatMoney(d.totalCharged)}</strong></>}
      </p>

      <button className="btn-primary project-add-btn" onClick={() => setAdding(true)}>
        + Registrar movimiento
      </button>

      <h3 className="section-title">Libro diario</h3>
      {ordered.length === 0 ? (
        <p className="empty-state" style={{ fontSize: 13 }}>
          Aún no hay movimientos. Registra la entrega de capital o el primer gasto.
        </p>
      ) : (
        <div className="ledger-list">
          {ordered.map((m) => {
            const inflow = m.type === 'income'
            const charged = m.charged != null && m.charged !== m.amount
            return (
              <button key={m.id} className="ledger-item" onClick={() => setEditingMov(m)}>
                <span className="ledger-main">
                  <span className="ledger-concept">{m.concept || KIND_LABEL[m.projectKind] || 'Movimiento'}</span>
                  <span className="ledger-meta">
                    {KIND_LABEL[m.projectKind]}
                    {m.projectKind === 'expense' && (m.paidFrom === 'own' ? ' · lo adelanté yo' : ' · del fondo')}
                    {' · '}{formatDayLabel(m.date)}
                  </span>
                </span>
                <span className="ledger-amounts">
                  <span className={`ledger-amount ${inflow ? 'income-text' : 'expense-text'}`}>
                    {inflow ? '+' : '−'}{formatMoney(m.amount)}
                  </span>
                  {charged && (
                    <span className="ledger-charged">cobré {formatMoney(m.charged)}</span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {adding && (
        <MovementSheet
          accounts={accounts}
          onSave={async (data) => {
            await onAddMovement(data)
            setAdding(false)
          }}
          onClose={() => setAdding(false)}
        />
      )}

      {editingMov && (
        <MovementSheet
          initial={editingMov}
          accounts={accounts}
          onSave={async (data) => {
            await onUpdateMovement(editingMov.id, {
              amount: data.amount,
              charged: data.charged ?? null,
              concept: data.concept,
              date: data.date,
              account: data.account || null,
              paidFrom: data.kind === 'expense' ? data.paidFrom : null,
            })
            setEditingMov(null)
          }}
          onDelete={async () => {
            await onDeleteMovement(editingMov.id)
            setEditingMov(null)
          }}
          onClose={() => setEditingMov(null)}
        />
      )}

      {editor}
    </div>
  )
}

function ProjectEditor({ initial, onSave, onDelete, onClose }) {
  const confirm = useConfirm()
  const [name, setName] = useState(initial?.name ?? '')
  const [partner, setPartner] = useState(initial?.partner ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [status, setStatus] = useState(initial?.status ?? 'active')

  const canSave = name.trim().length > 0

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>{initial ? 'Editar proyecto' : 'Nuevo proyecto'}</h2>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <input
          className="note-input"
          type="text"
          placeholder="Nombre (ej. Reparación auto — Ana)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <p className="picker-label">Socio (quien pone el capital)</p>
        <input
          className="note-input"
          type="text"
          placeholder="Nombre del socio"
          value={partner}
          onChange={(e) => setPartner(e.target.value)}
        />

        <input
          className="note-input"
          type="text"
          placeholder="Nota (opcional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {initial && (
          <>
            <p className="picker-label">Estado</p>
            <div className="type-toggle">
              <button
                type="button"
                className={`type-toggle-btn ${status === 'active' ? 'selected' : ''}`}
                onClick={() => setStatus('active')}
              >
                Activo
              </button>
              <button
                type="button"
                className={`type-toggle-btn ${status === 'closed' ? 'selected' : ''}`}
                onClick={() => setStatus('closed')}
              >
                Cerrado
              </button>
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
                  message:
                    'Se elimina el proyecto y todos los movimientos de su libro diario. Los saldos de tus cuentas se ajustan.',
                })
                if (ok) onDelete(initial.id)
              }}
            >
              Eliminar
            </button>
          )}
          <button
            className="btn-primary"
            disabled={!canSave}
            onClick={() =>
              onSave({ name: name.trim(), partner: partner.trim(), note: note.trim(), status })
            }
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

const KIND_OPTIONS = [
  { id: 'funding', label: '💰 Capital', hint: 'El socio te entregó dinero' },
  { id: 'expense', label: '🧰 Gasto', hint: 'Pago del proyecto' },
  { id: 'fee', label: '⭐ Honorario', hint: 'Tu pago por gestionar' },
  { id: 'reimbursement', label: '↩️ Reembolso', hint: 'Te devolvieron lo que adelantaste' },
  { id: 'refund', label: '📤 Devolución', hint: 'Regresas sobrante al socio' },
]

function MovementSheet({ initial, accounts, onSave, onDelete, onClose }) {
  const confirm = useConfirm()
  const { categories } = useCategories()
  const isEdit = !!initial
  const [kind, setKind] = useState(initial?.projectKind ?? 'expense')
  const [value, setValue] = useState(initial ? String(initial.amount) : '')
  const [chargedValue, setChargedValue] = useState(
    initial?.charged != null ? String(initial.charged) : ''
  )
  const [concept, setConcept] = useState(initial?.concept ?? '')
  const [date, setDate] = useState(initial?.date ?? todayISO())
  const [paidFrom, setPaidFrom] = useState(initial?.paidFrom ?? 'fund')
  const [category, setCategory] = useState(initial?.category ?? '')

  // El honorario y el reembolso pueden salir del propio fondo (el dinero ya
  // está en tu cuenta: solo deja de ser del socio, no mueve saldo) o pagarse
  // aparte (entra dinero nuevo). Por defecto salen del fondo, que es lo común.
  const takenFromFund = (k) => k === 'fee' || k === 'reimbursement'
  const [fromFund, setFromFund] = useState(
    initial ? takenFromFund(initial.projectKind) && !initial.account : takenFromFund(kind)
  )
  const [account, setAccount] = useState(
    initial?.account ?? (takenFromFund(kind) ? '' : accounts[0]?.id ?? '')
  )

  const selectKind = (k) => {
    setKind(k)
    if (takenFromFund(k)) {
      setFromFund(true)
      setAccount('')
    } else {
      setFromFund(false)
      setAccount((a) => a || accounts[0]?.id || '')
    }
  }

  const amount = Number(value)
  const charged = chargedValue === '' ? null : Number(chargedValue)
  const optionalAccount = takenFromFund(kind)
  const needsAccount = !(optionalAccount && fromFund)
  const canSave = value !== '' && Number.isFinite(amount) && amount > 0 && (!needsAccount || !!account)
  const incomeCategories = categories.filter((c) => c.type === 'income')

  const label =
    kind === 'expense'
      ? 'Costo real (lo que pagaste)'
      : kind === 'funding'
        ? 'Monto que te entregó'
        : 'Monto'

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>{isEdit ? 'Editar movimiento' : 'Nuevo movimiento'}</h2>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {!isEdit && (
          <>
            <p className="picker-label">Tipo de movimiento</p>
            <div className="kind-picker">
              {KIND_OPTIONS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  className={`kind-chip ${kind === k.id ? 'selected' : ''}`}
                  onClick={() => selectKind(k.id)}
                >
                  <span className="kind-chip-label">{k.label}</span>
                  <span className="kind-chip-hint">{k.hint}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {isEdit && <p className="piggy-hint">{KIND_LABEL[kind]}</p>}

        <p className="picker-label">{label}</p>
        <div className="amount-input-wrap">
          <span className="amount-prefix">$</span>
          <input
            className="amount-input-field"
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            placeholder="0"
            value={value}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
          />
        </div>

        {kind === 'expense' && (
          <>
            <p className="picker-label">¿Quién lo pagó?</p>
            <div className="type-toggle">
              <button
                type="button"
                className={`type-toggle-btn ${paidFrom === 'fund' ? 'selected' : ''}`}
                onClick={() => setPaidFrom('fund')}
              >
                Del fondo
              </button>
              <button
                type="button"
                className={`type-toggle-btn ${paidFrom === 'own' ? 'selected' : ''}`}
                onClick={() => setPaidFrom('own')}
              >
                Lo adelanté yo
              </button>
            </div>

            <p className="picker-label">Lo que le cobré al socio (opcional)</p>
            <div className="amount-input-wrap">
              <span className="amount-prefix">$</span>
              <input
                className="amount-input-field"
                type="number"
                inputMode="decimal"
                min="0"
                step="1"
                placeholder="Igual al costo"
                value={chargedValue}
                onChange={(e) => setChargedValue(e.target.value)}
              />
            </div>
            {charged != null && charged > amount && (
              <p className="piggy-hint">
                Tu margen en esta compra: <strong>{formatMoney(charged - amount)}</strong>
              </p>
            )}
          </>
        )}

        <p className="picker-label">Concepto</p>
        <input
          className="note-input"
          type="text"
          placeholder={kind === 'expense' ? 'Ej. Hojalatería, refacciones…' : 'Descripción (opcional)'}
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
        />

        {optionalAccount && (
          <>
            <p className="picker-label">¿De dónde sale?</p>
            <div className="type-toggle">
              <button
                type="button"
                className={`type-toggle-btn ${fromFund ? 'selected' : ''}`}
                onClick={() => { setFromFund(true); setAccount('') }}
              >
                Del fondo
              </button>
              <button
                type="button"
                className={`type-toggle-btn ${!fromFund ? 'selected' : ''}`}
                onClick={() => { setFromFund(false); setAccount(account || accounts[0]?.id || '') }}
              >
                Me lo pagaron aparte
              </button>
            </div>
            <p className="piggy-hint">
              {fromFund
                ? 'Sale del dinero del socio que ya tienes: baja la caja del proyecto y no mueve el saldo de tus cuentas.'
                : 'Entra dinero nuevo a la cuenta que elijas; la caja del proyecto no cambia.'}
            </p>
          </>
        )}

        {accounts.length > 0 && needsAccount && (
          <>
            <p className="picker-label">Cuenta</p>
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

        {kind === 'fee' && !isEdit && incomeCategories.length > 0 && (
          <>
            <p className="picker-label">Categoría del ingreso (opcional)</p>
            <div className="subcategory-picker">
              {incomeCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`subcategory-chip ${category === c.id ? 'selected' : ''}`}
                  onClick={() => setCategory(category === c.id ? '' : c.id)}
                >
                  {c.icon} {c.name}
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
          {isEdit && (
            <button
              className="btn-danger"
              onClick={async () => {
                const ok = await confirm({
                  title: 'Eliminar movimiento',
                  message: 'Se elimina del libro diario y el saldo de tus cuentas se ajusta.',
                })
                if (ok) onDelete()
              }}
            >
              Eliminar
            </button>
          )}
          <button
            className="btn-primary"
            disabled={!canSave}
            onClick={() =>
              onSave({
                kind,
                amount,
                charged: kind === 'expense' ? charged : null,
                concept,
                date,
                account,
                paidFrom,
                category,
              })
            }
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// Resumen para Inicio: proyectos activos con caja y lo que te deben.
export function ProjectsSummary({ projects, expenses, onOpen }) {
  const movementsByProject = useProjectMovements(expenses)
  const active = projects.filter((p) => p.status !== 'closed')

  const totals = useMemo(() => {
    let cash = 0
    let owed = 0
    for (const p of active) {
      const d = projectDerived(movementsByProject.get(p.id) ?? [])
      cash += d.cash
      owed += d.owedToMe
    }
    return { cash, owed }
  }, [active, movementsByProject])

  if (active.length === 0) return null

  return (
    <button className="loan-summary-card" onClick={onOpen}>
      <span className="loan-summary-item">
        <span className="loan-summary-label">🏗️ En caja de proyectos</span>
        <span className="loan-summary-value">{formatMoney(totals.cash)}</span>
      </span>
      <span className="loan-summary-item">
        <span className="loan-summary-label">Me deben reembolsar</span>
        <span className="loan-summary-value income-text">{formatMoney(totals.owed)}</span>
      </span>
    </button>
  )
}
