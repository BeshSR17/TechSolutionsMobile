// hooks/useValidacion.js
// Hook reutilizable de validaciones para formularios — React Native

const REGLAS = {
  requerido: (val) =>
    val !== null && val !== undefined && String(val).trim() !== ''
      ? null
      : 'Este campo es requerido',

  email: (val) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val).trim())
      ? null
      : 'Ingresa un correo electrónico válido',

  minLength: (min) => (val) =>
    String(val).trim().length >= min
      ? null
      : `Mínimo ${min} caracteres`,

  maxLength: (max) => (val) =>
    String(val).trim().length <= max
      ? null
      : `Máximo ${max} caracteres`,

  soloTexto: (val) =>
    /^[a-zA-ZÀ-ÿ\s]+$/.test(String(val).trim())
      ? null
      : 'Solo se permiten letras',

  telefono: (val) =>
    val === '' || /^[\d\s\+\-\(\)]{7,15}$/.test(String(val).trim())
      ? null
      : 'Formato de teléfono inválido',

  url: (val) =>
    val === '' || /^https?:\/\/.+/.test(String(val).trim())
      ? null
      : 'La URL debe comenzar con http:// o https://',

  noVacio: (val) =>
    val && String(val).trim() !== ''
      ? null
      : 'Selecciona una opción',

  passwordIgual: (otroValor) => (val) =>
    val === otroValor
      ? null
      : 'Las contraseñas no coinciden',
}

/**
 * Valida un objeto de datos contra un esquema de reglas.
 *
 * Uso:
 *   const errores = validar(formData, {
 *     nombre:   [REGLAS.requerido, REGLAS.minLength(3)],
 *     email:    [REGLAS.requerido, REGLAS.email],
 *     telefono: [REGLAS.telefono],
 *   })
 *
 * @param {object} datos   - El objeto con los valores del formulario
 * @param {object} esquema - Mapa de campo → array de funciones validadoras
 * @returns {object} errores - Mapa de campo → primer error encontrado (o {})
 */
export function validar(datos, esquema) {
  const errores = {}
  for (const campo in esquema) {
    const valor = datos[campo] ?? ''
    const reglas = esquema[campo]
    for (const regla of reglas) {
      const error = regla(valor)
      if (error) {
        errores[campo] = error
        break // Solo el primer error por campo
      }
    }
  }
  return errores
}

/**
 * Verifica si un objeto de errores está vacío (formulario válido).
 */
export function esValido(errores) {
  return Object.keys(errores).length === 0
}

export { REGLAS }