import { createContext, useCallback, useContext, useRef, useState } from 'react'

const ConfirmContext = createContext(null)

// Diálogo de confirmación reutilizable basado en promesa:
//   const confirm = useConfirm()
//   if (await confirm({ title, message })) { ...borrar... }
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null)
  const resolver = useRef(null)

  const confirm = useCallback((options = {}) => {
    setState({
      title: options.title ?? '¿Estás seguro?',
      message: options.message ?? '',
      confirmText: options.confirmText ?? 'Eliminar',
      cancelText: options.cancelText ?? 'Cancelar',
      danger: options.danger ?? true,
    })
    return new Promise((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const close = (result) => {
    setState(null)
    if (resolver.current) {
      resolver.current(result)
      resolver.current = null
    }
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="confirm-backdrop" onClick={() => close(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>{state.title}</h3>
            {state.message && <p>{state.message}</p>}
            <div className="confirm-actions">
              <button className="btn-ghost" onClick={() => close(false)}>
                {state.cancelText}
              </button>
              <button
                className={state.danger ? 'btn-danger-solid' : 'btn-primary'}
                onClick={() => close(true)}
              >
                {state.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  return useContext(ConfirmContext)
}
