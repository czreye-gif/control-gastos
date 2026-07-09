import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatMoney } from './ExpenseList'
import { AccountEditor, DepositSheet } from './Accounts'
import { TandaCard, TandaEditor } from './Tandas'
import { useExpenses } from '../utils/useExpenses'
import { useAccounts, computeBalances, isPiggyLocked } from '../utils/useAccounts'
import { useTandas } from '../utils/useTandas'
import { formatDayLabel } from '../utils/dates'

export default function Ahorros() {
  const navigate = useNavigate()
  const { expenses, loading: loadingExp } = useExpenses()
  const { accounts, addAccount, updateAccount, deleteAccount, deposit, loading: loadingAcc } = useAccounts()
  const {
    tandas,
    loading: loadingTandas,
    addTanda,
    updateTanda,
    deleteTanda,
    registerContribution,
    undoContribution,
    registerPayout,
    undoPayout,
  } = useTandas()

  const [editingPiggy, setEditingPiggy] = useState(null) // null | 'new' | alcancía
  const [depositing, setDepositing] = useState(null)
  const [editingTanda, setEditingTanda] = useState(null) // null | 'new' | tanda

  const piggies = useMemo(
    () => computeBalances(accounts.filter((a) => a.piggy), expenses),
    [accounts, expenses]
  )
  const regularAccounts = useMemo(() => accounts.filter((a) => !a.piggy), [accounts])

  // Agrupa los movimientos de tanda por tandaId para pasarlos a cada TandaCard.
  const tandaMovementsMap = useMemo(() => {
    const map = new Map()
    for (const e of expenses) {
      if (e.tandaId) {
        if (!map.has(e.tandaId)) map.set(e.tandaId, [])
        map.get(e.tandaId).push(e)
      }
    }
    return map
  }, [expenses])

  const savePiggy = async (data) => {
    if (editingPiggy && editingPiggy !== 'new') await updateAccount(editingPiggy.id, data)
    else await addAccount(data)
    setEditingPiggy(null)
  }
  const deletePiggy = async (id) => {
    await deleteAccount(id)
    setEditingPiggy(null)
  }

  const saveTanda = async (data) => {
    if (editingTanda && editingTanda !== 'new') await updateTanda(editingTanda.id, data)
    else await addTanda(data)
    setEditingTanda(null)
  }
  const deleteTandaFn = async (id) => {
    await deleteTanda(id)
    setEditingTanda(null)
  }

  if (loadingExp || loadingAcc || loadingTandas) return <p className="loading-text">Cargando...</p>

  return (
    <div className="page">
      <header className="sub-header">
        <button className="icon-btn" onClick={() => navigate('/')} aria-label="Volver">
          ←
        </button>
        <h1>Ahorros</h1>
      </header>

      <p className="page-subtitle">
        Aquí guardas dinero apartado: <strong>alcancías</strong> con fecha sorpresa y <strong>tandas</strong>. El
        dinero se mueve como traspaso, no como gasto.
      </p>

      {/* Alcancías */}
      <div className="section-row">
        <h3 className="section-title">🎁 Alcancías</h3>
        <button className="link-btn" onClick={() => setEditingPiggy('new')}>
          + Nueva
        </button>
      </div>
      {piggies.length === 0 ? (
        <button className="budget-cta" onClick={() => setEditingPiggy('new')}>
          Crea una alcancía para juntar dinero hacia una fecha especial →
        </button>
      ) : (
        <div className="account-list">
          {piggies.map((a) => {
            const locked = isPiggyLocked(a)
            return (
              <div key={a.id} className={`account-card piggy ${locked ? 'locked' : ''}`}>
                <button className="account-main" onClick={() => setEditingPiggy(a)}>
                  <span className="account-icon" style={{ background: a.color + '22', color: a.color }}>
                    {locked ? '🎁' : a.icon}
                  </span>
                  <span className="account-info">
                    <span className="account-name">{a.name}</span>
                    <span className="account-sub">
                      {locked ? `Se abre el ${formatDayLabel(a.revealDate)}` : '¡Alcancía abierta! 🎉'}
                    </span>
                  </span>
                  {locked ? (
                    <span className="account-balance hidden">••••</span>
                  ) : (
                    <span className={`account-balance ${a.balance < 0 ? 'negative' : ''}`}>
                      {formatMoney(a.balance)}
                    </span>
                  )}
                </button>
                <button className="account-deposit" onClick={() => setDepositing(a)}>
                  + Depositar
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Tandas */}
      <div className="section-row">
        <h3 className="section-title">🤝 Tandas</h3>
        <button className="link-btn" onClick={() => setEditingTanda('new')}>
          + Nueva
        </button>
      </div>
      {tandas.length === 0 ? (
        <button className="budget-cta" onClick={() => setEditingTanda('new')}>
          Registra una tanda para darle seguimiento a tus aportaciones →
        </button>
      ) : (
        <div className="tanda-list">
          {tandas.map((t) => (
            <TandaCard
              key={t.id}
              tanda={t}
              accounts={accounts}
              movements={tandaMovementsMap.get(t.id) ?? []}
              onEdit={() => setEditingTanda(t)}
              onContribute={(date) => registerContribution(t, date)}
              onUndoContribute={() => undoContribution(t)}
              onPayout={(date) => registerPayout(t, date)}
              onUndoPayout={() => undoPayout(t)}
            />
          ))}
        </div>
      )}

      {editingPiggy && (
        <AccountEditor
          variant="piggy"
          initial={editingPiggy === 'new' ? null : editingPiggy}
          onSave={savePiggy}
          onDelete={deletePiggy}
          onClose={() => setEditingPiggy(null)}
        />
      )}
      {depositing && (
        <DepositSheet
          piggy={depositing}
          accounts={accounts}
          onDeposit={async (amount, source) => {
            await deposit({ piggy: depositing, amount, source })
            setDepositing(null)
          }}
          onClose={() => setDepositing(null)}
        />
      )}
      {editingTanda && (
        <TandaEditor
          initial={editingTanda === 'new' ? null : editingTanda}
          accounts={regularAccounts}
          onSave={saveTanda}
          onDelete={deleteTandaFn}
          onClose={() => setEditingTanda(null)}
        />
      )}
    </div>
  )
}
