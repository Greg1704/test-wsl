import * as React from "react"

const MOBILE_BREAKPOINT = 768

// useSyncExternalStore es el patrón de React para suscribirse a estado externo
// (acá, el viewport): evita el setState dentro de useEffect que marca el linter
// y es seguro para SSR (en el server siempre devuelve false).
function subscribe(callback: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

function getSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT
}

function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
