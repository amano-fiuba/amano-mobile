import { useEffect } from 'react'

// Closes a dropdown with Escape or with a click outside of `ref`.
export function useDismiss(ref, isOpen, onClose) {
  useEffect(() => {
    if (!isOpen) {
      return undefined
    }
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    const handlePointer = (event) => {
      if (!ref.current?.contains(event.target)) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKey)
    document.addEventListener('mousedown', handlePointer)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('mousedown', handlePointer)
    }
  }, [ref, isOpen, onClose])
}
