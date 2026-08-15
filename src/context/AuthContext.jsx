import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from '../firebase.js'

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  async function loginWithEmail(email, password) {
    setAuthError(null)
    try {
      return await signInWithEmailAndPassword(auth, email, password)
    } catch (err) {
      console.error("Error en loginWithEmail:", err)
      setAuthError(mapAuthError(err.code))
      throw err
    }
  }

  async function registerWithEmail(email, password, displayName) {
    setAuthError(null)
    try {
      const res = await createUserWithEmailAndPassword(auth, email, password)
      if (displayName && res.user) {
        await updateProfile(res.user, { displayName })
      }
      return res
    } catch (err) {
      console.error("Error en registerWithEmail:", err)
      setAuthError(mapAuthError(err.code))
      throw err
    }
  }

  async function logout() {
    setAuthError(null)
    try {
      return await signOut(auth)
    } catch (err) {
      console.error("Error en logout:", err)
      throw err
    }
  }

  function mapAuthError(code) {
    switch (code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Correo o contraseña incorrectos.'
      case 'auth/email-already-in-use':
        return 'Este correo electrónico ya está registrado.'
      case 'auth/weak-password':
        return 'La contraseña debe tener al menos 6 caracteres.'
      case 'auth/invalid-email':
        return 'Formato de correo electrónico no válido.'
      default:
        return 'Error de autenticación. Inténtalo de nuevo.'
    }
  }

  const value = {
    currentUser,
    loading,
    authError,
    setAuthError,
    loginWithEmail,
    registerWithEmail,
    logout
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}
