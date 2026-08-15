import { dbFirestore, doc, setDoc, deleteDoc, collection, onSnapshot } from '../firebase.js'
import { db } from '../db.js'

let unsubscribeJornadas = null
let unsubscribeGastos = null
let currentSyncUid = null

export async function initFirestoreSync(uid) {
  if (!uid) {
    if (unsubscribeJornadas) unsubscribeJornadas()
    if (unsubscribeGastos) unsubscribeGastos()
    currentSyncUid = null
    return
  }

  // Si cambia de usuario o inicia sesión por primera vez, limpiar listeners
  if (unsubscribeJornadas) unsubscribeJornadas()
  if (unsubscribeGastos) unsubscribeGastos()

  // Si el usuario cambia en la misma sesión, aislar la base de datos local
  if (currentSyncUid && currentSyncUid !== uid) {
    await db.jornadas.clear()
    await db.gastos.clear()
  }
  currentSyncUid = uid

  // 1. Escuchar ÚNICAMENTE las jornadas de este usuario en Cloud Firestore
  const jornadasRef = collection(dbFirestore, 'users', uid, 'jornadas')
  unsubscribeJornadas = onSnapshot(jornadasRef, async (snapshot) => {
    const cloudDocs = snapshot.docs.map(d => ({ ...d.data(), idFirestore: d.id }))
    
    // Sincronizar en IndexedDB asegurando aislamiento por usuario
    await db.transaction('rw', db.jornadas, async () => {
      for (const data of cloudDocs) {
        const existing = await db.jornadas.where('date').equals(data.date).and(j => j.period === data.period).first()
        if (existing) {
          await db.jornadas.update(existing.id, { ...data, syncedToCloud: true })
        } else {
          await db.jornadas.add({ ...data, syncedToCloud: true })
        }
      }
    })
  }, (err) => {
    console.error("Error en listener de Firestore Jornadas:", err)
  })

  // 2. Escuchar ÚNICAMENTE los gastos de este usuario en Cloud Firestore
  const gastosRef = collection(dbFirestore, 'users', uid, 'gastos')
  unsubscribeGastos = onSnapshot(gastosRef, async (snapshot) => {
    const cloudDocs = snapshot.docs.map(d => ({ ...d.data(), idFirestore: d.id }))

    await db.transaction('rw', db.gastos, async () => {
      for (const data of cloudDocs) {
        const existing = await db.gastos.where('fecha').equals(data.fecha).and(g => g.concepto === data.concepto).first()
        if (existing) {
          await db.gastos.update(existing.id, { ...data, syncedToCloud: true })
        } else {
          await db.gastos.add({ ...data, syncedToCloud: true })
        }
      }
    })
  }, (err) => {
    console.error("Error en listener de Firestore Gastos:", err)
  })

  // Sincronizar cambios locales pendientes creados por este usuario
  pushLocalToCloud(uid)
}

export async function pushLocalToCloud(uid) {
  if (!uid) return
  try {
    const localJornadas = await db.jornadas.toArray()
    for (const j of localJornadas) {
      // Solo subir las jornadas que pertenecen localmente a este usuario o son nuevas
      const docId = `${j.date}_${j.period}`
      const docRef = doc(dbFirestore, 'users', uid, 'jornadas', docId)
      await setDoc(docRef, { ...j, userId: uid }, { merge: true })
      if (j.id) await db.jornadas.update(j.id, { syncedToCloud: true })
    }

    const localGastos = await db.gastos.toArray()
    for (const g of localGastos) {
      const docId = `gasto_${g.fecha}_${(g.concepto || '').replace(/\s+/g, '_')}`
      const docRef = doc(dbFirestore, 'users', uid, 'gastos', docId)
      await setDoc(docRef, { ...g, userId: uid }, { merge: true })
      if (g.id) await db.gastos.update(g.id, { syncedToCloud: true })
    }
  } catch (err) {
    console.error("Error en pushLocalToCloud:", err)
  }
}

export async function clearUserLocalData() {
  if (unsubscribeJornadas) unsubscribeJornadas()
  if (unsubscribeGastos) unsubscribeGastos()
  currentSyncUid = null
  await db.jornadas.clear()
  await db.gastos.clear()
}

export async function syncJornadaToCloud(uid, jornada) {
  if (!uid || !jornada) return
  try {
    const docId = `${jornada.date}_${jornada.period}`
    const docRef = doc(dbFirestore, 'users', uid, 'jornadas', docId)
    await setDoc(docRef, { ...jornada, userId: uid }, { merge: true })
    if (jornada.id) await db.jornadas.update(jornada.id, { syncedToCloud: true })
  } catch (err) {
    console.error("Error en syncJornadaToCloud:", err)
  }
}

export async function deleteJornadaFromCloud(uid, fecha, periodo) {
  if (!uid || !fecha || !periodo) return
  try {
    const docId = `${fecha}_${periodo}`
    const docRef = doc(dbFirestore, 'users', uid, 'jornadas', docId)
    await deleteDoc(docRef)
  } catch (err) {
    console.error("Error en deleteJornadaFromCloud:", err)
  }
}

export async function syncGastoToCloud(uid, gasto) {
  if (!uid || !gasto) return
  try {
    const docId = `gasto_${gasto.fecha}_${(gasto.concepto || '').replace(/\s+/g, '_')}`
    const docRef = doc(dbFirestore, 'users', uid, 'gastos', docId)
    await setDoc(docRef, { ...gasto, userId: uid }, { merge: true })
    if (gasto.id) await db.gastos.update(gasto.id, { syncedToCloud: true })
  } catch (err) {
    console.error("Error en syncGastoToCloud:", err)
  }
}

export async function deleteGastoFromCloud(uid, fecha, concepto) {
  if (!uid || !fecha || !concepto) return
  try {
    const docId = `gasto_${fecha}_${(concepto || '').replace(/\s+/g, '_')}`
    const docRef = doc(dbFirestore, 'users', uid, 'gastos', docId)
    await deleteDoc(docRef)
  } catch (err) {
    console.error("Error en deleteGastoFromCloud:", err)
  }
}
