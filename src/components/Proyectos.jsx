import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatMoney } from './ExpenseList'
import { useExpenses } from '../utils/useExpenses'
import { useAccounts } from '../utils/useAccounts'
import { useCategories } from '../contexts/CategoriesContext'
import { useProjects, projectSummary, migrateProject, PROJECT_MODES, ME_ID } from '../utils/useProjects'
import { equalSharesFor } from '../utils/useSplit'
import { useAuth } from '../contexts/AuthContext'
import { useConfirm } from '../contexts/ConfirmContext'
import { formatDayLabel, todayISO } from '../utils/dates'

const sortByDateDesc = (a, b) => (a.date < b.date ? 1 : -1)

// Acepta "tienda.com/x" o "https://…". Descarta esquemas que no sean http(s)
// (javascript:, data:…) para no abrir enlaces peligrosos.
function normalizeUrl(raw) {
  const s = (raw ?? '').trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return ''
  return `https://${s}`
}

function openLink(url) {
  const safe = normalizeUrl(url)
  if (safe) window.open(safe, '_blank', 'noopener,noreferrer')
}

async function shareText(text, title) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text })
      return 'shared'
    } catch {
      return 'cancelled'
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}

const nameOf = (owner, id) => (owner.participants ?? []).find((p) => p.id === id)?.name ?? '—'

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
  const { user } = useAuth()
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
    addPending,
    updatePending,
    deletePending,
  } = useProjects()

  const [selectedId, setSelectedId] = useState(null)
  const [editing, setEditing] = useState(null)

  const movementsByProject = useProjectMovements(expenses)
  const payAccounts = useMemo(() => accounts.filter((a) => !a.piggy), [accounts])
  const selected = projects.find((p) => p.id === selectedId) ?? null

  // Migra en silencio los proyectos creados con el modelo anterior (fondo). El
  // candado evita que se dispare dos veces mientras la escritura va en camino.
  const migrating = useRef(new Set())
  useEffect(() => {
    if (!user) return
    projects
      .filter((p) => !p.participants && !migrating.current.has(p.id))
      .forEach((p) => {
        migrating.current.add(p.id)
        migrateProject(user.uid, p).catch((e) => {
          console.error('No se pudo migrar el proyecto:', e)
          migrating.current.delete(p.id)
        })
      })
  }, [projects, user])

  const saveProject = async (data) => {
    if (editing && editing !== 'new') await updateProject(editing.id, data)
    else await addProject(data)
    setEditing(null)
  }

  if (loading || loadingExp) return <p className="loading-text">Cargando...</p>

  if (selected && selected.participants) {
    return (
      <ProjectDetail
        project={selected}
        movements={movementsByProject.get(selected.id) ?? []}
        accounts={payAccounts}
        onBack={() => setSelectedId(null)}
        onEdit={() => setEditing(selected)}
        onAdd={(m) => addMovement(selected, m, (id) => nameOf(selected, id))}
        onUpdate={updateMovement}
        onDeleteMov={deleteMovement}
        onAddPending={(d) => addPending(selected, d)}
        onUpdatePending={(id, d) => updatePending(selected, id, d)}
        onDeletePending={(id) => deletePending(selected, id)}
        editor={
          editing && (
            <ProjectEditor
              initial={editing === 'new' ? null : editing}
              onSave={saveProject}
              onDelete={async (id) => {
                await deleteProject(id)
                setEditing(null)
                setSelectedId(null)
              }}
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
      if (!p.participants) {
        return (
          <div key={p.id} className="project-card">
            <span className="project-card-name">{p.name}</span>
            <span className="project-card-partner">Actualizando…</span>
          </div>
        )
      }
      const s = projectSummary(p, movementsByProject.get(p.id) ?? [])
      const isGestoria = (p.mode ?? 'gestoria') === 'gestoria'
      return (
        <button key={p.id} className="project-card" onClick={() => setSelectedId(p.id)}>
          <span className="project-card-head">
            <span className="project-card-name">{p.name}</span>
            {p.status === 'closed' && <span className="project-tag">Cerrado</span>}
          </span>
          <span className="project-card-partner">
            {isGestoria ? '🛠️ Gestoría' : '🤝 Asociación'} ·{' '}
            {(p.participants ?? []).filter((x) => x.id !== ME_ID).map((x) => x.name).join(', ') || 'Sin socios'}
          </span>
          <span className="project-card-figures">
            <span className="project-fig">
              <span className="project-fig-label">Costo</span>
              <span className="project-fig-value">{formatMoney(s.totalCost)}</span>
            </span>
            <span className="project-fig">
              <span className="project-fig-label">{s.myBalance >= 0 ? 'Me deben' : 'Debo'}</span>
              <span className={`project-fig-value ${s.myBalance >= 0 ? 'income-text' : 'expense-text'}`}>
                {formatMoney(Math.abs(s.myBalance))}
              </span>
            </span>
            {isGestoria && (
              <span className="project-fig">
                <span className="project-fig-label">Utilidad</span>
                <span className="project-fig-value income-text">{formatMoney(s.profit)}</span>
              </span>
            )}
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
        Lleva el día a día de tus proyectos y ten lista la rendición de cuentas. Cuando el dinero sale de tus
        cuentas se registra en tus movimientos; cuando paga un socio, no.
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
          onDelete={async (id) => {
            await deleteProject(id)
            setEditing(null)
          }}
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
  onAdd,
  onUpdate,
  onDeleteMov,
  onAddPending,
  onUpdatePending,
  onDeletePending,
  editor,
}) {
  const [adding, setAdding] = useState(null)
  const [editingMov, setEditingMov] = useState(null)
  const [addingPending, setAddingPending] = useState(false)
  const [editingPending, setEditingPending] = useState(null)
  const [buyingPending, setBuyingPending] = useState(null)

  const s = projectSummary(project, movements)
  const isGestoria = (project.mode ?? 'gestoria') === 'gestoria'
  const ordered = [...movements].sort(sortByDateDesc)
  const pending = project.pending ?? []

  return (
    <div className="page">
      <header className="sub-header">
        <button className="icon-btn" onClick={onBack} aria-label="Volver">←</button>
        <h1>{project.name}</h1>
        <button className="icon-btn" onClick={onEdit} aria-label="Editar proyecto">⚙️</button>
      </header>

      <p className="page-subtitle">
        {isGestoria ? PROJECT_MODES.gestoria.label : PROJECT_MODES.asociacion.label}
      </p>

      <div className="total-card">
        <p>Costo del proyecto</p>
        <h2>{formatMoney(s.totalCost)}</h2>
      </div>

      {/* Rendición de cuentas: quién puso qué y quién debe a quién */}
      <div className="project-block">
        <p className="project-block-title">Rendición de cuentas</p>
        {s.balances.map((b) => (
          <div key={b.id} className="project-row">
            <span>
              {b.id === ME_ID ? '👤 Yo' : b.name}
              <span className="participant-share"> · {b.share}%</span>
            </span>
            <span>
              {formatMoney(b.paid)}
              <span className="muted-text"> de {formatMoney(b.owed)}</span>
            </span>
          </div>
        ))}
        {s.settlements.length > 0 ? (
          s.settlements.map((d, i) => (
            <div key={i} className="project-row total">
              <span>{d.from} ➔ {d.to}</span>
              <span className="expense-text">{formatMoney(d.amount)}</span>
            </div>
          ))
        ) : (
          <div className="project-row total">
            <span>Cuentas al día ✓</span>
            <span className="income-text">{formatMoney(0)}</span>
          </div>
        )}
      </div>

      {isGestoria && (
        <div className="project-block">
          <p className="project-block-title">Mi utilidad</p>
          <div className="project-row">
            <span>Honorarios</span>
            <span>{formatMoney(s.fees)}</span>
          </div>
          <div className="project-row">
            <span>Margen en compras</span>
            <span>{formatMoney(s.margin)}</span>
          </div>
          <div className="project-row total">
            <span>Total ganado</span>
            <span className="income-text">{formatMoney(s.profit)}</span>
          </div>
        </div>
      )}

      <PendingSection
        items={pending}
        projectName={project.name}
        onAdd={() => setAddingPending(true)}
        onEdit={(item) => setEditingPending(item)}
        onToggleStatus={(item) =>
          onUpdatePending(item.id, { status: item.status === 'solicitado' ? 'topedir' : 'solicitado' })
        }
        onBuy={(item) => {
          setBuyingPending(item)
          setAdding({ kind: 'expense', prefill: { concept: item.concept, amount: item.amount } })
        }}
      />

      <div className="trip-actions">
        <button className="btn-primary" onClick={() => setAdding({ kind: 'expense' })}>+ Gasto</button>
        {isGestoria && (
          <button className="btn-ghost" onClick={() => setAdding({ kind: 'fee' })}>⭐ Honorario</button>
        )}
        <button className="btn-ghost" onClick={() => setAdding({ kind: 'settlement' })}>💸 Pago directo</button>
      </div>

      <h3 className="section-title">Libro diario</h3>
      {ordered.length === 0 ? (
        <p className="empty-state" style={{ fontSize: 13 }}>
          Aún no hay movimientos. Registra el primer gasto o la entrega de dinero del socio.
        </p>
      ) : (
        <div className="ledger-list">
          {ordered.map((m) => {
            const isSettlement = m.kind === 'settlement'
            const isFee = m.kind === 'fee'
            const charged = m.charged != null && m.charged !== m.amount
            return (
              <button key={m.id} className="ledger-item" onClick={() => setEditingMov(m)}>
                <span className="ledger-main">
                  <span className="ledger-concept">
                    {isSettlement
                      ? `${nameOf(project, m.paidBy)} ➔ ${nameOf(project, m.paidTo)}`
                      : m.concept || (isFee ? 'Honorario' : 'Gasto')}
                  </span>
                  <span className="ledger-meta">
                    {isSettlement
                      ? 'Pago directo'
                      : `${isFee ? 'Honorario' : 'Gasto'} · pagó ${nameOf(project, m.paidBy)}`}
                    {' · '}{formatDayLabel(m.date)}
                  </span>
                </span>
                <span className="ledger-amounts">
                  <span className={`ledger-amount ${isSettlement || isFee ? 'income-text' : 'expense-text'}`}>
                    {formatMoney(m.amount)}
                  </span>
                  {charged && <span className="ledger-charged">cobré {formatMoney(m.charged)}</span>}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {adding && (
        <MovementSheet
          kind={adding.kind}
          prefill={adding.prefill}
          project={project}
          accounts={accounts}
          onSave={async (data) => {
            await onAdd(data)
            if (buyingPending) await onDeletePending(buyingPending.id)
            setBuyingPending(null)
            setAdding(null)
          }}
          onClose={() => {
            setBuyingPending(null)
            setAdding(null)
          }}
        />
      )}

      {editingMov && (
        <MovementSheet
          initial={editingMov}
          kind={editingMov.kind}
          project={project}
          accounts={accounts}
          onSave={async (data) => {
            const touchesMe = data.paidBy === ME_ID || data.paidTo === ME_ID
            await onUpdate(editingMov.id, {
              amount: data.amount,
              charged: data.charged ?? null,
              concept: data.concept,
              date: data.date,
              paidBy: data.paidBy,
              paidTo: data.paidTo ?? null,
              account: touchesMe ? data.account || null : null,
              offBook: !touchesMe,
            })
            setEditingMov(null)
          }}
          onDelete={async () => {
            await onDeleteMov(editingMov.id)
            setEditingMov(null)
          }}
          onClose={() => setEditingMov(null)}
        />
      )}

      {addingPending && (
        <PendingEditor
          onSave={async (d) => {
            await onAddPending(d)
            setAddingPending(false)
          }}
          onClose={() => setAddingPending(false)}
        />
      )}

      {editingPending && (
        <PendingEditor
          initial={editingPending}
          onSave={async (d) => {
            await onUpdatePending(editingPending.id, d)
            setEditingPending(null)
          }}
          onDelete={async () => {
            await onDeletePending(editingPending.id)
            setEditingPending(null)
          }}
          onClose={() => setEditingPending(null)}
        />
      )}

      {editor}
    </div>
  )
}

function PendingSection({ items, projectName, onAdd, onEdit, onToggleStatus, onBuy }) {
  const [toast, setToast] = useState('')
  const total = items.reduce((a, p) => a + (p.amount || 0), 0)

  const notify = (result) => {
    if (result === 'copied') setToast('Copiado al portapapeles ✓')
    else if (result === 'failed') setToast('No se pudo compartir')
    else return
    setTimeout(() => setToast(''), 2500)
  }

  const shareOne = async (p) => {
    const link = normalizeUrl(p.link)
    notify(await shareText(`${p.concept} — ${formatMoney(p.amount)}${link ? `\n${link}` : ''}`, projectName))
  }

  const shareList = async () => {
    const lines = items.map((p) => {
      const link = normalizeUrl(p.link)
      return `• ${p.concept} — ${formatMoney(p.amount)}${link ? `\n  ${link}` : ''}`
    })
    notify(
      await shareText(
        `Pendientes por comprar — ${projectName}\n\n${lines.join('\n')}\n\nTotal: ${formatMoney(total)}`,
        `Pendientes — ${projectName}`
      )
    )
  }

  return (
    <div className="project-block pending-block">
      <div className="pending-head">
        <p className="project-block-title">Pendientes por comprar</p>
        <button className="link-btn" onClick={onAdd}>+ Agregar</button>
      </div>

      {items.length === 0 ? (
        <p className="pending-empty">
          Anota aquí lo que falta comprar para tenerlo listo cuando le llames al socio.
        </p>
      ) : (
        <>
          <div className="pending-list">
            {items.map((p) => (
              <div key={p.id} className="pending-item">
                <button className="pending-main" onClick={() => onEdit(p)}>
                  <span className="pending-concept">{p.concept}</span>
                  <span className="pending-amount">{formatMoney(p.amount)}</span>
                </button>
                <div className="pending-actions">
                  <button
                    className={`pending-status ${p.status === 'solicitado' ? 'asked' : ''}`}
                    onClick={() => onToggleStatus(p)}
                  >
                    {p.status === 'solicitado' ? '📞 Solicitado' : '○ Por pedir'}
                  </button>
                  {normalizeUrl(p.link) && (
                    <button className="pending-link" onClick={() => openLink(p.link)}>🔗 Ver</button>
                  )}
                  <button className="pending-share" onClick={() => shareOne(p)} aria-label="Compartir">↗</button>
                  {p.status === 'solicitado' && (
                    <button className="pending-buy" onClick={() => onBuy(p)}>✓ Ya lo compré</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="project-row total">
            <span>Total pendiente</span>
            <span>{formatMoney(total)}</span>
          </div>

          <p className="pending-flow-hint">
            Toca <strong>○ Por pedir</strong> cuando ya se lo pediste al socio. Entonces aparecerá
            <strong> ✓ Ya lo compré</strong>, que al usarlo pasa el pendiente al libro diario como gasto.
          </p>

          <button className="pending-share-list" onClick={shareList}>
            ↗ Compartir lista con el socio
          </button>
        </>
      )}

      {toast && <p className="pending-toast">{toast}</p>}
    </div>
  )
}

function PendingEditor({ initial, onSave, onDelete, onClose }) {
  const confirm = useConfirm()
  const [concept, setConcept] = useState(initial?.concept ?? '')
  const [value, setValue] = useState(initial ? String(initial.amount) : '')
  const [link, setLink] = useState(initial?.link ?? '')
  const amount = Number(value)
  const safeLink = normalizeUrl(link)
  const badLink = link.trim() !== '' && !safeLink
  const canSave = concept.trim() !== '' && value !== '' && Number.isFinite(amount) && amount > 0 && !badLink

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>{initial ? 'Editar pendiente' : 'Nuevo pendiente'}</h2>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <p className="picker-label">¿Qué hay que comprar?</p>
        <input
          className="note-input"
          type="text"
          placeholder="Ej. Parrilla"
          value={concept}
          autoFocus
          onChange={(e) => setConcept(e.target.value)}
        />

        <p className="picker-label">Costo estimado</p>
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
            onChange={(e) => setValue(e.target.value)}
          />
        </div>

        <p className="picker-label">Enlace de dónde comprarlo (opcional)</p>
        <input
          className="note-input"
          type="url"
          inputMode="url"
          placeholder="Pega aquí el link de la tienda"
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
        {badLink ? (
          <p className="tanda-error">⚠️ Ese enlace no es válido. Debe empezar con http:// o https://</p>
        ) : (
          safeLink && <button className="link-btn" onClick={() => openLink(safeLink)}>🔗 Probar enlace</button>
        )}

        <div className="sheet-actions">
          {initial && (
            <button
              className="btn-danger"
              onClick={async () => {
                const ok = await confirm({
                  title: 'Eliminar pendiente',
                  message: 'Se quita de la lista de cosas por comprar.',
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
            onClick={() => onSave({ concept: concept.trim(), amount, link: safeLink })}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

function ProjectEditor({ initial, onSave, onDelete, onClose }) {
  const confirm = useConfirm()
  const [name, setName] = useState(initial?.name ?? '')
  const [mode, setMode] = useState(initial?.mode ?? 'gestoria')
  const [people, setPeople] = useState(
    initial?.participants ?? [{ id: ME_ID, name: 'Yo', share: 0 }]
  )
  const [newName, setNewName] = useState('')
  const [status, setStatus] = useState(initial?.status ?? 'active')

  // Al cambiar de modo se reacomodan las participaciones: en gestoría el socio
  // carga todo; en asociación se reparte en partes iguales.
  const applyMode = (m, list) => {
    if (m === 'gestoria') {
      const others = list.filter((p) => p.id !== ME_ID)
      const each = others.length ? equalSharesFor(others.length) : []
      return [
        { id: ME_ID, name: 'Yo', share: 0 },
        ...others.map((p, i) => ({ ...p, share: each[i] ?? 0 })),
      ]
    }
    const shares = equalSharesFor(list.length)
    return list.map((p, i) => ({ ...p, share: shares[i] }))
  }

  const selectMode = (m) => {
    setMode(m)
    setPeople(applyMode(m, people))
  }

  const addPerson = () => {
    const n = newName.trim()
    if (!n) return
    setPeople(applyMode(mode, [...people, { id: crypto.randomUUID(), name: n, share: 0 }]))
    setNewName('')
  }

  const removePerson = (id) => setPeople(applyMode(mode, people.filter((p) => p.id !== id)))

  const setShare = (id, value) =>
    setPeople(people.map((p) => (p.id === id ? { ...p, share: Number(value) || 0 } : p)))

  const totalShare = people.reduce((a, p) => a + (p.share || 0), 0)
  const sharesOk = Math.abs(totalShare - 100) < 0.5
  const canSave = name.trim() !== '' && people.length >= 2 && sharesOk

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

        <p className="picker-label">¿Cómo trabajas este proyecto?</p>
        <div className="kind-picker">
          {Object.entries(PROJECT_MODES).map(([id, m]) => (
            <button
              key={id}
              type="button"
              className={`kind-chip ${mode === id ? 'selected' : ''}`}
              style={{ flexBasis: '100%' }}
              onClick={() => selectMode(id)}
            >
              <span className="kind-chip-label">{m.label}</span>
              <span className="kind-chip-hint">{m.hint}</span>
            </button>
          ))}
        </div>

        <p className="picker-label">Socios y participación en el costo</p>
        <div className="participant-list">
          {people.map((p) => (
            <div key={p.id} className="participant-row">
              <span className="participant-name">{p.id === ME_ID ? '👤 Yo' : p.name}</span>
              <input
                className="participant-share-input"
                type="number"
                inputMode="decimal"
                min="0"
                max="100"
                value={p.share}
                onChange={(e) => setShare(p.id, e.target.value)}
              />
              <span className="participant-pct">%</span>
              {p.id !== ME_ID && (
                <button className="participant-remove" onClick={() => removePerson(p.id)} aria-label="Quitar">
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="participant-add">
          <input
            className="note-input"
            type="text"
            placeholder="Nombre del socio"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPerson()}
          />
          <button className="btn-ghost" onClick={addPerson} disabled={!newName.trim()}>+</button>
        </div>
        {!sharesOk && (
          <p className="tanda-error">⚠️ Las participaciones suman {totalShare}%. Deben sumar 100%.</p>
        )}
        {mode === 'gestoria' && (
          <p className="piggy-hint">
            En gestoría tú vas al 0%: el costo es del socio, así que todo lo que pagues de tu bolsa te lo deben.
          </p>
        )}

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
                  message: 'Se elimina el proyecto y todos los movimientos de su libro diario.',
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
            onClick={() => onSave({ name: name.trim(), mode, participants: people, status })}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

function MovementSheet({ initial, kind, prefill, project, accounts, onSave, onDelete, onClose }) {
  const confirm = useConfirm()
  const { categories } = useCategories()
  const people = project.participants ?? []
  const isSettlement = kind === 'settlement'
  const isFee = kind === 'fee'

  const [value, setValue] = useState(
    initial ? String(initial.amount) : prefill?.amount != null ? String(prefill.amount) : ''
  )
  const [chargedValue, setChargedValue] = useState(initial?.charged != null ? String(initial.charged) : '')
  const [concept, setConcept] = useState(initial?.concept ?? prefill?.concept ?? '')
  const [date, setDate] = useState(initial?.date ?? todayISO())
  // El honorario siempre lo aportas tú; los demás movimientos pueden ser de
  // cualquier participante.
  const [paidBy, setPaidBy] = useState(initial?.paidBy ?? (isFee ? ME_ID : ME_ID))
  const [paidTo, setPaidTo] = useState(initial?.paidTo ?? '')
  const [account, setAccount] = useState(initial?.account ?? (accounts[0]?.id ?? ''))
  const [category, setCategory] = useState(initial?.category ?? '')

  const amount = Number(value)
  const charged = chargedValue === '' ? null : Number(chargedValue)
  // Solo se pide cuenta cuando el dinero es tuyo: tú pagaste o tú lo recibes.
  const touchesMyMoney = paidBy === ME_ID || (isSettlement && paidTo === ME_ID)
  const canSave =
    value !== '' &&
    Number.isFinite(amount) &&
    amount > 0 &&
    (!isSettlement || (!!paidTo && paidTo !== paidBy)) &&
    (!touchesMyMoney || !!account)
  const incomeCategories = categories.filter((c) => c.type === 'income')

  const title = initial ? 'Editar movimiento' : isSettlement ? 'Pago directo' : isFee ? 'Mi honorario' : 'Nuevo gasto'

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {prefill && (
          <p className="piggy-hint">
            Al guardarlo saldrá de <strong>Pendientes por comprar</strong> y entrará al libro diario.
          </p>
        )}

        <p className="picker-label">{isSettlement ? 'Monto' : 'Costo real (lo que se pagó)'}</p>
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

        {!isFee && (
          <>
            <p className="picker-label">{isSettlement ? '¿Quién paga?' : '¿Quién pagó?'}</p>
            <div className="subcategory-picker">
              {people.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`subcategory-chip ${paidBy === p.id ? 'selected' : ''}`}
                  onClick={() => setPaidBy(p.id)}
                >
                  {p.id === ME_ID ? '👤 Yo' : p.name}
                </button>
              ))}
            </div>
          </>
        )}

        {isSettlement && (
          <>
            <p className="picker-label">¿A quién le paga?</p>
            <div className="subcategory-picker">
              {people
                .filter((p) => p.id !== paidBy)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`subcategory-chip ${paidTo === p.id ? 'selected' : ''}`}
                    onClick={() => setPaidTo(p.id)}
                  >
                    {p.id === ME_ID ? '👤 Yo' : p.name}
                  </button>
                ))}
            </div>
          </>
        )}

        {kind === 'expense' && (
          <>
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
              <p className="piggy-hint">Tu margen: <strong>{formatMoney(charged - amount)}</strong></p>
            )}
          </>
        )}

        {touchesMyMoney && accounts.length > 0 && (
          <>
            <p className="picker-label">
              {paidBy === ME_ID && !isSettlement
                ? '¿De qué cuenta salió?'
                : paidBy === ME_ID
                  ? '¿De qué cuenta sale?'
                  : '¿A qué cuenta entró?'}
            </p>
            <div className="subcategory-picker">
              {accounts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`subcategory-chip ${account === a.id ? 'selected' : ''}`}
                  onClick={() => setAccount(a.id)}
                >
                  {a.icon} {a.name}
                </button>
              ))}
            </div>
            <p className="piggy-hint">Se registrará en tus movimientos y afectará el saldo de esa cuenta.</p>
          </>
        )}

        {!touchesMyMoney && !isFee && (
          <p className="piggy-hint">
            Lo pagó {nameOf(project, paidBy)}: no toca tus cuentas ni aparece en tus movimientos.
          </p>
        )}

        {isFee && !initial && incomeCategories.length > 0 && (
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

        <p className="picker-label">Concepto</p>
        <input
          className="note-input"
          type="text"
          placeholder={kind === 'expense' ? 'Ej. Hojalatería, refacciones…' : 'Descripción (opcional)'}
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
        />

        <p className="picker-label">Fecha</p>
        <input
          className="date-input"
          type="date"
          value={date}
          max={todayISO()}
          onChange={(e) => setDate(e.target.value)}
        />

        <div className="sheet-actions">
          {initial && (
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
                paidBy: isFee ? ME_ID : paidBy,
                paidTo: isSettlement ? paidTo : null,
                account,
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

// Resumen para Inicio: cuánto te deben en proyectos activos.
export function ProjectsSummary({ projects, expenses, onOpen }) {
  const movementsByProject = useProjectMovements(expenses)
  const active = projects.filter((p) => p.status !== 'closed' && p.participants)

  const totals = useMemo(() => {
    let owed = 0
    let profit = 0
    for (const p of active) {
      const s = projectSummary(p, movementsByProject.get(p.id) ?? [])
      owed += Math.max(0, s.myBalance)
      profit += s.profit
    }
    return { owed, profit }
  }, [active, movementsByProject])

  if (active.length === 0) return null

  return (
    <button className="loan-summary-card" onClick={onOpen}>
      <span className="loan-summary-item">
        <span className="loan-summary-label">🏗️ Me deben en proyectos</span>
        <span className="loan-summary-value income-text">{formatMoney(totals.owed)}</span>
      </span>
      <span className="loan-summary-item">
        <span className="loan-summary-label">Utilidad acumulada</span>
        <span className="loan-summary-value">{formatMoney(totals.profit)}</span>
      </span>
    </button>
  )
}
